import os
import re
import subprocess
from enum import Enum
from typing import List, Dict, Any, Optional, Set, Tuple
from dataclasses import dataclass, asdict
from docs_healer.logger import logger
from docs_healer.config import Config
from docs_healer.code_parser import CodeChunk, CodeParser

class ChangeType(Enum):
    SIGNATURE_CHANGE = "signature_change"
    BEHAVIOR_CHANGE = "behavior_change"
    NEW_FEATURE = "new_feature"
    REMOVED_FEATURE = "removed_feature"
    CONFIG_CHANGE = "config_change"
    COMMENT_ONLY = "comment_only"
    WHITESPACE_ONLY = "whitespace_only"
    TEST_ONLY = "test_only"

@dataclass
class CodeChange:
    file_path: str
    change_type: ChangeType
    affected_chunk_ids: List[str]
    old_content: str
    new_content: str
    is_meaningful: bool
    metadata: Dict[str, Any]

    def to_dict(self) -> Dict[str, Any]:
        d = asdict(self)
        d["change_type"] = self.change_type.value
        return d

class GitDiffParser:
    def __init__(self, repo_root: str, config: Config, code_parser: CodeParser):
        self.repo_root = os.path.abspath(repo_root)
        self.config = config
        self.code_parser = code_parser

    def _run_git(self, args: List[str]) -> Tuple[int, str, str]:
        """Helper to run a git command, returning exit_code, stdout, and stderr."""
        try:
            res = subprocess.run(
                ["git"] + args,
                cwd=self.repo_root,
                capture_output=True,
                text=True,
                check=False
            )
            return res.returncode, res.stdout, res.stderr
        except Exception as e:
            logger.error(f"Git command failed: git {' '.join(args)}", phase="parsing", exception=e)
            return -1, "", str(e)

    def parse_pr_diff(self, base_ref: str, head_ref: str) -> List[CodeChange]:
        """Extract git diff between base_ref and head_ref and classify changes."""
        logger.info(f"Extracting git diff between {base_ref} and {head_ref}", phase="parsing")

        # 1. Check refs validity
        exit_code, _, _ = self._run_git(["rev-parse", "--verify", base_ref])
        if exit_code != 0:
            logger.error(f"Invalid base reference: {base_ref}", phase="parsing")
            # Return empty list as per requirement 14
            return []

        exit_code, _, _ = self._run_git(["rev-parse", "--verify", head_ref])
        if exit_code != 0:
            logger.error(f"Invalid head reference: {head_ref}", phase="parsing")
            return []

        # 2. Get list of files changed
        exit_code, stdout, stderr = self._run_git(["diff", "--name-status", base_ref, head_ref])
        if exit_code != 0:
            logger.error(f"Git diff --name-status failed: {stderr}", phase="parsing")
            return []

        changes: List[CodeChange] = []
        for line in stdout.splitlines():
            line = line.strip()
            if not line:
                continue
            parts = line.split(maxsplit=1)
            if len(parts) < 2:
                continue
            status, file_path = parts
            
            # Resolve relative file path
            # If the file path is changed/renamed (status starting with R), parts may contain old and new paths.
            if status.startswith("R"):
                subparts = file_path.split(maxsplit=1)
                if len(subparts) == 2:
                    _, file_path = subparts

            # Only check files matched by our configuration patterns or md
            if not self.config.is_file_included(file_path):
                continue

            # Parse the specific file change
            try:
                change = self._process_file_change(file_path, status, base_ref, head_ref)
                if change:
                    changes.append(change)
            except Exception as e:
                logger.error(f"Failed to process file change for {file_path}", phase="parsing", exception=e)

        logger.info(
            f"Git diff parsing complete. Found {len(changes)} changed files.",
            phase="parsing",
            extra={"meaningful_changes_count": len([c for c in changes if c.is_meaningful])}
        )
        return changes

    def _process_file_change(self, file_path: str, status: str, base_ref: str, head_ref: str) -> Optional[CodeChange]:
        # 1. Test file check
        is_test = False
        lower_path = file_path.lower()
        if "test" in lower_path or "spec" in lower_path:
            is_test = True

        if is_test:
            return CodeChange(
                file_path=file_path,
                change_type=ChangeType.TEST_ONLY,
                affected_chunk_ids=[],
                old_content="",
                new_content="",
                is_meaningful=False,
                metadata={"test_file": True}
            )

        # 2. Deleted status
        if status == "D":
            # Extract old content
            exit_code, old_file_content, _ = self._run_git(["show", f"{base_ref}:{file_path}"])
            return CodeChange(
                file_path=file_path,
                change_type=ChangeType.REMOVED_FEATURE,
                affected_chunk_ids=[],
                old_content=old_file_content if exit_code == 0 else "",
                new_content="",
                is_meaningful=True,
                metadata={"status": "deleted"}
            )

        # 3. New/Added status
        if status == "A":
            abs_path = os.path.join(self.repo_root, file_path)
            new_content = ""
            if os.path.exists(abs_path):
                with open(abs_path, "r", encoding="utf-8") as f:
                    new_content = f.read()

            # Parse new chunks
            new_chunks = self.code_parser.parse_python_file(abs_path, file_path) if file_path.endswith(".py") else self.code_parser.parse_ts_file(abs_path, file_path)
            chunk_ids = [c.id for c in new_chunks]

            return CodeChange(
                file_path=file_path,
                change_type=ChangeType.NEW_FEATURE,
                affected_chunk_ids=chunk_ids,
                old_content="",
                new_content=new_content,
                is_meaningful=True,
                metadata={"status": "added"}
            )

        # 4. Modified status (M)
        # Fetch old content and new content
        exit_code, old_content, _ = self._run_git(["show", f"{base_ref}:{file_path}"])
        if exit_code != 0:
            old_content = ""

        abs_path = os.path.join(self.repo_root, file_path)
        new_content = ""
        if os.path.exists(abs_path):
            with open(abs_path, "r", encoding="utf-8") as f:
                new_content = f.read()

        # Parse git diff for modified line ranges in new and old files
        _, diff_out, _ = self._run_git(["diff", "-U0", base_ref, head_ref, "--", file_path])
        
        modified_lines_new: List[Tuple[int, int]] = []  # List of (start_line, count) in head
        modified_lines_old: List[Tuple[int, int]] = []  # List of (start_line, count) in base

        # Parse diff hunks: @@ -old_start,old_count +new_start,new_count @@
        hunk_re = re.compile(r"^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@")
        
        # Analyze if it is comment only or whitespace only
        diff_lines = diff_out.splitlines()
        added_lines = []
        deleted_lines = []
        
        for line in diff_lines:
            match = hunk_re.match(line)
            if match:
                old_start = int(match.group(1))
                old_count = int(match.group(2)) if match.group(2) else 1
                new_start = int(match.group(3))
                new_count = int(match.group(4)) if match.group(4) else 1
                
                modified_lines_old.append((old_start, old_count))
                modified_lines_new.append((new_start, new_count))
            elif line.startswith("+") and not line.startswith("+++"):
                added_lines.append(line[1:])
            elif line.startswith("-") and not line.startswith("---"):
                deleted_lines.append(line[1:])

        # Check if whitespace only
        is_whitespace_only = True
        for line in added_lines + deleted_lines:
            if line.strip():
                is_whitespace_only = False
                break
        
        if is_whitespace_only and (added_lines or deleted_lines):
            return CodeChange(
                file_path=file_path,
                change_type=ChangeType.WHITESPACE_ONLY,
                affected_chunk_ids=[],
                old_content=old_content,
                new_content=new_content,
                is_meaningful=False,
                metadata={"whitespace_only": True}
            )

        # Check if comment only
        is_comment_only = True
        comment_prefixes = ("#", "//", "/*", "*", '"""', "'''")
        for line in added_lines + deleted_lines:
            trimmed = line.strip()
            if trimmed and not trimmed.startswith(comment_prefixes):
                is_comment_only = False
                break
                
        if is_comment_only and (added_lines or deleted_lines):
            return CodeChange(
                file_path=file_path,
                change_type=ChangeType.COMMENT_ONLY,
                affected_chunk_ids=[],
                old_content=old_content,
                new_content=new_content,
                is_meaningful=False,
                metadata={"comment_only": True}
            )

        # It's a meaningful change! Map lines to chunks
        # Save temp base file to parse old chunks
        temp_base_file = os.path.join(self.repo_root, f".temp_base_{os.path.basename(file_path)}")
        old_chunks = []
        try:
            with open(temp_base_file, "w", encoding="utf-8") as f:
                f.write(old_content)
            old_chunks = self.code_parser.parse_python_file(temp_base_file, file_path) if file_path.endswith(".py") else self.code_parser.parse_ts_file(temp_base_file, file_path)
        except Exception as e:
            logger.warning(f"Failed to parse old chunks for {file_path}: {e}", phase="parsing")
        finally:
            if os.path.exists(temp_base_file):
                os.remove(temp_base_file)

        # Parse new chunks
        new_chunks = self.code_parser.parse_python_file(abs_path, file_path) if file_path.endswith(".py") else self.code_parser.parse_ts_file(abs_path, file_path)

        affected_chunk_ids = set()

        def line_overlaps_range(line_start: int, count: int, range_start: int, range_end: int) -> bool:
            # line range is [line_start, line_start + count - 1]
            line_end = line_start + max(count, 1) - 1
            return not (line_end < range_start or line_start > range_end)

        # Match new chunks with new modified lines
        for chunk in new_chunks:
            for l_start, l_count in modified_lines_new:
                if line_overlaps_range(l_start, l_count, chunk.line_start, chunk.line_end):
                    affected_chunk_ids.add(chunk.id)
                    break

        # Match old chunks with old modified lines
        for chunk in old_chunks:
            for l_start, l_count in modified_lines_old:
                if line_overlaps_range(l_start, l_count, chunk.line_start, chunk.line_end):
                    affected_chunk_ids.add(chunk.id)
                    break

        # Classify the change type based on chunks differences
        change_type = ChangeType.BEHAVIOR_CHANGE
        
        # Check if configuration schema changed
        has_config_change = any(c.type == "config_schema" for c in new_chunks if c.id in affected_chunk_ids)
        if has_config_change:
            change_type = ChangeType.CONFIG_CHANGE
        else:
            # Check for signature changes
            old_chunks_dict = {c.id: c for c in old_chunks}
            for new_c in new_chunks:
                if new_c.id in affected_chunk_ids:
                    old_c = old_chunks_dict.get(new_c.id)
                    if old_c and old_c.signature != new_c.signature:
                        change_type = ChangeType.SIGNATURE_CHANGE
                        break

        return CodeChange(
            file_path=file_path,
            change_type=change_type,
            affected_chunk_ids=list(affected_chunk_ids),
            old_content=old_content,
            new_content=new_content,
            is_meaningful=True,
            metadata={"status": "modified"}
        )

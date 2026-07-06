import os
import json
import time
import subprocess
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass, asdict
from github import Github, GithubException
from docs_healer.logger import logger
from docs_healer.config import Config
from docs_healer.index import CodeToDocsIndex
from docs_healer.repair import DocCorrection

@dataclass
class PRSummary:
    verified_sections: List[str]
    auto_fixed_sections: List[str]
    flagged_sections: List[str]
    auto_fix_pr_number: Optional[int]
    total_execution_time: float
    metadata: Dict[str, Any]

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

class GitHubIntegrationManager:
    def __init__(self, token: str, config: Config, repo_root: str):
        self.token = token
        self.config = config
        self.repo_root = os.path.abspath(repo_root)
        self.github = Github(token) if token else None

    def _get_repo(self) -> Any:
        if not self.github:
            raise ValueError("GitHub client not initialized. GITHUB_TOKEN environment variable is missing.")
        if not self.config.github_repository:
            raise ValueError("GITHUB_REPOSITORY environment variable is missing.")
        return self.github.get_repo(self.config.github_repository)

    def _call_api_with_backoff(self, func, *args, **kwargs) -> Any:
        """Call a GitHub API function with exponential backoff on rate limits."""
        retries = 5
        backoff_factor = 2
        for attempt in range(retries):
            try:
                logger.track_api_call()
                return func(*args, **kwargs)
            except GithubException as ge:
                # 403 could be rate limit or permission error
                is_rate_limit = ge.status == 403 and "rate limit" in str(ge.data).lower()
                is_forbidden = ge.status == 403
                
                if is_rate_limit:
                    logger.track_rate_limit()
                    sleep_time = backoff_factor ** attempt
                    logger.warning(
                        f"GitHub API rate limit hit. Retrying in {sleep_time}s (Attempt {attempt+1}/{retries})...",
                        phase="github",
                        extra={"error": str(ge)}
                    )
                    time.sleep(sleep_time)
                elif is_forbidden:
                    # Permission error, propagate immediately as it won't resolve with retries
                    raise ge
                else:
                    # Other exceptions (e.g. 502, 503)
                    if attempt == retries - 1:
                        raise ge
                    time.sleep(1)
            except Exception as e:
                if attempt == retries - 1:
                    raise e
                time.sleep(1)

    def apply_corrections_to_branch(self, corrections: List[DocCorrection], index: CodeToDocsIndex, branch_name: str) -> None:
        """Create a new branch locally and apply edits at specified line ranges."""
        logger.info(f"Applying {len(corrections)} corrections locally on new branch: {branch_name}", phase="github")
        
        # 1. Run git checkout -b branch_name
        self._run_git(["checkout", "-b", branch_name])
        
        # 2. Group edits by file
        edits_by_file: Dict[str, List[Tuple[int, int, str]]] = {}
        for c in corrections:
            sec = index.doc_sections.get(c.doc_section_id)
            if not sec:
                continue
            if sec.file_path not in edits_by_file:
                edits_by_file[sec.file_path] = []
            edits_by_file[sec.file_path].append((sec.line_start, sec.line_end, c.corrected_content))

        # 3. Apply edits (reverse order to handle line number shifts)
        for file_path, file_edits in edits_by_file.items():
            abs_path = os.path.join(self.repo_root, file_path)
            if not os.path.exists(abs_path):
                logger.warning(f"File not found to apply correction: {file_path}", phase="github")
                continue

            with open(abs_path, "r", encoding="utf-8") as f:
                lines = f.readlines()

            # Sort edits in descending order of line_start
            file_edits.sort(key=lambda x: x[0], reverse=True)

            for start, end, new_text in file_edits:
                # Add trailing newline if not present
                if not new_text.endswith("\n"):
                    new_text += "\n"
                # lines list is 0-indexed, start/end are 1-indexed
                lines[start - 1:end] = [new_text]

            with open(abs_path, "w", encoding="utf-8") as f:
                f.writelines(lines)

    def _run_git(self, args: List[str]) -> Tuple[int, str, str]:
        res = subprocess.run(
            ["git"] + args,
            cwd=self.repo_root,
            capture_output=True,
            text=True,
            check=False
        )
        return res.returncode, res.stdout, res.stderr

    def create_fix_pr(self, corrections: List[DocCorrection], index: CodeToDocsIndex, base_branch: str, source_pr_number: int) -> Optional[int]:
        """Apply corrections, push branch and create pull request via GitHub API."""
        timestamp = int(time.time())
        branch_name = f"docs-healer/fix-pr-{source_pr_number}-{timestamp}"
        
        # Save current branch to restore it later
        _, active_branch, _ = self._run_git(["rev-parse", "--abbrev-ref", "HEAD"])
        active_branch = active_branch.strip()

        try:
            # Configure Git credentials with token
            repo_url = f"https://x-access-token:{self.token}@github.com/{self.config.github_repository}.git"
            self._run_git(["remote", "set-url", "origin", repo_url])

            # Apply corrections to a local branch
            self.apply_corrections_to_branch(corrections, index, branch_name)

            # Git commit
            logger.info("Committing documentation changes", phase="github")
            self._run_git(["add", "."])
            commit_msg = f"docs: automatically fix stale sections from PR #{source_pr_number}"
            self._run_git(["commit", "-m", commit_msg])

            # Git push
            logger.info(f"Pushing branch {branch_name} to remote", phase="github")
            rc, stdout, stderr = self._run_git(["push", "origin", branch_name])
            if rc != 0:
                raise Exception(f"Failed to push git branch: {stderr}")

            # Create Pull Request
            logger.info("Creating pull request via GitHub API", phase="github")
            repo = self._get_repo()
            
            title = f"Automated Documentation Corrections for PR #{source_pr_number}"
            body = self.format_pr_description(corrections, index, source_pr_number)

            def create_pr():
                return repo.create_pull(
                    title=title,
                    body=body,
                    head=branch_name,
                    base=base_branch
                )

            pr = self._call_api_with_backoff(create_pr)
            logger.info(f"Pull request created successfully: #{pr.number}", phase="github")
            return pr.number

        except GithubException as ge:
            if ge.status == 403:
                logger.error(
                    "GitHub API permission error during PR creation. GITHUB_TOKEN has insufficient scopes. "
                    "Make sure it has 'write' permissions for pull requests.",
                    phase="github",
                    exception=ge
                )
            else:
                logger.error(f"GitHub API error during PR creation: {str(ge)}", phase="github", exception=ge)
            
            # Save corrections to local file on permission or any other API error
            self.save_corrections_locally(corrections, index)
            return None
        except Exception as e:
            logger.error("Failed to execute git flow or create PR", phase="github", exception=e)
            self.save_corrections_locally(corrections, index)
            return None
        finally:
            # Restore original branch
            self._run_git(["checkout", active_branch])

    def format_pr_description(self, corrections: List[DocCorrection], index: CodeToDocsIndex, source_pr_number: int) -> str:
        desc = [
            f"This is an automated pull request containing documentation corrections generated by the Self-Healing Technical Documentation system in response to code changes in PR #{source_pr_number}.\n",
            "### Applied Documentation Fixes\n"
        ]
        for c in corrections:
            sec = index.doc_sections.get(c.doc_section_id)
            if sec:
                desc.append(f"- **File**: `{sec.file_path}`")
                desc.append(f"  - **Section**: `{sec.heading_path}` (Lines {sec.line_start}-{sec.line_end})")
                desc.append("  - **Changes Made**:")
                for change in c.changes_made:
                    desc.append(f"    - {change}")
        return "\n".join(desc)

    def save_corrections_locally(self, corrections: List[DocCorrection], index: CodeToDocsIndex) -> None:
        """Save corrections to local JSON at .self-healing-docs/corrections.json."""
        try:
            os.makedirs(os.path.join(self.repo_root, ".self-healing-docs"), exist_ok=True)
            output_file = os.path.join(self.repo_root, ".self-healing-docs", "corrections.json")
            
            data = []
            for c in corrections:
                sec = index.doc_sections.get(c.doc_section_id)
                if sec:
                    data.append({
                        "doc_section_id": c.doc_section_id,
                        "file_path": sec.file_path,
                        "heading_path": sec.heading_path,
                        "line_start": sec.line_start,
                        "line_end": sec.line_end,
                        "original_content": c.original_content,
                        "corrected_content": c.corrected_content,
                        "changes_made": c.changes_made
                    })
            
            with open(output_file, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2)
            logger.info(f"Saved corrections to local backup file: {output_file}", phase="github")
        except Exception as e:
            logger.error("Failed to save corrections locally", phase="github", exception=e)

    def add_review_flag_comment(self, pr_number: int, flagged_verdicts: List[Tuple[StalenessVerdict, DocSection]]) -> None:
        """Add comment to source PR flagging sections that require manual review."""
        if not flagged_verdicts:
            return

        body_lines = [
            "### ⚠️ Documentation Staleness Alert\n",
            "The following documentation sections appear to be outdated or inconsistent with recent code changes, but were not auto-fixed due to high complexity or low confidence:\n"
        ]

        for verdict, sec in flagged_verdicts:
            file_link = f"[{sec.file_path}#L{sec.line_start}-L{sec.line_end}]({sec.file_path}#L{sec.line_start}-L{sec.line_end})"
            body_lines.append(f"#### 📄 `{sec.heading_path}` ({file_link})")
            body_lines.append(f"- **Staleness Diagnosis**: {verdict.diagnosis}")
            if verdict.affected_parts:
                body_lines.append("- **Potentially Affected Parts**:")
                for part in verdict.affected_parts:
                    body_lines.append(f"  > {part}")
            body_lines.append("")

        body = "\n".join(body_lines)

        try:
            repo = self._get_repo()
            def post_comment():
                issue = repo.get_issue(pr_number)
                issue.create_comment(body)
            self._call_api_with_backoff(post_comment)
            logger.info(f"Posted review flag comment on PR #{pr_number}", phase="github")
        except GithubException as ge:
            logger.error(f"GitHub API error when posting review comments: {str(ge)}", phase="github", exception=ge)
            # Log manual instructions
            logger.warning(
                "Unable to post PR comment automatically. Manual Review needed for:\n" +
                "\n".join([f"- {s.heading_path} ({s.file_path}:{s.line_start}-{s.line_end})" for _, s in flagged_verdicts]),
                phase="github"
            )
        except Exception as e:
            logger.error("Failed to add review comment due to general exception", phase="github", exception=e)

    def add_pr_summary(self, pr_number: int, summary: PRSummary) -> None:
        """Add run summary comment to source PR."""
        body = self.format_summary_comment(summary)
        try:
            repo = self._get_repo()
            def post_summary():
                issue = repo.get_issue(pr_number)
                issue.create_comment(body)
            self._call_api_with_backoff(post_summary)
            logger.info(f"Posted summary comment on PR #{pr_number}", phase="github")
        except GithubException as ge:
            logger.error(f"GitHub API error when posting summary comment: {str(ge)}", phase="github", exception=ge)
        except Exception as e:
            logger.error("Failed to add summary comment", phase="github", exception=e)

    def format_summary_comment(self, summary: PRSummary) -> str:
        total_checked = len(summary.verified_sections) + len(summary.auto_fixed_sections) + len(summary.flagged_sections)
        
        lines = [
            "## 🤖 Docs Healer Workflow Summary\n",
            f"- **Checked Sections**: {total_checked}",
            f"- **Verified Up-to-Date**: {len(summary.verified_sections)}",
            f"- **Auto-Fixed**: {len(summary.auto_fixed_sections)}",
            f"- **Flagged for Review**: {len(summary.flagged_sections)}",
            f"- **Execution Time**: {summary.total_execution_time:.2f}s\n"
        ]

        if summary.auto_fix_pr_number:
            lines.append(f"💡 **Auto-Fix PR Created**: #{summary.auto_fix_pr_number}\n")
        elif summary.auto_fixed_sections:
            lines.append("💡 **Auto-Fixes Generated**: Saved to local workspace `.self-healing-docs/corrections.json` (Failed to open PR due to permissions).\n")

        if summary.verified_sections:
            lines.append("### ✅ Verified Accurate Sections")
            for sec in summary.verified_sections:
                lines.append(f"- `{sec}`")
            lines.append("")

        if summary.auto_fixed_sections:
            lines.append("### 🔧 Auto-Fixed Sections")
            for sec in summary.auto_fixed_sections:
                lines.append(f"- `{sec}`")
            lines.append("")

        if summary.flagged_sections:
            lines.append("### ⚠️ Flagged Sections (Require Review)")
            for sec in summary.flagged_sections:
                lines.append(f"- `{sec}`")
            lines.append("")

        return "\n".join(lines)

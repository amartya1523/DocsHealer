import os
import sys
import json
import time
from typing import List, Dict, Any, Optional, Tuple
from docs_healer.logger import logger
from docs_healer.config import Config
from docs_healer.code_parser import CodeParser, CodeChunk
from docs_healer.doc_parser import DocumentationParser, DocSection
from docs_healer.embedding import EmbeddingEngine
from docs_healer.index import IndexBuilder, CodeToDocsIndex, CodeDocLink
from docs_healer.diff_parser import GitDiffParser, CodeChange, ChangeType
from docs_healer.verifier import LLMStalenessVerifier, StalenessVerdict
from docs_healer.repair import DocRepairEngine, DocCorrection
from docs_healer.github_manager import GitHubIntegrationManager, PRSummary

def parse_github_event() -> Tuple[Optional[str], Optional[str], Optional[int]]:
    """Parse GITHUB_EVENT_PATH to extract base ref, head ref, and PR number."""
    event_path = os.environ.get("GITHUB_EVENT_PATH")
    if not event_path or not os.path.exists(event_path):
        # Fall back to env variables directly
        base = os.environ.get("BASE_REF") or os.environ.get("GITHUB_BASE_REF")
        head = os.environ.get("HEAD_REF") or os.environ.get("GITHUB_HEAD_REF")
        pr_num_str = os.environ.get("PR_NUMBER")
        pr_num = int(pr_num_str) if pr_num_str else None
        return base, head, pr_num

    try:
        with open(event_path, "r", encoding="utf-8") as f:
            event = json.load(f)
        
        # Check if pull_request event
        if "pull_request" in event:
            pr = event["pull_request"]
            base_ref = pr["base"]["sha"]
            head_ref = pr["head"]["sha"]
            pr_number = pr["number"]
            logger.info(f"Parsed GITHUB_EVENT_PATH. PR #{pr_number}. Base SHA: {base_ref}, Head SHA: {head_ref}", phase="parsing")
            return base_ref, head_ref, pr_number
    except Exception as e:
        logger.error("Failed to parse GitHub event file", phase="parsing", exception=e)

    return None, None, None

def main():
    start_time = time.time()
    logger.info("Starting Docs Healer system", phase="parsing")

    # 1. Initialize configuration
    config = Config()
    repo_root = os.getcwd()

    # 2. Check OpenAI API Key
    if not config.openai_api_key:
        logger.error(
            "OPENAI_API_KEY environment variable is missing. LLM operations will fail. "
            "Exiting with code 1.",
            phase="parsing"
        )
        sys.exit(1)

    # 3. Instantiate components
    code_parser = CodeParser(repo_root)
    doc_parser = DocumentationParser(repo_root)
    embedding_engine = EmbeddingEngine(config.openai_api_key, model=config.llm_model, cache_dir=os.path.join(repo_root, ".self-healing-docs"))
    index_builder = IndexBuilder(repo_root, config, code_parser, doc_parser, embedding_engine)
    diff_parser = GitDiffParser(repo_root, config, code_parser)
    verifier = LLMStalenessVerifier(config.openai_api_key, config)
    repair_engine = DocRepairEngine(config.openai_api_key, config)
    github_manager = GitHubIntegrationManager(config.github_token, config, repo_root)

    # Determine PR context
    base_ref, head_ref, pr_number = parse_github_event()

    # Always load or build index
    # (Index loading will check codebase modifications and rebuild if files changed)
    index = index_builder.load_or_build()

    if not base_ref or not head_ref or not pr_number:
        logger.info(
            "No pull request context detected (missing base_ref/head_ref/pr_number). "
            "Docs Healer has updated the cache index. Exiting.",
            phase="indexing"
        )
        elapsed = time.time() - start_time
        logger.info(f"Execution complete in {elapsed:.2f}s", phase="indexing", extra={"total_execution_time": elapsed})
        sys.exit(0)

    # --- Pull Request Workflow ---
    logger.info(f"Starting Pull Request verification workflow for PR #{pr_number}", phase="parsing")

    # 1. Git Diff Analysis
    changes = diff_parser.parse_pr_diff(base_ref, head_ref)
    meaningful_changes = [c for c in changes if c.is_meaningful]

    if not meaningful_changes:
        logger.info("No meaningful code changes detected in this PR. Skipping documentation checks.", phase="parsing")
        # Post a summary saying nothing needed checking
        summary = PRSummary(
            verified_sections=[],
            auto_fixed_sections=[],
            flagged_sections=[],
            auto_fix_pr_number=None,
            total_execution_time=time.time() - start_time,
            metadata={"reason": "No meaningful code changes"}
        )
        github_manager.add_pr_summary(pr_number, summary)
        sys.exit(0)

    # 2. Map file modifications to affected code chunks
    affected_chunk_ids = []
    for change in meaningful_changes:
        affected_chunk_ids.extend(change.affected_chunk_ids)

    # Deduplicate affected chunks
    affected_chunk_ids = sorted(list(set(affected_chunk_ids)))
    logger.info(f"Mapped code changes to {len(affected_chunk_ids)} affected code chunks.", phase="parsing")

    # 3. Find affected doc sections via index
    affected_sections = index_builder.query_affected_sections(index, affected_chunk_ids)
    
    if not affected_sections:
        logger.info("No documentation sections are linked to the changed code chunks. Skipping LLM verification.", phase="parsing")
        summary = PRSummary(
            verified_sections=[],
            auto_fixed_sections=[],
            flagged_sections=[],
            auto_fix_pr_number=None,
            total_execution_time=time.time() - start_time,
            metadata={"reason": "No linked documentation sections"}
        )
        github_manager.add_pr_summary(pr_number, summary)
        sys.exit(0)

    # Group changed chunks by documentation section
    # Map from doc_section_id -> list of CodeChanges
    section_changes: Dict[str, List[CodeChange]] = {}
    
    # We also need a mapping from code_chunk_id -> CodeChange
    chunk_changes: Dict[str, CodeChange] = {}
    for change in meaningful_changes:
        for chunk_id in change.affected_chunk_ids:
            chunk_changes[chunk_id] = change

    # Find which links connect the affected sections to the changed chunks
    for link in index.links:
        if link.doc_section_id in [s.id for s in affected_sections] and link.code_chunk_id in affected_chunk_ids:
            if link.doc_section_id not in section_changes:
                section_changes[link.doc_section_id] = []
            if link.code_chunk_id in chunk_changes:
                section_changes[link.doc_section_id].append(chunk_changes[link.code_chunk_id])

    # 4. LLM Staleness Verification
    logger.info(f"Running LLM staleness checks on {len(affected_sections)} doc sections...", phase="verification")
    
    verified_accurate: List[str] = []
    flagged_verdicts: List[Tuple[StalenessVerdict, DocSection]] = []
    auto_fixes: List[DocCorrection] = []

    for sec in affected_sections:
        changes_for_sec = section_changes.get(sec.id, [])
        if not changes_for_sec:
            # Should not happen as we only query linked sections, but double check
            verified_accurate.append(sec.heading_path)
            continue

        # Concatenate old and new versions of all affected chunks linked to this section
        old_codes = []
        new_codes = []
        for change in changes_for_sec:
            # We can extract the actual code chunk text. Let's find it in the change old/new contents
            # Or if it's new/removed
            if change.change_type == ChangeType.NEW_FEATURE:
                new_codes.append(f"# New Chunk from {change.file_path}:\n{change.new_content}")
            elif change.change_type == ChangeType.REMOVED_FEATURE:
                old_codes.append(f"# Removed Chunk from {change.file_path}:\n{change.old_content}")
            else:
                # Modified: extract the specific chunk contents if we parsed them
                # As a fallback, use the full file contents
                old_codes.append(f"# Code state at Base in {change.file_path}:\n{change.old_content}")
                new_codes.append(f"# Code state at Head in {change.file_path}:\n{change.new_content}")

        old_code_str = "\n\n".join(old_codes)
        new_code_str = "\n\n".join(new_codes)

        # Verify staleness
        try:
            verdict = verifier.verify_section(sec, old_code_str, new_code_str)
            
            if not verdict.is_stale:
                verified_accurate.append(sec.heading_path)
                logger.info(f"Doc section verified as accurate: {sec.id}", phase="verification")
            else:
                logger.info(f"Doc section identified as stale: {sec.id}", phase="verification")
                
                # 5. Generate corrections
                correction = repair_engine.generate_correction(verdict, sec, new_code_str)
                
                if correction.should_auto_fix:
                    auto_fixes.append(correction)
                else:
                    flagged_verdicts.append((verdict, sec))
                    
        except Exception as ve:
            logger.error(f"Error during verification/repair for {sec.id}. Marking as flagged.", phase="verification", exception=ve)
            # Add error verdict to flagged
            fallback_verdict = StalenessVerdict(
                doc_section_id=sec.id,
                is_stale=True,
                confidence=0.0,
                diagnosis=f"Staleness check error: {str(ve)}",
                affected_parts=[],
                recommendation="flag_for_review",
                metadata={"error": str(ve)}
            )
            flagged_verdicts.append((fallback_verdict, sec))

    # 6. Apply Auto-fixes
    auto_fix_pr_number = None
    if auto_fixes:
        logger.info(f"Generating auto-fix PR for {len(auto_fixes)} sections...", phase="github")
        # Find base branch name
        # In GitHub Actions, the event payload typically contains the base branch name (e.g. pr["base"]["ref"])
        # Fall back to "main" or default branch
        base_branch = "main"
        event_path = os.environ.get("GITHUB_EVENT_PATH")
        if event_path and os.path.exists(event_path):
            try:
                with open(event_path, "r", encoding="utf-8") as f:
                    event = json.load(f)
                if "pull_request" in event:
                    base_branch = event["pull_request"]["base"]["ref"]
            except Exception:
                pass

        auto_fix_pr_number = github_manager.create_fix_pr(auto_fixes, index, base_branch, pr_number)

    # 7. Post flagged reviews comments
    if flagged_verdicts:
        logger.info(f"Posting {len(flagged_verdicts)} manual review flags to the source PR...", phase="github")
        github_manager.add_review_flag_comment(pr_number, flagged_verdicts)

    # 8. Post run summary comment
    total_time = time.time() - start_time
    summary = PRSummary(
        verified_sections=verified_accurate,
        auto_fixed_sections=[index.doc_sections[c.doc_section_id].heading_path for c in auto_fixes],
        flagged_sections=[s.heading_path for _, s in flagged_verdicts],
        auto_fix_pr_number=auto_fix_pr_number,
        total_execution_time=total_time,
        metadata={}
    )
    github_manager.add_pr_summary(pr_number, summary)

    logger.info(
        f"Docs Healer workflow complete in {total_time:.2f}s.",
        phase="github",
        extra={
            "stale_sections_count": len(auto_fixes) + len(flagged_verdicts),
            "auto_fixed_count": len(auto_fixes),
            "flagged_count": len(flagged_verdicts),
            "total_execution_time": total_time
        }
    )

if __name__ == "__main__":
    main()

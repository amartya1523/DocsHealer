import os
import json
import time
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass, asdict
from openai import OpenAI
from docs_healer.logger import logger
from docs_healer.config import Config
from docs_healer.doc_parser import DocSection

@dataclass
class StalenessVerdict:
    doc_section_id: str
    is_stale: bool
    confidence: float
    diagnosis: str
    affected_parts: List[str]
    recommendation: str  # "auto_fix" | "flag_for_review"
    metadata: Dict[str, Any]

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

class LLMStalenessVerifier:
    def __init__(self, api_key: str, config: Config):
        self.client = OpenAI(api_key=api_key) if api_key else None
        self.config = config

    def _call_llm_with_backoff(self, messages: List[Dict[str, str]], response_format: Dict[str, str]) -> str:
        """Call OpenAI chat completion API with exponential backoff on rate limits."""
        if not self.client:
            raise ValueError("OpenAI client not initialized. OPENAI_API_KEY environment variable is missing.")

        retries = 5
        backoff_factor = 2

        for attempt in range(retries):
            try:
                logger.track_api_call()
                response = self.client.chat.completions.create(
                    model=self.config.llm_model,
                    messages=messages,
                    response_format=response_format,
                    temperature=0.2
                )
                return response.choices[0].message.content or ""
            except Exception as e:
                err_msg = str(e).lower()
                is_rate_limit = "rate_limit" in err_msg or "429" in err_msg
                
                if is_rate_limit:
                    logger.track_rate_limit()
                    sleep_time = backoff_factor ** attempt
                    logger.warning(
                        f"Rate limit during LLM verification API call. Retrying in {sleep_time}s (Attempt {attempt+1}/{retries})...",
                        phase="verification",
                        extra={"error": str(e)}
                    )
                    time.sleep(sleep_time)
                else:
                    logger.error(
                        f"Fatal API error during LLM verification call on attempt {attempt+1}/{retries}",
                        phase="verification",
                        exception=e
                    )
                    if attempt == retries - 1:
                        raise e
                    time.sleep(1)

        raise Exception("LLM call failed after multiple retries.")

    def verify_section(self, doc_section: DocSection, old_code: str, new_code: str) -> StalenessVerdict:
        """Verify if the documentation section is stale compared to code changes using LLM."""
        logger.info(f"Verifying staleness for section: {doc_section.id}", phase="verification")

        system_prompt = (
            "You are a technical documentation verification assistant. Your job is to analyze code changes and "
            "determine if the corresponding documentation section has become stale, outdated, or inaccurate.\n\n"
            "You will be provided with:\n"
            "1. The heading path and content of a documentation section.\n"
            "2. The old version of the modified code chunk (if any).\n"
            "3. The new version of the modified code chunk.\n\n"
            "You must output a JSON object containing:\n"
            "- \"is_stale\": boolean indicating if the documentation is now inaccurate, outdated, or missing critical modifications.\n"
            "- \"confidence\": float between 0.0 and 1.0 indicating your certainty.\n"
            "- \"diagnosis\": a clear markdown description of what is incorrect or missing in the doc (empty if is_stale is false).\n"
            "- \"affected_parts\": a list of exact sentences, lines, or blocks in the documentation section that are stale.\n"
            "- \"change_complexity\": string, either \"simple\" (e.g. parameter rename, type change, single configuration value edit) "
            "or \"complex\" (e.g. structural rewrites, core logic design changes, new feature behavior)."
        )

        user_content = (
            f"=== DOCUMENTATION SECTION ===\n"
            f"Heading: {doc_section.heading_path}\n"
            f"Content:\n{doc_section.content}\n\n"
            f"=== OLD CODE CHUNK ===\n"
            f"{old_code or '(None)'}\n\n"
            f"=== NEW CODE CHUNK ===\n"
            f"{new_code}\n"
        )

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_content}
        ]

        try:
            content_str = self._call_llm_with_backoff(messages, {"type": "json_object"})
            data = json.loads(content_str)
            
            is_stale = bool(data.get("is_stale", False))
            confidence = float(data.get("confidence", 0.0))
            diagnosis = str(data.get("diagnosis", ""))
            affected_parts = list(data.get("affected_parts", []))
            complexity = str(data.get("change_complexity", "complex"))

            # Decide on recommendation
            # High confidence and simple change -> auto_fix
            # Low confidence or complex change -> flag_for_review
            recommendation = "flag_for_review"
            if is_stale:
                if confidence >= self.config.auto_fix_confidence_threshold and complexity == "simple":
                    recommendation = "auto_fix"

            return StalenessVerdict(
                doc_section_id=doc_section.id,
                is_stale=is_stale,
                confidence=confidence,
                diagnosis=diagnosis,
                affected_parts=affected_parts,
                recommendation=recommendation,
                metadata={"change_complexity": complexity}
            )

        except Exception as e:
            logger.error(f"LLM verification failed for {doc_section.id}", phase="verification", exception=e)
            # Safe fallback: mark as stale requiring manual review, with low confidence
            return StalenessVerdict(
                doc_section_id=doc_section.id,
                is_stale=True,
                confidence=0.0,
                diagnosis=f"Staleness check failed due to LLM error: {str(e)}",
                affected_parts=[],
                recommendation="flag_for_review",
                metadata={"error": str(e)}
            )

import os
import json
import time
from typing import List, Dict, Any, Optional
from dataclasses import dataclass, asdict
from openai import OpenAI
from docs_healer.logger import logger
from docs_healer.config import Config
from docs_healer.doc_parser import DocSection
from docs_healer.verifier import StalenessVerdict

@dataclass
class DocCorrection:
    doc_section_id: str
    original_content: str
    corrected_content: str
    changes_made: List[str]
    confidence: float
    should_auto_fix: bool
    validation_passed: bool
    metadata: Dict[str, Any]

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

class DocRepairEngine:
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
                    temperature=0.3
                )
                return response.choices[0].message.content or ""
            except Exception as e:
                err_msg = str(e).lower()
                is_rate_limit = "rate_limit" in err_msg or "429" in err_msg
                
                if is_rate_limit:
                    logger.track_rate_limit()
                    sleep_time = backoff_factor ** attempt
                    logger.warning(
                        f"Rate limit during LLM repair API call. Retrying in {sleep_time}s (Attempt {attempt+1}/{retries})...",
                        phase="correction",
                        extra={"error": str(e)}
                    )
                    time.sleep(sleep_time)
                else:
                    logger.error(
                        f"Fatal API error during LLM repair call on attempt {attempt+1}/{retries}",
                        phase="correction",
                        exception=e
                    )
                    if attempt == retries - 1:
                        raise e
                    time.sleep(1)

        raise Exception("LLM call failed after multiple retries.")

    def generate_correction(self, verdict: StalenessVerdict, doc_section: DocSection, new_code: str) -> DocCorrection:
        """Generate targeted documentation correction using LLM and run validation."""
        logger.info(f"Generating correction for section: {doc_section.id}", phase="correction")

        system_prompt = (
            "You are an expert technical editor. Your job is to correct stale or outdated technical documentation based on code updates.\n\n"
            "Guidelines:\n"
            "1. ONLY modify the parts of the documentation that are incorrect, outdated, or incomplete based on the new code and diagnosis.\n"
            "2. Preserve all accurate content, headers, structure, formatting, and markdown features.\n"
            "3. Maintain the original writing style, tone, and level of detail.\n"
            "4. Do NOT add preamble or meta-text like 'Here is the updated doc'. Output ONLY the clean updated section content.\n\n"
            "You must return a JSON object with keys:\n"
            "- \"corrected_content\": string representing the complete updated markdown content for the section.\n"
            "- \"changes_made\": a list of strings describing the exact corrections applied (e.g. ['Updated parameters list', 'Changed return type']).\n"
            "- \"confidence\": float between 0.0 and 1.0 indicating your certainty in the correction."
        )

        user_content = (
            f"=== ORIGINAL DOCUMENTATION SECTION ===\n"
            f"Heading: {doc_section.heading_path}\n"
            f"Content:\n{doc_section.content}\n\n"
            f"=== STALENESS DIAGNOSIS ===\n"
            f"{verdict.diagnosis}\n\n"
            f"=== NEW CODE ===\n"
            f"{new_code}\n"
        )

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_content}
        ]

        try:
            content_str = self._call_llm_with_backoff(messages, {"type": "json_object"})
            data = json.loads(content_str)

            corrected_content = str(data.get("corrected_content", doc_section.content))
            changes_made = list(data.get("changes_made", []))
            confidence = float(data.get("confidence", 0.0))

            # Create base correction object
            correction = DocCorrection(
                doc_section_id=doc_section.id,
                original_content=doc_section.content,
                corrected_content=corrected_content,
                changes_made=changes_made,
                confidence=confidence,
                should_auto_fix=False,
                validation_passed=False,
                metadata={}
            )

            # Perform validation pass
            validation_passed, val_meta = self.validate_correction(correction, new_code)
            correction.validation_passed = validation_passed
            correction.metadata.update(val_meta)

            # Determine eligibility for auto-fixing
            # Eligibility criteria:
            # - Verdict recommended auto_fix (meaning: high confidence + simple change)
            # - Correction confidence >= auto_fix_confidence_threshold
            # - Validation passed
            is_eligible = (
                verdict.recommendation == "auto_fix" and
                confidence >= self.config.auto_fix_confidence_threshold and
                validation_passed
            )
            correction.should_auto_fix = is_eligible

            logger.info(
                f"Correction generation finished for {doc_section.id}. "
                f"Validation: {'passed' if validation_passed else 'failed'}. "
                f"Auto-fix eligible: {is_eligible}.",
                phase="correction"
            )
            return correction

        except Exception as e:
            logger.error(f"Correction generation failed for {doc_section.id}", phase="correction", exception=e)
            return DocCorrection(
                doc_section_id=doc_section.id,
                original_content=doc_section.content,
                corrected_content=doc_section.content,
                changes_made=[],
                confidence=0.0,
                should_auto_fix=False,
                validation_passed=False,
                metadata={"error": str(e)}
            )

    def validate_correction(self, correction: DocCorrection, new_code: str) -> Tuple[bool, Dict[str, Any]]:
        """Run a validation pass on the proposed correction against new code using LLM."""
        logger.info(f"Validating correction for section: {correction.doc_section_id}", phase="correction")

        system_prompt = (
            "You are a technical documentation quality inspector. Your task is to validate whether a proposed documentation update is correct.\n\n"
            "You will evaluate three criteria:\n"
            "1. \"accuracy\": Does the corrected text accurately reflect the new code without introducing new mismatches? (0.0 to 1.0)\n"
            "2. \"style\": Does the correction maintain style consistency and keep intact parts of the document that were correct? (0.0 to 1.0)\n"
            "3. \"completeness\": Does the correction resolve all issues identified in the diagnosis? (0.0 to 1.0)\n\n"
            "You must return a JSON object with keys:\n"
            "- \"accuracy_score\": float (0.0 to 1.0)\n"
            "- \"style_score\": float (0.0 to 1.0)\n"
            "- \"completeness_score\": float (0.0 to 1.0)\n"
            "- \"reasoning\": brief explanation of the scores."
        )

        user_content = (
            f"=== PROPOSED CORRECTION ===\n"
            f"Original:\n{correction.original_content}\n\n"
            f"Corrected:\n{correction.corrected_content}\n\n"
            f"=== NEW CODE ===\n"
            f"{new_code}\n"
        )

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_content}
        ]

        try:
            content_str = self._call_llm_with_backoff(messages, {"type": "json_object"})
            data = json.loads(content_str)

            accuracy = float(data.get("accuracy_score", 0.0))
            style = float(data.get("style_score", 0.0))
            completeness = float(data.get("completeness_score", 0.0))
            reasoning = str(data.get("reasoning", ""))

            # Validation passes if all scores are above 0.7
            passed = (accuracy > 0.7 and style > 0.7 and completeness > 0.7)
            
            val_meta = {
                "validation_accuracy": accuracy,
                "validation_style": style,
                "validation_completeness": completeness,
                "validation_reasoning": reasoning
            }

            return passed, val_meta

        except Exception as e:
            logger.error(f"Validation pass failed for {correction.doc_section_id}", phase="correction", exception=e)
            return False, {"error": str(e)}

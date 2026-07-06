import os
import re
from typing import List, Dict, Optional, Any
from dataclasses import dataclass, asdict
from docs_healer.logger import logger

@dataclass
class DocSection:
    id: str  # Format: file_path::heading_path
    file_path: str
    heading_path: str  # e.g. "Setup > Installation"
    heading_level: int
    content: str
    code_references: List[str]
    line_start: int
    line_end: int
    metadata: Dict[str, Any]

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

class DocumentationParser:
    def __init__(self, repo_root: str):
        self.repo_root = os.path.abspath(repo_root)

    def parse_docs_directory(self, docs_path: str) -> List[DocSection]:
        """Parse all markdown files in the documentation directory."""
        sections = []
        abs_docs_path = os.path.abspath(os.path.join(self.repo_root, docs_path))
        if not os.path.exists(abs_docs_path):
            logger.warning(f"Docs directory does not exist: {docs_path}", phase="parsing")
            return []

        for root, _, files in os.walk(abs_docs_path):
            for file in files:
                if file.endswith(".md"):
                    full_path = os.path.join(root, file)
                    rel_path = os.path.relpath(full_path, self.repo_root)
                    try:
                        logger.info(f"Parsing documentation file: {rel_path}", phase="parsing")
                        sections.extend(self.parse_markdown_file(full_path, rel_path))
                    except Exception as e:
                        logger.warning(f"Error parsing markdown {rel_path}: {str(e)}", phase="parsing")
        return sections

    def parse_markdown_file(self, abs_path: str, rel_path: str) -> List[DocSection]:
        """Parse a single markdown file into hierarchical DocSections."""
        try:
            with open(abs_path, "r", encoding="utf-8") as f:
                lines = f.readlines()
        except Exception as e:
            logger.warning(f"Failed to read markdown file {rel_path}: {str(e)}", phase="parsing")
            return []

        sections_raw = []
        active_headings: List[str] = []
        current_heading_level = 0

        # Regex for markdown headings: e.g. "## Heading Text"
        heading_re = re.compile(r"^(#{1,6})\s+(.+)$")

        for idx, line in enumerate(lines):
            line_num = idx + 1
            match = heading_re.match(line.strip())
            if match:
                level_str, heading_text = match.groups()
                level = len(level_str)
                heading_text = heading_text.strip()
                
                # Trim active headings stack to match current level
                if level <= len(active_headings):
                    active_headings = active_headings[:level - 1]
                
                # Push current heading
                active_headings.append(heading_text)
                heading_path = " > ".join(active_headings)
                
                sections_raw.append({
                    "heading_path": heading_path,
                    "heading_level": level,
                    "line_start": line_num,
                    "content_lines": [line],  # Include the heading line itself in the content
                })
            else:
                if sections_raw:
                    sections_raw[-1]["content_lines"].append(line)

        # Build final DocSections
        doc_sections: List[DocSection] = []
        for idx, sec in enumerate(sections_raw):
            start = sec["line_start"]
            content = "".join(sec["content_lines"])
            end = start + len(sec["content_lines"]) - 1
            
            h_path = sec["heading_path"]
            doc_sections.append(DocSection(
                id=f"{rel_path}::{h_path}",
                file_path=rel_path,
                heading_path=h_path,
                heading_level=sec["heading_level"],
                content=content,
                code_references=[],  # Populated later via IndexBuilder / extract_code_references
                line_start=start,
                line_end=end,
                metadata={
                    "parent_id": None,
                    "child_ids": []
                }
            ))

        # Build parent-child relationships
        for i, sec in enumerate(doc_sections):
            # A section is a child of the closest preceding section with a lower heading_level
            for j in range(i - 1, -1, -1):
                parent_candidate = doc_sections[j]
                if parent_candidate.heading_level < sec.heading_level:
                    sec.metadata["parent_id"] = parent_candidate.id
                    parent_candidate.metadata["child_ids"].append(sec.id)
                    break

        return doc_sections

    def extract_code_references(self, content: str, known_symbols: List[str]) -> List[str]:
        """Extract inline and code-block references to code symbols."""
        if not known_symbols:
            return []

        candidates = set()
        
        # 1. Inline code: `symbol`
        inline_matches = re.findall(r"`([^`\n]+)`", content)
        for match in inline_matches:
            # Clean up symbol (e.g. functions, packages, parameters, ignore whitespace)
            symbol = match.strip()
            # If it's a dotted/qualified name, we can also extract its last part
            candidates.add(symbol)
            if "." in symbol:
                candidates.add(symbol.split(".")[-1])

        # 2. Code blocks: ```lang ... ```
        code_blocks = re.findall(r"```[a-zA-Z0-9_-]*\n(.*?)\n```", content, re.DOTALL)
        # Extract potential identifiers from code blocks
        identifier_re = re.compile(r"\b([a-zA-Z_][a-zA-Z0-9_\.]*)\b")
        for block in code_blocks:
            for ident in identifier_re.findall(block):
                candidates.add(ident)
                if "." in ident:
                    candidates.add(ident.split(".")[-1])

        # Also search the regular text for known symbols, but let's be selective to avoid false positives.
        # Acceptance criteria:
        # "WHEN the system encounters inline code references, THE Doc_Parser SHALL extract the symbol names"
        # "WHEN the system encounters code blocks, THE Doc_Parser SHALL extract mentioned function and class names"
        # "WHEN extracting code references, THE Doc_Parser SHALL match mentioned symbols against known code chunk names"
        
        # Let's filter candidates to only those that match known symbols
        matched_symbols = []
        known_symbols_set = set(known_symbols)
        
        # Also map known symbols' simple names (unqualified names)
        symbol_to_qualified = {}
        for sym in known_symbols:
            symbol_to_qualified[sym] = sym
            if "::" in sym:
                simple = sym.split("::")[-1]
                symbol_to_qualified[simple] = sym
                if "." in simple:
                    symbol_to_qualified[simple.split(".")[-1]] = sym
            elif "." in sym:
                symbol_to_qualified[sym.split(".")[-1]] = sym

        for cand in candidates:
            # If candidate matches a qualified name or a known simple/qualified symbol
            if cand in known_symbols_set:
                matched_symbols.append(cand)
            elif cand in symbol_to_qualified:
                matched_symbols.append(symbol_to_qualified[cand])

        return sorted(list(set(matched_symbols)))

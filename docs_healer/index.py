import os
import json
import time
from typing import List, Dict, Any, Optional, Set, Tuple
from dataclasses import dataclass, asdict
from docs_healer.logger import logger
from docs_healer.config import Config
from docs_healer.code_parser import CodeChunk, CodeParser
from docs_healer.doc_parser import DocSection, DocumentationParser
from docs_healer.embedding import EmbeddingEngine

@dataclass
class CodeDocLink:
    code_chunk_id: str
    doc_section_id: str
    link_type: str  # "explicit_mention" | "semantic_similarity"
    confidence: float
    metadata: Dict[str, Any]

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

class CodeToDocsIndex:
    def __init__(self, code_chunks: Dict[str, CodeChunk], doc_sections: Dict[str, DocSection], links: List[CodeDocLink], version: str = "1.0.0", last_updated: Optional[str] = None):
        self.code_chunks = code_chunks
        self.doc_sections = doc_sections
        self.links = links
        self.version = version
        self.last_updated = last_updated or time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())

class IndexBuilder:
    def __init__(self, repo_root: str, config: Config, code_parser: CodeParser, doc_parser: DocumentationParser, embedding_engine: EmbeddingEngine):
        self.repo_root = os.path.abspath(repo_root)
        self.config = config
        self.code_parser = code_parser
        self.doc_parser = doc_parser
        self.embedding_engine = embedding_engine
        self.index_dir = os.path.join(self.repo_root, ".self-healing-docs")
        self.index_file = os.path.join(self.index_dir, "index.json")

    def get_codebase_signature(self, files_list: List[str]) -> Dict[str, float]:
        """Compute modification times of all files in index for change detection."""
        sig = {}
        for rel_path in files_list:
            abs_path = os.path.abspath(os.path.join(self.repo_root, rel_path))
            if os.path.exists(abs_path):
                sig[rel_path] = os.path.getmtime(abs_path)
        return sig

    def discover_files(self) -> Tuple[List[str], List[str]]:
        """Find all code files and markdown files in the repository."""
        code_files = []
        doc_files = []

        # Find code files in repo
        for root, _, files in os.walk(self.repo_root):
            # Skip hidden directories like .git, .self-healing-docs, node_modules, etc.
            if any((part.startswith(".") and part not in [".", ".."]) or part == "node_modules" for part in os.path.relpath(root, self.repo_root).split(os.sep)):
                continue

            for file in files:
                rel_file = os.path.relpath(os.path.join(root, file), self.repo_root)
                if self.config.is_file_included(rel_file):
                    code_files.append(rel_file)

        # Find markdown files in docs_path
        abs_docs_path = os.path.abspath(os.path.join(self.repo_root, self.config.docs_path))
        if os.path.exists(abs_docs_path):
            for root, _, files in os.walk(abs_docs_path):
                for file in files:
                    if file.endswith(".md"):
                        rel_file = os.path.relpath(os.path.join(root, file), self.repo_root)
                        doc_files.append(rel_file)

        return sorted(code_files), sorted(doc_files)

    def build_index(self) -> CodeToDocsIndex:
        """Build the index from scratch by parsing codebase and docs, and computing links."""
        start_time = time.time()
        logger.info("Building code-to-docs index...", phase="indexing")

        code_files, doc_files = self.discover_files()
        
        # 1. Parse code chunks
        chunks = self.code_parser.parse_repository(code_files)
        # Ensure unique IDs
        code_chunks_dict = {}
        for chunk in chunks:
            if chunk.id in code_chunks_dict:
                logger.warning(f"Duplicate code chunk ID detected: {chunk.id}. Overwriting.", phase="indexing")
            code_chunks_dict[chunk.id] = chunk

        # 2. Parse doc sections
        sections = self.doc_parser.parse_docs_directory(self.config.docs_path)
        # Ensure unique IDs
        doc_sections_dict = {}
        for sec in sections:
            if sec.id in doc_sections_dict:
                logger.warning(f"Duplicate doc section ID detected: {sec.id}. Overwriting.", phase="indexing")
            doc_sections_dict[sec.id] = sec

        # 3. Resolve explicit references in doc sections
        known_symbols = list(code_chunks_dict.keys())
        for sec in sections:
            sec.code_references = self.doc_parser.extract_code_references(sec.content, known_symbols)

        # 4. Build links
        links = []
        linked_pairs: Set[Tuple[str, str]] = set()

        # Explicit links
        for sec in sections:
            for symbol_id in sec.code_references:
                if symbol_id in code_chunks_dict:
                    link = CodeDocLink(
                        code_chunk_id=symbol_id,
                        doc_section_id=sec.id,
                        link_type="explicit_mention",
                        confidence=0.95,
                        metadata={}
                    )
                    links.append(link)
                    linked_pairs.add((symbol_id, sec.id))

        # Semantic links
        if chunks and sections:
            logger.info("Generating semantic embeddings...", phase="indexing")
            
            # Prepare texts to embed
            chunk_texts = [f"Signature: {c.signature}\nDocstring: {c.docstring or ''}" for c in chunks]
            sec_texts = [f"Heading: {s.heading_path}\nContent: {s.content}" for s in sections]

            try:
                chunk_embeddings = self.embedding_engine.get_embeddings_batch(chunk_texts)
                sec_embeddings = self.embedding_engine.get_embeddings_batch(sec_texts)

                logger.info(f"Computing semantic similarity (threshold: {self.config.similarity_threshold})...", phase="indexing")
                for c_idx, chunk in enumerate(chunks):
                    c_emb = chunk_embeddings[c_idx]
                    if c_emb is None:
                        continue
                    for s_idx, sec in enumerate(sections):
                        # Skip if there's already an explicit link
                        if (chunk.id, sec.id) in linked_pairs:
                            continue

                        s_emb = sec_embeddings[s_idx]
                        if s_emb is None:
                            continue

                        sim = self.embedding_engine.compute_similarity(c_emb, s_emb)
                        if sim >= self.config.similarity_threshold:
                            link = CodeDocLink(
                                code_chunk_id=chunk.id,
                                doc_section_id=sec.id,
                                link_type="semantic_similarity",
                                confidence=sim,
                                metadata={}
                            )
                            links.append(link)
                            linked_pairs.add((chunk.id, sec.id))
            except Exception as e:
                logger.error("Failed to generate semantic links due to embedding API error. Proceeding with explicit links only.", phase="indexing", exception=e)

        index = CodeToDocsIndex(
            code_chunks=code_chunks_dict,
            doc_sections=doc_sections_dict,
            links=links,
            last_updated=time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        )

        elapsed = time.time() - start_time
        logger.info(
            f"Index built successfully in {elapsed:.2f}s.",
            phase="indexing",
            extra={
                "code_chunks_count": len(code_chunks_dict),
                "doc_sections_count": len(doc_sections_dict),
                "links_count": len(links),
                "elapsed_seconds": elapsed
            }
        )

        # Save signature metadata for checking changes later
        self.save_index(index)
        return index

    def save_index(self, index: CodeToDocsIndex) -> None:
        """Serialize index to JSON and save to .self-healing-docs/index.json."""
        try:
            os.makedirs(self.index_dir, exist_ok=True)
            
            code_files, doc_files = self.discover_files()
            files_signature = self.get_codebase_signature(code_files + doc_files)

            data = {
                "version": index.version,
                "last_updated": index.last_updated,
                "files_signature": files_signature,
                "code_chunks": {k: v.to_dict() for k, v in index.code_chunks.items()},
                "doc_sections": {k: v.to_dict() for k, v in index.doc_sections.items()},
                "links": [l.to_dict() for l in index.links]
            }

            with open(self.index_file, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2)
            logger.info("Serialized index saved successfully.", phase="indexing")
        except Exception as e:
            logger.error("Failed to serialize and save index", phase="indexing", exception=e)

    def load_index(self) -> Optional[CodeToDocsIndex]:
        """Load index from JSON file, validating it. Returns None if invalid or needs rebuild."""
        if not os.path.exists(self.index_file):
            logger.info("No index cache file found. A new index will be built.", phase="indexing")
            return None

        try:
            with open(self.index_file, "r", encoding="utf-8") as f:
                data = json.load(f)
        except Exception as e:
            logger.warning(f"Index cache is corrupted: {str(e)}. Rebuilding.", phase="indexing")
            return None

        # Verify version and last_updated
        if "version" not in data or "code_chunks" not in data or "doc_sections" not in data or "links" not in data:
            logger.warning("Index cache schema mismatch. Rebuilding.", phase="indexing")
            return None

        # Perform deserialization & validation
        validation_errors = []
        code_chunks = {}
        doc_sections = {}
        links = []

        # Validate format: file_path::qualified_name or heading_path
        for k, v in data["code_chunks"].items():
            if "::" not in k:
                validation_errors.append(f"Invalid code chunk ID format: {k}")
            try:
                code_chunks[k] = CodeChunk(**v)
            except Exception as e:
                validation_errors.append(f"Failed to deserialize CodeChunk {k}: {str(e)}")

        for k, v in data["doc_sections"].items():
            if "::" not in k:
                validation_errors.append(f"Invalid doc section ID format: {k}")
            try:
                doc_sections[k] = DocSection(**v)
            except Exception as e:
                validation_errors.append(f"Failed to deserialize DocSection {k}: {str(e)}")

        for l_data in data["links"]:
            try:
                link = CodeDocLink(**l_data)
                # Validate resolvable references
                if link.code_chunk_id not in code_chunks:
                    validation_errors.append(f"Link references non-existent code chunk: {link.code_chunk_id}")
                if link.doc_section_id not in doc_sections:
                    validation_errors.append(f"Link references non-existent doc section: {link.doc_section_id}")
                links.append(link)
            except Exception as e:
                validation_errors.append(f"Failed to deserialize link: {str(e)}")

        if validation_errors:
            logger.warning(
                "Index validation failed during loading. Rebuilding index.",
                phase="indexing",
                extra={"validation_errors": validation_errors[:10]}
            )
            return None

        # Check if codebase has changed
        code_files, doc_files = self.discover_files()
        current_sig = self.get_codebase_signature(code_files + doc_files)
        cached_sig = data.get("files_signature", {})

        # Check if lengths match or keys mismatch or values differ
        if set(current_sig.keys()) != set(cached_sig.keys()):
            logger.info("Codebase files structure changed. Rebuilding index.", phase="indexing")
            return None

        for k, v in current_sig.items():
            if cached_sig.get(k) != v:
                logger.info(f"Codebase file modified: {k}. Rebuilding index.", phase="indexing")
                return None

        # Return successfully loaded index
        logger.info("Loaded valid index from cache.", phase="indexing")
        return CodeToDocsIndex(
            code_chunks=code_chunks,
            doc_sections=doc_sections,
            links=links,
            version=data["version"],
            last_updated=data.get("last_updated")
        )

    def load_or_build(self) -> CodeToDocsIndex:
        """Load index if valid and cached, otherwise build and save."""
        index = self.load_index()
        if index is None:
            index = self.build_index()
        return index

    def query_affected_sections(self, index: CodeToDocsIndex, code_chunk_ids: List[str]) -> List[DocSection]:
        """Find all unique doc sections linked to given code chunks in under 1 second."""
        start_time = time.time()
        
        # Build index maps if not present for speed
        chunk_to_sections = {}
        for link in index.links:
            if link.code_chunk_id not in chunk_to_sections:
                chunk_to_sections[link.code_chunk_id] = []
            chunk_to_sections[link.code_chunk_id].append(link.doc_section_id)

        affected_section_ids = set()
        for cc_id in code_chunk_ids:
            # Match directly
            if cc_id in chunk_to_sections:
                for ds_id in chunk_to_sections[cc_id]:
                    affected_section_ids.add(ds_id)

        result = []
        for ds_id in affected_section_ids:
            if ds_id in index.doc_sections:
                result.append(index.doc_sections[ds_id])

        elapsed = time.time() - start_time
        # Log query metrics
        logger.info(
            f"Query for affected sections completed in {elapsed:.4f}s",
            phase="indexing",
            extra={"queried_chunks_count": len(code_chunk_ids), "found_sections_count": len(result), "elapsed_seconds": elapsed}
        )
        return result

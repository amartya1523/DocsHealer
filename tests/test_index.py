import os
import json
import tempfile
import unittest
from unittest.mock import MagicMock
from docs_healer.config import Config
from docs_healer.code_parser import CodeParser, CodeChunk
from docs_healer.doc_parser import DocumentationParser, DocSection
from docs_healer.embedding import EmbeddingEngine
from docs_healer.index import IndexBuilder, CodeToDocsIndex, CodeDocLink

class TestIndex(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.repo_root = self.temp_dir.name
        
        # Setup config
        self.config = Config()
        self.config.docs_path = "docs"
        self.config.openai_api_key = "mock_key"
        self.config.github_token = "mock_token"

        # Mock Parsers and Engines
        self.code_parser = CodeParser(self.repo_root)
        self.doc_parser = DocumentationParser(self.repo_root)
        
        self.mock_embedding = MagicMock(spec=EmbeddingEngine)
        # Mock embeddings batch to return simple list vectors
        self.mock_embedding.get_embeddings_batch.side_effect = lambda texts: [[0.1 * i] * 1536 for i in range(len(texts))]
        self.mock_embedding.compute_similarity.return_type = float
        # Return 0.9 for similarity so semantic links get built
        self.mock_embedding.compute_similarity.return_value = 0.9

        self.index_builder = IndexBuilder(
            repo_root=self.repo_root,
            config=self.config,
            code_parser=self.code_parser,
            doc_parser=self.doc_parser,
            embedding_engine=self.mock_embedding
        )

    def tearDown(self):
        self.temp_dir.cleanup()

    def test_explicit_and_semantic_linking(self):
        # Create a mock code file
        code_file = "utils.py"
        abs_code = os.path.join(self.repo_root, code_file)
        with open(abs_code, "w", encoding="utf-8") as f:
            f.write("def calculate_tax(amount: float):\n    pass\n")

        # Create a mock doc file referencing calculate_tax
        doc_file = "docs/api.md"
        abs_doc = os.path.join(self.repo_root, doc_file)
        os.makedirs(os.path.dirname(abs_doc), exist_ok=True)
        with open(abs_doc, "w", encoding="utf-8") as f:
            f.write("# Tax API\nDoc for `utils.py::calculate_tax`\n")

        # Build index
        index = self.index_builder.build_index()

        self.assertEqual(len(index.code_chunks), 1)
        self.assertEqual(len(index.doc_sections), 1)
        
        # Verify explicit link is built
        explicit_links = [l for l in index.links if l.link_type == "explicit_mention"]
        self.assertEqual(len(explicit_links), 1)
        self.assertEqual(explicit_links[0].code_chunk_id, "utils.py::calculate_tax")
        self.assertEqual(explicit_links[0].confidence, 0.95)

        # Check semantic links are skipped when explicit link exists
        semantic_links = [l for l in index.links if l.link_type == "semantic_similarity"]
        self.assertEqual(len(semantic_links), 0)

    def test_serialization_and_deserialization_round_trip(self):
        # Create mock data
        code_chunks = {
            "utils.py::test": CodeChunk(
                id="utils.py::test", type="function", name="test", qualified_name="test",
                file_path="utils.py", line_start=1, line_end=2, signature="def test()",
                docstring="", source_code="def test(): pass", metadata={}
            )
        }
        doc_sections = {
            "docs/api.md::Heading": DocSection(
                id="docs/api.md::Heading", file_path="docs/api.md", heading_path="Heading",
                heading_level=1, content="# Heading", code_references=["utils.py::test"],
                line_start=1, line_end=1, metadata={"parent_id": None, "child_ids": []}
            )
        }
        links = [
            CodeDocLink(
                code_chunk_id="utils.py::test", doc_section_id="docs/api.md::Heading",
                link_type="explicit_mention", confidence=0.95, metadata={}
            )
        ]
        index = CodeToDocsIndex(code_chunks, doc_sections, links)

        # Save index
        self.index_builder.save_index(index)
        self.assertTrue(os.path.exists(self.index_builder.index_file))

        # Load index
        loaded = self.index_builder.load_index()
        self.assertIsNotNone(loaded)
        
        # Verify round-trip equivalence
        self.assertEqual(loaded.version, index.version)
        self.assertEqual(list(loaded.code_chunks.keys()), list(code_chunks.keys()))
        self.assertEqual(loaded.code_chunks["utils.py::test"].signature, "def test()")
        self.assertEqual(list(loaded.doc_sections.keys()), list(doc_sections.keys()))
        self.assertEqual(loaded.links[0].code_chunk_id, "utils.py::test")
        self.assertEqual(loaded.links[0].doc_section_id, "docs/api.md::Heading")

    def test_deserialization_validation_failures(self):
        # Create an index with invalid format ID or non-resolvable link
        os.makedirs(self.index_builder.index_dir, exist_ok=True)
        corrupted_data = {
            "version": "1.0.0",
            "last_updated": "2026-07-04T12:00:00Z",
            "code_chunks": {
                "invalid_id_format": {
                    "id": "invalid_id_format", "type": "function", "name": "test", "qualified_name": "test",
                    "file_path": "utils.py", "line_start": 1, "line_end": 2, "signature": "def test()",
                    "docstring": "", "source_code": "def test(): pass", "metadata": {}
                }
            },
            "doc_sections": {},
            "links": []
        }
        with open(self.index_builder.index_file, "w", encoding="utf-8") as f:
            json.dump(corrupted_data, f)

        # Loading should fail validation and return None (triggering a rebuild)
        loaded = self.index_builder.load_index()
        self.assertIsNone(loaded)

    def test_query_affected_sections(self):
        code_chunks = {
            "utils.py::foo": CodeChunk(
                id="utils.py::foo", type="function", name="foo", qualified_name="foo",
                file_path="utils.py", line_start=1, line_end=2, signature="def foo()",
                docstring="", source_code="def foo(): pass", metadata={}
            ),
            "utils.py::bar": CodeChunk(
                id="utils.py::bar", type="function", name="bar", qualified_name="bar",
                file_path="utils.py", line_start=4, line_end=5, signature="def bar()",
                docstring="", source_code="def bar(): pass", metadata={}
            )
        }
        doc_sections = {
            "docs/api.md::FooHeading": DocSection(
                id="docs/api.md::FooHeading", file_path="docs/api.md", heading_path="FooHeading",
                heading_level=1, content="# FooHeading", code_references=[],
                line_start=1, line_end=2, metadata={"parent_id": None, "child_ids": []}
            ),
            "docs/api.md::BarHeading": DocSection(
                id="docs/api.md::BarHeading", file_path="docs/api.md", heading_path="BarHeading",
                heading_level=1, content="# BarHeading", code_references=[],
                line_start=4, line_end=5, metadata={"parent_id": None, "child_ids": []}
            )
        }
        links = [
            CodeDocLink(
                code_chunk_id="utils.py::foo", doc_section_id="docs/api.md::FooHeading",
                link_type="explicit_mention", confidence=0.95, metadata={}
            ),
            CodeDocLink(
                code_chunk_id="utils.py::bar", doc_section_id="docs/api.md::BarHeading",
                link_type="explicit_mention", confidence=0.95, metadata={}
            )
        ]
        index = CodeToDocsIndex(code_chunks, doc_sections, links)

        # Query for affected sections by foo
        affected = self.index_builder.query_affected_sections(index, ["utils.py::foo"])
        self.assertEqual(len(affected), 1)
        self.assertEqual(affected[0].id, "docs/api.md::FooHeading")

        # Query for non-existent chunk
        affected_empty = self.index_builder.query_affected_sections(index, ["utils.py::non_existent"])
        self.assertEqual(len(affected_empty), 0)

if __name__ == "__main__":
    unittest.main()

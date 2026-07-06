import os
import tempfile
import unittest
from docs_healer.code_parser import CodeParser, CodeChunk
from docs_healer.doc_parser import DocumentationParser, DocSection

class TestParsers(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.repo_root = self.temp_dir.name
        self.code_parser = CodeParser(self.repo_root)
        self.doc_parser = DocumentationParser(self.repo_root)

    def tearDown(self):
        self.temp_dir.cleanup()

    def test_parse_python_file(self):
        content = (
            "class UserManager:\n"
            "    \"\"\"Manages users.\"\"\"\n"
            "    def __init__(self, db: str):\n"
            "        self.db = db\n\n"
            "    def get_user(self, user_id: int) -> dict:\n"
            "        \"\"\"Get user from DB.\"\"\"\n"
            "        return {}\n\n"
            "@app.route('/api/users', methods=['POST'])\n"
            "def create_user(username: str):\n"
            "    \"\"\"Create user endpoint.\"\"\"\n"
            "    pass\n\n"
            "@click.command()\n"
            "def run_cli():\n"
            "    pass\n"
        )
        file_path = "test_file.py"
        abs_path = os.path.join(self.repo_root, file_path)
        with open(abs_path, "w", encoding="utf-8") as f:
            f.write(content)

        chunks = self.code_parser.parse_python_file(abs_path, file_path)
        
        # Verify classes
        classes = [c for c in chunks if c.type == "class"]
        self.assertEqual(len(classes), 1)
        self.assertEqual(classes[0].name, "UserManager")
        self.assertEqual(classes[0].docstring, "Manages users.")
        self.assertIn("get_user", classes[0].metadata["methods"])

        # Verify class methods
        methods = [c for c in chunks if c.type == "function" and "UserManager." in c.qualified_name]
        self.assertEqual(len(methods), 2)
        get_user_method = next(m for m in methods if m.name == "get_user")
        self.assertEqual(get_user_method.docstring, "Get user from DB.")
        self.assertEqual(get_user_method.metadata["return_type"], "dict")

        # Verify API Endpoint
        endpoints = [c for c in chunks if c.type == "api_endpoint"]
        self.assertEqual(len(endpoints), 1)
        self.assertEqual(endpoints[0].metadata["route"], "/api/users")
        self.assertEqual(endpoints[0].metadata["method"], "POST")

        # Verify CLI Command
        commands = [c for c in chunks if c.type == "cli_command"]
        self.assertEqual(len(commands), 1)
        self.assertEqual(commands[0].name, "run_cli")

    def test_parse_markdown_file(self):
        content = (
            "# Main Heading\n"
            "Preamble text\n"
            "## Sub Heading\n"
            "Some content mentioning `UserManager` and `get_user`.\n"
            "```python\n"
            "UserManager.get_user(42)\n"
            "```\n"
            "### Deep Heading\n"
            "Deep content\n"
            "## Sibling Heading\n"
            "More content\n"
        )
        file_path = "docs/guide.md"
        abs_path = os.path.join(self.repo_root, file_path)
        os.makedirs(os.path.dirname(abs_path), exist_ok=True)
        with open(abs_path, "w", encoding="utf-8") as f:
            f.write(content)

        sections = self.doc_parser.parse_markdown_file(abs_path, file_path)
        
        self.assertEqual(len(sections), 4)
        
        # Verify heading path
        self.assertEqual(sections[0].heading_path, "Main Heading")
        self.assertEqual(sections[1].heading_path, "Main Heading > Sub Heading")
        self.assertEqual(sections[2].heading_path, "Main Heading > Sub Heading > Deep Heading")
        self.assertEqual(sections[3].heading_path, "Main Heading > Sibling Heading")

        # Verify parent-child metadata
        self.assertEqual(sections[1].metadata["parent_id"], sections[0].id)
        self.assertIn(sections[1].id, sections[0].metadata["child_ids"])
        self.assertIn(sections[2].id, sections[1].metadata["child_ids"])
        self.assertEqual(sections[3].metadata["parent_id"], sections[0].id)

        # Verify line ranges
        self.assertEqual(sections[0].line_start, 1)
        self.assertEqual(sections[0].line_end, 2)
        self.assertEqual(sections[1].line_start, 3)
        self.assertEqual(sections[1].line_end, 7)

        # Test code references extraction
        known_symbols = [
            "test_file.py::UserManager",
            "test_file.py::UserManager.get_user",
            "test_file.py::random_helper"
        ]
        
        refs = self.doc_parser.extract_code_references(sections[1].content, known_symbols)
        self.assertIn("test_file.py::UserManager", refs)
        self.assertIn("test_file.py::UserManager.get_user", refs)
        self.assertNotIn("test_file.py::random_helper", refs)

if __name__ == "__main__":
    unittest.main()

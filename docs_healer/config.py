import os
import sys
import fnmatch

class Config:
    def __init__(self):
        # Default values
        self.docs_path = "docs"
        self.similarity_threshold = 0.75
        self.auto_fix_confidence_threshold = 0.85
        self.llm_model = "gpt-4o"
        self.file_patterns = ["*.py", "*.ts", "*.tsx", "*.js", "*.jsx"]
        self.openai_api_key = os.environ.get("OPENAI_API_KEY", "")
        self.github_token = os.environ.get("GITHUB_TOKEN", "")
        self.github_repository = os.environ.get("GITHUB_REPOSITORY", "")
        self.github_event_path = os.environ.get("GITHUB_EVENT_PATH", "")

        # Try parsing from environment
        try:
            self._load_from_env()
        except Exception as e:
            # If logging or default application fails, the system shall halt
            sys.stderr.write(f"FATAL: Failed to load configuration: {str(e)}\n")
            sys.exit(1)

    def _load_from_env(self):
        # 1. docs_path
        val = os.environ.get("DOCS_PATH")
        if val is not None:
            if not val.strip():
                sys.stderr.write("WARNING: DOCS_PATH is empty. Using default: 'docs'\n")
            else:
                self.docs_path = val.strip()

        # 2. similarity_threshold
        val = os.environ.get("SIMILARITY_THRESHOLD")
        if val is not None:
            try:
                threshold = float(val)
                if 0.0 <= threshold <= 1.0:
                    self.similarity_threshold = threshold
                else:
                    sys.stderr.write(f"WARNING: SIMILARITY_THRESHOLD must be between 0.0 and 1.0. Got {threshold}. Using default: 0.75\n")
            except ValueError:
                sys.stderr.write(f"WARNING: Invalid SIMILARITY_THRESHOLD '{val}'. Using default: 0.75\n")

        # 3. auto_fix_confidence_threshold
        val = os.environ.get("AUTO_FIX_CONFIDENCE_THRESHOLD")
        if val is not None:
            try:
                threshold = float(val)
                if 0.0 <= threshold <= 1.0:
                    self.auto_fix_confidence_threshold = threshold
                else:
                    sys.stderr.write(f"WARNING: AUTO_FIX_CONFIDENCE_THRESHOLD must be between 0.0 and 1.0. Got {threshold}. Using default: 0.85\n")
            except ValueError:
                sys.stderr.write(f"WARNING: Invalid AUTO_FIX_CONFIDENCE_THRESHOLD '{val}'. Using default: 0.85\n")

        # 4. llm_model
        val = os.environ.get("LLM_MODEL")
        if val is not None:
            if not val.strip():
                sys.stderr.write("WARNING: LLM_MODEL is empty. Using default: 'gpt-4o'\n")
            else:
                self.llm_model = val.strip()

        # 5. file_patterns
        val = os.environ.get("FILE_PATTERNS")
        if val is not None:
            patterns = [p.strip() for p in val.split(",") if p.strip()]
            if patterns:
                self.file_patterns = patterns
            else:
                sys.stderr.write("WARNING: FILE_PATTERNS is empty. Using default: ['*.py', '*.ts', '*.tsx', '*.js', '*.jsx']\n")

    def is_file_included(self, filename: str) -> bool:
        """Check if a file matches the inclusion patterns."""
        base_name = os.path.basename(filename)
        for pattern in self.file_patterns:
            if fnmatch.fnmatch(base_name, pattern):
                return True
        return False

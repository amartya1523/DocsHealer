import os
import ast
import json
import subprocess
from typing import List, Dict, Optional, Any
from dataclasses import dataclass, asdict
from docs_healer.logger import logger

@dataclass
class CodeChunk:
    id: str  # Format: file_path::qualified_name
    type: str  # "function" | "class" | "api_endpoint" | "config_schema" | "cli_command"
    name: str
    qualified_name: str
    file_path: str
    line_start: int
    line_end: int
    signature: str
    docstring: Optional[str]
    source_code: str
    metadata: Dict[str, Any]

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

class CodeParser:
    def __init__(self, repo_root: str):
        self.repo_root = os.path.abspath(repo_root)

    def parse_repository(self, file_paths: List[str]) -> List[CodeChunk]:
        """Parse all requested code files and return a list of extracted chunks."""
        chunks = []
        for file_path in file_paths:
            abs_path = os.path.abspath(os.path.join(self.repo_root, file_path))
            if not os.path.exists(abs_path):
                continue
            
            _, ext = os.path.splitext(file_path)
            if ext in [".py"]:
                try:
                    logger.info(f"Parsing Python file: {file_path}", phase="parsing")
                    chunks.extend(self.parse_python_file(abs_path, file_path))
                except Exception as e:
                    logger.error(f"Failed parsing Python file {file_path}", phase="parsing", exception=e)
            elif ext in [".ts", ".tsx", ".js", ".jsx"]:
                try:
                    logger.info(f"Parsing TypeScript/JavaScript file: {file_path}", phase="parsing")
                    chunks.extend(self.parse_ts_file(abs_path, file_path))
                except Exception as e:
                    logger.error(f"Failed parsing TS/JS file {file_path}", phase="parsing", exception=e)
        return chunks

    def parse_python_file(self, abs_path: str, rel_path: str) -> List[CodeChunk]:
        """Parse a Python source file using AST and extract code chunks."""
        with open(abs_path, "r", encoding="utf-8") as f:
            source_code = f.read()

        try:
            tree = ast.parse(source_code, filename=abs_path)
        except SyntaxError as e:
            logger.warning(f"Syntax error in Python file {rel_path}: {str(e)}", phase="parsing")
            return []

        lines = source_code.splitlines()
        chunks: List[CodeChunk] = []

        class PythonASTVisitor(ast.NodeVisitor):
            def __init__(self, parser_inst):
                self.parser = parser_inst
                self.current_class = ""

            def visit_ClassDef(self, node: ast.ClassDef):
                class_name = node.name
                prev_class = self.current_class
                if prev_class:
                    q_name = f"{prev_class}.{class_name}"
                else:
                    q_name = class_name
                self.current_class = q_name

                start_line = node.lineno
                end_line = getattr(node, "end_lineno", start_line)
                node_source = "\n".join(lines[start_line - 1:end_line])

                # Identify properties and methods
                methods = []
                properties = []
                for subnode in node.body:
                    if isinstance(subnode, (ast.FunctionDef, ast.AsyncFunctionDef)):
                        methods.append(subnode.name)
                    elif isinstance(subnode, ast.AnnAssign) and isinstance(subnode.target, ast.Name):
                        properties.append(subnode.target.id)
                    elif isinstance(subnode, ast.Assign):
                        for target in subnode.targets:
                            if isinstance(target, ast.Name):
                                properties.append(target.id)

                docstring = ast.get_docstring(node) or ""

                # Check if it is a configuration schema (BaseModel, dataclass, etc)
                is_schema = False
                for base in node.bases:
                    if isinstance(base, ast.Name) and "Model" in base.id:
                        is_schema = True
                    elif isinstance(base, ast.Attribute) and "Model" in base.attr:
                        is_schema = True
                if "schema" in class_name.lower() or "config" in class_name.lower():
                    is_schema = True

                chunk_type = "config_schema" if is_schema else "class"
                base_names = [ast.unparse(base) for base in node.bases] if hasattr(ast, "unparse") else []
                signature = f"class {class_name}({', '.join(base_names)})" if base_names else f"class {class_name}"

                chunks.append(CodeChunk(
                    id=f"{rel_path}::{q_name}",
                    type=chunk_type,
                    name=class_name,
                    qualified_name=q_name,
                    file_path=rel_path,
                    line_start=start_line,
                    line_end=end_line,
                    signature=signature,
                    docstring=docstring,
                    source_code=node_source,
                    metadata={"methods": methods, "properties": properties}
                ))

                # Continue parsing inner methods/functions
                self.generic_visit(node)
                self.current_class = prev_class

            def visit_FunctionDef(self, node: ast.FunctionDef):
                self._parse_function(node)

            def visit_AsyncFunctionDef(self, node: ast.AsyncFunctionDef):
                self._parse_function(node)

            def _parse_function(self, node: Any):
                func_name = node.name
                if self.current_class:
                    q_name = f"{self.current_class}.{func_name}"
                else:
                    q_name = func_name

                start_line = node.lineno
                end_line = getattr(node, "end_lineno", start_line)
                node_source = "\n".join(lines[start_line - 1:end_line])

                docstring = ast.get_docstring(node) or ""

                # Extract parameters and return type
                params = []
                for arg in node.args.args:
                    arg_type = ""
                    if arg.annotation:
                        arg_type = ast.unparse(arg.annotation) if hasattr(ast, "unparse") else "annotation"
                    params.append({"name": arg.arg, "type": arg_type or "any", "default": None})

                ret_type = "any"
                if node.returns:
                    ret_type = ast.unparse(node.returns) if hasattr(ast, "unparse") else "annotation"

                # Check decorators for API endpoints or CLI commands
                is_endpoint = False
                is_command = False
                endpoint_meta = {}
                command_meta = {}

                for dec in node.decorator_list:
                    dec_str = ""
                    if hasattr(ast, "unparse"):
                        dec_str = ast.unparse(dec)
                    else:
                        # Fallback representation
                        if isinstance(dec, ast.Call):
                            dec_str = getattr(dec.func, "id", "") or getattr(getattr(dec.func, "value", None), "id", "")
                        elif isinstance(dec, ast.Name):
                            dec_str = dec.id
                    
                    dec_str_lower = dec_str.lower()
                    if any(x in dec_str_lower for x in ["route", "get", "post", "put", "delete", "patch"]):
                        is_endpoint = True
                        method = "GET"
                        route_path = "/"
                        for m in ["GET", "POST", "PUT", "DELETE", "PATCH"]:
                            if m in dec_str.upper():
                                method = m
                                break
                        # Try to extract route path string from decorator args
                        if isinstance(dec, ast.Call) and dec.args:
                            first_arg = dec.args[0]
                            if isinstance(first_arg, ast.Constant):
                                route_path = str(first_arg.value)
                        endpoint_meta = {"method": method, "route": route_path}
                    
                    if "command" in dec_str_lower or "cli" in dec_str_lower:
                        is_command = True
                        cmd_name = func_name
                        if isinstance(dec, ast.Call) and dec.args:
                            first_arg = dec.args[0]
                            if isinstance(first_arg, ast.Constant):
                                cmd_name = str(first_arg.value)
                        command_meta = {"command": cmd_name}

                # Set chunk types
                if is_endpoint:
                    chunk_type = "api_endpoint"
                    name_display = f"{endpoint_meta.get('method', 'GET')} {endpoint_meta.get('route', '/')}"
                    # Keep stable unique ID
                    route_clean = endpoint_meta.get('route', '/').replace('/', '_').replace(':', '_')
                    q_name_adj = f"endpoint:{endpoint_meta.get('method', 'GET')}_{route_clean}"
                elif is_command:
                    chunk_type = "cli_command"
                    name_display = command_meta.get("command", func_name)
                    q_name_adj = f"cli_command:{name_display}"
                else:
                    chunk_type = "function"
                    name_display = func_name
                    q_name_adj = q_name

                # Construct argument signature list
                arg_list = []
                for p in params:
                    if p["type"] != "any":
                        arg_list.append(f"{p['name']}: {p['type']}")
                    else:
                        arg_list.append(p['name'])
                sig_ret = f" -> {ret_type}" if ret_type != "any" else ""
                signature = f"def {func_name}({', '.join(arg_list)}){sig_ret}"

                chunks.append(CodeChunk(
                    id=f"{rel_path}::{q_name_adj}",
                    type=chunk_type,
                    name=name_display,
                    qualified_name=q_name_adj,
                    file_path=rel_path,
                    line_start=start_line,
                    line_end=end_line,
                    signature=signature,
                    docstring=docstring,
                    source_code=node_source,
                    metadata={"parameters": params, "return_type": ret_type, **endpoint_meta, **command_meta}
                ))
                self.generic_visit(node)

        visitor = PythonASTVisitor(self)
        visitor.visit(tree)
        return chunks

    def parse_ts_file(self, abs_path: str, rel_path: str) -> List[CodeChunk]:
        """Invoke ts_parser.js to parse TS/JS files and return CodeChunks."""
        script_dir = os.path.dirname(os.path.abspath(__file__))
        # ts_parser.js is in the repo root
        parser_script = os.path.abspath(os.path.join(script_dir, "..", "ts_parser.js"))
        
        if not os.path.exists(parser_script):
            logger.warning(f"TypeScript parser script not found at {parser_script}", phase="parsing")
            return []

        try:
            # Run node ts_parser.js <abs_path> <repo_root>
            res = subprocess.run(
                ["node", parser_script, abs_path, self.repo_root],
                capture_output=True,
                text=True,
                check=False
            )
            if res.returncode != 0:
                logger.warning(f"ts_parser.js exited with non-zero code {res.returncode}: {res.stderr}", phase="parsing")
                return []
            
            output = res.stdout.strip()
            if not output:
                return []
            
            try:
                data = json.loads(output)
            except json.JSONDecodeError as jde:
                logger.warning(f"Failed to parse JSON from ts_parser.js: {jde}", phase="parsing", extra={"stdout": output})
                return []

            if isinstance(data, dict) and "error" in data:
                logger.warning(f"Error returned from ts_parser.js for {rel_path}: {data['error']}", phase="parsing")
                return []

            chunks = []
            for item in data:
                chunks.append(CodeChunk(
                    id=item["id"],
                    type=item["type"],
                    name=item["name"],
                    qualified_name=item["qualified_name"],
                    file_path=item["file_path"],
                    line_start=item["line_start"],
                    line_end=item["line_end"],
                    signature=item["signature"],
                    docstring=item["docstring"],
                    source_code=item["source_code"],
                    metadata=item.get("metadata", {})
                ))
            return chunks

        except Exception as e:
            logger.error(f"Subprocess call to node for {rel_path} failed", phase="parsing", exception=e)
            return []

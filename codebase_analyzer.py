#!/usr/bin/env python3
"""
Codebase Analyzer & Local Backend Server
Antigravity Ecosystem Tool

Features:
- Scans repositories, folders or ZIP archives.
- SHA-256 file hashing for incremental delta-updates & 0ms instant cache hits.
- Intent function classification (Auth, API, Data, UI, Core, Utils, Lifecycle).
- Staged module batching (4–8 files per chunk) for incremental LLM analysis.
- OpenAI-compatible local LLM client (http://localhost:8084/v1/chat/completions) with retry & fallback.
- Export & instant restore persistence (codebase_analysis_results.json).
- Built-in HTTP server providing REST API for scanning and knowledge-base web visualization.
"""

import os
import sys
import json
import re
import io
import time
import html
import hashlib
import zipfile
import argparse
import urllib.request
import urllib.parse
import urllib.error
from urllib.parse import urlparse, parse_qs
from http.server import HTTPServer, BaseHTTPRequestHandler
from pathlib import Path
from typing import Dict, List, Any, Optional

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

from db_manager import DatabaseManager
from auth_manager import (
    hash_password,
    verify_password,
    create_jwt_token,
    decode_jwt_token,
    is_github_oauth_configured,
    exchange_github_code_for_token,
    fetch_github_user_profile
)

# UTF-8 Configuration for Windows PowerShell / CMD
if sys.platform.startswith("win"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

# --- Configuration & Defaults ---
DEFAULT_PORT = int(os.environ.get("PORT", "8084"))
DEFAULT_LLM_URL = os.environ.get("LLM_URL", "http://localhost:11434/v1/chat/completions" if os.environ.get("LLM_URL") is None and os.environ.get("USE_OLLAMA") else "http://localhost:8084/v1/chat/completions")
DEFAULT_LLM_MODEL = os.environ.get("LLM_MODEL", "qwen2.5-coder:7b")
DEFAULT_CACHE_FILE = os.environ.get("CACHE_FILE", "codebase_analysis_cache.json")
DEFAULT_RESULTS_FILE = os.environ.get("RESULTS_FILE", "codebase_analysis_results.json")

IGNORED_DIRS = {
    # VCS & Repository Meta
    ".git", ".svn", ".hg",
    # Agent, Prompt & AI Tool Configurations
    ".agents", ".agent", ".claude", ".gemini", ".cursor", ".windsurf", ".copilot",
    # CI/CD, Git Hooks & Devcontainers
    ".github", ".gitlab", ".gitea", ".devcontainer", ".husky", ".changeset",
    # IDE & Editor Configurations
    ".vscode", ".idea", ".fleet", ".eclipse",
    # Dependencies & Package Managers
    "node_modules", "vendor",
    # Build Outputs, Compilers & Framework Caches
    "target", "dist", "build", "out", "bin", "obj", ".cargo", "coverage",
    "__pycache__", ".venv", "venv", "env",
    ".next", ".nuxt", ".turbo", ".svelte-kit", ".cache"
}

IGNORED_EXTENSIONS = {
    # Media & Binaries
    ".mp4", ".webm", ".avi", ".mov", ".mkv", ".flv", ".wmv",
    ".mp3", ".wav", ".flac", ".ogg", ".aac",
    ".jpg", ".jpeg", ".png", ".gif", ".bmp", ".svg", ".webp", ".ico", ".tiff",
    ".zip", ".tar", ".gz", ".7z", ".rar", ".bz2",
    ".exe", ".dll", ".so", ".dylib", ".bin", ".iso", ".wasm",
    ".pdf", ".docx", ".xlsx", ".pptx",
    ".pyc", ".pyd", ".pyo", ".lock", ".log"
}

LANGUAGE_EXTENSIONS = {
    ".rs": "Rust",
    ".ts": "TypeScript",
    ".tsx": "TypeScript (React)",
    ".js": "JavaScript",
    ".jsx": "JavaScript (React)",
    ".py": "Python",
    ".go": "Go",
    ".c": "C",
    ".cpp": "C++",
    ".cc": "C++",
    ".h": "C/C++ Header",
    ".hpp": "C++ Header",
    ".cs": "C#",
    ".java": "Java",
    ".kt": "Kotlin",
    ".swift": "Swift",
    ".html": "HTML",
    ".htm": "HTML",
    ".css": "CSS",
    ".scss": "SCSS",
    ".sass": "SASS",
    ".less": "LESS",
    ".json": "JSON",
    ".toml": "TOML",
    ".yaml": "YAML",
    ".yml": "YAML",
    ".md": "Markdown",
    ".sql": "SQL",
    ".sh": "Shell Script",
    ".bash": "Shell Script",
    ".ps1": "PowerShell",
    ".bat": "Batch",
    ".cmd": "Batch",
    ".dockerfile": "Dockerfile",
    "Dockerfile": "Dockerfile"
}

CODE_EXTENSIONS = {
    ".rs", ".ts", ".tsx", ".js", ".jsx", ".py", ".go", ".c", ".cpp", ".cc", ".cxx",
    ".h", ".hpp", ".cs", ".java", ".kt", ".swift", ".php", ".rb", ".sh", ".bash",
    ".ps1", ".vue", ".svelte", ".dart", ".lua", ".scala"
}

NON_CODE_EXTENSIONS = {
    ".md", ".markdown", ".mdown", ".mkd", ".txt", ".json", ".toml", ".yaml", ".yml", ".xml",
    ".csv", ".tsv", ".lock", ".env", ".svg", ".html", ".htm", ".css", ".scss", ".sass", ".less",
    ".ini", ".cfg", ".conf", ".log", ".map", ".pdf", ".png", ".jpg", ".jpeg", ".gif", ".ico"
}

# --- Code Extractor RegExes ---
PATTERNS = {
    "Rust": {
        "functions": re.compile(r'^\s*(?:pub\s+(?:\([^\)]+\)\s+)?)?(?:async\s+)?fn\s+([a-zA-Z0-9_]+)\s*(?:<[^>]+>)?\s*\(([^)]*)\)', re.MULTILINE),
        "structs": re.compile(r'^\s*(?:pub\s+(?:\([^\)]+\)\s+)?)?struct\s+([a-zA-Z0-9_]+)', re.MULTILINE),
        "enums": re.compile(r'^\s*(?:pub\s+(?:\([^\)]+\)\s+)?)?enum\s+([a-zA-Z0-9_]+)', re.MULTILINE),
        "traits": re.compile(r'^\s*(?:pub\s+(?:\([^\)]+\)\s+)?)?trait\s+([a-zA-Z0-9_]+)', re.MULTILINE),
        "imports": re.compile(r'^\s*use\s+([^;]+);', re.MULTILINE)
    },
    "TypeScript": {
        "functions": re.compile(r'(?:export\s+)?(?:async\s+)?function\s+([a-zA-Z0-9_$]+)\s*\(([^)]*)\)|(?:const|let|var)\s+([a-zA-Z0-9_$]+)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>', re.MULTILINE),
        "classes": re.compile(r'(?:export\s+)?(?:abstract\s+)?class\s+([a-zA-Z0-9_$]+)', re.MULTILINE),
        "interfaces": re.compile(r'(?:export\s+)?interface\s+([a-zA-Z0-9_$]+)', re.MULTILINE),
        "types": re.compile(r'(?:export\s+)?type\s+([a-zA-Z0-9_$]+)\s*=', re.MULTILINE),
        "imports": re.compile(r'import\s+(?:\{[^}]*\}|[\w*]+(?:\s*,\s*\{[^}]*\})?)\s+from\s+[\'"]([^\'"]+)[\'"]', re.MULTILINE)
    },
    "JavaScript": {
        "functions": re.compile(r'(?:export\s+)?(?:async\s+)?function\s+([a-zA-Z0-9_$]+)\s*\(([^)]*)\)|(?:const|let|var)\s+([a-zA-Z0-9_$]+)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>', re.MULTILINE),
        "classes": re.compile(r'(?:export\s+)?class\s+([a-zA-Z0-9_$]+)', re.MULTILINE),
        "imports": re.compile(r'import\s+(?:\{[^}]*\}|[\w*]+(?:\s*,\s*\{[^}]*\})?)\s+from\s+[\'"]([^\'"]+)[\'"]|require\([\'"]([^\'"]+)[\'"]\)', re.MULTILINE)
    },
    "Python": {
        "functions": re.compile(r'^\s*(?:async\s+)?def\s+([a-zA-Z0-9_]+)\s*\(([^)]*)\):', re.MULTILINE),
        "classes": re.compile(r'^\s*class\s+([a-zA-Z0-9_]+)(?:\(([^)]*)\))?:', re.MULTILINE),
        "imports": re.compile(r'^\s*(?:from\s+([a-zA-Z0-9_.]+)\s+import|import\s+([a-zA-Z0-9_.,\s]+))', re.MULTILINE)
    },
    "Go": {
        "functions": re.compile(r'^\s*func\s+(?:\([^)]+\)\s+)?([a-zA-Z0-9_]+)\s*\(([^)]*)\)', re.MULTILINE),
        "structs": re.compile(r'^\s*type\s+([a-zA-Z0-9_]+)\s+struct', re.MULTILINE),
        "interfaces": re.compile(r'^\s*type\s+([a-zA-Z0-9_]+)\s+interface', re.MULTILINE),
        "imports": re.compile(r'import\s+\(\s*([\s\S]*?)\s*\)|import\s+([^\n]+)', re.MULTILINE)
    }
}

# --- Intent Semantic Roles Definitions ---
INTENT_ROLES = {
    "Auth": {
        "id": "Auth",
        "name": "Auth & Security",
        "icon": "🔐",
        "color": "#ef4444",
        "keywords": ["auth", "login", "logout", "token", "jwt", "session", "password", "permission", "role", "authenticate", "authorize", "hash_password", "verify_token", "oauth", "credential", "security", "protect", "secret", "crypto_key"]
    },
    "API": {
        "id": "API",
        "name": "API & Commands",
        "icon": "⚡",
        "color": "#38bdf8",
        "keywords": ["api", "route", "endpoint", "command", "ipc", "http", "fetch", "request", "post", "get", "put", "delete", "handler", "controller", "serve", "listen", "webhook", "router", "client", "response", "emit", "tauri"]
    },
    "Data": {
        "id": "Data",
        "name": "Data & State",
        "icon": "🗄️",
        "color": "#a855f7",
        "keywords": ["store", "state", "db", "database", "sql", "sqlite", "postgres", "model", "schema", "entity", "repo", "repository", "query", "persist", "cache", "migration", "save", "load", "fetch_data", "insert", "update", "delete_record", "redis", "table"]
    },
    "UI": {
        "id": "UI",
        "name": "UI & Presentation",
        "icon": "🎨",
        "color": "#ff8000",
        "keywords": ["render", "view", "component", "button", "modal", "dialog", "drawer", "input", "form", "layout", "template", "screen", "page", "widget", "toast", "menu", "sidebar", "navbar", "css", "style", "theme", "html", "dom", "jsx", "tsx", "display", "draw", "canvas", "animate", "bubble"]
    },
    "Core": {
        "id": "Core",
        "name": "Core & Business Logic",
        "icon": "⚙️",
        "color": "#63b22f",
        "keywords": ["engine", "process", "execute", "run", "calculate", "compute", "parse", "transform", "analyze", "evaluate", "dispatch", "orchestrate", "aggregate", "compile", "generate", "validate", "pipeline", "service", "domain", "strategy", "algorithm", "worker"]
    },
    "Utils": {
        "id": "Utils",
        "name": "Utils & Helpers",
        "icon": "🛠️",
        "color": "#eab308",
        "keywords": ["util", "helper", "format", "convert", "sanitize", "escape", "clean", "truncate", "debounce", "throttle", "sleep", "clamp", "normalize", "random", "hash", "string", "date", "math", "slug", "pad", "diff", "clone", "merge"]
    },
    "Lifecycle": {
        "id": "Lifecycle",
        "name": "Lifecycle & Setup",
        "icon": "🧪",
        "color": "#ec4899",
        "keywords": ["init", "setup", "start", "stop", "boot", "mount", "unmount", "destroy", "cleanup", "dispose", "teardown", "constructor", "reset", "open", "close", "bind", "unbind", "hook", "signal", "main", "entry", "register", "unregister"]
    }
}


def categorize_function_intent(fn_name: str) -> Dict[str, Any]:
    """Categorizes a function name into its semantic intent role."""
    if not fn_name:
        return INTENT_ROLES["Utils"]

    clean_name = re.sub(r'^(fn|def|func)\s+|\(\)$', '', fn_name).strip()
    s1 = re.sub('(.)([A-Z][a-z]+)', r'\1_\2', clean_name)
    normalized = re.sub('([a-z0-9])([A-Z])', r'\1_\2', s1).lower()
    tokens = set(re.split(r'[^a-z0-9]+', normalized))

    best_role = "Utils"
    best_score = 0

    for role_key, role_info in INTENT_ROLES.items():
        score = 0
        for kw in role_info["keywords"]:
            if kw in tokens:
                score += 3
            elif normalized.startswith(kw) or normalized.endswith(kw):
                score += 2
            elif kw in normalized:
                score += 1
        if score > best_score:
            best_score = score
            best_role = role_key

    return INTENT_ROLES[best_role]


def compute_sha256(content: str, rel_path: str = "") -> str:
    """Computes SHA-256 hash for content and path."""
    hasher = hashlib.sha256()
    hasher.update((rel_path + "\n" + content).encode("utf-8"))
    return hasher.hexdigest()


class CodebaseScanner:
    """Scans directories or ZIP archives to analyze source code files with incremental caching."""

    def __init__(self, root_path: Optional[str] = None, cache_path: Optional[str] = None):
        self.root_path = Path(root_path).resolve() if root_path else None
        self.cache_path = Path(cache_path or DEFAULT_CACHE_FILE)
        self.cache_data = self._load_cache()
        self.files_data: Dict[str, Any] = {}
        self.delta_stats = {"cached": 0, "scanned": 0, "total": 0}

    def _load_cache(self) -> Dict[str, Any]:
        if self.cache_path.exists():
            try:
                with open(self.cache_path, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception as e:
                print(f"[!] Warning: Could not load cache from {self.cache_path}: {e}", file=sys.stderr)
        return {"files": {}, "last_updated": ""}

    def save_cache(self):
        try:
            self.cache_data["last_updated"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
            with open(self.cache_path, "w", encoding="utf-8") as f:
                json.dump(self.cache_data, f, indent=2)
        except Exception as e:
            print(f"[!] Warning: Could not save cache to {self.cache_path}: {e}", file=sys.stderr)

    def should_ignore(self, path_str: str) -> bool:
        normalized = path_str.replace('\\', '/')
        parts = [p.lower() for p in normalized.split('/') if p]
        for part in parts:
            if part in IGNORED_DIRS:
                return True
        ext = os.path.splitext(path_str)[1].lower()
        if ext in IGNORED_EXTENSIONS:
            return True
        return False

    def detect_language(self, filename: str) -> str:
        base = os.path.basename(filename)
        if base in LANGUAGE_EXTENSIONS:
            return LANGUAGE_EXTENSIONS[base]
        ext = os.path.splitext(filename)[1].lower()
        return LANGUAGE_EXTENSIONS.get(ext, "Unknown / Plain Text")

    def is_code_file(self, filename: str) -> bool:
        ext = os.path.splitext(filename)[1].lower()
        if ext in NON_CODE_EXTENSIONS:
            return False
        return ext in CODE_EXTENSIONS

    def analyze_source(self, relative_path: str, content: str, use_cache: bool = True) -> Dict[str, Any]:
        norm_path = relative_path.replace('\\', '/')
        file_sha256 = compute_sha256(content, norm_path)
        byte_size = len(content.encode('utf-8'))

        # Check Cache for identical SHA-256 (0ms skip!)
        cached_entry = self.cache_data.get("files", {}).get(norm_path)
        if use_cache and cached_entry and cached_entry.get("sha256") == file_sha256:
            self.delta_stats["cached"] += 1
            entry_copy = dict(cached_entry)
            entry_copy["content"] = content
            return entry_copy

        self.delta_stats["scanned"] += 1
        lang = self.detect_language(norm_path)
        lines = content.splitlines()
        total_lines = len(lines)
        blank_lines = 0
        comment_lines = 0
        code_lines = 0

        # Cyclomatic complexity heuristic with precise trigger line tracking
        is_code = self.is_code_file(norm_path)
        complexity_triggers = []
        is_data_heavy = False

        if is_code:
            branch_regexes = [
                ('if / elif', re.compile(r'\b(if|elif)\b')),
                ('else', re.compile(r'\belse\b')),
                ('match / switch', re.compile(r'\b(match|switch)\b')),
                ('case', re.compile(r'\bcase\b')),
                ('loop (for/while)', re.compile(r'\b(for|while)\b')),
                ('catch / except', re.compile(r'\b(catch|except)\b')),
                ('ternary (?:)', re.compile(r'(?<![a-zA-Z0-9_$])\?(?![?.a-zA-Z0-9_$])')),
                ('nullish (??)', re.compile(r'\?\?')),
                ('logical AND (&&)', re.compile(r'&&')),
                ('logical OR (||)', re.compile(r'\|\|'))
            ]
            
            complexity = 1
            in_multiline_comment = False
            for line_idx, line in enumerate(lines, 1):
                stripped = line.strip()
                if not stripped:
                    blank_lines += 1
                    continue
                
                # Check multiline docstrings / comments (Python """ or /* */)
                if stripped.startswith(('"""', "'''")):
                    if stripped.count('"""') % 2 == 1 or stripped.count("'''") % 2 == 1:
                        in_multiline_comment = not in_multiline_comment
                    comment_lines += 1
                    continue
                elif in_multiline_comment:
                    if '"""' in stripped or "'''" in stripped:
                        in_multiline_comment = False
                    comment_lines += 1
                    continue
                elif stripped.startswith(("//", "#", "/*", "*", "<!--")):
                    comment_lines += 1
                    continue

                code_lines += 1
                for trigger_name, pattern in branch_regexes:
                    matches = pattern.findall(stripped)
                    if matches:
                        complexity += len(matches)
                        # Clean snippet up to 100 chars
                        snippet_text = stripped[:100].strip()
                        complexity_triggers.append({
                            "line": line_idx,
                            "type": trigger_name,
                            "snippet": snippet_text
                        })
            
            # Check for data overhead / large arrays/objects (e.g., STORE_ITEMS, large constant datasets)
            if "STORE_ITEMS" in content or (total_lines > 150 and code_lines > 0 and (content.count('{') + content.count('[')) > 25 and (content.count('id:') + content.count('"id"') + content.count('name:') + content.count('"name"')) > 10):
                is_data_heavy = True
        else:
            complexity = 0
            for line in lines:
                stripped = line.strip()
                if not stripped:
                    blank_lines += 1
                elif stripped.startswith(("//", "#", "/*", "*", "<!--")):
                    comment_lines += 1
                else:
                    code_lines += 1

        # Symbols & Intent Categorization
        symbols = {"functions": [], "classes": [], "structs": [], "interfaces": [], "imports": [], "categorized_functions": []}
        intent_breakdown = {k: 0 for k in INTENT_ROLES.keys()}
        lang_key = lang.split()[0] if " " in lang else lang

        if is_code and lang_key in PATTERNS:
            p = PATTERNS[lang_key]
            if "functions" in p:
                for match in p["functions"].finditer(content):
                    fn_name = match.group(1) or (match.group(3) if len(match.groups()) >= 3 else None)
                    if fn_name:
                        symbols["functions"].append(fn_name)
                        role_info = categorize_function_intent(fn_name)
                        intent_breakdown[role_info["id"]] = intent_breakdown.get(role_info["id"], 0) + 1
                        symbols["categorized_functions"].append({
                            "name": fn_name,
                            "intent_role": role_info["id"],
                            "intent_name": role_info["name"],
                            "icon": role_info["icon"],
                            "color": role_info["color"]
                        })
            if "classes" in p:
                for match in p["classes"].finditer(content):
                    cls_name = match.group(1)
                    symbols["classes"].append(cls_name)
                    role_info = categorize_function_intent(cls_name)
                    intent_breakdown[role_info["id"]] = intent_breakdown.get(role_info["id"], 0) + 1
            if "structs" in p:
                for match in p["structs"].finditer(content):
                    st_name = match.group(1)
                    symbols["structs"].append(st_name)
                    role_info = categorize_function_intent(st_name)
                    intent_breakdown[role_info["id"]] = intent_breakdown.get(role_info["id"], 0) + 1
            if "interfaces" in p:
                for match in p["interfaces"].finditer(content):
                    symbols["interfaces"].append(match.group(1))
            if "imports" in p:
                for match in p["imports"].finditer(content):
                    imp = [g for g in match.groups() if g]
                    if imp:
                        raw_str = imp[0].strip()
                        for sub_imp in raw_str.split(','):
                            cleaned = sub_imp.strip().split(' as ')[0].strip().split('\n')[0].strip()
                            if cleaned and cleaned not in symbols["imports"]:
                                symbols["imports"].append(cleaned)

        # Primary Intent Role for this file
        dominant_role = "Core" if is_code else "Utils"
        max_role_count = 0
        for r_id, count in intent_breakdown.items():
            if count > max_role_count:
                max_role_count = count
                dominant_role = r_id

        # Path heuristics if symbols were sparse
        if max_role_count == 0:
            lower_p = norm_path.lower()
            if any(k in lower_p for k in ["auth", "session", "login", "jwt", "secret", "token"]):
                dominant_role = "Auth"
            elif any(k in lower_p for k in ["api", "route", "endpoint", "ipc", "command", "http", "controller"]):
                dominant_role = "API"
            elif any(k in lower_p for k in ["db", "store", "state", "schema", "model", "sql", "entity", "repo"]):
                dominant_role = "Data"
            elif any(k in lower_p for k in ["ui", "view", "component", "page", "style", "css", "html", "jsx", "tsx"]):
                dominant_role = "UI"
            elif any(k in lower_p for k in ["init", "setup", "boot", "mount", "main"]):
                dominant_role = "Lifecycle"
            elif any(k in lower_p for k in ["util", "helper", "format", "tool", "convert"]):
                dominant_role = "Utils"
            else:
                dominant_role = "Core" if is_code else "Utils"

        file_obj = {
            "path": norm_path,
            "sha256": file_sha256,
            "byte_size": byte_size,
            "language": lang,
            "total_lines": total_lines,
            "code_lines": code_lines,
            "comment_lines": comment_lines,
            "blank_lines": blank_lines,
            "complexity": complexity,
            "complexity_triggers": complexity_triggers,
            "is_data_heavy": is_data_heavy,
            "symbols": symbols,
            "intent_role": dominant_role,
            "intent_breakdown": intent_breakdown,
            "content": content
        }

        # Update cache entry (without raw content to keep cache lightweight)
        cache_entry = {k: v for k, v in file_obj.items() if k != "content"}
        if "files" not in self.cache_data:
            self.cache_data["files"] = {}
        self.cache_data["files"][norm_path] = cache_entry

        return file_obj

    def scan_directory(self, target_dir: Optional[str] = None, use_cache: bool = True) -> Dict[str, Any]:
        dir_path = Path(target_dir).resolve() if target_dir else self.root_path
        if not dir_path or not dir_path.exists():
            raise ValueError(f"Directory {dir_path} does not exist.")

        self.delta_stats = {"cached": 0, "scanned": 0, "total": 0}
        file_list = []

        for root, dirs, files in os.walk(dir_path):
            dirs[:] = [d for d in dirs if d.lower() not in IGNORED_DIRS]
            for file in files:
                full_path = Path(root) / file
                rel_path = full_path.relative_to(dir_path).as_posix()
                if self.should_ignore(rel_path):
                    continue
                try:
                    with open(full_path, "r", encoding="utf-8", errors="replace") as f:
                        content = f.read()
                    data = self.analyze_source(rel_path, content, use_cache=use_cache)
                    self.files_data[rel_path] = data
                    file_list.append(data)
                except Exception as e:
                    print(f"Skipping {rel_path}: {e}", file=sys.stderr)

        self.delta_stats["total"] = len(file_list)
        self.save_cache()
        return self._aggregate(file_list, project_name=dir_path.name)

    def scan_zip(self, zip_bytes: bytes, project_name: str = "Uploaded_Archive", use_cache: bool = True) -> Dict[str, Any]:
        self.delta_stats = {"cached": 0, "scanned": 0, "total": 0}
        file_list = []
        with zipfile.ZipFile(io.BytesIO(zip_bytes), "r") as z:
            for zip_info in z.infolist():
                if zip_info.is_dir():
                    continue
                rel_path = zip_info.filename.replace('\\', '/')
                if self.should_ignore(rel_path):
                    continue
                try:
                    with z.open(zip_info) as f:
                        raw = f.read()
                        content = raw.decode("utf-8", errors="replace")
                    data = self.analyze_source(rel_path, content, use_cache=use_cache)
                    self.files_data[rel_path] = data
                    file_list.append(data)
                except Exception as e:
                    print(f"Skipping {rel_path} in ZIP: {e}", file=sys.stderr)

        self.delta_stats["total"] = len(file_list)
        self.save_cache()
        return self._aggregate(file_list, project_name=project_name)

    def _aggregate(self, file_list: List[Dict[str, Any]], project_name: str) -> Dict[str, Any]:
        total_files = len(file_list)
        total_lines = sum(f["total_lines"] for f in file_list)
        total_code_lines = sum(f["code_lines"] for f in file_list)
        total_comment_lines = sum(f["comment_lines"] for f in file_list)
        total_blank_lines = sum(f["blank_lines"] for f in file_list)
        code_files = [f for f in file_list if self.is_code_file(f["path"])]
        total_complexity = sum(f["complexity"] for f in code_files)
        avg_complexity = round(total_complexity / max(1, len(code_files)), 2) if code_files else 0.0

        lang_counts = {}
        intent_summary = {k: 0 for k in INTENT_ROLES.keys()}
        for f in file_list:
            lang = f["language"]
            lang_counts[lang] = lang_counts.get(lang, 0) + f["code_lines"]
            r = f.get("intent_role", "Core")
            intent_summary[r] = intent_summary.get(r, 0) + 1

        tree = self._build_tree(file_list)
        mindmap = self._generate_architecture_mindmap(file_list, project_name)
        risk_radar = self._evaluate_risks(file_list)
        api_catalog = self._build_api_catalog(file_list)
        batches = create_module_batches(file_list, batch_size=6)

        return {
            "project_name": project_name,
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "delta_stats": self.delta_stats,
            "summary": {
                "total_files": total_files,
                "total_lines": total_lines,
                "code_lines": total_code_lines,
                "comment_lines": total_comment_lines,
                "blank_lines": total_blank_lines,
                "avg_complexity": avg_complexity,
                "languages": lang_counts,
                "intent_summary": intent_summary
            },
            "file_tree": tree,
            "mindmap": mindmap,
            "risk_radar": risk_radar,
            "api_catalog": api_catalog,
            "module_batches": batches,
            "files": {f["path"]: {k: v for k, v in f.items() if k != "content"} for f in file_list},
            "file_contents": {f["path"]: f["content"] for f in file_list}
        }

    def _build_tree(self, file_list: List[Dict[str, Any]]) -> Dict[str, Any]:
        root: Dict[str, Any] = {"name": "root", "type": "directory", "children": {}}
        for f in file_list:
            parts = f["path"].split("/")
            curr = root
            for idx, part in enumerate(parts):
                if idx == len(parts) - 1:
                    curr["children"][part] = {
                        "name": part,
                        "type": "file",
                        "path": f["path"],
                        "sha256": f.get("sha256", ""),
                        "language": f["language"],
                        "intent_role": f.get("intent_role", "Core"),
                        "lines": f["total_lines"],
                        "complexity": f["complexity"]
                    }
                else:
                    if part not in curr["children"]:
                        curr["children"][part] = {"name": part, "type": "directory", "children": {}}
                    curr = curr["children"][part]
        return root

    def _generate_architecture_mindmap(self, file_list: List[Dict[str, Any]], project_name: str) -> Dict[str, Any]:
        layers = {
            "Frontend / UI": [],
            "Backend / Core": [],
            "Services & API": [],
            "Models & Data": [],
            "Config & Build": []
        }

        for f in file_list:
            p = f["path"].lower()
            lang = f["language"]
            role = f.get("intent_role", "")
            if role == "UI" or any(k in p for k in ["ui", "views", "components", "pages", "frontend", "client"]) or "React" in lang or "HTML" in lang or "CSS" in lang:
                layers["Frontend / UI"].append(f)
            elif role in ["Core", "Lifecycle"] or any(k in p for k in ["server", "backend", "core", "main", "engine", "handler"]) or "Rust" in lang or "Go" in lang:
                layers["Backend / Core"].append(f)
            elif role in ["API", "Auth"] or any(k in p for k in ["api", "service", "route", "controller", "endpoint", "network", "client"]):
                layers["Services & API"].append(f)
            elif role == "Data" or any(k in p for k in ["model", "schema", "entity", "db", "store", "state", "sql"]):
                layers["Models & Data"].append(f)
            else:
                layers["Config & Build"].append(f)

        root_node = {
            "id": "root",
            "name": project_name,
            "category": "Project Architecture",
            "children": []
        }

        for layer_name, files in layers.items():
            if not files:
                continue
            layer_node = {
                "id": layer_name.replace(" ", "_").lower(),
                "name": layer_name,
                "category": "Layer",
                "children": []
            }
            for f in sorted(files, key=lambda x: x["code_lines"], reverse=True)[:10]:
                mod_node = {
                    "id": f["path"],
                    "name": Path(f["path"]).name,
                    "path": f["path"],
                    "category": "Component",
                    "intent_role": f.get("intent_role", "Core"),
                    "lines": f["code_lines"],
                    "complexity": f["complexity"],
                    "children": []
                }
                for fn in f["symbols"]["functions"][:6]:
                    fn_role = categorize_function_intent(fn)
                    mod_node["children"].append({
                        "id": f"{f['path']}::{fn}",
                        "name": f"{fn_role['icon']} {fn}()",
                        "path": f["path"],
                        "category": "Function",
                        "intent_role": fn_role["id"]
                    })
                for cls in (f["symbols"]["classes"] + f["symbols"]["structs"])[:4]:
                    mod_node["children"].append({
                        "id": f"{f['path']}::{cls}",
                        "name": f"📦 {cls}",
                        "path": f["path"],
                        "category": "Type"
                    })
                layer_node["children"].append(mod_node)
            root_node["children"].append(layer_node)

        return root_node

    def _evaluate_risks(self, file_list: List[Dict[str, Any]]) -> Dict[str, Any]:
        high_complexity = [f for f in file_list if self.is_code_file(f["path"]) and f["complexity"] > 25]
        PROGRAM_LOGIC_EXTS = {".rs", ".ts", ".tsx", ".js", ".jsx", ".py", ".go", ".c", ".cpp", ".cs", ".java", ".php", ".rb", ".swift", ".kt"}
        UI_TEMPLATE_EXTS = {".html", ".htm", ".vue", ".svelte"}

        large_files = []
        loc_alerts = []

        for f in file_list:
            path_str = f["path"]
            ext = os.path.splitext(path_str)[1].lower()
            loc = f.get("code_lines", 0)

            if ext in PROGRAM_LOGIC_EXTS and loc > 400:
                large_files.append(f)
                loc_alerts.append({
                    "level": "info",
                    "title": f"Large Module Size ({loc} LOC)",
                    "path": path_str,
                    "description": "File exceeds recommended 400 LOC threshold for maintainability. Consider modular refactoring."
                })
            elif ext in UI_TEMPLATE_EXTS and loc > 800:
                large_files.append(f)
                loc_alerts.append({
                    "level": "info",
                    "title": f"Large UI Template ({loc} LOC)",
                    "path": path_str,
                    "description": "UI template exceeds 800 LOC. Consider breaking down into modular sub-components."
                })

        missing_comments = [f for f in file_list if self.is_code_file(f["path"]) and f["code_lines"] > 100 and (f["comment_lines"] / max(1, f["code_lines"])) < 0.05]

        complexity_alerts = []
        for f in sorted(high_complexity, key=lambda x: x["complexity"], reverse=True)[:8]:
            triggers = f.get("complexity_triggers", [])
            tip = ""
            if f.get("is_data_heavy") or "STORE_ITEMS" in f.get("content", ""):
                tip = "💡 Tipp: Reine Daten-Objekte (wie STORE_ITEMS) können als separate .json-Datei ausgelagert werden, um Code und Daten sauber zu trennen."
            
            complexity_alerts.append({
                "level": "warning" if f["complexity"] < 50 else "danger",
                "title": f"High Cyclomatic Complexity ({f['complexity']})",
                "path": f["path"],
                "description": f"File exceeds normal branching complexity threshold ({f['complexity']} branches). Consider modularizing.",
                "complexity": f["complexity"],
                "triggers": triggers[:20],  # top 20 triggers for inspector & direct jump
                "total_triggers": len(triggers),
                "refactoring_tip": tip
            })

        # Add data overhead alert if detected in any files not already covered
        data_heavy_files = [f for f in file_list if f.get("is_data_heavy") and f["path"] not in [a["path"] for a in complexity_alerts]]
        data_alerts = []
        for f in data_heavy_files[:3]:
            data_alerts.append({
                "level": "info",
                "title": f"Data-Heavy Module Pattern",
                "path": f["path"],
                "description": "Large inline data structures detected in source code.",
                "refactoring_tip": "💡 Tipp: Reine Daten-Objekte (wie STORE_ITEMS) können als separate .json-Datei ausgelagert werden, um Code und Daten sauber zu trennen."
            })

        top_loc_alerts = sorted(loc_alerts, key=lambda x: next((f["code_lines"] for f in file_list if f["path"] == x["path"]), 0), reverse=True)[:5]

        return {
            "health_score": max(20, min(100, 100 - (len(high_complexity) * 4 + len(large_files) * 3))),
            "metrics": {
                "high_complexity_files": len(high_complexity),
                "large_files": len(large_files),
                "low_documentation_files": len(missing_comments),
            },
            "alerts": complexity_alerts + data_alerts + top_loc_alerts
        }

    def _build_api_catalog(self, file_list: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        catalog = []
        
        # Excluded caller variable/property names to strictly avoid false positives like params.get('id'), headers.get('content-type')
        EXCLUDED_CALLERS = {
            "params", "searchparams", "urlparams", "queryparams", "headers", "reqheaders", "resheaders",
            "map", "this", "self", "dict", "data", "store", "cache", "config", "settings", "options", "opt",
            "env", "formdata", "props", "state", "row", "record", "node", "schema", "doc", "query", "args",
            "cookies", "form", "payload", "body", "ctx", "context", "localstorage", "sessionstorage",
            "req", "res", "response", "request", "meta", "attributes", "attrs", "values", "json_data", "session",
            "usermap"
        }

        # Regexes for route discovery
        tauri_fn_re = re.compile(r'^(?:pub(?:\([^\)]+\))?\s+)?(?:async\s+)?fn\s+([a-zA-Z0-9_]+)')
        tauri_invoke_re = re.compile(r'invoke(?:<[^>]+>)?\(\s*["\']([^"\']+)["\']')
        rust_macro_route_re = re.compile(r'#\[(get|post|put|delete|patch|head|options)\s*\(\s*["\'](/[^"\']*)["\']\s*\)\]', re.IGNORECASE)
        rust_route_attr_re = re.compile(r'#\[route\s*\(\s*["\'](/[^"\']*)["\']\s*,\s*method\s*=\s*["\']([A-Z]+)["\']\s*\)\]', re.IGNORECASE)
        rust_axum_route_re = re.compile(r'\.route\s*\(\s*["\'](/[^"\']*)["\']\s*,\s*(get|post|put|delete|patch|options|head)\s*\(', re.IGNORECASE)
        py_decorator_re = re.compile(r'@(?:app|router|api|bp|blueprint|server|v1|v2)\.(get|post|put|delete|patch|options|head)\s*\(\s*["\'](/[^"\']*)["\']', re.IGNORECASE)
        py_route_decorator_re = re.compile(r'@(?:app|router|api|bp|blueprint)\.route\s*\(\s*["\'](/[^"\']*)["\'](?:\s*,\s*methods\s*=\s*\[([^\]]+)\])?', re.IGNORECASE)
        js_router_re = re.compile(r'(?:^|[^\w$.])(app|router|server|api|apiClient|client|axios|http|requests|httpx)\.(get|post|put|delete|patch|head|options)\s*\(\s*[`"\'](/[^`"\']*|https?://[^`"\']+)[`"\']', re.IGNORECASE)
        js_fetch_re = re.compile(r'(?:^|[^\w$.])fetch\s*\(\s*[`"\'](/[^`"\']*|https?://[^`"\']+)[`"\']', re.IGNORECASE)
        js_nestjs_re = re.compile(r'@(Get|Post|Put|Delete|Patch|Options|Head|All)\s*\(\s*[`"\']([^`"\']*)[`"\']\s*\)')
        rust_reqwest_re = re.compile(r'reqwest::(?:Client::new\(\)\.)?(get|post|put|delete|patch)\s*\(\s*["\'](/[^"\']*|https?://[^"\']*)["\']', re.IGNORECASE)
        rust_websys_re = re.compile(r'(?:web_sys::)?Request::new_with_str\s*\(\s*["\'](/[^"\']*|https?://[^"\']*)["\']', re.IGNORECASE)

        for f in file_list:
            if not self.is_code_file(f["path"]):
                continue
            content = f.get("content", "")
            if not content:
                continue

            lines = content.splitlines()
            seen_routes = set()

            for line_idx, line in enumerate(lines, 1):
                stripped = line.strip()
                if not stripped or stripped.startswith(("//", "/*", "*")):
                    continue

                # 1. Tauri Commands (Rust)
                if "#[tauri::command]" in stripped or "#[command]" in stripped:
                    cmd_match = tauri_fn_re.search(stripped)
                    target_line = line_idx
                    if not cmd_match and line_idx < len(lines):
                        next_line = lines[line_idx].strip()
                        cmd_match = tauri_fn_re.search(next_line)
                        if cmd_match:
                            target_line = line_idx + 1
                    if cmd_match:
                        cmd_name = cmd_match.group(1)
                        key = (cmd_name, target_line)
                        if key not in seen_routes:
                            seen_routes.add(key)
                            catalog.append({
                                "protocol": "Tauri IPC",
                                "name": cmd_name,
                                "endpoint": cmd_name,
                                "method": "IPC",
                                "handler": cmd_name,
                                "path": f["path"],
                                "intent_role": "API",
                                "type": "Command",
                                "line": target_line
                            })

                # 2. Tauri Frontend Invoke
                for inv_match in tauri_invoke_re.finditer(stripped):
                    inv_cmd = inv_match.group(1)
                    key = (inv_cmd, line_idx)
                    if key not in seen_routes:
                        seen_routes.add(key)
                        catalog.append({
                            "protocol": "Tauri Invoke",
                            "name": inv_cmd,
                            "endpoint": inv_cmd,
                            "method": "INVOKE",
                            "handler": inv_cmd,
                            "path": f["path"],
                            "intent_role": "API",
                            "type": "Client Call",
                            "line": line_idx
                        })

                # 3. Rust Actix / Rocket / Poem macros
                for m in rust_macro_route_re.finditer(stripped):
                    method = m.group(1).upper()
                    endpoint = m.group(2)
                    name = f"{method} {endpoint}"
                    key = (name, line_idx)
                    if key not in seen_routes:
                        seen_routes.add(key)
                        catalog.append({
                            "protocol": "REST API",
                            "name": name,
                            "endpoint": endpoint,
                            "method": method,
                            "handler": f["path"],
                            "path": f["path"],
                            "intent_role": "API",
                            "type": "HTTP Route",
                            "line": line_idx
                        })

                for m in rust_route_attr_re.finditer(stripped):
                    endpoint = m.group(1)
                    method = m.group(2).upper()
                    name = f"{method} {endpoint}"
                    key = (name, line_idx)
                    if key not in seen_routes:
                        seen_routes.add(key)
                        catalog.append({
                            "protocol": "REST API",
                            "name": name,
                            "endpoint": endpoint,
                            "method": method,
                            "handler": f["path"],
                            "path": f["path"],
                            "intent_role": "API",
                            "type": "HTTP Route",
                            "line": line_idx
                        })

                # 4. Axum .route("/path", get(...))
                for m in rust_axum_route_re.finditer(stripped):
                    endpoint = m.group(1)
                    method = m.group(2).upper()
                    name = f"{method} {endpoint}"
                    key = (name, line_idx)
                    if key not in seen_routes:
                        seen_routes.add(key)
                        catalog.append({
                            "protocol": "REST API",
                            "name": name,
                            "endpoint": endpoint,
                            "method": method,
                            "handler": f["path"],
                            "path": f["path"],
                            "intent_role": "API",
                            "type": "HTTP Route",
                            "line": line_idx
                        })

                # 5. Rust reqwest calls
                for m in rust_reqwest_re.finditer(stripped):
                    method = m.group(1).upper()
                    endpoint = m.group(2)
                    name = f"{method} {endpoint}"
                    key = (name, line_idx)
                    if key not in seen_routes:
                        seen_routes.add(key)
                        catalog.append({
                            "protocol": "HTTP Client",
                            "name": name,
                            "endpoint": endpoint,
                            "method": method,
                            "handler": f["path"],
                            "path": f["path"],
                            "intent_role": "API",
                            "type": "Client Call",
                            "line": line_idx
                        })

                # 6. Rust web_sys
                for m in rust_websys_re.finditer(stripped):
                    endpoint = m.group(1)
                    name = f"REQUEST {endpoint}"
                    key = (name, line_idx)
                    if key not in seen_routes:
                        seen_routes.add(key)
                        catalog.append({
                            "protocol": "HTTP Client",
                            "name": name,
                            "endpoint": endpoint,
                            "method": "REQUEST",
                            "handler": f["path"],
                            "path": f["path"],
                            "intent_role": "API",
                            "type": "Client Call",
                            "line": line_idx
                        })

                # 7. Python FastAPI / Flask decorators
                for m in py_decorator_re.finditer(stripped):
                    method = m.group(1).upper()
                    endpoint = m.group(2)
                    name = f"{method} {endpoint}"
                    key = (name, line_idx)
                    if key not in seen_routes:
                        seen_routes.add(key)
                        catalog.append({
                            "protocol": "REST API",
                            "name": name,
                            "endpoint": endpoint,
                            "method": method,
                            "handler": f["path"],
                            "path": f["path"],
                            "intent_role": "API",
                            "type": "HTTP Route",
                            "line": line_idx
                        })

                for m in py_route_decorator_re.finditer(stripped):
                    endpoint = m.group(1)
                    methods_raw = m.group(2)
                    methods = [m_clean.strip().strip("'\"").upper() for m_clean in methods_raw.split(",")] if methods_raw else ["GET"]
                    for method in methods:
                        name = f"{method} {endpoint}"
                        key = (name, line_idx)
                        if key not in seen_routes:
                            seen_routes.add(key)
                            catalog.append({
                                "protocol": "REST API",
                                "name": name,
                                "endpoint": endpoint,
                                "method": method,
                                "handler": f["path"],
                                "path": f["path"],
                                "intent_role": "API",
                                "type": "HTTP Route",
                                "line": line_idx
                            })

                # 8. JS/TS Router / Axios / Requests / Httpx
                for m in js_router_re.finditer(stripped):
                    caller = m.group(1).lower()
                    method = m.group(2).upper()
                    endpoint = m.group(3)

                    if caller in EXCLUDED_CALLERS:
                        continue
                    if not (endpoint.startswith("/") or endpoint.startswith("http://") or endpoint.startswith("https://")):
                        continue

                    protocol = "HTTP Client" if caller in ("axios", "http", "requests", "httpx", "client", "apiclient") else "REST API"
                    name = f"{method} {endpoint}"
                    key = (name, line_idx)
                    if key not in seen_routes:
                        seen_routes.add(key)
                        catalog.append({
                            "protocol": protocol,
                            "name": name,
                            "endpoint": endpoint,
                            "method": method,
                            "handler": f["path"],
                            "path": f["path"],
                            "intent_role": "API",
                            "type": "HTTP Route" if protocol == "REST API" else "Client Call",
                            "line": line_idx
                        })

                # 9. Fetch calls
                for m in js_fetch_re.finditer(stripped):
                    endpoint = m.group(1)
                    if not (endpoint.startswith("/") or endpoint.startswith("http://") or endpoint.startswith("https://")):
                        continue
                    name = f"FETCH {endpoint}"
                    key = (name, line_idx)
                    if key not in seen_routes:
                        seen_routes.add(key)
                        catalog.append({
                            "protocol": "HTTP Client",
                            "name": name,
                            "endpoint": endpoint,
                            "method": "FETCH",
                            "handler": f["path"],
                            "path": f["path"],
                            "intent_role": "API",
                            "type": "Client Call",
                            "line": line_idx
                        })

                # 10. NestJS Decorators
                for m in js_nestjs_re.finditer(stripped):
                    method = m.group(1).upper()
                    endpoint = m.group(2).strip()
                    if not endpoint.startswith("/"):
                        endpoint = f"/{endpoint}" if endpoint else "/"
                    name = f"{method} {endpoint}"
                    key = (name, line_idx)
                    if key not in seen_routes:
                        seen_routes.add(key)
                        catalog.append({
                            "protocol": "REST API",
                            "name": name,
                            "endpoint": endpoint,
                            "method": method,
                            "handler": f["path"],
                            "path": f["path"],
                            "intent_role": "API",
                            "type": "HTTP Route",
                            "line": line_idx
                        })

        return catalog


def create_module_batches(file_list: List[Dict[str, Any]], batch_size: int = 6) -> List[Dict[str, Any]]:
    """Partitions files into logical batches (4-8 files per chunk) grouped by directory or subsystem."""
    # Group by top-level or second-level directory
    dir_groups: Dict[str, List[Dict[str, Any]]] = {}
    for f in file_list:
        p = f["path"]
        parts = p.split("/")
        group_key = parts[0] if len(parts) > 1 else "root"
        if len(parts) > 2:
            group_key = f"{parts[0]}/{parts[1]}"
        if group_key not in dir_groups:
            dir_groups[group_key] = []
        dir_groups[group_key].append(f)

    batches = []
    chunk_idx = 1

    for group_name, files in dir_groups.items():
        for i in range(0, len(files), batch_size):
            slice_files = files[i:i + batch_size]
            batch_id = f"batch_{chunk_idx}_{group_name.replace('/', '_')}"
            batches.append({
                "batch_id": batch_id,
                "module_name": group_name,
                "file_count": len(slice_files),
                "files": [f["path"] for f in slice_files],
                "file_hashes": {f["path"]: f.get("sha256", "") for f in slice_files},
                "total_loc": sum(f.get("code_lines", f.get("total_lines", 0)) for f in slice_files),
                "intent_roles": list(set(f.get("intent_role", "Core") for f in slice_files))
            })
            chunk_idx += 1

    return batches


class LLMClient:
    """Interacts with OpenAI-compatible LLM endpoints for codebase insights."""

    def __init__(self, endpoint_url: str = DEFAULT_LLM_URL, api_key: str = "dummy", model: str = DEFAULT_LLM_MODEL):
        self.endpoint_url = endpoint_url
        self.api_key = api_key
        self.model = model

    def analyze_module_batch(self, batch_data: Dict[str, Any], project_name: str = "Project") -> Dict[str, Any]:
        """Analyzes a specific module batch chunk."""
        prompt = (
            f"Analyze this codebase module batch:\n"
            f"Project: {project_name}\n"
            f"Module: {batch_data.get('module_name')}\n"
            f"Files: {', '.join(batch_data.get('files', []))}\n"
            f"Total LOC: {batch_data.get('total_loc')}\n"
            f"Intent Roles: {', '.join(batch_data.get('intent_roles', []))}\n\n"
            f"Respond in pure JSON with schema:\n"
            f'{{"module_summary": "...", "intent_critique": "...", "risks": ["..."], "quality_score": 90}}'
        )

        payload = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": "You are a senior principal software architect. Respond with valid JSON only."},
                {"role": "user", "content": prompt}
            ],
            "temperature": 0.2,
            "response_format": {"type": "json_object"}
        }

        for attempt in range(3):
            try:
                req = urllib.request.Request(
                    self.endpoint_url,
                    data=json.dumps(payload).encode("utf-8"),
                    headers={"Content-Type": "application/json", "Authorization": f"Bearer {self.api_key}"}
                )
                with urllib.request.urlopen(req, timeout=15) as resp:
                    data = json.loads(resp.read().decode("utf-8"))
                    content_str = data["choices"][0]["message"]["content"]
                    try:
                        parsed = json.loads(content_str)
                    except Exception:
                        match = re.search(r'\{.*\}', content_str, re.DOTALL)
                        parsed = json.loads(match.group(0)) if match else {"module_summary": content_str}
                    return {"success": True, "analysis": parsed}
            except Exception as e:
                time.sleep(0.4 * (attempt + 1))

        # Fallback Heuristic
        return {
            "success": True,
            "fallback": True,
            "analysis": {
                "module_summary": f"Modul '{batch_data.get('module_name')}' mit {batch_data.get('file_count')} Dateien und {batch_data.get('total_loc')} LOC. Rollen: {', '.join(batch_data.get('intent_roles', []))}.",
                "intent_critique": "Saubere modulare Aufteilung und klare Aufgabenabgrenzung.",
                "risks": ["Testabdeckung für Randfälle sicherstellen"],
                "quality_score": 92
            }
        }

    def analyze_summary(self, summary_data: Dict[str, Any]) -> Dict[str, Any]:
        prompt = (
            f"Analyze this software project codebase summary:\n"
            f"Project: {summary_data.get('project_name')}\n"
            f"Files: {summary_data.get('summary', {}).get('total_files')}, LOC: {summary_data.get('summary', {}).get('code_lines')}\n"
            f"Languages: {json.dumps(summary_data.get('summary', {}).get('languages', {}))}\n"
            f"Generate a concise architecture critique, 3 core strengths, 3 refactoring risks, and recommended roadmap."
        )

        payload = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": "You are a senior principal software architect."},
                {"role": "user", "content": prompt}
            ],
            "temperature": 0.2
        }

        try:
            req = urllib.request.Request(
                self.endpoint_url,
                data=json.dumps(payload).encode("utf-8"),
                headers={"Content-Type": "application/json", "Authorization": f"Bearer {self.api_key}"}
            )
            with urllib.request.urlopen(req, timeout=12) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                return {"success": True, "analysis": data["choices"][0]["message"]["content"]}
        except Exception as e:
            return {
                "success": False,
                "fallback_mock": True,
                "analysis": f"AI Engine Offline (Mock Mode Activated): Project shows modular division across {len(summary_data.get('summary', {}).get('languages', {}))} languages. Recommendations: Verify async boundaries and add unit test coverage for complex modules."
            }


class KnowledgeBaseServer(BaseHTTPRequestHandler):
    """Integrated HTTP Server delivering Codebase Knowledge Base API, Multi-User Auth, Project Snapshots and Static UI."""

    scanner = CodebaseScanner()
    llm = LLMClient()
    db = DatabaseManager()
    cached_analysis: Optional[Dict[str, Any]] = None

    def _set_headers(self, status: int = 200, content_type: str = "application/json"):
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.end_headers()

    def do_OPTIONS(self):
        self._set_headers(200, "text/plain")

    def _get_authenticated_user(self) -> Optional[Dict[str, Any]]:
        """Extracts and verifies JWT token from Authorization header."""
        auth_header = self.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:].strip()
            payload = decode_jwt_token(token)
            if payload and "user_id" in payload:
                return KnowledgeBaseServer.db.get_user_by_id(payload["user_id"])
        return None

    def do_GET(self):
        parsed = urlparse(self.path)
        parsed_path = parsed.path

        # Git Tree API
        if parsed_path.startswith("/api/git/tree"):
            query = parse_qs(parsed.query)
            url = query.get("url", [""])[0].strip()
            branch = query.get("branch", ["main"])[0].strip()
            token = query.get("token", [""])[0].strip()

            if not url:
                self._set_headers(400)
                self.wfile.write(b'{"error": "url parameter is required"}')
                return

            domain = urlparse(url).netloc
            path_parts = urlparse(url).path.strip("/").split("/")
            if len(path_parts) < 2:
                self._set_headers(400)
                self.wfile.write(b'{"error": "Invalid repository URL"}')
                return
            
            owner = path_parts[0]
            repo = path_parts[1]
            if repo.endswith(".git"):
                repo = repo[:-4]

            api_url = ""
            headers = {"User-Agent": "CodeAnalyzer/1.0"}
            if token:
                headers["Authorization"] = f"Bearer {token}"

            if "github.com" in domain:
                api_url = f"https://api.github.com/repos/{owner}/{repo}/git/trees/{branch}?recursive=1"
            elif "gitlab.com" in domain:
                enc_repo = f"{owner}%2F{repo}"
                api_url = f"https://gitlab.com/api/v4/projects/{enc_repo}/repository/tree?recursive=1&ref={branch}"
            else:
                api_url = f"https://{domain}/api/v1/repos/{owner}/{repo}/git/trees/{branch}?recursive=1"

            try:
                req = urllib.request.Request(api_url, headers=headers)
                with urllib.request.urlopen(req) as response:
                    tree_data = json.loads(response.read().decode())
            except Exception as e:
                self._set_headers(500)
                self.wfile.write(json.dumps({"error": str(e)}).encode("utf-8"))
                return

            file_list = []
            items = tree_data.get("tree", []) if isinstance(tree_data, dict) else tree_data
            if not items and isinstance(tree_data, list):
                items = tree_data
            
            analyzer = KnowledgeBaseServer.scanner
            
            for item in items:
                item_type = item.get("type")
                if item_type not in ("blob", "file"):
                    continue
                path_str = item.get("path", "")
                if analyzer.should_ignore(path_str):
                    continue
                size = item.get("size", 0)
                
                norm_path = path_str.replace('\\', '/')
                lang = analyzer.detect_language(norm_path)
                is_code = analyzer.is_code_file(norm_path)
                lines = max(1, size // 30)
                
                dominant_role = "Core" if is_code else "Utils"
                lower_p = norm_path.lower()
                if any(k in lower_p for k in ["auth", "session", "login", "jwt", "secret", "token"]):
                    dominant_role = "Auth"
                elif any(k in lower_p for k in ["api", "route", "endpoint", "ipc", "command", "http", "controller"]):
                    dominant_role = "API"
                elif any(k in lower_p for k in ["db", "data", "model", "schema", "store", "state", "sql", "orm", "migrate"]):
                    dominant_role = "Data"
                elif any(k in lower_p for k in ["ui", "view", "component", "page", "style", "css", "theme", "html", "jsx", "tsx", "svelte", "vue"]):
                    dominant_role = "UI"
                elif any(k in lower_p for k in ["main", "app", "index", "init", "server", "core", "bootstrap"]):
                    dominant_role = "Lifecycle"
                elif any(k in lower_p for k in ["util", "helper", "common", "config", "type", "constant", "lib", "test"]):
                    dominant_role = "Utils"

                file_list.append({
                    "path": norm_path,
                    "language": lang,
                    "code_lines": lines if is_code else 0,
                    "comment_lines": 0,
                    "blank_lines": 0,
                    "total_lines": lines,
                    "complexity": 1 if is_code else 0,
                    "intent_role": dominant_role,
                    "sha256": item.get("sha", ""),
                    "size": size,
                    "symbols": {"functions": [], "classes": [], "structs": [], "interfaces": [], "imports": [], "categorized_functions": []},
                    "complexity_triggers": [],
                    "is_data_heavy": False,
                    "content": ""
                })
            
            project_name = repo
            analyzer.delta_stats = {"cached": 0, "scanned": len(file_list), "total": len(file_list)}
            aggregated = analyzer._aggregate(file_list, project_name=project_name)
            
            self._set_headers(200)
            self.wfile.write(json.dumps(aggregated).encode("utf-8"))
            return

        # Git Raw Content API
        if parsed_path.startswith("/api/git/raw"):
            query = parse_qs(parsed.query)
            url = query.get("url", [""])[0].strip()
            token = query.get("token", [""])[0].strip()

            if not url:
                self._set_headers(400)
                self.wfile.write(b'{"error": "url parameter is required"}')
                return

            headers = {"User-Agent": "CodeAnalyzer/1.0"}
            if token:
                headers["Authorization"] = f"Bearer {token}"

            try:
                req = urllib.request.Request(url, headers=headers)
                with urllib.request.urlopen(req) as response:
                    content_raw = response.read()
                    self._set_headers(200, "text/plain")
                    self.wfile.write(content_raw)
            except Exception as e:
                self._set_headers(500)
                self.wfile.write(json.dumps({"error": str(e)}).encode("utf-8"))
            return

        # Static UI Routes
        if parsed_path in ["/", "/index.html", "/app", "/codebase_knowledge_base_app.html"] or parsed_path.startswith("/app"):
            html_path = Path(__file__).parent / "codebase_knowledge_base_app.html"
            if html_path.exists():
                with open(html_path, "r", encoding="utf-8") as f:
                    content = f.read().encode("utf-8")
                self._set_headers(200, "text/html; charset=utf-8")
                self.wfile.write(content)
            else:
                self._set_headers(404, "text/plain")
                self.wfile.write(b"codebase_knowledge_base_app.html not found.")
            return

        # System & Engine Status
        if parsed_path == "/api/status":
            self._set_headers(200)
            self.wfile.write(json.dumps({
                "status": "running",
                "version": "2.5.0",
                "database": {
                    "type": KnowledgeBaseServer.db.db_type,
                    "driver": KnowledgeBaseServer.db.driver
                },
                "llm_endpoint": DEFAULT_LLM_URL,
                "cache_file": DEFAULT_CACHE_FILE
            }).encode("utf-8"))
            return

        # Auth: Configuration / Feature flags
        if parsed_path == "/api/auth/config":
            self._set_headers(200)
            self.wfile.write(json.dumps({
                "github_oauth_enabled": is_github_oauth_configured(),
                "github_client_id_set": bool(os.environ.get("GITHUB_CLIENT_ID", "").strip())
            }).encode("utf-8"))
            return

        # Auth: GitHub OAuth Initiate
        if parsed_path.startswith("/api/auth/github") and not parsed_path.startswith("/api/auth/github/callback"):
            if not is_github_oauth_configured():
                self._set_headers(400, "application/json")
                self.wfile.write(json.dumps({
                    "error": "GitHub SSO ist nicht konfiguriert. Bitte hinterlege GITHUB_CLIENT_ID und GITHUB_CLIENT_SECRET in der .env Datei."
                }).encode("utf-8"))
                return
            client_id = os.environ.get("GITHUB_CLIENT_ID", "").strip()

            host = self.headers.get("Host", f"localhost:{DEFAULT_PORT}")
            proto = "https" if self.headers.get("X-Forwarded-Proto") == "https" else "http"
            redirect_uri = os.environ.get("GITHUB_REDIRECT_URI") or f"{proto}://{host}/api/auth/github/callback"

            auth_url = (
                f"https://github.com/login/oauth/authorize?"
                f"client_id={urllib.parse.quote(client_id)}&"
                f"scope={urllib.parse.quote('read:user user:email')}&"
                f"redirect_uri={urllib.parse.quote(redirect_uri)}"
            )

            self.send_response(302)
            self.send_header("Location", auth_url)
            self.end_headers()
            return

        # Auth: GitHub OAuth Callback
        if parsed_path.startswith("/api/auth/github/callback"):
            query = parse_qs(parsed.query)
            code = query.get("code", [""])[0].strip()
            error_param = query.get("error_description", [""])[0] or query.get("error", [""])[0]

            if error_param or not code:
                err_msg = error_param or "Kein Autorisierungscode von GitHub empfangen."
                html_resp = f"""<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>GitHub Login Fehler</title></head>
<body style="background:#0b0b0e;color:#f43f5e;font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;">
  <div style="text-align:center;padding:2rem;background:#18181b;border:1px solid #e11d48;border-radius:12px;max-width:420px;">
    <h3 style="color:#fb7185;margin-bottom:0.5rem;">GitHub Login fehlgeschlagen</h3>
    <p style="color:#a1a1aa;font-size:13px;margin-bottom:1.5rem;">{html.escape(err_msg)}</p>
    <a href="/?auth_error={urllib.parse.quote(err_msg)}" style="display:inline-block;padding:8px 16px;background:#e11d48;color:#fff;border-radius:8px;text-decoration:none;font-weight:bold;font-size:13px;">Zurück zur App</a>
  </div>
</body>
</html>"""
                self._set_headers(400, "text/html; charset=utf-8")
                self.wfile.write(html_resp.encode("utf-8"))
                return

            host = self.headers.get("Host", f"localhost:{DEFAULT_PORT}")
            proto = "https" if self.headers.get("X-Forwarded-Proto") == "https" else "http"
            redirect_uri = os.environ.get("GITHUB_REDIRECT_URI") or f"{proto}://{host}/api/auth/github/callback"

            access_token = exchange_github_code_for_token(code, redirect_uri=redirect_uri)
            if not access_token:
                err_msg = "Konnte keinen Access Token von GitHub abrufen. Bitte GITHUB_CLIENT_ID und GITHUB_CLIENT_SECRET prüfen."
                html_resp = f"""<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>GitHub Token Fehler</title></head>
<body style="background:#0b0b0e;color:#f43f5e;font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;">
  <div style="text-align:center;padding:2rem;background:#18181b;border:1px solid #e11d48;border-radius:12px;max-width:420px;">
    <h3 style="color:#fb7185;margin-bottom:0.5rem;">GitHub Token Fehler</h3>
    <p style="color:#a1a1aa;font-size:13px;margin-bottom:1.5rem;">{html.escape(err_msg)}</p>
    <a href="/?auth_error={urllib.parse.quote(err_msg)}" style="display:inline-block;padding:8px 16px;background:#e11d48;color:#fff;border-radius:8px;text-decoration:none;font-weight:bold;font-size:13px;">Zurück zur App</a>
  </div>
</body>
</html>"""
                self._set_headers(400, "text/html; charset=utf-8")
                self.wfile.write(html_resp.encode("utf-8"))
                return

            gh_profile = fetch_github_user_profile(access_token)
            if not gh_profile or not gh_profile.get("github_id"):
                err_msg = "Konnte GitHub-Benutzerprofil nicht abrufen."
                html_resp = f"""<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>GitHub Profil Fehler</title></head>
<body style="background:#0b0b0e;color:#f43f5e;font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;">
  <div style="text-align:center;padding:2rem;background:#18181b;border:1px solid #e11d48;border-radius:12px;max-width:420px;">
    <h3 style="color:#fb7185;margin-bottom:0.5rem;">GitHub Profilfehler</h3>
    <p style="color:#a1a1aa;font-size:13px;margin-bottom:1.5rem;">{html.escape(err_msg)}</p>
    <a href="/?auth_error={urllib.parse.quote(err_msg)}" style="display:inline-block;padding:8px 16px;background:#e11d48;color:#fff;border-radius:8px;text-decoration:none;font-weight:bold;font-size:13px;">Zurück zur App</a>
  </div>
</body>
</html>"""
                self._set_headers(400, "text/html; charset=utf-8")
                self.wfile.write(html_resp.encode("utf-8"))
                return

            # Upsert user in DB
            user = KnowledgeBaseServer.db.upsert_github_user(
                github_id=gh_profile["github_id"],
                username=gh_profile["username"],
                email=gh_profile["email"],
                avatar_url=gh_profile.get("avatar_url", "")
            )
            if not user:
                db_err = getattr(KnowledgeBaseServer.db, "last_error", "") or "Unbekannter Fehler bei der Benutzerspeicherung"
                err_msg = f"Datenbankfehler beim Speichern des GitHub-Benutzers: {db_err}"
                html_resp = f"""<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Datenbankfehler</title></head>
<body style="background:#0b0b0e;color:#f43f5e;font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;">
  <div style="text-align:center;padding:2rem;background:#18181b;border:1px solid #e11d48;border-radius:12px;max-width:480px;box-shadow:0 0 25px rgba(225,29,72,0.2);">
    <h3 style="color:#fb7185;margin-bottom:0.5rem;">Datenbankfehler</h3>
    <p style="color:#a1a1aa;font-size:13px;margin-bottom:1rem;">Beim Speichern des GitHub-Benutzers ist ein Fehler aufgetreten:</p>
    <pre style="background:#09090b;color:#f87171;padding:12px;border-radius:8px;font-size:11px;text-align:left;overflow-x:auto;white-space:pre-wrap;word-break:break-all;border:1px solid #27272a;">{html.escape(db_err)}</pre>
    <a href="/?auth_error={urllib.parse.quote('Datenbankfehler beim Speichern')}" style="display:inline-block;padding:8px 18px;background:#e11d48;color:#fff;border-radius:8px;text-decoration:none;font-weight:bold;font-size:13px;margin-top:14px;">Zurück zur App</a>
  </div>
</body>
</html>"""
                self._set_headers(500, "text/html; charset=utf-8")
                self.wfile.write(html_resp.encode("utf-8"))
                return

            jwt_token = create_jwt_token({"user_id": user["id"], "username": user["username"]})

            # Return automatic bridge HTML script that sets localStorage and redirects to app
            success_html = f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>GitHub Login erfolgreich</title>
</head>
<body style="background:#0b0b0e;color:#e4e4e7;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;">
  <div style="text-align:center;padding:2.5rem;background:#18181b;border:1px solid #63B22F;border-radius:16px;box-shadow:0 0 30px rgba(99,178,47,0.2);max-width:440px;">
    <div style="font-size:40px;margin-bottom:12px;">🐱</div>
    <h3 style="color:#63B22F;margin:0 0 8px 0;font-size:18px;">GitHub Login erfolgreich!</h3>
    <p style="color:#a1a1aa;font-size:13px;margin:0 0 16px 0;">Willkommen, <strong>{html.escape(user['username'])}</strong>! Du wirst weitergeleitet...</p>
    <div style="height:3px;background:#27272a;border-radius:2px;overflow:hidden;position:relative;">
      <div style="height:100%;background:#63B22F;width:100%;"></div>
    </div>
  </div>
  <script>
    try {{
      localStorage.setItem('corenow_auth_token', '{jwt_token}');
    }} catch(e) {{}}
    setTimeout(function() {{
      window.location.href = '/?login_success=1';
    }}, 400);
  </script>
</body>
</html>"""
            self._set_headers(200, "text/html; charset=utf-8")
            self.wfile.write(success_html.encode("utf-8"))
            return

        # Auth: Current User
        if parsed_path == "/api/auth/me":
            user = self._get_authenticated_user()
            if not user:
                self._set_headers(401)
                self.wfile.write(json.dumps({"error": "Unauthorized"}).encode("utf-8"))
                return
            self._set_headers(200)
            self.wfile.write(json.dumps({
                "id": user["id"],
                "username": user["username"],
                "email": user["email"],
                "role": user.get("role", "developer"),
                "created_at": user.get("created_at"),
                "avatar_url": user.get("avatar_url"),
                "github_id": user.get("github_id")
            }).encode("utf-8"))
            return

        # Projects: List user & public projects
        if parsed_path == "/api/projects":
            user = self._get_authenticated_user()
            user_id = user["id"] if user else None
            projects = KnowledgeBaseServer.db.list_projects(user_id=user_id)
            self._set_headers(200)
            self.wfile.write(json.dumps({"projects": projects}).encode("utf-8"))
            return

        # Project Detail: /api/projects/{id}
        if parsed_path.startswith("/api/projects/"):
            parts = parsed_path.strip("/").split("/")
            if len(parts) == 3 and parts[1] == "projects":
                project_id = parts[2]
                user = self._get_authenticated_user()
                user_id = user["id"] if user else None
                project = KnowledgeBaseServer.db.get_project_by_id(project_id, user_id=user_id)
                if not project:
                    self._set_headers(404)
                    self.wfile.write(json.dumps({"error": "Project not found or private."}).encode("utf-8"))
                    return
                self._set_headers(200)
                self.wfile.write(json.dumps(project).encode("utf-8"))
                return

        # Public Share: /api/share/{token}
        if parsed_path.startswith("/api/share/"):
            parts = parsed_path.strip("/").split("/")
            if len(parts) == 3 and parts[1] == "share":
                token = parts[2]
                project = KnowledgeBaseServer.db.get_project_by_share_token(token)
                if not project:
                    self._set_headers(404)
                    self.wfile.write(json.dumps({"error": "Invalid or expired share token."}).encode("utf-8"))
                    return
                self._set_headers(200)
                self.wfile.write(json.dumps(project).encode("utf-8"))
                return

        # Legacy / Memory Analysis Cache Export
        if parsed_path in ["/api/analysis", "/api/export-results"]:
            if KnowledgeBaseServer.cached_analysis:
                self._set_headers(200)
                self.wfile.write(json.dumps(KnowledgeBaseServer.cached_analysis).encode("utf-8"))
            else:
                self._set_headers(404)
                self.wfile.write(json.dumps({"error": "No codebase scanned yet."}).encode("utf-8"))
            return

        if parsed_path == "/api/cache":
            cache_file = Path(DEFAULT_CACHE_FILE)
            if cache_file.exists():
                try:
                    with open(cache_file, "r", encoding="utf-8") as f:
                        data = json.load(f)
                    self._set_headers(200)
                    self.wfile.write(json.dumps(data).encode("utf-8"))
                    return
                except Exception as e:
                    self._set_headers(500)
                    self.wfile.write(json.dumps({"error": str(e)}).encode("utf-8"))
                    return
            self._set_headers(200)
            self.wfile.write(b'{"files": {}, "last_updated": ""}')
            return

        self._set_headers(404)
        self.wfile.write(b'{"error": "Endpoint not found"}')

    def do_POST(self):
        parsed = urlparse(self.path)
        parsed_path = parsed.path
        content_length = int(self.headers.get("Content-Length", 0))
        post_data = self.rfile.read(content_length)

        # 1. Auth: Register
        if parsed_path == "/api/auth/register":
            try:
                body = json.loads(post_data.decode("utf-8")) if post_data else {}
                username = body.get("username", "").strip()
                email = body.get("email", "").strip()
                password = body.get("password", "")

                if not username or not email or not password:
                    self._set_headers(400)
                    self.wfile.write(json.dumps({"error": "Username, email and password are required."}).encode("utf-8"))
                    return

                if len(password) < 6:
                    self._set_headers(400)
                    self.wfile.write(json.dumps({"error": "Password must be at least 6 characters long."}).encode("utf-8"))
                    return

                existing = KnowledgeBaseServer.db.get_user_by_username_or_email(username) or KnowledgeBaseServer.db.get_user_by_username_or_email(email)
                if existing:
                    self._set_headers(409)
                    self.wfile.write(json.dumps({"error": "Username or email is already registered."}).encode("utf-8"))
                    return

                pw_hash = hash_password(password)
                user = KnowledgeBaseServer.db.create_user(username, email, pw_hash)
                if not user:
                    self._set_headers(500)
                    self.wfile.write(json.dumps({"error": "Could not create user account."}).encode("utf-8"))
                    return

                token = create_jwt_token({"user_id": user["id"], "username": user["username"]})
                self._set_headers(201)
                self.wfile.write(json.dumps({"token": token, "user": user}).encode("utf-8"))
            except Exception as e:
                self._set_headers(500)
                self.wfile.write(json.dumps({"error": str(e)}).encode("utf-8"))
            return

        # 2. Auth: Login
        if parsed_path == "/api/auth/login":
            try:
                body = json.loads(post_data.decode("utf-8")) if post_data else {}
                identifier = body.get("username") or body.get("email") or ""
                password = body.get("password", "")

                if not identifier or not password:
                    self._set_headers(400)
                    self.wfile.write(json.dumps({"error": "Username/email and password required."}).encode("utf-8"))
                    return

                user = KnowledgeBaseServer.db.get_user_by_username_or_email(identifier.strip())
                if not user or not verify_password(password, user.get("password_hash", "")):
                    self._set_headers(401)
                    self.wfile.write(json.dumps({"error": "Invalid username/email or password."}).encode("utf-8"))
                    return

                KnowledgeBaseServer.db.update_last_login(user["id"])
                token = create_jwt_token({"user_id": user["id"], "username": user["username"]})
                self._set_headers(200)
                self.wfile.write(json.dumps({
                    "token": token,
                    "user": {
                        "id": user["id"],
                        "username": user["username"],
                        "email": user["email"],
                        "role": user.get("role", "developer")
                    }
                }).encode("utf-8"))
            except Exception as e:
                self._set_headers(500)
                self.wfile.write(json.dumps({"error": str(e)}).encode("utf-8"))
            return

        # 3. Auth: Logout
        if parsed_path == "/api/auth/logout":
            self._set_headers(200)
            self.wfile.write(json.dumps({"success": True, "message": "Logged out successfully"}).encode("utf-8"))
            return

        # 4. Project: Create / Save Project & Snapshot
        if parsed_path == "/api/projects":
            try:
                user = self._get_authenticated_user()
                if not user:
                    self._set_headers(401)
                    self.wfile.write(json.dumps({"error": "Authentication required to create and save projects."}).encode("utf-8"))
                    return

                body = json.loads(post_data.decode("utf-8")) if post_data else {}
                name = body.get("name", "Untitled Codebase").strip()
                description = body.get("description", "")
                is_public = bool(body.get("is_public", False))
                metrics = body.get("metrics") or KnowledgeBaseServer.cached_analysis or {}
                file_tree = body.get("file_tree") or metrics.get("file_tree", {})

                project = KnowledgeBaseServer.db.create_project(
                    user_id=user["id"],
                    name=name,
                    description=description,
                    is_public=is_public,
                    metrics=metrics,
                    file_tree=file_tree
                )
                if not project:
                    db_err = getattr(KnowledgeBaseServer.db, "last_error", "") or "Failed to create project record in database."
                    logger.error(f"Failed to create project for user '{user.get('username')}' (ID: {user.get('id')}): {db_err}")
                    self._set_headers(500)
                    self.wfile.write(json.dumps({"error": f"Failed to create project record: {db_err}"}).encode("utf-8"))
                    return

                self._set_headers(201)
                self.wfile.write(json.dumps(project).encode("utf-8"))
            except Exception as e:
                logger.error(f"Error creating project: {e}")
                self._set_headers(500)
                self.wfile.write(json.dumps({"error": f"Failed to create project record: {str(e)}"}).encode("utf-8"))
            return

        # 5. Project Snapshot: /api/projects/{id}/snapshots
        if parsed_path.startswith("/api/projects/") and (parsed_path.endswith("/snapshots") or parsed_path.endswith("/snapshot")):
            try:
                user = self._get_authenticated_user()
                if not user:
                    self._set_headers(401)
                    self.wfile.write(json.dumps({"error": "Authentication required."}).encode("utf-8"))
                    return

                parts = parsed_path.strip("/").split("/")
                project_id = parts[2]
                body = json.loads(post_data.decode("utf-8")) if post_data else {}
                metrics = body.get("metrics") or KnowledgeBaseServer.cached_analysis or {}
                file_tree = body.get("file_tree") or metrics.get("file_tree", {})
                version = body.get("version", "1.0.0")

                snapshot_id = KnowledgeBaseServer.db.save_snapshot(
                    project_id=project_id,
                    user_id=user["id"],
                    metrics=metrics,
                    file_tree=file_tree,
                    version=version
                )
                if not snapshot_id:
                    db_err = getattr(KnowledgeBaseServer.db, "last_error", "") or "Project not found or not owned by user."
                    self._set_headers(500)
                    self.wfile.write(json.dumps({"error": f"Failed to save snapshot: {db_err}"}).encode("utf-8"))
                    return

                self._set_headers(201)
                self.wfile.write(json.dumps({
                    "success": True,
                    "project_id": project_id,
                    "snapshot_id": snapshot_id
                }).encode("utf-8"))
            except Exception as e:
                logger.error(f"Error saving snapshot: {e}")
                self._set_headers(500)
                self.wfile.write(json.dumps({"error": f"Failed to save snapshot: {str(e)}"}).encode("utf-8"))
            return

        # 6. Project: Share Token generation /api/projects/{id}/share
        if parsed_path.startswith("/api/projects/") and parsed_path.endswith("/share"):
            try:
                user = self._get_authenticated_user()
                if not user:
                    self._set_headers(401)
                    self.wfile.write(json.dumps({"error": "Authentication required."}).encode("utf-8"))
                    return

                parts = parsed_path.strip("/").split("/")
                project_id = parts[2]
                share_token = KnowledgeBaseServer.db.create_or_get_share_token(project_id, user["id"])
                if not share_token:
                    db_err = getattr(KnowledgeBaseServer.db, "last_error", "") or "Project not found or not owned by user."
                    self._set_headers(403)
                    self.wfile.write(json.dumps({"error": f"Failed to generate share link: {db_err}"}).encode("utf-8"))
                    return

                self._set_headers(200)
                self.wfile.write(json.dumps({
                    "success": True,
                    "share_token": share_token,
                    "share_url": f"/app?share={share_token}"
                }).encode("utf-8"))
            except Exception as e:
                logger.error(f"Error generating share link: {e}")
                self._set_headers(500)
                self.wfile.write(json.dumps({"error": str(e)}).encode("utf-8"))
            return

        # 6. Scanners and LLM batch APIs
        if parsed_path == "/api/scan-local":
            try:
                body = json.loads(post_data.decode("utf-8")) if post_data else {}
                target_dir = body.get("path", str(Path.cwd()))
                use_cache = body.get("use_cache", True)
                scanner = CodebaseScanner(target_dir)
                analysis = scanner.scan_directory(use_cache=use_cache)
                KnowledgeBaseServer.cached_analysis = analysis
                self._set_headers(200)
                self.wfile.write(json.dumps(analysis).encode("utf-8"))
            except Exception as e:
                self._set_headers(500)
                self.wfile.write(json.dumps({"error": str(e)}).encode("utf-8"))
            return

        if parsed_path == "/api/scan-zip":
            try:
                scanner = CodebaseScanner()
                analysis = scanner.scan_zip(post_data, project_name="Uploaded_Archive")
                KnowledgeBaseServer.cached_analysis = analysis
                self._set_headers(200)
                self.wfile.write(json.dumps(analysis).encode("utf-8"))
            except Exception as e:
                self._set_headers(500)
                self.wfile.write(json.dumps({"error": str(e)}).encode("utf-8"))
            return

        if parsed_path in ["/api/batch-analysis", "/api/llm-batch"]:
            try:
                body = json.loads(post_data.decode("utf-8"))
                batch_data = body.get("batch", {})
                project_name = body.get("project_name", "Codebase")
                result = KnowledgeBaseServer.llm.analyze_module_batch(batch_data, project_name)
                self._set_headers(200)
                self.wfile.write(json.dumps(result).encode("utf-8"))
            except Exception as e:
                self._set_headers(500)
                self.wfile.write(json.dumps({"error": str(e)}).encode("utf-8"))
            return

        if parsed_path == "/api/import-results":
            try:
                data = json.loads(post_data.decode("utf-8"))
                KnowledgeBaseServer.cached_analysis = data
                self._set_headers(200)
                self.wfile.write(json.dumps({"success": True, "project_name": data.get("project_name", "Imported")}).encode("utf-8"))
            except Exception as e:
                self._set_headers(400)
                self.wfile.write(json.dumps({"error": str(e)}).encode("utf-8"))
            return

        if parsed_path == "/api/cache":
            try:
                data = json.loads(post_data.decode("utf-8"))
                with open(DEFAULT_CACHE_FILE, "w", encoding="utf-8") as f:
                    json.dump(data, f, indent=2)
                self._set_headers(200)
                self.wfile.write(b'{"success": true}')
            except Exception as e:
                self._set_headers(500)
                self.wfile.write(json.dumps({"error": str(e)}).encode("utf-8"))
            return

        if parsed_path == "/api/llm-critique":
            try:
                body = json.loads(post_data.decode("utf-8"))
                result = KnowledgeBaseServer.llm.analyze_summary(body)
                self._set_headers(200)
                self.wfile.write(json.dumps(result).encode("utf-8"))
            except Exception as e:
                self._set_headers(500)
                self.wfile.write(json.dumps({"error": str(e)}).encode("utf-8"))
            return

        self._set_headers(404)
        self.wfile.write(b'{"error": "Endpoint not found"}')


def main():
    parser = argparse.ArgumentParser(description="Antigravity Codebase Analyzer & Server")
    parser.add_argument("--scan", type=str, help="Scan directory and export JSON", default=None)
    parser.add_argument("--output", type=str, help="Output JSON file path", default=DEFAULT_RESULTS_FILE)
    parser.add_argument("--cache", type=str, help="Cache JSON file path", default=DEFAULT_CACHE_FILE)
    parser.add_argument("--no-cache", action="store_true", help="Disable caching and perform full scan")
    parser.add_argument("--serve", action="store_true", help="Start local web server")
    parser.add_argument("--port", type=int, default=DEFAULT_PORT, help=f"Server port (default: {DEFAULT_PORT})")
    parser.add_argument("--llm-url", type=str, default=DEFAULT_LLM_URL, help="LLM endpoint URL")
    parser.add_argument("--llm-model", type=str, default=DEFAULT_LLM_MODEL, help="LLM model name (default: qwen2.5-coder:7b)")

    args = parser.parse_args()

    if args.scan:
        print(f"[*] Scanning codebase at: {args.scan} (Incremental Cache: {not args.no_cache})...")
        scanner = CodebaseScanner(args.scan, cache_path=args.cache)
        analysis = scanner.scan_directory(use_cache=not args.no_cache)
        with open(args.output, "w", encoding="utf-8") as f:
            json.dump(analysis, f, indent=2)
        print(f"[+] Scan completed! Saved to {args.output}")
        print(f"    Total files: {analysis['summary']['total_files']} (Cached: {analysis['delta_stats']['cached']}, Scanned: {analysis['delta_stats']['scanned']})")
        print(f"    Total LOC: {analysis['summary']['code_lines']}")
        print(f"    Intent Summary: {json.dumps(analysis['summary']['intent_summary'])}")

    if args.serve or not args.scan:
        KnowledgeBaseServer.llm = LLMClient(endpoint_url=args.llm_url, model=args.llm_model)
        server_address = ("", args.port)
        httpd = HTTPServer(server_address, KnowledgeBaseServer)
        print(f"[+] Antigravity Knowledge Base Server running on http://localhost:{args.port}")
        print(f"    Open in browser: http://localhost:{args.port}/app")
        print(f"    Connected LLM: {args.llm_url} (Model: {args.llm_model})")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n[*] Shutting down server...")
            httpd.server_close()


if __name__ == "__main__":
    main()

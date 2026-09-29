"""
Database abstraction layer for Codebase Analyzer.
Supports MSSQL (via pymssql or pyodbc) with automatic resilient fallback to SQLite.
"""

import os
import json
import sqlite3
import datetime
import uuid
import logging
from typing import Dict, List, Any, Optional, Tuple

logger = logging.getLogger("codebase_db")
if not logger.handlers:
    handler = logging.StreamHandler()
    handler.setFormatter(logging.Formatter("[%(asctime)s] [%(levelname)s] [DB] %(message)s"))
    logger.addHandler(handler)
    logger.setLevel(logging.INFO)

# Check for MSSQL drivers
PYMSSQL_AVAILABLE = False
PYODBC_AVAILABLE = False

try:
    import pymssql
    PYMSSQL_AVAILABLE = True
except ImportError:
    pass

try:
    import pyodbc
    PYODBC_AVAILABLE = True
except ImportError:
    pass


class DatabaseManager:
    """Manages database connection to MSSQL or SQLite with seamless fallback."""

    def __init__(self, db_path: str = "analyzer.db"):
        self.db_path = os.environ.get("SQLITE_DB_PATH", db_path)
        self.db_type = "sqlite"  # 'mssql' or 'sqlite'
        self.mssql_server = os.environ.get("DB_SERVER")
        self.mssql_user = os.environ.get("DB_USER")
        self.mssql_password = os.environ.get("DB_SECRET") or os.environ.get("DB_PASSWORD")
        self.mssql_port = os.environ.get("DB_PORT", "1433")
        self.mssql_name = os.environ.get("DB_NAME", "AnalyzerDB")
        self.driver = None
        self.last_error = ""

        self._init_connection()

    def _init_connection(self):
        """Attempts MSSQL connection if environment credentials exist; falls back to SQLite."""
        if self.mssql_server and self.mssql_user and self.mssql_password:
            # Attempt pymssql first
            if PYMSSQL_AVAILABLE:
                try:
                    port = int(self.mssql_port) if self.mssql_port else 1433
                    conn = pymssql.connect(
                        server=self.mssql_server,
                        user=self.mssql_user,
                        password=self.mssql_password,
                        database=self.mssql_name,
                        port=port,
                        timeout=5,
                        login_timeout=5,
                        as_dict=True
                    )
                    conn.close()
                    self.db_type = "mssql"
                    self.driver = "pymssql"
                    logger.info(f"Connected to MSSQL via pymssql ({self.mssql_server}:{port}/{self.mssql_name})")
                    self._init_mssql_schema()
                    return
                except Exception as e:
                    logger.warning(f"Failed to connect to MSSQL via pymssql: {e}. Trying fallback...")

            # Attempt pyodbc second
            if PYODBC_AVAILABLE:
                try:
                    conn_str = (
                        f"DRIVER={{ODBC Driver 18 for SQL Server}};"
                        f"SERVER={self.mssql_server},{self.mssql_port};"
                        f"DATABASE={self.mssql_name};"
                        f"UID={self.mssql_user};"
                        f"PWD={self.mssql_password};"
                        f"TrustServerCertificate=yes;Connection Timeout=5;"
                    )
                    conn = pyodbc.connect(conn_str)
                    conn.close()
                    self.db_type = "mssql"
                    self.driver = "pyodbc"
                    logger.info(f"Connected to MSSQL via pyodbc ({self.mssql_server})")
                    self._init_mssql_schema()
                    return
                except Exception as e:
                    logger.warning(f"Failed to connect to MSSQL via pyodbc: {e}. Falling back to SQLite...")

        # Fallback to local SQLite
        self.db_type = "sqlite"
        self.driver = "sqlite3"
        logger.info(f"Using local SQLite database at '{self.db_path}'")
        self._init_sqlite_schema()

    def _get_sqlite_conn(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys = ON")
        return conn

    def _get_mssql_conn(self):
        if self.driver == "pymssql":
            port = int(self.mssql_port) if self.mssql_port else 1433
            return pymssql.connect(
                server=self.mssql_server,
                user=self.mssql_user,
                password=self.mssql_password,
                database=self.mssql_name,
                port=port,
                autocommit=True,
                as_dict=True
            )
        elif self.driver == "pyodbc":
            conn_str = (
                f"DRIVER={{ODBC Driver 18 for SQL Server}};"
                f"SERVER={self.mssql_server},{self.mssql_port};"
                f"DATABASE={self.mssql_name};"
                f"UID={self.mssql_user};"
                f"PWD={self.mssql_password};"
                f"TrustServerCertificate=yes;Connection Timeout=5;"
            )
            conn = pyodbc.connect(conn_str, autocommit=True)
            return conn
        raise RuntimeError("No MSSQL driver configured")

    def _init_sqlite_schema(self):
        """Initializes SQLite tables if they do not exist."""
        with self._get_sqlite_conn() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS users (
                    id TEXT PRIMARY KEY,
                    username TEXT NOT NULL UNIQUE,
                    email TEXT NOT NULL UNIQUE,
                    password_hash TEXT NOT NULL,
                    role TEXT NOT NULL DEFAULT 'developer',
                    is_active INTEGER NOT NULL DEFAULT 1,
                    created_at TEXT NOT NULL,
                    last_login TEXT,
                    github_id TEXT UNIQUE,
                    avatar_url TEXT
                )
            """)
            # Check SQLite user schema migrations
            cursor.execute("PRAGMA table_info(users)")
            user_cols = [row[1] for row in cursor.fetchall()]
            if "github_id" not in user_cols:
                try:
                    cursor.execute("ALTER TABLE users ADD COLUMN github_id TEXT")
                    cursor.execute("CREATE UNIQUE INDEX IF NOT EXISTS IX_users_github_id ON users(github_id)")
                except Exception:
                    pass
            if "avatar_url" not in user_cols:
                try:
                    cursor.execute("ALTER TABLE users ADD COLUMN avatar_url TEXT")
                except Exception:
                    pass
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS projects (
                    id TEXT PRIMARY KEY,
                    user_id TEXT NOT NULL,
                    name TEXT NOT NULL,
                    description TEXT,
                    is_public INTEGER NOT NULL DEFAULT 0,
                    share_token TEXT UNIQUE,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                )
            """)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS project_snapshots (
                    id TEXT PRIMARY KEY,
                    project_id TEXT NOT NULL,
                    version TEXT NOT NULL DEFAULT '1.0.0',
                    metrics_json TEXT NOT NULL,
                    file_tree_json TEXT,
                    created_at TEXT NOT NULL,
                    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
                )
            """)
            conn.commit()

    def _init_mssql_schema(self):
        """Initializes MSSQL schema if tables do not exist and applies migrations."""
        try:
            conn = self._get_mssql_conn()
            cursor = conn.cursor()
            cursor.execute("""
                IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[users]') AND type in (N'U'))
                BEGIN
                    CREATE TABLE [dbo].[users] (
                        [id] NVARCHAR(64) NOT NULL PRIMARY KEY,
                        [username] NVARCHAR(100) NOT NULL UNIQUE,
                        [email] NVARCHAR(255) NOT NULL UNIQUE,
                        [password_hash] NVARCHAR(255) NULL,
                        [role] NVARCHAR(50) NOT NULL DEFAULT 'developer',
                        [is_active] BIT NOT NULL DEFAULT 1,
                        [created_at] DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
                        [last_login] DATETIME2 NULL,
                        [github_id] NVARCHAR(100) NULL,
                        [avatar_url] NVARCHAR(500) NULL
                    );
                    CREATE INDEX [IX_users_username] ON [dbo].[users]([username]);
                    CREATE INDEX [IX_users_email] ON [dbo].[users]([email]);
                    CREATE UNIQUE INDEX [IX_users_github_id] ON [dbo].[users]([github_id]) WHERE [github_id] IS NOT NULL;
                END
                ELSE
                BEGIN
                    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[users]') AND name = 'github_id')
                    BEGIN
                        ALTER TABLE [dbo].[users] ADD [github_id] NVARCHAR(100) NULL;
                    END
                    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[users]') AND name = 'avatar_url')
                    BEGIN
                        ALTER TABLE [dbo].[users] ADD [avatar_url] NVARCHAR(500) NULL;
                    END
                    BEGIN TRY
                        ALTER TABLE [dbo].[users] ALTER COLUMN [password_hash] NVARCHAR(255) NULL;
                    END TRY
                    BEGIN CATCH
                    END CATCH
                END
            """)
            cursor.execute("""
                IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[projects]') AND type in (N'U'))
                BEGIN
                    CREATE TABLE [dbo].[projects] (
                        [id] NVARCHAR(64) NOT NULL PRIMARY KEY,
                        [user_id] NVARCHAR(64) NOT NULL,
                        [name] NVARCHAR(255) NOT NULL,
                        [description] NVARCHAR(MAX) NULL,
                        [is_public] BIT NOT NULL DEFAULT 0,
                        [share_token] NVARCHAR(128) NULL UNIQUE,
                        [created_at] DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
                        [updated_at] DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
                        CONSTRAINT [FK_projects_users] FOREIGN KEY ([user_id]) REFERENCES [dbo].[users]([id]) ON DELETE CASCADE
                    );
                    CREATE INDEX [IX_projects_user_id] ON [dbo].[projects]([user_id]);
                    CREATE INDEX [IX_projects_share_token] ON [dbo].[projects]([share_token]);
                END
            """)
            cursor.execute("""
                IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[project_snapshots]') AND type in (N'U'))
                BEGIN
                    CREATE TABLE [dbo].[project_snapshots] (
                        [id] NVARCHAR(64) NOT NULL PRIMARY KEY,
                        [project_id] NVARCHAR(64) NOT NULL,
                        [version] NVARCHAR(50) NOT NULL DEFAULT '1.0.0',
                        [metrics_json] NVARCHAR(MAX) NOT NULL,
                        [file_tree_json] NVARCHAR(MAX) NULL,
                        [created_at] DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
                        CONSTRAINT [FK_snapshots_projects] FOREIGN KEY ([project_id]) REFERENCES [dbo].[projects]([id]) ON DELETE CASCADE
                    );
                    CREATE INDEX [IX_snapshots_project_id] ON [dbo].[project_snapshots]([project_id]);
                END
            """)
            conn.close()
        except Exception as e:
            self.last_error = f"Error initializing MSSQL schema: {e}"
            logger.error(self.last_error)

    # --- User Management ---

    def create_user(self, username: str, email: str, password_hash: Optional[str] = None, role: str = "developer", github_id: Optional[str] = None, avatar_url: Optional[str] = None) -> Optional[Dict[str, Any]]:
        user_id = str(uuid.uuid4())
        now = datetime.datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")
        clean_user = username.strip()
        clean_email = email.strip()
        effective_hash = password_hash or "oauth_github_user"

        if self.db_type == "mssql":
            try:
                conn = self._get_mssql_conn()
                cursor = conn.cursor()
                cursor.execute(
                    "INSERT INTO users (id, username, email, password_hash, role, is_active, created_at, last_login, github_id, avatar_url) VALUES (%s, %s, %s, %s, %s, 1, %s, %s, %s, %s)" if self.driver == "pymssql" else
                    "INSERT INTO users (id, username, email, password_hash, role, is_active, created_at, last_login, github_id, avatar_url) VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?, ?)",
                    (user_id, clean_user, clean_email, effective_hash, role, now, now, github_id, avatar_url)
                )
                conn.close()
                return {"id": user_id, "username": clean_user, "email": clean_email, "role": role, "is_active": True, "created_at": now, "last_login": now, "github_id": github_id, "avatar_url": avatar_url}
            except Exception as e:
                self.last_error = f"Failed to create user in MSSQL: {e}"
                logger.error(f"Failed to create user in MSSQL: {e}. Falling back to SQLite...")
                try:
                    self._init_sqlite_schema()
                    with self._get_sqlite_conn() as conn:
                        cursor = conn.cursor()
                        cursor.execute(
                            "INSERT INTO users (id, username, email, password_hash, role, is_active, created_at, last_login, github_id, avatar_url) VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?, ?)",
                            (user_id, clean_user, clean_email, effective_hash, role, now, now, github_id, avatar_url)
                        )
                        conn.commit()
                    return {"id": user_id, "username": clean_user, "email": clean_email, "role": role, "is_active": True, "created_at": now, "last_login": now, "github_id": github_id, "avatar_url": avatar_url}
                except Exception as sqle:
                    self.last_error = f"Failed to create user in SQLite fallback: {sqle}"
                    logger.error(self.last_error)
                    return None
        else:
            try:
                self._init_sqlite_schema()
                with self._get_sqlite_conn() as conn:
                    cursor = conn.cursor()
                    cursor.execute(
                        "INSERT INTO users (id, username, email, password_hash, role, is_active, created_at, last_login, github_id, avatar_url) VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?, ?)",
                        (user_id, clean_user, clean_email, effective_hash, role, now, now, github_id, avatar_url)
                    )
                    conn.commit()
                return {"id": user_id, "username": clean_user, "email": clean_email, "role": role, "is_active": True, "created_at": now, "last_login": now, "github_id": github_id, "avatar_url": avatar_url}
            except Exception as e:
                self.last_error = f"Failed to create user in SQLite: {e}"
                logger.error(self.last_error)
                return None

    def get_user_by_username_or_email(self, identifier: str) -> Optional[Dict[str, Any]]:
        if not identifier:
            return None
        clean_id = identifier.strip()
        if self.db_type == "mssql":
            try:
                conn = self._get_mssql_conn()
                cursor = conn.cursor()
                query = "SELECT id, username, email, password_hash, role, is_active, created_at, last_login, github_id, avatar_url FROM users WHERE LOWER(username) = LOWER(%s) OR LOWER(email) = LOWER(%s)" if self.driver == "pymssql" else "SELECT id, username, email, password_hash, role, is_active, created_at, last_login, github_id, avatar_url FROM users WHERE LOWER(username) = LOWER(?) OR LOWER(email) = LOWER(?)"
                cursor.execute(query, (clean_id, clean_id))
                row = cursor.fetchone()
                conn.close()
                if row:
                    if isinstance(row, dict):
                        return row
                    return {
                        "id": str(row[0]),
                        "username": str(row[1]),
                        "email": str(row[2]),
                        "password_hash": str(row[3]) if row[3] else None,
                        "role": str(row[4]),
                        "is_active": bool(row[5]),
                        "created_at": str(row[6]),
                        "last_login": str(row[7]) if row[7] else None,
                        "github_id": str(row[8]) if len(row) > 8 and row[8] else None,
                        "avatar_url": str(row[9]) if len(row) > 9 and row[9] else None
                    }
            except Exception as e:
                logger.warning(f"MSSQL get_user_by_username_or_email failed: {e}")

            # Fallback lookup in local SQLite
            try:
                with self._get_sqlite_conn() as conn:
                    cursor = conn.cursor()
                    cursor.execute(
                        "SELECT id, username, email, password_hash, role, is_active, created_at, last_login, github_id, avatar_url FROM users WHERE LOWER(username) = LOWER(?) OR LOWER(email) = LOWER(?)",
                        (clean_id, clean_id)
                    )
                    row = cursor.fetchone()
                    if row:
                        return dict(row)
            except Exception:
                pass
            return None
        else:
            try:
                with self._get_sqlite_conn() as conn:
                    cursor = conn.cursor()
                    cursor.execute(
                        "SELECT id, username, email, password_hash, role, is_active, created_at, last_login, github_id, avatar_url FROM users WHERE LOWER(username) = LOWER(?) OR LOWER(email) = LOWER(?)",
                        (clean_id, clean_id)
                    )
                    row = cursor.fetchone()
                    if row:
                        return dict(row)
                return None
            except Exception as e:
                logger.error(f"Failed to fetch user from SQLite: {e}")
                return None

    def get_user_by_github_id(self, github_id: str) -> Optional[Dict[str, Any]]:
        if not github_id:
            return None
        gh_id = str(github_id).strip()
        if self.db_type == "mssql":
            try:
                conn = self._get_mssql_conn()
                cursor = conn.cursor()
                query = "SELECT id, username, email, password_hash, role, is_active, created_at, last_login, github_id, avatar_url FROM users WHERE github_id = %s" if self.driver == "pymssql" else "SELECT id, username, email, password_hash, role, is_active, created_at, last_login, github_id, avatar_url FROM users WHERE github_id = ?"
                cursor.execute(query, (gh_id,))
                row = cursor.fetchone()
                conn.close()
                if row:
                    if isinstance(row, dict):
                        return row
                    return {
                        "id": str(row[0]),
                        "username": str(row[1]),
                        "email": str(row[2]),
                        "password_hash": str(row[3]) if row[3] else None,
                        "role": str(row[4]),
                        "is_active": bool(row[5]),
                        "created_at": str(row[6]),
                        "last_login": str(row[7]) if row[7] else None,
                        "github_id": str(row[8]) if len(row) > 8 and row[8] else None,
                        "avatar_url": str(row[9]) if len(row) > 9 and row[9] else None
                    }
            except Exception as e:
                logger.warning(f"MSSQL get_user_by_github_id failed: {e}")

            # Fallback lookup in SQLite
            try:
                with self._get_sqlite_conn() as conn:
                    cursor = conn.cursor()
                    cursor.execute(
                        "SELECT id, username, email, password_hash, role, is_active, created_at, last_login, github_id, avatar_url FROM users WHERE github_id = ?",
                        (gh_id,)
                    )
                    row = cursor.fetchone()
                    if row:
                        return dict(row)
            except Exception:
                pass
            return None
        else:
            try:
                with self._get_sqlite_conn() as conn:
                    cursor = conn.cursor()
                    cursor.execute(
                        "SELECT id, username, email, password_hash, role, is_active, created_at, last_login, github_id, avatar_url FROM users WHERE github_id = ?",
                        (gh_id,)
                    )
                    row = cursor.fetchone()
                    if row:
                        return dict(row)
                return None
            except Exception as e:
                logger.error(f"Failed to fetch user by github_id from SQLite: {e}")
                return None

    def _upsert_github_user_sqlite(self, gh_id: str, clean_user: str, clean_email: str, avatar_url: str, now: str) -> Optional[Dict[str, Any]]:
        """Internal helper for resilient upserting GitHub user in local SQLite DB."""
        try:
            self._init_sqlite_schema()
            with self._get_sqlite_conn() as conn:
                cursor = conn.cursor()
                # 1. Lookup by github_id
                cursor.execute("SELECT id, username, email, password_hash, role, is_active, created_at, last_login, github_id, avatar_url FROM users WHERE github_id = ?", (gh_id,))
                row = cursor.fetchone()
                if row:
                    user_dict = dict(row)
                    cursor.execute("UPDATE users SET last_login = ?, avatar_url = COALESCE(NULLIF(?, ''), avatar_url) WHERE id = ?", (now, avatar_url, user_dict["id"]))
                    conn.commit()
                    user_dict["last_login"] = now
                    if avatar_url:
                        user_dict["avatar_url"] = avatar_url
                    return user_dict

                # 2. Lookup by email
                cursor.execute("SELECT id, username, email, password_hash, role, is_active, created_at, last_login, github_id, avatar_url FROM users WHERE LOWER(email) = LOWER(?)", (clean_email,))
                row = cursor.fetchone()
                if row:
                    user_dict = dict(row)
                    cursor.execute("UPDATE users SET github_id = ?, avatar_url = COALESCE(NULLIF(?, ''), avatar_url), last_login = ? WHERE id = ?", (gh_id, avatar_url, now, user_dict["id"]))
                    conn.commit()
                    user_dict["github_id"] = gh_id
                    user_dict["last_login"] = now
                    if avatar_url:
                        user_dict["avatar_url"] = avatar_url
                    return user_dict

                # 3. Create new user
                candidate_username = clean_user
                idx = 1
                while True:
                    cursor.execute("SELECT id FROM users WHERE LOWER(username) = LOWER(?)", (candidate_username,))
                    if not cursor.fetchone():
                        break
                    candidate_username = f"{clean_user}_{idx}"
                    idx += 1

                user_id = str(uuid.uuid4())
                role = "developer"
                pw_hash = "oauth_github_user"
                cursor.execute(
                    "INSERT INTO users (id, username, email, password_hash, role, is_active, created_at, last_login, github_id, avatar_url) VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?, ?)",
                    (user_id, candidate_username, clean_email, pw_hash, role, now, now, gh_id, avatar_url)
                )
                conn.commit()
                return {
                    "id": user_id,
                    "username": candidate_username,
                    "email": clean_email,
                    "role": role,
                    "is_active": True,
                    "created_at": now,
                    "last_login": now,
                    "github_id": gh_id,
                    "avatar_url": avatar_url
                }
        except Exception as e:
            self.last_error = f"SQLite upsert_github_user error: {e}"
            logger.error(self.last_error)
            return None

    def upsert_github_user(self, github_id: str, username: str, email: str, avatar_url: str = "") -> Optional[Dict[str, Any]]:
        """Finds or creates a user account linked with GitHub OAuth with automatic fallback."""
        gh_id = str(github_id).strip()
        clean_user = (username or f"gh_{gh_id}").strip()
        # Fallback email if GitHub provides no public email
        if not email or not str(email).strip():
            clean_email = f"{clean_user}@users.noreply.github.com".lower()
        else:
            clean_email = str(email).strip().lower()

        now = datetime.datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")

        if self.db_type == "mssql":
            try:
                # 1. Look up by GitHub ID
                user = self.get_user_by_github_id(gh_id)
                if user:
                    self.update_last_login(user["id"])
                    if avatar_url and avatar_url != user.get("avatar_url"):
                        try:
                            conn = self._get_mssql_conn()
                            cursor = conn.cursor()
                            query = "UPDATE users SET avatar_url = %s WHERE id = %s" if self.driver == "pymssql" else "UPDATE users SET avatar_url = ? WHERE id = ?"
                            cursor.execute(query, (avatar_url, user["id"]))
                            conn.close()
                            user["avatar_url"] = avatar_url
                        except Exception:
                            pass
                    return user

                # 2. Look up by email
                user_by_email = self.get_user_by_username_or_email(clean_email)
                if user_by_email:
                    user_id = user_by_email["id"]
                    try:
                        conn = self._get_mssql_conn()
                        cursor = conn.cursor()
                        query = "UPDATE users SET github_id = %s, avatar_url = %s, last_login = %s WHERE id = %s" if self.driver == "pymssql" else "UPDATE users SET github_id = ?, avatar_url = ?, last_login = ? WHERE id = ?"
                        cursor.execute(query, (gh_id, avatar_url, now, user_id))
                        conn.close()
                    except Exception as e:
                        logger.warning(f"Error linking GitHub ID in MSSQL, applying schema update: {e}")
                        self._init_mssql_schema()
                        conn = self._get_mssql_conn()
                        cursor = conn.cursor()
                        query = "UPDATE users SET github_id = %s, avatar_url = %s, last_login = %s WHERE id = %s" if self.driver == "pymssql" else "UPDATE users SET github_id = ?, avatar_url = ?, last_login = ? WHERE id = ?"
                        cursor.execute(query, (gh_id, avatar_url, now, user_id))
                        conn.close()

                    updated_user = self.get_user_by_id(user_id)
                    if updated_user:
                        return updated_user

                # 3. Create brand new user
                candidate_username = clean_user
                idx = 1
                while self.get_user_by_username_or_email(candidate_username):
                    candidate_username = f"{clean_user}_{idx}"
                    idx += 1

                user_id = str(uuid.uuid4())
                role = "developer"
                pw_hash = "oauth_github_user"

                try:
                    conn = self._get_mssql_conn()
                    cursor = conn.cursor()
                    query = "INSERT INTO users (id, username, email, password_hash, role, is_active, created_at, last_login, github_id, avatar_url) VALUES (%s, %s, %s, %s, %s, 1, %s, %s, %s, %s)" if self.driver == "pymssql" else "INSERT INTO users (id, username, email, password_hash, role, is_active, created_at, last_login, github_id, avatar_url) VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?, ?)"
                    cursor.execute(query, (user_id, candidate_username, clean_email, pw_hash, role, now, now, gh_id, avatar_url))
                    conn.close()
                    return {"id": user_id, "username": candidate_username, "email": clean_email, "role": role, "is_active": True, "created_at": now, "last_login": now, "github_id": gh_id, "avatar_url": avatar_url}
                except Exception as insert_err:
                    logger.warning(f"MSSQL INSERT user failed ({insert_err}), running schema migration and retrying...")
                    self._init_mssql_schema()
                    conn = self._get_mssql_conn()
                    cursor = conn.cursor()
                    query = "INSERT INTO users (id, username, email, password_hash, role, is_active, created_at, last_login, github_id, avatar_url) VALUES (%s, %s, %s, %s, %s, 1, %s, %s, %s, %s)" if self.driver == "pymssql" else "INSERT INTO users (id, username, email, password_hash, role, is_active, created_at, last_login, github_id, avatar_url) VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?, ?)"
                    cursor.execute(query, (user_id, candidate_username, clean_email, pw_hash, role, now, now, gh_id, avatar_url))
                    conn.close()
                    return {"id": user_id, "username": candidate_username, "email": clean_email, "role": role, "is_active": True, "created_at": now, "last_login": now, "github_id": gh_id, "avatar_url": avatar_url}
            except Exception as mssql_err:
                self.last_error = f"MSSQL Error: {mssql_err}"
                logger.error(f"MSSQL upsert_github_user failed: {mssql_err}. Attempting local SQLite fallback...")
                # Fallback to local SQLite to ensure the user is never blocked!
                sqlite_user = self._upsert_github_user_sqlite(gh_id, clean_user, clean_email, avatar_url, now)
                if sqlite_user:
                    logger.info("Successfully persisted user to local SQLite fallback database.")
                    return sqlite_user
                return None
        else:
            return self._upsert_github_user_sqlite(gh_id, clean_user, clean_email, avatar_url, now)

    def get_user_by_id(self, user_id: str) -> Optional[Dict[str, Any]]:
        if not user_id:
            return None
        if self.db_type == "mssql":
            try:
                conn = self._get_mssql_conn()
                cursor = conn.cursor()
                query = "SELECT id, username, email, role, is_active, created_at, last_login, github_id, avatar_url FROM users WHERE id = %s" if self.driver == "pymssql" else "SELECT id, username, email, role, is_active, created_at, last_login, github_id, avatar_url FROM users WHERE id = ?"
                cursor.execute(query, (user_id,))
                row = cursor.fetchone()
                conn.close()
                if row:
                    if isinstance(row, dict):
                        return row
                    return {
                        "id": str(row[0]),
                        "username": str(row[1]),
                        "email": str(row[2]),
                        "role": str(row[3]),
                        "is_active": bool(row[4]),
                        "created_at": str(row[5]),
                        "last_login": str(row[6]) if row[6] else None,
                        "github_id": str(row[7]) if len(row) > 7 and row[7] else None,
                        "avatar_url": str(row[8]) if len(row) > 8 and row[8] else None
                    }
            except Exception as e:
                logger.warning(f"MSSQL get_user_by_id failed: {e}")

            # Fallback check in SQLite
            try:
                with self._get_sqlite_conn() as conn:
                    cursor = conn.cursor()
                    cursor.execute("SELECT id, username, email, role, is_active, created_at, last_login, github_id, avatar_url FROM users WHERE id = ?", (user_id,))
                    row = cursor.fetchone()
                    if row:
                        return dict(row)
            except Exception:
                pass
            return None
        else:
            try:
                with self._get_sqlite_conn() as conn:
                    cursor = conn.cursor()
                    cursor.execute(
                        "SELECT id, username, email, role, is_active, created_at, last_login, github_id, avatar_url FROM users WHERE id = ?",
                        (user_id,)
                    )
                    row = cursor.fetchone()
                    if row:
                        return dict(row)
                return None
            except Exception as e:
                logger.error(f"Failed to fetch user by ID in SQLite: {e}")
                return None

    def update_last_login(self, user_id: str):
        now = datetime.datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")
        if self.db_type == "mssql":
            try:
                conn = self._get_mssql_conn()
                cursor = conn.cursor()
                query = "UPDATE users SET last_login = %s WHERE id = %s" if self.driver == "pymssql" else "UPDATE users SET last_login = ? WHERE id = ?"
                cursor.execute(query, (now, user_id))
                conn.close()
            except Exception as e:
                logger.warning(f"Error updating last login in MSSQL: {e}")
                try:
                    with self._get_sqlite_conn() as conn:
                        conn.execute("UPDATE users SET last_login = ? WHERE id = ?", (now, user_id))
                        conn.commit()
                except Exception:
                    pass
        else:
            try:
                with self._get_sqlite_conn() as conn:
                    conn.execute("UPDATE users SET last_login = ? WHERE id = ?", (now, user_id))
                    conn.commit()
            except Exception as e:
                logger.error(f"Error updating last login in SQLite: {e}")

    # --- Project Management ---

    def create_project(self, user_id: str, name: str, description: str = "", is_public: bool = False, metrics: Optional[Dict[str, Any]] = None, file_tree: Optional[Dict[str, Any]] = None) -> Optional[Dict[str, Any]]:
        project_id = str(uuid.uuid4())
        snapshot_id = str(uuid.uuid4())
        now = datetime.datetime.utcnow().isoformat()
        metrics_json = json.dumps(metrics or {})
        file_tree_json = json.dumps(file_tree or {})

        if self.db_type == "mssql":
            try:
                conn = self._get_mssql_conn()
                cursor = conn.cursor()
                p_query = "INSERT INTO projects (id, user_id, name, description, is_public, created_at, updated_at) VALUES (%s, %s, %s, %s, %s, %s, %s)" if self.driver == "pymssql" else "INSERT INTO projects (id, user_id, name, description, is_public, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
                cursor.execute(p_query, (project_id, user_id, name, description, 1 if is_public else 0, now, now))

                s_query = "INSERT INTO project_snapshots (id, project_id, version, metrics_json, file_tree_json, created_at) VALUES (%s, %s, %s, %s, %s, %s)" if self.driver == "pymssql" else "INSERT INTO project_snapshots (id, project_id, version, metrics_json, file_tree_json, created_at) VALUES (?, ?, ?, ?, ?, ?)"
                cursor.execute(s_query, (snapshot_id, project_id, "1.0.0", metrics_json, file_tree_json, now))
                conn.close()
                return {
                    "id": project_id,
                    "user_id": user_id,
                    "name": name,
                    "description": description,
                    "is_public": is_public,
                    "created_at": now,
                    "updated_at": now,
                    "latest_snapshot_id": snapshot_id
                }
            except Exception as e:
                logger.error(f"Failed to create project in MSSQL: {e}")
                return None
        else:
            try:
                with self._get_sqlite_conn() as conn:
                    conn.execute(
                        "INSERT INTO projects (id, user_id, name, description, is_public, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
                        (project_id, user_id, name, description, 1 if is_public else 0, now, now)
                    )
                    conn.execute(
                        "INSERT INTO project_snapshots (id, project_id, version, metrics_json, file_tree_json, created_at) VALUES (?, ?, ?, ?, ?, ?)",
                        (snapshot_id, project_id, "1.0.0", metrics_json, file_tree_json, now)
                    )
                    conn.commit()
                return {
                    "id": project_id,
                    "user_id": user_id,
                    "name": name,
                    "description": description,
                    "is_public": is_public,
                    "created_at": now,
                    "updated_at": now,
                    "latest_snapshot_id": snapshot_id
                }
            except Exception as e:
                logger.error(f"Failed to create project in SQLite: {e}")
                return None

    def list_projects(self, user_id: Optional[str] = None) -> List[Dict[str, Any]]:
        """Returns list of projects owned by user_id + all public projects."""
        projects = []
        if self.db_type == "mssql":
            try:
                conn = self._get_mssql_conn()
                cursor = conn.cursor()
                if user_id:
                    query = """
                        SELECT p.id, p.user_id, p.name, p.description, p.is_public, p.share_token, p.created_at, p.updated_at, u.username as owner
                        FROM projects p
                        LEFT JOIN users u ON p.user_id = u.id
                        WHERE p.user_id = %s OR p.is_public = 1
                        ORDER BY p.updated_at DESC
                    """ if self.driver == "pymssql" else """
                        SELECT p.id, p.user_id, p.name, p.description, p.is_public, p.share_token, p.created_at, p.updated_at, u.username as owner
                        FROM projects p
                        LEFT JOIN users u ON p.user_id = u.id
                        WHERE p.user_id = ? OR p.is_public = 1
                        ORDER BY p.updated_at DESC
                    """
                    cursor.execute(query, (user_id,))
                else:
                    query = """
                        SELECT p.id, p.user_id, p.name, p.description, p.is_public, p.share_token, p.created_at, p.updated_at, u.username as owner
                        FROM projects p
                        LEFT JOIN users u ON p.user_id = u.id
                        WHERE p.is_public = 1
                        ORDER BY p.updated_at DESC
                    """
                    cursor.execute(query)

                rows = cursor.fetchall()
                conn.close()
                for row in rows:
                    if isinstance(row, dict):
                        projects.append(row)
                    else:
                        projects.append({
                            "id": str(row[0]),
                            "user_id": str(row[1]),
                            "name": str(row[2]),
                            "description": str(row[3] or ""),
                            "is_public": bool(row[4]),
                            "share_token": str(row[5]) if row[5] else None,
                            "created_at": str(row[6]),
                            "updated_at": str(row[7]),
                            "owner": str(row[8] or "Unknown")
                        })
            except Exception as e:
                logger.error(f"Error listing projects from MSSQL: {e}")
        else:
            try:
                with self._get_sqlite_conn() as conn:
                    cursor = conn.cursor()
                    if user_id:
                        cursor.execute("""
                            SELECT p.id, p.user_id, p.name, p.description, p.is_public, p.share_token, p.created_at, p.updated_at, u.username as owner
                            FROM projects p
                            LEFT JOIN users u ON p.user_id = u.id
                            WHERE p.user_id = ? OR p.is_public = 1
                            ORDER BY p.updated_at DESC
                        """, (user_id,))
                    else:
                        cursor.execute("""
                            SELECT p.id, p.user_id, p.name, p.description, p.is_public, p.share_token, p.created_at, p.updated_at, u.username as owner
                            FROM projects p
                            LEFT JOIN users u ON p.user_id = u.id
                            WHERE p.is_public = 1
                            ORDER BY p.updated_at DESC
                        """)
                    for row in cursor.fetchall():
                        projects.append(dict(row))
            except Exception as e:
                logger.error(f"Error listing projects from SQLite: {e}")
        return projects

    def get_project_by_id(self, project_id: str, user_id: Optional[str] = None) -> Optional[Dict[str, Any]]:
        project = None
        if self.db_type == "mssql":
            try:
                conn = self._get_mssql_conn()
                cursor = conn.cursor()
                query = "SELECT id, user_id, name, description, is_public, share_token, created_at, updated_at FROM projects WHERE id = %s" if self.driver == "pymssql" else "SELECT id, user_id, name, description, is_public, share_token, created_at, updated_at FROM projects WHERE id = ?"
                cursor.execute(query, (project_id,))
                row = cursor.fetchone()
                if row:
                    if isinstance(row, dict):
                        project = row
                    else:
                        project = {
                            "id": str(row[0]),
                            "user_id": str(row[1]),
                            "name": str(row[2]),
                            "description": str(row[3] or ""),
                            "is_public": bool(row[4]),
                            "share_token": str(row[5]) if row[5] else None,
                            "created_at": str(row[6]),
                            "updated_at": str(row[7])
                        }
                    # Fetch latest snapshot
                    s_query = "SELECT TOP 1 id, version, metrics_json, file_tree_json, created_at FROM project_snapshots WHERE project_id = %s ORDER BY created_at DESC" if self.driver == "pymssql" else "SELECT TOP 1 id, version, metrics_json, file_tree_json, created_at FROM project_snapshots WHERE project_id = ? ORDER BY created_at DESC"
                    cursor.execute(s_query, (project_id,))
                    s_row = cursor.fetchone()
                    if s_row:
                        if isinstance(s_row, dict):
                            project["snapshot"] = {
                                "id": s_row["id"],
                                "version": s_row["version"],
                                "metrics": json.loads(s_row["metrics_json"]) if s_row["metrics_json"] else {},
                                "file_tree": json.loads(s_row["file_tree_json"]) if s_row["file_tree_json"] else {},
                                "created_at": str(s_row["created_at"])
                            }
                        else:
                            project["snapshot"] = {
                                "id": str(s_row[0]),
                                "version": str(s_row[1]),
                                "metrics": json.loads(s_row[2]) if s_row[2] else {},
                                "file_tree": json.loads(s_row[3]) if s_row[3] else {},
                                "created_at": str(s_row[4])
                            }
                conn.close()
            except Exception as e:
                logger.error(f"Error fetching project from MSSQL: {e}")
        else:
            try:
                with self._get_sqlite_conn() as conn:
                    cursor = conn.cursor()
                    cursor.execute("SELECT id, user_id, name, description, is_public, share_token, created_at, updated_at FROM projects WHERE id = ?", (project_id,))
                    row = cursor.fetchone()
                    if row:
                        project = dict(row)
                        cursor.execute("SELECT id, version, metrics_json, file_tree_json, created_at FROM project_snapshots WHERE project_id = ? ORDER BY created_at DESC LIMIT 1", (project_id,))
                        s_row = cursor.fetchone()
                        if s_row:
                            project["snapshot"] = {
                                "id": s_row["id"],
                                "version": s_row["version"],
                                "metrics": json.loads(s_row["metrics_json"]) if s_row["metrics_json"] else {},
                                "file_tree": json.loads(s_row["file_tree_json"]) if s_row["file_tree_json"] else {},
                                "created_at": s_row["created_at"]
                            }
            except Exception as e:
                logger.error(f"Error fetching project from SQLite: {e}")

        # Check access permission
        if project:
            if project["is_public"] or (user_id and project["user_id"] == user_id):
                return project
        return None

    def create_or_get_share_token(self, project_id: str, user_id: str) -> Optional[str]:
        """Generates or returns existing share token for a user's project."""
        project = self.get_project_by_id(project_id, user_id=user_id)
        if not project or project["user_id"] != user_id:
            return None

        if project.get("share_token"):
            return project["share_token"]

        token = str(uuid.uuid4()).replace("-", "")[:24]
        if self.db_type == "mssql":
            try:
                conn = self._get_mssql_conn()
                cursor = conn.cursor()
                query = "UPDATE projects SET share_token = %s, is_public = 1 WHERE id = %s" if self.driver == "pymssql" else "UPDATE projects SET share_token = ?, is_public = 1 WHERE id = ?"
                cursor.execute(query, (token, project_id))
                conn.close()
                return token
            except Exception as e:
                logger.error(f"Error setting share token in MSSQL: {e}")
                return None
        else:
            try:
                with self._get_sqlite_conn() as conn:
                    conn.execute("UPDATE projects SET share_token = ?, is_public = 1 WHERE id = ?", (token, project_id))
                    conn.commit()
                return token
            except Exception as e:
                logger.error(f"Error setting share token in SQLite: {e}")
                return None

    def get_project_by_share_token(self, token: str) -> Optional[Dict[str, Any]]:
        """Retrieves project and snapshot data by public share token."""
        project = None
        if self.db_type == "mssql":
            try:
                conn = self._get_mssql_conn()
                cursor = conn.cursor()
                query = "SELECT id, user_id, name, description, is_public, share_token, created_at, updated_at FROM projects WHERE share_token = %s" if self.driver == "pymssql" else "SELECT id, user_id, name, description, is_public, share_token, created_at, updated_at FROM projects WHERE share_token = ?"
                cursor.execute(query, (token,))
                row = cursor.fetchone()
                if row:
                    p_id = str(row["id"]) if isinstance(row, dict) else str(row[0])
                    conn.close()
                    return self.get_project_by_id(p_id)
                conn.close()
            except Exception as e:
                logger.error(f"Error fetching share project in MSSQL: {e}")
        else:
            try:
                with self._get_sqlite_conn() as conn:
                    cursor = conn.cursor()
                    cursor.execute("SELECT id FROM projects WHERE share_token = ?", (token,))
                    row = cursor.fetchone()
                    if row:
                        return self.get_project_by_id(row["id"])
            except Exception as e:
                logger.error(f"Error fetching share project in SQLite: {e}")
        return None

    def save_snapshot(self, project_id: str, user_id: str, metrics: Dict[str, Any], file_tree: Optional[Dict[str, Any]] = None, version: str = "1.0.0") -> Optional[str]:
        project = self.get_project_by_id(project_id, user_id=user_id)
        if not project or project["user_id"] != user_id:
            return None

        snapshot_id = str(uuid.uuid4())
        now = datetime.datetime.utcnow().isoformat()
        metrics_json = json.dumps(metrics)
        file_tree_json = json.dumps(file_tree or {})

        if self.db_type == "mssql":
            try:
                conn = self._get_mssql_conn()
                cursor = conn.cursor()
                s_query = "INSERT INTO project_snapshots (id, project_id, version, metrics_json, file_tree_json, created_at) VALUES (%s, %s, %s, %s, %s, %s)" if self.driver == "pymssql" else "INSERT INTO project_snapshots (id, project_id, version, metrics_json, file_tree_json, created_at) VALUES (?, ?, ?, ?, ?, ?)"
                cursor.execute(s_query, (snapshot_id, project_id, version, metrics_json, file_tree_json, now))
                u_query = "UPDATE projects SET updated_at = %s WHERE id = %s" if self.driver == "pymssql" else "UPDATE projects SET updated_at = ? WHERE id = ?"
                cursor.execute(u_query, (now, project_id))
                conn.close()
                return snapshot_id
            except Exception as e:
                logger.error(f"Error saving snapshot in MSSQL: {e}")
                return None
        else:
            try:
                with self._get_sqlite_conn() as conn:
                    conn.execute(
                        "INSERT INTO project_snapshots (id, project_id, version, metrics_json, file_tree_json, created_at) VALUES (?, ?, ?, ?, ?, ?)",
                        (snapshot_id, project_id, version, metrics_json, file_tree_json, now)
                    )
                    conn.execute("UPDATE projects SET updated_at = ? WHERE id = ?", (now, project_id))
                    conn.commit()
                return snapshot_id
            except Exception as e:
                logger.error(f"Error saving snapshot in SQLite: {e}")
                return None

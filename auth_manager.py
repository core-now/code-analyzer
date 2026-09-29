"""
Authentication, Password Hashing and JWT Token Management.
Works with standard library HMAC/SHA256 + fallback, and optionally bcrypt/PyJWT when installed.
"""

import os
import json
import time
import base64
import hmac
import hashlib
from typing import Dict, Any, Optional
from pathlib import Path


def load_environment_variables(env_path: Optional[str] = None) -> bool:
    """Loads environment variables from .env files across multiple candidate locations.
    
    Searches:
    1. Explicit env_path (if provided)
    2. Current working directory (.env)
    3. Directory of this script (.env)
    4. Workspace directory (/workspace/.env or WORKSPACE_DIR)
    5. Parent directory of script / workspace
    
    Uses python-dotenv if installed, otherwise uses built-in parser fallback.
    """
    candidate_paths = []
    if env_path:
        candidate_paths.append(Path(env_path).resolve())

    cwd_env = (Path.cwd() / ".env").resolve()
    script_env = (Path(__file__).resolve().parent / ".env").resolve()
    workspace_dir = os.environ.get("WORKSPACE_DIR", "/workspace")
    workspace_env = (Path(workspace_dir) / ".env").resolve()
    parent_env = (Path(__file__).resolve().parent.parent / ".env").resolve()

    for p in [cwd_env, script_env, workspace_env, parent_env]:
        if p not in candidate_paths:
            candidate_paths.append(p)

    loaded_any = False
    for p in candidate_paths:
        try:
            if p.is_file():
                # 1. Try python-dotenv first
                try:
                    from dotenv import load_dotenv
                    load_dotenv(p, override=False)
                    loaded_any = True
                except ImportError:
                    # 2. Robust fallback parser without external dependencies
                    with open(p, "r", encoding="utf-8", errors="replace") as f:
                        for line in f:
                            line = line.strip()
                            if not line or line.startswith("#"):
                                continue
                            if line.startswith("export "):
                                line = line[7:].strip()
                            if "=" in line:
                                key, _, val = line.partition("=")
                                key = key.strip()
                                val = val.strip()
                                if (val.startswith('"') and val.endswith('"')) or (val.startswith("'") and val.endswith("'")):
                                    val = val[1:-1]
                                if key and key not in os.environ:
                                    os.environ[key] = val
                    loaded_any = True
        except Exception:
            pass

    return loaded_any


# Load environment variables on module import
load_environment_variables()


def get_auth_secret() -> str:
    """Returns the effective AUTH_SECRET from environment or fallback."""
    return os.environ.get("AUTH_SECRET") or os.environ.get("SUPER_SALT") or "corenow-antigravity-analyzer-secret-key-9988"


# Secret key for JWT signing & password salt
AUTH_SECRET = get_auth_secret()
JWT_EXPIRATION_SECONDS = int(os.environ.get("JWT_EXPIRATION_SECONDS", "86400"))  # 24 Hours

# Check optional bcrypt
BCRYPT_AVAILABLE = False
try:
    import bcrypt
    BCRYPT_AVAILABLE = True
except ImportError:
    pass

# Check optional PyJWT
PYJWT_AVAILABLE = False
try:
    import jwt
    PYJWT_AVAILABLE = True
except ImportError:
    pass


def hash_password(password: str) -> str:
    """Hashes password with bcrypt if available, otherwise PBKDF2-HMAC-SHA256."""
    if BCRYPT_AVAILABLE:
        salt = bcrypt.gensalt(rounds=12)
        hashed = bcrypt.hashpw(password.encode("utf-8"), salt)
        return "bcrypt$" + hashed.decode("utf-8")
    else:
        # Standard library PBKDF2
        salt = os.urandom(16)
        kdf = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 100000)
        return "pbkdf2$" + base64.b64encode(salt).decode("utf-8") + "$" + base64.b64encode(kdf).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verifies a plain text password against stored hash."""
    try:
        if hashed_password.startswith("bcrypt$"):
            raw_hash = hashed_password[7:].encode("utf-8")
            if BCRYPT_AVAILABLE:
                return bcrypt.checkpw(plain_password.encode("utf-8"), raw_hash)
            return False

        elif hashed_password.startswith("pbkdf2$"):
            parts = hashed_password.split("$")
            if len(parts) == 3:
                salt = base64.b64decode(parts[1])
                stored_kdf = base64.b64decode(parts[2])
                calc_kdf = hashlib.pbkdf2_hmac("sha256", plain_password.encode("utf-8"), salt, 100000)
                return hmac.compare_digest(stored_kdf, calc_kdf)

        # Legacy simple sha256 check
        calc = hashlib.sha256((get_auth_secret() + plain_password).encode("utf-8")).hexdigest()
        return hmac.compare_digest(calc, hashed_password)
    except Exception:
        return False


def create_jwt_token(payload: Dict[str, Any], expires_in: int = JWT_EXPIRATION_SECONDS) -> str:
    """Generates a JWT token signed with HMAC-SHA256."""
    secret = get_auth_secret()
    token_payload = dict(payload)
    now = int(time.time())
    token_payload["iat"] = now
    token_payload["exp"] = now + expires_in

    if PYJWT_AVAILABLE:
        return jwt.encode(token_payload, secret, algorithm="HS256")

    # Pure Python JWT implementation
    header = {"alg": "HS256", "typ": "JWT"}
    header_b64 = base64.urlsafe_b64encode(json.dumps(header, separators=(",", ":")).encode("utf-8")).decode("utf-8").rstrip("=")
    payload_b64 = base64.urlsafe_b64encode(json.dumps(token_payload, separators=(",", ":")).encode("utf-8")).decode("utf-8").rstrip("=")

    signing_input = f"{header_b64}.{payload_b64}"
    signature = hmac.new(secret.encode("utf-8"), signing_input.encode("utf-8"), hashlib.sha256).digest()
    signature_b64 = base64.urlsafe_b64encode(signature).decode("utf-8").rstrip("=")

    return f"{signing_input}.{signature_b64}"


def decode_jwt_token(token: str) -> Optional[Dict[str, Any]]:
    """Decodes and validates a JWT token signature and expiration."""
    if not token:
        return None

    secret = get_auth_secret()

    if PYJWT_AVAILABLE:
        try:
            return jwt.decode(token, secret, algorithms=["HS256"])
        except Exception:
            return None

    try:
        parts = token.split(".")
        if len(parts) != 3:
            return None

        header_b64, payload_b64, signature_b64 = parts

        # Verify signature
        signing_input = f"{header_b64}.{payload_b64}"
        expected_sig = hmac.new(secret.encode("utf-8"), signing_input.encode("utf-8"), hashlib.sha256).digest()
        
        # Base64 decode signature_b64 with padding
        rem = len(signature_b64) % 4
        padded_sig = signature_b64 + ("=" * (4 - rem) if rem else "")
        provided_sig = base64.urlsafe_b64decode(padded_sig.encode("utf-8"))

        if not hmac.compare_digest(expected_sig, provided_sig):
            return None

        # Decode payload
        rem_p = len(payload_b64) % 4
        padded_payload = payload_b64 + ("=" * (4 - rem_p) if rem_p else "")
        payload_json = base64.urlsafe_b64decode(padded_payload.encode("utf-8")).decode("utf-8")
        payload = json.loads(payload_json)

        # Check expiration
        if "exp" in payload and payload["exp"] < time.time():
            return None

        return payload
    except Exception:
        return None


# --- GitHub OAuth Helpers ---

def is_github_oauth_configured() -> bool:
    """Returns True if GitHub OAuth client ID and secret are configured."""
    client_id = os.environ.get("GITHUB_CLIENT_ID", "").strip()
    client_secret = os.environ.get("GITHUB_CLIENT_SECRET", "").strip()
    if not (client_id and client_secret):
        load_environment_variables()
        client_id = os.environ.get("GITHUB_CLIENT_ID", "").strip()
        client_secret = os.environ.get("GITHUB_CLIENT_SECRET", "").strip()
    return bool(client_id and client_secret)


def exchange_github_code_for_token(code: str, redirect_uri: Optional[str] = None) -> Optional[str]:
    """Exchanges a GitHub OAuth authorization code for an access token."""
    import urllib.request
    import urllib.parse

    client_id = os.environ.get("GITHUB_CLIENT_ID", "").strip()
    client_secret = os.environ.get("GITHUB_CLIENT_SECRET", "").strip()
    if not client_id or not client_secret or not code:
        return None

    token_url = "https://github.com/login/oauth/access_token"
    payload_data: Dict[str, Any] = {
        "client_id": client_id,
        "client_secret": client_secret,
        "code": code
    }
    if redirect_uri:
        payload_data["redirect_uri"] = redirect_uri

    post_data = json.dumps(payload_data).encode("utf-8")
    req = urllib.request.Request(
        token_url,
        data=post_data,
        headers={
            "Content-Type": "application/json",
            "Accept": "application/json",
            "User-Agent": "CodebaseAnalyzer/1.0"
        }
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            resp_body = json.loads(resp.read().decode("utf-8"))
            return resp_body.get("access_token")
    except Exception:
        return None


def fetch_github_user_profile(access_token: str) -> Optional[Dict[str, Any]]:
    """Fetches user profile and primary email from GitHub API."""
    import urllib.request

    if not access_token:
        return None

    headers = {
        "Authorization": f"Bearer {access_token}",
        "Accept": "application/vnd.github.v3+json",
        "User-Agent": "CodebaseAnalyzer/1.0"
    }

    try:
        # 1. Fetch core user info
        user_req = urllib.request.Request("https://api.github.com/user", headers=headers)
        with urllib.request.urlopen(user_req, timeout=15) as resp:
            user_data = json.loads(resp.read().decode("utf-8"))

        github_id = str(user_data.get("id"))
        username = user_data.get("login") or f"gh_user_{github_id}"
        email = user_data.get("email")
        avatar_url = user_data.get("avatar_url", "")
        name = user_data.get("name") or username

        # 2. If email is null/private, fetch from /user/emails
        if not email:
            try:
                emails_req = urllib.request.Request("https://api.github.com/user/emails", headers=headers)
                with urllib.request.urlopen(emails_req, timeout=10) as email_resp:
                    emails_list = json.loads(email_resp.read().decode("utf-8"))
                    if isinstance(emails_list, list):
                        for em in emails_list:
                            if em.get("primary") and em.get("verified"):
                                email = em.get("email")
                                break
                        if not email and emails_list:
                            for em in emails_list:
                                if em.get("verified") or not em.get("email", "").endswith("noreply.github.com"):
                                    email = em.get("email")
                                    break
            except Exception:
                pass

        if not email:
            email = f"{username}@users.noreply.github.com"

        return {
            "github_id": github_id,
            "username": username,
            "email": email,
            "avatar_url": avatar_url,
            "name": name
        }
    except Exception:
        return None


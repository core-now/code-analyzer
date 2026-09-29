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

# Secret key for JWT signing & password salt
AUTH_SECRET = os.environ.get("AUTH_SECRET") or os.environ.get("SUPER_SALT") or "corenow-antigravity-analyzer-secret-key-9988"
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
        calc = hashlib.sha256((AUTH_SECRET + plain_password).encode("utf-8")).hexdigest()
        return hmac.compare_digest(calc, hashed_password)
    except Exception:
        return False


def create_jwt_token(payload: Dict[str, Any], expires_in: int = JWT_EXPIRATION_SECONDS) -> str:
    """Generates a JWT token signed with HMAC-SHA256."""
    token_payload = dict(payload)
    now = int(time.time())
    token_payload["iat"] = now
    token_payload["exp"] = now + expires_in

    if PYJWT_AVAILABLE:
        return jwt.encode(token_payload, AUTH_SECRET, algorithm="HS256")

    # Pure Python JWT implementation
    header = {"alg": "HS256", "typ": "JWT"}
    header_b64 = base64.urlsafe_b64encode(json.dumps(header, separators=(",", ":")).encode("utf-8")).decode("utf-8").rstrip("=")
    payload_b64 = base64.urlsafe_b64encode(json.dumps(token_payload, separators=(",", ":")).encode("utf-8")).decode("utf-8").rstrip("=")

    signing_input = f"{header_b64}.{payload_b64}"
    signature = hmac.new(AUTH_SECRET.encode("utf-8"), signing_input.encode("utf-8"), hashlib.sha256).digest()
    signature_b64 = base64.urlsafe_b64encode(signature).decode("utf-8").rstrip("=")

    return f"{signing_input}.{signature_b64}"


def decode_jwt_token(token: str) -> Optional[Dict[str, Any]]:
    """Decodes and validates a JWT token signature and expiration."""
    if not token:
        return None

    if PYJWT_AVAILABLE:
        try:
            return jwt.decode(token, AUTH_SECRET, algorithms=["HS256"])
        except Exception:
            return None

    try:
        parts = token.split(".")
        if len(parts) != 3:
            return None

        header_b64, payload_b64, signature_b64 = parts

        # Verify signature
        signing_input = f"{header_b64}.{payload_b64}"
        expected_sig = hmac.new(AUTH_SECRET.encode("utf-8"), signing_input.encode("utf-8"), hashlib.sha256).digest()
        
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

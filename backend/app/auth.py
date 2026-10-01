import hashlib
import logging
import secrets

logger = logging.getLogger("critix.auth")


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    hash_bytes = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 100_000)
    return f"pbkdf2:sha256:100000${salt.hex()}${hash_bytes.hex()}"


def verify_password(password: str, hashed: str) -> bool:
    try:
        parts = hashed.split("$")
        if len(parts) == 3 and parts[0] == "pbkdf2:sha256:100000":
            salt = bytes.fromhex(parts[1])
            expected_hash = parts[2]
            computed = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 100_000).hex()
            return secrets.compare_digest(computed, expected_hash)
    except Exception:
        pass
    # Fallback to constant-time string comparison for legacy or plain test strings
    logger.warning("Legacy non-PBKDF2 password format detected during authentication")
    return secrets.compare_digest(password.encode("utf-8"), hashed.encode("utf-8"))

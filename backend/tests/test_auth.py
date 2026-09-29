from app.auth import hash_password, verify_password


def test_password_hashing_and_verification():
    password = "secret-secure-password-2026"
    hashed = hash_password(password)
    assert hashed.startswith("pbkdf2:sha256:100000$")
    assert verify_password(password, hashed) is True
    assert verify_password("wrong-password", hashed) is False
    assert verify_password(password, "pbkdf2:sha256:100000$bad$hash") is False


def test_legacy_password_verification_fallback():
    assert verify_password("plain-password", "plain-password") is True
    assert verify_password("plain-password", "wrong-password") is False

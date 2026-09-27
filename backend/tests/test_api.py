from fastapi.testclient import TestClient

from app.main import app, attempts


def client(monkeypatch):
    monkeypatch.setenv("ADMIN_PASSWORD", "test-password-only-123")
    monkeypatch.setenv("SESSION_SECRET", "test-only-session-secret-at-least-32-characters")
    monkeypatch.setenv("COOKIE_SECURE", "false")
    attempts.clear()
    return TestClient(app)


def test_auth_and_csrf(monkeypatch):
    c = client(monkeypatch)
    assert c.get("/api/projects").status_code == 401
    assert c.post("/api/login", json={"password":"test-password-only-123"}).status_code == 403
    assert c.post("/api/login", headers={"X-Critix-Request":"1", "Origin":"https://foreign.test"},
                  json={"password":"test-password-only-123"}).status_code == 403
    response = c.post("/api/login", headers={"X-Critix-Request":"1"}, json={"password":"test-password-only-123"})
    assert response.status_code == 200
    assert "HttpOnly" in response.headers["set-cookie"]
    assert "SameSite=strict" in response.headers["set-cookie"]
    assert c.post("/api/logout", headers={"X-Critix-Request":"1"}).status_code == 200
    assert c.get("/api/projects").status_code == 401


def test_login_rate_limit_and_tampered_cookie(monkeypatch):
    c = client(monkeypatch)
    for _ in range(10):
        assert c.post("/api/login", headers={"X-Critix-Request":"1"}, json={"password":"wrong"}).status_code == 401
    assert c.post("/api/login", headers={"X-Critix-Request":"1"}, json={"password":"wrong"}).status_code == 429
    c.cookies.set("critix_session", "9999999999.nonce.invalid")
    assert c.get("/api/projects").status_code == 401


def test_proxy_clients_have_separate_limits_and_logout_revokes_copied_cookie(monkeypatch):
    from app.main import authenticated
    from starlette.requests import Request
    from fastapi import HTTPException
    import pytest
    c = client(monkeypatch)
    monkeypatch.setenv("TRUST_PROXY_HEADERS", "true")
    bad = {"X-Critix-Request": "1", "X-Critix-Client-IP": "192.0.2.1"}
    good = {**bad, "X-Critix-Client-IP": "192.0.2.2"}
    for _ in range(10):
        assert c.post("/api/login", headers=bad, json={"password": "wrong"}).status_code == 401
    assert c.post("/api/login", headers=good, json={"password": "test-password-only-123"}).status_code == 200
    token = c.cookies.get("critix_session")
    assert c.post("/api/logout", headers=good).status_code == 200
    request = Request({"type": "http", "headers": [(b"cookie", ("critix_session="+token).encode())]})
    with pytest.raises(HTTPException) as exc:
        authenticated(request)
    assert exc.value.status_code == 401

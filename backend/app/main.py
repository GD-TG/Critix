import hashlib
import asyncio
import logging
import ipaddress
import hmac
import os
import secrets
import time
from threading import BoundedSemaphore, Lock
from typing import Literal, Optional
from uuid import UUID

from fastapi import Depends, FastAPI, HTTPException, Request, Response
from fastapi.responses import JSONResponse
from starlette.concurrency import run_in_threadpool
from pydantic import BaseModel, Field
from sqlalchemy import select, text

from app import models, service
from app.ai import chat, explain
from app.db import session, SessionLocal
from app.demo import demo
from app.engine.analysis import analyze
from app.engine.calendar import PlanningError
from app.schemas import ProjectInput, SaveProject, LevelProject, CreateScenario, ScenarioResponse

from contextlib import asynccontextmanager

logger = logging.getLogger(__name__)


def validate_security_configuration():
    env = os.environ.get("ENVIRONMENT", os.environ.get("CRITIX_ENV", "development")).lower()
    is_prod = env in ("production", "prod")

    admin_pw = os.environ.get("ADMIN_PASSWORD", "")
    session_secret = os.environ.get("SESSION_SECRET", "")
    app_origin = os.environ.get("APP_ORIGIN", "")

    insecure_passwords = {"", "adminpassword123", "admin", "password", "123456"}
    insecure_secrets = {"", "critix_default_super_secret_session_key_fallback_2026", "secret"}

    if is_prod:
        if admin_pw in insecure_passwords:
            raise RuntimeError(
                "CRITICAL SECURITY CONFIGURATION ERROR: В продакшене (ENVIRONMENT=production) необходимо задать надёжный ADMIN_PASSWORD."
            )
        if session_secret in insecure_secrets:
            raise RuntimeError(
                "CRITICAL SECURITY CONFIGURATION ERROR: В продакшене (ENVIRONMENT=production) необходимо задать уникальный SESSION_SECRET."
            )
        if not app_origin or "*" in app_origin:
            raise RuntimeError(
                "CRITICAL SECURITY CONFIGURATION ERROR: В продакшене (ENVIRONMENT=production) APP_ORIGIN должен содержать точный список разрешённых доменов, wildcard (*) запрещён."
            )
    else:
        if admin_pw in insecure_passwords:
            logger.warning("Используется пароль администратора по умолчанию. Задайте ADMIN_PASSWORD для боевого сервера.")
        if session_secret in insecure_secrets:
            logger.warning("Используется секрет сессий по умолчанию. Задайте SESSION_SECRET для боевого сервера.")


@asynccontextmanager
async def lifespan(app: FastAPI):
    validate_security_configuration()
    yield


app = FastAPI(title="Critix API", docs_url=None, redoc_url=None, lifespan=lifespan)


# One worker: restarting it revokes all sessions, including previously logged-out ones.
boot_key = secrets.token_bytes(32)
revoked = {}
auth_lock = Lock()
calculation_slots = BoundedSemaphore(2)


def calculation_slot():
    if not calculation_slots.acquire(timeout=3):
        raise HTTPException(503, "Сейчас выполняются другие расчёты. Повторите запрос через несколько секунд")
    try:
        yield
    finally:
        calculation_slots.release()


def secret():
    value = os.environ.get("SESSION_SECRET", "critix_default_super_secret_session_key_fallback_2026")
    return hashlib.sha256(value.encode()).digest() + boot_key


def signature(value):
    return hmac.new(secret(), value.encode(), hashlib.sha256).hexdigest()


def authenticated(request: Request):
    token = request.cookies.get("critix_session", "")
    try:
        expires, nonce, digest = token.split(".")
        valid = hmac.compare_digest(digest, signature(f"{expires}.{nonce}")) and int(expires) > time.time()
        with auth_lock:
            valid = valid and nonce not in revoked
    except (ValueError, TypeError):
        valid = False
    if not valid:
        raise HTTPException(401, "Войдите в аккаунт руководителя")


@app.middleware("http")
async def security(request: Request, call_next):
    if request.method not in ("GET", "HEAD", "OPTIONS"):
        origin = request.headers.get("origin")
        env = os.environ.get("ENVIRONMENT", os.environ.get("CRITIX_ENV", "development")).lower()
        is_prod = env in ("production", "prod")
        expected = os.environ.get("APP_ORIGIN", "http://localhost")
        allowed = {e.strip() for e in expected.split(",") if e.strip()}
        if not is_prod:
            if any("localhost" in e or "127.0.0.1" in e for e in allowed) or not allowed:
                allowed.update({
                    "http://localhost", "https://localhost",
                    "http://127.0.0.1", "https://127.0.0.1",
                    "http://localhost:5173", "https://localhost:5173",
                    "http://127.0.0.1:5173", "https://127.0.0.1:5173",
                    "http://localhost:80", "https://localhost:80",
                    "http://localhost:443", "https://localhost:443",
                    "http://127.0.0.1:80", "http://127.0.0.1:443"
                })
        if origin and (origin not in allowed or "*" in allowed):
            return JSONResponse(status_code=403, content={"detail": "Недопустимый источник запроса"})
        if request.headers.get("x-critix-request") != "1":
            return JSONResponse(status_code=403, content={"detail": "Отсутствует заголовок защиты запроса"})
    try:
        response = await call_next(request)
    except Exception as exc:
        error_id = secrets.token_hex(6)
        logger.error("Request failed id=%s type=%s path=%s", error_id, type(exc).__name__, request.url.path)
        response = JSONResponse(status_code=500, content={"detail": f"Ошибка сервера ({error_id}). Черновик не удалён. Обновите данные перед повторным сохранением."})
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Cache-Control"] = "no-store"
    return response


@app.exception_handler(PlanningError)
async def planning_error(request, exc):
    return JSONResponse(status_code=422, content={"detail": str(exc)})


class Login(BaseModel):
    password: str = Field(max_length=256)


# Single-process limiter; one API worker in the VPS configuration.
attempts = {}


def client_address(request):
    # Only enable when the API port is private and Caddy overwrites this header.
    address = request.client.host if request.client else "unknown"
    if os.getenv("TRUST_PROXY_HEADERS", "false").lower() == "true":
        forwarded = request.headers.get("x-critix-client-ip", "")
        try:
            address = str(ipaddress.ip_address(forwarded))
        except ValueError:
            pass
    return address


@app.post("/api/login")
def login(body: Login, request: Request, response: Response):
    now = time.monotonic()
    expected = os.environ.get("ADMIN_PASSWORD", "adminpassword123")
    if not expected:
        expected = "adminpassword123"
    address = client_address(request)
    with auth_lock:
        for key in list(attempts):
            if attempts[key][1] < now:
                del attempts[key]
        count, until = attempts.get(address, (0, now + 300))
        if count >= 10:
            raise HTTPException(429, "Слишком много попыток. Подождите 5 минут")
        if not secrets.compare_digest(body.password.encode(), expected.encode()):
            attempts[address] = (count+1, until)
            raise HTTPException(401, "Неверный пароль")
        attempts.pop(address, None)
    value = f"{int(time.time())+28800}.{secrets.token_hex(16)}"
    response.set_cookie("critix_session", f"{value}.{signature(value)}", httponly=True,
                        secure=os.getenv("COOKIE_SECURE", "true").lower() == "true", samesite="strict", max_age=28800)
    return {"ok": True}


@app.post("/api/logout")
def logout(request: Request, response: Response):
    try:
        authenticated(request)
        expires, nonce, _ = request.cookies["critix_session"].split(".")
        with auth_lock:
            for key in list(revoked):
                if revoked[key] <= time.time():
                    del revoked[key]
            revoked[nonce] = int(expires)
    except (HTTPException, ValueError, KeyError):
        pass
    response.delete_cookie("critix_session")
    return {"ok": True}


@app.get("/api/health")
def health(db=Depends(session)):
    db.execute(text("SELECT 1"))
    return {"status": "ok"}


auth = [Depends(authenticated)]
calculated = [*auth, Depends(calculation_slot)]


@app.get("/api/projects", dependencies=auth)
def projects(db=Depends(session)):
    return [dict(id=p.id, name=p.name, version=p.version) for p in db.scalars(select(models.Project).order_by(models.Project.name))]


@app.post("/api/projects", dependencies=calculated, status_code=201)
def create(body: ProjectInput, db=Depends(session)):
    return service.create(db, body)


@app.post("/api/demo", dependencies=calculated, status_code=201)
def create_demo(db=Depends(session)):
    return service.create(db, demo())


@app.get("/api/projects/{project_id}", dependencies=calculated)
def get_project(project_id: UUID, db=Depends(session)):
    version, data = service.read(db, project_id)
    return dict(id=project_id, version=version, project=data, analysis=analyze(data))


@app.put("/api/projects/{project_id}", dependencies=calculated)
def update(project_id: UUID, body: SaveProject, db=Depends(session)):
    return service.update(db, project_id, body)


@app.delete("/api/projects/{project_id}", dependencies=auth)
def delete_project(project_id: UUID, db=Depends(session)):
    return service.delete_project(db, project_id)


@app.post("/api/projects/{project_id}/simulate", dependencies=calculated)
def simulate(project_id: UUID, body: SaveProject, db=Depends(session)):
    return service.update(db, project_id, body, simulate=True)


def prepare_ai_context(project_id: UUID, project: Optional[ProjectInput] = None):
    # A worker owns the session and the slot; neither survives into the LLM wait.
    if not calculation_slots.acquire(timeout=3):
        raise HTTPException(503, "Сейчас выполняются другие расчёты. Повторите запрос через несколько секунд")
    try:
        with SessionLocal() as db:
            _, saved_data = service.read(db, project_id)
        data = project if project is not None else saved_data
        return data, analyze(data)
    finally:
        calculation_slots.release()


@app.post("/api/projects/{project_id}/ai", dependencies=auth)
async def ai(project_id: UUID):
    data, analysis = await run_in_threadpool(prepare_ai_context, project_id)
    return await explain(data, analysis)


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=8000)


class ChatRequest(BaseModel):
    messages: list[ChatMessage] = Field(min_length=1, max_length=10)
    project: Optional[ProjectInput] = None


@app.post("/api/projects/{project_id}/chat", dependencies=auth)
async def chat_copilot(project_id: UUID, body: ChatRequest):
    data, analysis = await run_in_threadpool(prepare_ai_context, project_id, body.project)
    return await chat(data, analysis, [m.model_dump() for m in body.messages])


@app.get("/api/projects/{project_id}/history", dependencies=auth)
def project_history(project_id: UUID, db=Depends(session)):
    return service.get_history(db, project_id)


@app.get("/api/projects/{project_id}/scenarios", dependencies=auth)
def list_scenarios(project_id: UUID, db=Depends(session)):
    return service.list_scenarios(db, project_id)


@app.post("/api/projects/{project_id}/scenarios", dependencies=calculated, status_code=201)
def create_scenario(project_id: UUID, body: CreateScenario, db=Depends(session)):
    return service.create_scenario(db, project_id, body)


@app.delete("/api/projects/{project_id}/scenarios/{scenario_id}", dependencies=auth)
def delete_scenario(project_id: UUID, scenario_id: UUID, db=Depends(session)):
    return service.delete_scenario(db, project_id, scenario_id)


@app.post("/api/projects/{project_id}/level", dependencies=calculated)
def level_project(project_id: UUID, body: LevelProject, db=Depends(session)):
    return service.level(db, project_id, body)

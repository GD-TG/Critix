from datetime import datetime, timezone
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
from app.ai import chat, explain, fallback, configuration_error
from app.db import session, SessionLocal
from app.demo import demo, delivery_demo
from app.engine.analysis import analyze
from app.engine.calendar import PlanningError
from app.schemas import ProjectInput, SaveProject, LevelProject, CreateScenario, ScenarioResponse, UserRegister, UserLogin, UserResponse, RecommendationRequest, StrictModel

from contextlib import asynccontextmanager
from app.schemas import DeliveryEvent, ApplyDeliveryEvent
from app.engine.decision_lab import DecisionCase, evaluate as evaluate_decision_case

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


def get_session_info(request: Request):
    token = request.cookies.get("critix_session", "")
    parts = token.split(".")
    user_id = None
    valid = False
    nonce = ""
    try:
        if len(parts) == 4:
            expires, user_id_str, nonce, digest = parts
            valid = hmac.compare_digest(digest, signature(f"{expires}.{user_id_str}.{nonce}")) and int(expires) > time.time()
            if valid:
                user_id = UUID(user_id_str)
        elif len(parts) == 3:
            expires, nonce, digest = parts
            valid = hmac.compare_digest(digest, signature(f"{expires}.{nonce}")) and int(expires) > time.time()
        with auth_lock:
            valid = valid and nonce not in revoked
    except (ValueError, TypeError):
        valid = False
    if not valid:
        raise HTTPException(401, "Войдите в аккаунт руководителя")
    return {"user_id": user_id, "nonce": nonce}


def authenticated(request: Request):
    return get_session_info(request)


class TransientAdmin:
    id = None
    email = "admin@critix.local"
    name = "Администратор"
    created_at = datetime.now(timezone.utc)


def current_user(request: Request, db=Depends(session)):
    info = get_session_info(request)
    user_id = info.get("user_id")
    if user_id:
        user = db.scalar(select(models.User).where(models.User.id == user_id))
        if user is None:
            raise HTTPException(401, "Учётная запись недоступна")
        return user
    return TransientAdmin()


class DetachedUser:
    def __init__(self, id, email, name):
        self.id = id
        self.email = email
        self.name = name


def detached_current_user(request: Request) -> DetachedUser:
    info = get_session_info(request)
    user_id = info.get("user_id")
    if user_id:
        with SessionLocal() as db:
            user = db.scalar(select(models.User).where(models.User.id == user_id))
            if user is None:
                raise HTTPException(401, "Учётная запись недоступна")
            return DetachedUser(user.id, user.email, user.name)
    return DetachedUser(None, "admin@critix.local", "Администратор")


def project_session(user=Depends(current_user), db=Depends(session)):
    db.info["owner_id"] = user.id
    return db


def set_auth_cookie(response: Response, user_id: UUID | None = None):
    expires = int(time.time()) + 86400 * 7
    nonce = secrets.token_hex(16)
    if user_id is not None:
        payload = f"{expires}.{user_id}.{nonce}"
    else:
        payload = f"{expires}.{nonce}"
    token = f"{payload}.{signature(payload)}"
    response.set_cookie(
        "critix_session",
        token,
        httponly=True,
        secure=os.getenv("COOKIE_SECURE", "true").lower() == "true",
        samesite="strict",
        max_age=86400 * 7,
    )
    return token


@app.middleware("http")
async def security(request: Request, call_next):
    if request.method not in ("GET", "HEAD", "OPTIONS"):
        origin = request.headers.get("origin")
        if origin:
            origin = origin.rstrip("/")
        env = os.environ.get("ENVIRONMENT", os.environ.get("CRITIX_ENV", "development")).lower()
        is_prod = env in ("production", "prod")
        expected = os.environ.get("APP_ORIGIN", "http://localhost")
        allowed = {e.strip().rstrip("/") for e in expected.split(",") if e.strip()}
        if not is_prod or any("localhost" in e or "127.0.0.1" in e for e in allowed) or not allowed:
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
account_attempts = {}
registrations = {}


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


@app.post("/api/auth/register", status_code=201)
def register(body: UserRegister, request: Request, response: Response, db=Depends(session)):
    address = client_address(request)
    now = time.monotonic()
    with auth_lock:
        for key in list(registrations):
            if registrations[key][1] < now:
                del registrations[key]
        count, until = registrations.get(address, (0, now + 600))
        if count >= 10:
            raise HTTPException(429, "Слишком много регистраций с вашего адреса. Подождите 10 минут")
        registrations[address] = (count + 1, until)
    user = service.create_user(db, body.email, body.password, body.name)
    set_auth_cookie(response, user.id)
    return {"id": user.id, "email": user.email, "name": user.name, "created_at": user.created_at}


@app.post("/api/auth/login")
def auth_login(body: UserLogin, request: Request, response: Response, db=Depends(session)):
    address = client_address(request)
    account_key = body.email.strip().lower()
    now = time.monotonic()
    with auth_lock:
        for key in list(attempts):
            if attempts[key][1] < now:
                del attempts[key]
        for key in list(account_attempts):
            if account_attempts[key][1] < now:
                del account_attempts[key]
        ip_count, ip_until = attempts.get(address, (0, now + 300))
        acc_count, acc_until = account_attempts.get(account_key, (0, now + 300))
        if ip_count >= 10:
            raise HTTPException(429, "Слишком много попыток с вашего адреса. Подождите 5 минут")
        if acc_count >= 10:
            raise HTTPException(429, "Слишком много попыток входа для этого аккаунта. Подождите 5 минут")
        user = service.authenticate_user(db, body.email, body.password)
        if not user:
            attempts[address] = (ip_count + 1, ip_until)
            account_attempts[account_key] = (acc_count + 1, acc_until)
            raise HTTPException(401, "Неверный email или пароль")
        attempts.pop(address, None)
        account_attempts.pop(account_key, None)
    set_auth_cookie(response, user.id)
    return {"id": user.id, "email": user.email, "name": user.name, "created_at": user.created_at}


@app.post("/api/auth/demo")
def auth_demo():
    # Keep an explicit response for old clients, without a DB dependency or work.
    raise HTTPException(410, "Публичный демо-вход отключён. Войдите в аккаунт или зарегистрируйтесь")


@app.get("/api/auth/me")
def auth_me(user=Depends(current_user)):
    return {"id": user.id, "email": user.email, "name": user.name, "created_at": user.created_at}


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
    set_auth_cookie(response, None)
    return {"ok": True}


@app.post("/api/logout")
@app.post("/api/auth/logout")
def logout(request: Request, response: Response):
    try:
        info = get_session_info(request)
        nonce = info.get("nonce")
        if nonce:
            with auth_lock:
                revoked[nonce] = int(time.time()) + 86400 * 7
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


@app.get("/api/ai/status", dependencies=auth)
def ai_status():
    reason = configuration_error()
    return {"configured": reason is None, "reason": reason, "provider_verified": False,
            "fallback_available": True}


@app.get("/api/projects", dependencies=auth)
def projects(db=Depends(project_session), user=Depends(current_user)):
    return service.list_projects_for_user(db, user.id)


@app.post("/api/projects", dependencies=calculated, status_code=201)
def create(body: ProjectInput, db=Depends(project_session), user=Depends(current_user)):
    return service.create(db, body, owner_id=user.id)


@app.post("/api/decision-lab/evaluate", dependencies=calculated)
def decision_lab(body: DecisionCase, user=Depends(current_user)):
    return evaluate_decision_case(body)


@app.post("/api/demo", dependencies=calculated, status_code=201)
def create_demo(db=Depends(project_session), user=Depends(current_user)):
    return service.create(db, demo(), owner_id=user.id)


@app.post("/api/demo/deliveries", dependencies=calculated, status_code=201)
def create_delivery_demo(db=Depends(project_session), user=Depends(current_user)):
    return service.create(db, delivery_demo(), owner_id=user.id)


@app.get("/api/projects/{project_id}/delivery-cases", dependencies=calculated)
def delivery_cases(project_id: UUID, db=Depends(project_session)):
    from app.engine.delivery_events import event_catalog
    version, project = service.read(db, project_id)
    return dict(id=project_id, version=version, deliveries=event_catalog(project))


@app.post("/api/projects/{project_id}/delivery-events/preview", dependencies=calculated)
def preview_delivery_event(project_id: UUID, body: DeliveryEvent, db=Depends(project_session)):
    return service.delivery_event(db, project_id, body)


@app.post("/api/projects/{project_id}/delivery-events", dependencies=calculated)
def apply_delivery_event(project_id: UUID, body: ApplyDeliveryEvent, db=Depends(project_session), user=Depends(current_user)):
    return service.delivery_event(db, project_id, body, apply=True, actor_id=user.id)


@app.get("/api/projects/{project_id}", dependencies=calculated)
def get_project(project_id: UUID, db=Depends(project_session)):
    version, data = service.read(db, project_id)
    return dict(id=project_id, version=version, project=data, analysis=analyze(data))


@app.put("/api/projects/{project_id}", dependencies=calculated)
def update(project_id: UUID, body: SaveProject, db=Depends(project_session)):
    return service.update(db, project_id, body)


@app.delete("/api/projects/{project_id}", dependencies=auth)
def delete_project(project_id: UUID, db=Depends(project_session)):
    return service.delete_project(db, project_id)


@app.post("/api/projects/{project_id}/simulate", dependencies=calculated)
def simulate(project_id: UUID, body: SaveProject, db=Depends(project_session)):
    return service.update(db, project_id, body, simulate=True)


ai_concurrency = asyncio.Semaphore(int(os.getenv("MAX_CONCURRENT_AI", "2")))
ai_user_quotas = {}
ai_quota_lock = Lock()
AI_DAILY_BUDGET = int(os.getenv("AI_DAILY_BUDGET_REQUESTS", "500"))
AI_USER_DAILY_BUDGET = int(os.getenv("AI_USER_DAILY_BUDGET", "50"))

ai_global_daily_count = 0
ai_global_daily_reset = 0.0
ai_user_daily_counts = {}


def check_ai_quota(user_id: UUID | None, client_ip: str):
    global ai_global_daily_count, ai_global_daily_reset
    key = str(user_id) if user_id is not None else f"ip_{client_ip}"
    now = time.monotonic()
    with ai_quota_lock:
        if now > ai_global_daily_reset:
            ai_global_daily_count = 0
            ai_global_daily_reset = now + 86400
            ai_user_daily_counts.clear()

        if ai_global_daily_count >= AI_DAILY_BUDGET:
            raise HTTPException(429, "Исчерпан общий суточный лимит обращений к сервису ИИ. Попробуйте снова позже")

        user_daily = ai_user_daily_counts.get(key, 0)
        if user_daily >= AI_USER_DAILY_BUDGET:
            raise HTTPException(429, "Исчерпан суточный лимит запросов к ИИ для вашего аккаунта")

        for k in list(ai_user_quotas):
            if ai_user_quotas[k][1] < now:
                del ai_user_quotas[k]
        count, reset_at = ai_user_quotas.get(key, (0, now + 60))
        if count >= 10:
            raise HTTPException(429, "Превышен лимит запросов к ИИ для вашего аккаунта (максимум 10 в минуту). Пожалуйста, подождите минуту")
        ai_user_quotas[key] = (count + 1, reset_at)
        ai_global_daily_count += 1
        ai_user_daily_counts[key] = user_daily + 1


def prepare_ai_context(project_id: UUID, project: Optional[ProjectInput] = None, owner_id=None, expected_version=None):
    # A worker owns the session and the slot; neither survives into the LLM wait.
    if not calculation_slots.acquire(timeout=3):
        raise HTTPException(503, "Сейчас выполняются другие расчёты. Повторите запрос через несколько секунд")
    try:
        with SessionLocal() as db:
            if owner_id is not None:
                db.info["owner_id"] = owner_id
            version, saved_data = service.read(db, project_id)
            if expected_version is not None and version != expected_version:
                raise HTTPException(409, "Проект изменён. Обновите контекст консультации")
        data = project if project is not None else saved_data
        analysis = analyze(data)
        analysis.update(version=version, scope="draft" if project is not None else "saved")
        return data, analysis
    finally:
        calculation_slots.release()


AI_QUEUE_SECONDS = 1
AI_RESPONSE_SECONDS = 16


async def ai_response(data, analysis, messages=None):
    """Bound the queue separately; degraded service still returns local facts."""
    reason = configuration_error()
    acquired = False
    if reason is None:
        try:
            await asyncio.wait_for(ai_concurrency.acquire(), timeout=AI_QUEUE_SECONDS)
            acquired = True
            async with asyncio.timeout(AI_RESPONSE_SECONDS):
                response = await (explain(data, analysis) if messages is None else chat(data, analysis, messages))
        except TimeoutError:
            reason = "provider_timeout" if acquired else "queue_timeout"
        finally:
            if acquired:
                ai_concurrency.release()
    if reason:
        response = fallback(data, analysis, reason, messages=messages)
    # Metadata returns to our client only; it is not added to the LLM prompt.
    response["context"] = {"version": analysis.get("version"), "scope": analysis.get("scope"),
                           "snapshot_id": analysis.get("snapshot_id"), "as_of": analysis.get("as_of")}
    return response


@app.post("/api/projects/{project_id}/ai", dependencies=auth)
async def ai(project_id: UUID, request: Request = None, user=Depends(detached_current_user)):
    if not isinstance(request, Request):
        if request is not None:
            user = request
        request = None
    check_ai_quota(getattr(user, "id", None), client_address(request) if request is not None else "127.0.0.1")
    data, analysis = await run_in_threadpool(prepare_ai_context, project_id, None, getattr(user, "id", None))
    return await ai_response(data, analysis)


class ChatMessage(StrictModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=8000)


class ChatRequest(StrictModel):
    messages: list[ChatMessage] = Field(min_length=1, max_length=10)
    project: Optional[ProjectInput] = None
    version: int | None = Field(default=None, ge=1)


@app.post("/api/projects/{project_id}/chat", dependencies=auth)
async def chat_copilot(project_id: UUID, body: ChatRequest, request: Request = None, user=Depends(detached_current_user)):
    if not isinstance(request, Request):
        if request is not None:
            user = request
        request = None
    check_ai_quota(getattr(user, "id", None), client_address(request) if request is not None else "127.0.0.1")
    data, analysis = await run_in_threadpool(prepare_ai_context, project_id, body.project, getattr(user, "id", None), body.version)
    return await ai_response(data, analysis, [m.model_dump() for m in body.messages])


@app.post("/api/projects/{project_id}/recommendations", dependencies=calculated)
def recommendations(project_id: UUID, body: RecommendationRequest, db=Depends(project_session)):
    return service.recommendations(db, project_id, body)


@app.get("/api/projects/{project_id}/history", dependencies=auth)
def project_history(project_id: UUID, db=Depends(project_session)):
    return service.get_history(db, project_id)


def scenario_calculation_slot(include_analysis: bool = False):
    if include_analysis:
        yield from calculation_slot()
    else:
        yield


@app.get("/api/projects/{project_id}/scenarios", dependencies=[*auth, Depends(scenario_calculation_slot)])
def list_scenarios(project_id: UUID, limit: int = 20, offset: int = 0, include_analysis: bool = False, db=Depends(project_session)):
    return service.list_scenarios(db, project_id, limit=limit, offset=offset, include_analysis=include_analysis)


@app.get("/api/projects/{project_id}/scenarios/{scenario_id}", dependencies=calculated)
def get_scenario(project_id: UUID, scenario_id: UUID, db=Depends(project_session)):
    return service.get_scenario(db, project_id, scenario_id)


@app.post("/api/projects/{project_id}/scenarios", dependencies=calculated, status_code=201)
def create_scenario(project_id: UUID, body: CreateScenario, db=Depends(project_session)):
    return service.create_scenario(db, project_id, body)


@app.delete("/api/projects/{project_id}/scenarios/{scenario_id}", dependencies=auth)
def delete_scenario(project_id: UUID, scenario_id: UUID, db=Depends(project_session)):
    return service.delete_scenario(db, project_id, scenario_id)


@app.post("/api/projects/{project_id}/level", dependencies=calculated)
def level_project(project_id: UUID, body: LevelProject, db=Depends(project_session)):
    return service.level(db, project_id, body)

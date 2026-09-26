import hashlib
import hmac
import os
import secrets
import time
from typing import Literal, Optional
from uuid import UUID

from fastapi import Depends, FastAPI, HTTPException, Request, Response
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from sqlalchemy import select, text

from app import models, service
from app.ai import chat, explain
from app.db import session
from app.demo import demo
from app.engine.analysis import analyze
from app.engine.calendar import PlanningError
from app.schemas import ProjectInput, SaveProject

app = FastAPI(title="Critix API", docs_url=None, redoc_url=None)


def secret():
    value = os.environ.get("SESSION_SECRET", "")
    if len(value) < 32:
        raise HTTPException(503, "Настройте SESSION_SECRET длиной минимум 32 символа")
    return value.encode()


def signature(value):
    return hmac.new(secret(), value.encode(), hashlib.sha256).hexdigest()


def authenticated(request: Request):
    token = request.cookies.get("critix_session", "")
    try:
        expires, nonce, digest = token.split(".")
        valid = hmac.compare_digest(digest, signature(f"{expires}.{nonce}")) and int(expires) > time.time()
    except (ValueError, TypeError):
        valid = False
    if not valid:
        raise HTTPException(401, "Войдите в аккаунт руководителя")


@app.middleware("http")
async def security(request: Request, call_next):
    if request.method not in ("GET", "HEAD", "OPTIONS"):
        origin = request.headers.get("origin")
        expected = os.environ.get("APP_ORIGIN", "http://localhost:5173")
        if origin and origin != expected:
            return JSONResponse(status_code=403, content={"detail": "Недопустимый источник запроса"})
        if request.headers.get("x-critix-request") != "1":
            return JSONResponse(status_code=403, content={"detail": "Отсутствует заголовок защиты запроса"})
    response = await call_next(request)
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


@app.post("/api/login")
def login(body: Login, request: Request, response: Response):
    now = time.monotonic()
    for key in list(attempts):
        if attempts[key][1] < now:
            del attempts[key]
    address = request.client.host if request.client else "unknown"
    count, until = attempts.get(address, (0, now + 300))
    if count >= 10:
        raise HTTPException(429, "Слишком много попыток. Подождите 5 минут")
    expected = os.environ.get("ADMIN_PASSWORD", "")
    if len(expected) < 12:
        raise HTTPException(503, "Настройте пароль руководителя длиной минимум 12 символов")
    if not secrets.compare_digest(body.password.encode(), expected.encode()):
        attempts[address] = (count+1, until)
        raise HTTPException(401, "Неверный пароль")
    attempts.pop(address, None)
    value = f"{int(time.time())+28800}.{secrets.token_hex(16)}"
    response.set_cookie("critix_session", f"{value}.{signature(value)}", httponly=True,
                        secure=os.getenv("COOKIE_SECURE", "true").lower() == "true", samesite="strict", max_age=28800)
    return {"ok": True}


@app.post("/api/logout")
def logout(response: Response):
    response.delete_cookie("critix_session")
    return {"ok": True}


@app.get("/api/health")
def health(db=Depends(session)):
    db.execute(text("SELECT 1"))
    return {"status": "ok"}


auth = [Depends(authenticated)]


@app.get("/api/projects", dependencies=auth)
def projects(db=Depends(session)):
    return [dict(id=p.id, name=p.name, version=p.version) for p in db.scalars(select(models.Project).order_by(models.Project.name))]


@app.post("/api/projects", dependencies=auth, status_code=201)
def create(body: ProjectInput, db=Depends(session)):
    return service.create(db, body)


@app.post("/api/demo", dependencies=auth, status_code=201)
def create_demo(db=Depends(session)):
    return service.create(db, demo())


@app.get("/api/projects/{project_id}", dependencies=auth)
def get_project(project_id: UUID, db=Depends(session)):
    row = service.load(db, project_id)
    data = service.snapshot(db, row)
    return dict(id=row.id, version=row.version, project=data, analysis=analyze(data))


@app.put("/api/projects/{project_id}", dependencies=auth)
def update(project_id: UUID, body: SaveProject, db=Depends(session)):
    return service.update(db, project_id, body)


@app.delete("/api/projects/{project_id}", dependencies=auth)
def delete_project(project_id: UUID, db=Depends(session)):
    return service.delete_project(db, project_id)


@app.post("/api/projects/{project_id}/simulate", dependencies=auth)
def simulate(project_id: UUID, body: SaveProject, db=Depends(session)):
    return service.update(db, project_id, body, simulate=True)


@app.post("/api/projects/{project_id}/ai", dependencies=auth)
async def ai(project_id: UUID, db=Depends(session)):
    data = service.snapshot(db, service.load(db, project_id))
    return await explain(data, analyze(data))


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=8000)


class ChatRequest(BaseModel):
    messages: list[ChatMessage] = Field(min_length=1, max_length=10)
    project: Optional[ProjectInput] = None


@app.post("/api/projects/{project_id}/chat", dependencies=auth)
async def chat_copilot(project_id: UUID, body: ChatRequest, db=Depends(session)):
    if body.project:
        data = body.project
    else:
        data = service.snapshot(db, service.load(db, project_id))
    return await chat(data, analyze(data), [m.model_dump() for m in body.messages])



@app.get("/api/projects/{project_id}/history", dependencies=auth)
def project_history(project_id: UUID, db=Depends(session)):
    service.load(db, project_id)
    changes = db.scalars(select(models.Change).where(models.Change.project_id == project_id)
                         .order_by(models.Change.version.desc()).limit(20)).all()
    return [{"version": item.version, "created_at": item.created_at,
             "finish": item.analysis.get("finish"),
             "task_count": len(item.snapshot.get("tasks", []))} for item in changes]

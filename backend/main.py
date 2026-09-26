from datetime import date, timedelta
from typing import Literal

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

app = FastAPI(title="Critix API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ScenarioRequest(BaseModel):
    task_id: str
    delay_days: int = Field(ge=0, le=30)

class Task(BaseModel):
    id: str
    title: str
    owner: str
    initials: str
    status: Literal["done", "progress", "planned"]
    start_day: int
    duration: int
    critical: bool = False
    dependency: str | None = None

TASKS = [
    Task(id="brief", title="Бриф и цели проекта", owner="Александра Антипова", initials="АА", status="done", start_day=0, duration=3),
    Task(id="research", title="Анализ конкурентов", owner="Антон Гасников", initials="АГ", status="done", start_day=2, duration=4),
    Task(id="structure", title="Структура и сценарии", owner="Александра Антипова", initials="АА", status="done", start_day=5, duration=4, dependency="research"),
    Task(id="prototype", title="Прототипирование", owner="Дмитрий Зуев", initials="ДЗ", status="progress", start_day=8, duration=3, critical=True, dependency="structure"),
    Task(id="design", title="Дизайн интерфейса", owner="Александра Антипова", initials="АА", status="progress", start_day=10, duration=5, critical=True, dependency="prototype"),
    Task(id="development", title="Разработка", owner="Дмитрий Зуев", initials="ДЗ", status="planned", start_day=15, duration=5, critical=True, dependency="design"),
    Task(id="testing", title="Тестирование", owner="Радмир Зубаеров", initials="РЗ", status="planned", start_day=20, duration=3, critical=True, dependency="development"),
    Task(id="launch", title="Деплой и запуск", owner="Тимур Валиахметов", initials="ТВ", status="planned", start_day=23, duration=2, critical=True, dependency="testing"),
]

@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}

@app.get("/api/projects/1")
def project() -> dict:
    return {
        "id": 1,
        "name": "Редизайн сайта",
        "client": "Digital Lab",
        "status": "В работе",
        "updated": "12 минут назад",
        "start": date(2024, 10, 7).isoformat(),
        "deadline": date(2024, 10, 24).isoformat(),
        "progress": 64,
        "tasks": [task.model_dump() for task in TASKS],
    }

@app.post("/api/projects/1/simulate")
def simulate(request: ScenarioRequest) -> dict:
    task = next((item for item in TASKS if item.id == request.task_id), None)
    if task is None:
        return {"detail": "Task not found"}
    affected = 3 if request.delay_days > 0 else 0
    return {
        "task_id": task.id,
        "delay_days": request.delay_days,
        "project_delay_days": request.delay_days,
        "affected_tasks": affected,
        "requires_decision": request.delay_days > 0,
        "new_deadline": (date(2024, 10, 24) + timedelta(days=request.delay_days)).isoformat(),
        "recommendation": "Добавить участника в разработку, чтобы сохранить первоначальный срок." if request.delay_days else "Изменение не влияет на срок проекта.",
    }

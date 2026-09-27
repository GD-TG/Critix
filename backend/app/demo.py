from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from app.schemas import Assignee, Dependency, ProjectInput, Skill, Task


def demo():
    zone = ZoneInfo("Asia/Yekaterinburg")
    now = datetime.now(zone)
    start = (now - timedelta(days=now.weekday())).replace(hour=9, minute=0, second=0, microsecond=0)
    
    names = [
        "Анализ требований и скоупа",
        "Проектирование архитектуры",
        "UI/UX Дизайн интерфейса",
        "Проектирование БД и схемы данных",
        "Разработка Backend API сервисов",
        "Разработка Frontend компонентов",
        "Интеграция API и UI",
        "Настройка CI/CD и инфраструктуры",
        "Аудит безопасности и прав доступа",
        "Комплексное QA тестирование",
        "Нагрузочное тестирование",
        "Веха: Релиз в прод и сдача заказчику"
    ]
    durations = [8, 8, 16, 8, 24, 24, 16, 16, 8, 16, 8, 0]
    people = ["pm", "be", "ux", "be", "be", "fe", "fe", "devops", "be", "qa", "qa", "pm"]
    priorities = ["high", "high", "medium", "medium", "urgent", "high", "high", "medium", "urgent", "high", "medium", "urgent"]
    req_skills = [
        ["PM"],
        ["Architecture"],
        ["Figma", "UI/UX"],
        ["SQL", "Architecture"],
        ["Python", "SQL"],
        ["React", "TypeScript"],
        ["Python", "React"],
        ["Docker", "CI/CD"],
        ["Security"],
        ["QA"],
        ["QA", "Python"],
        ["PM"]
    ]
    
    tasks = [
        Task(
            id=str(i + 1),
            name=name,
            duration_minutes=hours * 60,
            assignee_id=person,
            priority=prio,
            required_skills=skills
        )
        for i, (name, hours, person, prio, skills) in enumerate(zip(names, durations, people, priorities, req_skills))
    ]
    
    # Первая задача уже выполнена
    tasks[0] = tasks[0].model_copy(update=dict(
        status="done",
        actual_start=start,
        actual_finish=start.replace(hour=18)
    ))
    
    # Цепочка технологических зависимостей
    pairs = [
        (1, 2),  # Анализ -> Архитектура
        (1, 3),  # Анализ -> Дизайн
        (2, 4),  # Архитектура -> БД
        (4, 5),  # БД -> Backend API
        (3, 6),  # Дизайн -> Frontend
        (5, 7),  # Backend API -> Интеграция
        (6, 7),  # Frontend -> Интеграция
        (2, 8),  # Архитектура -> Инфраструктура
        (7, 9),  # Интеграция -> Аудит безопасности
        (7, 10), # Интеграция -> QA тестирование
        (10, 11),# QA -> Нагрузочное тестирование
        (8, 12), # Инфраструктура -> Релиз
        (9, 12), # Безопасность -> Релиз
        (11, 12) # Нагрузочное -> Релиз
    ]
    
    assignees = [
        Assignee(
            id="pm",
            name="Алексей Смирнов",
            role="Project Manager",
            skills=[Skill(name="PM", level="expert"), Skill(name="QA", level="advanced")]
        ),
        Assignee(
            id="be",
            name="Мария Васильева",
            role="Lead Backend (Python)",
            skills=[Skill(name="Python", level="expert"), Skill(name="SQL", level="expert"), Skill(name="Security", level="intermediate")]
        ),
        Assignee(
            id="fe",
            name="Денис Ковалёв",
            role="Senior Frontend (React)",
            skills=[Skill(name="React", level="expert"), Skill(name="TypeScript", level="expert"), Skill(name="UI/UX", level="intermediate")]
        ),
        Assignee(
            id="ux",
            name="Ирина Павлова",
            role="UI/UX Дизайнер",
            skills=[Skill(name="Figma", level="expert"), Skill(name="UI/UX", level="expert")]
        ),
        Assignee(
            id="qa",
            name="Елена Соколова",
            role="QA Automation Lead",
            skills=[Skill(name="QA", level="expert"), Skill(name="Python", level="intermediate")]
        ),
        Assignee(
            id="devops",
            name="Артём Морозов",
            role="DevOps Engineer",
            skills=[Skill(name="Docker", level="expert"), Skill(name="CI/CD", level="expert"), Skill(name="Linux", level="expert")]
        )
    ]

    return ProjectInput(
        name="Запуск клиентского портала",
        start=start,
        deadline=start + timedelta(days=16, hours=9),
        tasks=tasks,
        assignees=assignees,
        dependencies=[Dependency(predecessor_id=str(a), successor_id=str(b)) for a, b in pairs]
    )


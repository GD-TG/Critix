from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from app.schemas import Assignee, Dependency, ProjectInput, Skill, Task, Delivery


def _add_business_days(dt: datetime, add_days: int) -> datetime:
    res = dt
    while add_days > 0:
        res += timedelta(days=1)
        if res.weekday() < 5:
            add_days -= 1
    return res


def _sub_business_days(dt: datetime, sub_days: int) -> datetime:
    res = dt
    while sub_days > 0:
        res -= timedelta(days=1)
        if res.weekday() < 5:
            sub_days -= 1
    return res


def demo():
    zone = ZoneInfo("Asia/Yekaterinburg")
    now = datetime.now(zone)
    start = _sub_business_days(now, 15).replace(hour=9, minute=0, second=0, microsecond=0)
    
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
    
    # Первая задача уже выполнена (в прошлом)
    task1_finish = _add_business_days(start, 1).replace(hour=18)
    tasks[0] = tasks[0].model_copy(update=dict(
        status="done",
        actual_start=start,
        actual_finish=task1_finish
    ))

    # Вторая и третья задачи in_progress (начались недавно)
    tasks[1] = tasks[1].model_copy(update=dict(
        status="in_progress",
        actual_start=_sub_business_days(now, 2).replace(hour=10)
    ))
    tasks[2] = tasks[2].model_copy(update=dict(
        status="in_progress",
        actual_start=_sub_business_days(now, 1).replace(hour=11)
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

    calc_finish = _add_business_days(start, 11)
    deadline = _add_business_days(calc_finish, 3).replace(hour=18, minute=0, second=0, microsecond=0)

    return ProjectInput(
        name="Запуск клиентского портала",
        start=start,
        deadline=deadline,
        tasks=tasks,
        assignees=assignees,
        dependencies=[Dependency(predecessor_id=str(a), successor_id=str(b)) for a, b in pairs]
    )


def delivery_demo(as_of=None):
    """A supplier commitment and eight internal tasks; no supplier working schedule."""
    now = (as_of or datetime.now(ZoneInfo("Asia/Yekaterinburg"))).astimezone(ZoneInfo("Asia/Yekaterinburg"))
    monday = (now - timedelta(days=now.weekday())).replace(hour=9, minute=0, second=0, microsecond=0)
    start, upcoming = monday - timedelta(days=7), monday + timedelta(days=7)
    tasks = [
        Task(id="requirements", name="Требования согласованы", duration_minutes=480, status="done", actual_start=start, actual_finish=start.replace(hour=18)),
        Task(id="architecture", name="Схема интеграции согласована", duration_minutes=480, status="done", actual_start=start + timedelta(days=1), actual_finish=start + timedelta(days=1, hours=9)),
        Task(id="docs", name="Подготовка инструкции", duration_minutes=480, not_before=upcoming, assignee_id="pm"),
        Task(id="training", name="Подготовка поддержки", duration_minutes=480, assignee_id="pm"),
        Task(id="integration", name="Интеграция оплаты", duration_minutes=480, assignee_id="dev"),
        Task(id="qa", name="Проверка оплаты", duration_minutes=480, assignee_id="qa"),
        Task(id="report", name="Дополнительный отчёт по платежам", duration_minutes=1440),
        Task(id="launch", name="Запуск пилота", duration_minutes=0),
    ]
    links = [("requirements", "architecture"), ("requirements", "docs"), ("docs", "training"),
             ("architecture", "integration"), ("integration", "qa"), ("qa", "launch"),
             ("report", "launch"), ("training", "launch")]
    return ProjectInput(name="Пилот: оплата от внешнего подрядчика", start=start,
                        deadline=upcoming + timedelta(days=4, hours=9), tasks=tasks,
                        assignees=[Assignee(id="pm", name="Руководитель проекта"), Assignee(id="dev", name="Команда интеграции"),
                                   Assignee(id="qa", name="Команда проверки")],
                        dependencies=[Dependency(predecessor_id=a, successor_id=b) for a, b in links],
                        optional_task_ids=["report"],
                        deliveries=[Delivery(id="payment-api", name="API оплаты", contractor="Внешний подрядчик",
                                             promised_at=upcoming, expected_at=upcoming, review_days=1,
                                             dependent_task_ids=["integration", "report"])])


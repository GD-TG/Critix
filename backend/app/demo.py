from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from app.schemas import Assignee, Dependency, ProjectInput, Skill, Task


def demo():
    zone = ZoneInfo("Asia/Yekaterinburg")
    start = datetime(2026, 9, 21, 9, tzinfo=zone)
    names = ["Требования", "Архитектура", "Дизайн интерфейса", "Модель данных", "Backend API",
             "Frontend", "Интеграция", "Проверка безопасности", "Приёмочное тестирование", "Релиз"]
    durations = [8, 8, 16, 8, 24, 24, 16, 8, 16, 4]
    people = ["pm", "be", "ux", "be", "be", "fe", "fe", "be", "pm", "be"]
    priorities = ["high", "high", "medium", "medium", "urgent", "high", "high", "urgent", "high", "urgent"]
    req_skills = [
        ["PM"], ["Architecture"], ["Figma"], ["SQL"], ["Python", "SQL"],
        ["React", "TypeScript"], ["Python", "React"], ["Security"], ["PM", "QA"], ["DevOps"]
    ]
    
    tasks = [
        Task(
            id=str(i+1),
            name=name,
            duration_minutes=hours*60,
            assignee_id=person,
            priority=prio,
            required_skills=skills
        )
        for i, (name, hours, person, prio, skills) in enumerate(zip(names, durations, people, priorities, req_skills))
    ]
    tasks[0] = tasks[0].model_copy(update=dict(status="done", actual_start=start,
                                             actual_finish=start.replace(hour=18)))
    pairs = [(1, 2), (1, 3), (2, 4), (4, 5), (3, 6), (5, 7), (6, 7), (7, 8), (7, 9), (8, 10), (9, 10)]
    
    assignees = [
        Assignee(id="pm", name="Алексей", skills=[Skill(name="PM", level="expert"), Skill(name="QA", level="advanced")]),
        Assignee(id="be", name="Мария", skills=[Skill(name="Python", level="expert"), Skill(name="SQL", level="expert"), Skill(name="Security", level="intermediate")]),
        Assignee(id="ux", name="Ирина", skills=[Skill(name="Figma", level="expert"), Skill(name="UI/UX", level="expert")]),
        Assignee(id="fe", name="Денис", skills=[Skill(name="React", level="expert"), Skill(name="TypeScript", level="advanced")])
    ]

    return ProjectInput(
        name="Запуск клиентского портала",
        start=start,
        deadline=start+timedelta(days=15, hours=9),
        tasks=tasks,
        assignees=assignees,
        dependencies=[Dependency(predecessor_id=str(a), successor_id=str(b)) for a, b in pairs]
    )

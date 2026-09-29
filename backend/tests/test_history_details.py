from app.service import describe_changes


def test_history_describes_dependencies_calendars_team_and_project_fields():
    before = {"tasks": [{"id": "a", "name": "A", "duration_minutes": 60}], "dependencies": [{"predecessor_id": "a", "successor_id": "b", "kind": "FS"}], "assignees": [{"id": "p", "name": "P", "calendar": {}}], "calendar": {}, "deadline": "old"}
    import copy
    after = copy.deepcopy(before)
    after["tasks"][0]["duration_minutes"] = 120
    after["dependencies"][0]["kind"] = "SS"
    after["assignees"][0]["calendar"] = {"week": {}}
    after["calendar"] = {"week": {}}
    after["deadline"] = "new"
    details = describe_changes(before, after)
    assert any("Связь" in d and "тип" in d for d in details)
    assert any("Участник" in d and "календарь" in d for d in details)
    assert any("Задача" in d and "длительность" in d for d in details)
    assert "Изменено: Календарь проекта" in details
    assert "Изменено: Дедлайн" in details
    assert describe_changes(before, before) == []

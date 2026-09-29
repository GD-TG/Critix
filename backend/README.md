# Critix Backend Service

[![Python](https://img.shields.io/badge/Python-3.12-3776AB?style=flat&logo=python&logoColor=white)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688?style=flat&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-17-4169E1?style=flat&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![SQLAlchemy](https://img.shields.io/badge/SQLAlchemy-2.0-D71F00?style=flat&logo=sqlalchemy&logoColor=white)](https://www.sqlalchemy.org/)
[![pytest](https://img.shields.io/badge/pytest-63_passed-0A9EDC?style=flat&logo=pytest&logoColor=white)](tests)

Бэкенд-сервис системы Critix на FastAPI (Python 3.12). Включает детерминированное математическое ядро метода критического пути (CPM), многопользовательский слой управления проектами и изолированный AI Copilot.

---

## Архитектура модулей

```text
backend/app/
├── engine/                 # Детерминированное математическое ядро (чистый Python, без IO)
│   ├── analysis.py         # Прямой/обратный проход CPM, топологическая сортировка, резервы времени
│   ├── calendar.py         # Минутная сетка рабочих интервалов, часовые пояса, праздники и отпуска
│   └── leveling.py         # Эвристическое выравнивание ресурсов (Leveling)
├── models.py               # Декларативные модели SQLAlchemy 2.0 (PostgreSQL)
├── schemas.py              # Pydantic v2 схемы валидации (строгие ограничения: 200 задач, 2000 связей)
├── service.py              # Сервисный слой: управление агрегатами проектов, сценарии, история, блокировки
├── ai.py                   # Интеграция с LLM (OpenAI-compatible), аудит и чат (без удержания транзакций БД)
└── main.py                 # FastAPI приложение, REST endpoints, авторизация, Rate Limiting, CORS
```

---

## Ключевые архитектурные гарантии

1. **Изоляция математики от ИИ:**
   - LLM **никогда** не вычисляет даты, не двигает связи и не имеет прямого доступа к записи в базу данных.
   - Все расчеты выполняет модуль `engine/`. ИИ получает только готовый дамп анализа для генерации текстовых рекомендаций.
2. **Безопасность сессий и транзакций БД:**
   - Перед отправкой сетевого HTTP-запроса к модели ИИ сессия SQLAlchemy закрывается (`session.close()`). Задержки внешнего AI-провайдера не исчерпывают пул соединений к PostgreSQL.
   - Подготовка контекста для ИИ выполняется в пуле потоков через `run_in_threadpool`, освобождая расчётные семафоры до сетевого вызова.
3. **Контроль квот и бюджетов ИИ:**
   - Глобальный лимит: 500 запросов к ИИ в сутки на весь инстанс (`AI_DAILY_BUDGET`).
   - Пользовательский лимит: 50 запросов в сутки и не более 10 запросов в минуту.
4. **Изоляция данных между организациями/пользователями:**
   - Проекты привязаны к `owner_id`. Попытка обращения к чужому проекту возвращает `404 Not Found`.
   - Публичный демо-вход отключён (`/api/auth/demo` возвращает HTTP 410 Gone).
5. **On-Demand расчет сценариев:**
   - Эндпоинт списка сценариев (`GET /api/projects/{id}/scenarios`) возвращает метаданные без пересчёта графа (`include_analysis=False`). Тяжелый CPM-анализ выполняется только по явному запросу (`/analyze`).
6. **Ограничение нагрузки (DDoS Protection):**
   - Максимум 2 параллельных тяжелых расчёта CPM через семафор `calculation_slots`. Ожидание до 3 секунд, затем возврат HTTP 503.

---

## Локальный запуск

### 1. Виртуальное окружение и зависимости

```powershell
Set-Location C:\Code\Critix\backend
python -m venv ..\.venv
..\.venv\Scripts\python.exe -m pip install -r requirements.lock
..\.venv\Scripts\python.exe -m pip install --no-deps -e .
```

### 2. Применение миграций

```powershell
..\.venv\Scripts\python.exe -c "from dotenv import load_dotenv; load_dotenv('../.env'); from alembic.config import main; main(argv=['upgrade', 'head'])"
```

### 3. Запуск сервера Uvicorn

```powershell
..\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000 --env-file ../.env
```

---

## Тестирование

Запуск набора юнит- и интеграционных тестов:

```powershell
..\.venv\Scripts\python.exe -m pytest tests -q
```

Покрытие тестами включает:
- Расчет ранних/поздних дат, свободных и полных резервов времени.
- Защиту от циклических зависимостей в графе (алгоритм Кана).
- Конфликты версий при параллельном сохранении (HTTP 409).
- Изоляцию аккаунтов и проверку прав доступа.
- Лимиты на объем задач, длительности и расписания.
- Работу квот и суточных бюджетов обращений к AI Copilot.

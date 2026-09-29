# Critix

Детерминированная система управления проектами (CPM-движок) с AI-аналитиком и сценарным моделированием (What-If) для руководителей и проектных команд.

Critix совмещает математическую строгость расчёта расписаний (метод критического пути) с интерпретацией рисков через LLM. Ключевой принцип: **ИИ не вычисляет даты и не мутирует граф проекта** — расчёты выполняет исключительно отказоустойчивый детерминированный движок на Python, а нейросеть привлекается для генерации executive-отчётов и консультаций.

---

## Что реализовано

- **Граф зависимостей и валидация:** Поддержка всех 4 типов связей (FS, SS, FF, SF) с положительными и отрицательными лагами. Автоматическое обнаружение и отклонение циклических зависимостей (алгоритм Кана).
- **Детерминированный CPM-движок:** Прямой и обратный проход, ранние и поздние даты, расчёт полного резерва времени (`slack_minutes`). Целевой дедлайн изолирован от прогнозного завершения.
- **Объяснение причин сроков (Traceability):** Прозрачный блок в карточке каждой задачи («Что определяет срок»): определяющие связи, лаги, ограничения «не ранее», календарные переносы и фактические даты.
- **Производственные календари и часовые пояса:** Календари проекта и исполнителей, рабочие интервалы внутри дня, исключения и отпуска, хранение в UTC с конвертацией в IANA-таймзону проекта.
- **Ресурсный анализ и выравнивание:** Расчёт загрузки исполнителей в процентах (>100% FTE), поиск ресурсных конфликтов и эвристическое предложение по выравниванию (Leveling).
- **Сценарное моделирование (What-If):** Создание до 20 изолированных сценариев («Что если задача задержится?»). Анализ выполняется on-demand без перегрузки БД и блокировок основного плана.
- **Сохранность данных и защита от конфликтов (HTTP 409):**
  - Механизм `DraftBanner`: при расхождении серверной и локальной версий черновик не уничтожается, сохраняется в `localStorage` и подсвечивает точный diff.
  - Изоляция версий и предотвращение потери данных при одновременной работе нескольких менеджеров.
- **Контроль бюджетов и Rate Limiting ИИ:**
  - Глобальный лимит `AI_DAILY_BUDGET=500` вызовов/сутки.
  - Персональная квота: 50 вызовов/сутки на пользователя, не более 10 запросов в минуту.
  - Отвязка ожидания LLM от сессий PostgreSQL (соединение БД закрывается до сетевого запроса к нейросети).
- **Изоляция аккаунтов и безопасность:**
  - Строгая изоляция проектов по `owner_id`. Доступ к чужим проектам возвращает HTTP 404.
  - Публичный демо-вход отключён (HTTP 410). Загрузка демо-проекта доступна авторизованному пользователю.
  - Защита от stale responses: генераторы сессий `authGen` и `sessionGen` отбрасывают запоздалые сетевые ответы после смены аккаунта.
- **Интерфейс и экспорт:** Интерактивный таймлайн (Гант), граф на React Flow, таблица задач, карточки рисков, импорт/экспорт JSON (с валидацией до 200 задач, 2000 связей, 100 исполнителей), экспорт/импорт CSV, печать и экспорт отчёта в Markdown.

---

## Архитектура и стек

```text
React 19 (Mantine, React Flow)
       │ HTTP / JSON (CSRF-safe, HttpOnly Cookie)
       ▼
FastAPI Application (Python 3.12)
  ├── Auth & Rate Limiter (Session Gen, AI Quota Manager)
  ├── Service Layer (Aggregation, Drafts, Versioning)
  ├── Deterministic CPM Engine (Graph, Calendar Grid, Leveling)
  │     └── PostgreSQL 17 (SQLAlchemy 2.0, Alembic)
  └── Async AI Copilot (OpenAI-compatible LLM Client, 15s Timeout, No DB Lock)
```

- **Frontend:** React 19, TypeScript, Vite, Mantine UI v7, React Flow (@xyflow/react), Tabler Icons.
- **Backend:** Python 3.12, FastAPI, Pydantic v2, SQLAlchemy 2.0 (async/sync engine), Alembic.
- **База данных:** PostgreSQL 17.
- **Инфраструктура:** Docker Compose, Caddy (Reverse Proxy).

---

## Быстрый старт

### 1. Docker Compose (Рекомендуемый)

Требуется установленный Docker Desktop:

```powershell
# Клонирование и переход
Set-Location C:\Code\Critix

# Настройка переменных окружения
Copy-Item .env.example .env
# Задайте надежные пароли в .env (POSTGRES_PASSWORD, ADMIN_PASSWORD, SESSION_SECRET)

# Сборка и запуск контейнеров
docker compose up -d --build
docker compose ps
```

Приложение доступно по адресу: **http://localhost** (Caddy автоматически проксирует фронтенд и API, миграции накатываются на старте).

### 2. Локальная разработка (Windows)

Требуются: Python 3.12+, Node.js 22+, локальный PostgreSQL.

#### Backend:
```powershell
Set-Location C:\Code\Critix
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r backend\requirements.lock
.\.venv\Scripts\python.exe -m pip install --no-deps -e ./backend

# Применение миграций БД
Set-Location C:\Code\Critix\backend
..\.venv\Scripts\python.exe -c "from dotenv import load_dotenv; load_dotenv('../.env'); from alembic.config import main; main(argv=['upgrade', 'head'])"

# Запуск Uvicorn (порт 8000)
..\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000 --env-file ../.env
```

#### Frontend:
```powershell
Set-Location C:\Code\Critix\frontend
npm ci
npm run dev
```
Фронтенд доступен по адресу: **http://localhost:5173** (Vite проксирует `/api` на бэкенд).

---

## Тестирование и верификация

Все тесты полностью автоматизированы и проверяют стабильность ядра, защиту от регрессий и безопасность:

```powershell
# 1. Проверка frontend (линтер, типы, тесты)
npm --prefix frontend test
npm --prefix frontend run build

# 2. Проверка backend (юнит- и интеграционные тесты)
.\.venv\Scripts\python.exe -m pytest backend/tests -q

# 3. Полный прогон интеграционных тестов в изолированном Docker Compose
docker compose -p critix-tests -f compose.test.yaml up --build --abort-on-container-exit --exit-code-from test
docker compose -p critix-tests -f compose.test.yaml down
```

### Метрики качества (30.09.2026):
- **Backend:** 63 теста пройдено успешно (0 ошибок, 5 skipped для контейнерной БД без флага). Проверены CPM-логика, циклы, валидация лимитов, изоляция пользователей, бюджеты ИИ, сценарные вычисления.
- **Frontend:** 22 теста пройдены успешно (таймзоны, `DraftBanner`, разрешение версий 409, отсечение stale responses, CSV-парсинг).
- **Сборка:** TypeScript и Vite компилируются чисто без ошибок.

---

## Документация проекта

- **[Архитектура и границы реализации](docs/architecture.md)** — математическая модель, ограничения, изоляция модулей.
- **[Запуск и эксплуатация](docs/operations.md)** — настройка переменных окружения, развертывание и траблшутинг.
- **[Текущее состояние системы](docs/current-state.md)** — детальный статус модулей и закрытие технических задач.
- **[Технический аудит безопасности](docs/technical-audit-2026-09-30.md)** — матрица уязвимостей (A01-A25) и отчет об их устранении.
- **[Математическая модель CPM](docs/mathematical-model.md)** — алгоритмы топологической сортировки, расчет ранних/поздних дат и лагов.
- **[Конкурентный анализ](docs/competitive-analysis.md)** — дифференциаторы против Jira, MS Project и Asana.
- **[Руководство по Backend](backend/README.md)** — внутренняя структура FastAPI, сервисный слой, движок CPM.
- **[Руководство по Frontend](frontend/README.md)** — архитектура клиентского приложения, Mantine UI, управление стейтом.

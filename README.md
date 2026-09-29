<div align="center">

# Critix

**Детерминированная система календарно-сетевого планирования (CPM-движок)**  
с аналитическим AI-ассистентом и сценарным моделированием (What-If)

[![Python](https://img.shields.io/badge/Python-3.12-3776AB?style=flat&logo=python&logoColor=white)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688?style=flat&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-17-4169E1?style=flat&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![SQLAlchemy](https://img.shields.io/badge/SQLAlchemy-2.0-D71F00?style=flat&logo=sqlalchemy&logoColor=white)](https://www.sqlalchemy.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=flat&logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7+-3178C6?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-6-646CFF?style=flat&logo=vite&logoColor=white)](https://vitejs.dev/)
[![Mantine](https://img.shields.io/badge/Mantine_UI-v7-339AF0?style=flat&logo=mantine&logoColor=white)](https://mantine.dev/)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?style=flat&logo=docker&logoColor=white)](https://www.docker.com/)
[![Caddy](https://img.shields.io/badge/Caddy-2-22B573?style=flat&logo=caddy&logoColor=white)](https://caddyserver.com/)
[![Tests](https://img.shields.io/badge/Tests-85_passed-success?style=flat&logo=checkmarx&logoColor=white)](backend/tests)

</div>

---

## Архитектурный принцип

> **Ключевое правило:** Нейросеть **не вычисляет даты** и **не мутирует граф проекта**.  
> Все календарные и ресурсные расчёты выполняет строго детерминированное математическое ядро на Python. LLM привлекается исключительно для интерпретации рисков, подготовки executive-отчётов и рекомендаций на основе уже рассчитанного снимка данных.

---

## Технологический стек

| Слой | Технологии | Назначение |
| :--- | :--- | :--- |
| **Backend Core** | `Python 3.12`, `FastAPI`, `Pydantic v2` | Высокопроизводительный асинхронный REST API и валидация данных |
| **CPM Engine** | Pure Python (чистая математика, 0 внешних IO) | Топологическая сортировка (алгоритм Кана), расчёт ранних/поздних дат, резервов и выравнивания |
| **Database & ORM** | `PostgreSQL 17`, `SQLAlchemy 2.0`, `Alembic` | Реляционное хранилище, строгая изоляция по `owner_id`, версионирование |
| **Frontend Core** | `React 19`, `TypeScript 5.7`, `Vite 6` | Клиентское SPA-приложение с предиктивным UI |
| **UI & Graph** | `Mantine UI v7`, `@xyflow/react` (React Flow), `Lucide Icons` | Интерактивный таймлайн, граф связей, адаптивные карточки и сворачиваемый аккордеон |
| **AI Integration** | OpenAI-compatible API (`gpt-4o-mini` / vLLM) | Аналитический аудит, генерация Markdown-отчётов, отвязка от транзакций БД |
| **DevOps & Proxy** | `Docker Compose`, `Caddy v2` | Контейнеризация, автоматический reverse proxy, HTTPS, раздача статики |

---

## Возможности системы

### 1. Детерминированное ядро расчёта расписаний (CPM)
- **Полная матрица связей:** Поддержка всех 4 типов зависимостей — `FS` (Финиш-Старт), `SS` (Старт-Старт), `FF` (Финиш-Финиш), `SF` (Старт-Финиш) с положительными и отрицательными лагами.
- **Топологическая сортировка:** Валидация циклических зависимостей по алгоритму Кана с точным указанием узлов, образующих цикл.
- **Расчёт резервов времени:** Вычисление ранних/поздних дат (`early_start`, `early_finish`, `late_start`, `late_finish`) и полного резерва (`slack_minutes`). Задачи с нулевым резервом автоматически помечаются как критический путь.
- **Traceability (Объяснимость сроков):** В карточке каждой задачи явно выводится цепочка факторов: определяющая входящая связь, лаг, ограничение «не ранее» (`early_start_constraint`), календарный сдвиг или фактическое выполнение.

### 2. Производственные календари и таймзоны
- **Интервальная сетка:** Календари проекта и индивидуальные календари исполнителей с поминутной точностью рабочих интервалов.
- **Исключения и праздники:** Учёт сокращённых дней, отпусков и нерабочих праздников.
- **Стандарт времени:** Все расчёты и хранение ведутся в `UTC`. Пользователь видит даты в IANA-таймзоне проекта (например, `Europe/Moscow`).

### 3. Ресурсный анализ и выравнивание (Leveling)
- **Контроль перегрузки:** Расчёт пиковой загрузки ресурсов в процентном выражении (>100% FTE).
- **Эвристическое выравнивание:** Поиск ресурсных конфликтов и предложение переноса некритических задач в пределах доступного резерва (`slack`).

### 4. Сценарное моделирование (What-If)
- **Изолированные сценарии:** До 20 сценариев на проект («Что если задача задержится на 5 дней?», «Что если сменится исполнитель?»).
- **On-Demand вычисления:** Список сценариев загружается мгновенно без перегрузки БД; полный перерасчёт CPM запускается по явному запросу менеджера.

### 5. Безопасность данных и конкурентная работа
- **Разрешение конфликтов (HTTP 409):** Контроль версий (`version`). При конкурентном изменении проекта механизм `DraftBanner` предотвращает потерю данных, сохраняя локальный черновик и отображая детальный diff (`computeProjectDiff`).
- **Защита от состояния гонки:** Генераторы сессий `authGen` и `sessionGen` отсекают запаздывающие сетевые ответы при переключении контекста.
- **Строгая изоляция данных:** Все проекты привязаны к `owner_id`. Доступ к чужим сущностям возвращает HTTP 404 (без утечки метаданных). Демо-вход без авторизации отключён (HTTP 410).

### 6. Контроль квот и безопасность AI-сервиса
- **Защита пула БД:** Сессия PostgreSQL закрывается (`session.close()`) **до** отправки сетевого запроса к LLM. Задержки внешнего провайдера не блокируют соединения к базе.
- **Лимиты бюджетов:** Глобальный лимит `AI_DAILY_BUDGET=500` запросов/сутки на инстанс; персональная квота 50 запросов/сутки и не более 10 запросов/мин.
- **DDoS-семафор:** Не более 2 параллельных тяжёлых расчётов CPM через `calculation_slots`.

### 7. Интерфейс, адаптивность и отчётность
- **Интерактивные представления:** Диаграмма Ганта, сетевой граф на React Flow, адаптивная таблица задач, карточки рисков.
- **Компактная шапка метрик:** Сворачиваемый аккордеон ключевых показателей (`MetricsGrid`) с сохранением состояния в `localStorage` (экономит до 600px на мобильных экранах).
- **Полная мобильная адаптация:** Адаптивные формы, перенос карточек недели/исключений в календаре, защита от горизонтального скролла страницы.
- **Экспорт и импорт:** Двусторонний импорт/экспорт проектов в JSON и задач в CSV со строгой валидацией лимитов, экспорт исполнительного отчёта в Markdown и печать PDF.

---

## Архитектура системы

```text
               ┌────────────────────────────────────────────────────────┐
               │              Frontend: React 19 + Mantine              │
               │   (Gantt Timeline, React Flow Graph, Tasks, Team)      │
               └───────────────────────────┬────────────────────────────┘
                                           │ HTTP / JSON (HttpOnly Cookie, CSRF-safe)
                                           ▼
┌───────────────────────────────────────────────────────────────────────────────────────┐
│                           FastAPI Application (Python 3.12)                           │
│                                                                                       │
│   ┌─────────────────────┐   ┌────────────────────────┐   ┌────────────────────────┐   │
│   │   Auth & Security   │   │     Service Layer      │   │    Async AI Copilot    │   │
│   │ (SessionGen, Rate)  │   │ (Aggregates, Versions) │   │ (No DB lock, 15s time) │   │
│   └─────────────────────┘   └───────────┬────────────┘   └────────────────────────┘   │
│                                         │                                             │
│                       ┌─────────────────┴─────────────────┐                           │
│                       │    Deterministic Engine (Pure)    │                           │
│                       │  ├── CPM Analysis (Kahn, Slack)   │                           │
│                       │  ├── Working Calendar Grid (UTC)  │                           │
│                       │  └── Resource Leveling Heuristic  │                           │
│                       └─────────────────┬─────────────────┘                           │
└─────────────────────────────────────────┼─────────────────────────────────────────────┘
                                          │ SQLAlchemy 2.0 (Async/Sync)
                                          ▼
                               ┌─────────────────────┐
                               │    PostgreSQL 17    │
                               │ (Strict Owner UUID) │
                               └─────────────────────┘
```

---

## Быстрый старт

### Вариант 1. Запуск в Docker Compose (Рекомендуемый)

Требуется Docker Desktop с поддержкой Compose v2.

```powershell
# 1. Перейти в каталог проекта
cd C:\Code\Critix

# 2. Создать файл окружения (задайте секреты при необходимости)
Copy-Item .env.example .env

# 3. Собрать и запустить сервисы
docker compose up -d --build

# 4. Проверить статус контейнеров
docker compose ps
```

Приложение доступно по адресу: **http://localhost**  
- Caddy автоматически маршрутизирует статику фронтенда и API-запросы (`/api/*`).
- Миграции базы данных накатываются автоматически при старте сервиса `backend`.

### Вариант 2. Локальная разработка (без Docker)

#### Требования:
- Python 3.12+
- Node.js 22+
- Локальный экземпляр PostgreSQL 16+

#### Запуск Backend:
```powershell
cd C:\Code\Critix
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r backend\requirements.lock
.\.venv\Scripts\python.exe -m pip install --no-deps -e ./backend

# Применение миграций Alembic
cd backend
..\.venv\Scripts\python.exe -c "from dotenv import load_dotenv; load_dotenv('../.env'); from alembic.config import main; main(argv=['upgrade', 'head'])"

# Запуск API-сервера
..\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000 --env-file ../.env
```

#### Запуск Frontend:
```powershell
cd C:\Code\Critix\frontend
npm ci
npm run dev
```
Фронтенд будет доступен по адресу: **http://localhost:5173** (Vite настроен на проксирование `/api` в backend).

---

## Тестирование и верификация

Все тесты детерминированы, не зависят от внешних облачных провайдеров и готовы к CI/CD:

```powershell
# 1. Тестирование Frontend (22 теста: таймзоны, DraftBanner, CSV, 409 diff)
npm --prefix frontend test

# 2. Сборка Frontend (проверка типов TypeScript и бандла Vite)
npm --prefix frontend run build

# 3. Тестирование Backend (63 теста: CPM-математика, циклы, безопасность, лимиты)
.\.venv\Scripts\python.exe -m pytest backend/tests -q

# 4. Изолированный прогон тестов в Docker Compose
docker compose -p critix-tests -f compose.test.yaml up --build --abort-on-container-exit --exit-code-from test
docker compose -p critix-tests -f compose.test.yaml down
```

### Сводка тестов:
- **Backend:** `63 passed, 0 failed, 5 skipped` (интеграционные тесты с внешней БД пропускаются при отсутствии переменной `TEST_DATABASE_URL`).
- **Frontend:** `22 passed, 0 failed`.
- **TypeScript:** `0 errors`.

---

## Документация проекта

Подробные инженерные спецификации и руководства находятся в директории [`docs/`](docs/):

| Документ | Описание |
| :--- | :--- |
| **[docs/architecture.md](docs/architecture.md)** | Архитектура системы, доменные модели, изоляция и ограничения |
| **[docs/mathematical-model.md](docs/mathematical-model.md)** | Математическая модель CPM: алгоритм Кана, расчет ранних/поздних дат, лагов и резервов |
| **[docs/technical-audit-2026-09-30.md](docs/technical-audit-2026-09-30.md)** | Матрица аудита безопасности (устранение уязвимостей A01–A25) |
| **[docs/operations.md](docs/operations.md)** | Эксплуатация, переменные окружения, резервное копирование и траблшутинг |
| **[docs/current-state.md](docs/current-state.md)** | Текущий инженерный статус и готовность модулей системы |
| **[docs/competitive-analysis.md](docs/competitive-analysis.md)** | Сравнение с Jira, MS Project, Asana (детерминизм vs эвристика) |
| **[backend/README.md](backend/README.md)** | Руководство по разработке бэкенда, структура пакетов FastAPI |
| **[frontend/README.md](frontend/README.md)** | Руководство по фронтенду, компоненты Mantine и стейт-менеджмент |

---

## Лицензия

Проект разработан в рамках хакатона. Все права защищены.

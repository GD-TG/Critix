# CRITIX

> **Интеллектуальная система предиктивного анализа сроков проекта и моделирования контрмер**

[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688.svg?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-19.0-61dafb.svg?logo=react&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-3178c6.svg?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16+-4169e1.svg?logo=postgresql&logoColor=white)](https://www.postgresql.org)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4-38b2ac.svg?logo=tailwind-css&logoColor=white)](https://tailwindcss.com)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ed.svg?logo=docker&logoColor=white)](docker-compose.yml)

---

## 📌 О проекте

**CRITIX** — инструмент для руководителей проектов и тимлидов, позволяющий заранее выявлять угрозы срыва дедлайнов и находить оптимальные сценарии спасения проекта.

В отличие от классических таск-трекеров, CRITIX вычисляет зависимости между задачами методом критического пути (CPM), рассчитывает реальные сроки с учетом производственного календаря РФ и отпусков сотрудников, а также предоставляет интерактивную «песочницу» для моделирования управленческих решений без риска для рабочего плана.

```
                    ┌───────────────────────────────┐
                    │    Входной граф задач и связей│
                    └───────────────┬───────────────┘
                                    │
                                    ▼
                    ┌───────────────────────────────┐
                    │        Движок расчета CPM     │
                    │  - Топологический порядок     │
                    │  - Ранние и поздние даты      │
                    │  - Резервы времени (Float)    │
                    └───────┬───────────────┬───────┘
                            │               │
            ┌───────────────┴───┐       ┌───┴───────────────┐
            ▼                   ▼       ▼                   ▼
    ┌───────────────┐   ┌───────────────┐   ┌───────────────┐   ┌───────────────┐
    │Критический путь│  │Календарь и смены│ │Матрица навыков│   │Песочница      │
    │и узкие места  │   │(Праздники РФ) │   │и Overbooking  │   │«Что если?»    │
    └───────────────┘   └───────────────┘   └───────────────┘   └───────────────┘
```

---

## 🚀 Основной функционал

- **Математический расчет критического пути (CPM)**:
  - Топологическая сортировка графа задач за линейное время $O(V+E)$.
  - Расчет ранних/поздних дат старта и финиша ($ES, EF, LS, LF$), а также резервов времени ($Total\ Float$, $Free\ Float$).
  - Мгновенное определение задач, задержка которых сдвигает финальный дедлайн проекта.
  - Автоматическая валидация и защита от циклических зависимостей.

- **Песочница сценариев «Что если?» (What-If Sandbox)**:
  - Безопасное изолированное моделирование задержек, смены исполнителей и изменения связей.
  - Мгновенный расчет эффекта контрмер (*Fast-tracking*, *Crashing*).
  - Сравнение «Базовый план vs Симуляция» (Delta View) с отображением разницы дедлайна.
  - Применение успешного сценария в рабочий план в один клик.

- **Производственный календарь и учет отпусков**:
  - Учет государственных праздников РФ, переносов и рабочих смен.
  - Поддержка индивидуальных графиков сотрудников (отпуска, больничные).
  - Точный расчет сроков в рабочих днях и часах.

- **Контроль ресурсов и матрица компетенций**:
  - **Skill-Matching**: автоматическая проверка соответствия требуемых навыков задачи компетенциям исполнителя.
  - **Overbooking Detection**: выявление параллельной перегрузки сотрудников ($>100\%$ FTE).
  - Эвристические рекомендации по перераспределению задач на наименее загруженных специалистов.

- **Двухуровневый AI-ассистент**:
  - **Детерминированный аудит**: автоматическое формирование исполнительного отчета (Executive Summary) на базе строгой математики графа.
  - **Контекстный LLM-консультант**: рекомендации по выходу из кризиса с учетом топологии проекта и ограничений ресурсов.

- **Интерактивный интерфейс**:
  - Диаграмма Ганта с поддержкой Drag-and-Drop, масштабированием (День / Неделя / Месяц) и отображением критической цепочки.
  - Импорт и экспорт проектов в форматах CSV и JSON.
  - Экспорт управленческих отчетов в Markdown и удобная печать.

---

## 🛠 Технологический стек

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS, Lucide Icons, Zustand.
- **Backend**: Python 3.12, FastAPI, Pydantic v2, SQLAlchemy 2.0, Alembic.
- **База данных**: PostgreSQL 16+.
- **Инфраструктура**: Docker Compose, Caddy (автоматический TLS/HTTPS), Uvicorn.

---

## ⚡ Быстрый старт

### Вариант 1: Запуск через Docker Compose (рекомендуется)

Запуск всех сервисов (PostgreSQL, FastAPI, Frontend, Caddy) одной командой:

```bash
# 1. Настройка переменных окружения
cp .env.example .env

# 2. Сборка и запуск контейнеров
docker compose up -d --build
```

Приложение будет доступно по адресу `http://localhost`.

---

### Вариант 2: Локальный запуск без Docker

#### 1. Подготовка PostgreSQL
Создайте пользователя и базу данных:
```sql
CREATE USER critix WITH PASSWORD 'critix';
CREATE DATABASE critix OWNER critix;
GRANT ALL PRIVILEGES ON DATABASE critix TO critix;
```

#### 2. Запуск Backend (FastAPI)
```powershell
cd backend

# Создание и активация виртуального окружения
python -m venv venv
.\venv\Scripts\activate   # Linux/macOS: source venv/bin/activate

# Установка зависимостей
pip install -r requirements.txt

# Применение миграций БД
alembic upgrade head

# Запуск сервера
uvicorn app.main:app --reload --port 8000
```
- API доступно на `http://localhost:8000`
- Документация Swagger/OpenAPI: `http://localhost:8000/docs`

#### 3. Запуск Frontend (React 19)
Во втором терминале:
```powershell
cd frontend
npm install
npm run dev
```
Интерфейс откроется на `http://localhost:5173`.

---

## ⚙️ Конфигурация окружения (.env)

| Переменная | Описание | Пример значения |
|---|---|---|
| `DATABASE_URL` | Строка подключения к PostgreSQL | `postgresql+psycopg://critix:critix@localhost:5432/critix` |
| `SESSION_SECRET` | Ключ подписи сессий (от 32 символов) | `super_secret_session_key_critix_2026_production_12345` |
| `ADMIN_PASSWORD` | Пароль руководителя (от 12 символов) | `adminpassword123` |
| `APP_ORIGIN` | Разрешенный origin для фронтенда | `http://localhost:5173` |
| `COOKIE_SECURE` | Флаг Secure для куки (`false` для локального HTTP) | `false` |
| `LLM_BASE_URL` | URL OpenAI-совместимого провайдера (опционально) | `https://api.openai.com/v1` |
| `LLM_API_KEY` | API-ключ для LLM (опционально) | `sk-...` |

---

## 📡 Основные эндпоинты API

| Метод | Путь | Описание |
|---|---|---|
| `POST` | `/api/login` | Аутентификация руководителя |
| `GET` | `/api/projects` | Список проектов |
| `POST` | `/api/projects` | Создание проекта |
| `POST` | `/api/demo` | Создание демонстрационного проекта |
| `GET` | `/api/projects/{id}` | Получение проекта и результатов CPM-анализа |
| `PUT` | `/api/projects/{id}` | Сохранение изменений проекта |
| `POST` | `/api/projects/{id}/simulate` | Расчет сценария What-If без записи в БД |
| `POST` | `/api/projects/{id}/level` | Расчет выравнивания ресурсов |
| `POST` | `/api/projects/{id}/ai` | Генерация Executive-отчета |
| `POST` | `/api/projects/{id}/chat` | Консультация с AI-ассистентом |
| `DELETE` | `/api/projects/{id}` | Удаление проекта |

---

## 📂 Структура проекта

```text
Critix/
├── backend/                  # FastAPI приложение
│   ├── app/
│   │   ├── engine/           # Алгоритмический движок CPM, календари, эвристики
│   │   ├── ai.py             # Двухуровневый AI-ассистент
│   │   ├── models.py         # SQLAlchemy модели базы данных
│   │   ├── schemas.py        # Pydantic v2 схемы валидации
│   │   ├── service.py        # Сервисный слой и версионирование
│   │   └── main.py           # Маршруты API и middleware
│   ├── migrations/           # Миграции Alembic
├── frontend/                 # Frontend (React 19 + TypeScript)
│   ├── src/                  # Исходный код интерфейса (Gantt, What-If, Modals)
│   │   ├── feature/          # Модульные компоненты и экраны
│   │   ├── context/          # Управление состоянием (Zustand / React)
│   │   └── types.ts          # TypeScript интерфейсы
│   └── package.json          # Зависимости и скрипты
├── docs/                     # Документация и презентация
└── compose.yaml              # Конфигурация Docker
```

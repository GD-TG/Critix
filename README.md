# CRITIX

> **Система алгоритмического анализа критического пути (CPM) и симуляции сценариев проекта**  
> Реализация кейса: «Проект начинает срываться» (Антикризисный PM-контроль).

[![Backend Tests](https://img.shields.io/badge/Backend%20Tests-31%20passed-10b981.svg?logo=pytest&logoColor=white)](backend/tests)
[![Frontend Tests](https://img.shields.io/badge/Frontend%20Tests-12%20passed-10b981.svg?logo=vitest&logoColor=white)](src)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-3178c6.svg?logo=typescript&logoColor=white)](tsconfig.json)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688.svg?logo=fastapi&logoColor=white)](backend/app/main.py)
[![React](https://img.shields.io/badge/React-19.0-61dafb.svg?logo=react&logoColor=black)](package.json)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16+-4169e1.svg?logo=postgresql&logoColor=white)](backend/app/models.py)

---

## 1. Архитектура и математический базис

Вместо эвристических приближений или текстовых генераций LLM, ядро **CRITIX** производит детерминированный расчет расписания на ориентированном ациклическом графе (DAG):

```
                   ┌─────────────────────────────────────────┐
                   │          Входные данные проекта         │
                   │ (Задачи, связи FS/SS/FF/SF, календари)  │
                   └────────────────────┬────────────────────┘
                                        │
                                        ▼
                   ┌─────────────────────────────────────────┐
                   │    Topological Sort (Алгоритм Кана)     │
                   │    - Сложность: O(V + E)                │
                   │    - Валидация циклических зависимостей │
                   └────────────────────┬────────────────────┘
                                        │
                    ┌───────────────────┴───────────────────┐
                    ▼                                       ▼
    ┌───────────────────────────────┐       ┌───────────────────────────────┐
    │     Прямой проход (Forward)   │       │    Обратный проход (Backward) │
    │     ES = max(EF_pred)         │       │    LF = min(LS_succ)          │
    │     EF = ES + WorkDuration    │       │    LS = LF - WorkDuration     │
    └───────────────┬───────────────┘       └───────────────┬───────────────┘
                    │                                       │
                    └───────────────────┬───────────────────┘
                                        │
                                        ▼
                   ┌─────────────────────────────────────────┐
                   │     Расчет резервов (Total Float)       │
                   │     TF = LS - ES                        │
                   │     Critical Path: { Task | TF <= 0 }   │
                   └────────────────────┬────────────────────┘
                                        │
                    ┌───────────────────┴───────────────────┐
                    ▼                                       ▼
    ┌───────────────────────────────┐       ┌───────────────────────────────┐
    │      Производственный учет    │       │     Ресурсная валидация       │
    │  - Календарь праздников РФ    │       │  - Проверка матрицы навыков   │
    │  - Персональные отпуска       │       │  - Детекция Overbooking       │
    │  - Адаптивный горизонт (OOM)  │       │  - Эвристика перераспределения│
    └───────────────────────────────┘       └───────────────────────────────┘
```

### Формулы расчета расписания
- **Ранний старт ($ES$)**: $\max \{ EF_p \}$ для всех предшественников $p$.
- **Ранний финиш ($EF$)**: прибавление трудоемкости задачи к $ES$ исключительно по рабочим интервалам смен.
- **Поздний финиш ($LF$)**: $\min \{ LS_s \}$ для всех последователей $s$.
- **Поздний старт ($LS$)**: вычитание трудоемкости из $LF$ по рабочим интервалам.
- **Полный резерв ($Total\ Float$)**: $LS - ES = LF - EF$.
- **Критический путь**: цепочка задач с нулевым полным резервом ($TF = 0$).

---

## 2. Реализованный функционал под ТЗ

| Критерий ТЗ | Реализация в CRITIX | Статус |
|---|---|:---:|
| **Основной сценарий CPM** | Алгоритм Кана $O(V+E)$, расчет $ES/EF/LS/LF$, вычисление $Total\ Float$, подсветка критического пути. | ✅ |
| **Симуляция «Что если?»** | Изолированная in-memory песочница в Zustand, расчет дельты сроков за $< 15$ мс, Fast-tracking и Crashing. | ✅ |
| **Производственный календарь** | База праздников РФ, персональные интервалы отсутствий (`Absence`), расчет с точностью до минуты. | ✅ |
| **Ресурсный учет** | Матрица навыков (Skill-matching), выявление параллельной перегрузки ($> 100\%$ FTE), эвристики перераспределения. | ✅ |
| **Надежность и OOM-защита** | Адаптивный календарный горизонт сканирования дат, валидация входных данных, перехват циклов. | ✅ |
| **Продуктовый интерфейс** | Интерактивный Gantt Chart (SVG), экспорт/импорт CSV и JSON (до 300 задач), Executive Report для стейкхолдеров. | ✅ |
| **Двухуровневый AI** | Детерминированный аудит (Слой 1) + контекстный асинхронный LLM-консультант (Слой 2). | ✅ |

---

## 3. Быстрый запуск

### Вариант A: Docker Compose (рекомендуемый для серверов)

Поднимает PostgreSQL, FastAPI бэкенд, сборку фронтенда и веб-сервер Caddy:

```bash
# 1. Клонирование и настройка окружения
cp .env.example .env

# 2. Запуск контейнеров
docker compose up -d --build

# 3. Проверка статуса
docker compose ps
```

Сервис доступен по адресу: `http://localhost` (или на настроенном домене).

---

### Вариант B: Локальный запуск без Docker

#### 1. База данных PostgreSQL (версия 14+)
Создайте пользователя и базу данных в `psql` или `pgAdmin`:
```sql
CREATE USER critix WITH PASSWORD 'critix';
CREATE DATABASE critix OWNER critix;
GRANT ALL PRIVILEGES ON DATABASE critix TO critix;
```

#### 2. Бэкенд (FastAPI)
```powershell
# 1. Переход в каталог бэкенда
cd backend

# 2. Создание виртуального окружения Python 3.10+
python -m venv venv
.\venv\Scripts\activate   # Linux/macOS: source venv/bin/activate

# 3. Установка зависимостей
pip install -r requirements.txt

# 4. Настройка файла backend/.env
# DATABASE_URL=postgresql+psycopg://critix:critix@localhost:5432/critix
# SESSION_SECRET=super_secret_session_key_critix_2026_production_12345
# ADMIN_PASSWORD=adminpassword123
# APP_ORIGIN=http://localhost:5173
# COOKIE_SECURE=false

# 5. Применение миграций БД
alembic upgrade head

# 6. Запуск сервера API
uvicorn app.main:app --reload --port 8000
```
- API доступно на `http://localhost:8000`
- Документация Swagger: `http://localhost:8000/docs`

#### 3. Фронтенд (React 19 + TypeScript)
Во втором терминале (из корня проекта `Critix`):
```powershell
npm install
npm run dev
```
Интерфейс доступен на: `http://localhost:5173`.  
Пароль для входа: значение `ADMIN_PASSWORD` (по умолчанию `adminpassword123`).

---

## 4. Тестирование и верификация

```powershell
# Тесты бэкенда (31 unit & integration тест: алгоритмы, циклы, OOM, календари)
cd backend
pytest

# Тесты компонентов фронтенда (12 тестов: состояние, рендеринг, формы)
npm test

# Проверка строгой типизации и сборки бандла Vite
npm run build
```

---

## 5. Спецификация REST API

| Метод | Путь | Назначение | Доступ / Заголовки |
|---|---|---|---|
| `POST` | `/api/login` | Аутентификация руководителя | `{"password": "..."}` |
| `POST` | `/api/logout` | Завершение сессии | Session Cookie |
| `GET` | `/api/health` | Проверка доступности сервиса и БД | Публичный |
| `GET` | `/api/projects` | Список проектов | Session Cookie |
| `POST` | `/api/projects` | Создание проекта из `ProjectInput` | `X-Critix-Request: 1` |
| `POST` | `/api/demo` | Создание тестового демонстрационного проекта | `X-Critix-Request: 1` |
| `GET` | `/api/projects/{id}` | Получение данных проекта и CPM-анализа | Session Cookie |
| `PUT` | `/api/projects/{id}` | Атомарное сохранение изменений | `X-Critix-Request: 1` |
| `POST` | `/api/projects/{id}/simulate` | Расчет сценария What-If без записи в БД | `X-Critix-Request: 1` |
| `POST` | `/api/projects/{id}/level` | Выравнивание загрузки исполнителей | `X-Critix-Request: 1` |
| `POST` | `/api/projects/{id}/ai` | Генерация детерминированного Executive Summary | `X-Critix-Request: 1` |
| `POST` | `/api/projects/{id}/chat` | Контекстный AI-консультант по проекту | `X-Critix-Request: 1` |
| `DELETE` | `/api/projects/{id}` | Удаление проекта | `X-Critix-Request: 1` |

---

## 6. Структура кодовой базы

```text
Critix/
├── backend/
│   ├── app/
│   │   ├── engine/           # Алгоритмическое ядро CPM и календарной логики
│   │   │   ├── analysis.py   # Граф, топология Кана, расчет дат и float, защита от OOM
│   │   │   ├── calendar.py   # Производственный календарь РФ, учет смен и отпусков
│   │   │   └── heuristics.py # Skill-matching и эвристики выравнивания
│   │   ├── ai.py             # Двухуровневый AI-ассистент
│   │   ├── db.py             # Сессии SQLAlchemy и пул подключений
│   │   ├── models.py         # Реляционные модели PostgreSQL
│   │   ├── schemas.py        # Pydantic v2 контракты валидации
│   │   ├── service.py        # Управление состоянием и версионирование проектов
│   │   └── main.py           # Маршрутизация, middleware, rate limiting
│   ├── migrations/           # Alembic миграции схемы БД
│   └── tests/                # 31 тест покрытия
├── src/                      # Frontend (React 19 + TypeScript)
│   ├── components/           # Модули интерфейса (Gantt, What-If, Modals)
│   ├── context/              # Zustand стейт-менеджмент
│   ├── types/                # Строгая типизация моделей
│   └── App.tsx               # Корневой контейнер
├── docs/
│   └── presentation.html     # Интерактивная презентация проекта
├── docker-compose.yml        # Мульти-контейнерная конфигурация
└── README.md                 # Документация
```

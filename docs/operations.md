# Запуск и эксплуатация Critix

Проверено по конфигурации репозитория 30.09.2026. Команды PowerShell выполняются из указанной папки. Существующий `.env` не перезаписывайте шаблоном.

---

## Переменные окружения

Корневой `.env` предназначен для локальных настроек и исключён из Git. `.env.example` — шаблон без секретов. Docker Compose читает `.env` автоматически.

| Переменная | Назначение |
|---|---|
| `POSTGRES_PASSWORD` | Пароль PostgreSQL в Compose. Для подстановки в URL используйте URL-безопасные символы. |
| `DATABASE_URL` | Подключение локального backend. Compose задаёт собственное значение с хостом `db`. |
| `ADMIN_PASSWORD` | Пароль для доступа к системным проектам без владельца (`owner_id IS NULL`). |
| `SESSION_SECRET` | Случайный секрет подписи сессий (рекомендуется от 32 символов). |
| `APP_ORIGIN` | Разрешённый origin браузера (например, `http://localhost` или `http://localhost:5173`). |
| `SITE_ADDRESS` | Адрес Caddy; для локального Compose — `http://localhost`. |
| `COOKIE_SECURE` | `false` для локального HTTP, `true` для HTTPS. |
| `ENVIRONMENT` | `development` для разработки, `production` для боевого стенда. Compose задаёт `production`. |
| `TRUST_PROXY_HEADERS` | Локально `false`. В Compose задаёт `true`. |
| `LLM_API_KEY` | Необязательный серверный ключ OpenAI-совместимого провайдера. |
| `LLM_BASE_URL` | URL API провайдера (по умолчанию `https://api.openai.com/v1`). |
| `LLM_MODEL` | Точное имя модели (например, `gpt-4o-mini`). Пустое значение отключает внешние вызовы LLM. |
| `AI_DAILY_BUDGET` | Суточный лимит обращений к ИИ на весь сервер (по умолчанию `500`). |

---

## 1. Запуск через Docker Compose (Рекомендуемый)

1. Запустите Docker Desktop.
2. В корне репозитория создайте `.env` из `.env.example` и укажите секреты:
   ```dotenv
   SITE_ADDRESS=http://localhost
   APP_ORIGIN=http://localhost
   COOKIE_SECURE=false
   POSTGRES_PASSWORD=your_secure_password
   ADMIN_PASSWORD=your_admin_password
   SESSION_SECRET=your_random_32_char_secret
   ```
3. Соберите и запустите контейнеры:
   ```powershell
   Set-Location C:\Code\Critix
   docker compose up -d --build
   docker compose ps
   ```
4. Откройте **http://localhost**. База данных и API закрыты внутри Docker-сети, трафик маршрутизируется через Caddy. Миграции накатываются автоматически при старте контейнера `api`.

Остановка контейнеров:
```powershell
docker compose stop
```

---

## 2. Локальная разработка в Windows

### Подготовка окружения

Требуются Python 3.12+, Node.js 22+ и запущенный PostgreSQL.

```powershell
Set-Location C:\Code\Critix
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r backend\requirements.lock
.\.venv\Scripts\python.exe -m pip install --no-deps -e ./backend
npm --prefix frontend ci
```

### Запуск Backend (Терминал 1)

```powershell
Set-Location C:\Code\Critix\backend
..\.venv\Scripts\python.exe -c "from dotenv import load_dotenv; load_dotenv('../.env'); from alembic.config import main; main(argv=['upgrade', 'head'])"
..\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000 --env-file ../.env
```
Эндпоинт проверки здоровья: `http://127.0.0.1:8000/api/health`. OpenAPI-схема доступна по `http://127.0.0.1:8000/openapi.json`.

### Запуск Frontend (Терминал 2)

```powershell
Set-Location C:\Code\Critix\frontend
npm run dev
```
Интерфейс доступен по адресу **http://localhost:5173**. Vite автоматически проксирует `/api` на локальный порт 8000.

---

## 3. Проверки и верификация

Выполняются из корня проекта:

```powershell
# Тесты клиентской логики и сборка фронтенда
npm --prefix frontend test
npm --prefix frontend run build

# Юнит- и интеграционные тесты бэкенда
.\.venv\Scripts\python.exe -m pytest backend/tests -q

# Полный интеграционный цикл в изолированном тестовом Docker Compose
docker compose -p critix-tests -f compose.test.yaml up --build --abort-on-container-exit --exit-code-from test
docker compose -p critix-tests -f compose.test.yaml down
```

Статус на 30.09.2026: **63 теста backend пройдены**, **22 теста frontend пройдены**, сборка фронтенда завершается без ошибок.

---

## REST API Reference

Все проектные маршруты требуют авторизации через сессионные куки. Изменяющие запросы (POST, PUT, DELETE) требуют заголовка `X-Critix-Request: 1`.

| Метод | Путь | Описание |
|---|---|---|
| GET | `/api/health` | Проверка доступности сервиса и подключения к БД |
| POST | `/api/auth/register` | Регистрация нового аккаунта руководителя |
| POST | `/api/auth/login` | Вход пользователя (установка сессионной куки) |
| POST | `/api/auth/logout` | Завершение сессии и отзыв токена |
| GET | `/api/auth/me` | Данные текущего авторизованного пользователя |
| POST | `/api/auth/demo` | Публичный демо-вход (возвращает HTTP 410 Gone) |
| GET / POST | `/api/projects` | Список проектов текущего пользователя / создание нового |
| POST | `/api/projects/demo` | Создание демонстрационного проекта в профиле пользователя |
| GET / PUT / DELETE | `/api/projects/{id}` | Загрузка / сохранение снимка / удаление проекта |
| POST | `/api/projects/{id}/simulate` | Расчёт расписания черновика без сохранения в БД |
| POST | `/api/projects/{id}/level` | Расчёт предложения по выравниванию ресурсов |
| GET / POST | `/api/projects/{id}/scenarios` | Список сценариев (метаданные) / создание нового |
| POST | `/api/projects/{id}/scenarios/{s_id}/analyze` | Вызов расчета CPM для конкретного сценария (On-Demand) |
| DELETE | `/api/projects/{id}/scenarios/{s_id}` | Удаление сценария |
| POST | `/api/projects/{id}/ai` | Запуск AI-аудита расписания (или fallback на движок) |
| POST | `/api/projects/{id}/chat` | Интерактивный диалог с AI Copilot по контексту проекта |
| GET | `/api/projects/{id}/history` | История последних 30 сохранений с расчетом диффа |

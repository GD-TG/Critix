# Запуск и эксплуатация Critix

Проверено по конфигурации репозитория 29.09.2026. Команды PowerShell выполняются из указанной папки. Существующий `.env` не перезаписывайте шаблоном.

## Переменные окружения

Корневой `.env` предназначен для локальных настроек и исключён из Git. `.env.example` — шаблон без секретов. Docker Compose читает `.env` автоматически; Python-приложение самостоятельно его не загружает.

| Переменная | Назначение |
|---|---|
| `POSTGRES_PASSWORD` | Пароль PostgreSQL в Compose. Для подстановки в URL используйте URL-безопасные символы; иначе пароль требует percent-encoding. |
| `DATABASE_URL` | Подключение локального backend. Compose задаёт собственное значение с хостом `db`; значение из `.env` его не заменяет. |
| `ADMIN_PASSWORD` | Собственный пароль общей учётной записи руководителя. Рекомендуется случайный пароль от 12 символов. |
| `SESSION_SECRET` | Собственный случайный секрет подписи сессий; рекомендуется от 32 символов. |
| `APP_ORIGIN` | Разрешённый origin браузера, включая схему и порт, без пути и завершающего `/`. Несколько origin — через запятую. |
| `SITE_ADDRESS` | Адрес Caddy; для локального Compose — `http://localhost`. В локальном Vite не используется. |
| `COOKIE_SECURE` | `false` для локального HTTP, `true` для HTTPS. |
| `ENVIRONMENT` | `development` для локальной разработки. Compose принудительно задаёт `production`. Также поддерживается `CRITIX_ENV`, если `ENVIRONMENT` отсутствует. |
| `TRUST_PROXY_HEADERS` | Локально `false`. Compose задаёт `true`; перед VPS требуется проверить перезапись доверенного заголовка собственным прокси. |
| `LLM_API_KEY` | Необязательный серверный ключ провайдера. |
| `LLM_BASE_URL` | URL OpenAI-совместимого API. Шаблон задаёт `https://api.openai.com/v1`; укажите URL своего провайдера. |
| `LLM_MODEL` | Точное имя модели у выбранного провайдера. Пустое значение отключает обращение к LLM. |

Минимальная длина пароля и секрета выше — рекомендация настройки, а не реализованная проверка длины. Production-валидатор отклоняет пустые и некоторые известные небезопасные значения, а также пустой origin и wildcard. Он не оценивает криптостойкость произвольной строки.

Задавайте все три параметра LLM явно: встроенные значения Python и значения шаблона отличаются. Для работы движка LLM не требуется.

## Docker на локальном компьютере

1. Запустите Docker Desktop.
2. В корне репозитория создайте `.env` из `.env.example`, если его нет, и заполните секреты.
3. Задайте `SITE_ADDRESS=http://localhost`, `APP_ORIGIN=http://localhost`, `COOKIE_SECURE=false`.
4. Выполните:

```powershell
Set-Location C:\Code\Critix
docker compose up -d --build
docker compose ps
```

Откройте **http://localhost** и войдите с `ADMIN_PASSWORD`. API и база не публикуют порты на хост; доступ идёт через Caddy. Миграции запускаются перед Uvicorn автоматически.

Остановка без удаления контейнеров и данных:

```powershell
docker compose stop
```

Повторный запуск:

```powershell
docker compose start
```

После изменения кода или `.env`:

```powershell
docker compose up -d --build
```

`docker compose down` удаляет контейнеры и сеть, сохраняя именованные тома. Не добавляйте `-v`, если данные нужны: этот флаг удаляет том PostgreSQL. Смена `POSTGRES_PASSWORD` в `.env` не меняет пароль уже инициализированной базы.

## Локальная разработка в Windows

### Подготовка

Требуются Python 3.12+, Node.js 22+ и работающий PostgreSQL. Создайте базу `critix` и отдельного пользователя с правами на неё через pgAdmin или psql. Указанные далее значения паролей — места для ваших значений, не готовые секреты.

В корневом `.env` задайте:

```dotenv
ENVIRONMENT=development
DATABASE_URL=postgresql+psycopg://critix:YOUR_DATABASE_PASSWORD@127.0.0.1:5432/critix
ADMIN_PASSWORD=YOUR_MANAGER_PASSWORD
SESSION_SECRET=YOUR_RANDOM_SESSION_SECRET
APP_ORIGIN=http://localhost:5173
COOKIE_SECURE=false
TRUST_PROXY_HEADERS=false
LLM_API_KEY=
LLM_MODEL=
LLM_BASE_URL=https://api.openai.com/v1
```

Установите зависимости из корня проекта:

```powershell
Set-Location C:\Code\Critix
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r backend\requirements.lock
.\.venv\Scripts\python.exe -m pip install --no-deps -e ./backend
npm --prefix frontend ci
```

### Backend

В первом терминале:

```powershell
Set-Location C:\Code\Critix\backend
..\.venv\Scripts\python.exe -c "from dotenv import load_dotenv; load_dotenv('../.env'); from alembic.config import main; main(argv=['upgrade', 'head'])"
..\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000 --env-file ../.env
```

Первая команда после перехода в папку применяет миграции; последняя запускает сервер. `python-dotenv` установлен зависимостями из lock-файла. При изменении `.env` перезапустите backend. Уже заданные переменные процесса имеют приоритет над `.env`.

Проверка доступности API и БД: `http://127.0.0.1:8000/api/health`. Swagger `/docs` и ReDoc отключены; схема доступна по `/openapi.json`.

### Frontend

Во втором терминале:

```powershell
Set-Location C:\Code\Critix\frontend
npm run dev
```

Откройте **http://localhost:5173**. Запросы `/api` идут через прокси Vite к `127.0.0.1:8000`. Если порт 5173 занят и Vite выбрал другой, освободите порт либо согласуйте `APP_ORIGIN` с фактическим адресом и перезапустите backend.

Для остановки каждого процесса нажмите `Ctrl+C` в его терминале. Отдельно установленный PostgreSQL при этом продолжает работать.

## Проверки

Из корня:

```powershell
npm --prefix frontend test
npm --prefix frontend run build
docker compose -p critix-tests -f compose.test.yaml up --build --abort-on-container-exit --exit-code-from test
docker compose -p critix-tests -f compose.test.yaml down
```

Последняя команда нужна и после неуспешных тестов. Тестовая БД временная, рабочие тома не подключаются. Полный прогон включает миграции и интеграционные проверки PostgreSQL. Backend pytest без `TEST_DATABASE_URL` пропускает соответствующие интеграционные проверки; это не полный прогон.

Результаты последнего прогона и границы проверки: [current-state.md](current-state.md).

## Ошибки запуска

| Симптом | Что проверить |
|---|---|
| Не открывается localhost | Совпадает ли адрес с режимом: Compose — `http://localhost`, Vite — `http://localhost:5173`. Для Compose смотрите `docker compose ps` и `docker compose logs --tail 100 api web db`. |
| Docker не скачивает PostgreSQL, `no such host` | Разрешение DNS и доступ Docker к registry. Это происходит до запуска приложения, изменение пароля БД не поможет. |
| HTTP 403 при входе или сохранении | Точное совпадение адреса браузера с `APP_ORIGIN`. В production автоматического разрешения других localhost-адресов нет. |
| Вход проходит, но снова требуется авторизация | Для локального HTTP установите `COOKIE_SECURE=false`; после перезапуска backend сессии отзываются. |
| Backend не подключается к базе | PostgreSQL запущен, база создана, пароль верен. Для локального Python хост обычно `127.0.0.1`, а `db` доступен внутри Compose. |
| AI не отвечает при наличии ключа | Проверить также `LLM_MODEL`, `LLM_BASE_URL`, доступность модели и загрузку окружения сервером. Не отправлять ключ в чат или скриншоты. Аудит без провайдера должен выдать сводку движка. |
| HTTP 409 | Другой запрос сохранил новую версию. Сравнить различия: загрузка серверной версии сбросит черновик, сохранение поверх заменит агрегат целиком. |
| HTTP 503 во время расчёта | Оба расчётных слота заняты более 3 секунд. Повторить позже. |
| Тайм-аут сохранения | Запись могла завершиться на сервере. Проверить актуальную версию перед повтором; автоматического повтора записи нет. |

## Перед VPS

Текущий Compose — основа развёртывания, но публичный запуск ещё не проверен.

- В `frontend/Caddyfile` задан `tls internal`: простая смена `SITE_ADDRESS` не включает публично доверенный сертификат. Перед публикацией нужна отдельная настройка Caddy и проверка HTTPS с целевым доменом.
- Compose включает `TRUST_PROXY_HEADERS=true`, но текущий Caddyfile не перезаписывает `X-Critix-Client-IP`. Перед публикацией нужно либо добавить его перезапись адресом соединения в доверенном прокси, либо отключить доверие к нему. В текущей конфигурации адрес для лимита входа нельзя считать защищённым от подмены этим заголовком.
- Указать собственный домен в `APP_ORIGIN`, включить `COOKIE_SECURE=true`, задать уникальные секреты. Оставить БД и API закрытыми снаружи.
- Использовать один worker: сессии, отзыв токенов и лимиты хранятся в памяти процесса.
- Настроить резервное копирование PostgreSQL и проверить восстановление на отдельной базе. JSON-экспорт отдельного проекта не заменяет резервную копию БД с историей.
- Проверить доступ к LLM с VPS, основные пользовательские сценарии и нагрузку до десяти одновременных пользователей. Измерений latency/throughput пока нет.

## REST API

Все проектные маршруты требуют cookie-сессии. Изменяющие запросы требуют `X-Critix-Request: 1`; при наличии `Origin` он проверяется по настройкам. UI добавляет заголовок сам.

| Метод | Путь | Назначение |
|---|---|---|
| GET | `/api/health` | Доступность приложения и БД |
| POST | `/api/login`, `/api/logout` | Вход и завершение сессии |
| GET / POST | `/api/projects` | Список / создание |
| POST | `/api/demo` | Создание демо-проекта |
| GET / PUT / DELETE | `/api/projects/{id}` | Чтение / сохранение / удаление |
| POST | `/api/projects/{id}/simulate` | Расчёт без записи |
| POST | `/api/projects/{id}/level` | Предложение выравнивания без записи |
| POST | `/api/projects/{id}/ai` | Аудит сохранённого проекта |
| POST | `/api/projects/{id}/chat` | Консультация по переданному контексту |
| GET | `/api/projects/{id}/history` | Последние 20 сохранений |

Состав тела запросов определяется схемами в `backend/app/schemas.py` и `/openapi.json`. Сохранение, симуляция и выравнивание проверяют версию проекта.

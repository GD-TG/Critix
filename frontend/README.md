# Critix Frontend Application

[![React](https://img.shields.io/badge/React-19-61DAFB?style=flat&logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7+-3178C6?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-6-646CFF?style=flat&logo=vite&logoColor=white)](https://vitejs.dev/)
[![Mantine](https://img.shields.io/badge/Mantine_UI-v7-339AF0?style=flat&logo=mantine&logoColor=white)](https://mantine.dev/)
[![React Flow](https://img.shields.io/badge/React_Flow-12-FF0072?style=flat&logo=react&logoColor=white)](https://reactflow.dev/)
[![Tests](https://img.shields.io/badge/Tests-22_passed-success?style=flat&logo=node.js&logoColor=white)](tests)

Клиентское веб-приложение системы Critix на базе React 19, Mantine UI и React Flow. Обеспечивает интерактивную визуализацию расписания (Гант), графа зависимостей, сценарное моделирование и управление рисками.

---

## Архитектура и стек

```text
frontend/src/
├── api/                # Клиентский слой HTTP-запросов (fetch с валидацией и X-Critix-Request)
├── context/            # Глобальные контексты приложения
│   ├── AuthContext.tsx    # Авторизация, сессия, сброс стейта через authGen
│   └── ProjectContext.tsx # Черновик проекта, версионирование, синхронизация, DraftBanner, sessionGen
├── feature/            # Функциональные модули и экраны
│   ├── ProjectView/       # Главный экран: Гант, таблица задач, вкладки команды и рисков
│   ├── ProjectGraph/      # Интерактивный граф задач на React Flow (редактирование связей, критический путь)
│   ├── ScenarioModal/     # Сценарное моделирование What-If (on-demand анализ без блокировки интерфейса)
│   ├── ExecutiveReport/   # Генерация executive Markdown и отчётов для печати
│   ├── MetricsGrid/       # Сворачиваемый аккордеон показателей с localStorage
│   └── TaskDrawer/        # Детальная карточка задачи (блок «Что определяет срок», фактические даты)
├── shared.ts           # Утилиты времени, форматирование дат, валидаторы импорта/экспорта (JSON/CSV)
└── App.tsx             # Корневой роутинг и модальные окна
```

---

## Ключевые возможности интерфейса

1. **Интерактивный граф и таймлайн:**
   - Визуализация критического пути на таймлайне и графе React Flow в реальном времени.
   - Подсветка последствий сдвига задач и цепочек влияния.
2. **Безопасная работа с черновиком (DraftBanner):**
   - Все изменения моментально сохраняются в локальный черновик (`localStorage`).
   - Если версия проекта на сервере изменилась другим пользователем, интерфейс не затирает локальные данные: всплывает баннер конфликта с детальным списком различий (`computeProjectDiff`) и выбором действия.
3. **Компактная шапка метрик (MetricsGrid):**
   - Сворачиваемый аккордеон с персистентным состоянием в `localStorage` (`critix_metrics_collapsed`).
   - Компактная сводка с чипами показателей на десктопе и мобильных устройствах, освобождающая рабочую область.
4. **On-Demand расчет What-If сценариев:**
   - Моделирование сценариев («Что если увеличится срок?»).
   - Список сценариев открывается мгновенно; тяжелый пересчет CPM запускается по кнопке пользователем.
5. **Защита от состояния гонки (Race Condition):**
   - Механизм поколения запросов `authGen` и `sessionGen` отбрасывает запоздалые ответы API при смене проекта или выходе из аккаунта.
6. **Строгая валидация импорта:**
   - Клиентская валидация JSON/CSV синхронизирована с бэкендом (до 200 задач, 2000 связей, 100 исполнителей), с сохранением ролей и навыков команды.

---

## Запуск и разработка

```powershell
Set-Location C:\Code\Critix\frontend

# Установка зависимостей
npm ci

# Запуск dev-сервера (порт 5173)
npm run dev

# Проверка тестов (Node native test runner)
npm test

# Production-сборка (TypeScript + Vite)
npm run build
```

---

## Тестирование

Тесты находятся в `frontend/tests/*.test.mjs` и проверяют ключевые алгоритмы на клиенте:
- Конвертация часовых поясов и переход на зимнее/летнее время (DST).
- Защита черновиков и устойчивость к запоздалым сетевым ответам.
- Вычисление diff при конфликте версий проектов (HTTP 409).
- Корректный парсинг и валидация CSV/JSON файлов.

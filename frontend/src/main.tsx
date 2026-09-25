import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  ActionIcon,
  Alert,
  Avatar,
  Badge,
  Button,
  Card,
  Container,
  Divider,
  Drawer,
  Group,
  MantineProvider,
  Modal,
  NumberInput,
  PasswordInput,
  Progress,
  SegmentedControl,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Tabs,
  Text,
  Textarea,
  TextInput,
  Title,
  Tooltip,
} from "@mantine/core";
import { Background, Controls, MarkerType, ReactFlow } from "@xyflow/react";
import "@mantine/core/styles.css";
import "@xyflow/react/dist/style.css";
import "./style.css";
import { api } from "./api";
import { CalendarEditor } from "./CalendarEditor";
import { ProjectDateInput } from "./ProjectDateInput";
import { changeTaskStatus, rescheduleOverdueTasks } from "./taskEditing";
import {
  defaultCalendar,
  defaultTask,
  type Calendar,
  type Dependency,
  type Person,
  type Priority,
  type Project,
  type Result,
  type Skill,
  type Task,
} from "./types";

const statusLabels = {
  todo: "Запланирована",
  in_progress: "В работе",
  done: "Завершена",
  blocked: "Заблокирована",
};

const statusColors = {
  todo: "gray",
  in_progress: "blue",
  done: "teal",
  blocked: "red",
};

const priorityLabels: Record<Priority, string> = {
  low: "Низкий",
  medium: "Средний",
  high: "Высокий",
  urgent: "Срочный",
};

const priorityColors: Record<Priority, string> = {
  low: "gray",
  medium: "blue",
  high: "orange",
  urgent: "red",
};

const skillLevelLabels: Record<Skill["level"], string> = {
  beginner: "Начинающий",
  intermediate: "Средний",
  advanced: "Продвинутый",
  expert: "Эксперт",
};

const riskLabels: Record<string, string> = {
  blocked: "Блокировка",
  overload: "Перегрузка",
  past_deadline: "За дедлайном",
  dependency_conflict: "Конфликт фактических дат",
};

export const TIMEZONE_OPTIONS = [
  { value: "Asia/Yekaterinburg", label: "Екатеринбург, Тюмень, Пермь (UTC+5)" },
  { value: "Europe/Moscow", label: "Москва, Санкт-Петербург (UTC+3)" },
  { value: "Asia/Novosibirsk", label: "Новосибирск (UTC+7)" },
  { value: "Asia/Krasnoyarsk", label: "Красноярск (UTC+7)" },
  { value: "Asia/Irkutsk", label: "Иркутск (UTC+8)" },
  { value: "Asia/Vladivostok", label: "Владивосток (UTC+10)" },
  { value: "Europe/Kaliningrad", label: "Калининград (UTC+2)" },
  { value: "Europe/London", label: "Лондон (UTC+0)" },
  { value: "Europe/Berlin", label: "Берлин, Париж (UTC+1)" },
  { value: "America/New_York", label: "Нью-Йорк (UTC-5)" },
];

const copy = <T,>(value: T): T => structuredClone(value);

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

const AVATAR_COLORS = ["teal", "blue", "indigo", "cyan", "violet", "grape", "orange", "green"];

function getAvatarColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function getWeeklyHours(calendar: Calendar): number {
  let minutes = 0;
  for (let day = 0; day < 7; day++) {
    const shifts = calendar.week[String(day)] || calendar.week[day] || [];
    for (const shift of shifts) {
      if (shift.start && shift.end) {
        const [sh, sm] = shift.start.split(":").map(Number);
        const [eh, em] = shift.end.split(":").map(Number);
        const startMin = sh * 60 + sm;
        const endMin = eh * 60 + em;
        if (endMin > startMin) {
          minutes += endMin - startMin;
        }
      }
    }
  }
  return Math.round((minutes / 60) * 10) / 10;
}

function calculateSkillMatch(task: Task, person: Person): number {
  if (!task.required_skills || task.required_skills.length === 0) return 100;
  if (!person.skills || person.skills.length === 0) return 0;
  const personSkillNames = new Set(person.skills.map((s) => s.name.toLowerCase()));
  let matchCount = 0;
  for (const reqSkill of task.required_skills) {
    if (personSkillNames.has(reqSkill.toLowerCase())) {
      matchCount++;
    }
  }
  return Math.round((matchCount / task.required_skills.length) * 100);
}

function calculateReliabilityScore(person: Person, tasks: Task[]): number {
  const assigned = tasks.filter((t) => t.assignee_id === person.id);
  if (assigned.length === 0) return 100;
  const doneCount = assigned.filter((t) => t.status === "done").length;
  const blockedCount = assigned.filter((t) => t.status === "blocked").length;
  const score = ((doneCount + (assigned.length - blockedCount)) / (assigned.length * 2)) * 100;
  return Math.round(score);
}

function exportTasksToCsv(project: Project) {
  const headers = [
    "ID",
    "Название задачи",
    "Приоритет",
    "Статус",
    "Рабочие часы",
    "Исполнитель",
    "Требуемые навыки",
    "Занятость %",
    "Начать не раньше",
    "Фактическое начало",
    "Фактическое окончание",
  ];

  const rows = project.tasks.map((t) => {
    const assignee = project.assignees.find((p) => p.id === t.assignee_id);
    return [
      t.id,
      `"${t.name.replace(/"/g, '""')}"`,
      priorityLabels[t.priority || "medium"],
      t.status,
      t.duration_minutes / 60,
      assignee ? `"${assignee.name.replace(/"/g, '""')}"` : "",
      `"${(t.required_skills || []).join(", ").replace(/"/g, '""')}"`,
      t.allocation_percent,
      t.not_before || "",
      t.actual_start || "",
      t.actual_finish || "",
    ];
  });

  const csvContent =
    "\uFEFF" +
    [headers.join(";"), ...rows.map((r) => r.join(";"))].join("\r\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", `${project.name || "tasks"}_export.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function parseCsvTasks(csvText: string, existingAssignees: Person[]): Task[] {
  const lines = csvText.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];

  const newTasks: Task[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const cols = line.split(/;|\t/);
    if (cols.length < 2) continue;

    const name = cols[1]?.replace(/^"|"$/g, "").trim() || cols[0]?.replace(/^"|"$/g, "").trim();
    if (!name) continue;

    const prioStr = (cols[2] || "").toLowerCase();
    let priority: Priority = "medium";
    if (prioStr.includes("низк") || prioStr.includes("low")) priority = "low";
    else if (prioStr.includes("высок") || prioStr.includes("high")) priority = "high";
    else if (prioStr.includes("сроч") || prioStr.includes("urgent")) priority = "urgent";

    const hours = parseFloat(cols[4] || cols[3] || "8") || 8;
    const assigneeName = (cols[5] || "").replace(/^"|"$/g, "").trim();
    const assignee = existingAssignees.find(
      (a) => a.name.toLowerCase() === assigneeName.toLowerCase(),
    );

    const skillsStr = (cols[6] || "").replace(/^"|"$/g, "").trim();
    const required_skills = skillsStr
      ? skillsStr.split(",").map((s) => s.trim())
      : [];

    newTasks.push({
      id: crypto.randomUUID(),
      name,
      duration_minutes: Math.round(hours * 60),
      priority,
      required_skills,
      not_before: null,
      assignee_id: assignee ? assignee.id : null,
      allocation_percent: 100,
      status: "todo",
      actual_start: null,
      actual_finish: null,
    });
  }

  return newTasks;
}

function App() {
  const [logged, setLogged] = useState(false);
  const [password, setPassword] = useState("");
  const [colorScheme, setColorScheme] = useState<"dark" | "light">(() => {
    return (localStorage.getItem("critix_theme") as "dark" | "light") || "dark";
  });

  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [saved, setSaved] = useState<Result | null>(null);
  const [preview, setPreview] = useState<Result | null>(null);
  const [draft, setDraft] = useState<Project | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [task, setTask] = useState<Task | null>(null);
  const [settings, setSettings] = useState(false);
  const [newProject, setNewProject] = useState(false);
  const [importModal, setImportModal] = useState(false);
  const [importText, setImportText] = useState("");

  const [name, setName] = useState("");
  const [start, setStart] = useState("2026-09-28T09:00:00+05:00");
  const [deadline, setDeadline] = useState("2026-10-16T18:00:00+05:00");
  const [timezone, setTimezone] = useState("Asia/Yekaterinburg");
  const [ai, setAi] = useState("");
  const [newSkillName, setNewSkillName] = useState("");

  const [dep, setDep] = useState<Dependency>({
    predecessor_id: "",
    successor_id: "",
    kind: "FS",
    lag_minutes: 0,
    lag_mode: "working",
  });
  const view = preview || saved;

  function toggleTheme(value: "dark" | "light") {
    setColorScheme(value);
    localStorage.setItem("critix_theme", value);
    document.documentElement.setAttribute("data-mantine-color-scheme", value);
  }

  useEffect(() => {
    document.documentElement.setAttribute("data-mantine-color-scheme", colorScheme);
  }, [colorScheme]);

  const date = (value: string) =>
    new Intl.DateTimeFormat("ru-RU", {
      timeZone: view?.project.timezone || "Asia/Yekaterinburg",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));

  const shortDate = (value: string) =>
    new Intl.DateTimeFormat("ru-RU", {
      timeZone: view?.project.timezone || "Asia/Yekaterinburg",
      day: "numeric",
      month: "short",
    }).format(new Date(value));

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Не удалось выполнить действие",
      );
    } finally {
      setBusy(false);
    }
  }

  async function list() {
    const data = await api<{ id: string; name: string }[]>("/projects");
    setProjects(data);
    setLogged(true);
  }

  function accept(result: Result) {
    setSaved(result);
    setDraft(copy(result.project));
    setPreview(null);
    setAi("");
  }

  useEffect(() => {
    api<{ id: string; name: string }[]>("/projects")
      .then((data) => {
        setProjects(data);
        setLogged(true);
      })
      .catch(() => {});
  }, []);

  function change(next: Project) {
    setDraft(next);
    setPreview(null);
  }

  const dirty =
    !!saved && JSON.stringify(saved.project) !== JSON.stringify(draft);

  if (!logged)
    return (
      <MantineProvider forceColorScheme={colorScheme}>
        <Container size={420} pt="15vh">
          <Stack>
            <Group justify="space-between" align="center">
              <Text className="eyebrow">CRITIX / PROJECT INTELLIGENCE</Text>
              <SegmentedControl
                size="xs"
                value={colorScheme}
                onChange={(v) => toggleTheme(v as "dark" | "light")}
                data={[
                  { label: "Тёмная", value: "dark" },
                  { label: "Светлая", value: "light" },
                ]}
              />
            </Group>
            <Title order={1}>Изменения под контролем.</Title>
            <Text c="dimmed">
              Сроки, зависимости, Диаграмма Ганта и реальное время — в одном месте.
            </Text>
            <Card withBorder mt="xl">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void run(async () => {
                    await api("/login", "POST", { password });
                    setPassword("");
                    await list();
                  });
                }}
              >
                <Stack>
                  <Text fw={600}>Вход руководителя</Text>
                  <PasswordInput
                    label="Пароль"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                  />
                  {error && <Alert color="red">{error}</Alert>}
                  <Button type="submit" loading={busy}>
                    Войти
                  </Button>
                </Stack>
              </form>
            </Card>
          </Stack>
        </Container>
      </MantineProvider>
    );

  const taskOptions =
    draft?.tasks.map((t) => ({ value: t.id, label: t.name })) || [];
  const rows = new Map(view?.analysis.tasks.map((t) => [t.id, t]));
  const affected = new Set(preview?.changes?.changed_task_ids || []);

  const nodes = (view?.analysis.tasks || []).map((row, i) => {
    const t = view!.project.tasks.find((t) => t.id === row.id)!;
    const assignee = view!.project.assignees.find((p) => p.id === t.assignee_id);
    return {
      id: row.id,
      position: { x: (i % 4) * 260, y: Math.floor(i / 4) * 155 },
      data: {
        label: (
          <div>
            <Group justify="space-between" align="center" mb={4}>
              <Badge size="xs" color={priorityColors[t.priority || "medium"]}>
                {priorityLabels[t.priority || "medium"]}
              </Badge>
              {assignee && (
                <Tooltip label={`Исполнитель: ${assignee.name}`}>
                  <Avatar
                    size={20}
                    radius="xl"
                    color={getAvatarColor(assignee.id)}
                  >
                    {getInitials(assignee.name)}
                  </Avatar>
                </Tooltip>
              )}
            </Group>
            <strong>{t.name}</strong>
            <span>
              {date(row.start)} → {date(row.finish)}
            </span>
            <span>
              {row.critical
                ? "Критическая задача"
                : row.slack_minutes === null
                  ? "Фактические даты"
                  : `Резерв ${row.slack_minutes / 60} ч`}
            </span>
          </div>
        ),
      },
      style: {
        borderColor: affected.has(row.id)
          ? "#dd8631"
          : row.critical
            ? "#d4545c"
            : "#bad0c9",
        width: 230,
      },
    };
  });

  const completedCount = draft?.tasks.filter((t) => t.status === "done").length || 0;
  const totalTasksCount = draft?.tasks.length || 0;
  const progressPercent = totalTasksCount ? Math.round((completedCount / totalTasksCount) * 100) : 0;
  const overloadedAssigneeIds = new Set(view?.analysis.overloads.map((o) => o.assignee_id) || []);

  const now = new Date();
  const overdueTasks = (view?.analysis.tasks || []).filter((r) => {
    const t = draft?.tasks.find((x) => x.id === r.id);
    return t && t.status !== "done" && new Date(r.finish) < now;
  });

  let baselineVarianceHours: number | null = null;
  if (draft?.baseline && view) {
    const baseFinish = new Date(draft.baseline.finish).getTime();
    const currFinish = new Date(view.analysis.finish).getTime();
    baselineVarianceHours = Math.round((currFinish - baseFinish) / (1000 * 3600));
  }

  function handleSaveBaseline() {
    if (!draft || !view) return;
    const taskMap: Record<string, { start: string; finish: string }> = {};
    for (const r of view.analysis.tasks) {
      taskMap[r.id] = { start: r.start, finish: r.finish };
    }
    change({
      ...draft,
      baseline: {
        saved_at: new Date().toISOString(),
        finish: view.analysis.finish,
        tasks: taskMap,
      },
    });
  }

  function handleRescheduleOverdue() {
    if (!draft || !view) return;
    const updatedTasks = rescheduleOverdueTasks(draft.tasks, view.analysis, new Date());
    change({
      ...draft,
      tasks: updatedTasks,
    });
  }

  const projStartMs = draft ? new Date(draft.start).getTime() : 0;
  const projEndMs = draft ? new Date(draft.deadline).getTime() : 1;
  const projTotalMs = Math.max(1, projEndMs - projStartMs);

  return (
    <MantineProvider forceColorScheme={colorScheme}>
      <header>
        <Group justify="space-between">
          <Group gap="md">
            <Text className="brand">
              critix<span>●</span>
            </Text>
            <Text c="dimmed" size="sm">
              Система анализа рисков и изменений проекта
            </Text>
          </Group>

          <Group gap="sm">
            <SegmentedControl
              size="xs"
              value={colorScheme}
              onChange={(v) => toggleTheme(v as "dark" | "light")}
              data={[
                { label: "Тёмная", value: "dark" },
                { label: "Светлая", value: "light" },
              ]}
            />
            <Button
              variant="subtle"
              color="gray"
              onClick={() =>
                void run(async () => {
                  await api("/logout", "POST");
                  setLogged(false);
                  setSaved(null);
                  setDraft(null);
                })
              }
            >
              Выйти
            </Button>
          </Group>
        </Group>
      </header>

      <Container size="xl" py="xl">
        <Stack gap="lg">
          <Group justify="space-between">
            <Group>
              <Select
                aria-label="Проект"
                placeholder="Выберите проект"
                data={projects.map((p) => ({ value: p.id, label: p.name }))}
                value={saved?.id || null}
                disabled={busy || dirty}
                w={320}
                onChange={(id) =>
                  id &&
                  void run(async () =>
                    accept(await api<Result>(`/projects/${id}`)),
                  )
                }
              />
              <Button
                variant="light"
                disabled={busy || dirty}
                onClick={() => setNewProject(true)}
              >
                Новый проект
              </Button>
            </Group>
            <Group gap="sm">
              {draft && (
                <>
                  <Button
                    variant="outline"
                    color="teal"
                    onClick={() => exportTasksToCsv(draft)}
                  >
                    Экспорт в CSV
                  </Button>
                  <Button
                    variant="outline"
                    color="blue"
                    onClick={() => setImportModal(true)}
                  >
                    Импорт из CSV
                  </Button>
                  <Button
                    variant="default"
                    onClick={handleSaveBaseline}
                    title="Зафиксировать текущий расчёт как эталонный базовый план"
                  >
                    Зафиксировать Базовый план
                  </Button>
                </>
              )}
              <Button
                variant="subtle"
                disabled={busy || dirty}
                onClick={() =>
                  void run(async () => {
                    accept(await api<Result>("/demo", "POST"));
                    await list();
                  })
                }
              >
                Открыть новый демопроект
              </Button>
            </Group>
          </Group>

          {error && (
            <Alert
              color="red"
              title="Не удалось выполнить действие"
              withCloseButton
              onClose={() => setError("")}
            >
              {error}
            </Alert>
          )}

          {!view && (
            <Card withBorder padding={50}>
              <Text className="eyebrow">НАЧНИТЕ С ГЛАВНОГО</Text>
              <Title order={2} mt="sm">
                Что произойдёт, если задача задержится?
              </Title>
              <Text c="dimmed" mt="sm">
                Создайте проект или откройте пример из 10 задач. Измените
                длительность Backend API и посмотрите, какие работы сдвинутся.
              </Text>
            </Card>
          )}

          {view && draft && (
            <>
              <Group justify="space-between" align="start">
                <div>
                  <Group gap="xs">
                    <Text className="eyebrow">ОБЗОР ПРОЕКТА</Text>
                    <Badge variant="light" size="sm">
                      {view.project.timezone}
                    </Badge>
                    {draft.baseline && (
                      <Badge variant="outline" color="teal" size="sm">
                        Базовый план сохранен ({shortDate(draft.baseline.saved_at)})
                      </Badge>
                    )}
                  </Group>
                  <Title order={1} mt={4}>
                    {view.project.name}
                  </Title>
                </div>
                <Button variant="default" onClick={() => setSettings(true)}>
                  Настройки и календари
                </Button>
              </Group>

              <SimpleGrid cols={{ base: 1, sm: 4 }}>
                <Card withBorder>
                  <Text c="dimmed" size="sm">
                    Прогноз завершения
                  </Text>
                  <Title order={3} mt={8}>
                    {date(view.analysis.finish)}
                  </Title>
                  <Group gap={6} mt={6}>
                    <Text
                      size="sm"
                      c={view.analysis.deadline_exceeded ? "red" : "teal"}
                      fw={500}
                    >
                      {view.analysis.deadline_exceeded
                        ? `Превышение дедлайна на ${view.analysis.delay_minutes / 60} ч`
                        : "В пределах дедлайна"}
                    </Text>
                    {baselineVarianceHours !== null && (
                      <Badge
                        size="xs"
                        color={baselineVarianceHours > 0 ? "red" : "teal"}
                        variant="light"
                      >
                        {baselineVarianceHours > 0
                          ? `Отклонение: +${baselineVarianceHours} ч`
                          : "В графике базового плана"}
                      </Badge>
                    )}
                  </Group>
                </Card>

                <Card withBorder>
                  <Text c="dimmed" size="sm">
                    Прогресс задач
                  </Text>
                  <Group align="baseline" gap="xs" mt={8}>
                    <Title order={2}>{completedCount}</Title>
                    <Text size="sm" c="dimmed">
                      из {totalTasksCount} завершено
                    </Text>
                  </Group>
                  <Progress value={progressPercent} color="teal" mt="sm" size="sm" radius="xl" />
                </Card>

                <Card withBorder>
                  <Text c="dimmed" size="sm">
                    Просрочки в реальном времени
                  </Text>
                  <Group align="baseline" gap="xs" mt={8}>
                    <Title order={2} c={overdueTasks.length > 0 ? "red" : undefined}>
                      {overdueTasks.length}
                    </Title>
                    <Text size="sm" c="dimmed">
                      задач
                    </Text>
                  </Group>
                  {overdueTasks.length > 0 ? (
                    <Button
                      variant="subtle"
                      color="red"
                      size="xs"
                      p={0}
                      mt={4}
                      onClick={handleRescheduleOverdue}
                      disabled={!overdueTasks.some((r) => !draft.tasks.find((t) => t.id === r.id)?.actual_start)}
                      title="Переносит только задачи без фактического начала. Для начатых задач уточните длительность."
                    >
                      Перенести ещё не начатые задачи
                    </Button>
                  ) : (
                    <Text size="sm" mt={6} c="teal">
                      Нет просроченных задач
                    </Text>
                  )}
                </Card>

                <Card withBorder>
                  <Text c="dimmed" size="sm">
                    Команда и загрузка
                  </Text>
                  <Group align="baseline" gap="xs" mt={8}>
                    <Title order={2}>{draft.assignees.length}</Title>
                    <Text size="sm" c="dimmed">
                      чел.
                    </Text>
                  </Group>
                  <Text
                    size="sm"
                    mt={4}
                    c={overloadedAssigneeIds.size > 0 ? "red" : "teal"}
                    fw={500}
                  >
                    {overloadedAssigneeIds.size > 0
                      ? `Перегружено: ${overloadedAssigneeIds.size} чел.`
                      : "Загрузка в норме"}
                  </Text>
                </Card>
              </SimpleGrid>

              {dirty && (
                <Alert
                  color={preview ? "orange" : "blue"}
                  title={
                    preview
                      ? "Предпросмотр последствий"
                      : "Есть изменения в черновике"
                  }
                >
                  <Group justify="space-between">
                    <Text size="sm">
                      {preview
                        ? `Изменились даты ${affected.size} задач. Сдвиг завершения: ${preview.changes!.finish_delta_minutes / 60} календарных ч.`
                        : "Рассчитайте последствия перед сохранением."}
                    </Text>
                    <Group>
                      <Button
                        variant="subtle"
                        disabled={busy}
                        onClick={() => {
                          setDraft(copy(saved!.project));
                          setPreview(null);
                        }}
                      >
                        Отменить
                      </Button>
                      {!preview ? (
                        <Button
                          loading={busy}
                          onClick={() =>
                            void run(async () =>
                              setPreview(
                                await api<Result>(
                                  `/projects/${saved!.id}/simulate`,
                                  "POST",
                                  { version: saved!.version, project: draft },
                                ),
                              ),
                            )
                          }
                        >
                          Показать последствия
                        </Button>
                      ) : (
                        <Button
                          loading={busy}
                          onClick={() =>
                            void run(async () => {
                              accept(
                                await api<Result>(
                                  `/projects/${saved!.id}`,
                                  "PUT",
                                  { version: saved!.version, project: draft },
                                ),
                              );
                              await list();
                            })
                          }
                        >
                          Применить изменения
                        </Button>
                      )}
                    </Group>
                  </Group>
                </Alert>
              )}

              <Tabs defaultValue="graph">
                <Tabs.List>
                  <Tabs.Tab value="graph">Карта зависимостей</Tabs.Tab>
                  <Tabs.Tab value="tasks">Задачи</Tabs.Tab>
                  <Tabs.Tab value="gantt">Диаграмма Ганта</Tabs.Tab>
                  <Tabs.Tab value="links">Связи</Tabs.Tab>
                  <Tabs.Tab value="team">
                    Команда и навыки
                    {overloadedAssigneeIds.size > 0 && (
                      <Badge size="xs" color="red" ml={6} circle>
                        !
                      </Badge>
                    )}
                  </Tabs.Tab>
                  <Tabs.Tab value="risks">Риски и AI</Tabs.Tab>
                </Tabs.List>

                <Tabs.Panel value="graph" pt="md">
                  <Card withBorder p={0}>
                    <div className="graph">
                      <ReactFlow
                        nodes={nodes}
                        edges={view.project.dependencies.map((d, i) => ({
                          id: String(i),
                          source: d.predecessor_id,
                          target: d.successor_id,
                          label: `${d.kind}${d.lag_minutes ? " " + d.lag_minutes / 60 + " ч" : ""}`,
                          markerEnd: { type: MarkerType.ArrowClosed },
                          style: {
                            stroke: affected.has(d.successor_id)
                              ? "#dd8631"
                              : "#7b9690",
                          },
                        }))}
                        fitView
                        nodesDraggable={false}
                        nodesConnectable={false}
                        onNodeClick={(_, node) =>
                          setTask(
                            copy(draft.tasks.find((t) => t.id === node.id)!),
                          )
                        }
                      >
                        <Background color={colorScheme === "dark" ? "#223330" : "#e6eee9"} />
                        <Controls />
                      </ReactFlow>
                    </div>
                  </Card>
                  <Text size="xs" c="dimmed" mt="xs">
                    Красная рамка — критическая задача. Оранжевая — изменение
                    дат в сценарии. Нажмите на задачу для редактирования.
                  </Text>
                </Tabs.Panel>

                <Tabs.Panel value="tasks" pt="md">
                  <Stack>
                    <Group justify="space-between">
                      <Text c="dimmed" size="sm">
                        Длительность — рабочее время задачи; приоритет подсвечивает важность задачи.
                      </Text>
                      <Button onClick={() => setTask(defaultTask())}>
                        Добавить задачу
                      </Button>
                    </Group>
                    <Table.ScrollContainer minWidth={900}>
                      <Table striped highlightOnHover>
                        <Table.Thead>
                          <Table.Tr>
                            <Table.Th>Приоритет</Table.Th>
                            <Table.Th>Задача</Table.Th>
                            <Table.Th>Исполнитель</Table.Th>
                            <Table.Th>Статус</Table.Th>
                            <Table.Th>Рабочие часы</Table.Th>
                            <Table.Th>Прогноз</Table.Th>
                            <Table.Th>Резерв</Table.Th>
                          </Table.Tr>
                        </Table.Thead>
                        <Table.Tbody>
                          {draft.tasks.map((t) => {
                            const person = draft.assignees.find(
                              (p) => p.id === t.assignee_id,
                            );
                            const r = rows.get(t.id);
                            const isOverdue = r && t.status !== "done" && new Date(r.finish) < now;
                            return (
                              <Table.Tr
                                key={t.id}
                                onClick={() => setTask(copy(t))}
                                style={{ cursor: "pointer" }}
                              >
                                <Table.Td>
                                  <Badge
                                    size="xs"
                                    color={priorityColors[t.priority || "medium"]}
                                  >
                                    {priorityLabels[t.priority || "medium"]}
                                  </Badge>
                                </Table.Td>
                                <Table.Td fw={600}>
                                  <Group gap={6}>
                                    <Text size="sm" fw={600}>
                                      {t.name}
                                    </Text>
                                    {isOverdue && (
                                      <Badge size="xs" color="red" variant="filled">
                                        Просрочена
                                      </Badge>
                                    )}
                                  </Group>
                                  {t.required_skills && t.required_skills.length > 0 && (
                                    <Group gap={4} mt={2}>
                                      {t.required_skills.map((skill, idx) => (
                                        <Badge key={idx} size="xs" variant="outline" color="gray">
                                          {skill}
                                        </Badge>
                                      ))}
                                    </Group>
                                  )}
                                </Table.Td>
                                <Table.Td>
                                  {person ? (
                                    <Group gap="xs">
                                      <Avatar
                                        size={22}
                                        radius="xl"
                                        color={getAvatarColor(person.id)}
                                      >
                                        {getInitials(person.name)}
                                      </Avatar>
                                      <Text size="sm">{person.name}</Text>
                                    </Group>
                                  ) : (
                                    <Text size="sm" c="dimmed">
                                      Не назначен
                                    </Text>
                                  )}
                                </Table.Td>
                                <Table.Td>
                                  <Badge color={statusColors[t.status]} variant="light">
                                    {statusLabels[t.status]}
                                  </Badge>
                                </Table.Td>
                                <Table.Td>{t.duration_minutes / 60} ч</Table.Td>
                                <Table.Td>
                                  {rows.has(t.id)
                                    ? date(rows.get(t.id)!.finish)
                                    : "После расчёта"}
                                </Table.Td>
                                <Table.Td>
                                  {rows.get(t.id)?.slack_minutes == null
                                    ? "—"
                                    : `${rows.get(t.id)!.slack_minutes! / 60} ч`}
                                </Table.Td>
                              </Table.Tr>
                            );
                          })}
                        </Table.Tbody>
                      </Table>
                    </Table.ScrollContainer>
                  </Stack>
                </Tabs.Panel>

                <Tabs.Panel value="gantt" pt="md">
                  <Card withBorder padding="md">
                    <Stack gap="md">
                      <Group justify="space-between" align="center">
                        <div>
                          <Title order={3}>Интерактивная Диаграмма Ганта</Title>
                          <Text size="sm" c="dimmed">
                            Каскадная шкала времени с отображением критического пути и базового плана.
                          </Text>
                        </div>
                        <Group gap="xs">
                          <Badge color="red" size="sm">Критический путь</Badge>
                          <Badge color="teal" size="sm">Обычная задача</Badge>
                          {draft.baseline && <Badge color="gray" variant="outline" size="sm">Базовый план</Badge>}
                        </Group>
                      </Group>

                      <Divider />

                      <Stack gap="xs">
                        {draft.tasks.map((t) => {
                          const r = rows.get(t.id);
                          if (!r) return null;
                          const person = draft.assignees.find((p) => p.id === t.assignee_id);
                          const tStartMs = new Date(r.start).getTime();
                          const tEndMs = new Date(r.finish).getTime();

                          const leftPct = Math.max(0, Math.min(100, ((tStartMs - projStartMs) / projTotalMs) * 100));
                          const widthPct = Math.max(1, Math.min(100 - leftPct, ((tEndMs - tStartMs) / projTotalMs) * 100));

                          let baseLeftPct = 0;
                          let baseWidthPct = 0;
                          if (draft.baseline && draft.baseline.tasks[t.id]) {
                            const bStartMs = new Date(draft.baseline.tasks[t.id].start).getTime();
                            const bEndMs = new Date(draft.baseline.tasks[t.id].finish).getTime();
                            baseLeftPct = Math.max(0, Math.min(100, ((bStartMs - projStartMs) / projTotalMs) * 100));
                            baseWidthPct = Math.max(1, Math.min(100 - baseLeftPct, ((bEndMs - bStartMs) / projTotalMs) * 100));
                          }

                          const isOverdue = t.status !== "done" && new Date(r.finish) < now;

                          return (
                            <Card
                              key={t.id}
                              withBorder
                              p="xs"
                              style={{ cursor: "pointer" }}
                              onClick={() => setTask(copy(t))}
                            >
                              <Group justify="space-between" align="center" mb={6}>
                                <Group gap="xs">
                                  <Badge size="xs" color={priorityColors[t.priority || "medium"]}>
                                    {priorityLabels[t.priority || "medium"]}
                                  </Badge>
                                  <Text size="sm" fw={600}>
                                    {t.name}
                                  </Text>
                                  {person && (
                                    <Text size="xs" c="dimmed">
                                      ({person.name})
                                    </Text>
                                  )}
                                  {isOverdue && (
                                    <Badge size="xs" color="red">
                                      Просрочена
                                    </Badge>
                                  )}
                                </Group>
                                <Text size="xs" c="dimmed">
                                  {date(r.start)} → {date(r.finish)}
                                </Text>
                              </Group>

                              <div style={{ position: "relative", height: "24px", background: colorScheme === "dark" ? "#141e1c" : "#f0f5f3", borderRadius: "4px" }}>
                                {draft.baseline && draft.baseline.tasks[t.id] && (
                                  <div
                                    style={{
                                      position: "absolute",
                                      top: "2px",
                                      bottom: "2px",
                                      left: `${baseLeftPct}%`,
                                      width: `${baseWidthPct}%`,
                                      background: "rgba(150, 150, 150, 0.3)",
                                      border: "1px stroke gray",
                                      borderRadius: "3px",
                                    }}
                                    title="Базовый план"
                                  />
                                )}
                                <div
                                  style={{
                                    position: "absolute",
                                    top: "4px",
                                    bottom: "4px",
                                    left: `${leftPct}%`,
                                    width: `${widthPct}%`,
                                    background: r.critical ? "#d4545c" : "#0d947a",
                                    borderRadius: "3px",
                                  }}
                                  title={`Сроки: ${date(r.start)} - ${date(r.finish)}`}
                                />
                              </div>
                            </Card>
                          );
                        })}
                      </Stack>
                    </Stack>
                  </Card>
                </Tabs.Panel>

                <Tabs.Panel value="links" pt="md">
                  <Stack>
                    <Text size="sm" c="dimmed">
                      FS: окончание → начало; SS: начало → начало; FF: окончание
                      → окончание; SF: начало → окончание. Отрицательная
                      задержка разрешает перекрытие.
                    </Text>
                    {draft.dependencies.map((d, i) => (
                      <Group key={i}>
                        <Text flex={1}>
                          {
                            draft.tasks.find((t) => t.id === d.predecessor_id)
                              ?.name
                          }{" "}
                          →{" "}
                          {
                            draft.tasks.find((t) => t.id === d.successor_id)
                              ?.name
                          }
                        </Text>
                        <Badge>
                          {d.kind} · {d.lag_minutes / 60}{" "}
                          {d.lag_mode === "working" ? "раб." : "кал."} ч
                        </Badge>
                        <Button
                          variant="subtle"
                          color="red"
                          onClick={() =>
                            change({
                              ...draft,
                              dependencies: draft.dependencies.filter(
                                (_, j) => j !== i,
                              ),
                            })
                          }
                        >
                          Удалить
                        </Button>
                      </Group>
                    ))}
                    <Divider />
                    <Group align="end">
                      <Select
                        label="Предшественник"
                        data={taskOptions}
                        value={dep.predecessor_id}
                        onChange={(v) =>
                          setDep({ ...dep, predecessor_id: v || "" })
                        }
                      />
                      <Select
                        label="Последователь"
                        data={taskOptions}
                        value={dep.successor_id}
                        onChange={(v) =>
                          setDep({ ...dep, successor_id: v || "" })
                        }
                      />
                      <Select
                        label="Тип"
                        data={["FS", "SS", "FF", "SF"]}
                        value={dep.kind}
                        w={80}
                        onChange={(v) =>
                          setDep({ ...dep, kind: v as Dependency["kind"] })
                        }
                      />
                      <NumberInput
                        label="Задержка, ч"
                        value={dep.lag_minutes / 60}
                        w={130}
                        onChange={(v) =>
                          setDep({
                            ...dep,
                            lag_minutes: Math.round(Number(v) * 60),
                          })
                        }
                      />
                      <Select
                        label="Часы"
                        data={[
                          { value: "working", label: "Рабочие" },
                          { value: "elapsed", label: "Календарные" },
                        ]}
                        value={dep.lag_mode}
                        w={140}
                        onChange={(v) =>
                          setDep({
                            ...dep,
                            lag_mode: v as Dependency["lag_mode"],
                          })
                        }
                      />
                      <Button
                        disabled={!dep.predecessor_id || !dep.successor_id}
                        onClick={() =>
                          change({
                            ...draft,
                            dependencies: [...draft.dependencies, copy(dep)],
                          })
                        }
                      >
                        Добавить связь
                      </Button>
                    </Group>
                  </Stack>
                </Tabs.Panel>

                <Tabs.Panel value="team" pt="md">
                  <Stack gap="lg">
                    <Group justify="space-between" align="center">
                      <div>
                        <Title order={3}>Матрица компетенций и надёжность команды</Title>
                        <Text size="sm" c="dimmed">
                          Уровень навыков, загрузка и индекс надёжности выполнения задач.
                        </Text>
                      </div>
                    </Group>

                    {draft.assignees.length === 0 ? (
                      <Card withBorder padding="lg">
                        <Text c="dimmed" ta="center">
                          В проекте пока нет исполнителей. Добавьте их в настройках проекта.
                        </Text>
                      </Card>
                    ) : (
                      <SimpleGrid cols={{ base: 1, md: 2 }}>
                        {draft.assignees.map((person) => {
                          const assignedTasks = draft.tasks.filter(
                            (t) => t.assignee_id === person.id,
                          );
                          const totalHours = assignedTasks.reduce(
                            (sum, t) => sum + t.duration_minutes / 60,
                            0,
                          );
                          const isOverloaded = overloadedAssigneeIds.has(person.id);
                          const weeklyHours = getWeeklyHours(person.calendar);
                          const reliability = calculateReliabilityScore(person, draft.tasks);

                          return (
                            <Card key={person.id} withBorder p="md">
                              <Stack gap="sm">
                                <Group justify="space-between">
                                  <Group gap="sm">
                                    <Avatar
                                      size={44}
                                      radius="xl"
                                      color={getAvatarColor(person.id)}
                                    >
                                      {getInitials(person.name)}
                                    </Avatar>
                                    <div>
                                      <Text fw={600} size="lg">{person.name}</Text>
                                      <Group gap={6} mt={2}>
                                        <Badge size="xs" variant="outline" color="gray">
                                          {weeklyHours} ч/нед
                                        </Badge>
                                        <Badge size="xs" color="teal">
                                          Индекс надёжности: {reliability}%
                                        </Badge>
                                      </Group>
                                    </div>
                                  </Group>
                                  {isOverloaded ? (
                                    <Badge color="red" variant="filled">
                                      Перегрузка
                                    </Badge>
                                  ) : (
                                    <Badge color="teal" variant="light">
                                      Норма
                                    </Badge>
                                  )}
                                </Group>

                                {person.skills && person.skills.length > 0 && (
                                  <div>
                                    <Text size="xs" fw={600} c="dimmed" mb={4}>
                                      Компетенции / Скиллы:
                                    </Text>
                                    <Group gap={4}>
                                      {person.skills.map((sk, idx) => (
                                        <Badge key={idx} size="xs" color="indigo" variant="light">
                                          {sk.name} ({skillLevelLabels[sk.level]})
                                        </Badge>
                                      ))}
                                    </Group>
                                  </div>
                                )}

                                <Divider />

                                <div>
                                  <Group justify="space-between" mb={4}>
                                    <Text size="xs" fw={500} c="dimmed">
                                      Назначенные задачи ({assignedTasks.length}):
                                    </Text>
                                    <Text size="xs" fw={600}>
                                      Всего: {totalHours} рабочих ч
                                    </Text>
                                  </Group>
                                  {assignedTasks.length === 0 ? (
                                    <Text size="xs" c="dimmed" fs="italic">
                                      Нет назначенных задач
                                    </Text>
                                  ) : (
                                    <Stack gap={6} mt={6}>
                                      {assignedTasks.map((t) => (
                                        <Group
                                          key={t.id}
                                          justify="space-between"
                                          style={{ cursor: "pointer" }}
                                          onClick={() => setTask(copy(t))}
                                        >
                                          <Group gap={6}>
                                            <Badge
                                              size="xs"
                                              color={priorityColors[t.priority || "medium"]}
                                            >
                                              {priorityLabels[t.priority || "medium"]}
                                            </Badge>
                                            <Text size="sm">{t.name}</Text>
                                          </Group>
                                          <Text size="xs" c="dimmed">
                                            {t.duration_minutes / 60} ч
                                          </Text>
                                        </Group>
                                      ))}
                                    </Stack>
                                  )}
                                </div>

                                <Button
                                  variant="subtle"
                                  size="xs"
                                  color="teal"
                                  mt="xs"
                                  onClick={() => setSettings(true)}
                                >
                                  Изменить график и навыки
                                </Button>
                              </Stack>
                            </Card>
                          );
                        })}
                      </SimpleGrid>
                    )}
                  </Stack>
                </Tabs.Panel>

                <Tabs.Panel value="risks" pt="md">
                  <SimpleGrid cols={{ base: 1, md: 2 }}>
                    <Card withBorder>
                      <Title order={3}>Требуют внимания</Title>
                      <Stack mt="md">
                        {!view.analysis.tasks.some(
                          (t) => t.risk_flags.length,
                        ) && (
                          <Text c="dimmed">
                            По текущему плану предупреждений нет.
                          </Text>
                        )}
                        {view.analysis.tasks
                          .filter((t) => t.risk_flags.length)
                          .map((t) => (
                            <div key={t.id}>
                              <Text fw={600}>
                                {
                                  view.project.tasks.find((x) => x.id === t.id)
                                    ?.name
                                }
                              </Text>
                              <Text size="sm" c="red">
                                {t.risk_flags
                                  .map((f) => riskLabels[f] || f)
                                  .join(" · ")}
                              </Text>
                            </div>
                          ))}
                        {view.analysis.overloads.slice(0, 20).map((o, i) => (
                          <Text key={i} size="sm">
                            {
                              view.project.assignees.find(
                                (p) => p.id === o.assignee_id,
                              )?.name
                            }
                            : {o.allocation_percent}% · {date(o.start)} —{" "}
                            {date(o.finish)}
                          </Text>
                        ))}
                        {view.analysis.overloads.length > 20 && (
                          <Text size="sm">
                            Показаны первые 20 интервалов из{" "}
                            {view.analysis.overloads.length}.
                          </Text>
                        )}
                      </Stack>
                    </Card>

                    <Card withBorder>
                      <Title order={3}>Объяснение AI</Title>
                      <Text c="dimmed" size="sm" mt="sm">
                        AI объясняет сохранённый план и предлагает действия. Все
                        даты и риски рассчитаны сервером.
                      </Text>
                      <Button
                        mt="md"
                        variant="light"
                        disabled={busy || dirty}
                        onClick={() =>
                          void run(async () => {
                            const result = await api<{ text: string }>(
                              `/projects/${saved!.id}/ai`,
                              "POST",
                            );
                            setAi(result.text);
                          })
                        }
                      >
                        Объяснить ситуацию
                      </Button>
                      <Text mt="md" style={{ whiteSpace: "pre-wrap" }}>
                        {ai}
                      </Text>
                    </Card>
                  </SimpleGrid>
                </Tabs.Panel>
              </Tabs>
            </>
          )}
        </Stack>
      </Container>

      <Modal
        opened={newProject}
        onClose={() => setNewProject(false)}
        title="Создание нового проекта"
      >
        <Stack gap="md">
          <TextInput
            label="Название проекта"
            placeholder="Например: Запуск мобильного приложения"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />

          <Select
            label="Часовой пояс IANA"
            description="Проект будет рассчитывать рабочие смены в выбранной часовой зоне"
            data={TIMEZONE_OPTIONS}
            value={timezone}
            onChange={(v) => v && setTimezone(v)}
            searchable
          />

          <ProjectDateInput
            label="Дата начала проекта"
            zone={timezone}
            value={start}
            onChange={setStart}
            required
          />

          <ProjectDateInput
            label="Целевой дедлайн проекта"
            zone={timezone}
            value={deadline}
            onChange={setDeadline}
            required
          />

          <Button
            loading={busy}
            disabled={!name.trim()}
            onClick={() =>
              void run(async () => {
                accept(
                  await api<Result>("/projects", "POST", {
                    name,
                    start,
                    deadline,
                    timezone,
                    calendar: defaultCalendar(),
                    assignees: [],
                    tasks: [],
                    dependencies: [],
                  }),
                );
                await list();
                setNewProject(false);
              })
            }
          >
            Создать проект
          </Button>
        </Stack>
      </Modal>

      <Modal
        opened={importModal}
        onClose={() => setImportModal(false)}
        title="Импорт задач из CSV"
        size="lg"
      >
        <Stack gap="md">
          <Text size="sm" c="dimmed">
            Вставьте содержимое CSV-файла или скопируйте строки из Excel.
            Формат столбцов: <code>ID; Название задачи; Приоритет; Статус; Длительность (ч); Исполнитель; Навыки</code>
          </Text>
          <Textarea
            label="Данные в формате CSV"
            rows={8}
            placeholder={`ID;Название задачи;Приоритет;Статус;Длительность;Исполнитель;Навыки\n1;Backend API;Высокий;todo;24;Мария;Python, SQL\n2;Frontend UI;Средний;todo;16;Денис;React`}
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
          />
          <Group justify="flex-end">
            <Button variant="subtle" onClick={() => setImportModal(false)}>
              Отмена
            </Button>
            <Button
              disabled={!importText.trim() || !draft}
              onClick={() => {
                if (!draft) return;
                const imported = parseCsvTasks(importText, draft.assignees);
                if (imported.length > 0) {
                  change({
                    ...draft,
                    tasks: [...draft.tasks, ...imported],
                  });
                  setImportText("");
                  setImportModal(false);
                }
              }}
            >
              Импортировать {importText.trim().split("\n").length - 1} задач
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Drawer
        opened={!!task}
        onClose={() => setTask(null)}
        title="Параметры задачи"
        position="right"
        size="md"
      >
        {task && draft && (
          <Stack gap="md">
            <TextInput
              label="Название задачи"
              value={task.name}
              onChange={(e) => setTask({ ...task, name: e.target.value })}
            />

            <Group grow>
              <NumberInput
                label="Длительность, раб. ч"
                min={1 / 60}
                value={task.duration_minutes / 60}
                onChange={(v) =>
                  setTask({
                    ...task,
                    duration_minutes: Math.round(Number(v) * 60),
                  })
                }
              />
              <Select
                label="Приоритет"
                data={[
                  { value: "low", label: "Низкий" },
                  { value: "medium", label: "Средний" },
                  { value: "high", label: "Высокий" },
                  { value: "urgent", label: "Срочный" },
                ]}
                value={task.priority || "medium"}
                onChange={(v) =>
                  setTask({ ...task, priority: (v as Priority) || "medium" })
                }
              />
            </Group>

            <Select
              label="Статус задачи"
              data={Object.entries(statusLabels).map(([value, label]) => ({
                value,
                label,
              }))}
              value={task.status}
              onChange={(v) =>
                v && setTask(changeTaskStatus(task, v as Task["status"]))
              }
            />

            <TextInput
              label="Требуемые навыки (через запятую)"
              placeholder="Например: Python, React, SQL"
              value={(task.required_skills || []).join(", ")}
              onChange={(e) =>
                setTask({
                  ...task,
                  required_skills: e.target.value
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean),
                })
              }
            />

            <div>
              <Select
                label="Ответственный исполнитель"
                clearable
                placeholder="Выберите исполнителя"
                data={draft.assignees.map((p) => {
                  const matchScore = calculateSkillMatch(task, p);
                  const isOverloaded = overloadedAssigneeIds.has(p.id);
                  return {
                    value: p.id,
                    label: `${p.name} (Совпадение: ${matchScore}%)${isOverloaded ? " — Перегрузка" : ""}`,
                  };
                })}
                value={task.assignee_id}
                onChange={(v) => setTask({ ...task, assignee_id: v })}
              />

              {task.assignee_id && (
                <Card withBorder p="xs" mt="xs">
                  {(() => {
                    const person = draft.assignees.find((p) => p.id === task.assignee_id);
                    if (!person) return null;
                    const matchScore = calculateSkillMatch(task, person);
                    return (
                      <Group justify="space-between">
                        <Group gap="xs">
                          <Avatar size={26} radius="xl" color={getAvatarColor(person.id)}>
                            {getInitials(person.name)}
                          </Avatar>
                          <div>
                            <Text size="xs" fw={600}>
                              {person.name}
                            </Text>
                            <Text size="xs" c="dimmed">
                              Соответствие навыкам: {matchScore}%
                            </Text>
                          </div>
                        </Group>
                        <Badge size="xs" color={matchScore > 50 ? "teal" : "orange"}>
                          {matchScore}% Match
                        </Badge>
                      </Group>
                    );
                  })()}
                </Card>
              )}
            </div>

            <NumberInput
              label="Процент занятости, %"
              description="Используется для выявления локальной перегрузки сотрудника"
              min={1}
              max={100}
              value={task.allocation_percent}
              onChange={(v) =>
                setTask({ ...task, allocation_percent: Number(v) })
              }
            />

            <ProjectDateInput
              label="Начать не раньше (необязательно)"
              zone={draft.timezone}
              value={task.not_before}
              onChange={(value) =>
                setTask({
                  ...task,
                  not_before: value || null,
                })
              }
            />

            {task.status === "in_progress" || task.status === "done" || task.status === "blocked" ? (
              <ProjectDateInput
                label="Фактическое начало"
                zone={draft.timezone}
                value={task.actual_start}
                onChange={(value) =>
                  setTask({
                    ...task,
                    actual_start: value || null,
                  })
                }
              />
            ) : null}

            {task.status === "done" ? (
              <ProjectDateInput
                label="Фактическое окончание"
                zone={draft.timezone}
                value={task.actual_finish}
                onChange={(value) =>
                  setTask({
                    ...task,
                    actual_finish: value || null,
                  })
                }
              />
            ) : null}

            <Button
              disabled={!task.name.trim() || !task.duration_minutes}
              onClick={() => {
                change({
                  ...draft,
                  tasks: draft.tasks.some((t) => t.id === task.id)
                    ? draft.tasks.map((t) => (t.id === task.id ? task : t))
                    : [...draft.tasks, task],
                });
                setTask(null);
              }}
            >
              Сохранить в черновик
            </Button>

            {draft.tasks.some((t) => t.id === task.id) && (
              <Button
                variant="light"
                color="red"
                onClick={() => {
                  change({
                    ...draft,
                    tasks: draft.tasks.filter((t) => t.id !== task.id),
                    dependencies: draft.dependencies.filter(
                      (d) =>
                        d.predecessor_id !== task.id &&
                        d.successor_id !== task.id,
                    ),
                  });
                  setTask(null);
                }}
              >
                Удалить задачу и ее связи
              </Button>
            )}
          </Stack>
        )}
      </Drawer>

      <Drawer
        opened={settings}
        onClose={() => setSettings(false)}
        title="Настройки проекта и команды"
        position="right"
        size="xl"
      >
        {draft && (
          <Stack gap="lg">
            <TextInput
              label="Название проекта"
              value={draft.name}
              onChange={(e) => change({ ...draft, name: e.target.value })}
            />

            <Select
              label="Часовой пояс IANA"
              data={TIMEZONE_OPTIONS}
              value={draft.timezone}
              onChange={(v) => v && change({ ...draft, timezone: v })}
              searchable
            />

            <Group grow>
              <ProjectDateInput
                label="Дата начала проекта"
                zone={draft.timezone}
                value={draft.start}
                onChange={(value) =>
                  change({
                    ...draft,
                    start: value,
                  })
                }
              />
              <ProjectDateInput
                label="Целевой дедлайн"
                zone={draft.timezone}
                value={draft.deadline}
                onChange={(value) =>
                  change({
                    ...draft,
                    deadline: value,
                  })
                }
              />
            </Group>

            <Divider />

            <Title order={4}>Календарь проекта (Общее расписание)</Title>
            <CalendarEditor
              value={draft.calendar}
              onChange={(calendar) => change({ ...draft, calendar })}
            />

            <Divider />

            <Group justify="space-between" align="center">
              <div>
                <Title order={4}>Состав команды и компетенции</Title>
                <Text size="sm" c="dimmed">
                  Добавляйте навыки сотрудникам и редактируйте их персональные графики.
                </Text>
              </div>
              <Button
                variant="light"
                size="xs"
                onClick={() =>
                  change({
                    ...draft,
                    assignees: [
                      ...draft.assignees,
                      {
                        id: crypto.randomUUID(),
                        name: `Исполнитель ${draft.assignees.length + 1}`,
                        skills: [],
                        calendar: defaultCalendar(),
                      },
                    ],
                  })
                }
              >
                + Добавить исполнителя
              </Button>
            </Group>

            {draft.assignees.map((p, i) => (
              <Card key={p.id} withBorder p="md">
                <Stack gap="sm">
                  <Group justify="space-between">
                    <Group gap="xs">
                      <Avatar size={32} radius="xl" color={getAvatarColor(p.id)}>
                        {getInitials(p.name)}
                      </Avatar>
                      <TextInput
                        label="Имя исполнителя"
                        value={p.name}
                        w={250}
                        onChange={(e) =>
                          change({
                            ...draft,
                            assignees: draft.assignees.map((a, j) =>
                              i === j ? { ...a, name: e.target.value } : a,
                            ),
                          })
                        }
                      />
                    </Group>
                    <Button
                      variant="subtle"
                      color="red"
                      size="xs"
                      onClick={() =>
                        change({
                          ...draft,
                          assignees: draft.assignees.filter((_, j) => i !== j),
                          tasks: draft.tasks.map((t) =>
                            t.assignee_id === p.id ? { ...t, assignee_id: null } : t,
                          ),
                        })
                      }
                    >
                      Удалить
                    </Button>
                  </Group>

                  <div>
                    <Text size="xs" fw={600} mb={4}>
                      Навыки и компетенции:
                    </Text>
                    <Group gap={4} mb={6}>
                      {(p.skills || []).map((sk, skIdx) => (
                        <Badge
                          key={skIdx}
                          size="sm"
                          variant="light"
                          color="indigo"
                          rightSection={
                            <ActionIcon
                              size="xs"
                              color="blue"
                              radius="xl"
                              variant="transparent"
                              onClick={() =>
                                change({
                                  ...draft,
                                  assignees: draft.assignees.map((a, j) =>
                                    i === j
                                      ? {
                                          ...a,
                                          skills: (a.skills || []).filter((_, idx) => idx !== skIdx),
                                        }
                                      : a,
                                  ),
                                })
                              }
                            >
                              ✕
                            </ActionIcon>
                          }
                        >
                          {sk.name} ({skillLevelLabels[sk.level]})
                        </Badge>
                      ))}
                    </Group>
                    <Group align="end" gap="xs">
                      <TextInput
                        placeholder="Например: Python, React, Figma"
                        size="xs"
                        value={newSkillName}
                        onChange={(e) => setNewSkillName(e.target.value)}
                      />
                      <Button
                        size="xs"
                        variant="light"
                        disabled={!newSkillName.trim()}
                        onClick={() => {
                          change({
                            ...draft,
                            assignees: draft.assignees.map((a, j) =>
                              i === j
                                ? {
                                    ...a,
                                    skills: [
                                      ...(a.skills || []),
                                      { name: newSkillName.trim(), level: "expert" },
                                    ],
                                  }
                                : a,
                            ),
                          });
                          setNewSkillName("");
                        }}
                      >
                        + Навык
                      </Button>
                    </Group>
                  </div>

                  <Text size="xs" fw={600} mt="xs">
                    Персональный график работы и отпуска:
                  </Text>

                  <CalendarEditor
                    value={p.calendar}
                    onChange={(calendar) =>
                      change({
                        ...draft,
                        assignees: draft.assignees.map((a, j) =>
                          i === j ? { ...a, calendar } : a,
                        ),
                      })
                    }
                  />
                </Stack>
              </Card>
            ))}

            <Button onClick={() => setSettings(false)}>
              Готово — перейти к проверке последствий
            </Button>
          </Stack>
        )}
      </Drawer>
    </MantineProvider>
  );
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

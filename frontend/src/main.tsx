import React, { useEffect, useState, useMemo } from "react";
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
  FileInput,
  Group,
  MantineProvider,
  Menu,
  Modal,
  NumberInput,
  PasswordInput,
  Popover,
  Progress,
  ScrollArea,
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
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  CalendarDays,
  Check,
  ChevronDown,
  CircleHelp,
  Gauge,
  GitBranch,
  LayoutDashboard,
  List,
  MoreHorizontal,
  Plus,
  Settings,
  SlidersHorizontal,
  Sparkles,
  Target,
  X,
  Zap,
  Download,
  Upload,
  Sun,
  Moon,
  LogOut,
  RefreshCw,
  RotateCcw,
  Users,
  Trash2,
  Edit,
  Link as LinkIcon,
  FileText,
  FileJson,
  ChevronRight,
  BookmarkCheck,
} from "lucide-react";
import "@mantine/core/styles.css";
import "@xyflow/react/dist/style.css";
import "./style.css";
import { api } from "./api";
import { AICopilotChat } from "./AICopilotChat";
import { CalendarEditor } from "./CalendarEditor";
import { ExecutiveReportModal } from "./ExecutiveReportModal";
import { ProjectDateInput } from "./ProjectDateInput";
import { parseCsvToTasks, tasksToCsv } from "./taskCsv";
import { ProjectGraph } from "./ProjectGraph";
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

const statusLabels: Record<string, string> = {
  todo: "Запланировано",
  in_progress: "В работе",
  done: "Завершено",
  blocked: "Заблокировано",
};

const statusColors: Record<string, string> = {
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

const AVATAR_COLORS = ["ink", "orange", "green", "blue", "lilac"];

function getAvatarClass(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash);
  const color = AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
  return `avatar-${color}`;
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

function exportTasksToCsv(project: Project) {
  const url = URL.createObjectURL(new Blob([tasksToCsv(project.tasks)], {type: "text/csv;charset=utf-8"}));
  const link = document.createElement("a"); link.href = url; link.download = `${project.name}_tasks.csv`;
  document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url);
}

function exportProjectToJson(project: Project) {
  const jsonContent = JSON.stringify(project, null, 2);
  const blob = new Blob([jsonContent], { type: "application/json;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${project.name.replace(/\s+/g, "_")}_critix_export.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function parseJsonToProject(jsonStr: string): Project {
  const obj = JSON.parse(jsonStr);
  if (!obj || typeof obj !== "object") {
    throw new Error("Некорректный JSON-файл");
  }
  if (!obj.name || typeof obj.name !== "string") {
    throw new Error("В проекте отсутствует название (name)");
  }
  if (!obj.start || !obj.deadline) {
    throw new Error("В проекте отсутствуют даты start или deadline");
  }
  return {
    name: obj.name,
    timezone: obj.timezone || "Asia/Yekaterinburg",
    start: obj.start,
    deadline: obj.deadline,
    calendar: obj.calendar || defaultCalendar(),
    baseline: obj.baseline || null,
    assignees: Array.isArray(obj.assignees) ? obj.assignees : [],
    tasks: Array.isArray(obj.tasks) ? obj.tasks : [],
    dependencies: Array.isArray(obj.dependencies) ? obj.dependencies : [],
  };
}

export function App() {
  const [colorScheme, setColorScheme] = useState<"dark" | "light">(() => {
    const savedTheme = localStorage.getItem("critix_theme");
    return savedTheme === "light" || savedTheme === "dark" ? savedTheme : "light";
  });

  const toggleTheme = (theme: "dark" | "light") => {
    setColorScheme(theme);
    localStorage.setItem("critix_theme", theme);
    document.documentElement.setAttribute("data-mantine-color-scheme", theme);
  };

  useEffect(() => {
    document.documentElement.setAttribute("data-mantine-color-scheme", colorScheme);
  }, [colorScheme]);

  const [logged, setLogged] = useState(false);
  const [password, setPassword] = useState("");
  const [projects, setProjects] = useState<Array<{ id: string; name: string }>>([]);
  const [saved, setSaved] = useState<Result | null>(null);
  const [draft, setDraft] = useState<Project | null>(null);
  const zone = draft?.timezone || saved?.project.timezone || "UTC";
  const date = (iso: string) => new Date(iso).toLocaleString("ru-RU", {timeZone: zone, day: "numeric", month: "short", hour: "2-digit", minute: "2-digit"});
  const shortDate = (iso: string) => new Date(iso).toLocaleDateString("ru-RU", {timeZone: zone, day: "numeric", month: "short"});
  const [history, setHistory] = useState<Array<{version: number; created_at: string; finish: string; task_count: number}>>([]);
  const [historyError, setHistoryError] = useState("");
  useEffect(() => {
    let cancelled = false;
    setHistory([]); setHistoryError("");
    if (saved) void api<typeof history>(`/projects/${saved.id}/history`).then(data => {
      if (!cancelled) setHistory(data);
    }).catch(() => { if (!cancelled) setHistoryError("Не удалось загрузить историю версий"); });
    return () => { cancelled = true; };
  }, [saved?.id, saved?.version]);
  const [preview, setPreview] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  // Modals & Drawers
  const [newProjectModal, setNewProjectModal] = useState(false);
  const [projectManageModal, setProjectManageModal] = useState(false);
  const [deleteConfirmProject, setDeleteConfirmProject] = useState<{ id: string; name: string } | null>(null);

  // Full Project JSON Import modal
  const [jsonImportModal, setJsonImportModal] = useState(false);
  const [jsonInput, setJsonInput] = useState("");
  const [jsonImportError, setJsonImportError] = useState("");

  // CSV Import modal
  const [importModal, setImportModal] = useState(false);
  const [csvInput, setCsvInput] = useState("");

  // Dependencies management modal
  const [depModal, setDepModal] = useState(false);
  const [newDepPred, setNewDepPred] = useState("");
  const [newDepSucc, setNewDepSucc] = useState("");
  const [newDepKind, setNewDepKind] = useState<Dependency["kind"]>("FS");
  const [newDepLagHours, setNewDepLagHours] = useState<number>(0);
  const [newDepLagMode, setNewDepLagMode] = useState<Dependency["lag_mode"]>("working");

  // Edit Dependency modal
  const [editingDepIndex, setEditingDepIndex] = useState<number | null>(null);
  const [editDepKind, setEditDepKind] = useState<Dependency["kind"]>("FS");
  const [editDepLagHours, setEditDepLagHours] = useState<number>(0);
  const [editDepLagMode, setEditDepLagMode] = useState<Dependency["lag_mode"]>("working");

  const [newProjName, setNewProjName] = useState("Новый проект");
  const [newProjTz, setNewProjTz] = useState("Asia/Yekaterinburg");
  const [newProjStart, setNewProjStart] = useState(() => new Date(Math.ceil(Date.now() / 60000) * 60000).toISOString());
  const [newProjDeadline, setNewProjDeadline] = useState(() => new Date(Math.ceil(Date.now() / 60000) * 60000 + 14 * 86400000).toISOString());

  const [task, setTask] = useState<Task | null>(null);
  const [newTaskSkill, setNewTaskSkill] = useState("");
  const [settings, setSettings] = useState(false);
  const [settingsTab, setSettingsTab] = useState<string | null>("project");
  const [helpModal, setHelpModal] = useState(false);
  const [aiText, setAiText] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [executiveReportModal, setExecutiveReportModal] = useState(false);

  // Active view section
  const [activeView, setActiveView] = useState<"dashboard" | "graph" | "tasks_table" | "team" | "links" | "ai">("dashboard");

  // Skill management in Settings Drawer
  const [newSkillName, setNewSkillName] = useState("");
  const [newSkillLevel, setNewSkillLevel] = useState<Skill["level"]>("expert");
  const [skillTargetAssigneeId, setSkillTargetAssigneeId] = useState<string | null>(null);

  // Team Master-Detail view states
  const [selectedAssigneeId, setSelectedAssigneeId] = useState<string | null>(null);
  const [teamMemberSearch, setTeamMemberSearch] = useState<string>("");
  const [inlineNewSkillName, setInlineNewSkillName] = useState("");
  const [inlineNewSkillLevel, setInlineNewSkillLevel] = useState<Skill["level"]>("expert");

  // Simulation modal
  const [showScenarioModal, setShowScenarioModal] = useState(false);
  const [simTaskChoice, setSimTaskChoice] = useState<string>("");
  const [simDelayDays, setSimDelayDays] = useState<number>(2);
  const [simResult, setSimResult] = useState<Result | null>(null);
  const [simError, setSimError] = useState("");
  const [simBusy, setSimBusy] = useState(false);

  const [taskInlinePredId, setTaskInlinePredId] = useState("");
  const [taskInlinePredKind, setTaskInlinePredKind] = useState<Dependency["kind"]>("FS");
  const [taskInlinePredLagHours, setTaskInlinePredLagHours] = useState<number>(0);
  const [taskInlinePredLagMode, setTaskInlinePredLagMode] = useState<Dependency["lag_mode"]>("working");

  const [timelineMode, setTimelineMode] = useState<"timeline" | "list">("timeline");
  const [dependencyVisible, setDependencyVisible] = useState(true);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(""), 2600);
    return () => clearTimeout(timer);
  }, [toast]);

  const showNotification = (msg: string) => setToast(msg);

  const handleSaveAsBaseline = () => {
    if (!draft || !view) return;
    const taskMap: Record<string, { start: string; finish: string }> = {};
    view.analysis.tasks.forEach((t) => {
      taskMap[t.id] = { start: t.start, finish: t.finish };
    });
    const updated: Project = {
      ...draft,
      baseline: {
        saved_at: new Date().toISOString(),
        finish: view.analysis.finish,
        tasks: taskMap,
      },
    };
    change(updated);
    showNotification("Текущий график зафиксирован как Базовый план (Baseline)");
  };

  const run = async <T,>(fn: () => Promise<T>): Promise<T | undefined> => {
    setBusy(true);
    setError("");
    try {
      return await fn();
    } catch (e: any) {
      setError(e.message || "Ошибка сервера");
      return undefined;
    } finally {
      setBusy(false);
    }
  };

  const list = async () => {
    const data = await api<Array<{ id: string; name: string }>>("/projects");
    setProjects(data);
    return data;
  };

  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const accept = (result: Result) => {
    setSaved(result);
    setDraft(copy(result.project));
    setPreview(null);
    setAiText("");
    setLastUpdated(new Date());
  };

  const change = (p: Project) => {
    setDraft(p);
    setPreview(null);
    setAiText("");
    setLastUpdated(new Date());
  };

  const handleDeleteProject = async (id: string) => {
    await run(async () => {
      await api(`/projects/${id}`, "DELETE");
      showNotification("Проект успешно удален");
      const updatedList = await list();
      setDeleteConfirmProject(null);
      if (saved?.id === id) {
        if (updatedList.length > 0) {
          accept(await api<Result>(`/projects/${updatedList[0].id}`));
        } else {
          setSaved(null);
          setDraft(null);
        }
      }
    });
  };

  const handleLoadDemoProject = async () => {
    await run(async () => {
      const created = await api<Result>("/demo", "POST");
      await list();
      accept(created);
      setProjectManageModal(false);
      showNotification("Демо-проект «Запуск клиентского портала» успешно загружен!");
    });
  };

  const handleCreateProjectSubmit = async () => {
    if (!newProjName.trim()) return;
    await run(async () => {
      const created = await api<Result>("/projects", "POST", {
        name: newProjName.trim(),
        timezone: newProjTz,
        start: newProjStart,
        deadline: newProjDeadline,
        calendar: defaultCalendar(),
        assignees: [],
        tasks: [],
        dependencies: [],
      });
      await list();
      accept(created);
      setNewProjectModal(false);
      showNotification(`Проект «${newProjName}» создан`);
    });
  };

  const handleImportCsvSubmit = () => {
    if (!draft || !csvInput.trim()) return;
    let parsed: Task[];
    try { parsed = parseCsvToTasks(csvInput, draft.assignees, draft.tasks.map(t => t.id)); }
    catch (e) { setError(e instanceof Error ? e.message : "Ошибка CSV"); return; }
    if (parsed.length === 0) {
      setError("Не удалось распознать задачи из введенного CSV");
      return;
    }
    change({
      ...draft,
      tasks: [...draft.tasks, ...parsed],
    });
    setImportModal(false);
    setCsvInput("");
    showNotification(`Импортировано ${parsed.length} задач`);
  };

  const handleAddDependencySubmit = () => {
    if (!draft || !newDepPred || !newDepSucc || newDepPred === newDepSucc) {
      setError("Выберите двух разных участников зависимости");
      return;
    }
    const exists = draft.dependencies.some(
      (d) => d.predecessor_id === newDepPred && d.successor_id === newDepSucc
    );
    if (exists) {
      setError("Такая зависимость уже существует");
      return;
    }
    change({
      ...draft,
      dependencies: [
        ...draft.dependencies,
        {
          predecessor_id: newDepPred,
          successor_id: newDepSucc,
          kind: newDepKind,
          lag_minutes: Math.round(newDepLagHours * 60),
          lag_mode: newDepLagMode,
        },
      ],
    });
    setDepModal(false);
    setNewDepPred("");
    setNewDepSucc("");
    showNotification("Связь успешно добавлена");
  };

  const scrollToSection = (id: string) => {
    setActiveView("dashboard");
    setTimeout(() => {
      const el = document.getElementById(id);
      if (el) el.scrollIntoView({ behavior: "smooth" });
    }, 50);
  };

  useEffect(() => {
    void run(async () => {
      const data = await list();
      if (data.length > 0) {
        accept(await api<Result>(`/projects/${data[0].id}`));
      }
      setLogged(true);
    });
  }, []);

  const view = preview || saved;
  const dirty = Boolean(
    saved && draft && JSON.stringify(saved.project) !== JSON.stringify(draft),
  );

  const rows = new Map((view?.analysis.tasks || []).map((r) => [r.id, r]));
  const affected = new Set(preview?.changes?.changed_task_ids || []);

  const nodes = (draft?.tasks || []).map((t, idx) => {
    const row = rows.get(t.id);
    if (!row) return { id: t.id, position: { x: 0, y: 0 }, data: { label: t.name } };
    const p = draft?.assignees.find((a) => a.id === t.assignee_id);
    return {
      id: t.id,
      position: { x: (idx % 3) * 260, y: Math.floor(idx / 3) * 140 },
      data: {
        label: (
          <div>
            <Badge size="xs" color={priorityColors[t.priority || "medium"]} mb={2}>
              {priorityLabels[t.priority || "medium"]}
            </Badge>
            <strong>{t.name}</strong>
            <small>{p ? `${p.name} ${p.role ? `· ${p.role}` : ""}` : "Не назначен"}</small>
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
          ? "#ee9564"
          : row.critical
            ? "#e57470"
            : "#5a75e9",
        width: 230,
      },
    };
  });

  const completedCount = draft?.tasks.filter((t) => t.status === "done").length || 0;
  const totalTasksCount = draft?.tasks.length || 0;
  const progressPercent = totalTasksCount ? Math.round((completedCount / totalTasksCount) * 100) : 0;
  const overloadedAssigneeIds = new Set(view?.analysis.overloads.map((o) => o.assignee_id) || []);

  const overdueTasks = (view?.analysis.tasks || []).filter(r => r.risk_flags.includes("overdue"));
  const baselineVarianceHours = view?.analysis.baseline_delta_minutes == null ? null : view.analysis.baseline_delta_minutes / 60;

  function handleSaveBaseline() {
    if (!draft || !view) return;
    if (dirty && !preview) { setError("Сначала рассчитайте последствия черновика, затем фиксируйте базовый план"); return; }
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
    showNotification("Базовый план добавлен в черновик. Сохраните изменения.");
  }

  function handleRescheduleOverdue() {
    if (!draft || !view) return;
    const updatedTasks = rescheduleOverdueTasks(draft.tasks, view.analysis, new Date());
    change({
      ...draft,
      tasks: updatedTasks,
    });
    showNotification("Ограничения начала обновлены в черновике. Проверьте последствия.");
  }

  const projStartMs = draft ? new Date(draft.start).getTime() : 0;
  const projEndMs = view ? Math.max(new Date(view.analysis.finish).getTime(), projStartMs + 60000) : draft ? new Date(draft.deadline).getTime() : 1;
  const projTotalMs = Math.max(1, projEndMs - projStartMs);

  const daysRemaining = useMemo(() => {
    if (!view && !draft) return 0;
    const targetMs = view
      ? new Date(view.analysis.finish).getTime()
      : draft
      ? new Date(draft.deadline).getTime()
      : Date.now();
    const diff = targetMs - Date.now();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  }, [view?.analysis.finish, draft?.deadline]);

  const timelineTicks = useMemo(() => {
    if (!draft) return [];
    const s = new Date(draft.start).getTime();
    const f = view
      ? new Date(view.analysis.finish).getTime()
      : new Date(draft.deadline).getTime();
    const total = Math.max(1, f - s);
    const count = 9;
    const step = total / (count - 1);
    const result = [];
    for (let i = 0; i < count; i++) {
      const d = new Date(s + step * i);
      result.push({
        day: d.toLocaleDateString("ru-RU", { timeZone: zone, day: "2-digit" }),
        full: d.toLocaleDateString("ru-RU", { timeZone: zone, day: "numeric", month: "short" }),
      });
    }
    return result;
  }, [draft?.start, draft?.deadline, view?.analysis.finish, zone]);

  const timelineHeading = useMemo(() => {
    if (!draft) return "ПЛАН ПРОЕКТА";
    const dStart = new Date(draft.start);
    const dEnd = view ? new Date(view.analysis.finish) : new Date(draft.deadline);
    const mStart = dStart.toLocaleDateString("ru-RU", { timeZone: zone, month: "short" });
    const mEnd = dEnd.toLocaleDateString("ru-RU", { timeZone: zone, month: "short", year: "numeric" });
    return `${mStart.toUpperCase()} — ${mEnd.toUpperCase()}`;
  }, [draft?.start, draft?.deadline, view?.analysis.finish, zone]);

  const todayMarkerPercent = useMemo(() => {
    if (!draft) return null;
    const nowMs = Date.now();
    const s = new Date(draft.start).getTime();
    const f = view
      ? new Date(view.analysis.finish).getTime()
      : new Date(draft.deadline).getTime();
    const total = Math.max(1, f - s);
    const pct = ((nowMs - s) / total) * 85;
    if (pct >= 0 && pct <= 85) return pct;
    return null;
  }, [draft?.start, draft?.deadline, view?.analysis.finish, zone]);

  const handleRunSimulation = async () => {
    if (!saved || !draft) return;
    const targetTaskId = simTaskChoice || draft.tasks.find(t => t.status !== "done")?.id;
    if (!targetTaskId) { setSimError("Нет незавершённых задач для изменения"); return; }
    setSimResult(null); setSimError(""); setSimBusy(true);
    try {
      const res = await api<Result>(`/projects/${saved.id}/simulate`, "POST", {
        version: saved.version,
        project: {...draft, tasks: draft.tasks.map(t => t.id === targetTaskId
          ? {...t, duration_minutes: t.duration_minutes + Math.round(simDelayDays * 60)} : t)},
      });
      setSimResult(res);
    } catch (e) { setSimError(e instanceof Error ? e.message : "Не удалось рассчитать сценарий"); }
    finally { setSimBusy(false); }
  };

  // Login View
  if (!logged) {
    return (
      <MantineProvider forceColorScheme={colorScheme}>
        <Container size={420} my={80}>
          <Card withBorder p="xl" radius="md">
            <Stack gap="md">
              <Group gap="xs">
                <span className="brand-mark">c</span>
                <Title order={2}>critix</Title>
              </Group>
              <Text c="dimmed" size="sm">
                Вход в систему анализа рисков и управления критическим путем
              </Text>

              {error && <Alert color="red">{error}</Alert>}

              <PasswordInput
                label="Пароль руководителя"
                placeholder="Введи пароль из .env"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />

              <Button
                fullWidth
                loading={busy}
                onClick={() =>
                  void run(async () => {
                    await api("/login", "POST", { password });
                    setLogged(true);
                    const data = await list();
                    if (data.length > 0) {
                      accept(await api<Result>(`/projects/${data[0].id}`));
                    }
                  })
                }
              >
                Войти в рабочее пространство
              </Button>
            </Stack>
          </Card>
        </Container>
      </MantineProvider>
    );
  }



  return (
    <MantineProvider forceColorScheme={colorScheme}>
      <div className="app-shell">
        {/* Designer Sidebar */}
        <aside className="sidebar">
          <div className="brand">
            <span className="brand-mark">c</span>
            <span>critix</span>
          </div>

          <div className="workspace-label">РАБОЧЕЕ ПРОСТРАНСТВО</div>

          <button className="project-switcher" onClick={() => setProjectManageModal(true)}>
            <span className="project-dot" />
            <span>
              <strong>{draft?.name || "Выберите проект"}</strong>
              <small>{draft?.timezone || "Проект не выбран"}</small>
            </span>
            <ChevronDown size={15} />
          </button>

          <nav className="main-nav">
            <button
              className={`nav-item ${activeView === "dashboard" ? "active" : ""}`}
              onClick={() => scrollToSection("overview")}
            >
              <LayoutDashboard size={16} /> Обзор
            </button>
            <button
              className={`nav-item ${activeView === "dashboard" ? "" : ""}`}
              onClick={() => scrollToSection("timeline")}
            >
              <GitBranch size={16} /> План проекта
            </button>
            <button
              className={`nav-item ${activeView === "tasks_table" ? "active" : ""}`}
              onClick={() => setActiveView("tasks_table")}
            >
              <Check size={16} /> Задачи
              <span className="nav-count">{totalTasksCount}</span>
            </button>
            <button
              className={`nav-item ${activeView === "graph" ? "active" : ""}`}
              onClick={() => setActiveView("graph")}
            >
              <GitBranch size={16} /> Карта связей
            </button>
            <button
              className={`nav-item ${activeView === "team" ? "active" : ""}`}
              onClick={() => setActiveView("team")}
            >
              <Users size={16} /> Команда
              {overloadedAssigneeIds.size > 0 && (
                <span className="nav-count warning">!</span>
              )}
            </button>
            <button
              className={`nav-item ${activeView === "links" ? "active" : ""}`}
              onClick={() => setActiveView("links")}
            >
              <LinkIcon size={16} /> Зависимости
              <span className="nav-count">{draft?.dependencies.length || 0}</span>
            </button>
            <button
              className={`nav-item ${activeView === "ai" ? "active" : ""}`}
              onClick={() => setActiveView("ai")}
            >
              <AlertTriangle size={16} /> Риски & AI
              {overdueTasks.length > 0 && <span className="nav-count warning">{overdueTasks.length}</span>}
            </button>
          </nav>

          <div className="sidebar-divider" />

          <div className="workspace-label">КОМАНДА</div>
          <div className="team-stack">
            {(draft?.assignees || []).map((person) => (
              <span
                key={person.id}
                title={`${person.name} ${person.role ? `· ${person.role}` : ""} · ${(person.skills || []).map((s) => s.name).join(", ") || "Навыки не указаны"}`}
                className={`avatar ${getAvatarClass(person.id)}`}
                onClick={() => {
                  setSelectedAssigneeId(person.id);
                  setActiveView("team");
                }}
                style={{ cursor: "pointer" }}
              >
                {getInitials(person.name)}
              </span>
            ))}
            <button
              className="avatar add-person"
              title="Добавить участника команды"
              onClick={() => {
                if (draft) {
                  const newId = crypto.randomUUID();
                  const newPerson: Person = {
                    id: newId,
                    name: `Сотрудник ${draft.assignees.length + 1}`,
                    role: "Разработчик",
                    skills: [],
                    calendar: defaultCalendar(),
                  };
                  change({
                    ...draft,
                    assignees: [...draft.assignees, newPerson],
                  });
                  setSelectedAssigneeId(newId);
                  setActiveView("team");
                }
              }}
            >
              <Plus size={14} />
            </button>
          </div>
          <div
            className="workspace-label team-caption"
            style={{ cursor: "pointer" }}
            onClick={() => setActiveView("team")}
          >
            {draft?.assignees.length || 0} участников · роли и графики
          </div>

          <div className="sidebar-bottom">
            <button className="nav-item" onClick={() => setSettings(true)}>
              <Settings size={16} /> Настройки проекта
            </button>

            <Group justify="space-between" mt="xs" px="xs">
              <Text size="xs" c="dimmed">Тема:</Text>
              <SegmentedControl
                size="xs"
                value={colorScheme}
                onChange={(v) => toggleTheme(v as "dark" | "light")}
                data={[
                  { label: "Светлая", value: "light" },
                  { label: "Тёмная", value: "dark" },
                ]}
              />
            </Group>

            <div className="user-card">
              <span className="avatar avatar-ink">PM</span>
              <span>
                <strong>Руководитель</strong>
                <small>Администратор проекта</small>
              </span>
              <ActionIcon
                variant="subtle"
                color="gray"
                size="sm"
                title="Выйти"
                onClick={() =>
                  void run(async () => {
                    await api("/logout", "POST");
                    setLogged(false);
                    setSaved(null);
                    setDraft(null);
                  })
                }
              >
                <LogOut size={15} />
              </ActionIcon>
            </div>
          </div>
        </aside>

        {/* Designer Main Content */}
        <main className="main-content">
          <header className="topbar">
            <div className="breadcrumbs">
              <button
                type="button"
                className="breadcrumb-btn"
                onClick={() => setProjectManageModal(true)}
                title="Переключить проект"
              >
                <span>Проекты</span>
                <ChevronDown size={13} />
              </button>
              <span>/</span>
              <button
                type="button"
                className="breadcrumb-current"
                onClick={() => setProjectManageModal(true)}
                title="Настройки проекта"
              >
                <strong>{draft?.name || "Выбор проекта"}</strong>
              </button>
            </div>
            <div className="top-actions">
              {/* Notification Center Popover */}
              <Popover width={360} position="bottom-end" withArrow shadow="md">
                <Popover.Target>
                  <button className="icon-button" aria-label="Уведомления">
                    <Bell size={17} />
                    {(overdueTasks.length > 0 || overloadedAssigneeIds.size > 0 || view?.analysis.deadline_exceeded) && (
                      <i />
                    )}
                  </button>
                </Popover.Target>
                <Popover.Dropdown p="sm">
                  <Stack gap="xs">
                    <Group justify="space-between" align="center">
                      <Group gap={6}>
                        <Text fw={700} size="sm">Центр рисков и инцидентов</Text>
                        <Badge size="xs" color={overdueTasks.length > 0 || view?.analysis.deadline_exceeded ? "red" : "blue"}>
                          {overdueTasks.length + overloadedAssigneeIds.size + (view?.analysis.deadline_exceeded ? 1 : 0)}
                        </Badge>
                      </Group>
                      {overdueTasks.length > 0 && (
                        <Button size="compact-xs" variant="subtle" color="red" onClick={handleRescheduleOverdue}>
                          Сдвинуть все
                        </Button>
                      )}
                    </Group>

                    <Divider />

                    <ScrollArea.Autosize mah={280} type="auto">
                      <Stack gap="xs">
                        {view?.analysis.deadline_exceeded && (
                          <Card withBorder p="xs" style={{ background: "rgba(229, 116, 112, 0.08)", borderColor: "#e57470" }}>
                            <Group gap={6} align="flex-start">
                              <AlertTriangle size={15} color="#e57470" style={{ marginTop: 2 }} />
                              <div style={{ flex: 1 }}>
                                <Text size="xs" fw={700} c="red">Дедлайн проекта превышен</Text>
                                <Text size="11px" c="dimmed">
                                  Расчетный финиш позже дедлайна на {view.analysis.delay_minutes} мин.
                                </Text>
                              </div>
                            </Group>
                          </Card>
                        )}

                        {overdueTasks.map((ot) => {
                          const taskObj = draft?.tasks.find((x) => x.id === ot.id);
                          return (
                            <Card key={ot.id} withBorder p="xs">
                              <Group justify="space-between" align="flex-start">
                                <div style={{ minWidth: 0, flex: 1 }}>
                                  <Group gap={4} mb={2}>
                                    <Badge size="xs" color="red">Просрочка</Badge>
                                    <Text size="xs" fw={600} lineClamp={1}>{taskObj?.name}</Text>
                                  </Group>
                                  <Text size="10px" c="dimmed">
                                    Плановый финиш: {shortDate(ot.finish)}
                                  </Text>
                                </div>
                                <Button
                                  size="compact-xs"
                                  variant="light"
                                  onClick={() => taskObj && setTask(copy(taskObj))}
                                >
                                  Открыть
                                </Button>
                              </Group>
                            </Card>
                          );
                        })}

                        {overloadedAssigneeIds.size > 0 && (
                          <Card withBorder p="xs" style={{ background: "rgba(238, 149, 100, 0.08)" }}>
                            <Group justify="space-between" align="center">
                              <div>
                                <Text size="xs" fw={700} c="orange">Перегрузка исполнителей</Text>
                                <Text size="11px" c="dimmed">
                                  {overloadedAssigneeIds.size} сотрудников имеют занятость &gt; 100%.
                                </Text>
                              </div>
                              <Button size="compact-xs" variant="light" color="orange" onClick={() => setActiveView("team")}>
                                Команда
                              </Button>
                            </Group>
                          </Card>
                        )}

                        {overdueTasks.length === 0 && overloadedAssigneeIds.size === 0 && !view?.analysis.deadline_exceeded && (
                          <Card withBorder p="sm" style={{ textAlign: "center" }}>
                            <Check size={20} color="#3eac7d" style={{ margin: "0 auto 4px" }} />
                            <Text size="xs" fw={700} c="teal">Критических рисков нет</Text>
                            <Text size="10px" c="dimmed">Все задачи укладываются в график и дедлайн.</Text>
                          </Card>
                        )}
                      </Stack>
                    </ScrollArea.Autosize>

                    <Divider />

                    <Group justify="space-between">
                      <Button size="xs" variant="subtle" onClick={() => setExecutiveReportModal(true)}>
                        <FileText size={13} style={{ marginRight: 4 }} /> Отчет
                      </Button>
                      <Button size="xs" variant="light" onClick={() => setActiveView("ai")}>
                        <Sparkles size={13} style={{ marginRight: 4 }} /> AI Copilot
                      </Button>
                    </Group>
                  </Stack>
                </Popover.Dropdown>
              </Popover>

              <button className="help-button" aria-label="Помощь" onClick={() => setHelpModal(true)}>
                <CircleHelp size={14} />
              </button>
            </div>
          </header>

          <div className="content-wrap" id="overview">
            {!draft && <Card withBorder><Stack><Title order={3}>Нет выбранного проекта</Title><Text>Создайте проект, откройте существующий или загрузите демо.</Text><Group><Button onClick={() => setProjectManageModal(true)}>Управление проектами</Button><Button variant="light" onClick={handleLoadDemoProject}>Загрузить Демо-проект</Button></Group></Stack></Card>}
            <section className="page-heading">
              <div>
                <div className="eyebrow">
                  <span className="status-dot" />
                  {view?.analysis.deadline_exceeded ? "Есть превышение" : "В работе"}
                  <span className="heading-separator">·</span>
                  обновлено в {lastUpdated.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}
                </div>
                <h1>{draft?.name || "Создайте или выберите проект"}</h1>
                <p>План, команда и последствия изменений — на одном экране. Часовой пояс: {zone}.</p>
                {dirty && !preview && <Text c="orange" size="sm">Черновик изменён. Даты, риски, отчёт и AI относятся к сохранённому плану до проверки последствий.</Text>}
              </div>

              <div className="heading-actions">
                <button className="primary-button" disabled={!draft} onClick={() => setTask(defaultTask())}>
                  <Plus size={16} /> Новая задача
                </button>
                <button className="secondary-button" disabled={!draft?.tasks.length} onClick={() => {setSimResult(null); setShowScenarioModal(true);}}>
                  <Sparkles size={14} /> Симуляция (What-If)
                </button>
                {draft && (
                  <Menu shadow="md" width={240} position="bottom-end">
                    <Menu.Target>
                      <button className="secondary-button">
                        <SlidersHorizontal size={14} /> Действия и экспорт <ChevronDown size={12} />
                      </button>
                    </Menu.Target>
                    <Menu.Dropdown>
                      <Menu.Label>Отчеты и управление</Menu.Label>
                      <Menu.Item leftSection={<FileText size={14} />} onClick={() => setExecutiveReportModal(true)}>
                        Отчет для руководства (PDF/MD)
                      </Menu.Item>
                      <Menu.Item leftSection={<BookmarkCheck size={14} />} onClick={handleSaveAsBaseline}>
                        {draft.baseline ? "Обновить базовый план" : "Зафиксировать базовый план"}
                      </Menu.Item>
                      <Menu.Divider />
                      <Menu.Label>Экспорт и импорт</Menu.Label>
                      <Menu.Item leftSection={<FileJson size={14} />} onClick={() => exportProjectToJson(draft)}>
                        Экспорт проекта в JSON
                      </Menu.Item>
                      <Menu.Item leftSection={<Upload size={14} />} onClick={() => setJsonImportModal(true)}>
                        Импорт проекта из JSON
                      </Menu.Item>
                      <Menu.Item leftSection={<Download size={14} />} onClick={() => exportTasksToCsv(draft)}>
                        Экспорт задач в CSV
                      </Menu.Item>
                      <Menu.Item leftSection={<Upload size={14} />} onClick={() => setImportModal(true)}>
                        Импорт задач из CSV
                      </Menu.Item>
                    </Menu.Dropdown>
                  </Menu>
                )}
              </div>
            </section>

            {error && (
              <div className="api-note">
                <Zap size={14} /> {error}
              </div>
            )}

            {/* Metrics Grid */}
            {view && draft && <section className="metric-grid">
              <article className="metric-card">
                <div className="metric-top">
                  <span className="metric-label">Прогресс проекта</span>
                  <span className="metric-icon purple">
                    <Gauge size={15} />
                  </span>
                </div>
                <div className="metric-value">{progressPercent}%</div>
                <div className="progress-track">
                  <span style={{ width: `${progressPercent}%` }} />
                </div>
                <div className="metric-foot">
                  <span>{completedCount} из {totalTasksCount} задач</span>
                  <span className="positive">В работе</span>
                </div>
              </article>

              <article className="metric-card">
                <div className="metric-top">
                  <span className="metric-label">До завершения</span>
                  <span className="metric-icon blue">
                    <CalendarDays size={15} />
                  </span>
                </div>
                <div className="metric-value">
                  {daysRemaining}{" "}
                  <small>дней</small>
                </div>
                <div className="metric-foot">
                  <span>Финиш: {view ? shortDate(view.analysis.finish) : draft ? shortDate(draft.deadline) : "—"}</span>
                  {view?.analysis.deadline_exceeded ? (
                    <span className="coral-text">Превышен</span>
                  ) : (
                    <span className="positive">В дедлайне</span>
                  )}
                </div>
              </article>

              <article className="metric-card">
                <div className="metric-top">
                  <span className="metric-label">Просроченные задачи</span>
                  <span className="metric-icon coral">
                    <AlertTriangle size={15} />
                  </span>
                </div>
                <div className={`metric-value ${overdueTasks.length > 0 ? "coral-text" : ""}`}>
                  {overdueTasks.length || 0}
                </div>
                <div className="metric-foot">
                  <span>
                    {overdueTasks.length > 0 ? (
                      <button
                        style={{ border: 0, background: "none", color: "var(--red)", cursor: "pointer", padding: 0, font: "inherit" }}
                        onClick={handleRescheduleOverdue}
                        disabled={!overdueTasks.some(r => !draft?.tasks.find(t => t.id === r.id)?.actual_start)}
                      >
                        Перенести ещё не начатые
                      </button>
                    ) : (
                      "Нет просрочек по расчёту"
                    )}
                  </span>
                  <span className="metric-symbol">!</span>
                </div>
              </article>

              <article className="metric-card">
                <div className="metric-top">
                  <span className="metric-label">Критический путь</span>
                  <span className="metric-icon green">
                    <Target size={15} />
                  </span>
                </div>
                <div className="metric-value">
                  {(view?.analysis.tasks || []).filter((t) => t.critical).length}{" "}
                  <small>задач</small>
                </div>
                <div className="metric-foot">
                  <span>
                    {baselineVarianceHours !== null
                      ? baselineVarianceHours > 0
                        ? `Сдвиг от эталона: +${baselineVarianceHours} ч`
                        : "В графике эталона"
                      : "Базовый план не зафиксирован"}
                  </span>
                  <span className="metric-symbol">↗</span>
                </div>
              </article>
            </section>}

            {dirty && (
              <Alert
                color={preview ? "orange" : "blue"}
                title={preview ? "Предпросмотр последствий" : "Есть изменения в черновике"}
                mb="lg"
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

            {/* Views Mode Rendering */}
            {activeView === "dashboard" && draft && view && (
              <>
                {/* Dashboard Grid Layout */}
                <section className="dashboard-grid">
                  {/* Timeline Main Panel with Baseline Reference Support */}
                  <article className="panel timeline-panel" id="timeline">
                    <div className="panel-header">
                      <div>
                        <h2>План проекта</h2>
                        <p>Последовательность работ, базовый план и зависимости</p>
                      </div>
                      <div className="view-tabs">
                        <button
                          className={`view-tab ${timelineMode === "timeline" ? "active" : ""}`}
                          onClick={() => setTimelineMode("timeline")}
                        >
                          Timeline
                        </button>
                        <button
                          className={`view-tab ${timelineMode === "list" ? "active" : ""}`}
                          onClick={() => setTimelineMode("list")}
                        >
                          <List size={12} /> Список
                        </button>
                      </div>
                    </div>

                    <div className="timeline-toolbar">
                      <div className="legend">
                        <span><i className="legend-dot done" />Завершено</span>
                        <span><i className="legend-dot progress" />В работе</span>
                        <span><i className="legend-dot planned" />Запланировано</span>
                        <span><i className="legend-dot critical" />Критический путь</span>
                        {draft?.baseline && (
                          <span style={{ opacity: 0.8 }}><i style={{ width: 8, height: 2, borderBottom: "1px dashed #8994a4", display: "inline-block", marginRight: 4 }} />Базовый план</span>
                        )}
                      </div>
                      <button className="filter-button" onClick={() => setActiveView("tasks_table")}>
                        <SlidersHorizontal size={12} /> Таблица задач <ChevronDown size={12} />
                      </button>
                    </div>

                    {timelineMode === "timeline" ? (
                      <div className="timeline">
                        <div className="timeline-head">
                          <div className="task-heading">ЗАДАЧА</div>
                          <div className="date-heading">
                            {timelineHeading}
                            <div className="dates">
                              {timelineTicks.map((tick, i) => (
                                <span key={i} title={tick.full}>
                                  {tick.day}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>

                        {(draft?.tasks || []).map((t, idx) => {
                          const r = rows.get(t.id);
                          if (!r) return null;
                          const person = draft?.assignees.find((p) => p.id === t.assignee_id);
                          const tStartMs = new Date(r.start).getTime();
                          const tEndMs = new Date(r.finish).getTime();

                          const leftPct = Math.max(0, Math.min(85, ((tStartMs - projStartMs) / projTotalMs) * 85));
                          const widthPct = Math.max(0.3, Math.min(85 - leftPct, ((tEndMs - tStartMs) / projTotalMs) * 85));

                          let baseLeftPct = 0;
                          let baseWidthPct = 0;
                          if (draft?.baseline && draft.baseline.tasks[t.id]) {
                            const bStartMs = new Date(draft.baseline.tasks[t.id].start).getTime();
                            const bEndMs = new Date(draft.baseline.tasks[t.id].finish).getTime();
                            baseLeftPct = Math.max(0, Math.min(85, ((bStartMs - projStartMs) / projTotalMs) * 85));
                            baseWidthPct = Math.max(0.3, Math.min(85 - baseLeftPct, ((bEndMs - bStartMs) / projTotalMs) * 85));
                          }

                          const statusClass = t.status === "done" ? "done" : t.status === "in_progress" ? "progress" : "planned";

                          return (
                            <div className="task-row" key={t.id} onClick={() => setTask(copy(t))} style={{ cursor: "pointer" }}>
                              <div className="task-info">
                                <span className={`avatar mini-avatar ${person ? getAvatarClass(person.id) : "avatar-ink"}`}>
                                  {person ? getInitials(person.name) : "—"}
                                </span>
                                <div>
                                  <span className="task-name">{t.name}</span>
                                  <span className="task-meta">
                                    <i className={`task-status-dot ${statusClass}`} />
                                    {statusLabels[t.status]} · {person?.role ? `${person.role} · ` : ""}{t.duration_minutes / 60} ч.
                                  </span>
                                </div>
                              </div>

                              <div className="task-chart">
                                {draft?.baseline && draft.baseline.tasks[t.id] && (
                                  <span
                                    className="baseline-bar"
                                    style={{ left: `${baseLeftPct}%`, width: `${baseWidthPct}%` }}
                                    title={`Базовый эталон: ${date(draft.baseline.tasks[t.id].start)} → ${date(draft.baseline.tasks[t.id].finish)}`}
                                  />
                                )}

                                <span
                                  className={`task-bar ${statusClass} ${r.critical ? "critical" : ""}`}
                                  style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                                >
                                  {t.duration_minutes / 60} ч.
                                </span>
                                {dependencyVisible && (draft?.dependencies || []).some((d) => d.successor_id === t.id) && (
                                  <span className="task-connector" />
                                )}
                                {todayMarkerPercent !== null && (
                                  <span
                                    className="today-marker"
                                    style={{ left: `${todayMarkerPercent}%` }}
                                    title={`Сегодня: ${shortDate(new Date().toISOString())}`}
                                  />
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="list-view-container">
                        <div className="list-view-header">
                          <span className="col-task">Задача</span>
                          <span className="col-assignee">Исполнитель</span>
                          <span className="col-status">Статус</span>
                          <span className="col-priority">Приоритет</span>
                          <span className="col-duration">Длит.</span>
                          <span className="col-dates">Сроки CPM</span>
                          <span className="col-slack">Резерв</span>
                          <span className="col-action" />
                        </div>
                        <div className="list-view-body">
                          {(draft?.tasks || []).map((t) => {
                            const r = rows.get(t.id);
                            const person = draft?.assignees.find((p) => p.id === t.assignee_id);
                            const isCritical = Boolean(r?.critical);
                            const isOverdue = r?.risk_flags.includes("overdue");
                            const statusClass = t.status === "done" ? "done" : t.status === "in_progress" ? "progress" : "planned";

                            return (
                              <div
                                className={`list-view-row ${isCritical ? "is-critical" : ""} ${isOverdue ? "is-overdue" : ""}`}
                                key={t.id}
                                onClick={() => setTask(copy(t))}
                                title="Нажмите для редактирования задачи"
                              >
                                <div className="col-task">
                                  <div className="list-task-name-wrap">
                                    <span className="list-task-name">{t.name}</span>
                                    {isCritical && <span className="cpm-tag" title="Задача на критическом пути">CPM</span>}
                                    {isOverdue && <span className="overdue-tag">Просрочена</span>}
                                  </div>
                                  {t.required_skills && t.required_skills.length > 0 && (
                                    <div className="list-task-skills">
                                      {t.required_skills.map((s, idx) => (
                                        <span key={idx} className="skill-chip">{s}</span>
                                      ))}
                                    </div>
                                  )}
                                </div>

                                <div className="col-assignee">
                                  {person ? (
                                    <div className="list-person">
                                      <span className={`avatar mini-avatar ${getAvatarClass(person.id)}`}>
                                        {getInitials(person.name)}
                                      </span>
                                      <div className="list-person-details">
                                        <span className="list-person-name">{person.name}</span>
                                        <span className="list-person-role">{person.role || "Участник"}</span>
                                      </div>
                                    </div>
                                  ) : (
                                    <span className="list-unassigned">Не назначен</span>
                                  )}
                                </div>

                                <div className="col-status">
                                  <span className={`status-pill ${statusClass}`}>
                                    <i className={`task-status-dot ${statusClass}`} />
                                    {statusLabels[t.status]}
                                  </span>
                                </div>

                                <div className="col-priority">
                                  <span className={`priority-tag ${t.priority || "medium"}`}>
                                    {priorityLabels[t.priority || "medium"]}
                                  </span>
                                </div>

                                <div className="col-duration">
                                  <span className="duration-val">{t.duration_minutes / 60} ч.</span>
                                  <span className="duration-sub">{t.allocation_percent || 100}% закр.</span>
                                </div>

                                <div className="col-dates">
                                  {r ? (
                                    <div className="list-date-wrap">
                                      <span>{shortDate(r.start)}</span>
                                      <span className="date-arrow">→</span>
                                      <span className={isOverdue ? "coral-text" : ""}>{shortDate(r.finish)}</span>
                                    </div>
                                  ) : (
                                    <span className="list-unassigned">—</span>
                                  )}
                                </div>

                                <div className="col-slack">
                                  {isCritical ? (
                                    <span className="slack-badge critical" title="Критический путь">
                                      Крит. путь
                                    </span>
                                  ) : r?.slack_minutes != null ? (
                                    <span className="slack-badge non-critical" title={`Свободный резерв: ${r.slack_minutes / 60} ч.`}>
                                      +{Math.round(r.slack_minutes / 60)} ч.
                                    </span>
                                  ) : (
                                    <span className="slack-badge">—</span>
                                  )}
                                </div>

                                <div className="col-action">
                                  <button className="list-row-btn" title="Редактировать">
                                    <ChevronRight size={14} />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    <div className="timeline-footer">
                      <span>Сегодня, {new Date().toLocaleDateString("ru-RU", { timeZone: zone, day: "numeric", month: "long", year: "numeric" })}</span>
                      <span className="today-line" />
                      <span>
                        Показать зависимости{" "}
                        <button
                          className={`toggle ${dependencyVisible ? "active" : ""}`}
                          onClick={() => setDependencyVisible(!dependencyVisible)}
                        >
                          <span />
                        </button>
                      </span>
                    </div>
                  </article>

                  {/* Side Column Widgets */}
                  <aside className="side-column">
                    <article className="panel attention-panel" id="risks">
                      <div className="panel-header">
                        <div>
                          <h2>Требует внимания</h2>
                          <p>Изменения и риски проекта</p>
                        </div>
                        <button className="round-action" onClick={() => setActiveView("ai")}>
                          <ArrowRight size={17} />
                        </button>
                      </div>

                      <div className="attention-list">
                        {overdueTasks.map((t) => {
                          const taskObj = draft?.tasks.find((x) => x.id === t.id);
                          return (
                            <div className="attention-item high" key={t.id}>
                              <span className="attention-icon">
                                <AlertTriangle size={13} />
                              </span>
                              <div>
                                <strong>Задача не завершена к плановому финишу</strong>
                                <p>«{taskObj?.name}» задерживается от финиша.</p>
                                <button className="text-action" onClick={() => taskObj && setTask(copy(taskObj))}>
                                  Открыть задачу <ArrowRight size={10} />
                                </button>
                              </div>
                              <span className="time">{shortDate(t.finish)}</span>
                            </div>
                          );
                        })}

                        {overloadedAssigneeIds.size > 0 && (
                          <div className="attention-item medium">
                            <span className="attention-icon">
                              <ArrowRight size={13} />
                            </span>
                            <div>
                              <strong>Перегрузка исполнителей</strong>
                              <p>Перегрузка {overloadedAssigneeIds.size} сотрудников.</p>
                              <button className="text-action" onClick={() => setActiveView("team")}>
                                Посмотреть <ArrowRight size={10} />
                              </button>
                            </div>
                            
                          </div>
                        )}

                        {overdueTasks.length === 0 && (
                          <div className="attention-item neutral">
                            <span className="attention-icon">
                              <Check size={13} />
                            </span>
                            <div>
                              <strong>Готово к проверке</strong>
                              <p>Незавершённых задач с прошедшей датой финиша не обнаружено. Другие риски приведены в результатах движка.</p>
                              <button className="text-action" onClick={() => setShowScenarioModal(true)}>
                                Открыть <ArrowRight size={10} />
                              </button>
                            </div>
                            
                          </div>
                        )}
                      </div>
                    </article>

                    <article className="panel decision-panel">
                      <div className="decision-badge">КОНТРОЛЬНАЯ ТОЧКА</div>
                      <h2>
                        Что изменится,<br />
                        <em>если опоздать?</em>
                      </h2>
                      <p>Измените срок задачи и сразу увидите влияние на проект.</p>
                      <button className="outline-button" onClick={() => setShowScenarioModal(true)}>
                        Запустить сценарий <ArrowRight size={14} />
                      </button>
                    </article>
                  </aside>
                </section>

                {/* Bottom Grid Layout */}
                <section className="bottom-grid">
                  <article className="panel activity-panel" id="tasks">
                    <div className="panel-header">
                      <div>
                        <h2>История сохранений</h2>
                        <p>Последние 20 версий проекта</p>
                      </div>
                    </div>
                    {historyError && <Text c="red" size="sm" p="sm">{historyError}</Text>}
                    {!history.length && !historyError && <Text c="dimmed" size="sm" p="md">Нет загруженных версий</Text>}
                    <ScrollArea h={200}>
                      {history.map((item) => (
                        <div className="activity-row" key={item.version}>
                          <div>
                            <strong>Версия {item.version}</strong>
                            <span> · {item.task_count} задач</span>
                            <small>{date(item.created_at)} · прогноз: {date(item.finish)}</small>
                          </div>
                        </div>
                      ))}
                    </ScrollArea>
                  </article>

                  <article className="panel health-panel">
                    <div className="panel-header">
                      <div>
                        <Group gap="xs" align="center">
                          <h2>Параметры движка и расчёта</h2>
                          {preview ? (
                            <Badge color="yellow" variant="light" size="sm">
                              Черновик (What-If)
                            </Badge>
                          ) : (
                            <Badge color="teal" variant="light" size="sm">
                              Боевой план
                            </Badge>
                          )}
                        </Group>
                        <p>Дискретный расчёт CPM/CCPM, календари и ограничения</p>
                      </div>
                      <Button
                        size="xs"
                        variant="light"
                        onClick={() => {
                          setSettingsTab("calendar");
                          setSettings(true);
                        }}
                      >
                        Настроить календари
                      </Button>
                    </div>

                    <div style={{ padding: "0 20px 20px 20px" }}>
                      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
                        <Card withBorder p="xs" radius="md">
                          <Text size="xs" fw={700} c="dimmed" mb={4}>ТОПОЛОГИЯ И СВЯЗИ</Text>
                          <Text size="sm" fw={600}>
                            {draft.tasks.length} задач · {draft.dependencies.length} связей
                          </Text>
                          <Text size="xs" c="dimmed">
                            {view.analysis.tasks.filter((t) => t.risk_flags.includes("dependency_conflict")).length === 0
                              ? "Конфликтов и циклов в графе нет"
                              : "Есть конфликты связей"}
                          </Text>
                        </Card>

                        <Card withBorder p="xs" radius="md">
                          <Text size="xs" fw={700} c="dimmed" mb={4}>КАЛЕНДАРЬ И ЧАСОВОЙ ПОЯС</Text>
                          <Text size="sm" fw={600}>
                            {zone}
                          </Text>
                          <Text size="xs" c="dimmed">
                            {Object.keys(draft.calendar.week).length} раб. дней · {Object.keys(draft.calendar.exceptions || {}).length} исключений/праздников
                          </Text>
                        </Card>

                        <Card withBorder p="xs" radius="md">
                          <Text size="xs" fw={700} c="dimmed" mb={4}>КОМАНДА И РЕСУРСЫ</Text>
                          <Text size="sm" fw={600}>
                            {draft.assignees.length} исполнителей в проекте
                          </Text>
                          <Text size="xs" c={view.analysis.overloads.length > 0 ? "orange" : "teal"}>
                            {view.analysis.overloads.length > 0
                              ? `${view.analysis.overloads.length} окон перегрузки (>100%)`
                              : "Все сотрудники в пределах нормы"}
                          </Text>
                        </Card>

                        <Card withBorder p="xs" radius="md">
                          <Text size="xs" fw={700} c="dimmed" mb={4}>РЕЗЕРВЫ ВРЕМЕНИ (FLOAT)</Text>
                          <Text size="sm" fw={600}>
                            {view.analysis.tasks.filter((t) => !t.critical).length} некритических задач с запасом
                          </Text>
                          <Text size="xs" c="dimmed">
                            Резервы рассчитаны до ближайшего преемника
                          </Text>
                        </Card>
                      </SimpleGrid>
                    </div>
                  </article>
                </section>
              </>
            )}

            {/* Graph View */}
            {activeView === "graph" && draft && (
              <Card withBorder p="md">
                <Group justify="space-between" mb="md">
                  <div>
                    <Title order={3}>Интерактивная карта графа задач</Title>
                    <Text size="sm" c="dimmed">
                      Перемещайте блоки задач мышью, соединяйте стрелками для добавления связей и кликайте на задачу для редактирования.
                    </Text>
                  </div>
                  <Group gap="xs">
                    <Button size="xs" onClick={() => setDepModal(true)}>+ Добавить связь</Button>
                    <Button size="xs" variant="light" onClick={() => setActiveView("dashboard")}>
                      ← Вернуться на Главную
                    </Button>
                  </Group>
                </Group>
                <ProjectGraph
                  project={draft}
                  result={view}
                  affectedTaskIds={affected}
                  colorScheme={colorScheme}
                  onEditTask={(t) => setTask(copy(t))}
                  onAddDependency={(d) => {
                    change({
                      ...draft,
                      dependencies: [...draft.dependencies, d],
                    });
                    showNotification(`Добавлена связь: ${d.kind}`);
                  }}
                  onEditDependency={(idx) => {
                    if (draft.dependencies[idx]) {
                      const d = draft.dependencies[idx];
                      setEditingDepIndex(idx);
                      setEditDepKind(d.kind);
                      setEditDepLagHours(d.lag_minutes / 60);
                      setEditDepLagMode(d.lag_mode);
                    }
                  }}
                />
              </Card>
            )}

            {/* Tasks Table View */}
            {activeView === "tasks_table" && (
              <Card withBorder p="md">
                <Group justify="space-between" mb="md">
                  <div>
                    <Title order={3}>Полная таблица задач проекта</Title>
                    <Text size="sm" c="dimmed">Кликните по задаче для детального редактирования дат, навыков и исполнителя.</Text>
                  </div>
                  <Group gap="xs">
                    <Button size="xs" onClick={() => setTask(defaultTask())}>+ Добавить задачу</Button>
                    <Button size="xs" variant="light" onClick={() => setImportModal(true)}>Импорт CSV</Button>
                    <Button size="xs" variant="light" onClick={() => setActiveView("dashboard")}>← Вернуться на Главную</Button>
                  </Group>
                </Group>

                <Table striped highlightOnHover>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Приоритет</Table.Th>
                      <Table.Th>Задача</Table.Th>
                      <Table.Th>Исполнитель</Table.Th>
                      <Table.Th>Статус</Table.Th>
                      <Table.Th>Загрузка</Table.Th>
                      <Table.Th>Часы</Table.Th>
                      <Table.Th>Прогноз CPM</Table.Th>
                      <Table.Th>Базовый план</Table.Th>
                      <Table.Th>Отклонение (Δ)</Table.Th>
                      <Table.Th>Резерв</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {(draft?.tasks || []).map((t) => {
                      const person = draft?.assignees.find((p) => p.id === t.assignee_id);
                      const r = rows.get(t.id);
                      const isOverdue = r?.risk_flags.includes("overdue");
                      const skillMatch = person ? calculateSkillMatch(t, person) : null;
                      const baseTask = draft?.baseline?.tasks[t.id];
                      let deltaMinutes = 0;
                      if (r && baseTask) {
                        deltaMinutes = Math.round((new Date(r.finish).getTime() - new Date(baseTask.finish).getTime()) / 60000);
                      }
                      const deltaHours = Math.round(deltaMinutes / 60);

                      return (
                        <Table.Tr key={t.id} onClick={() => setTask(copy(t))} style={{ cursor: "pointer" }}>
                          <Table.Td>
                            <Badge size="xs" color={priorityColors[t.priority || "medium"]}>
                              {priorityLabels[t.priority || "medium"]}
                            </Badge>
                          </Table.Td>
                          <Table.Td fw={600}>
                            <Group gap={6}>
                              <Text size="sm" fw={600}>{t.name}</Text>
                              {isOverdue && <Badge size="xs" color="red">Просрочена</Badge>}
                            </Group>
                            {t.required_skills && t.required_skills.length > 0 && (
                              <Group gap={4} mt={2}>
                                {t.required_skills.map((s, idx) => (
                                  <Badge key={idx} size="xs" variant="outline" color="gray">
                                    {s}
                                  </Badge>
                                ))}
                              </Group>
                            )}
                          </Table.Td>
                          <Table.Td>
                            {person ? (
                              <Group gap="xs">
                                <span className={`avatar ${getAvatarClass(person.id)}`} style={{ width: 22, height: 22, fontSize: 8 }}>
                                  {getInitials(person.name)}
                                </span>
                                <div>
                                  <Text size="sm">{person.name}</Text>
                                  {skillMatch !== null && (
                                    <Badge size="xs" color={skillMatch >= 80 ? "teal" : skillMatch >= 50 ? "yellow" : "red"} variant="light">
                                      Match {skillMatch}%
                                    </Badge>
                                  )}
                                </div>
                              </Group>
                            ) : (
                              <Text size="sm" c="dimmed">Не назначен</Text>
                            )}
                          </Table.Td>
                          <Table.Td>
                            <Badge color={statusColors[t.status]}>{statusLabels[t.status]}</Badge>
                          </Table.Td>
                          <Table.Td>{t.allocation_percent || 100}%</Table.Td>
                          <Table.Td>{t.duration_minutes / 60} ч</Table.Td>
                          <Table.Td>{r ? date(r.finish) : "—"}</Table.Td>
                          <Table.Td>
                            {baseTask ? (
                              <Text size="xs" fw={500}>{date(baseTask.finish)}</Text>
                            ) : (
                              <Text size="xs" c="dimmed">Не задан</Text>
                            )}
                          </Table.Td>
                          <Table.Td>
                            {baseTask && r ? (
                              deltaHours > 0 ? (
                                <Badge color="red" size="xs">+{deltaHours} ч</Badge>
                              ) : deltaHours < 0 ? (
                                <Badge color="teal" size="xs">{deltaHours} ч</Badge>
                              ) : (
                                <Badge color="gray" variant="light" size="xs">0 ч</Badge>
                              )
                            ) : (
                              <Text size="xs" c="dimmed">—</Text>
                            )}
                          </Table.Td>
                          <Table.Td>{r?.slack_minutes == null ? "—" : `${r.slack_minutes / 60} ч`}</Table.Td>
                        </Table.Tr>
                      );
                    })}
                  </Table.Tbody>
                </Table>
              </Card>
            )}

            {/* Full-featured Master-Detail Team & Resource Workspace */}
            {activeView === "team" && draft && (
              <Card withBorder p="md" radius="md">
                <Group justify="space-between" mb="md">
                  <div>
                    <Title order={3}>Управление командой и ресурсами</Title>
                    <Text size="sm" c="dimmed">
                      Матрица компетенций, персональные рабочие графики, отпуска и загрузка сотрудников.
                    </Text>
                  </div>
                  <Group gap="xs">
                    <Button
                      size="xs"
                      leftSection={<Plus size={14} />}
                      onClick={() => {
                        const newId = crypto.randomUUID();
                        const newPerson: Person = {
                          id: newId,
                          name: `Сотрудник ${draft.assignees.length + 1}`,
                          role: "Разработчик",
                          skills: [],
                          calendar: defaultCalendar(),
                        };
                        change({
                          ...draft,
                          assignees: [...draft.assignees, newPerson],
                        });
                        setSelectedAssigneeId(newId);
                        showNotification(`Сотрудник «${newPerson.name}» добавлен`);
                      }}
                    >
                      + Добавить сотрудника
                    </Button>
                    <Button size="xs" variant="light" onClick={() => setActiveView("dashboard")}>
                      ← На Главную
                    </Button>
                  </Group>
                </Group>

                {draft.assignees.length === 0 ? (
                  <Card withBorder p="xl" style={{ textAlign: "center" }}>
                    <Users size={32} color="var(--muted)" style={{ margin: "0 auto 8px" }} />
                    <Text fw={600}>В проекте пока нет сотрудников</Text>
                    <Text size="xs" c="dimmed" mb="md">Добавьте участников для распределения задач и учета рабочих календарей.</Text>
                    <Button
                      size="xs"
                      onClick={() => {
                        const newId = crypto.randomUUID();
                        change({
                          ...draft,
                          assignees: [
                            {
                              id: newId,
                              name: "Алексей Смирнов",
                              role: "Project Manager",
                              skills: [{ name: "PM", level: "expert" }],
                              calendar: defaultCalendar(),
                            },
                          ],
                        });
                        setSelectedAssigneeId(newId);
                      }}
                    >
                      Создать первого участника
                    </Button>
                  </Card>
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 20, minHeight: 600 }}>
                    {/* Left Column: Team Members List */}
                    <div style={{ borderRight: "1px solid var(--line, #e2e8f0)", paddingRight: 16 }}>
                      <TextInput
                        placeholder="Поиск по имени или роли..."
                        size="xs"
                        mb="sm"
                        value={teamMemberSearch}
                        onChange={(e) => setTeamMemberSearch(e.target.value)}
                      />

                      <ScrollArea h={560}>
                        <Stack gap={8}>
                          {draft.assignees
                            .filter((p) =>
                              !teamMemberSearch ||
                              p.name.toLowerCase().includes(teamMemberSearch.toLowerCase()) ||
                              (p.role && p.role.toLowerCase().includes(teamMemberSearch.toLowerCase()))
                            )
                            .map((p) => {
                              const isSelected = (selectedAssigneeId || draft.assignees[0]?.id) === p.id;
                              const isOverloaded = overloadedAssigneeIds.has(p.id);
                              const assignedTasks = (draft.tasks || []).filter((t) => t.assignee_id === p.id);
                              const excCount = Object.keys(p.calendar?.exceptions || {}).length;

                              return (
                                <Card
                                  key={p.id}
                                  withBorder
                                  p="xs"
                                  radius="sm"
                                  onClick={() => setSelectedAssigneeId(p.id)}
                                  style={{
                                    cursor: "pointer",
                                    borderColor: isSelected ? "var(--purple, #5a75e9)" : undefined,
                                    background: isSelected
                                      ? "rgba(90, 117, 233, 0.08)"
                                      : isOverloaded
                                      ? "rgba(238, 149, 100, 0.05)"
                                      : undefined,
                                  }}
                                >
                                  <Group justify="space-between" align="flex-start">
                                    <Group gap={8} style={{ minWidth: 0, flex: 1 }}>
                                      <span className={`avatar ${getAvatarClass(p.id)}`} style={{ width: 28, height: 28, fontSize: 10 }}>
                                        {getInitials(p.name)}
                                      </span>
                                      <div style={{ minWidth: 0, flex: 1 }}>
                                        <Text size="sm" fw={isSelected ? 700 : 600} lineClamp={1}>
                                          {p.name}
                                        </Text>
                                        <Text size="11px" c="dimmed" lineClamp={1}>
                                          {p.role || "Роль не указана"}
                                        </Text>
                                      </div>
                                    </Group>
                                  </Group>

                                  <Group gap={4} mt={6} justify="space-between">
                                    <Badge size="xs" color={isOverloaded ? "red" : "gray"} variant={isOverloaded ? "filled" : "light"}>
                                      {isOverloaded ? "Перегрузка" : `${assignedTasks.length} задач`}
                                    </Badge>
                                    {excCount > 0 && (
                                      <Badge size="xs" color="orange" variant="outline">
                                        {excCount} отпусков
                                      </Badge>
                                    )}
                                    <Text size="10px" c="dimmed">
                                      {(p.skills || []).length} навыков
                                    </Text>
                                  </Group>
                                </Card>
                              );
                            })}
                        </Stack>
                      </ScrollArea>
                    </div>

                    {/* Right Column: Selected Member Detailed Workspace */}
                    <div>
                      {(() => {
                        const activePerson = draft.assignees.find((p) => p.id === (selectedAssigneeId || draft.assignees[0]?.id));
                        if (!activePerson) {
                          return (
                            <Card withBorder p="xl" style={{ textAlign: "center" }}>
                              <Text c="dimmed">Выберите сотрудника из списка слева</Text>
                            </Card>
                          );
                        }

                        const assignedTasks = (draft.tasks || []).filter((t) => t.assignee_id === activePerson.id);
                        const isOverloaded = overloadedAssigneeIds.has(activePerson.id);

                        return (
                          <Stack gap="md">
                            {/* Header Card */}
                            <Card withBorder p="md" radius="sm">
                              <Group justify="space-between" align="flex-start">
                                <Group gap="md">
                                  <span className={`avatar ${getAvatarClass(activePerson.id)}`} style={{ width: 44, height: 44, fontSize: 16 }}>
                                    {getInitials(activePerson.name)}
                                  </span>
                                  <div>
                                    <Group gap="xs">
                                      <Text fw={700} size="lg">{activePerson.name}</Text>
                                      {isOverloaded && <Badge color="red">Перегрузка &gt;100%</Badge>}
                                    </Group>
                                    <Text size="xs" c="dimmed">ID: {activePerson.id}</Text>
                                  </div>
                                </Group>

                                <Button
                                  color="red"
                                  variant="subtle"
                                  size="xs"
                                  leftSection={<Trash2 size={13} />}
                                  onClick={() => {
                                    const newAssignees = draft.assignees.filter((a) => a.id !== activePerson.id);
                                    change({
                                      ...draft,
                                      assignees: newAssignees,
                                      tasks: draft.tasks.map((t) =>
                                        t.assignee_id === activePerson.id ? { ...t, assignee_id: null } : t
                                      ),
                                    });
                                    setSelectedAssigneeId(newAssignees[0]?.id || null);
                                    showNotification(`Сотрудник «${activePerson.name}» удален`);
                                  }}
                                >
                                  Удалить сотрудника
                                </Button>
                              </Group>

                              <Divider my="sm" />

                              <Group grow>
                                <TextInput
                                  label="Имя и фамилия"
                                  value={activePerson.name}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    change({
                                      ...draft,
                                      assignees: draft.assignees.map((a) =>
                                        a.id === activePerson.id ? { ...a, name: val } : a
                                      ),
                                    });
                                  }}
                                />
                                <TextInput
                                  label="Должность / Роль"
                                  placeholder="Например: Lead Backend · Python"
                                  value={activePerson.role || ""}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    change({
                                      ...draft,
                                      assignees: draft.assignees.map((a) =>
                                        a.id === activePerson.id ? { ...a, role: val } : a
                                      ),
                                    });
                                  }}
                                />
                              </Group>
                            </Card>

                            {/* Skills & Tasks Grid */}
                            <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
                              {/* Skills Card */}
                              <Card withBorder p="md" radius="sm">
                                <Text fw={700} size="sm" mb="xs">Матрица навыков и компетенций</Text>
                                
                                <Group gap={6} mb="sm">
                                  {(activePerson.skills || []).map((sk, skIdx) => (
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
                                          onClick={() => {
                                            change({
                                              ...draft,
                                              assignees: draft.assignees.map((a) =>
                                                a.id === activePerson.id
                                                  ? { ...a, skills: a.skills?.filter((_, i) => i !== skIdx) || [] }
                                                  : a
                                              ),
                                            });
                                          }}
                                        >
                                          ✕
                                        </ActionIcon>
                                      }
                                    >
                                      {sk.name} ({skillLevelLabels[sk.level]})
                                    </Badge>
                                  ))}
                                  {(!activePerson.skills || activePerson.skills.length === 0) && (
                                    <Text size="xs" c="dimmed">Компетенции еще не добавлены</Text>
                                  )}
                                </Group>

                                <Divider my="xs" />

                                <Group gap="xs" align="flex-end">
                                  <TextInput
                                    label="Новый навык"
                                    placeholder="React, SQL, Docker..."
                                    size="xs"
                                    style={{ flex: 1 }}
                                    value={inlineNewSkillName}
                                    onChange={(e) => setInlineNewSkillName(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter" && inlineNewSkillName.trim()) {
                                        e.preventDefault();
                                        change({
                                          ...draft,
                                          assignees: draft.assignees.map((a) =>
                                            a.id === activePerson.id
                                              ? {
                                                  ...a,
                                                  skills: [
                                                    ...(a.skills || []),
                                                    { name: inlineNewSkillName.trim(), level: inlineNewSkillLevel },
                                                  ],
                                                }
                                              : a
                                          ),
                                        });
                                        setInlineNewSkillName("");
                                      }
                                    }}
                                  />
                                  <Select
                                    label="Грейд"
                                    size="xs"
                                    w={130}
                                    data={[
                                      { value: "beginner", label: "Начинающий" },
                                      { value: "intermediate", label: "Средний" },
                                      { value: "advanced", label: "Продвинутый" },
                                      { value: "expert", label: "Эксперт" },
                                    ]}
                                    value={inlineNewSkillLevel}
                                    onChange={(v) => setInlineNewSkillLevel((v as Skill["level"]) || "expert")}
                                  />
                                  <Button
                                    size="xs"
                                    disabled={!inlineNewSkillName.trim()}
                                    onClick={() => {
                                      change({
                                        ...draft,
                                        assignees: draft.assignees.map((a) =>
                                          a.id === activePerson.id
                                            ? {
                                                ...a,
                                                skills: [
                                                  ...(a.skills || []),
                                                  { name: inlineNewSkillName.trim(), level: inlineNewSkillLevel },
                                                ],
                                              }
                                            : a
                                        ),
                                      });
                                      setInlineNewSkillName("");
                                    }}
                                  >
                                    + Добавить
                                  </Button>
                                </Group>
                              </Card>

                              {/* Assigned Tasks Card */}
                              <Card withBorder p="md" radius="sm">
                                <Group justify="space-between" mb="xs">
                                  <Text fw={700} size="sm">Назначенные задачи ({assignedTasks.length})</Text>
                                  {isOverloaded && (
                                    <Badge size="xs" color="red">
                                      Перегрузка по графику
                                    </Badge>
                                  )}
                                </Group>

                                {assignedTasks.length === 0 ? (
                                  <Text size="xs" c="dimmed">Нет назначенных задач в проекте</Text>
                                ) : (
                                  <ScrollArea h={140}>
                                    <Stack gap={6}>
                                      {assignedTasks.map((t) => {
                                        const r = rows.get(t.id);
                                        const match = calculateSkillMatch(t, activePerson);
                                        return (
                                          <Card key={t.id} withBorder p="xs" radius="xs" style={{ background: "rgba(0,0,0,0.01)" }}>
                                            <Group justify="space-between">
                                              <div style={{ minWidth: 0, flex: 1 }}>
                                                <Text size="xs" fw={600} lineClamp={1}>«{t.name}»</Text>
                                                <Text size="10px" c="dimmed">
                                                  {t.duration_minutes / 60} ч. · {t.allocation_percent || 100}% занятость {r ? `· с ${shortDate(r.start)} по ${shortDate(r.finish)}` : ""}
                                                </Text>
                                              </div>
                                              <Badge size="xs" color={match >= 80 ? "teal" : match >= 50 ? "yellow" : "red"} variant="light">
                                                Match {match}%
                                              </Badge>
                                            </Group>
                                          </Card>
                                        );
                                      })}
                                    </Stack>
                                  </ScrollArea>
                                )}
                              </Card>
                            </SimpleGrid>

                            {/* Calendar & Vacation Range Editor */}
                            <Card withBorder p="md" radius="sm">
                              <Text fw={700} size="sm" mb="xs">Персональный рабочий календарь и отпуска</Text>
                              <Text size="xs" c="dimmed" mb="md">
                                Настройте индивидуальные смены, обеденные перерывы или добавьте отпуск диапазоном дат.
                              </Text>
                              <CalendarEditor
                                value={activePerson.calendar}
                                onChange={(calendar) => {
                                  change({
                                    ...draft,
                                    assignees: draft.assignees.map((a) =>
                                      a.id === activePerson.id ? { ...a, calendar } : a
                                    ),
                                  });
                                }}
                              />
                            </Card>
                          </Stack>
                        );
                      })()}
                    </div>
                  </div>
                )}
              </Card>
            )}

            {/* Links / Dependencies View */}
            {activeView === "links" && (
              <Card withBorder p="md">
                <Group justify="space-between" mb="md">
                  <div>
                    <Title order={3}>Зависимости и связи между задачами</Title>
                    <Text size="sm" c="dimmed">Связи задают технологическую последовательность и типы зависимостей.</Text>
                  </div>
                  <Group gap="xs">
                    <Button size="xs" onClick={() => setDepModal(true)}>+ Добавить связь</Button>
                    <Button size="xs" variant="light" onClick={() => setActiveView("dashboard")}>← На Главную</Button>
                  </Group>
                </Group>

                <Table striped highlightOnHover>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Предшествующая задача</Table.Th>
                      <Table.Th>Тип связи</Table.Th>
                      <Table.Th>Последующая задача</Table.Th>
                      <Table.Th>Задержка (лаг)</Table.Th>
                      <Table.Th>Режим</Table.Th>
                      <Table.Th style={{ width: 80, textAlign: "right" }}>Действия</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {(draft?.dependencies || []).map((d, idx) => {
                      const pred = draft?.tasks.find((t) => t.id === d.predecessor_id);
                      const succ = draft?.tasks.find((t) => t.id === d.successor_id);
                      return (
                        <Table.Tr key={idx}>
                          <Table.Td fw={600}>{pred?.name || d.predecessor_id}</Table.Td>
                          <Table.Td>
                            <Badge variant="outline">{d.kind}</Badge>
                          </Table.Td>
                          <Table.Td fw={600}>{succ?.name || d.successor_id}</Table.Td>
                          <Table.Td>{d.lag_minutes / 60} ч.</Table.Td>
                          <Table.Td>
                            <Badge size="xs" color={d.lag_mode === "working" ? "blue" : "gray"}>
                              {d.lag_mode === "working" ? "Рабочее время" : "Календарное время"}
                            </Badge>
                          </Table.Td>
                          <Table.Td>
                            <Group gap={4} justify="flex-end">
                              <ActionIcon
                                color="blue"
                                variant="subtle"
                                title="Редактировать связь"
                                onClick={() => {
                                  setEditingDepIndex(idx);
                                  setEditDepKind(d.kind);
                                  setEditDepLagHours(d.lag_minutes / 60);
                                  setEditDepLagMode(d.lag_mode);
                                }}
                              >
                                <Edit size={16} />
                              </ActionIcon>
                              <ActionIcon
                                color="red"
                                variant="subtle"
                                title="Удалить связь"
                                onClick={() => {
                                  if (!draft) return;
                                  change({
                                    ...draft,
                                    dependencies: (draft.dependencies || []).filter((_, j) => j !== idx),
                                  });
                                  showNotification("Связь удалена");
                                }}
                              >
                                <Trash2 size={16} />
                              </ActionIcon>
                            </Group>
                          </Table.Td>
                        </Table.Tr>
                      );
                    })}
                  </Table.Tbody>
                </Table>
              </Card>
            )}

            {/* AI Copilot & Risks View */}
            {activeView === "ai" && saved && draft && (
              <Stack gap="md">
                <Group justify="space-between">
                  <div>
                    <Title order={3}>AI Copilot и Центр анализа рисков</Title>
                    <Text size="sm" c="dimmed">
                      Интерактивный диалог с AI по проекту, экспресс-аудит критического пути и стратегические рекомендации.
                    </Text>
                  </div>
                  <Button size="xs" variant="light" onClick={() => setActiveView("dashboard")}>
                    ← На Главную
                  </Button>
                </Group>

                <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
                  <AICopilotChat
                    key={saved.id}
                    project={saved.project}
                    projectId={saved.id}
                    result={saved}
                  />

                  <Card withBorder p="md">
                    <Group justify="space-between" mb="sm">
                      <Title order={4} style={{ fontSize: 16 }}>
                        Экспресс-аудит рисков (Автоотчет)
                      </Title>
                      <Button
                        size="xs"
                        loading={aiBusy}
                        onClick={() =>
                          void run(async () => {
                            setAiBusy(true);
                            try {
                              const res = await api<{ available: boolean; text: string }>(
                                `/projects/${saved.id}/ai`,
                                "POST",
                              );
                              setAiText(res.text);
                            } finally {
                              setAiBusy(false);
                            }
                          })
                        }
                      >
                        <Sparkles size={14} style={{ marginRight: 6 }} /> Сформировать аудит
                      </Button>
                    </Group>

                    <Divider mb="sm" />

                    {aiText ? (
                      <ScrollArea style={{ maxHeight: 460 }}>
                        <Text size="sm" style={{ whiteSpace: "pre-wrap", lineHeight: 1.5 }}>
                          {aiText}
                        </Text>
                      </ScrollArea>
                    ) : (
                      <Text size="sm" c="dimmed">
                        Нажмите «Сформировать аудит», чтобы AI объяснил готовые расчёты движка и предложил гипотезы действий.
                      </Text>
                    )}
                  </Card>
                </SimpleGrid>
              </Stack>
            )}
          </div>
        </main>
      </div>

      {/* Toast notification component */}
      <div className={`toast ${toast ? "show" : ""}`} role="status">
        {toast}
      </div>

      {/* Dependency / Link Creation Modal */}
      {depModal && (
        <Modal
          opened={depModal}
          onClose={() => setDepModal(false)}
          title="Добавить связь между задачами"
          size="md"
        >
          <Stack gap="sm">
            <Select
              label="Предшествующая задача"
              placeholder="Выберите задачу-предшественник"
              data={(draft?.tasks || []).map((t) => ({ value: t.id, label: t.name }))}
              value={newDepPred}
              onChange={(v) => setNewDepPred(v || "")}
              required
            />

            <Select
              label="Тип связи"
              data={[
                { value: "FS", label: "Окончание → Начало (FS)" },
                { value: "SS", label: "Начало → Начало (SS)" },
                { value: "FF", label: "Окончание → Окончание (FF)" },
                { value: "SF", label: "Начало → Окончание (SF)" },
              ]}
              value={newDepKind}
              onChange={(v) => setNewDepKind((v as Dependency["kind"]) || "FS")}
            />

            <Select
              label="Последующая задача"
              placeholder="Выберите зависимую задачу"
              data={(draft?.tasks || []).map((t) => ({ value: t.id, label: t.name }))}
              value={newDepSucc}
              onChange={(v) => setNewDepSucc(v || "")}
              required
            />

            <Group grow>
              <NumberInput
                label="Задержка / лаг (в часах)"
                value={newDepLagHours}
                onChange={(v) => setNewDepLagHours(Number(v || 0))}
              />
              <Select
                label="Режим задержки"
                data={[
                  { value: "working", label: "Рабочее время" },
                  { value: "elapsed", label: "Календарное время" },
                ]}
                value={newDepLagMode}
                onChange={(v) => setNewDepLagMode((v as Dependency["lag_mode"]) || "working")}
              />
            </Group>

            <Group justify="flex-end" mt="md">
              <Button variant="default" onClick={() => setDepModal(false)}>Отмена</Button>
              <Button onClick={handleAddDependencySubmit}>Добавить связь</Button>
            </Group>
          </Stack>
        </Modal>
      )}

      {/* Edit Dependency Modal */}
      {editingDepIndex !== null && draft?.dependencies[editingDepIndex] && (
        <Modal
          opened={editingDepIndex !== null}
          onClose={() => setEditingDepIndex(null)}
          title="Редактирование связи между задачами"
          size="md"
        >
          {(() => {
            const currentDep = draft.dependencies[editingDepIndex];
            const pred = draft.tasks.find((t) => t.id === currentDep.predecessor_id);
            const succ = draft.tasks.find((t) => t.id === currentDep.successor_id);
            return (
              <Stack gap="sm">
                <Card withBorder p="xs" style={{ background: "rgba(90, 117, 233, 0.05)" }}>
                  <Text size="xs" fw={700} c="dimmed">СВЯЗАННЫЕ ЗАДАЧИ:</Text>
                  <Text size="sm" fw={600}>
                    «{pred?.name || currentDep.predecessor_id}» → «{succ?.name || currentDep.successor_id}»
                  </Text>
                </Card>

                <Select
                  label="Тип связи"
                  data={[
                    { value: "FS", label: "Окончание → Начало (FS)" },
                    { value: "SS", label: "Начало → Начало (SS)" },
                    { value: "FF", label: "Окончание → Окончание (FF)" },
                    { value: "SF", label: "Начало → Окончание (SF)" },
                  ]}
                  value={editDepKind}
                  onChange={(v) => setEditDepKind((v as Dependency["kind"]) || "FS")}
                />

                <Group grow>
                  <NumberInput
                    label="Задержка / лаг (в часах)"
                    value={editDepLagHours}
                    onChange={(v) => setEditDepLagHours(Number(v || 0))}
                  />
                  <Select
                    label="Режим задержки"
                    data={[
                      { value: "working", label: "Рабочее время" },
                      { value: "elapsed", label: "Календарное время" },
                    ]}
                    value={editDepLagMode}
                    onChange={(v) => setEditDepLagMode((v as Dependency["lag_mode"]) || "working")}
                  />
                </Group>

                <Group justify="flex-end" mt="md">
                  <Button variant="default" onClick={() => setEditingDepIndex(null)}>
                    Отмена
                  </Button>
                  <Button
                    onClick={() => {
                      const updated = [...draft.dependencies];
                      updated[editingDepIndex] = {
                        ...updated[editingDepIndex],
                        kind: editDepKind,
                        lag_minutes: Math.round(editDepLagHours * 60),
                        lag_mode: editDepLagMode,
                      };
                      change({
                        ...draft,
                        dependencies: updated,
                      });
                      setEditingDepIndex(null);
                      showNotification("Параметры связи обновлены");
                    }}
                  >
                    Сохранить изменения
                  </Button>
                </Group>
              </Stack>
            );
          })()}
        </Modal>
      )}

      {/* CSV Import Modal */}
      {importModal && (
        <Modal
          opened={importModal}
          onClose={() => setImportModal(false)}
          title="Импорт задач из CSV"
          size="lg"
        >
          <Stack gap="md">
            <Text size="sm" c="dimmed">
              Вставьте текст CSV или загрузите файл (разделители: точка с запятой или запятая).
              Формат колонок: ID; Название; Приоритет; Часы/Мин; Исполнитель; Статус; Не раньше; Требуемые навыки.
            </Text>

            <FileInput
              label="Загрузить файл .csv"
              placeholder="Выберите .csv файл"
              accept=".csv,text/csv"
              onChange={(file) => {
                if (file) {
                  const reader = new FileReader();
                  reader.onload = (e) => setCsvInput((e.target?.result as string) || "");
                  reader.readAsText(file, "UTF-8");
                }
              }}
            />

            <Textarea
              label="Либо вставьте содержимое CSV напрямую:"
              rows={8}
              placeholder="Название задачи; medium; 8; Алексей; todo; 2026-09-22T09:00:00+05:00; React, TypeScript"
              value={csvInput}
              onChange={(e) => setCsvInput(e.target.value)}
            />

            <Group justify="flex-end">
              <Button variant="default" onClick={() => setImportModal(false)}>Отмена</Button>
              <Button onClick={handleImportCsvSubmit} disabled={!csvInput.trim()}>
                Импортировать задачи
              </Button>
            </Group>
          </Stack>
        </Modal>
      )}

      {/* Full Project JSON Import Modal */}
      {jsonImportModal && (
        <Modal
          opened={jsonImportModal}
          onClose={() => {
            setJsonImportModal(false);
            setJsonInput("");
            setJsonImportError("");
          }}
          title="Импорт полного проекта из JSON"
          size="lg"
        >
          <Stack gap="md">
            <Text size="sm" c="dimmed">
              Загрузите файл .json или вставьте JSON-снимок проекта со всеми задачами, исполнителями, персональными календарями и зависимостями.
            </Text>

            {jsonImportError && <Alert color="red">{jsonImportError}</Alert>}

            <FileInput
              label="Загрузить файл .json"
              placeholder="Выберите .json файл проекта"
              accept=".json,application/json"
              onChange={(file) => {
                if (file) {
                  const reader = new FileReader();
                  reader.onload = (e) => {
                    const content = (e.target?.result as string) || "";
                    setJsonInput(content);
                  };
                  reader.readAsText(file, "UTF-8");
                }
              }}
            />

            <Textarea
              label="Либо вставьте JSON проекта:"
              rows={8}
              placeholder='{ "name": "Мой проект", "start": "...", "deadline": "...", "tasks": [...], ... }'
              value={jsonInput}
              onChange={(e) => {
                setJsonInput(e.target.value);
                setJsonImportError("");
              }}
            />

            <Group justify="space-between" mt="md">
              <Button variant="default" onClick={() => setJsonImportModal(false)}>
                Отмена
              </Button>
              <Group gap="xs">
                {draft && (
                  <Button
                    variant="light"
                    disabled={!jsonInput.trim()}
                    onClick={() => {
                      try {
                        const parsed = parseJsonToProject(jsonInput);
                        change(parsed);
                        setJsonImportModal(false);
                        setJsonInput("");
                        showNotification(`Проект «${parsed.name}» загружен в текущий черновик`);
                      } catch (err: any) {
                        setJsonImportError(err?.message || "Ошибка структуры JSON");
                      }
                    }}
                  >
                    Заменить текущий черновик
                  </Button>
                )}
                <Button
                  loading={busy}
                  disabled={!jsonInput.trim()}
                  onClick={() =>
                    void run(async () => {
                      try {
                        const parsed = parseJsonToProject(jsonInput);
                        const created = await api<Result>("/projects", "POST", parsed);
                        await list();
                        accept(created);
                        setJsonImportModal(false);
                        setJsonInput("");
                        showNotification(`Проект «${parsed.name}» создан и открыт`);
                      } catch (err: any) {
                        setJsonImportError(err?.message || "Ошибка создания проекта через API");
                      }
                    })
                  }
                >
                  Создать как новый проект
                </Button>
              </Group>
            </Group>
          </Stack>
        </Modal>
      )}

      {/* Project Management & Delete Modal */}
      {projectManageModal && (
        <Modal
          opened={projectManageModal}
          onClose={() => setProjectManageModal(false)}
          title="Управление проектами"
          size="lg"
        >
          <Stack gap="md">
            <Group justify="space-between">
              <Text size="sm" c="dimmed">
                Выберите проект для переключения или создайте новый.
              </Text>
              <Group gap="xs">
                <Button size="xs" variant="light" leftSection={<RotateCcw size={13} />} onClick={handleLoadDemoProject}>
                  Загрузить Демо-проект
                </Button>
                <Button size="xs" onClick={() => setNewProjectModal(true)}>
                  + Создать проект
                </Button>
              </Group>
            </Group>

            <Group gap="xs">
              <Button size="xs" variant="default" leftSection={<Upload size={13} />} onClick={() => setJsonImportModal(true)}>
                Импорт JSON
              </Button>
              {draft && (
                <Button size="xs" variant="default" leftSection={<FileJson size={13} />} onClick={() => exportProjectToJson(draft)}>
                  Экспорт текущего в JSON
                </Button>
              )}
            </Group>

            <Divider />

            <Stack gap="xs">
              {projects.map((p) => {
                const isCurrent = saved?.id === p.id;
                return (
                  <Card key={p.id} withBorder p="xs" style={{ background: isCurrent ? "rgba(90, 117, 233, 0.08)" : undefined }}>
                    <Group justify="space-between">
                      <Group gap="xs">
                        <span className="project-dot" />
                        <div>
                          <Text fw={700} size="sm">{p.name}</Text>
                          {isCurrent && <Badge size="xs" color="blue">Текущий активный</Badge>}
                        </div>
                      </Group>

                      <Group gap="xs">
                        {!isCurrent && (
                          <Button
                            size="xs"
                            variant="light"
                            onClick={() =>
                              void run(async () => {
                                accept(await api<Result>(`/projects/${p.id}`));
                                setProjectManageModal(false);
                                showNotification(`Переключено на проект «${p.name}»`);
                              })
                            }
                          >
                            Переключиться
                          </Button>
                        )}
                        <ActionIcon
                          color="red"
                          variant="subtle"
                          title="Удалить проект"
                          onClick={() => setDeleteConfirmProject(p)}
                        >
                          <Trash2 size={16} />
                        </ActionIcon>
                      </Group>
                    </Group>
                  </Card>
                );
              })}
            </Stack>
          </Stack>
        </Modal>
      )}

      {/* Delete Project Confirmation Modal */}
      {deleteConfirmProject && (
        <Modal
          opened={Boolean(deleteConfirmProject)}
          onClose={() => setDeleteConfirmProject(null)}
          title="Подтверждение удаления проекта"
          size="sm"
        >
          <Stack gap="md">
            <Text size="sm">
              Вы уверены, что хотите навсегда удалить проект <strong>«{deleteConfirmProject.name}»</strong>? Все его задачи и графики будут безвозвратно удалены.
            </Text>

            <Group justify="flex-end">
              <Button variant="default" onClick={() => setDeleteConfirmProject(null)}>
                Отмена
              </Button>
              <Button
                color="red"
                loading={busy}
                onClick={() => handleDeleteProject(deleteConfirmProject.id)}
              >
                Удалить проект
              </Button>
            </Group>
          </Stack>
        </Modal>
      )}

      {/* New Project Modal */}
      {newProjectModal && (
        <Modal
          opened={newProjectModal}
          onClose={() => setNewProjectModal(false)}
          title="Создание нового проекта"
          size="md"
        >
          <Stack gap="sm">
            <TextInput
              label="Название проекта"
              value={newProjName}
              onChange={(e) => setNewProjName(e.target.value)}
              required
            />

            <Select
              label="Часовой пояс IANA"
              data={TIMEZONE_OPTIONS}
              value={newProjTz}
              onChange={(v) => v && setNewProjTz(v)}
            />

            <Group grow>
              <ProjectDateInput
                label="Дата начала"
                zone={newProjTz}
                value={newProjStart}
                onChange={setNewProjStart}
              />
              <ProjectDateInput
                label="Целевой дедлайн"
                zone={newProjTz}
                value={newProjDeadline}
                onChange={setNewProjDeadline}
              />
            </Group>

            <Group justify="flex-end" mt="md">
              <Button variant="default" onClick={() => setNewProjectModal(false)}>
                Отмена
              </Button>
              <Button onClick={handleCreateProjectSubmit} loading={busy}>
                Создать проект
              </Button>
            </Group>
          </Stack>
        </Modal>
      )}

      {/* Scenario Modal (What if?) */}
      {showScenarioModal && (
        <Modal
          opened={showScenarioModal}
          onClose={() => {
            setShowScenarioModal(false);
            setSimResult(null);
          }}
          title="ПРОВЕРКА ИЗМЕНЕНИЯ — Что если?"
          size="md"
        >
          <Stack gap="sm">
            <Text size="sm" c="dimmed">
              Проверьте последствия до того, как менять план проекта.
            </Text>

            <Select
              label="Выберите незавершённую задачу"
              data={(draft?.tasks || []).filter(t => t.status !== "done").map((t) => ({ value: t.id, label: t.name }))}
              value={simTaskChoice || (draft?.tasks.find(t => t.status !== "done")?.id || "")}
              onChange={(v) => { setSimTaskChoice(v || ""); setSimResult(null); }}
            />

            <div>
              <Text size="xs" fw={700} mb={4}>Увеличение длительности: <strong>{simDelayDays} рабочих часов</strong></Text>
              <input
                type="range"
                min="0"
                max="40"
                value={simDelayDays}
                onChange={(e) => { setSimDelayDays(Number(e.target.value)); setSimResult(null); }}
                style={{ width: "100%", accentColor: "var(--purple)" }}
              />
            </div>

            {simError && <Alert color="red">{simError}</Alert>}
            <Button onClick={handleRunSimulation} loading={simBusy}>
              Запустить сценарий
            </Button>

            {simResult && <Card withBorder p="sm"><Stack gap="xs">
              <Text fw={700}>Результат движка относительно сохранённого плана</Text>
              <Text>Прогноз завершения: {date(simResult.analysis.finish)}</Text>
              <Text>Сдвиг: {simResult.changes?.finish_delta_minutes || 0} календарных минут</Text>
              <Text>Задачи с изменёнными датами: {simResult.changes?.changed_task_ids.length || 0}</Text>
              <Text>Дедлайн: {simResult.analysis.deadline_exceeded ? "превышен" : "не превышен"}</Text>
              <Text>Периоды перегрузки: {simResult.analysis.overloads.length}</Text>
              <Button onClick={() => {setDraft(copy(simResult.project)); setPreview(simResult); setAiText(""); setShowScenarioModal(false);}}>Перенести сценарий в черновик</Button>
            </Stack></Card>}
          </Stack>
        </Modal>
      )}

      {/* FULL TASK DRAWER — Со всеми полями: not_before, allocation_percent, required_skills, actual_dates */}
      <Drawer
        opened={Boolean(task)}
        onClose={() => setTask(null)}
        title={task?.id && draft?.tasks.some((t) => t.id === task.id) ? "Редактирование задачи" : "Новая задача"}
        position="right"
        size="md"
      >
        {task && draft && (
          <Stack gap="md">
            <TextInput
              label="Название задачи"
              value={task.name}
              onChange={(e) => setTask({ ...task, name: e.target.value })}
              required
            />

            <Group grow>
              <Select
                label="Приоритет"
                data={[
                  { value: "low", label: "Низкий" },
                  { value: "medium", label: "Средний" },
                  { value: "high", label: "Высокий" },
                  { value: "urgent", label: "Срочный" },
                ]}
                value={task.priority || "medium"}
                onChange={(v) => setTask({ ...task, priority: (v as Priority) || "medium" })}
              />

              <NumberInput
                label="Длительность (часы)"
                value={task.duration_minutes / 60}
                min={0.5}
                step={0.5}
                onChange={(val) => setTask({ ...task, duration_minutes: Math.round(Number(val || 1) * 60) })}
              />
            </Group>

            <Group grow>
              <Select
                label="Исполнитель"
                data={[
                  { value: "", label: "Не назначен" },
                  ...draft.assignees.map((a) => ({ value: a.id, label: `${a.name} ${a.role ? `(${a.role})` : ""}` })),
                ]}
                value={task.assignee_id || ""}
                onChange={(v) => setTask({ ...task, assignee_id: v || null })}
              />

              <NumberInput
                label="Загрузка сотрудника (%)"
                min={1}
                max={100}
                value={task.allocation_percent || 100}
                onChange={(val) => setTask({ ...task, allocation_percent: Number(val || 100) })}
              />
            </Group>

            {task.assignee_id && (
              <Group gap="xs">
                {(() => {
                  const assignedPerson = draft.assignees.find((a) => a.id === task.assignee_id);
                  if (!assignedPerson) return null;
                  const match = calculateSkillMatch(task, assignedPerson);
                  return (
                    <Badge color={match >= 80 ? "teal" : match >= 50 ? "yellow" : "red"} variant="light" size="sm">
                      Соответствие навыкам: {match}%
                    </Badge>
                  );
                })()}
              </Group>
            )}

            <Select
              label="Статус задачи"
              data={[
                { value: "todo", label: "Запланировано" },
                { value: "in_progress", label: "В работе" },
                { value: "done", label: "Завершено" },
                { value: "blocked", label: "Заблокировано" },
              ]}
              value={task.status}
              onChange={(v) => setTask(changeTaskStatus(task, v as any))}
            />

            <div>
              <Text size="xs" fw={600} mb={4}>Требуемые навыки (компетенции):</Text>
              <Group gap={4} mb={6}>
                {(task.required_skills || []).map((sk, skIdx) => (
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
                          setTask({
                            ...task,
                            required_skills: (task.required_skills || []).filter((_, i) => i !== skIdx),
                          })
                        }
                      >
                        ✕
                      </ActionIcon>
                    }
                  >
                    {sk}
                  </Badge>
                ))}
              </Group>
              <Group gap="xs">
                <TextInput
                  placeholder="Добавить навык (React, SQL, Figma...)"
                  size="xs"
                  value={newTaskSkill}
                  onChange={(e) => setNewTaskSkill(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && newTaskSkill.trim()) {
                      e.preventDefault();
                      setTask({
                        ...task,
                        required_skills: [...(task.required_skills || []), newTaskSkill.trim()],
                      });
                      setNewTaskSkill("");
                    }
                  }}
                />
                <Button
                  size="xs"
                  variant="light"
                  disabled={!newTaskSkill.trim()}
                  onClick={() => {
                    setTask({
                      ...task,
                      required_skills: [...(task.required_skills || []), newTaskSkill.trim()],
                    });
                    setNewTaskSkill("");
                  }}
                >
                  + Добавить
                </Button>
              </Group>
            </div>

            <Divider my="xs" />

            <ProjectDateInput
              label="Начать не раньше чем (not_before)"
              zone={draft.timezone}
              value={task.not_before}
              onChange={(val) => setTask({ ...task, not_before: val })}
            />

            {(task.status === "in_progress" || task.status === "done" || task.status === "blocked") && (
              <ProjectDateInput
                label="Фактическое начало"
                zone={draft.timezone}
                value={task.actual_start}
                onChange={(val) => setTask({ ...task, actual_start: val })}
              />
            )}

            {task.status === "done" && (
              <ProjectDateInput
                label="Фактическое окончание"
                zone={draft.timezone}
                value={task.actual_finish}
                onChange={(val) => setTask({ ...task, actual_finish: val })}
              />
            )}

            <Divider my="xs" label="Связи и зависимости (Предшественники)" labelPosition="center" />

            {/* List of existing incoming predecessors */}
            {(() => {
              const incomingDeps = (draft.dependencies || []).filter((d) => d.successor_id === task.id);
              return (
                <Stack gap="xs">
                  {incomingDeps.length === 0 ? (
                    <Text size="xs" c="dimmed">Нет предшествующих задач (стартует свободно)</Text>
                  ) : (
                    <Stack gap={6}>
                      <Text size="xs" fw={600}>Зависит от следующих задач:</Text>
                      {incomingDeps.map((dep, depIdx) => {
                        const predTask = draft.tasks.find((t) => t.id === dep.predecessor_id);
                        return (
                          <Card key={depIdx} withBorder p="xs" radius="sm">
                            <Group justify="space-between">
                              <div>
                                <Group gap={6}>
                                  <Badge size="xs" color="indigo">{dep.kind}</Badge>
                                  <Text size="xs" fw={600}>«{predTask?.name || dep.predecessor_id}»</Text>
                                </Group>
                                {dep.lag_minutes !== 0 && (
                                  <Text size="xs" c="dimmed">
                                    Лаг: {dep.lag_minutes / 60} ч ({dep.lag_mode === "working" ? "раб." : "календ."})
                                  </Text>
                                )}
                              </div>
                              <ActionIcon
                                size="xs"
                                color="red"
                                variant="subtle"
                                title="Удалить связь"
                                onClick={() => {
                                  change({
                                    ...draft,
                                    dependencies: draft.dependencies.filter((d) => d !== dep),
                                  });
                                  showNotification("Связь удалена");
                                }}
                              >
                                <Trash2 size={13} />
                              </ActionIcon>
                            </Group>
                          </Card>
                        );
                      })}
                    </Stack>
                  )}

                  {/* Add predecessor inline */}
                  <Card withBorder p="xs" radius="sm" style={{ background: "rgba(90, 117, 233, 0.03)" }}>
                    <Text size="xs" fw={700} mb={6}>+ Привязать задачу-предшественника:</Text>
                    <Stack gap="xs">
                      <Select
                        size="xs"
                        placeholder="Выберите задачу-предшественник"
                        data={draft.tasks
                          .filter((t) => t.id !== task.id && !incomingDeps.some((d) => d.predecessor_id === t.id))
                          .map((t) => ({ value: t.id, label: t.name }))}
                        value={taskInlinePredId}
                        onChange={(v) => setTaskInlinePredId(v || "")}
                      />
                      {taskInlinePredId && (
                        <>
                          <Group grow gap="xs">
                            <Select
                              size="xs"
                              label="Тип"
                              data={[
                                { value: "FS", label: "FS (Окончание → Начало)" },
                                { value: "SS", label: "SS (Начало → Начало)" },
                                { value: "FF", label: "FF (Окончание → Окончание)" },
                                { value: "SF", label: "SF (Начало → Окончание)" },
                              ]}
                              value={taskInlinePredKind}
                              onChange={(v) => setTaskInlinePredKind((v as Dependency["kind"]) || "FS")}
                            />
                            <NumberInput
                              size="xs"
                              label="Лаг (ч)"
                              value={taskInlinePredLagHours}
                              onChange={(v) => setTaskInlinePredLagHours(Number(v || 0))}
                            />
                          </Group>
                          {draft.tasks.some((t) => t.id === task.id) && (
                            <Button
                              size="xs"
                              variant="light"
                              onClick={() => {
                                if (!taskInlinePredId) return;
                                const newDep: Dependency = {
                                  predecessor_id: taskInlinePredId,
                                  successor_id: task.id,
                                  kind: taskInlinePredKind,
                                  lag_minutes: Math.round(taskInlinePredLagHours * 60),
                                  lag_mode: taskInlinePredLagMode,
                                };
                                change({
                                  ...draft,
                                  dependencies: [...draft.dependencies, newDep],
                                });
                                setTaskInlinePredId("");
                                showNotification("Связь добавлена");
                              }}
                            >
                              Добавить связь сейчас
                            </Button>
                          )}
                        </>
                      )}
                    </Stack>
                  </Card>
                </Stack>
              );
            })()}

            <Group justify="space-between" mt="md">
              {draft.tasks.some((t) => t.id === task.id) && (
                <Button
                  color="red"
                  variant="subtle"
                  onClick={() => {
                    change({
                      ...draft,
                      tasks: draft.tasks.filter((t) => t.id !== task.id),
                      dependencies: draft.dependencies.filter(
                        (d) => d.predecessor_id !== task.id && d.successor_id !== task.id
                      ),
                    });
                    setTask(null);
                    setTaskInlinePredId("");
                    showNotification(`Задача «${task.name}» удалена`);
                  }}
                >
                  Удалить задачу
                </Button>
              )}

              <Button
                onClick={() => {
                  const isExisting = draft.tasks.some((t) => t.id === task.id);
                  let newDeps = [...draft.dependencies];
                  if (!isExisting && taskInlinePredId) {
                    newDeps.push({
                      predecessor_id: taskInlinePredId,
                      successor_id: task.id,
                      kind: taskInlinePredKind,
                      lag_minutes: Math.round(taskInlinePredLagHours * 60),
                      lag_mode: taskInlinePredLagMode,
                    });
                  }
                  change({
                    ...draft,
                    tasks: isExisting
                      ? draft.tasks.map((t) => (t.id === task.id ? task : t))
                      : [...draft.tasks, task],
                    dependencies: newDeps,
                  });
                  setTask(null);
                  setTaskInlinePredId("");
                  showNotification(`Задача «${task.name}» сохранена`);
                }}
              >
                Сохранить задачу
              </Button>
            </Group>
          </Stack>
        )}
      </Drawer>

      {/* FULL SETTINGS DRAWER — Параметры проекта и общий рабочий календарь */}
      <Drawer
        opened={settings}
        onClose={() => setSettings(false)}
        title="Настройки проекта"
        position="right"
        size="xl"
      >
        {draft && (
          <Tabs value={settingsTab} onChange={setSettingsTab} defaultValue="project">
            <Tabs.List mb="md">
              <Tabs.Tab value="project">Параметры проекта</Tabs.Tab>
              <Tabs.Tab value="calendar">Календарь проекта</Tabs.Tab>
            </Tabs.List>

            <Tabs.Panel value="project">
              <Stack gap="md">
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
                    onChange={(value) => change({ ...draft, start: value })}
                  />
                  <ProjectDateInput
                    label="Целевой дедлайн"
                    zone={draft.timezone}
                    value={draft.deadline}
                    onChange={(value) => change({ ...draft, deadline: value })}
                  />
                </Group>

                <Divider my="sm" />

                <Card withBorder p="sm" style={{ background: "rgba(90, 117, 233, 0.04)" }}>
                  <Group justify="space-between" align="center">
                    <div>
                      <Text size="xs" fw={700} c="blue">
                        БАЗОВЫЙ ПЛАН (BASELINE)
                      </Text>
                      <Text size="xs" c="dimmed">
                        {draft.baseline
                          ? `Зафиксирован: ${date(draft.baseline.saved_at)}`
                          : "Эталонный график еще не зафиксирован"}
                      </Text>
                    </div>
                    <Button variant="light" size="xs" onClick={handleSaveBaseline}>
                      Зафиксировать текущий снимок
                    </Button>
                  </Group>
                </Card>

                <Card withBorder p="sm" style={{ background: "var(--bg-subtle, rgba(0, 0, 0, 0.02))" }}>
                  <Group justify="space-between" align="center">
                    <div>
                      <Text size="xs" fw={700}>
                        Управление командой и ресурсами ({draft.assignees.length} чел.)
                      </Text>
                      <Text size="xs" c="dimmed">
                        Роли, матрица компетенций, персональные отпуска и загрузка сотрудников.
                      </Text>
                    </div>
                    <Button
                      variant="light"
                      size="xs"
                      onClick={() => {
                        setSettings(false);
                        setActiveView("team");
                      }}
                    >
                      Перейти во вкладку «Команда» →
                    </Button>
                  </Group>
                </Card>
              </Stack>
            </Tabs.Panel>

            <Tabs.Panel value="calendar">
              <Stack gap="md">
                <Text size="xs" c="dimmed">
                  Общий рабочий календарь определяет стандартные смены и праздничные нерабочие дни для всей компании/проекта.
                </Text>
                <CalendarEditor
                  value={draft.calendar}
                  onChange={(calendar) => change({ ...draft, calendar })}
                />
              </Stack>
            </Tabs.Panel>

            <Group justify="flex-end" mt="xl">
              <Button onClick={() => setSettings(false)}>
                Готово
              </Button>
            </Group>
          </Tabs>
        )}
      </Drawer>

      {/* Help & System Guide Modal */}
      {helpModal && (
        <Modal
          opened={helpModal}
          onClose={() => setHelpModal(false)}
          title="Справка и возможности Critix"
          size="lg"
        >
          <Stack gap="md">
            <Card withBorder p="sm" style={{ background: "rgba(90, 117, 233, 0.05)" }}>
              <Group gap="xs" mb={4}>
                <Target size={16} color="#e57470" />
                <Text fw={700} size="sm">Метод критического пути (CPM) и Базовый план</Text>
              </Group>
              <Text size="xs" c="dimmed">
                Critix автоматически рассчитывает самый длинный путь технологических зависимостей. Задачи с нулевым резервом времени (резерв = 0 ч) отмечены красной рамкой. Любая задержка на критическом пути сдвигает срок сдачи всего проекта.
              </Text>
            </Card>

            <Card withBorder p="sm">
              <Group gap="xs" mb={4}>
                <GitBranch size={16} color="#5a75e9" />
                <Text fw={700} size="sm">Интерактивная карта графа (ReactFlow)</Text>
              </Group>
              <Text size="xs" c="dimmed">
                Блоки задач можно свободно перемещать по холсту, кликать для детального редактирования, перетягивать стрелки от точки к точке для создания связей (FS/SS/FF/SF) и фильтровать только критический путь.
              </Text>
            </Card>

            <Card withBorder p="sm">
              <Group gap="xs" mb={4}>
                <Sparkles size={16} color="#9381d7" />
                <Text fw={700} size="sm">Симуляция последствий «Что если?»</Text>
              </Group>
              <Text size="xs" c="dimmed">
                Проверяйте сценарии сдвигов задач перед внесением изменений. Система покажет точный расчет смещения дедлайна и рекомендации AI по оптимизации ресурсов.
              </Text>
            </Card>

            <Group justify="flex-end" mt="xs">
              <Button onClick={() => setHelpModal(false)}>Понятно</Button>
            </Group>
          </Stack>
        </Modal>
      )}

      {/* Executive Summary Report Modal */}
      {draft && (
        <ExecutiveReportModal
          opened={executiveReportModal}
          onClose={() => setExecutiveReportModal(false)}
          project={view?.project || draft}
          result={view}
          aiSummary={aiText}
        />
      )}
    </MantineProvider>
  );
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

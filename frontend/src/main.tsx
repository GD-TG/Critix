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
  type MantineColorsTuple,
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
import { AppProvider, useApp } from "./context/AppContext";
import { AuthForm } from "./feature/AuthForm/AuthForm";
import { SideForm } from "./feature/SideForm/SideForm";
import { TopBar } from "./feature/TopBar/TopBar";
import { DashboardHeader } from "./feature/DashboardHeader/DashboardHeader";
import { DraftBanner } from "./feature/DraftBanner/DraftBanner";
import { MetricsGrid } from "./feature/MetricsGrid/MetricsGrid";
import { TimelinePanel } from "./feature/TimelinePanel/TimelinePanel";
import { AttentionPanel } from "./feature/AttentionPanel/AttentionPanel";
import { DecisionPanel } from "./feature/DecisionPanel/DecisionPanel";
import { HistoryPanel } from "./feature/HistoryPanel/HistoryPanel";
import { EnginePanel } from "./feature/EnginePanel/EnginePanel";

const actionLogo = new URL("./action-logo-transparent.png", import.meta.url).href;
const actionRed: MantineColorsTuple = [
  "#fff0f2", "#ffe0e4", "#ffc1cb", "#ff9baa", "#f46b83",
  "#e9415e", "#d20a2e", "#b90a29", "#960821", "#79071c",
];
const actionTheme = {
  fontFamily: "'IBM Plex Sans', sans-serif",
  primaryColor: "red",
  colors: { red: actionRed, blue: actionRed },
};

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
  link.download = `${project.name.replace(/\s+/g, "_")}_aktion_export.json`;
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
  const {
    // Auth
    logged, busy, error, setError,
    // Theme
    colorScheme, toggleTheme,
    // Projects
    projects, saved, draft, preview, list, run, lastUpdated, dirty, clearProject,
    setDraft, setPreview,
    accept: acceptFromCtx, change: changeFromCtx,
    // Navigation / UI
    activeView, setActiveView,
    toast, showNotification,
    // Modals & drawers
    newProjectModal, setNewProjectModal,
    projectManageModal, setProjectManageModal,
    jsonImportModal, setJsonImportModal,
    importModal, setImportModal,
    helpModal, setHelpModal,
    executiveReportModal, setExecutiveReportModal,
    settings, setSettings, settingsTab, setSettingsTab,
    deleteConfirmProject, setDeleteConfirmProject,
    showScenarioModal, setShowScenarioModal,
    // Task drawer / dependency modals
    task, setTask, newTaskSkill, setNewTaskSkill,
    taskInlinePredId, setTaskInlinePredId,
    taskInlinePredKind, setTaskInlinePredKind,
    taskInlinePredLagHours, setTaskInlinePredLagHours,
    taskInlinePredLagMode, setTaskInlinePredLagMode,
    depModal, setDepModal,
    newDepPred, setNewDepPred, newDepSucc, setNewDepSucc,
    newDepKind, setNewDepKind, newDepLagHours, setNewDepLagHours, newDepLagMode, setNewDepLagMode,
    editingDepIndex, setEditingDepIndex,
    editDepKind, setEditDepKind, editDepLagHours, setEditDepLagHours, editDepLagMode, setEditDepLagMode,
    // Scenario simulation
    simTaskChoice, setSimTaskChoice, simDelayDays, setSimDelayDays,
    simResult, setSimResult, simError, setSimError, simBusy, setSimBusy,
    // Team
    selectedAssigneeId, setSelectedAssigneeId,
    teamMemberSearch, setTeamMemberSearch,
    inlineNewSkillName, setInlineNewSkillName,
    inlineNewSkillLevel, setInlineNewSkillLevel,
    addPerson,
  } = useApp();

  const zone = draft?.timezone || saved?.project.timezone || "UTC";
  const date = (iso: string) => new Date(iso).toLocaleString("ru-RU", {timeZone: zone, day: "numeric", month: "short", hour: "2-digit", minute: "2-digit"});
  const shortDate = (iso: string) => new Date(iso).toLocaleDateString("ru-RU", {timeZone: zone, day: "numeric", month: "short"});

  // Local-only state (not shared across features)
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

  const [jsonInput, setJsonInput] = useState("");
  const [jsonImportError, setJsonImportError] = useState("");
  const [csvInput, setCsvInput] = useState("");
  const [newProjName, setNewProjName] = useState("Новый проект");
  const [newProjTz, setNewProjTz] = useState("Asia/Yekaterinburg");
  const [newProjStart, setNewProjStart] = useState(() => new Date(Math.ceil(Date.now() / 60000) * 60000).toISOString());
  const [newProjDeadline, setNewProjDeadline] = useState(() => new Date(Math.ceil(Date.now() / 60000) * 60000 + 14 * 86400000).toISOString());
  const [aiText, setAiText] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [timelineMode, setTimelineMode] = useState<"timeline" | "list">("timeline");
  const [dependencyVisible, setDependencyVisible] = useState(true);

  // accept/change wrappers that also reset the AI audit text
  const accept = (result: Result) => { acceptFromCtx(result); setAiText(""); };
  const change = (p: Project) => { changeFromCtx(p); setAiText(""); };

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

  // run, list, lastUpdated, accept, change now come from AppContext

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
          clearProject();
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

  const view = preview || saved;

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
            : "var(--brand)",
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
    return <AuthForm />;
  }


  return (
    <MantineProvider forceColorScheme={colorScheme} theme={actionTheme}>
      <div className="app-shell">
        {/* Designer Sidebar */}
        <SideForm onScrollTo={scrollToSection} />

        {/* Designer Main Content */}
        <main className="main-content">
          <TopBar />

          <div className="content-wrap" id="overview">
            {!draft && <Card withBorder><Stack><Title order={3}>Нет выбранного проекта</Title><Text>Создайте проект, откройте существующий или загрузите демо.</Text><Group><Button onClick={() => setProjectManageModal(true)}>Управление проектами</Button><Button variant="light" onClick={handleLoadDemoProject}>Загрузить Демо-проект</Button></Group></Stack></Card>}
            <DashboardHeader />

            {error && (
              <div className="api-note">
                <Zap size={14} /> {error}
              </div>
            )}

            {/* Metrics Grid */}
            <MetricsGrid />

            <DraftBanner />

            {/* Views Mode Rendering */}
            {activeView === "dashboard" && draft && view && (
              <>
                {/* Dashboard Grid Layout */}
                <section className="dashboard-grid">
                  {/* Timeline Main Panel with Baseline Reference Support */}
                  <TimelinePanel />

                  {/* Side Column Widgets */}
                  <aside className="side-column">
                    <AttentionPanel />
                    <DecisionPanel />
                  </aside>
                </section>

                {/* Bottom Grid Layout */}
                <section className="bottom-grid">
                  <HistoryPanel />

                  <EnginePanel />
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
                <Card withBorder p="xs" style={{ background: "rgba(210, 10, 46, 0.04)" }}>
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
                  <Card key={p.id} withBorder p="xs" style={{ background: isCurrent ? "rgba(210, 10, 46, 0.07)" : undefined }}>
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
                  <Card withBorder p="xs" radius="sm" style={{ background: "rgba(210, 10, 46, 0.03)" }}>
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

                <Card withBorder p="sm" style={{ background: "rgba(210, 10, 46, 0.04)" }}>
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
          title="Справка и возможности Актион"
          size="lg"
        >
          <Stack gap="md">
            <Card withBorder p="sm" style={{ background: "rgba(210, 10, 46, 0.04)" }}>
              <Group gap="xs" mb={4}>
                <Target size={16} color="#e57470" />
                <Text fw={700} size="sm">Метод критического пути (CPM) и Базовый план</Text>
              </Group>
              <Text size="xs" c="dimmed">
                Актион автоматически рассчитывает самый длинный путь технологических зависимостей. Задачи с нулевым резервом времени (резерв = 0 ч) отмечены красной рамкой. Любая задержка на критическом пути сдвигает срок сдачи всего проекта.
              </Text>
            </Card>

            <Card withBorder p="sm">
              <Group gap="xs" mb={4}>
                <GitBranch size={16} color="var(--brand)" />
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
    <AppProvider>
      <App />
    </AppProvider>
  </React.StrictMode>,
);

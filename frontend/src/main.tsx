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
import { GraphView } from "./feature/GraphView/GraphView";
import { TasksTableView } from "./feature/TasksTableView/TasksTableView";
import { TeamView } from "./feature/TeamView/TeamView";
import { LinksView } from "./feature/LinksView/LinksView";
import { AiView } from "./feature/AiView/AiView";
import { TaskDrawer } from "./feature/TaskDrawer/TaskDrawer";
import { SettingsDrawer } from "./feature/SettingsDrawer/SettingsDrawer";

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

            <GraphView />

            <TasksTableView />

            <TeamView />

            <LinksView />

            <AiView />
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

      <TaskDrawer />

      <SettingsDrawer />

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

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";
import { api } from "../api";
import type { Person, Project, Result } from "../types";
import { defaultCalendar } from "../types";

type View = "dashboard" | "graph" | "tasks_table" | "team" | "links" | "ai";

interface AppContextValue {
  // Auth
  logged: boolean;
  busy: boolean;
  error: string;
  login: (password: string) => Promise<boolean>;
  logout: () => Promise<void>;

  // Theme
  colorScheme: "dark" | "light";
  toggleTheme: (theme: "dark" | "light") => void;

  // Projects
  projects: Array<{ id: string; name: string }>;
  saved: Result | null;
  draft: Project | null;
  preview: Result | null;
  list: () => Promise<Array<{ id: string; name: string }>>;
  accept: (result: Result) => void;
  change: (p: Project) => void;
  run: <T>(fn: () => Promise<T>) => Promise<T | undefined>;

  // Navigation
  activeView: View;
  setActiveView: (view: View) => void;
  selectedAssigneeId: string | null;
  setSelectedAssigneeId: (id: string | null) => void;

  // UI
  toast: string;
  showNotification: (msg: string) => void;

  // Modals
  newProjectModal: boolean;
  setNewProjectModal: (v: boolean) => void;
  projectManageModal: boolean;
  setProjectManageModal: (v: boolean) => void;
  jsonImportModal: boolean;
  setJsonImportModal: (v: boolean) => void;
  importModal: boolean;
  setImportModal: (v: boolean) => void;
  helpModal: boolean;
  setHelpModal: (v: boolean) => void;
  executiveReportModal: boolean;
  setExecutiveReportModal: (v: boolean) => void;
  settings: boolean;
  setSettings: (v: boolean) => void;
  settingsTab: string | null;
  setSettingsTab: (v: string | null) => void;
  deleteConfirmProject: { id: string; name: string } | null;
  setDeleteConfirmProject: (v: { id: string; name: string } | null) => void;
  showScenarioModal: boolean;
  setShowScenarioModal: (v: boolean) => void;

  // Team
  addPerson: () => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  // Auth
  const [logged, setLogged] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Theme
  const [colorScheme, setColorScheme] = useState<"dark" | "light">(() => {
    const savedTheme = localStorage.getItem("critix_theme");
    return savedTheme === "light" || savedTheme === "dark" ? savedTheme : "light";
  });

  // Projects
  const [projects, setProjects] = useState<Array<{ id: string; name: string }>>([]);
  const [saved, setSaved] = useState<Result | null>(null);
  const [draft, setDraft] = useState<Project | null>(null);
  const [preview, setPreview] = useState<Result | null>(null);

  // Navigation
  const [activeView, setActiveView] = useState<View>("dashboard");
  const [selectedAssigneeId, setSelectedAssigneeId] = useState<string | null>(null);

  // UI
  const [toast, setToast] = useState("");

  // Modals
  const [newProjectModal, setNewProjectModal] = useState(false);
  const [projectManageModal, setProjectManageModal] = useState(false);
  const [jsonImportModal, setJsonImportModal] = useState(false);
  const [importModal, setImportModal] = useState(false);
  const [helpModal, setHelpModal] = useState(false);
  const [executiveReportModal, setExecutiveReportModal] = useState(false);
  const [settings, setSettings] = useState(false);
  const [settingsTab, setSettingsTab] = useState<string | null>("project");
  const [deleteConfirmProject, setDeleteConfirmProject] = useState<{ id: string; name: string } | null>(null);
  const [showScenarioModal, setShowScenarioModal] = useState(false);

  // Theme effect
  useEffect(() => {
    document.documentElement.setAttribute("data-mantine-color-scheme", colorScheme);
  }, [colorScheme]);

  // Toast effect
  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(""), 2600);
    return () => clearTimeout(timer);
  }, [toast]);

  const showNotification = useCallback((msg: string) => setToast(msg), []);

  const toggleTheme = useCallback((theme: "dark" | "light") => {
    setColorScheme(theme);
    localStorage.setItem("critix_theme", theme);
    document.documentElement.setAttribute("data-mantine-color-scheme", theme);
  }, []);

  const run = useCallback(async <T,>(fn: () => Promise<T>): Promise<T | undefined> => {
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
  }, []);

  const list = useCallback(async () => {
    const data = await api<Array<{ id: string; name: string }>>("/projects");
    setProjects(data);
    return data;
  }, []);

  const accept = useCallback((result: Result) => {
    setSaved(result);
    setDraft(structuredClone(result.project));
    setPreview(null);
  }, []);

  const change = useCallback((p: Project) => {
    setDraft(p);
    setPreview(null);
  }, []);

  const login = useCallback(async (password: string) => {
    setBusy(true);
    setError("");
    try {
      await api("/login", "POST", { password });
      setLogged(true);
      return true;
    } catch (e: any) {
      setError(e.message || "Ошибка входа");
      return false;
    } finally {
      setBusy(false);
    }
  }, []);

  const logout = useCallback(async () => {
    await api("/logout", "POST");
    setLogged(false);
    setSaved(null);
    setDraft(null);
  }, []);

  const addPerson = useCallback(() => {
    if (!draft) return;
    const newId = crypto.randomUUID();
    const newPerson: Person = {
      id: newId,
      name: `Сотрудник ${draft.assignees.length + 1}`,
      role: "Разработчик",
      skills: [],
      calendar: defaultCalendar(),
    };
    setDraft({ ...draft, assignees: [...draft.assignees, newPerson] });
    setSelectedAssigneeId(newId);
    setActiveView("team");
  }, [draft]);

  const value: AppContextValue = {
    logged, busy, error, login, logout,
    colorScheme, toggleTheme,
    projects, saved, draft, preview, list, accept, change, run,
    activeView, setActiveView, selectedAssigneeId, setSelectedAssigneeId,
    toast, showNotification,
    newProjectModal, setNewProjectModal,
    projectManageModal, setProjectManageModal,
    jsonImportModal, setJsonImportModal,
    importModal, setImportModal,
    helpModal, setHelpModal,
    executiveReportModal, setExecutiveReportModal,
    settings, setSettings, settingsTab, setSettingsTab,
    deleteConfirmProject, setDeleteConfirmProject,
    showScenarioModal, setShowScenarioModal,
    addPerson,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error("useApp должен использоваться внутри AppProvider");
  return context;
}
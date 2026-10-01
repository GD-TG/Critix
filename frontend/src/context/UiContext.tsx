import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useProjects } from "@/context/ProjectContext";
import { rescheduleOverdueTasks } from "@/taskEditing";

export type View = "dashboard" | "timeline" | "graph" | "tasks_table" | "team" | "links" | "ai";

interface UiContextValue {
  colorScheme: "dark" | "light";
  toggleTheme: (theme: "dark" | "light") => void;

  toast: string;
  showNotification: (msg: string) => void;

  activeView: View;
  setActiveView: (view: View) => void;

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

  decisionLabOpened: boolean;
  setDecisionLabOpened: (v: boolean) => void;
  decisionLabTaskId: string | null;
  setDecisionLabTaskId: (id: string | null) => void;
  openDecisionLabForTask: (taskId?: string) => void;

  eventDialogOpened: boolean;
  setEventDialogOpened: (v: boolean) => void;
  compareVariantsOpened: boolean;
  setCompareVariantsOpened: (v: boolean) => void;
  briefDialogOpened: boolean;
  setBriefDialogOpened: (v: boolean) => void;

  deliveriesModalOpened: boolean;
  setDeliveriesModalOpened: (v: boolean) => void;

  mobileNavOpened: boolean;
  setMobileNavOpened: (v: boolean) => void;

  rescheduleOverdue: () => void;
}

const UiContext = createContext<UiContextValue | null>(null);

export function UiProvider({ children }: { children: ReactNode }) {
  const { draft, saved, preview, change } = useProjects();
  const [colorScheme, setColorScheme] = useState<"dark" | "light">(() => {
    const savedTheme = localStorage.getItem("critix_theme");
    return savedTheme === "light" || savedTheme === "dark" ? savedTheme : "light";
  });
  const [toast, setToast] = useState("");
  const [activeView, setActiveView] = useState<View>("dashboard");

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
  const [decisionLabOpened, setDecisionLabOpened] = useState(false);
  const [decisionLabTaskId, setDecisionLabTaskId] = useState<string | null>(null);
  const [eventDialogOpened, setEventDialogOpened] = useState(false);
  const [compareVariantsOpened, setCompareVariantsOpened] = useState(false);
  const [briefDialogOpened, setBriefDialogOpened] = useState(false);
  const [deliveriesModalOpened, setDeliveriesModalOpened] = useState(false);
  const [mobileNavOpened, setMobileNavOpened] = useState(false);

  const openDecisionLabForTask = useCallback((taskId?: string) => {
    setDecisionLabTaskId(taskId || null);
    setDecisionLabOpened(true);
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-mantine-color-scheme", colorScheme);
  }, [colorScheme]);

  const toastTimerRef = useRef<any>(null);

  const showNotification = useCallback((msg: string) => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }
    setToast("");
    requestAnimationFrame(() => {
      setToast(msg);
      toastTimerRef.current = setTimeout(() => {
        setToast("");
        toastTimerRef.current = null;
      }, 2600);
    });
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  const rescheduleOverdue = useCallback(() => {
    const baseResult = saved || preview;
    if (!draft || !baseResult) return;
    const updatedTasks = rescheduleOverdueTasks(draft.tasks, baseResult.analysis, new Date());
    change({ ...draft, tasks: updatedTasks });
    showNotification("Ограничения начала обновлены в черновике. Проверьте последствия.");
  }, [draft, saved, preview, change, showNotification]);

  const toggleTheme = useCallback((theme: "dark" | "light") => {
    setColorScheme(theme);
    localStorage.setItem("critix_theme", theme);
    document.documentElement.setAttribute("data-mantine-color-scheme", theme);
  }, []);

  const value: UiContextValue = {
    colorScheme, toggleTheme,
    toast, showNotification,
    activeView, setActiveView,
    newProjectModal, setNewProjectModal,
    projectManageModal, setProjectManageModal,
    jsonImportModal, setJsonImportModal,
    importModal, setImportModal,
    helpModal, setHelpModal,
    executiveReportModal, setExecutiveReportModal,
    settings, setSettings, settingsTab, setSettingsTab,
    deleteConfirmProject, setDeleteConfirmProject,
    showScenarioModal, setShowScenarioModal,
    decisionLabOpened, setDecisionLabOpened,
    decisionLabTaskId, setDecisionLabTaskId,
    openDecisionLabForTask,
    eventDialogOpened, setEventDialogOpened,
    compareVariantsOpened, setCompareVariantsOpened,
    briefDialogOpened, setBriefDialogOpened,
    deliveriesModalOpened, setDeliveriesModalOpened,
    mobileNavOpened, setMobileNavOpened,
    rescheduleOverdue,
  };

  return <UiContext.Provider value={value}>{children}</UiContext.Provider>;
}

export function useUi() {
  const context = useContext(UiContext);
  if (!context) throw new Error("useUi должен использоваться внутри UiProvider");
  return context;
}

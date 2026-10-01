import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useRef,
  type ReactNode,
} from "react";
import { api } from "@/api";
import { copy } from "@/shared";
import type { Analysis, Project, Result } from "@/types";
import { useAuth } from "@/context/AuthContext";
import { readBackup, writeBackup, clearBackup } from "@/draftBackup";

interface ProjectContextValue {
  projects: Array<{ id: string; name: string }>;
  saved: Result | null;
  draft: Project | null;
  preview: Result | null;
  view: Result | null;
  rows: Map<string, Analysis["tasks"][number]>;
  affected: Set<string>;
  overloadedAssigneeIds: Set<string>;
  lastUpdated: Date;
  dirty: boolean;
  aiText: string;
  setAiText: (v: string) => void;
  aiReport: { available: boolean; source: "llm" | "engine"; text: string } | null;
  setAiReport: (v: { available: boolean; source: "llm" | "engine"; text: string } | null) => void;
  list: () => Promise<Array<{ id: string; name: string }>>;
  accept: (result: Result, forceReset?: boolean) => void;
  change: (p: Project) => void;
  run: <T>(fn: () => Promise<T>) => Promise<T | undefined>;
  clearProject: () => void;
  setSaved: (v: Result | null) => void;
  setDraft: (v: Project | null) => void;
  setPreview: (v: Result | null) => void;
}

const ProjectContext = createContext<ProjectContextValue | null>(null);

export function ProjectProvider({ children }: { children: ReactNode }) {
  const { busy, setBusy, setError, logged } = useAuth();

  const [projects, setProjects] = useState<Array<{ id: string; name: string }>>([]);
  const [saved, setSaved] = useState<Result | null>(null);
  const [draft, setDraft] = useState<Project | null>(null);
  const [preview, setPreview] = useState<Result | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [aiText, setAiText] = useState("");
  const [aiReport, setAiReport] = useState<{ available: boolean; source: "llm" | "engine"; text: string } | null>(null);

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
  }, [setBusy, setError]);

  const sessionGen = useRef(0);

  const list = useCallback(async () => {
    const currentSession = sessionGen.current;
    const data = await api<Array<{ id: string; name: string }>>("/projects");
    if (sessionGen.current === currentSession && logged) {
      setProjects(data);
    }
    return data;
  }, [logged]);

  const accept = useCallback((result: Result, forceReset?: boolean) => {
    setSaved(result);
    let initialDraft = copy(result.project);
    if (forceReset) {
      clearBackup(localStorage, result.id);
    } else {
      try {
        const backup = readBackup(localStorage, result.id);
        if (
          backup &&
          JSON.stringify(backup.draft) !== JSON.stringify(result.project)
        ) {
          // User has unsaved edits in backup; preserve them so work is never lost.
          // Even if server baseVersion changed, user can review diff or cancel.
          initialDraft = backup.draft;
        } else {
          clearBackup(localStorage, result.id);
        }
      } catch {
        clearBackup(localStorage, result.id);
      }
    }
    setDraft(initialDraft);
    setPreview(null);
    setAiText("");
    setAiReport(null);
    setLastUpdated(new Date());
  }, []);

  const change = useCallback((p: Project) => {
    setDraft(p);
    setPreview(null);
    setAiText("");
    setAiReport(null);
    setLastUpdated(new Date());
  }, []);

  const clearProject = useCallback(() => {
    setSaved(null);
    setDraft(null);
    setPreview(null);
    setAiText("");
    setAiReport(null);
  }, []);

  // Synchronize projects with auth session
  useEffect(() => {
    sessionGen.current += 1;
    const currentGen = sessionGen.current;

    if (!logged) {
      setProjects([]);
      setSaved(null);
      setDraft(null);
      setPreview(null);
      setAiText("");
      setAiReport(null);
      return;
    }

    void run(async () => {
      try {
        const data = await list();
        if (sessionGen.current !== currentGen) return;
        if (data.length > 0) {
          const res = await api<Result>(`/projects/${data[0].id}`);
          if (sessionGen.current === currentGen) {
            accept(res);
          }
        }
      } catch {
        // Ignore aborted or failed fetch on session teardown
      }
    });
  }, [logged, list, accept, run]);

  const dirty = Boolean(
    saved && draft && JSON.stringify(saved.project) !== JSON.stringify(draft),
  );

  // Auto-backup draft to localStorage when modified
  useEffect(() => {
    if (dirty && saved?.id && draft) {
      try {
        writeBackup(localStorage, saved.id, saved.version, draft);
      } catch {
        // Ignore storage errors
      }
    }
  }, [dirty, saved?.id, saved?.version, draft]);

  // Warn user before closing tab if there are unsaved changes
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "В проекте есть несохранённые изменения. Вы уверены, что хотите покинуть страницу?";
      return e.returnValue;
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  const view = preview || saved;
  const rows = useMemo(
    () => new Map((view?.analysis.tasks || []).map((r) => [r.id, r])),
    [view],
  );
  const affected = useMemo(
    () => new Set(preview?.changes?.changed_task_ids || []),
    [preview],
  );
  const overloadedAssigneeIds = useMemo(
    () => new Set(view?.analysis.overloads.map((o) => o.assignee_id) || []),
    [view],
  );

  const value: ProjectContextValue = {
    projects, saved, draft, preview, view, rows, affected, overloadedAssigneeIds,
    lastUpdated, dirty,
    aiText, setAiText,
    aiReport, setAiReport,
    list, accept, change, run, clearProject,
    setSaved, setDraft, setPreview,
  };

  void busy;

  return <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>;
}

export function useProjects() {
  const context = useContext(ProjectContext);
  if (!context) throw new Error("useProjects должен использоваться внутри ProjectProvider");
  return context;
}

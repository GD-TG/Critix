import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { api } from "@/api";
import { copy } from "@/shared";
import type { Analysis, Project, Result } from "@/types";
import { useAuth } from "@/context/AuthContext";

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
  accept: (result: Result) => void;
  change: (p: Project) => void;
  run: <T>(fn: () => Promise<T>) => Promise<T | undefined>;
  clearProject: () => void;
  setSaved: (v: Result | null) => void;
  setDraft: (v: Project | null) => void;
  setPreview: (v: Result | null) => void;
}

const ProjectContext = createContext<ProjectContextValue | null>(null);

export function ProjectProvider({ children }: { children: ReactNode }) {
  const { busy, setBusy, setError, logged, setLogged } = useAuth();

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

  const list = useCallback(async () => {
    const data = await api<Array<{ id: string; name: string }>>("/projects");
    setProjects(data);
    return data;
  }, []);

  const accept = useCallback((result: Result) => {
    setSaved(result);
    setDraft(copy(result.project));
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

  // Clear the working project on logout
  useEffect(() => {
    if (!logged) {
      setSaved(null);
      setDraft(null);
      setPreview(null);
      setAiText("");
      setAiReport(null);
    }
  }, [logged]);

  // Initial bootstrap: load project list and open the first project
  useEffect(() => {
    void run(async () => {
      const data = await list();
      if (data.length > 0) {
        accept(await api<Result>(`/projects/${data[0].id}`));
      }
      setLogged(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dirty = Boolean(
    saved && draft && JSON.stringify(saved.project) !== JSON.stringify(draft),
  );

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

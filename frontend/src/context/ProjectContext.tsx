import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { api } from "@/api";
import { copy } from "@/shared";
import type { Project, Result } from "@/types";
import { useAuth } from "@/context/AuthContext";

interface ProjectContextValue {
  projects: Array<{ id: string; name: string }>;
  saved: Result | null;
  draft: Project | null;
  preview: Result | null;
  lastUpdated: Date;
  dirty: boolean;
  list: () => Promise<Array<{ id: string; name: string }>>;
  accept: (result: Result) => void;
  change: (p: Project) => void;
  run: <T>(fn: () => Promise<T>) => Promise<T | undefined>;
  clearProject: () => void;
}

const ProjectContext = createContext<ProjectContextValue | null>(null);

export function ProjectProvider({ children }: { children: ReactNode }) {
  const { busy, setBusy, setError, logged, setLogged } = useAuth();

  const [projects, setProjects] = useState<Array<{ id: string; name: string }>>([]);
  const [saved, setSaved] = useState<Result | null>(null);
  const [draft, setDraft] = useState<Project | null>(null);
  const [preview, setPreview] = useState<Result | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

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
    setLastUpdated(new Date());
  }, []);

  const change = useCallback((p: Project) => {
    setDraft(p);
    setPreview(null);
    setLastUpdated(new Date());
  }, []);

  const clearProject = useCallback(() => {
    setSaved(null);
    setDraft(null);
    setPreview(null);
  }, []);

  // Clear the working project on logout
  useEffect(() => {
    if (!logged) {
      setSaved(null);
      setDraft(null);
      setPreview(null);
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

  const value: ProjectContextValue = {
    projects, saved, draft, preview, lastUpdated, dirty,
    list, accept, change, run, clearProject,
  };

  void busy;

  return <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>;
}

export function useProjects() {
  const context = useContext(ProjectContext);
  if (!context) throw new Error("useProjects должен использоваться внутри ProjectProvider");
  return context;
}

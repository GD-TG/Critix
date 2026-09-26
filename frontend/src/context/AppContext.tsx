import { createContext, useContext, type ReactNode } from "react";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { ProjectProvider, useProjects } from "@/context/ProjectContext";
import { UiProvider, useUi, type View } from "@/context/UiContext";
import { TaskProvider, useTaskState } from "@/context/TaskContext";
import { TeamProvider, useTeam } from "@/context/TeamContext";

export type { View };

interface AppContextValue
  extends ReturnType<typeof useAuth>,
    ReturnType<typeof useProjects>,
    ReturnType<typeof useUi>,
    ReturnType<typeof useTaskState>,
    ReturnType<typeof useTeam> {}

const AppContext = createContext<AppContextValue | null>(null);

/**
 * AppProvider composes the domain contexts in dependency order:
 * Auth -> Project -> Ui -> Task -> Team.
 * Feature hooks should prefer the dedicated useAuth/useProjects/useUi/
 * useTaskState/useTeam hooks; useApp() remains as a backwards-compatible facade.
 */
export function AppProvider({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <ProjectProvider>
        <UiProvider>
          <TaskProvider>
            <TeamProvider>
              <AppContextBridge>{children}</AppContextBridge>
            </TeamProvider>
          </TaskProvider>
        </UiProvider>
      </ProjectProvider>
    </AuthProvider>
  );
}

function AppContextBridge({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const projects = useProjects();
  const ui = useUi();
  const task = useTaskState();
  const team = useTeam();

  const value: AppContextValue = {
    ...auth,
    ...projects,
    ...ui,
    ...task,
    ...team,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error("useApp должен использоваться внутри AppProvider");
  return context;
}

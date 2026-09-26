import type { Person, Project, Result, Skill } from "@/types";

type UseSidebarOptions = {
  draft: Project | null;
  saved: Result | null;
  view: Result | null;
  colorScheme: "dark" | "light";
  onToggleTheme: (theme: "dark" | "light") => void;
  onOpenProjectManage: () => void;
  onOpenSettings: () => void;
  onOpenTask: (task: Project["tasks"][number]) => void;
  onChangeProject: (project: Project) => void;
  onSelectAssignee: (id: string) => void;
  onGoTeam: () => void;
  onGoAi: () => void;
  onGoDashboard: () => void;
  onGoTasks: () => void;
  onGoGraph: () => void;
  onGoLinks: () => void;
  onLogout: () => void;
  onScrollTo: (id: string) => void;
};

export function useSidebar({
  draft,
  saved,
  view,
  colorScheme,
  onToggleTheme,
  onOpenProjectManage,
  onOpenSettings,
  onOpenTask,
  onChangeProject,
  onSelectAssignee,
  onGoTeam,
  onGoAi,
  onGoDashboard,
  onGoTasks,
  onGoGraph,
  onGoLinks,
  onLogout,
  onScrollTo,
}: UseSidebarOptions) {
  const totalTasksCount = draft?.tasks.length || 0;

  const overdueTasks = (view?.analysis.tasks || []).filter((r) =>
    r.risk_flags.includes("overdue"),
  );

  const overloadedAssigneeIds = new Set(
    view?.analysis.overloads.map((o) => o.assignee_id) || [],
  );

  const addPerson = () => {
    if (!draft) return;
    const newId = crypto.randomUUID();
    const newPerson: Person = {
      id: newId,
      name: `Сотрудник ${draft.assignees.length + 1}`,
      role: "Разработчик",
      skills: [],
      calendar: draft.calendar, // или defaultCalendar(), если он доступен
    };
    onChangeProject({
      ...draft,
      assignees: [...draft.assignees, newPerson],
    });
    onSelectAssignee(newId);
    onGoTeam();
  };

  const handleNav = (view: "dashboard" | "tasks" | "graph" | "team" | "links" | "ai") => {
    switch (view) {
      case "dashboard":
        onGoDashboard();
        break;
      case "tasks":
        onGoTasks();
        break;
      case "graph":
        onGoGraph();
        break;
      case "team":
        onGoTeam();
        break;
      case "links":
        onGoLinks();
        break;
      case "ai":
        onGoAi();
        break;
    }
  };

  return {
    draft,
    saved,
    view,
    colorScheme,
    totalTasksCount,
    overdueTasks,
    overloadedAssigneeIds,
    onToggleTheme,
    onOpenProjectManage,
    onOpenSettings,
    onOpenTask,
    addPerson,
    handleNav,
    onSelectAssignee,
    onLogout,
    onScrollTo,
  };
}
import { useApp } from "@/context/AppContext";

export function useSideForm(onScrollTo: (id: string) => void) {
  const {
    draft, saved, colorScheme, toggleTheme,
    activeView, setActiveView,
    setProjectManageModal, setSettings,
    setSelectedAssigneeId, addPerson, logout,
    preview,
  } = useApp();

  const view = preview || saved;
  const totalTasksCount = draft?.tasks.length || 0;
  const overdueTasks = (view?.analysis.tasks || []).filter((r) => r.risk_flags.includes("overdue"));
  const overloadedAssigneeIds = new Set(view?.analysis.overloads.map((o) => o.assignee_id) || []);

  return {
    draft,
    colorScheme,
    toggleTheme,
    activeView,
    setActiveView,
    setProjectManageModal,
    setSettings,
    setSelectedAssigneeId,
    addPerson,
    logout,
    totalTasksCount,
    overdueTasks,
    overloadedAssigneeIds,
    onScrollTo,
  };
}

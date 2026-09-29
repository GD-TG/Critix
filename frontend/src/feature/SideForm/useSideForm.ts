import { useApp } from "@/context/AppContext";

export function useSideForm(onScrollTo: (id: string) => void) {
  const {
    draft, saved, colorScheme, toggleTheme,
    activeView, setActiveView,
    setProjectManageModal, setSettings,
    setSelectedAssigneeId, addPerson, logout,
    preview,
    setMobileNavOpened,
  } = useApp();

  const view = preview || saved;
  const totalTasksCount = draft?.tasks.length || 0;
  const overdueTasks = (view?.analysis.tasks || []).filter((r) => r.risk_flags.includes("overdue"));
  const overloadedAssigneeIds = new Set(view?.analysis.overloads.map((o) => o.assignee_id) || []);

  const handleScrollTo = (id: string) => {
    setMobileNavOpened(false);
    onScrollTo(id);
  };

  const handleSelectView = (v: typeof activeView) => {
    setMobileNavOpened(false);
    setActiveView(v);
  };

  const handleOpenProjectManage = (open: boolean = true) => {
    setMobileNavOpened(false);
    setProjectManageModal(open);
  };

  const handleOpenSettings = (open: boolean = true) => {
    setMobileNavOpened(false);
    setSettings(open);
  };

  const handleSelectAssignee = (id: string) => {
    setMobileNavOpened(false);
    setSelectedAssigneeId(id);
    setActiveView("team");
  };

  return {
    draft,
    colorScheme,
    toggleTheme,
    activeView,
    setActiveView: handleSelectView,
    setProjectManageModal: handleOpenProjectManage,
    setSettings: handleOpenSettings,
    setSelectedAssigneeId,
    handleSelectAssignee,
    addPerson,
    logout,
    totalTasksCount,
    overdueTasks,
    overloadedAssigneeIds,
    onScrollTo: handleScrollTo,
  };
}

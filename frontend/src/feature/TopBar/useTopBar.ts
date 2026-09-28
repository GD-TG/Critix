import { useApp } from "@/context/AppContext";
import { copy, formatCalendarDuration, formatMinutes, formatShortDate, getOverdueTasks, getOverloadedAssigneeIds, getZone } from "@/shared";

export function useTopBar() {
  const {
    draft, saved, preview,
    setTask,
    setActiveView,
    setExecutiveReportModal,
    setHelpModal,
    setProjectManageModal,
    rescheduleOverdue,
  } = useApp();

  const view = preview || saved;
  const zone = getZone(draft, saved);
  const shortDate = (iso: string) => formatShortDate(iso, zone);
  const overdueTasks = getOverdueTasks(view);
  const overloadedAssigneeIds = getOverloadedAssigneeIds(view);

  return {
    draft,
    view,
    overdueTasks,
    overloadedAssigneeIds,
    shortDate,
    formatMinutes,
    formatCalendarDuration,
    rescheduleOverdue,
    setTask,
    copy,
    setActiveView,
    setExecutiveReportModal,
    setHelpModal,
    setProjectManageModal,
  };
}

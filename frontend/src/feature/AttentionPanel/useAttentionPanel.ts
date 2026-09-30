import { useApp } from "@/context/AppContext";
import {
  copy,
  formatShortDate,
  getOverdueTasks,
  getOverloadedAssigneeIds,
  getZone,
} from "@/shared";

export function useAttentionPanel() {
  const { draft, saved, preview, setTask, setActiveView, setShowScenarioModal, openDecisionLabForTask } = useApp();

  const view = preview || saved;
  const zone = getZone(draft, saved);
  const shortDate = (iso: string) => formatShortDate(iso, zone);

  const overdueTasks = getOverdueTasks(view);
  const overloadedAssigneeIds = getOverloadedAssigneeIds(view);

  return {
    draft,
    overdueTasks,
    overloadedAssigneeIds,
    shortDate,
    setTask,
    copy,
    setActiveView,
    setShowScenarioModal,
    openDecisionLabForTask,
  };
}

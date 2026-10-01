import { useApp } from "@/context/AppContext";
import { api } from "@/api";
import {
  copy,
  formatShortDate,
  getOverdueTasks,
  getOverloadedAssigneeIds,
  getZone,
} from "@/shared";

export function useAttentionPanel() {
  const { draft, saved, preview, setTask, setActiveView, setShowScenarioModal, openDecisionLabForTask, run, change, showNotification } = useApp();

  const view = preview || saved;
  const zone = getZone(draft, saved);
  const shortDate = (iso: string) => formatShortDate(iso, zone);

  const overdueTasks = getOverdueTasks(view);
  const overloadedAssigneeIds = getOverloadedAssigneeIds(view);

  const handleLevelResources = async () => {
    if (!saved || !draft) return;
    try {
      const res = await run(() =>
        api<{ project: any; leveling?: { message?: string } }>(`/projects/${saved.id}/level`, "POST", {
          version: saved.version,
          project: draft,
        })
      );
      if (res && res.project) {
        change(res.project);
        showNotification(
          res.leveling?.message || "Ресурсное выравнивание выполнено и перенесено в черновик!"
        );
      }
    } catch (err: any) {
      showNotification(`Ошибка выравнивания: ${err?.message || err}`);
    }
  };

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
    handleLevelResources,
  };
}

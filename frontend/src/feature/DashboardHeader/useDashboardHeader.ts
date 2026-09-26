import { useApp } from "@/context/AppContext";
import { exportProjectToJson, exportTasksToCsv, getZone } from "@/shared";
import { defaultTask, type Project } from "@/types";

export function useDashboardHeader() {
  const {
    draft, saved, preview, lastUpdated, dirty, change, showNotification,
    setTask,
    setSimResult,
    setShowScenarioModal,
    setExecutiveReportModal,
    setJsonImportModal,
    setImportModal,
  } = useApp();

  const view = preview || saved;
  const zone = getZone(draft, saved);

  const handleSaveAsBaseline = () => {
    if (!draft || !view) return;
    const taskMap: Record<string, { start: string; finish: string }> = {};
    view.analysis.tasks.forEach((t) => {
      taskMap[t.id] = { start: t.start, finish: t.finish };
    });
    const updated: Project = {
      ...draft,
      baseline: {
        saved_at: new Date().toISOString(),
        finish: view.analysis.finish,
        tasks: taskMap,
      },
    };
    change(updated);
    showNotification("Текущий график зафиксирован как Базовый план (Baseline)");
  };

  return {
    draft,
    view,
    lastUpdated,
    zone,
    dirty,
    preview,
    handleSaveAsBaseline,
    exportProjectToJson,
    exportTasksToCsv,
    defaultTask,
    setTask,
    setSimResult,
    setShowScenarioModal,
    setExecutiveReportModal,
    setJsonImportModal,
    setImportModal,
  };
}

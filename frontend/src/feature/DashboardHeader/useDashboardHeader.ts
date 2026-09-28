import { useApp } from "@/context/AppContext";
import { useRef } from "react";
import { useRequestGate } from "@/useRequestGate";
import { api } from "@/api";
import { exportProjectToJson, exportTasksToCsv, getZone } from "@/shared";
import { defaultTask, type Project, type Result } from "@/types";

export function useDashboardHeader() {
  const {
    draft,
    saved,
    preview,
    lastUpdated,
    dirty,
    change,
    showNotification,
    setError,
    setTask,
    setSimResult,
    setShowScenarioModal,
    setExecutiveReportModal,
    setJsonImportModal,
    setImportModal,
  } = useApp();

  const view = preview || saved;
  const zone = getZone(draft, saved);
  const gate = useRequestGate(saved?.id, saved?.version, draft);
  const pending = useRef(false);

  const handleSaveAsBaseline = async () => {
    if (!draft || !saved || pending.current) return;
    const isCurrent = gate.capture();
    pending.current = true;
    try {
      const calculated = await api<Result>(
        `/projects/${saved.id}/simulate`,
        "POST",
        {
          version: saved.version,
          project: draft,
        },
      );
      if (!isCurrent()) return;
      const taskMap: Record<string, { start: string; finish: string }> = {};
      calculated.analysis.tasks.forEach((t) => {
        taskMap[t.id] = { start: t.start, finish: t.finish };
      });
      const updated: Project = {
        ...draft,
        baseline: {
          saved_at: new Date().toISOString(),
          finish: calculated.analysis.finish,
          tasks: taskMap,
        },
      };
      change(updated);
      showNotification(
        "Базовый план рассчитан и добавлен в черновик. Примените изменения для сохранения.",
      );
    } catch (error) {
      if (isCurrent())
        setError(
          error instanceof Error
            ? error.message
            : "Не удалось рассчитать базовый план",
        );
    } finally {
      pending.current = false;
    }
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

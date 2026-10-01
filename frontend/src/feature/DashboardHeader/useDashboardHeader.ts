import { useApp } from "@/context/AppContext";
import { useRef } from "react";
import { useRequestGate } from "@/useRequestGate";
import { api } from "@/api";
import { exportProjectToJson, exportTasksToCsv, formatShortDate, getZone } from "@/shared";
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
    setEventDialogOpened,
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

  const baseFinish = saved?.analysis.finish;
  const currentFinish = view?.analysis.finish;
  const isExceeded = view?.analysis.deadline_exceeded;
  const delayMinutes = view?.analysis.delay_minutes || 0;
  const lateDays = Math.ceil(delayMinutes / 1440);

  const deadline = draft?.deadline;
  const currentBufferMinutes = (deadline && currentFinish)
    ? (new Date(deadline).getTime() - new Date(currentFinish).getTime()) / 60000
    : 0;
  const bufferDays = Math.round(Math.abs(currentBufferMinutes) / 1440);

  const criticalCount = view?.analysis.tasks.filter((t) => t.critical).length || 0;
  const overdueCount = view?.analysis.tasks.filter((t) => t.risk_flags?.includes("overdue")).length || 0;

  let health: "green" | "orange" | "red" = "green";
  let healthText = "В графике";

  if (isExceeded || lateDays > 0) {
    health = "red";
    healthText = `Срыв (+${lateDays} дн.)`;
  } else if (currentBufferMinutes < 1440 * 3 || overdueCount > 0) {
    health = "orange";
    healthText = "Нужно внимание";
  }

  const deltaMinutes = preview?.changes?.finish_delta_minutes || 0;
  const deltaDays = Math.round(deltaMinutes / 1440);

  const shortDate = (iso?: string) => (iso ? formatShortDate(iso, zone) : "—");

  let finishText = currentFinish ? shortDate(currentFinish) : "—";
  if (dirty && preview && deltaMinutes !== 0 && baseFinish) {
    const sign = deltaDays > 0 ? "+" : "";
    finishText = `${shortDate(baseFinish)} → ${shortDate(currentFinish)} (${sign}${deltaDays} дн.)`;
  }

  const bufferText = currentBufferMinutes >= 0 
    ? `Запас ${bufferDays} дн.` 
    : `Опоздание ${lateDays} дн.`;

  const deliveriesCount = draft?.deliveries?.length || 0;
  const hasDeliveries = deliveriesCount > 0;

  const { setDeliveriesModalOpened, openDecisionLabForTask } = useApp();

  return {
    draft,
    view,
    lastUpdated,
    zone,
    dirty,
    preview,
    health,
    healthText,
    finishText,
    bufferText,
    isExceeded,
    deadlineText: deadline ? shortDate(deadline) : "—",
    criticalCount,
    hasDeliveries,
    deliveriesCount,
    openDeliveriesModal: () => setDeliveriesModalOpened(true),
    openDecisionLab: () => openDecisionLabForTask(),
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
    setEventDialogOpened,
  };
}

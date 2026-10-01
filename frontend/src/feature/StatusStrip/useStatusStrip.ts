import { useMemo } from "react";
import { useApp } from "@/context/AppContext";
import { formatShortDate, getZone } from "@/shared";

export function useStatusStrip() {
  const { draft, saved, preview, view, dirty, setEventDialogOpened } = useApp();

  const zone = getZone(draft, saved);
  const shortDate = (iso?: string) => (iso ? formatShortDate(iso, zone) : "—");

  return useMemo(() => {
    if (!draft || !view) return null;

    const baseFinish = saved?.analysis.finish;
    const currentFinish = view.analysis.finish;
    const isExceeded = view.analysis.deadline_exceeded;
    const delayMinutes = view.analysis.delay_minutes || 0;
    const lateDays = Math.ceil(delayMinutes / 1440);

    const deadline = draft.deadline;
    const currentBufferMinutes = (new Date(deadline).getTime() - new Date(currentFinish).getTime()) / 60000;
    const bufferDays = Math.round(Math.abs(currentBufferMinutes) / 1440);

    const criticalCount = view.analysis.tasks.filter((t) => t.critical).length;
    const overdueCount = view.analysis.tasks.filter((t) => t.risk_flags?.includes("overdue")).length;

    let health: "green" | "orange" | "red" = "green";
    let healthText = "В графике";

    if (isExceeded || lateDays > 0) {
      health = "red";
      healthText = `Срыв срока (+${lateDays} дн.)`;
    } else if (currentBufferMinutes < 1440 * 3 || overdueCount > 0) {
      health = "orange";
      healthText = "Нужно внимание";
    }

    const deltaMinutes = preview?.changes?.finish_delta_minutes || 0;
    const deltaDays = Math.round(deltaMinutes / 1440);

    let finishText = `Финиш: ${shortDate(currentFinish)}`;
    if (dirty && preview && deltaMinutes !== 0 && baseFinish) {
      const sign = deltaDays > 0 ? "+" : "";
      finishText = `Финиш: ${shortDate(baseFinish)} → ${shortDate(currentFinish)} (${sign}${deltaDays} дн.)`;
    }

    const bufferText = currentBufferMinutes >= 0 
      ? `Запас: ${bufferDays} дн.` 
      : `Опоздание: ${lateDays} дн.`;

    const openEventDialog = () => setEventDialogOpened(true);

    return {
      health,
      healthText,
      finishText,
      bufferText,
      isExceeded,
      deadlineText: `Дедлайн: ${shortDate(deadline)}`,
      criticalCount,
      overdueCount,
      dirty,
      deltaDays,
      openEventDialog,
    };
  }, [draft, saved, preview, view, dirty, setEventDialogOpened]);
}

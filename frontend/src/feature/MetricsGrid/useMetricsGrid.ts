import { useMemo } from "react";
import { useApp } from "@/context/AppContext";
import { formatShortDate, getOverdueTasks, getZone } from "@/shared";

export function useMetricsGrid() {
  const { draft, saved, preview, rescheduleOverdue } = useApp();

  const view = preview || saved;
  const zone = getZone(draft, saved);
  const shortDate = (iso: string) => formatShortDate(iso, zone);

  const completedCount = draft?.tasks.filter((t) => t.status === "done").length || 0;
  const totalTasksCount = draft?.tasks.length || 0;
  const progressPercent = totalTasksCount ? Math.round((completedCount / totalTasksCount) * 100) : 0;

  const overdueTasks = getOverdueTasks(view);
  const baselineVarianceHours = view?.analysis.baseline_delta_minutes == null ? null : view.analysis.baseline_delta_minutes / 60;

  const daysRemaining = useMemo(() => {
    if (!view && !draft) return 0;
    const targetMs = view
      ? new Date(view.analysis.finish).getTime()
      : draft
      ? new Date(draft.deadline).getTime()
      : Date.now();
    const diff = targetMs - Date.now();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  }, [view?.analysis.finish, draft?.deadline]);

  return {
    draft,
    view,
    shortDate,
    completedCount,
    totalTasksCount,
    progressPercent,
    overdueTasks,
    baselineVarianceHours,
    daysRemaining,
    rescheduleOverdue,
  };
}

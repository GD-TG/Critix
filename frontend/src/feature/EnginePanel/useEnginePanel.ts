import { useApp } from "@/context/AppContext";
import { formatShortDate, getZone } from "@/shared";

export function useEnginePanel() {
  const { draft, saved, preview, openDecisionLabForTask, setSettingsTab, setSettings } = useApp();

  const view = preview || saved;
  const zone = getZone(draft, saved);
  const shortDate = (iso?: string) => (iso ? formatShortDate(iso, zone) : "—");

  const finishDate = view?.analysis.finish ? new Date(view.analysis.finish) : null;
  const deadlineDate = draft?.deadline ? new Date(draft.deadline) : null;

  let lateDays = 0;
  let bufferDays = 0;

  if (finishDate && deadlineDate) {
    const diffMs = finishDate.getTime() - deadlineDate.getTime();
    const diffDays = Math.round(diffMs / 86400000);
    if (diffDays > 0) {
      lateDays = diffDays;
    } else {
      bufferDays = Math.abs(diffDays);
    }
  }

  const criticalCount = view?.analysis.tasks.filter((t) => t.critical).length ?? 0;
  const nonCriticalCount = (draft?.tasks.length ?? 0) - criticalCount;

  const maxSlackMinutes = view?.analysis.tasks.reduce(
    (acc, t) => (t.slack_minutes !== null && t.slack_minutes > acc ? t.slack_minutes : acc),
    0
  ) ?? 0;
  const maxSlackHours = Math.round(maxSlackMinutes / 60);

  return {
    draft,
    view,
    preview,
    zone,
    shortDate,
    lateDays,
    bufferDays,
    criticalCount,
    nonCriticalCount,
    maxSlackHours,
    openDecisionLabForTask,
    setSettingsTab,
    setSettings,
  };
}

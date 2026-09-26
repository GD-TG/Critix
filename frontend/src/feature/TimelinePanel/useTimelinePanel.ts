import { useMemo, useState } from "react";
import { useApp } from "@/context/AppContext";
import {
  copy,
  formatDateTime,
  formatShortDate,
  getAvatarClass,
  getInitials,
  getZone,
  priorityLabels,
  statusLabels,
} from "@/shared";

export function useTimelinePanel() {
  const { draft, saved, preview, setTask, setActiveView } = useApp();

  const view = preview || saved;
  const zone = getZone(draft, saved);
  const date = (iso: string) => formatDateTime(iso, zone);
  const shortDate = (iso: string) => formatShortDate(iso, zone);

  const [timelineMode, setTimelineMode] = useState<"timeline" | "list">("timeline");
  const [dependencyVisible, setDependencyVisible] = useState(true);

  const rows = new Map((view?.analysis.tasks || []).map((r) => [r.id, r]));

  const projStartMs = draft ? new Date(draft.start).getTime() : 0;
  const projEndMs = view ? Math.max(new Date(view.analysis.finish).getTime(), projStartMs + 60000) : draft ? new Date(draft.deadline).getTime() : 1;
  const projTotalMs = Math.max(1, projEndMs - projStartMs);

  const timelineTicks = useMemo(() => {
    if (!draft) return [];
    const s = new Date(draft.start).getTime();
    const f = view
      ? new Date(view.analysis.finish).getTime()
      : new Date(draft.deadline).getTime();
    const total = Math.max(1, f - s);
    const count = 9;
    const step = total / (count - 1);
    const result = [];
    for (let i = 0; i < count; i++) {
      const d = new Date(s + step * i);
      result.push({
        day: d.toLocaleDateString("ru-RU", { timeZone: zone, day: "2-digit" }),
        full: d.toLocaleDateString("ru-RU", { timeZone: zone, day: "numeric", month: "short" }),
      });
    }
    return result;
  }, [draft?.start, draft?.deadline, view?.analysis.finish, zone]);

  const timelineHeading = useMemo(() => {
    if (!draft) return "ПЛАН ПРОЕКТА";
    const dStart = new Date(draft.start);
    const dEnd = view ? new Date(view.analysis.finish) : new Date(draft.deadline);
    const mStart = dStart.toLocaleDateString("ru-RU", { timeZone: zone, month: "short" });
    const mEnd = dEnd.toLocaleDateString("ru-RU", { timeZone: zone, month: "short", year: "numeric" });
    return `${mStart.toUpperCase()} — ${mEnd.toUpperCase()}`;
  }, [draft?.start, draft?.deadline, view?.analysis.finish, zone]);

  const todayMarkerPercent = useMemo(() => {
    if (!draft) return null;
    const nowMs = Date.now();
    const s = new Date(draft.start).getTime();
    const f = view
      ? new Date(view.analysis.finish).getTime()
      : new Date(draft.deadline).getTime();
    const total = Math.max(1, f - s);
    const pct = ((nowMs - s) / total) * 85;
    if (pct >= 0 && pct <= 85) return pct;
    return null;
  }, [draft?.start, draft?.deadline, view?.analysis.finish, zone]);

  return {
    draft,
    zone,
    date,
    shortDate,
    timelineMode,
    setTimelineMode,
    dependencyVisible,
    setDependencyVisible,
    rows,
    projStartMs,
    projTotalMs,
    timelineTicks,
    timelineHeading,
    todayMarkerPercent,
    getAvatarClass,
    getInitials,
    statusLabels,
    priorityLabels,
    setTask,
    copy,
    setActiveView,
  };
}

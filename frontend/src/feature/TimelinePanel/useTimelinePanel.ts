import { useMemo, useState } from "react";
import { useApp } from "@/context/AppContext";
import {
  copy,
  formatDateTime,
  formatMinutes,
  formatWorkDuration,
  formatShortDate,
  getAvatarClass,
  getInitials,
  getZone,
  priorityLabels,
  statusLabels,
} from "@/shared";

export interface TimelineDay {
  key: string;
  date: Date;
  dayNum: string;
  weekday: string;
  month: string;
  isWeekend: boolean;
  isToday: boolean;
  pctStart: number;
  pctWidth: number;
}

const WEEKDAYS = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];

export function useTimelinePanel() {
  const { draft, saved, preview, setTask, setActiveView } = useApp();

  const view = preview || saved;
  const zone = getZone(draft, saved);
  const date = (iso: string) => formatDateTime(iso, zone);
  const shortDate = (iso: string) => formatShortDate(iso, zone);

  const [timelineMode, setTimelineMode] = useState<"timeline" | "list">("timeline");
  const [dependencyVisible, setDependencyVisible] = useState(true);

  const rows = new Map((view?.analysis.tasks || []).map((r) => [r.id, r]));

  // Вычисляем строгие календарные границы таймлайна (по полуночам)
  const { timelineStartMs, timelineEndMs, timelineTotalMs, timelineDays, timelineMonths } = useMemo(() => {
    if (!draft) {
      return {
        timelineStartMs: 0,
        timelineEndMs: 1,
        timelineTotalMs: 1,
        timelineDays: [] as TimelineDay[],
        timelineMonths: [] as { name: string; pctStart: number; pctWidth: number }[],
      };
    }

    const rawStart = new Date(draft.start);
    const finishDate = view ? new Date(view.analysis.finish) : new Date(draft.deadline);
    const deadlineDate = new Date(draft.deadline);
    const rawEnd = new Date(Math.max(finishDate.getTime(), deadlineDate.getTime()));

    // Начало: 00:00 первого дня
    const startDate = new Date(rawStart);
    startDate.setHours(0, 0, 0, 0);

    // Конец: 23:59 последнего дня + 1 день буфера справа
    const endDate = new Date(rawEnd);
    endDate.setDate(endDate.getDate() + 1);
    endDate.setHours(23, 59, 59, 999);

    const startMs = startDate.getTime();
    const endMs = endDate.getTime();
    const totalMs = Math.max(1, endMs - startMs);

    // Подсчет количества календарных суток
    const totalDays = Math.max(1, Math.round(totalMs / 86400000));
    const days: TimelineDay[] = [];
    const todayStr = new Date().toISOString().split("T")[0];

    const monthMap = new Map<string, { startIdx: number; count: number }>();

    for (let i = 0; i < totalDays; i++) {
      const d = new Date(startMs + i * 86400000);
      const dayOfWeek = d.getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      const dateKey = d.toISOString().split("T")[0];
      const monthKey = d.toLocaleDateString("ru-RU", { timeZone: zone, month: "short", year: "numeric" }).toUpperCase();

      if (!monthMap.has(monthKey)) {
        monthMap.set(monthKey, { startIdx: i, count: 1 });
      } else {
        monthMap.get(monthKey)!.count += 1;
      }

      days.push({
        key: `day-${i}-${dateKey}`,
        date: d,
        dayNum: d.toLocaleDateString("ru-RU", { timeZone: zone, day: "2-digit" }),
        weekday: WEEKDAYS[dayOfWeek],
        month: d.toLocaleDateString("ru-RU", { timeZone: zone, month: "short" }),
        isWeekend,
        isToday: dateKey === todayStr,
        pctStart: (i / totalDays) * 100,
        pctWidth: (1 / totalDays) * 100,
      });
    }

    const months = Array.from(monthMap.entries()).map(([name, val]) => ({
      name,
      pctStart: (val.startIdx / totalDays) * 100,
      pctWidth: (val.count / totalDays) * 100,
    }));

    return {
      timelineStartMs: startMs,
      timelineEndMs: endMs,
      timelineTotalMs: totalMs,
      timelineDays: days,
      timelineMonths: months,
    };
  }, [draft?.start, draft?.deadline, view?.analysis.finish, zone]);

  // Маркер "Сегодня" на 100% шкале
  const todayMarkerPercent = useMemo(() => {
    if (!draft || timelineTotalMs <= 1) return null;
    const nowMs = Date.now();
    if (nowMs < timelineStartMs || nowMs > timelineEndMs) return null;
    return ((nowMs - timelineStartMs) / timelineTotalMs) * 100;
  }, [draft, timelineStartMs, timelineEndMs, timelineTotalMs]);

  // Маркер "Дедлайн" на 100% шкале
  const deadlineMarkerPercent = useMemo(() => {
    if (!draft || timelineTotalMs <= 1) return null;
    const dlMs = new Date(draft.deadline).getTime();
    if (dlMs < timelineStartMs || dlMs > timelineEndMs) return null;
    return ((dlMs - timelineStartMs) / timelineTotalMs) * 100;
  }, [draft?.deadline, timelineStartMs, timelineEndMs, timelineTotalMs]);

  // Подсчет связей для каждой задачи
  const taskDependencyCounts = useMemo(() => {
    const map = new Map<string, { incoming: number; outgoing: number }>();
    if (!draft) return map;
    for (const d of draft.dependencies || []) {
      const inc = map.get(d.successor_id) || { incoming: 0, outgoing: 0 };
      inc.incoming += 1;
      map.set(d.successor_id, inc);

      const out = map.get(d.predecessor_id) || { incoming: 0, outgoing: 0 };
      out.outgoing += 1;
      map.set(d.predecessor_id, out);
    }
    return map;
  }, [draft?.dependencies]);

  return {
    draft,
    zone,
    date,
    shortDate,
    formatMinutes,
    formatWorkDuration,
    timelineMode,
    setTimelineMode,
    dependencyVisible,
    setDependencyVisible,
    rows,
    timelineStartMs,
    timelineTotalMs,
    timelineDays,
    timelineMonths,
    todayMarkerPercent,
    deadlineMarkerPercent,
    taskDependencyCounts,
    getAvatarClass,
    getInitials,
    statusLabels,
    priorityLabels,
    setTask,
    copy,
    setActiveView,
  };
}

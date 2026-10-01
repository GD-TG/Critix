import { useMemo, useState, useCallback, useEffect, useRef } from "react";
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
import { defaultTask, type Task } from "@/types";

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
  const { draft, saved, preview, setTask, setActiveView, dirty, change } = useApp();

  const view = preview || saved;
  const zone = getZone(draft, saved);
  const date = (iso: string) => formatDateTime(iso, zone);
  const shortDate = (iso: string) => formatShortDate(iso, zone);

  const [timelineMode, setTimelineMode] = useState<"timeline" | "list">("timeline");
  const [dependencyVisible, setDependencyVisible] = useState(true);

  // Ховер и поповер связей
  const [hoveredTaskId, setHoveredTaskId] = useState<string | null>(null);
  const [activeDepTaskId, setActiveDepTaskId] = useState<string | null>(null);

  const rows = useMemo(
    () => new Map((view?.analysis.tasks || []).map((r) => [r.id, r])),
    [view?.analysis.tasks]
  );

  const savedRows = useMemo(
    () => new Map((saved?.analysis.tasks || []).map((r) => [r.id, r])),
    [saved?.analysis.tasks]
  );

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

  // Детальная карта связей для поповера
  const dependenciesDetailed = useMemo(() => {
    const map = new Map<
      string,
      {
        predecessors: Array<{ id: string; name: string; kind: string; lag: number; isCritical: boolean }>;
        successors: Array<{ id: string; name: string; kind: string; lag: number; isCritical: boolean }>;
      }
    >();

    if (!draft) return map;

    const taskMap = new Map(draft.tasks.map((t) => [t.id, t]));
    const analysisMap = rows;

    for (const t of draft.tasks) {
      map.set(t.id, { predecessors: [], successors: [] });
    }

    for (const d of draft.dependencies || []) {
      const predTask = taskMap.get(d.predecessor_id);
      const succTask = taskMap.get(d.successor_id);
      const predAnalysis = analysisMap.get(d.predecessor_id);
      const succAnalysis = analysisMap.get(d.successor_id);

      const isCriticalLink = Boolean(predAnalysis?.critical && succAnalysis?.critical);

      if (succTask) {
        const entry = map.get(d.successor_id);
        if (entry) {
          entry.predecessors.push({
            id: d.predecessor_id,
            name: predTask?.name || d.predecessor_id,
            kind: d.kind,
            lag: d.lag_minutes,
            isCritical: isCriticalLink,
          });
        }
      }

      if (predTask) {
        const entry = map.get(d.predecessor_id);
        if (entry) {
          entry.successors.push({
            id: d.successor_id,
            name: succTask?.name || d.successor_id,
            kind: d.kind,
            lag: d.lag_minutes,
            isCritical: isCriticalLink,
          });
        }
      }
    }

    return map;
  }, [draft, rows]);

  // -------------------------------------------------------------
  // Drag-What-If интерактивный сдвиг длительности задачи на Gantt
  // -------------------------------------------------------------
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);
  const [dragDeltaDays, setDragDeltaDays] = useState<number>(0);
  const hasDraggedRef = useRef(false);
  const dragRef = useRef<{
    active: boolean;
    taskId: string;
    startX: number;
    origDuration: number;
    origDraft: typeof draft;
    lastDeltaDays: number;
  } | null>(null);

  const chartContainerRef = useRef<HTMLDivElement | null>(null);

  const handleBarMouseDown = useCallback(
    (e: React.MouseEvent, task: Task) => {
      // Игнорируем клики правой кнопкой мыши или вехи
      if (e.button !== 0 || task.duration_minutes === 0 || !draft) return;
      e.stopPropagation();

      hasDraggedRef.current = false;
      dragRef.current = {
        active: false,
        taskId: task.id,
        startX: e.clientX,
        origDuration: task.duration_minutes,
        origDraft: copy(draft),
        lastDeltaDays: 0,
      };

      const onMouseMove = (moveEvt: MouseEvent) => {
        if (!dragRef.current || !chartContainerRef.current) return;
        const dx = moveEvt.clientX - dragRef.current.startX;

        if (!dragRef.current.active && Math.abs(dx) > 5) {
          dragRef.current.active = true;
          hasDraggedRef.current = true;
          setDraggingTaskId(dragRef.current.taskId);
        }

        if (dragRef.current.active) {
          const chartEl = chartContainerRef.current.querySelector(".task-chart") as HTMLElement | null;
          const containerWidth = chartEl?.clientWidth || (chartContainerRef.current.clientWidth ? Math.max(300, chartContainerRef.current.clientWidth - 260) : 800);
          const dayWidthPx = containerWidth / Math.max(1, timelineDays.length);
          const deltaDays = Math.round(dx / Math.max(10, dayWidthPx));

          setDragDeltaDays(deltaDays);

          if (deltaDays !== dragRef.current.lastDeltaDays) {
            dragRef.current.lastDeltaDays = deltaDays;
            const newDuration = Math.max(480, dragRef.current.origDuration + deltaDays * 8 * 60);

            if (draft) {
              const updatedTasks = draft.tasks.map((t) =>
                t.id === dragRef.current?.taskId
                  ? {
                      ...t,
                      duration_minutes: newDuration,
                      ...(t.status === "done" ? { status: "in_progress" as const, actual_finish: null } : {}),
                    }
                  : t
              );
              change({ ...draft, tasks: updatedTasks });
            }
          }
        }
      };

      const onMouseUp = () => {
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("mouseup", onMouseUp);
        window.removeEventListener("keydown", onKeyDown);
        dragRef.current = null;
        setDraggingTaskId(null);
        setDragDeltaDays(0);
        setTimeout(() => {
          hasDraggedRef.current = false;
        }, 80);
      };

      const onKeyDown = (keyEvt: KeyboardEvent) => {
        if (keyEvt.key === "Escape" && dragRef.current) {
          if (dragRef.current.origDraft) {
            change(dragRef.current.origDraft);
          }
          onMouseUp();
        }
      };

      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
      window.addEventListener("keydown", onKeyDown);
    },
    [draft, change, timelineDays.length]
  );

  const handleTaskClick = useCallback(
    (task: Task) => {
      if (hasDraggedRef.current) return;
      setTask(copy(task));
    },
    [setTask]
  );

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
    savedRows,
    view,
    dirty,
    timelineStartMs,
    timelineTotalMs,
    timelineDays,
    timelineMonths,
    todayMarkerPercent,
    deadlineMarkerPercent,
    taskDependencyCounts,
    dependenciesDetailed,
    hoveredTaskId,
    setHoveredTaskId,
    activeDepTaskId,
    setActiveDepTaskId,
    draggingTaskId,
    dragDeltaDays,
    handleBarMouseDown,
    handleTaskClick,
    chartContainerRef,
    getAvatarClass,
    getInitials,
    statusLabels,
    priorityLabels,
    addTask: () => setTask(defaultTask()),
    setTask,
    copy,
    setActiveView,
  };
}

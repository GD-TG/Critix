import { useState, useCallback, useEffect } from "react";
import { useApp } from "@/context/AppContext";
import { api } from "@/api";
import type { Project, Result } from "@/types";

export interface EventPreviewResponse {
  draft: Project;
  analysis: Result["analysis"];
  comparison: Result["changes"];
}

export function useEventDialog() {
  const { draft, saved, change, eventDialogOpened, setEventDialogOpened, showNotification } = useApp();

  const [activeKind, setActiveKind] = useState<"absence" | "harder" | "delay" | "scope" | "deadline">("harder");

  // Form states
  const [taskId, setTaskId] = useState<string>("");
  const [extraDays, setExtraDays] = useState<number>(3);

  const [assigneeId, setAssigneeId] = useState<string>("");
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");
  const [handoverTo, setHandoverTo] = useState<string>("");

  const [untilDate, setUntilDate] = useState<string>("");

  const [newTaskName, setNewTaskName] = useState<string>("Дополнительная доработка");
  const [durationDays, setDurationDays] = useState<number>(3);
  const [afterTaskId, setAfterTaskId] = useState<string>("");
  const [beforeTaskId, setBeforeTaskId] = useState<string>("");

  const [newDeadline, setNewDeadline] = useState<string>("");

  const [previewData, setPreviewData] = useState<EventPreviewResponse | null>(null);
  const [loading, setLoading] = useState(false);

  // Initialize defaults when modal opens or draft changes
  useEffect(() => {
    if (draft && draft.tasks.length > 0 && !taskId) {
      setTaskId(draft.tasks[0].id);
    }
    if (draft && draft.assignees.length > 0 && !assigneeId) {
      setAssigneeId(draft.assignees[0].id);
    }
    if (draft && !newDeadline) {
      const d = new Date(draft.deadline);
      d.setDate(d.getDate() + 7);
      setNewDeadline(d.toISOString().slice(0, 10));
    }
  }, [draft, taskId, assigneeId, newDeadline]);

  // Request preview from backend compile-event
  const fetchPreview = useCallback(async () => {
    if (!saved) return;
    setLoading(true);
    try {
      const payload: Record<string, unknown> = { kind: activeKind };
      if (activeKind === "harder") {
        payload.task_id = taskId;
        payload.extra_days = extraDays;
      } else if (activeKind === "absence") {
        payload.assignee_id = assigneeId;
        payload.from_date = fromDate ? `${fromDate}T09:00:00+05:00` : null;
        payload.to_date = toDate ? `${toDate}T18:00:00+05:00` : null;
        payload.handover_to = handoverTo || null;
      } else if (activeKind === "delay") {
        payload.task_id = taskId;
        payload.until_date = untilDate ? `${untilDate}T09:00:00+05:00` : null;
      } else if (activeKind === "scope") {
        payload.new_task_name = newTaskName;
        payload.duration_days = durationDays;
        payload.after_task_id = afterTaskId || null;
        payload.before_task_id = beforeTaskId || null;
      } else if (activeKind === "deadline") {
        payload.new_deadline = newDeadline ? `${newDeadline}T18:00:00+05:00` : null;
      }

      const res = await api<EventPreviewResponse>(`/projects/${saved.id}/compile-event`, "POST", payload);
      setPreviewData(res);
    } catch {
      // preview error handled silently
    } finally {
      setLoading(false);
    }
  }, [saved, activeKind, taskId, extraDays, assigneeId, fromDate, toDate, handoverTo, untilDate, newTaskName, durationDays, afterTaskId, beforeTaskId, newDeadline]);

  // Debounced auto-preview when form values change
  useEffect(() => {
    if (!eventDialogOpened) return;
    const timer = setTimeout(() => {
      fetchPreview();
    }, 250);
    return () => clearTimeout(timer);
  }, [eventDialogOpened, fetchPreview]);

  const handleApplyToDraft = useCallback(() => {
    if (previewData?.draft) {
      change(previewData.draft);
      showNotification("Событие смоделировано и применено в черновик");
      setEventDialogOpened(false);
    }
  }, [previewData, change, showNotification, setEventDialogOpened]);

  const closeDialog = () => setEventDialogOpened(false);

  return {
    opened: eventDialogOpened,
    closeDialog,
    activeKind,
    setActiveKind,
    taskId,
    setTaskId,
    extraDays,
    setExtraDays,
    assigneeId,
    setAssigneeId,
    fromDate,
    setFromDate,
    toDate,
    setToDate,
    handoverTo,
    setHandoverTo,
    untilDate,
    setUntilDate,
    newTaskName,
    setNewTaskName,
    durationDays,
    setDurationDays,
    afterTaskId,
    setAfterTaskId,
    beforeTaskId,
    setBeforeTaskId,
    newDeadline,
    setNewDeadline,
    previewData,
    loading,
    handleApplyToDraft,
    draft,
    saved,
  };
}

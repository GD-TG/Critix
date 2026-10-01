import { useEffect, useState } from "react";
import { useApp } from "@/context/AppContext";
import { copy } from "@/shared";
import { defaultTask } from "@/types";

type Situation = "harder" | "absence" | "delay" | "scope" | "deadline" | null;

export function useEventDialog(onClose: () => void) {
  const { draft, change, showNotification } = useApp();
  const [situation, setSituation] = useState<Situation>(null);

  // Form states
  const [taskId, setTaskId] = useState<string | null>(null);
  const [extraDays, setExtraDays] = useState<number | string>(1);

  const [assigneeId, setAssigneeId] = useState<string | null>(null);
  const [handoverTo, setHandoverTo] = useState<string | null>(null);

  const [newStartDate, setNewStartDate] = useState<string>("");

  const [taskName, setTaskName] = useState<string>("");
  const [durationDays, setDurationDays] = useState<number | string>(1);
  const [afterTaskId, setAfterTaskId] = useState<string | null>(null);

  const [newDeadline, setNewDeadline] = useState<string>("");

  // Подстановка значений по умолчанию при смене ситуации
  useEffect(() => {
    if (!situation || !draft || draft.tasks.length === 0) return;

    if (!taskId) {
      const active = draft.tasks.find((t) => t.status !== "done") || draft.tasks[0];
      if (active) setTaskId(active.id);
    }

    if (situation === "absence" && !assigneeId && draft.assignees.length > 0) {
      setAssigneeId(draft.assignees[0].id);
      if (draft.assignees.length > 1) {
        setHandoverTo(draft.assignees[1].id);
      }
    }

    if (situation === "delay" && !newStartDate) {
      const target = draft.tasks.find((t) => t.id === taskId) || draft.tasks.find((t) => t.status !== "done") || draft.tasks[0];
      const d = new Date();
      d.setDate(d.getDate() + 2);
      const pad = (n: number) => n.toString().padStart(2, "0");
      setNewStartDate(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T09:00`);
    }

    if (situation === "scope" && !afterTaskId) {
      setAfterTaskId(draft.tasks[draft.tasks.length - 1].id);
    }

    if (situation === "deadline" && !newDeadline) {
      const d = new Date(draft.deadline);
      d.setDate(d.getDate() + 3);
      const pad = (n: number) => n.toString().padStart(2, "0");
      setNewDeadline(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T18:00`);
    }
  }, [situation, taskId, draft]);

  const reset = () => {
    setSituation(null);
    setTaskId(null);
    setExtraDays(1);
    setAssigneeId(null);
    setHandoverTo(null);
    setNewStartDate("");
    setTaskName("");
    setDurationDays(1);
    setAfterTaskId(null);
    setNewDeadline("");
  };

  const closeAndReset = () => {
    onClose();
    reset();
  };

  const handleApply = () => {
    if (!draft) return;
    const newDraft = copy(draft);

    switch (situation) {
      case "harder": {
        if (!taskId || !extraDays) return;
        const task = newDraft.tasks.find((t) => t.id === taskId);
        if (task) {
          task.duration_minutes += Number(extraDays) * 8 * 60;
          if (task.status === "done") {
            task.status = "in_progress";
            task.actual_finish = null;
          }
          showNotification(`Событие применено: задача «${task.name}» усложнилась (+${extraDays} дн.). Граф пересчитан!`);
        }
        break;
      }
      case "absence": {
        if (!assigneeId || !handoverTo) return;
        let count = 0;
        for (const task of newDraft.tasks) {
          if (task.assignee_id === assigneeId) {
            task.assignee_id = handoverTo;
            count++;
          }
        }
        const toPerson = draft.assignees.find((a) => a.id === handoverTo)?.name || "коллеге";
        showNotification(`Событие применено: ${count} задач передано сотруднику ${toPerson}.`);
        break;
      }
      case "delay": {
        if (!taskId || !newStartDate) return;
        const parsedDate = new Date(newStartDate);
        if (isNaN(parsedDate.getTime())) return;
        const task = newDraft.tasks.find((t) => t.id === taskId);
        if (task) {
          task.not_before = parsedDate.toISOString();
          if (task.status === "done") {
            task.status = "in_progress";
            task.actual_finish = null;
          }
          showNotification(`Событие применено: старт задачи «${task.name}» отложен. График пересчитан!`);
        }
        break;
      }
      case "scope": {
        if (!taskName || !durationDays || !afterTaskId) return;
        const newTask = defaultTask();
        newTask.name = taskName;
        newTask.duration_minutes = Number(durationDays) * 8 * 60;
        newDraft.tasks.push(newTask);
        newDraft.dependencies.push({
          predecessor_id: afterTaskId,
          successor_id: newTask.id,
          kind: "FS",
          lag_minutes: 0,
          lag_mode: "working",
        });
        showNotification(`Событие применено: задача «${taskName}» встроена в цепочку зависимостей.`);
        break;
      }
      case "deadline": {
        if (!newDeadline) return;
        const parsedDeadline = new Date(newDeadline);
        if (isNaN(parsedDeadline.getTime())) return;
        newDraft.deadline = parsedDeadline.toISOString();
        showNotification(`Событие применено: новый дедлайн проекта сохранен.`);
        break;
      }
    }

    change(newDraft);
    closeAndReset();
  };

  return {
    draft,
    situation,
    setSituation,
    taskId,
    setTaskId,
    extraDays,
    setExtraDays,
    assigneeId,
    setAssigneeId,
    handoverTo,
    setHandoverTo,
    newStartDate,
    setNewStartDate,
    taskName,
    setTaskName,
    durationDays,
    setDurationDays,
    afterTaskId,
    setAfterTaskId,
    newDeadline,
    setNewDeadline,
    handleApply,
    closeAndReset,
  };
}

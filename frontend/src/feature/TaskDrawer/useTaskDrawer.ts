import { useProjects } from "@/context/ProjectContext";
import { useUi } from "@/context/UiContext";
import { useTaskState } from "@/context/TaskContext";
import { calculateSkillMatch } from "@/shared";
import { changeTaskStatus } from "@/taskEditing";
import type { Dependency, Priority, Task } from "@/types";

export function useTaskDrawer() {
  const { draft, change, rows } = useProjects();
  const { showNotification } = useUi();
  const {
    task,
    setTask,
    newTaskSkill,
    setNewTaskSkill,
    taskInlinePredId,
    setTaskInlinePredId,
    taskInlinePredKind,
    setTaskInlinePredKind,
    taskInlinePredLagHours,
    setTaskInlinePredLagHours,
    taskInlinePredLagMode,
  } = useTaskState();

  const isExisting = Boolean(task && draft?.tasks.some((t) => t.id === task.id));

  const updateTask = (patch: Partial<Task>) => {
    if (!task) return;
    setTask({ ...task, ...patch });
  };

  const setPriority = (v: string | null) => updateTask({ priority: (v as Priority) || "medium" });
  const setStatus = (v: string | null) => {
    if (!task) return;
    const taskRow = rows?.get(task.id);
    setTask(changeTaskStatus(task, v as Task["status"], taskRow?.start, taskRow?.finish));
  };

  const addRequiredSkill = () => {
    if (!task || !newTaskSkill.trim()) return;
    setTask({
      ...task,
      required_skills: [...(task.required_skills || []), newTaskSkill.trim()],
    });
    setNewTaskSkill("");
  };

  const removeRequiredSkill = (idx: number) => {
    if (!task) return;
    setTask({
      ...task,
      required_skills: (task.required_skills || []).filter((_, i) => i !== idx),
    });
  };

  const removeIncomingDependency = (dep: Dependency) => {
    if (!draft) return;
    change({
      ...draft,
      dependencies: draft.dependencies.filter((d) => d !== dep),
    });
    showNotification("Связь удалена");
  };

  const addInlinePredecessor = () => {
    if (!draft || !task || !taskInlinePredId) return;
    const newDep: Dependency = {
      predecessor_id: taskInlinePredId,
      successor_id: task.id,
      kind: taskInlinePredKind,
      lag_minutes: Math.round(taskInlinePredLagHours * 60),
      lag_mode: taskInlinePredLagMode,
    };
    change({
      ...draft,
      dependencies: [...draft.dependencies, newDep],
    });
    setTaskInlinePredId("");
    showNotification("Связь добавлена");
  };

  const deleteTask = () => {
    if (!draft || !task) return;
    change({
      ...draft,
      tasks: draft.tasks.filter((t) => t.id !== task.id),
      dependencies: draft.dependencies.filter(
        (d) => d.predecessor_id !== task.id && d.successor_id !== task.id
      ),
    });
    setTask(null);
    setTaskInlinePredId("");
    showNotification(`Задача «${task.name}» удалена`);
  };

  const saveTask = () => {
    if (!draft || !task) return;
    const existing = draft.tasks.some((t) => t.id === task.id);
    const newDeps = [...draft.dependencies];
    if (!existing && taskInlinePredId) {
      newDeps.push({
        predecessor_id: taskInlinePredId,
        successor_id: task.id,
        kind: taskInlinePredKind,
        lag_minutes: Math.round(taskInlinePredLagHours * 60),
        lag_mode: taskInlinePredLagMode,
      });
    }
    change({
      ...draft,
      tasks: existing
        ? draft.tasks.map((t) => (t.id === task.id ? task : t))
        : [...draft.tasks, task],
      dependencies: newDeps,
    });
    setTask(null);
    setTaskInlinePredId("");
    showNotification(`Задача «${task.name}» сохранена`);
  };

  return {
    task,
    draft,
    setTask,
    isExisting,
    newTaskSkill,
    setNewTaskSkill,
    taskInlinePredId,
    setTaskInlinePredId,
    taskInlinePredKind,
    setTaskInlinePredKind,
    taskInlinePredLagHours,
    setTaskInlinePredLagHours,
    updateTask,
    setPriority,
    setStatus,
    addRequiredSkill,
    removeRequiredSkill,
    removeIncomingDependency,
    addInlinePredecessor,
    deleteTask,
    saveTask,
    calculateSkillMatch,
  };
}
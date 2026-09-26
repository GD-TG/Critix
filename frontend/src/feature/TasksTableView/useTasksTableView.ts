import { useProjects } from "@/context/ProjectContext";
import { useUi } from "@/context/UiContext";
import { useTaskState } from "@/context/TaskContext";
import {
  calculateSkillMatch,
  copy,
  formatDateTime,
  getAvatarClass,
  getInitials,
  getZone,
  priorityColors,
  priorityLabels,
  statusColors,
  statusLabels,
} from "@/shared";
import { defaultTask, type Task } from "@/types";

export function useTasksTableView() {
  const { draft, saved, rows, view } = useProjects();
  const { activeView, setActiveView, setImportModal } = useUi();
  const { setTask } = useTaskState();

  const zone = getZone(draft, saved);
  const date = (iso: string) => formatDateTime(iso, zone);

  const addTask = () => setTask(defaultTask());
  const openTask = (t: Task) => setTask(copy(t));

  return {
    draft,
    rows,
    view,
    date,
    activeView,
    setActiveView,
    setImportModal,
    addTask,
    openTask,
    getAvatarClass,
    getInitials,
    calculateSkillMatch,
    statusLabels,
    statusColors,
    priorityLabels,
    priorityColors,
  };
}
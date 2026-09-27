import { useProjects } from "@/context/ProjectContext";
import { useUi } from "@/context/UiContext";
import { useTaskState } from "@/context/TaskContext";
import { copy } from "@/shared";
import type { Dependency, Task } from "@/types";

export function useGraphView() {
  const { draft, view, affected, change } = useProjects();
  const { colorScheme, activeView, setActiveView, showNotification } = useUi();
  const {
    setTask,
    setDepModal,
    setEditingDepIndex,
    setEditDepKind,
    setEditDepLagHours,
    setEditDepLagMode,
  } = useTaskState();

  const onEditTask = (t: Task) => setTask(copy(t));

  const onAddDependency = (d: Dependency) => {
    if (!draft) return;
    change({
      ...draft,
      dependencies: [...draft.dependencies, d],
    });
    showNotification(`Добавлена связь: ${d.kind}`);
  };

  const onEditDependency = (idx: number) => {
    if (!draft) return;
    if (draft.dependencies[idx]) {
      const d = draft.dependencies[idx];
      setEditingDepIndex(idx);
      setEditDepKind(d.kind);
      setEditDepLagHours(d.lag_minutes / 60);
      setEditDepLagMode(d.lag_mode);
    }
  };

  return {
    draft,
    view,
    affected,
    colorScheme,
    activeView,
    setActiveView,
    setDepModal,
    onEditTask,
    onAddDependency,
    onEditDependency,
  };
}
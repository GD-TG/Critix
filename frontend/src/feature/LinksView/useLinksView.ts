import { useProjects } from "@/context/ProjectContext";
import { useUi } from "@/context/UiContext";
import { useTaskState } from "@/context/TaskContext";
import type { Dependency } from "@/types";

export function useLinksView() {
  const { draft, change } = useProjects();
  const { activeView, setActiveView, showNotification } = useUi();
  const {
    setDepModal,
    setEditingDepIndex,
    setEditDepKind,
    setEditDepLagHours,
    setEditDepLagMode,
  } = useTaskState();

  const editDependency = (idx: number, d: Dependency) => {
    setEditingDepIndex(idx);
    setEditDepKind(d.kind);
    setEditDepLagHours(d.lag_minutes / 60);
    setEditDepLagMode(d.lag_mode);
  };

  const removeDependency = (idx: number) => {
    if (!draft) return;
    change({
      ...draft,
      dependencies: (draft.dependencies || []).filter((_, j) => j !== idx),
    });
    showNotification("Связь удалена");
  };

  return {
    draft,
    activeView,
    setActiveView,
    setDepModal,
    editDependency,
    removeDependency,
  };
}
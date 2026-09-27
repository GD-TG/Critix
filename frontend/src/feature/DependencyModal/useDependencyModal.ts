import { useProjects } from "@/context/ProjectContext";
import { useUi } from "@/context/UiContext";
import { useTaskState } from "@/context/TaskContext";
import { useAuth } from "@/context/AuthContext";

export function useDependencyModal() {
  const { draft, change } = useProjects();
  const { showNotification } = useUi();
  const { setError } = useAuth();
  const {
    depModal, setDepModal,
    newDepPred, setNewDepPred, newDepSucc, setNewDepSucc,
    newDepKind, setNewDepKind, newDepLagHours, setNewDepLagHours, newDepLagMode, setNewDepLagMode,
    editingDepIndex, setEditingDepIndex,
    editDepKind, setEditDepKind, editDepLagHours, setEditDepLagHours, editDepLagMode, setEditDepLagMode,
  } = useTaskState();

  const handleAddDependencySubmit = () => {
    if (!draft || !newDepPred || !newDepSucc || newDepPred === newDepSucc) {
      setError("Выберите двух разных участников зависимости");
      return;
    }
    const exists = draft.dependencies.some(
      (d) => d.predecessor_id === newDepPred && d.successor_id === newDepSucc
    );
    if (exists) {
      setError("Такая зависимость уже существует");
      return;
    }
    change({
      ...draft,
      dependencies: [
        ...draft.dependencies,
        {
          predecessor_id: newDepPred,
          successor_id: newDepSucc,
          kind: newDepKind,
          lag_minutes: Math.round(newDepLagHours * 60),
          lag_mode: newDepLagMode,
        },
      ],
    });
    setDepModal(false);
    setNewDepPred("");
    setNewDepSucc("");
    showNotification("Связь успешно добавлена");
  };

  const handleSaveEdit = () => {
    if (!draft || editingDepIndex === null) return;
    const updated = [...draft.dependencies];
    updated[editingDepIndex] = {
      ...updated[editingDepIndex],
      kind: editDepKind,
      lag_minutes: Math.round(editDepLagHours * 60),
      lag_mode: editDepLagMode,
    };
    change({
      ...draft,
      dependencies: updated,
    });
    setEditingDepIndex(null);
    showNotification("Параметры связи обновлены");
  };

  return {
    draft,
    depModal, setDepModal,
    newDepPred, setNewDepPred, newDepSucc, setNewDepSucc,
    newDepKind, setNewDepKind, newDepLagHours, setNewDepLagHours, newDepLagMode, setNewDepLagMode,
    editingDepIndex, setEditingDepIndex,
    editDepKind, setEditDepKind, editDepLagHours, setEditDepLagHours, editDepLagMode, setEditDepLagMode,
    handleAddDependencySubmit,
    handleSaveEdit,
  };
}

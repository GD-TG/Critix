import { useState } from "react";
import { useProjects } from "@/context/ProjectContext";
import { useUi } from "@/context/UiContext";
import { useAuth } from "@/context/AuthContext";
import { parseCsvToTasks } from "@/taskCsv";
import type { Task } from "@/types";

export function useCsvImportModal() {
  const { draft, change } = useProjects();
  const { importModal, setImportModal, showNotification } = useUi();
  const { setError } = useAuth();
  const [csvInput, setCsvInput] = useState("");

  const handleImportCsvSubmit = () => {
    if (!draft || !csvInput.trim()) return;
    let parsed: Task[];
    try { parsed = parseCsvToTasks(csvInput, draft.assignees, draft.tasks.map(t => t.id)); }
    catch (e) { setError(e instanceof Error ? e.message : "Ошибка CSV"); return; }
    if (parsed.length === 0) {
      setError("Не удалось распознать задачи из введенного CSV");
      return;
    }
    change({
      ...draft,
      tasks: [...draft.tasks, ...parsed],
    });
    setImportModal(false);
    setCsvInput("");
    showNotification(`Импортировано ${parsed.length} задач`);
  };

  return {
    importModal, setImportModal,
    csvInput, setCsvInput,
    handleImportCsvSubmit,
  };
}

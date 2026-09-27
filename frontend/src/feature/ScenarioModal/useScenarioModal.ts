import { useProjects } from "@/context/ProjectContext";
import { useUi } from "@/context/UiContext";
import { useTaskState } from "@/context/TaskContext";
import { api } from "@/api";
import { copy, formatDateTime, getZone } from "@/shared";
import type { Result } from "@/types";

export function useScenarioModal() {
  const { draft, saved, setDraft, setPreview } = useProjects();
  const { showScenarioModal, setShowScenarioModal } = useUi();
  const {
    simTaskChoice, setSimTaskChoice,
    simDelayDays, setSimDelayDays,
    simResult, setSimResult,
    simError, setSimError,
    simBusy, setSimBusy,
  } = useTaskState();

  const zone = getZone(draft, saved);
  const date = (iso: string) => formatDateTime(iso, zone);

  const close = () => {
    setShowScenarioModal(false);
    setSimResult(null);
  };

  const handleRunSimulation = async () => {
    if (!saved || !draft) return;
    const targetTaskId = simTaskChoice || draft.tasks.find(t => t.status !== "done")?.id;
    if (!targetTaskId) { setSimError("Нет незавершённых задач для изменения"); return; }
    setSimResult(null); setSimError(""); setSimBusy(true);
    try {
      const res = await api<Result>(`/projects/${saved.id}/simulate`, "POST", {
        version: saved.version,
        project: {...draft, tasks: draft.tasks.map(t => t.id === targetTaskId
          ? {...t, duration_minutes: t.duration_minutes + Math.round(simDelayDays * 60)} : t)},
      });
      setSimResult(res);
    } catch (e) { setSimError(e instanceof Error ? e.message : "Не удалось рассчитать сценарий"); }
    finally { setSimBusy(false); }
  };

  const applyScenario = () => {
    if (!simResult) return;
    setDraft(copy(simResult.project));
    setPreview(simResult);
    setShowScenarioModal(false);
  };

  return {
    draft,
    showScenarioModal, setShowScenarioModal,
    simTaskChoice, setSimTaskChoice,
    simDelayDays, setSimDelayDays,
    simResult, setSimResult,
    simError,
    simBusy,
    date,
    close,
    handleRunSimulation,
    applyScenario,
  };
}

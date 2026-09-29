import { useCallback, useEffect, useRef, useState } from "react";
import { useRequestGate } from "@/useRequestGate";
import { useProjects } from "@/context/ProjectContext";
import { useUi } from "@/context/UiContext";
import { useTaskState } from "@/context/TaskContext";
import { api } from "@/api";
import { applyCheckedScenario } from "@/scenarioApplication";
import { copy, formatDateTime, formatCalendarShift, getZone } from "@/shared";
import type { Result, Scenario } from "@/types";

export function useScenarioModal() {
  const { draft, saved, change, setPreview } = useProjects();
  const { showScenarioModal, setShowScenarioModal } = useUi();
  const {
    simTaskChoice,
    setSimTaskChoice,
    simDelayDays,
    setSimDelayDays,
    simResult,
    setSimResult,
    simError,
    setSimError,
    simBusy,
    setSimBusy,
  } = useTaskState();

  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [loadingScenarios, setLoadingScenarios] = useState(false);
  const [activeTab, setActiveTab] = useState<string | null>("compare");
  const [newScenarioName, setNewScenarioName] = useState("");
  const [newScenarioDesc, setNewScenarioDesc] = useState("");
  const [actionError, setActionError] = useState("");
  const [actionBusy, setActionBusy] = useState(false);

  const zone = getZone(draft, saved);
  const gate = useRequestGate(
    saved?.id,
    saved?.version,
    draft,
    simTaskChoice,
    simDelayDays,
    showScenarioModal,
  );
  const resultGuard = useRef<(() => boolean) | null>(null);
  const inFlight = useRef(false);
  const visibleResult = resultGuard.current?.() ? simResult : null;
  const date = (iso: string) => formatDateTime(iso, zone);

  const fetchScenarios = useCallback(async () => {
    if (!saved?.id) return;
    const isCurrent = gate.watch();
    setLoadingScenarios(true);
    try {
      const data = await api<Scenario[]>(`/projects/${saved.id}/scenarios`);
      if (isCurrent()) setScenarios(data);
    } catch {
      if (isCurrent()) setActionError("Не удалось загрузить сценарии");
    } finally {
      setLoadingScenarios(false);
    }
  }, [saved?.id, saved?.version, gate]);

  useEffect(() => {
    if (showScenarioModal && saved?.id) {
      fetchScenarios();
      setActionError("");
    }
  }, [showScenarioModal, saved?.id, fetchScenarios]);

  const close = () => {
    gate.invalidate();
    setShowScenarioModal(false);
    setSimResult(null);
    setActionError("");
    setNewScenarioName("");
    setNewScenarioDesc("");
  };

  const handleRunSimulation = async () => {
    if (!saved || !draft || inFlight.current) return;
    const targetTaskId =
      simTaskChoice || draft.tasks.find((t) => t.status !== "done")?.id;
    if (!targetTaskId) {
      setSimError("Нет незавершённых задач для изменения");
      return;
    }
    if (
      !draft.tasks.some((t) => t.id === targetTaskId && t.status !== "done")
    ) {
      setSimError("Выберите незавершённую задачу текущего проекта");
      return;
    }
    const isCurrent = gate.capture();
    inFlight.current = true;
    setSimResult(null);
    setSimError("");
    setSimBusy(true);
    try {
      const res = await api<Result>(`/projects/${saved.id}/simulate`, "POST", {
        version: saved.version,
        project: {
          ...draft,
          tasks: draft.tasks.map((t) =>
            t.id === targetTaskId
              ? {
                  ...t,
                  duration_minutes:
                    t.duration_minutes + Math.round(simDelayDays * 60),
                }
              : t,
          ),
        },
      });
      if (isCurrent()) {
        resultGuard.current = isCurrent;
        setSimResult(res);
      }
    } catch (e) {
      if (isCurrent())
        setSimError(
          e instanceof Error ? e.message : "Не удалось рассчитать сценарий",
        );
    } finally {
      inFlight.current = false;
      setSimBusy(false);
    }
  };

  const applySimulationToDraft = () => {
    if (!simResult || !resultGuard.current?.()) return;
    change(copy(simResult.project));
    setPreview(simResult);
    setShowScenarioModal(false);
  };

  const handleCreateScenarioFromDraft = async () => {
    if (!saved || !draft) return;
    const name = newScenarioName.trim();
    if (!name) {
      setActionError("Укажите название сценария");
      return;
    }
    if (actionBusy) return;
    const isCurrent = gate.watch();
    setActionBusy(true);
    setActionError("");
    try {
      await api<Scenario>(`/projects/${saved.id}/scenarios`, "POST", {
        name,
        description: newScenarioDesc.trim() || undefined,
        base_version: saved.version,
        project: draft,
      });
      if (!isCurrent()) return;
      setNewScenarioName("");
      setNewScenarioDesc("");
      await fetchScenarios();
      setActiveTab("compare");
    } catch (e: any) {
      if (isCurrent()) setActionError(e?.message || "Не удалось сохранить сценарий в базу данных");
    } finally {
      setActionBusy(false);
    }
  };

  const handleCreateScenarioFromWhatif = async () => {
    if (!saved || !simResult || !resultGuard.current?.()) return;
    const name = newScenarioName.trim();
    if (!name) {
      setActionError("Укажите название сценария");
      return;
    }
    if (actionBusy) return;
    const isCurrent = gate.watch();
    setActionBusy(true);
    setActionError("");
    try {
      await api<Scenario>(`/projects/${saved.id}/scenarios`, "POST", {
        name,
        description: newScenarioDesc.trim() || undefined,
        base_version: saved.version,
        project: simResult.project,
      });
      if (!isCurrent()) return;
      setNewScenarioName("");
      setNewScenarioDesc("");
      await fetchScenarios();
      setActiveTab("compare");
    } catch (e: any) {
      if (isCurrent()) setActionError(e?.message || "Не удалось сохранить сценарий в базу данных");
    } finally {
      setActionBusy(false);
    }
  };

  const handleDeleteScenario = async (scenarioId: string) => {
    if (!saved) return;
    if (actionBusy) return;
    const isCurrent = gate.watch();
    setActionBusy(true);
    try {
      await api(`/projects/${saved.id}/scenarios/${scenarioId}`, "DELETE");
      if (isCurrent()) await fetchScenarios();
    } catch (e: any) {
      if (isCurrent()) setActionError(e?.message || "Не удалось удалить сценарий");
    } finally {
      setActionBusy(false);
    }
  };

  const handleApplyScenario = async (scenario: Scenario) => {
    if (!saved || actionBusy || scenario.error) return;
    if (scenario.base_version !== saved.version) {
      setActionError("Сценарий устарел. Создайте новый вариант на основе актуального плана.");
      return;
    }
    const isCurrent = gate.capture();
    setActionBusy(true);
    setActionError("");
    try {
      await applyCheckedScenario(
        () => api<Result>(`/projects/${saved.id}/simulate`, "POST", {
          version: saved.version, project: scenario.project,
        }),
        isCurrent,
        (res) => { change(copy(res.project)); setPreview(res); close(); },
      );
    } catch (error) {
      if (isCurrent()) setActionError(error instanceof Error ? error.message : "Не удалось проверить сценарий. Черновик сохранён.");
    } finally {
      setActionBusy(false);
    }
  };

  const [analyzingIds, setAnalyzingIds] = useState<Record<string, boolean>>({});

  const handleAnalyzeScenario = async (scenarioId: string) => {
    if (!saved || actionBusy) return;
    setAnalyzingIds((prev) => ({ ...prev, [scenarioId]: true }));
    try {
      const full = await api<Scenario>(`/projects/${saved.id}/scenarios/${scenarioId}`);
      setScenarios((prev) => prev.map((s) => (s.id === scenarioId ? full : s)));
    } catch (e: any) {
      setActionError(e?.message || "Не удалось рассчитать сценарий");
    } finally {
      setAnalyzingIds((prev) => ({ ...prev, [scenarioId]: false }));
    }
  };

  return {
    draft,
    saved,
    scenarios,
    loadingScenarios,
    analyzingIds,
    handleAnalyzeScenario,
    activeTab,
    setActiveTab,
    newScenarioName,
    setNewScenarioName,
    newScenarioDesc,
    setNewScenarioDesc,
    actionError,
    actionBusy,
    showScenarioModal,
    setShowScenarioModal,
    simTaskChoice,
    setSimTaskChoice,
    simDelayDays,
    setSimDelayDays,
    simResult: visibleResult,
    setSimResult,
    simError,
    simBusy,
    date,
    formatCalendarShift,
    close,
    fetchScenarios,
    handleRunSimulation,
    applySimulationToDraft,
    handleCreateScenarioFromDraft,
    handleCreateScenarioFromWhatif,
    handleDeleteScenario,
    handleApplyScenario,
  };
}

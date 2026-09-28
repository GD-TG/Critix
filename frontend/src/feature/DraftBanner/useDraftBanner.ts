import { useRef, useState } from "react";
import { useApp } from "@/context/AppContext";
import { useUi } from "@/context/UiContext";
import { api } from "@/api";
import { copy } from "@/shared";
import {
  computeProjectDiff,
  isCurrentSnapshot,
  type Snapshot,
} from "@/requestState";
import { useRequestGate } from "@/useRequestGate";
import type { Project, Result } from "@/types";

export function useDraftBanner() {
  const {
    draft,
    saved,
    preview,
    dirty,
    busy,
    list,
    setDraft,
    setSaved,
    setPreview,
    setError,
    accept,
  } = useApp();
  const { setShowScenarioModal } = useUi();
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [conflictState, setConflict] = useState<{
    id: string;
    serverResult: Result | null;
    valid: () => boolean;
  } | null>(null);
  const gate = useRequestGate(saved?.id, saved?.version);
  const pending = useRef(false);
  const latest = useRef<Snapshot<Project> | null>(null);
  latest.current =
    saved && draft ? { id: saved.id, version: saved.version, draft } : null;

  const conflict =
    conflictState?.valid() && conflictState.id === saved?.id
      ? {
          ...conflictState,
          diffs:
            conflictState.serverResult && draft
              ? computeProjectDiff(draft, conflictState.serverResult.project)
              : ["Не удалось загрузить детальное состояние с сервера."],
        }
      : null;
  const affected = new Set(preview?.changes?.changed_task_ids || []);

  const handleCancel = () => {
    if (!saved || pending.current) return;
    gate.invalidate();
    setDraft(copy(saved.project));
    setPreview(null);
    setConflict(null);
    setComment("");
  };

  // Reload the project that produced 409, never the current selection implicitly.
  const fetchConflict = async (id: string, valid: () => boolean) => {
    if (!valid()) return;
    try {
      const serverResult = await api<Result>(`/projects/${id}`);
      if (valid() && latest.current?.id === id) {
        setConflict({ id, serverResult, valid: gate.watch() });
      }
    } catch {
      if (valid() && latest.current?.id === id) {
        setConflict({ id, serverResult: null, valid: gate.watch() });
      }
    }
  };

  const handlePreview = async () => {
    const captured = latest.current;
    if (!captured || pending.current) return;
    const valid = gate.capture();
    pending.current = true;
    setSimulating(true);
    try {
      const result = await api<Result>(
        `/projects/${captured.id}/simulate`,
        "POST",
        {
          version: captured.version,
          project: captured.draft,
        },
      );
      if (valid() && isCurrentSnapshot(captured, latest.current)) {
        setPreview(result);
        setConflict(null);
      }
    } catch (error: any) {
      if (valid()) {
        if (error?.status === 409) await fetchConflict(captured.id, valid);
        else setError(error?.message || "Ошибка симуляции");
      }
    } finally {
      pending.current = false;
      setSimulating(false);
    }
  };

  const save = async (overwrite: boolean) => {
    const captured = latest.current;
    if (!captured || pending.current) return;
    if (overwrite && (!conflict?.serverResult || conflict.id !== captured.id))
      return;
    const targetVersion = overwrite
      ? conflict!.serverResult!.version
      : captured.version;
    const valid = gate.capture();
    pending.current = true;
    setSaving(true);
    try {
      const result = await api<Result>(`/projects/${captured.id}`, "PUT", {
        version: targetVersion,
        project: captured.draft,
        comment: comment.trim() || undefined,
      });
      if (!valid()) return;
      if (isCurrentSnapshot(captured, latest.current)) accept(result);
      else {
        // Keep edits made after the submitted draft was captured.
        setSaved(result);
        setPreview(null);
      }
      setConflict(null);
      setComment("");
      await list();
    } catch (error: any) {
      if (valid()) {
        if (error?.status === 409) await fetchConflict(captured.id, valid);
        else setError(error?.message || "Ошибка сохранения");
      }
    } finally {
      pending.current = false;
      setSaving(false);
    }
  };

  const handleReloadServer = async () => {
    const captured = latest.current;
    if (!conflict || !captured || pending.current) return;
    if (conflict.serverResult) {
      gate.invalidate();
      accept(conflict.serverResult);
      setConflict(null);
      return;
    }
    const valid = gate.capture();
    pending.current = true;
    setSimulating(true);
    try {
      const result = await api<Result>(`/projects/${captured.id}`);
      if (valid() && isCurrentSnapshot(captured, latest.current)) {
        accept(result);
        setConflict(null);
      }
    } catch (error: any) {
      if (valid()) setError(error?.message || "Не удалось загрузить проект");
    } finally {
      pending.current = false;
      setSimulating(false);
    }
  };

  return {
    draft,
    saved,
    preview,
    dirty,
    busy: busy || saving || simulating,
    saving,
    simulating,
    affected,
    conflict,
    comment,
    setComment,
    openScenarioModal: () => setShowScenarioModal(true),
    handleCancel,
    handlePreview,
    handleApply: () => save(false),
    handleOverwriteServer: () => save(true),
    handleReloadServer,
    handleDismissConflict: () => setConflict(null),
  };
}

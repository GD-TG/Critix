import { useEffect, useState } from "react";
import { useApp } from "@/context/AppContext";
import { api } from "@/api";
import { formatDateTime, getZone } from "@/shared";
import type { HistoryEntry } from "@/types";

export function useHistoryPanel() {
  const { draft, saved, accept, showNotification, run } = useApp();

  const zone = getZone(draft, saved);
  const date = (iso?: string) => (iso ? formatDateTime(iso, zone) : "—");

  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historyError, setHistoryError] = useState("");
  const [revertingId, setRevertingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setHistory([]);
    setHistoryError("");
    if (saved)
      void api<HistoryEntry[]>(`/projects/${saved.id}/history`)
        .then((data) => {
          if (!cancelled) setHistory(data);
        })
        .catch(() => {
          if (!cancelled) setHistoryError("Не удалось загрузить историю версий");
        });
    return () => {
      cancelled = true;
    };
  }, [saved?.id, saved?.version]);

  const handleRevert = async (changeId: string, version: number) => {
    if (!saved) return;
    setRevertingId(changeId);
    try {
      const res = await run(() =>
        api<import("@/types").Result>(`/projects/${saved.id}/history/${changeId}/revert`, "POST")
      );
      if (res) {
        accept(res, true);
        showNotification(`Проект успешно откатан к версии v${version}`);
      }
    } catch {
      showNotification("Ошибка отката к выбранной версии");
    } finally {
      setRevertingId(null);
    }
  };

  return { history, historyError, date, handleRevert, revertingId, currentVersion: saved?.version };
}

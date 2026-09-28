import { useEffect, useState } from "react";
import { useApp } from "@/context/AppContext";
import { api } from "@/api";
import { formatDateTime, getZone } from "@/shared";
import type { HistoryEntry } from "@/types";

export function useHistoryPanel() {
  const { draft, saved } = useApp();

  const zone = getZone(draft, saved);
  const date = (iso?: string) => (iso ? formatDateTime(iso, zone) : "—");

  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historyError, setHistoryError] = useState("");

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

  return { history, historyError, date };
}

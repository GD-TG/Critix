import { useEffect, useRef, useState } from "react";
import { useRequestGate } from "@/useRequestGate";
import { useProjects } from "@/context/ProjectContext";
import { useUi } from "@/context/UiContext";
import { api } from "@/api";

export function useAiView() {
  const { saved, draft, dirty, aiText, setAiText, aiReport, setAiReport } =
    useProjects();
  const { activeView, setActiveView } = useUi();

  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState("");
  const pending = useRef(false);
  const gate = useRequestGate(saved?.id, saved?.version, draft);
  useEffect(() => {
    setAiError("");
  }, [saved?.id, saved?.version, draft]);

  const generateAudit = async () => {
    if (!saved || dirty || pending.current) return;
    const isCurrent = gate.capture();
    pending.current = true;
    setAiError("");
    setAiBusy(true);
    try {
      const res = await api<{
        available: boolean;
        source?: "llm" | "engine";
        text: string;
      }>(`/projects/${saved.id}/ai`, "POST");
      const report = {
        available: res.available,
        source: res.source || (res.available ? "llm" : "engine"),
        text: res.text,
      };
      if (isCurrent()) {
        setAiText(res.text);
        setAiReport(report);
      }
    } catch (error) {
      if (isCurrent())
        setAiError(
          error instanceof Error ? error.message : "Не удалось получить отчёт",
        );
    } finally {
      pending.current = false;
      setAiBusy(false);
    }
  };

  return {
    saved,
    draft,
    aiText,
    aiReport,
    aiBusy,
    aiError,
    dirty,
    activeView,
    setActiveView,
    generateAudit,
  };
}

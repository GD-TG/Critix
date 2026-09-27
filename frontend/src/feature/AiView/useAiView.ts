import { useState } from "react";
import { useProjects } from "@/context/ProjectContext";
import { useUi } from "@/context/UiContext";
import { api } from "@/api";

export function useAiView() {
  const { saved, draft, run, aiText, setAiText } = useProjects();
  const { activeView, setActiveView } = useUi();

  const [aiBusy, setAiBusy] = useState(false);

  const generateAudit = () => {
    if (!saved) return;
    void run(async () => {
      setAiBusy(true);
      try {
        const res = await api<{ available: boolean; text: string }>(
          `/projects/${saved.id}/ai`,
          "POST",
        );
        setAiText(res.text);
      } finally {
        setAiBusy(false);
      }
    });
  };

  return {
    saved,
    draft,
    aiText,
    aiBusy,
    activeView,
    setActiveView,
    generateAudit,
  };
}
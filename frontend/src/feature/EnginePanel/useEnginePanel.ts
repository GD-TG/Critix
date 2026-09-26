import { useApp } from "@/context/AppContext";
import { getZone } from "@/shared";

export function useEnginePanel() {
  const { draft, saved, preview, setSettingsTab, setSettings } = useApp();

  const view = preview || saved;
  const zone = getZone(draft, saved);

  return { draft, view, preview, zone, setSettingsTab, setSettings };
}

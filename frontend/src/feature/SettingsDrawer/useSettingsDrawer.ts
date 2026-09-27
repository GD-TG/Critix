import { useProjects } from "@/context/ProjectContext";
import { useUi } from "@/context/UiContext";
import { useAuth } from "@/context/AuthContext";
import { formatDateTime, getZone } from "@/shared";

export function useSettingsDrawer() {
  const { draft, saved, preview, dirty, change, view } = useProjects();
  const { settings, setSettings, settingsTab, setSettingsTab, setActiveView, showNotification } = useUi();
  const { setError } = useAuth();

  const zone = getZone(draft, saved);
  const date = (iso: string) => formatDateTime(iso, zone);

  const handleSaveBaseline = () => {
    if (!draft || !view) return;
    if (dirty && !preview) {
      setError("Сначала рассчитайте последствия черновика, затем фиксируйте базовый план");
      return;
    }
    const taskMap: Record<string, { start: string; finish: string }> = {};
    for (const r of view.analysis.tasks) {
      taskMap[r.id] = { start: r.start, finish: r.finish };
    }
    change({
      ...draft,
      baseline: {
        saved_at: new Date().toISOString(),
        finish: view.analysis.finish,
        tasks: taskMap,
      },
    });
    showNotification("Базовый план добавлен в черновик. Сохраните изменения.");
  };

  const goToTeam = () => {
    setSettings(false);
    setActiveView("team");
  };

  return {
    draft,
    change,
    settings,
    setSettings,
    settingsTab,
    setSettingsTab,
    date,
    handleSaveBaseline,
    goToTeam,
  };
}
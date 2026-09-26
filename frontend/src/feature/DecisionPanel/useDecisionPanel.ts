import { useApp } from "@/context/AppContext";

export function useDecisionPanel() {
  const { setShowScenarioModal } = useApp();

  return { setShowScenarioModal };
}

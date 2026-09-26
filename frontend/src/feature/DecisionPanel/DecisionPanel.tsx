import { ArrowRight } from "lucide-react";
import { useDecisionPanel } from "./useDecisionPanel";

export function DecisionPanel() {
  const { setShowScenarioModal } = useDecisionPanel();

  return (
    <article className="panel decision-panel">
      <div className="decision-badge">КОНТРОЛЬНАЯ ТОЧКА</div>
      <h2>
        Что изменится,<br />
        <em>если опоздать?</em>
      </h2>
      <p>Измените срок задачи и сразу увидите влияние на проект.</p>
      <button className="outline-button" onClick={() => setShowScenarioModal(true)}>
        Запустить сценарий <ArrowRight size={14} />
      </button>
    </article>
  );
}

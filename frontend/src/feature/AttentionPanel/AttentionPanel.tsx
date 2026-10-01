import { AlertTriangle, ArrowRight, Check } from "lucide-react";
import { useAttentionPanel } from "./useAttentionPanel";

export function AttentionPanel() {
  const {
    draft,
    overdueTasks,
    overloadedAssigneeIds,
    shortDate,
    setTask,
    copy,
    setActiveView,
    setShowScenarioModal,
    openDecisionLabForTask,
    handleLevelResources,
  } = useAttentionPanel();

  return (
    <article className="panel attention-panel" id="risks">
      <div className="panel-header">
        <div>
          <h2>Требует внимания</h2>
          <p>Изменения и риски проекта</p>
        </div>
        <button className="round-action" onClick={() => setActiveView("ai")}>
          <ArrowRight size={17} />
        </button>
      </div>

      <div className="attention-list">
        {overdueTasks.map((t) => {
          const taskObj = draft?.tasks.find((x) => x.id === t.id);
          return (
            <div className="attention-item high" key={t.id}>
              <span className="attention-icon">
                <AlertTriangle size={13} />
              </span>
              <div>
                <strong>Задача не завершена к плановому финишу</strong>
                <p>«{taskObj?.name}» задерживается от финиша.</p>
                <div style={{ display: "flex", gap: "8px", marginTop: "4px" }}>
                  <button className="text-action" onClick={() => taskObj && setTask(copy(taskObj))}>
                    Открыть задачу <ArrowRight size={10} />
                  </button>
                  <button
                    className="text-action"
                    style={{ color: "var(--brand)", fontWeight: 600 }}
                    onClick={() => openDecisionLabForTask(t.id)}
                  >
                    Лаборатория решений <ArrowRight size={10} />
                  </button>
                </div>
              </div>
              <span className="time">{shortDate(t.finish)}</span>
            </div>
          );
        })}

        {overloadedAssigneeIds.size > 0 && (
          <div className="attention-item medium">
            <span className="attention-icon">
              <AlertTriangle size={13} />
            </span>
            <div>
              <strong>Ресурсный конфликт (&gt;100% FTE)</strong>
              <p>Обнаружена перегрузка {overloadedAssigneeIds.size} сотрудников.</p>
              <div style={{ display: "flex", gap: "8px", marginTop: "4px" }}>
                <button
                  className="text-action"
                  style={{ color: "var(--mantine-color-teal-6)", fontWeight: 600 }}
                  onClick={handleLevelResources}
                >
                  Выровнять ресурсы в движке <ArrowRight size={10} />
                </button>
                <button className="text-action" onClick={() => setActiveView("team")}>
                  В команду <ArrowRight size={10} />
                </button>
              </div>
            </div>
          </div>
        )}

        {overdueTasks.length === 0 && (
          <div className="attention-item neutral">
            <span className="attention-icon">
              <Check size={13} />
            </span>
            <div>
              <strong>Готово к проверке</strong>
              <p>Незавершённых задач с прошедшей датой финиша не обнаружено. Другие риски приведены в результатах движка.</p>
              <button className="text-action" onClick={() => setShowScenarioModal(true)}>
                Открыть <ArrowRight size={10} />
              </button>
            </div>
          </div>
        )}
      </div>
    </article>
  );
}

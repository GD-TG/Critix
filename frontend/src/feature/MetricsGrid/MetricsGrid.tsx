import { Alert, Button, Group, Text } from "@mantine/core";
import { AlertTriangle, CalendarDays, Gauge, Target } from "lucide-react";
import { copy } from "@/shared";
import { useMetricsGrid } from "./useMetricsGrid";

export function MetricsGrid() {
  const {
    draft,
    view,
    shortDate,
    completedCount,
    totalTasksCount,
    progressPercent,
    overdueTasks,
    isStale,
    staleTasks,
    baselineVarianceHours,
    daysRemaining,
    rescheduleOverdue,
    setTask,
  } = useMetricsGrid();

  if (!view || !draft) return null;

  return (
    <>
      <section className="metric-grid">
        <article className="metric-card">
          <div className="metric-top">
            <span className="metric-label">Прогресс проекта</span>
            <span className="metric-icon purple">
              <Gauge size={17} />
            </span>
          </div>
          <div className="metric-value">{progressPercent}%</div>
          <div className="progress-track">
            <span style={{ width: `${progressPercent}%` }} />
          </div>
          <div className="metric-foot">
            <span>{completedCount} из {totalTasksCount} задач</span>
            <span className="positive">В работе</span>
          </div>
        </article>

        <article className="metric-card">
          <div className="metric-top">
            <span className="metric-label">До завершения</span>
            <span className="metric-icon blue">
              <CalendarDays size={17} />
            </span>
          </div>
          <div className="metric-value">
            {daysRemaining}{" "}
            <small>дней</small>
          </div>
          <div className="metric-foot">
            <span>Финиш: {view ? shortDate(view.analysis.finish) : draft ? shortDate(draft.deadline) : "—"}</span>
            {view?.analysis.deadline_exceeded ? (
              <span className="coral-text">Превышен</span>
            ) : isStale ? (
              <span className="coral-text" style={{ color: "var(--amber, #f59f00)" }}>Прогноз устарел</span>
            ) : (
              <span className="positive">В дедлайне</span>
            )}
          </div>
        </article>

        <article className="metric-card">
          <div className="metric-top">
            <span className="metric-label">Просроченные задачи</span>
            <span className="metric-icon coral">
              <AlertTriangle size={17} />
            </span>
          </div>
          <div className={`metric-value ${overdueTasks.length > 0 ? "coral-text" : ""}`}>
            {overdueTasks.length || 0}
          </div>
          <div className="metric-foot">
            <span>
              {overdueTasks.length > 0 ? (
                <button
                  style={{ border: 0, background: "none", color: "var(--icon-strong)", cursor: "pointer", padding: 0, font: "inherit" }}
                  onClick={rescheduleOverdue}
                  disabled={!overdueTasks.some(r => !draft?.tasks.find(t => t.id === r.id)?.actual_start)}
                >
                  Перенести ещё не начатые
                </button>
              ) : (
                "Нет просрочек по расчёту"
              )}
            </span>
            <span className="metric-symbol">!</span>
          </div>
        </article>

        <article className="metric-card">
          <div className="metric-top">
            <span className="metric-label">Критический путь</span>
            <span className="metric-icon green">
              <Target size={17} />
            </span>
          </div>
          <div className="metric-value">
            {(view?.analysis.tasks || []).filter((t) => t.critical).length}{" "}
            <small>задач</small>
          </div>
          <div className="metric-foot">
            <span>
              {baselineVarianceHours !== null
                ? baselineVarianceHours > 0
                  ? `Сдвиг от эталона: +${baselineVarianceHours} ч`
                  : isStale
                  ? "Прогноз устарел"
                  : "В графике эталона"
                : "Базовый план не зафиксирован"}
            </span>
            <span className="metric-symbol">↗</span>
          </div>
        </article>
      </section>

      {isStale && staleTasks.length > 0 && (
        <Alert
          color="orange"
          icon={<AlertTriangle size={18} />}
          title="Прогноз устарел: есть незавершённые задачи с расчетным окончанием в прошлом"
          mb="md"
        >
          <Text size="xs" mb="xs">
            Расписание сохранено без фиктивного смещения дат. Чтобы восстановить достоверность прогноза, подтвердите фактическое выполнение или уточните длительность:
          </Text>
          <Group gap="xs" wrap="wrap">
            {staleTasks.map((t) => (
              <Button
                key={t.id}
                size="compact-xs"
                variant="light"
                color="orange"
                onClick={() => setTask(copy(t))}
              >
                «{t.name}» → Уточнить
              </Button>
            ))}
          </Group>
        </Alert>
      )}
    </>
  );
}

import { ChevronDown, ChevronRight, List, SlidersHorizontal } from "lucide-react";
import { useTimelinePanel } from "./useTimelinePanel";

export function TimelinePanel() {
  const {
    draft,
    zone,
    date,
    shortDate,
    formatMinutes,
    formatWorkDuration,
    timelineMode,
    setTimelineMode,
    dependencyVisible,
    setDependencyVisible,
    rows,
    projStartMs,
    projTotalMs,
    timelineTicks,
    timelineHeading,
    todayMarkerPercent,
    getAvatarClass,
    getInitials,
    statusLabels,
    priorityLabels,
    setTask,
    copy,
    setActiveView,
  } = useTimelinePanel();

  return (
    <article className="panel timeline-panel" id="timeline">
      <div className="panel-header">
        <div>
          <h2>План проекта</h2>
          <p>Последовательность работ, базовый план и зависимости</p>
        </div>
        <div className="view-tabs">
          <button
            className={`view-tab ${timelineMode === "timeline" ? "active" : ""}`}
            onClick={() => setTimelineMode("timeline")}
          >
            Timeline
          </button>
          <button
            className={`view-tab ${timelineMode === "list" ? "active" : ""}`}
            onClick={() => setTimelineMode("list")}
          >
            <List size={12} /> Список
          </button>
        </div>
      </div>

      <div className="timeline-toolbar">
        <div className="legend">
          <span><i className="legend-dot done" />Завершено</span>
          <span><i className="legend-dot progress" />В работе</span>
          <span><i className="legend-dot planned" />Запланировано</span>
          <span><i className="legend-dot critical" />Критический путь</span>
          <span><span style={{ color: "var(--brand)", marginRight: 4 }}>◆</span>Веха (0 ч)</span>
          {draft?.baseline && (
            <span style={{ opacity: 0.8 }}><i style={{ width: 8, height: 2, borderBottom: "1px dashed #8994a4", display: "inline-block", marginRight: 4 }} />Базовый план</span>
          )}
        </div>
        <button className="filter-button" onClick={() => setActiveView("tasks_table")}>
          <SlidersHorizontal size={12} /> Таблица задач <ChevronDown size={12} />
        </button>
      </div>

      {timelineMode === "timeline" ? (
        <div className="timeline">
          <div className="timeline-head">
            <div className="task-heading">ЗАДАЧА</div>
            <div className="date-heading">
              {timelineHeading}
              <div className="dates">
                {timelineTicks.map((tick, i) => (
                  <span key={i} title={tick.full}>
                    {tick.day}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {(draft?.tasks || []).map((t) => {
            const r = rows.get(t.id);
            if (!r) return null;
            const person = draft?.assignees.find((p) => p.id === t.assignee_id);
            const tStartMs = new Date(r.start).getTime();
            const tEndMs = new Date(r.finish).getTime();

            const leftPct = Math.max(0, Math.min(85, ((tStartMs - projStartMs) / projTotalMs) * 85));
            const widthPct = Math.max(0.3, Math.min(85 - leftPct, ((tEndMs - tStartMs) / projTotalMs) * 85));

            let baseLeftPct = 0;
            let baseWidthPct = 0;
            if (draft?.baseline && draft.baseline.tasks[t.id]) {
              const bStartMs = new Date(draft.baseline.tasks[t.id].start).getTime();
              const bEndMs = new Date(draft.baseline.tasks[t.id].finish).getTime();
              baseLeftPct = Math.max(0, Math.min(85, ((bStartMs - projStartMs) / projTotalMs) * 85));
              baseWidthPct = Math.max(0.3, Math.min(85 - baseLeftPct, ((bEndMs - bStartMs) / projTotalMs) * 85));
            }

            const statusClass = t.status === "done" ? "done" : t.status === "in_progress" ? "progress" : "planned";
            const isMilestone = t.duration_minutes === 0;

            return (
              <div className="task-row" key={t.id} onClick={() => setTask(copy(t))} style={{ cursor: "pointer" }}>
                <div className="task-info">
                  <span className={`avatar mini-avatar ${person ? getAvatarClass(person.id) : "avatar-ink"}`}>
                    {person ? getInitials(person.name) : "—"}
                  </span>
                  <div>
                    <span className="task-name">{t.name}</span>
                    <span className="task-meta">
                      <i className={`task-status-dot ${statusClass}`} />
                      {statusLabels[t.status]} · {person?.role ? `${person.role} · ` : ""}{formatWorkDuration(t.duration_minutes, isMilestone)}
                    </span>
                  </div>
                </div>

                <div className="task-chart">
                  {draft?.baseline && draft.baseline.tasks[t.id] && (
                    <span
                      className="baseline-bar"
                      style={{ left: `${baseLeftPct}%`, width: `${baseWidthPct}%` }}
                      title={`Базовый эталон: ${date(draft.baseline.tasks[t.id].start)} → ${date(draft.baseline.tasks[t.id].finish)}`}
                    />
                  )}

                  {isMilestone ? (
                    <span
                      className={`task-milestone-marker ${statusClass} ${r.critical ? "critical" : ""}`}
                      style={{ left: `${leftPct}%` }}
                      title={`Веха: ${t.name} (${date(r.start)})`}
                    >
                      ◆
                    </span>
                  ) : (
                    <span
                      className={`task-bar ${statusClass} ${r.critical ? "critical" : ""}`}
                      style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                    >
                      {formatWorkDuration(t.duration_minutes, false)}
                    </span>
                  )}
                  {dependencyVisible && (draft?.dependencies || []).some((d) => d.successor_id === t.id) && (
                    <span className="task-connector" />
                  )}
                  {todayMarkerPercent !== null && (
                    <span
                      className="today-marker"
                      style={{ left: `${todayMarkerPercent}%` }}
                      title={`Сегодня: ${shortDate(new Date().toISOString())}`}
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="list-view-container">
          <div className="list-view-header">
            <span className="col-task">Задача</span>
            <span className="col-assignee">Исполнитель</span>
            <span className="col-status">Статус</span>
            <span className="col-priority">Приоритет</span>
            <span className="col-duration">Длит.</span>
            <span className="col-dates">Сроки CPM</span>
            <span className="col-slack">Резерв</span>
            <span className="col-action" />
          </div>
          <div className="list-view-body">
            {(draft?.tasks || []).map((t) => {
              const r = rows.get(t.id);
              const person = draft?.assignees.find((p) => p.id === t.assignee_id);
              const isCritical = Boolean(r?.critical);
              const isOverdue = r?.risk_flags.includes("overdue");
              const statusClass = t.status === "done" ? "done" : t.status === "in_progress" ? "progress" : "planned";

              return (
                <div
                  className={`list-view-row ${isCritical ? "is-critical" : ""} ${isOverdue ? "is-overdue" : ""}`}
                  key={t.id}
                  onClick={() => setTask(copy(t))}
                  title="Нажмите для редактирования задачи"
                >
                  <div className="col-task">
                    <div className="list-task-name-wrap">
                      <span className="list-task-name">{t.name}</span>
                      {isCritical && <span className="cpm-tag" title="Задача на критическом пути">CPM</span>}
                      {isOverdue && <span className="overdue-tag">Просрочена</span>}
                    </div>
                    {t.required_skills && t.required_skills.length > 0 && (
                      <div className="list-task-skills">
                        {t.required_skills.map((s, idx) => (
                          <span key={idx} className="skill-chip">{s}</span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="col-assignee">
                    {person ? (
                      <div className="list-person">
                        <span className={`avatar mini-avatar ${getAvatarClass(person.id)}`}>
                          {getInitials(person.name)}
                        </span>
                        <div className="list-person-details">
                          <span className="list-person-name">{person.name}</span>
                          <span className="list-person-role">{person.role || "Участник"}</span>
                        </div>
                      </div>
                    ) : (
                      <span className="list-unassigned">Не назначен</span>
                    )}
                  </div>

                  <div className="col-status">
                    <span className={`status-pill ${statusClass}`}>
                      <i className={`task-status-dot ${statusClass}`} />
                      {statusLabels[t.status]}
                    </span>
                  </div>

                  <div className="col-priority">
                    <span className={`priority-tag ${t.priority || "medium"}`}>
                      {priorityLabels[t.priority || "medium"]}
                    </span>
                  </div>

                  <div className="col-duration">
                    <span className="duration-val">{formatWorkDuration(t.duration_minutes, t.duration_minutes === 0)}</span>
                    <span className="duration-sub">{t.allocation_percent || 100}% закр.</span>
                  </div>

                  <div className="col-dates">
                    {r ? (
                      <div className="list-date-wrap">
                        <span>{shortDate(r.start)}</span>
                        <span className="date-arrow">→</span>
                        <span className={isOverdue ? "coral-text" : ""}>{shortDate(r.finish)}</span>
                      </div>
                    ) : (
                      <span className="list-unassigned">—</span>
                    )}
                  </div>

                  <div className="col-slack">
                    {isCritical ? (
                      <span className="slack-badge critical" title="Критический путь">
                        Крит. путь
                      </span>
                    ) : r?.slack_minutes != null ? (
                      <span className="slack-badge non-critical" title={`Свободный резерв: ${formatWorkDuration(r.slack_minutes)}`}>
                        +{Math.round(r.slack_minutes / 60)} ч.
                      </span>
                    ) : (
                      <span className="slack-badge">—</span>
                    )}
                  </div>

                  <div className="col-action">
                    <button className="list-row-btn" title="Редактировать">
                      <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="timeline-footer">
        <span>Сегодня, {new Date().toLocaleDateString("ru-RU", { timeZone: zone, day: "numeric", month: "long", year: "numeric" })}</span>
        <span className="today-line" />
        <span>
          Показать зависимости{" "}
          <button
            className={`toggle ${dependencyVisible ? "active" : ""}`}
            onClick={() => setDependencyVisible(!dependencyVisible)}
          >
            <span />
          </button>
        </span>
      </div>
    </article>
  );
}

import { ChevronRight, List, Target } from "lucide-react";
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
    rows,
    timelineStartMs,
    timelineTotalMs,
    timelineDays,
    timelineMonths,
    todayMarkerPercent,
    deadlineMarkerPercent,
    taskDependencyCounts,
    getAvatarClass,
    getInitials,
    statusLabels,
    setTask,
    copy,
  } = useTimelinePanel();

  return (
    <article className="panel timeline-panel" id="timeline">
      <div className="panel-header">
        <div>
          <h2>План проекта</h2>
          <p>Календарная шкала, критический путь и резервы времени</p>
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
          <span><span style={{ display: "inline-block", width: 10, height: 10, background: "rgba(0,0,0,0.06)", border: "1px solid var(--line)", marginRight: 4, verticalAlign: "middle" }} />Выходные</span>
          {deadlineMarkerPercent !== null && (
            <span><i style={{ width: 8, height: 2, background: "var(--red)", display: "inline-block", marginRight: 4, verticalAlign: "middle" }} />Дедлайн</span>
          )}
          {draft?.baseline && (
            <span style={{ opacity: 0.8 }}><i style={{ width: 8, height: 2, borderBottom: "1px dashed #8994a4", display: "inline-block", marginRight: 4 }} />Базовый план</span>
          )}
        </div>
      </div>

      {timelineMode === "timeline" ? (
        <div className="timeline-scroll-wrap">
          <div className="timeline">
            {/* ШАПКА КАЛЕНДАРЯ: Месяцы и дни недели с точным позиционированием */}
            <div className="timeline-head" style={{ height: "48px" }}>
              <div className="task-heading" style={{ display: "flex", alignItems: "center" }}>ЗАДАЧА</div>
              <div style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden" }}>
                {/* Месяцы */}
                <div style={{ position: "absolute", top: 3, left: 0, right: 0, height: 18, borderBottom: "1px solid var(--line)" }}>
                  {timelineMonths.map((m, idx) => (
                    <div
                      key={`month-${idx}`}
                      style={{
                        position: "absolute",
                        left: `${m.pctStart}%`,
                        width: `${m.pctWidth}%`,
                        fontSize: 9,
                        fontWeight: 700,
                        color: "var(--muted)",
                        paddingLeft: 6,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {m.name}
                    </div>
                  ))}
                </div>

                {/* Дни недели и числа */}
                <div style={{ position: "absolute", top: 22, left: 0, right: 0, bottom: 0 }}>
                  {timelineDays.map((d) => (
                    <div
                      key={d.key}
                      title={`${d.weekday}, ${d.dayNum} ${d.month} (${d.isWeekend ? "Выходной" : "Рабочий день"})`}
                      style={{
                        position: "absolute",
                        left: `${d.pctStart}%`,
                        width: `${d.pctWidth}%`,
                        height: "100%",
                        borderLeft: "1px solid var(--line)",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 8,
                        color: d.isToday ? "var(--brand)" : d.isWeekend ? "var(--muted)" : "var(--ink)",
                        fontWeight: d.isToday ? 800 : d.isWeekend ? 500 : 700,
                        background: d.isWeekend ? "rgba(0,0,0,0.03)" : undefined,
                      }}
                    >
                      <span style={{ fontSize: 7, textTransform: "uppercase", opacity: 0.7 }}>{d.weekday}</span>
                      <span>{d.dayNum}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* СТРОКИ ЗАДАЧ: 100% честный масштаб */}
            {(draft?.tasks || []).map((t) => {
              const r = rows.get(t.id);
              if (!r) return null;
              const person = draft?.assignees.find((p) => p.id === t.assignee_id);
              const tStartMs = new Date(r.start).getTime();
              const tEndMs = new Date(r.finish).getTime();

              const leftPct = Math.max(0, Math.min(100, ((tStartMs - timelineStartMs) / timelineTotalMs) * 100));
              const widthPct = Math.max(0.4, Math.min(100 - leftPct, ((tEndMs - tStartMs) / timelineTotalMs) * 100));

              let baseLeftPct = 0;
              let baseWidthPct = 0;
              if (draft?.baseline && draft.baseline.tasks[t.id]) {
                const bStartMs = new Date(draft.baseline.tasks[t.id].start).getTime();
                const bEndMs = new Date(draft.baseline.tasks[t.id].finish).getTime();
                baseLeftPct = Math.max(0, Math.min(100, ((bStartMs - timelineStartMs) / timelineTotalMs) * 100));
                baseWidthPct = Math.max(0.4, Math.min(100 - baseLeftPct, ((bEndMs - bStartMs) / timelineTotalMs) * 100));
              }

              const statusClass = t.status === "done" ? "done" : t.status === "in_progress" ? "progress" : "planned";
              const isMilestone = t.duration_minutes === 0;
              const depCounts = taskDependencyCounts.get(t.id);
              const totalDeps = (depCounts?.incoming || 0) + (depCounts?.outgoing || 0);

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
                        {totalDeps > 0 && (
                          <span style={{ marginLeft: 6, fontWeight: 600, color: "var(--muted)" }} title={`Связи: ${depCounts?.incoming} предш. / ${depCounts?.outgoing} след.`}>
                            🔗 {totalDeps}
                          </span>
                        )}
                        {r.critical && (
                          <span style={{ color: "var(--red)", fontWeight: 700, marginLeft: 6 }}>
                            CPM (0 ч)
                          </span>
                        )}
                      </span>
                    </div>
                  </div>

                  <div className="task-chart">
                    {/* Выходные дни (штриховка) */}
                    {timelineDays.map((d) =>
                      d.isWeekend ? (
                        <div
                          key={`bg-${d.key}`}
                          className="weekend-col"
                          style={{ left: `${d.pctStart}%`, width: `${d.pctWidth}%` }}
                        />
                      ) : null
                    )}

                    {/* Вертикальные разделители дней */}
                    {timelineDays.map((d) => (
                      <div
                        key={`line-${d.key}`}
                        className="day-grid-line"
                        style={{ left: `${d.pctStart}%` }}
                      />
                    ))}

                    {/* Дедлайн проекта */}
                    {deadlineMarkerPercent !== null && (
                      <div
                        className="deadline-marker"
                        style={{ left: `${deadlineMarkerPercent}%` }}
                        title={draft?.deadline ? `Дедлайн проекта: ${shortDate(draft.deadline)}` : "Дедлайн проекта"}
                      />
                    )}

                    {/* Маркер "Сегодня" */}
                    {todayMarkerPercent !== null && (
                      <span
                        className="today-marker"
                        style={{ left: `${todayMarkerPercent}%` }}
                        title={`Сегодня: ${shortDate(new Date().toISOString())}`}
                      />
                    )}

                    {/* Базовый эталон (пунктир) */}
                    {draft?.baseline && draft.baseline.tasks[t.id] && (
                      <span
                        className="baseline-bar"
                        style={{ left: `${baseLeftPct}%`, width: `${baseWidthPct}%` }}
                        title={`Базовый план: ${date(draft.baseline.tasks[t.id].start)} → ${date(draft.baseline.tasks[t.id].finish)}`}
                      />
                    )}

                    {/* Полоса задачи */}
                    {isMilestone ? (
                      <span
                        className={`task-milestone-marker ${statusClass} ${r.critical ? "critical" : ""}`}
                        style={{ left: `${leftPct}%` }}
                        title={`Веха: «${t.name}» (${date(r.start)})`}
                      >
                        ◆
                      </span>
                    ) : (
                      <span
                        className={`task-bar ${statusClass} ${r.critical ? "critical" : ""}`}
                        style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                        title={`«${t.name}»: ${date(r.start)} → ${date(r.finish)} · ${formatWorkDuration(t.duration_minutes, false)}${r.critical ? " (Критический путь)" : ""}`}
                      >
                        {formatWorkDuration(t.duration_minutes, false)}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* РЕЖИМ СПИСКА */
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
                  </div>

                  <div className="col-assignee">
                    {person ? (
                      <span className="list-assignee-chip">
                        <span className={`avatar mini-avatar ${getAvatarClass(person.id)}`}>
                          {getInitials(person.name)}
                        </span>
                        <span className="assignee-name">{person.name}</span>
                      </span>
                    ) : (
                      <span className="unassigned-text">—</span>
                    )}
                  </div>

                  <div className="col-status">
                    <span className={`status-pill ${statusClass}`}>
                      <i className={`task-status-dot ${statusClass}`} />
                      {statusLabels[t.status]}
                    </span>
                  </div>

                  <div className="col-priority">
                    <span className={`priority-tag ${t.priority}`}>
                      {t.priority}
                    </span>
                  </div>

                  <div className="col-duration">
                    {formatWorkDuration(t.duration_minutes, t.duration_minutes === 0)}
                  </div>

                  <div className="col-dates">
                    {r ? (
                      <span className="cpm-dates">
                        {shortDate(r.start)} → {shortDate(r.finish)}
                      </span>
                    ) : (
                      "—"
                    )}
                  </div>

                  <div className="col-slack">
                    {r ? (
                      isCritical ? (
                        <span className="slack-zero">0 ч</span>
                      ) : r.slack_minutes !== null ? (
                        <span className="slack-positive">+{formatWorkDuration(r.slack_minutes)}</span>
                      ) : (
                        "—"
                      )
                    ) : (
                      "—"
                    )}
                  </div>

                  <div className="col-action">
                    <ChevronRight size={14} className="row-chevron" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </article>
  );
}

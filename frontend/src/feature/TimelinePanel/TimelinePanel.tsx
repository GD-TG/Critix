import { useMemo, useState } from "react";
import { Badge, Box, Button, Group, Popover, ScrollArea, Stack, Text } from "@mantine/core";
import { ArrowLeft, ArrowRight, ChevronRight, List, Plus, ShieldAlert } from "lucide-react";
import { useTimelinePanel } from "./useTimelinePanel";

export function TimelinePanel() {
  const {
    draft,
    date,
    shortDate,
    formatWorkDuration,
    timelineMode,
    setTimelineMode,
    rows,
    savedRows,
    view,
    dirty,
    timelineStartMs,
    timelineTotalMs,
    timelineDays,
    timelineMonths,
    todayMarkerPercent,
    deadlineMarkerPercent,
    taskDependencyCounts,
    dependenciesDetailed,
    hoveredTaskId,
    setHoveredTaskId,
    activeDepTaskId,
    setActiveDepTaskId,
    draggingTaskId,
    dragDeltaDays,
    handleBarMouseDown,
    handleTaskClick,
    chartContainerRef,
    getAvatarClass,
    getInitials,
    statusLabels,
    addTask,
    setTask,
    copy,
  } = useTimelinePanel();

  const rootCauseTaskId = useMemo(() => {
    if (!draft || !view?.analysis.deadline_exceeded) return null;
    const dlMs = new Date(draft.deadline).getTime();
    const criticalTasks = draft.tasks.filter((t) => rows.get(t.id)?.critical);
    const breachTask = criticalTasks.find((t) => {
      const r = rows.get(t.id);
      return r && new Date(r.finish).getTime() > dlMs;
    });
    return breachTask?.id || criticalTasks[criticalTasks.length - 1]?.id || null;
  }, [draft, view?.analysis.deadline_exceeded, rows]);

  return (
    <article className="panel timeline-panel" id="timeline" style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <div className="panel-header" style={{ padding: "8px 16px", alignItems: "center" }}>
        <Group gap="xs" align="center">
          <h2 style={{ fontSize: 16, margin: 0 }}>График задач</h2>
          {draft && (
            <Badge variant="subtle" color="gray" size="sm">
              {draft.tasks.length} задач
            </Badge>
          )}
        </Group>
        <Group gap="xs">
          <Button
            size="xs"
            variant="filled"
            style={{ backgroundColor: "#1e293b", color: "#fff" }}
            leftSection={<Plus size={14} />}
            onClick={addTask}
          >
            Добавить задачу
          </Button>
          <div className="view-tabs">
            <button
              className={`view-tab ${timelineMode === "timeline" ? "active" : ""}`}
              onClick={() => setTimelineMode("timeline")}
            >
              Гант
            </button>
            <button
              className={`view-tab ${timelineMode === "list" ? "active" : ""}`}
              onClick={() => setTimelineMode("list")}
            >
              <List size={12} /> Список
            </button>
          </div>
        </Group>
      </div>

      <div className="timeline-toolbar" style={{ padding: "4px 12px", borderBottom: "1px solid var(--line)" }}>
        <div className="legend" style={{ fontSize: "11px", gap: "10px" }}>
          <span><i className="legend-dot done" />Завершено</span>
          <span><i className="legend-dot progress" />В работе</span>
          <span><i className="legend-dot planned" />Запланировано</span>
          <span><i className="legend-dot critical" />Критический путь (CPM)</span>
          <span><i style={{ width: 10, height: 2, borderTop: "2px dashed #3eac7d", display: "inline-block", marginRight: 4, verticalAlign: "middle" }} />Свободный буфер (&gt;3 дн)</span>
          <span><i style={{ width: 10, height: 2, borderTop: "2px dashed #e5ad5b", display: "inline-block", marginRight: 4, verticalAlign: "middle" }} />Узкий буфер (1-3 дн)</span>
          {dirty && (
            <span><i style={{ width: 10, height: 8, border: "1px dashed var(--muted)", display: "inline-block", marginRight: 4, verticalAlign: "middle", background: "rgba(140,150,175,0.18)" }} />Было (исходный)</span>
          )}
          {deadlineMarkerPercent !== null && (
            <span><i style={{ width: 8, height: 2, background: "var(--red)", display: "inline-block", marginRight: 4, verticalAlign: "middle" }} />Дедлайн</span>
          )}
        </div>
      </div>

      {timelineMode === "timeline" ? (
        <div className="timeline-scroll-wrap" style={{ flex: 1, minHeight: 480, overflowY: "auto" }}>
          <div className="timeline" style={{ position: "relative" }} ref={chartContainerRef}>
            {/* ШАПКА КАЛЕНДАРЯ */}
            <div className="timeline-head" style={{ height: "48px" }}>
              <div className="task-heading" style={{ display: "flex", alignItems: "center" }}>ЗАДАЧА / ИСПОЛНИТЕЛЬ</div>
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
                        fontSize: 11,
                        fontWeight: 700,
                        color: "var(--ink)",
                        opacity: 0.85,
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
                      key={`col-${d.key}`}
                      style={{
                        position: "absolute",
                        left: `${d.pctStart}%`,
                        width: `${d.pctWidth}%`,
                        textAlign: "center",
                        fontSize: 10,
                        color: d.isWeekend ? "var(--red)" : "var(--muted)",
                        background: d.isWeekend ? "rgba(0,0,0,0.02)" : "transparent",
                        borderRight: "1px solid var(--line)",
                        height: "100%",
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "center",
                      }}
                    >
                      <span style={{ fontWeight: 700, fontSize: 11 }}>{d.dayNum}</span>
                      <span style={{ fontSize: 9, opacity: 0.9 }}>{d.weekday}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* СЕТКА НА ЗАДНЕМ ПЛАНЕ ДЛЯ ВСЕХ СТРОК (Оптимизация производительности) */}
            <div
              style={{
                position: "absolute",
                top: 48,
                bottom: 0,
                left: 280, // ширина колонки названий задач
                right: 0,
                pointerEvents: "none",
                zIndex: 0,
              }}
            >
              {timelineDays.map((d) =>
                d.isWeekend ? (
                  <div
                    key={`bg-grid-${d.key}`}
                    className="weekend-col"
                    style={{ left: `${d.pctStart}%`, width: `${d.pctWidth}%` }}
                  />
                ) : null
              )}
              {timelineDays.map((d) => (
                <div
                  key={`line-grid-${d.key}`}
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
                >
                  <div className="deadline-flag">
                    🚩 Дедлайн {draft?.deadline ? shortDate(draft.deadline) : ""}
                  </div>
                </div>
              )}

              {/* Маркер "Сегодня" */}
              {todayMarkerPercent !== null && (
                <span
                  className="today-marker"
                  style={{ left: `${todayMarkerPercent}%` }}
                  title={`Сегодня: ${shortDate(new Date().toISOString())}`}
                />
              )}
            </div>

            {/* СПИСОК ЗАДАЧ */}
            {(draft?.tasks || []).map((t) => {
              const r = rows.get(t.id);
              if (!r) return null;
              const person = draft?.assignees.find((p) => p.id === t.assignee_id);
              const tStartMs = new Date(r.start).getTime();
              const tEndMs = new Date(r.finish).getTime();

              const leftPct = Math.max(0, Math.min(100, ((tStartMs - timelineStartMs) / timelineTotalMs) * 100));
              const widthPct = Math.max(0.4, Math.min(100 - leftPct, ((tEndMs - tStartMs) / timelineTotalMs) * 100));

              // Базовый эталон (пунктир)
              let baseLeftPct = 0;
              let baseWidthPct = 0;
              if (draft?.baseline && draft.baseline.tasks[t.id]) {
                const bStartMs = new Date(draft.baseline.tasks[t.id].start).getTime();
                const bEndMs = new Date(draft.baseline.tasks[t.id].finish).getTime();
                baseLeftPct = Math.max(0, Math.min(100, ((bStartMs - timelineStartMs) / timelineTotalMs) * 100));
                baseWidthPct = Math.max(0.4, Math.min(100 - baseLeftPct, ((bEndMs - bStartMs) / timelineTotalMs) * 100));
              }

              // Призрачная полоса (Ghost bar) "Было", если черновик изменён
              const savedR = savedRows.get(t.id);
              let showGhost = false;
              let ghostLeftPct = 0;
              let ghostWidthPct = 0;
              if (dirty && savedR && (savedR.start !== r.start || savedR.finish !== r.finish)) {
                const gStartMs = new Date(savedR.start).getTime();
                const gEndMs = new Date(savedR.finish).getTime();
                ghostLeftPct = Math.max(0, Math.min(100, ((gStartMs - timelineStartMs) / timelineTotalMs) * 100));
                ghostWidthPct = Math.max(0.4, Math.min(100 - ghostLeftPct, ((gEndMs - gStartMs) / timelineTotalMs) * 100));
                showGhost = true;
              }

              // Резерв времени (Float tail) для некритических задач
              const hasSlack = !r.critical && r.slack_minutes !== null && r.slack_minutes > 0;
              let tailLeftPct = leftPct + widthPct;
              let tailWidthPct = 0;
              let tailKind: "generous" | "tight" = "generous";
              if (hasSlack) {
                const slackMs = r.slack_minutes! * 60000;
                tailWidthPct = Math.max(0.2, Math.min(100 - tailLeftPct, (slackMs / timelineTotalMs) * 100));
                tailKind = r.slack_minutes! >= 3 * 8 * 60 ? "generous" : "tight";
              }

              const statusClass = t.status === "done" ? "done" : t.status === "in_progress" ? "progress" : "planned";
              const isMilestone = t.duration_minutes === 0;
              const depCounts = taskDependencyCounts.get(t.id);
              const totalDeps = (depCounts?.incoming || 0) + (depCounts?.outgoing || 0);

              const isHighlighted = hoveredTaskId === t.id;
              const isDragging = draggingTaskId === t.id;
              const depDetails = dependenciesDetailed.get(t.id);

              let dynamicWidthPct = widthPct;
              if (isDragging && dragDeltaDays !== 0) {
                const dayPct = (86400000 / timelineTotalMs) * 100;
                dynamicWidthPct = Math.max(0.5, widthPct + dragDeltaDays * dayPct);
              }

              return (
                <div
                  className="task-row"
                  key={t.id}
                  style={{
                    backgroundColor: isHighlighted ? "rgba(210, 10, 46, 0.04)" : undefined,
                    transition: "background-color 0.15s ease",
                  }}
                >
                  {/* КОЛОНКА ОПИСАНИЯ ЗАДАЧИ */}
                  <div className="task-info" onClick={() => handleTaskClick(t)} style={{ cursor: "pointer" }}>
                    <span className={`avatar mini-avatar ${person ? getAvatarClass(person.id) : "avatar-ink"}`}>
                      {person ? getInitials(person.name) : "—"}
                    </span>
                    <div>
                      <span className="task-name" style={{ fontWeight: isHighlighted ? 700 : undefined }}>
                        {t.name}
                      </span>
                      <span className="task-meta">
                        <i className={`task-status-dot ${statusClass}`} />
                        {statusLabels[t.status]} · {person?.role ? `${person.role} · ` : ""}{formatWorkDuration(t.duration_minutes, isMilestone)}

                        {/* Поповер со связями 🔗 N */}
                        {totalDeps > 0 && (
                          <span
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveDepTaskId(activeDepTaskId === t.id ? null : t.id);
                            }}
                            style={{ display: "inline-block", marginLeft: 6 }}
                          >
                            <Popover
                              opened={activeDepTaskId === t.id}
                              onClose={() => setActiveDepTaskId(null)}
                              position="bottom-start"
                              withArrow
                              shadow="md"
                            >
                              <Popover.Target>
                                <span className="dep-badge-btn" title="Показать предшественников и последователей">
                                  🔗 {totalDeps}
                                </span>
                              </Popover.Target>
                              <Popover.Dropdown p="xs" style={{ minWidth: 260, zIndex: 100 }}>
                                <Text size="xs" fw={700} c="dimmed" mb={4}>
                                  СВЯЗИ ЗАДАЧИ «{t.name}»
                                </Text>

                                {depDetails?.predecessors.length ? (
                                  <div style={{ marginBottom: 8 }}>
                                    <Text size="xs" fw={600} c="blue" mb={2}>
                                      ← Зависит от ({depDetails.predecessors.length}):
                                    </Text>
                                    <Stack gap={3}>
                                      {depDetails.predecessors.map((p) => (
                                        <Group
                                          key={`pred-${p.id}`}
                                          justify="space-between"
                                          p={2}
                                          style={{
                                            borderRadius: 4,
                                            cursor: "pointer",
                                            background: hoveredTaskId === p.id ? "rgba(210,10,46,0.08)" : "transparent",
                                          }}
                                          onMouseEnter={() => setHoveredTaskId(p.id)}
                                          onMouseLeave={() => setHoveredTaskId(null)}
                                        >
                                          <Text size="xs" style={{ flex: 1 }}>{p.name}</Text>
                                          {p.isCritical && (
                                            <Badge color="red" size="xs" variant="light">CPM</Badge>
                                          )}
                                        </Group>
                                      ))}
                                    </Stack>
                                  </div>
                                ) : (
                                  <Text size="xs" c="dimmed" mb={4}>Нет предшественников (начальная)</Text>
                                )}

                                {depDetails?.successors.length ? (
                                  <div>
                                    <Text size="xs" fw={600} c="teal" mb={2}>
                                      → Блокирует ({depDetails.successors.length}):
                                    </Text>
                                    <Stack gap={3}>
                                      {depDetails.successors.map((s) => (
                                        <Group
                                          key={`succ-${s.id}`}
                                          justify="space-between"
                                          p={2}
                                          style={{
                                            borderRadius: 4,
                                            cursor: "pointer",
                                            background: hoveredTaskId === s.id ? "rgba(210,10,46,0.08)" : "transparent",
                                          }}
                                          onMouseEnter={() => setHoveredTaskId(s.id)}
                                          onMouseLeave={() => setHoveredTaskId(null)}
                                        >
                                          <Text size="xs" style={{ flex: 1 }}>{s.name}</Text>
                                          {s.isCritical && (
                                            <Badge color="red" size="xs" variant="light">CPM</Badge>
                                          )}
                                        </Group>
                                      ))}
                                    </Stack>
                                  </div>
                                ) : (
                                  <Text size="xs" c="dimmed">Нет последователей (финишная)</Text>
                                )}
                              </Popover.Dropdown>
                            </Popover>
                          </span>
                        )}

                        {r.critical && (
                          <span style={{ color: "var(--red)", fontWeight: 700, marginLeft: 6 }}>
                            CPM (0 ч)
                          </span>
                        )}
                        {t.id === rootCauseTaskId && (
                          <span className="root-cause-tag" title="Задача на критическом пути, вызвавшая срыв контрактного дедлайна проекта">
                            🔥 Причина срыва
                          </span>
                        )}
                      </span>
                    </div>
                  </div>

                  {/* ЧАРТ-ОБЛАСТЬ ТАЙМЛАЙНА */}
                  <div className="task-chart" style={{ position: "relative" }}>
                    {/* Базовый эталон (пунктир) */}
                    {draft?.baseline && draft.baseline.tasks[t.id] && (
                      <span
                        className="baseline-bar"
                        style={{ left: `${baseLeftPct}%`, width: `${baseWidthPct}%` }}
                        title={`Базовый план: ${date(draft.baseline.tasks[t.id].start)} → ${date(draft.baseline.tasks[t.id].finish)}`}
                      />
                    )}

                    {/* Призрачная полоса "Было" при активном черновике */}
                    {showGhost && (
                      <span
                        className="ghost-bar"
                        style={{ left: `${ghostLeftPct}%`, width: `${ghostWidthPct}%` }}
                        title={`Было: ${date(savedR!.start)} → ${date(savedR!.finish)}`}
                      >
                        Было
                      </span>
                    )}

                    {/* Полоса задачи с поддержкой интерактивного Drag-What-If */}
                    {isMilestone ? (
                      <span
                        className={`task-milestone-marker ${statusClass} ${r.critical ? "critical" : ""} ${isHighlighted ? "is-highlighted" : ""}`}
                        style={{
                          left: `${leftPct}%`,
                          top: 14,
                          position: "absolute",
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          cursor: "pointer",
                          zIndex: 3,
                        }}
                        onClick={() => handleTaskClick(t)}
                        title={`Веха: «${t.name}» (${date(r.start)})`}
                      >
                        <span
                          style={{
                            width: 14,
                            height: 14,
                            transform: "rotate(45deg)",
                            background: r.critical ? "var(--red)" : "#55b287",
                            border: "2px solid #fff",
                            boxShadow: "0 2px 6px rgba(0,0,0,0.25)",
                            display: "inline-block",
                          }}
                        />
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 700,
                            color: r.critical ? "var(--red)" : "var(--ink)",
                            background: "rgba(255,255,255,0.92)",
                            padding: "1px 5px",
                            borderRadius: 3,
                            whiteSpace: "nowrap",
                            border: "1px solid var(--line)",
                          }}
                        >
                          {t.name}
                        </span>
                      </span>
                    ) : (
                      <span
                        className={`task-bar ${statusClass} ${r.critical ? "critical" : ""} is-draggable ${isDragging ? "is-dragging" : ""} ${isHighlighted ? "is-highlighted" : ""}`}
                        style={{
                          left: `${leftPct}%`,
                          width: `${dynamicWidthPct}%`,
                          ...(t.id === rootCauseTaskId ? { boxShadow: "0 0 0 2px #d20a2e, 0 4px 14px rgba(210, 10, 46, 0.45)" } : {}),
                        }}
                        onMouseDown={(e) => handleBarMouseDown(e, t)}
                        onClick={() => handleTaskClick(t)}
                        title={`«${t.name}»: ${date(r.start)} → ${date(r.finish)} · ${formatWorkDuration(t.duration_minutes, false)}${r.critical ? " (Критический путь)" : ""}. Потяните за правый край для What-If симуляции.`}
                      >
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
                          {formatWorkDuration(t.duration_minutes, false)}
                          {isDragging && dragDeltaDays !== 0 && (
                            <span style={{ marginLeft: 5, fontWeight: 700, color: dragDeltaDays > 0 ? "#fff3bf" : "#b2f2bb" }}>
                              ({dragDeltaDays > 0 ? `+${dragDeltaDays}` : dragDeltaDays} дн.)
                            </span>
                          )}
                        </span>
                        <span
                          className="task-resize-handle"
                          title="Потяните для изменения длительности задачи"
                          onMouseDown={(e) => handleBarMouseDown(e, t)}
                        />
                      </span>
                    )}

                    {/* Резерв времени: Float tail (пунктирный хвост) */}
                    {hasSlack && (
                      <span
                        className={`float-tail ${tailKind}`}
                        style={{ left: `${tailLeftPct}%`, width: `${tailWidthPct}%` }}
                        title={`Резерв времени задачи (Float): +${formatWorkDuration(r.slack_minutes!)}. Сдвиг в этих пределах безопасен для общего дедлайна.`}
                      >
                        <span className="float-tail-cap" />
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
        <div className="list-view-container" style={{ flex: 1, overflowY: "auto" }}>
          <div className="list-view-header">
            <span className="col-task">Задача</span>
            <span className="col-assignee">Исполнитель</span>
            <span className="col-status">Статус</span>
            <span className="col-priority">Приоритет</span>
            <span className="col-duration">Длит.</span>
            <span className="col-dates">Сроки CPM</span>
            <span className="col-slack">Резерв (Slack)</span>
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
                  onClick={() => handleTaskClick(t)}
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
                        <span className="slack-zero">0 ч (критическая)</span>
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

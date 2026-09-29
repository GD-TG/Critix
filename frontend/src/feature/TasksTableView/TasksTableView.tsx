import { Badge, Button, Card, Group, Table, Text, Title, Tooltip } from "@mantine/core";
import { useTasksTableView } from "@/feature/TasksTableView/useTasksTableView";

export function TasksTableView() {
  const {
    draft,
    rows,
    date,
    formatMinutes,
    formatWorkDuration,
    activeView,
    setActiveView,
    setImportModal,
    addTask,
    openTask,
    getAvatarClass,
    getInitials,
    calculateSkillMatch,
    statusLabels,
    statusColors,
    priorityLabels,
    priorityColors,
  } = useTasksTableView();

  if (activeView !== "tasks_table" || !draft) return null;

  return (
    <Card withBorder p="md">
      <Group justify="space-between" mb="md" wrap="wrap" gap="sm">
        <div>
          <Title order={3}>Полная таблица задач проекта</Title>
          <Text size="sm" c="dimmed">Кликните по задаче для детального редактирования дат, навыков, связей и причин сроков.</Text>
        </div>
        <Group gap="xs" wrap="wrap">
          <Button size="xs" onClick={addTask}>+ Добавить задачу</Button>
          <Button size="xs" variant="light" onClick={() => setImportModal(true)}>Импорт CSV</Button>
          <Button size="xs" variant="light" onClick={() => setActiveView("dashboard")}>← На Главную</Button>
        </Group>
      </Group>

      <div className="table-responsive-container">
        <Table striped highlightOnHover withTableBorder style={{ minWidth: 920 }}>
        <Table.Thead>
          <Table.Tr>
            <Table.Th style={{ width: 50 }}>ID</Table.Th>
            <Table.Th>Название задачи</Table.Th>
            <Table.Th>Приоритет</Table.Th>
            <Table.Th>Исполнитель</Table.Th>
            <Table.Th>Статус</Table.Th>
            <Table.Th>Загрузка</Table.Th>
            <Table.Th>Длительность</Table.Th>
            <Table.Th>Причина даты (Driver)</Table.Th>
            <Table.Th>Финиш CPM</Table.Th>
            <Table.Th>Финиш Эталона</Table.Th>
            <Table.Th>Сдвиг эталона</Table.Th>
            <Table.Th>Свободный резерв</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {draft.tasks.map((t) => {
            const r = rows.get(t.id);
            const person = draft.assignees.find((a) => a.id === t.assignee_id);
            const match = person ? calculateSkillMatch(t, person) : 0;
            const isOverdue = r?.risk_flags.includes("overdue");
            const baseTask = draft.baseline?.tasks[t.id];
            let deltaMinutes = 0;
            if (baseTask && r) {
              deltaMinutes = Math.round((new Date(r.finish).getTime() - new Date(baseTask.finish).getTime()) / 60000);
            }
            const deltaHours = Math.round(deltaMinutes / 60);

            // Driving constraint calculation
            let driverBadge = <Text size="xs" c="dimmed">—</Text>;
            if (t.status === "done") {
              driverBadge = <Badge size="xs" color="gray" variant="light">Факт (завершена)</Badge>;
            } else if (t.actual_start) {
              driverBadge = <Badge size="xs" color="blue" variant="light">Факт старта</Badge>;
            } else if (r?.explanation) {
              const violated = r.explanation.constraints.find((c) => c.violated);
              const driving = r.explanation.constraints.find((c) => c.driving);
              if (violated) {
                driverBadge = (
                  <Tooltip label={`Нарушено ограничение связи (${date(violated.bound)})`}>
                    <Badge size="xs" color="red">Конфликт</Badge>
                  </Tooltip>
                );
              } else if (driving) {
                if (driving.source === "dependency" && driving.dependency) {
                  const pred = draft.tasks.find((p) => p.id === driving.dependency?.predecessor_id);
                  const predName = pred ? pred.name : driving.dependency.predecessor_id;
                  driverBadge = (
                    <Tooltip label={`Определяется задачей «${predName}» (${driving.dependency.kind}, лаг ${driving.dependency.lag_minutes}м)`}>
                      <Badge size="xs" color="indigo" variant="light" style={{ maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis" }}>
                        ← {predName}
                      </Badge>
                    </Tooltip>
                  );
                } else if (driving.source === "not_before") {
                  driverBadge = (
                    <Tooltip label={`Ограничение «Не раньше» (${date(driving.bound)})`}>
                      <Badge size="xs" color="orange" variant="light">Не раньше</Badge>
                    </Tooltip>
                  );
                } else if (driving.source === "project_start") {
                  driverBadge = <Badge size="xs" color="gray" variant="light">Старт проекта</Badge>;
                }
              }
            }

            return (
              <Table.Tr key={t.id} style={{ cursor: "pointer" }} onClick={() => openTask(t)}>
                <Table.Td>{t.id}</Table.Td>
                <Table.Td fw={600}>
                  <Group gap={6}>
                    {t.duration_minutes === 0 ? (
                      <Badge size="xs" color="violet" variant="filled">
                        Веха
                      </Badge>
                    ) : r?.critical ? (
                      <Badge size="xs" color="red" variant="filled">
                        CPM
                      </Badge>
                    ) : null}
                    {isOverdue && <Badge size="xs" color="red">Просрочена</Badge>}
                    <span>{t.name}</span>
                  </Group>
                  {t.required_skills && t.required_skills.length > 0 && (
                    <Group gap={4} mt={2}>
                      {t.required_skills.map((s, idx) => (
                        <Badge key={idx} size="xs" variant="outline" color="gray">
                          {s}
                        </Badge>
                      ))}
                    </Group>
                  )}
                </Table.Td>
                <Table.Td>
                  <Badge size="xs" color={priorityColors[t.priority || "medium"]}>
                    {priorityLabels[t.priority || "medium"]}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  {person ? (
                    <Group gap={6}>
                      <span className={`avatar mini-avatar ${getAvatarClass(person.id)}`}>
                        {getInitials(person.name)}
                      </span>
                      <div>
                        <Text size="sm" fw={500}>{person.name}</Text>
                        {t.required_skills && t.required_skills.length > 0 && (
                          <Badge size="xs" color={match >= 80 ? "teal" : match >= 50 ? "yellow" : "red"}>
                            {match}% навыков
                          </Badge>
                        )}
                      </div>
                    </Group>
                  ) : (
                    <Text size="sm" c="dimmed">Не назначен</Text>
                  )}
                </Table.Td>
                <Table.Td>
                  <Badge color={statusColors[t.status]}>{statusLabels[t.status]}</Badge>
                </Table.Td>
                <Table.Td>{t.allocation_percent || 100}%</Table.Td>
                <Table.Td>{formatWorkDuration(t.duration_minutes, t.duration_minutes === 0)}</Table.Td>
                <Table.Td>{driverBadge}</Table.Td>
                <Table.Td>{r ? date(r.finish) : "—"}</Table.Td>
                <Table.Td>
                  {baseTask ? (
                    <Text size="xs" fw={500}>{date(baseTask.finish)}</Text>
                  ) : (
                    <Text size="xs" c="dimmed">Не задан</Text>
                  )}
                </Table.Td>
                <Table.Td>
                  {baseTask && r ? (
                    deltaHours > 0 ? (
                      <Badge color="red" size="xs">+{deltaHours} ч</Badge>
                    ) : deltaHours < 0 ? (
                      <Badge color="teal" size="xs">{deltaHours} ч</Badge>
                    ) : (
                      <Badge color="gray" variant="light" size="xs">0 ч</Badge>
                    )
                  ) : (
                    <Text size="xs" c="dimmed">—</Text>
                  )}
                </Table.Td>
                <Table.Td>{r?.critical ? "0 ч (Крит. путь)" : r?.slack_minutes == null ? "—" : formatWorkDuration(r.slack_minutes)}</Table.Td>
              </Table.Tr>
            );
          })}
        </Table.Tbody>
      </Table>
      </div>
    </Card>
  );
}
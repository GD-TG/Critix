import { Badge, Button, Card, Group, Table, Text, Title } from "@mantine/core";
import { useTasksTableView } from "@/feature/TasksTableView/useTasksTableView";

export function TasksTableView() {
  const {
    draft,
    rows,
    date,
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

  if (activeView !== "tasks_table") return null;

  return (
    <Card withBorder p="md">
      <Group justify="space-between" mb="md">
        <div>
          <Title order={3}>Полная таблица задач проекта</Title>
          <Text size="sm" c="dimmed">Кликните по задаче для детального редактирования дат, навыков и исполнителя.</Text>
        </div>
        <Group gap="xs">
          <Button size="xs" onClick={addTask}>+ Добавить задачу</Button>
          <Button size="xs" variant="light" onClick={() => setImportModal(true)}>Импорт CSV</Button>
          <Button size="xs" variant="light" onClick={() => setActiveView("dashboard")}>← Вернуться на Главную</Button>
        </Group>
      </Group>

      <Table striped highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Приоритет</Table.Th>
            <Table.Th>Задача</Table.Th>
            <Table.Th>Исполнитель</Table.Th>
            <Table.Th>Статус</Table.Th>
            <Table.Th>Загрузка</Table.Th>
            <Table.Th>Часы</Table.Th>
            <Table.Th>Прогноз CPM</Table.Th>
            <Table.Th>Базовый план</Table.Th>
            <Table.Th>Отклонение (Δ)</Table.Th>
            <Table.Th>Резерв</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {(draft?.tasks || []).map((t) => {
            const person = draft?.assignees.find((p) => p.id === t.assignee_id);
            const r = rows.get(t.id);
            const isOverdue = r?.risk_flags.includes("overdue");
            const skillMatch = person ? calculateSkillMatch(t, person) : null;
            const baseTask = draft?.baseline?.tasks[t.id];
            let deltaMinutes = 0;
            if (r && baseTask) {
              deltaMinutes = Math.round((new Date(r.finish).getTime() - new Date(baseTask.finish).getTime()) / 60000);
            }
            const deltaHours = Math.round(deltaMinutes / 60);

            return (
              <Table.Tr key={t.id} onClick={() => openTask(t)} style={{ cursor: "pointer" }}>
                <Table.Td>
                  <Badge size="xs" color={priorityColors[t.priority || "medium"]}>
                    {priorityLabels[t.priority || "medium"]}
                  </Badge>
                </Table.Td>
                <Table.Td fw={600}>
                  <Group gap={6}>
                    <Text size="sm" fw={600}>{t.name}</Text>
                    {isOverdue && <Badge size="xs" color="red">Просрочена</Badge>}
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
                  {person ? (
                    <Group gap="xs">
                      <span className={`avatar ${getAvatarClass(person.id)}`} style={{ width: 22, height: 22, fontSize: 8 }}>
                        {getInitials(person.name)}
                      </span>
                      <div>
                        <Text size="sm">{person.name}</Text>
                        {skillMatch !== null && (
                          <Badge size="xs" color={skillMatch >= 80 ? "teal" : skillMatch >= 50 ? "yellow" : "red"} variant="light">
                            Match {skillMatch}%
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
                <Table.Td>{t.duration_minutes / 60} ч</Table.Td>
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
                <Table.Td>{r?.slack_minutes == null ? "—" : `${r.slack_minutes / 60} ч`}</Table.Td>
              </Table.Tr>
            );
          })}
        </Table.Tbody>
      </Table>
    </Card>
  );
}
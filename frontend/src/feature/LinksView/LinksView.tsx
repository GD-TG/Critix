import { ActionIcon, Badge, Button, Card, Group, Table, Text, Title } from "@mantine/core";
import { Edit, Trash2 } from "lucide-react";
import { useLinksView } from "@/feature/LinksView/useLinksView";

export function LinksView() {
  const { draft, activeView, setActiveView, setDepModal, editDependency, removeDependency } = useLinksView();

  if (activeView !== "links") return null;

  return (
    <Card withBorder p="md">
      <Group justify="space-between" mb="md" wrap="wrap" gap="sm">
        <div>
          <Title order={3}>Зависимости и связи между задачами</Title>
          <Text size="sm" c="dimmed">Связи задают технологическую последовательность и типы зависимостей.</Text>
        </div>
        <Group gap="xs" wrap="wrap">
          <Button size="xs" onClick={() => setDepModal(true)}>+ Добавить связь</Button>
          <Button size="xs" variant="light" onClick={() => setActiveView("dashboard")}>← На Главную</Button>
        </Group>
      </Group>

      <div className="table-responsive-container">
        <Table striped highlightOnHover style={{ minWidth: 620 }}>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Предшествующая задача</Table.Th>
            <Table.Th>Тип связи</Table.Th>
            <Table.Th>Последующая задача</Table.Th>
            <Table.Th>Задержка (лаг)</Table.Th>
            <Table.Th>Режим</Table.Th>
            <Table.Th style={{ width: 80, textAlign: "right" }}>Действия</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {(draft?.dependencies || []).map((d, idx) => {
            const pred = draft?.tasks.find((t) => t.id === d.predecessor_id);
            const succ = draft?.tasks.find((t) => t.id === d.successor_id);
            return (
              <Table.Tr key={idx}>
                <Table.Td fw={600}>{pred?.name || d.predecessor_id}</Table.Td>
                <Table.Td>
                  <Badge variant="outline">{d.kind}</Badge>
                </Table.Td>
                <Table.Td fw={600}>{succ?.name || d.successor_id}</Table.Td>
                <Table.Td>{d.lag_minutes / 60} ч.</Table.Td>
                <Table.Td>
                  <Badge size="xs" color={d.lag_mode === "working" ? "blue" : "gray"}>
                    {d.lag_mode === "working" ? "Рабочее время" : "Календарное время"}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  <Group gap={4} justify="flex-end">
                    <ActionIcon
                      color="blue"
                      variant="subtle"
                      title="Редактировать связь"
                      onClick={() => editDependency(idx, d)}
                    >
                      <Edit size={16} />
                    </ActionIcon>
                    <ActionIcon
                      color="red"
                      variant="subtle"
                      title="Удалить связь"
                      onClick={() => removeDependency(idx)}
                    >
                      <Trash2 size={16} />
                    </ActionIcon>
                  </Group>
                </Table.Td>
              </Table.Tr>
            );
          })}
        </Table.Tbody>
      </Table>
      </div>
    </Card>
  );
}
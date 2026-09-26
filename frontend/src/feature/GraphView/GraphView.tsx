import { Button, Card, Group, Text, Title } from "@mantine/core";
import { ProjectGraph } from "@/ProjectGraph";
import { useGraphView } from "@/feature/GraphView/useGraphView";

export function GraphView() {
  const {
    draft,
    view,
    affected,
    colorScheme,
    activeView,
    setActiveView,
    setDepModal,
    onEditTask,
    onAddDependency,
    onEditDependency,
  } = useGraphView();

  if (activeView !== "graph" || !draft) return null;

  return (
    <Card withBorder p="md">
      <Group justify="space-between" mb="md">
        <div>
          <Title order={3}>Интерактивная карта графа задач</Title>
          <Text size="sm" c="dimmed">
            Перемещайте блоки задач мышью, соединяйте стрелками для добавления связей и кликайте на задачу для редактирования.
          </Text>
        </div>
        <Group gap="xs">
          <Button size="xs" onClick={() => setDepModal(true)}>+ Добавить связь</Button>
          <Button size="xs" variant="light" onClick={() => setActiveView("dashboard")}>
            ← Вернуться на Главную
          </Button>
        </Group>
      </Group>
      <ProjectGraph
        project={draft}
        result={view}
        affectedTaskIds={affected}
        colorScheme={colorScheme}
        onEditTask={onEditTask}
        onAddDependency={onAddDependency}
        onEditDependency={onEditDependency}
      />
    </Card>
  );
}
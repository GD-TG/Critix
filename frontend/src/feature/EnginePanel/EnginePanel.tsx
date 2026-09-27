import { Badge, Button, Card, Group, SimpleGrid, Text } from "@mantine/core";
import { useEnginePanel } from "./useEnginePanel";

export function EnginePanel() {
  const { draft, view, preview, zone, setSettingsTab, setSettings } = useEnginePanel();

  if (!draft || !view) return null;

  return (
    <article className="panel health-panel">
      <div className="panel-header">
        <div>
          <Group gap="xs" align="center">
            <h2>Параметры движка и расчёта</h2>
            {preview ? (
              <Badge color="yellow" variant="light" size="sm">
                Черновик (What-If)
              </Badge>
            ) : (
              <Badge color="teal" variant="light" size="sm">
                Боевой план
              </Badge>
            )}
          </Group>
          <p>Дискретный расчёт CPM/CCPM, календари и ограничения</p>
        </div>
        <Button
          size="xs"
          variant="light"
          onClick={() => {
            setSettingsTab("calendar");
            setSettings(true);
          }}
        >
          Настроить календари
        </Button>
      </div>

      <div style={{ padding: "0 20px 20px 20px" }}>
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
          <Card withBorder p="xs" radius="md">
            <Text size="xs" fw={700} c="dimmed" mb={4}>ТОПОЛОГИЯ И СВЯЗИ</Text>
            <Text size="sm" fw={600}>
              {draft.tasks.length} задач · {draft.dependencies.length} связей
            </Text>
            <Text size="xs" c="dimmed">
              {view.analysis.tasks.filter((t) => t.risk_flags.includes("dependency_conflict")).length === 0
                ? "Конфликтов и циклов в графе нет"
                : "Есть конфликты связей"}
            </Text>
          </Card>

          <Card withBorder p="xs" radius="md">
            <Text size="xs" fw={700} c="dimmed" mb={4}>КАЛЕНДАРЬ И ЧАСОВОЙ ПОЯС</Text>
            <Text size="sm" fw={600}>
              {zone}
            </Text>
            <Text size="xs" c="dimmed">
              {Object.keys(draft.calendar.week).length} раб. дней · {Object.keys(draft.calendar.exceptions || {}).length} исключений/праздников
            </Text>
          </Card>

          <Card withBorder p="xs" radius="md">
            <Text size="xs" fw={700} c="dimmed" mb={4}>КОМАНДА И РЕСУРСЫ</Text>
            <Text size="sm" fw={600}>
              {draft.assignees.length} исполнителей в проекте
            </Text>
            <Text size="xs" c={view.analysis.overloads.length > 0 ? "orange" : "teal"}>
              {view.analysis.overloads.length > 0
                ? `${view.analysis.overloads.length} окон перегрузки (>100%)`
                : "Все сотрудники в пределах нормы"}
            </Text>
          </Card>

          <Card withBorder p="xs" radius="md">
            <Text size="xs" fw={700} c="dimmed" mb={4}>РЕЗЕРВЫ ВРЕМЕНИ (FLOAT)</Text>
            <Text size="sm" fw={600}>
              {view.analysis.tasks.filter((t) => !t.critical).length} некритических задач с запасом
            </Text>
            <Text size="xs" c="dimmed">
              Резервы рассчитаны до ближайшего преемника
            </Text>
          </Card>
        </SimpleGrid>
      </div>
    </article>
  );
}

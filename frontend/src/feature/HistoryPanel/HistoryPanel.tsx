import { Badge, Box, Group, ScrollArea, Stack, Text } from "@mantine/core";
import { formatCalendarShift } from "@/shared";
import { useHistoryPanel } from "./useHistoryPanel";

export function HistoryPanel() {
  const { history, historyError, date } = useHistoryPanel();

  return (
    <article className="panel activity-panel" id="tasks">
      <div className="panel-header">
        <div>
          <h2>История сохранений</h2>
          <p>С комментариями и затронутыми задачами</p>
        </div>
      </div>
      {historyError && (
        <Text c="red" size="sm" p="sm">
          {historyError}
        </Text>
      )}
      {!history.length && !historyError && (
        <Text c="dimmed" size="sm" p="md">
          Нет сохранённых версий
        </Text>
      )}
      <ScrollArea h={260}>
        <Stack gap="xs" p="xs">
          {history.map((item) => (
            <Box
              key={item.version}
              p="xs"
              style={{
                borderRadius: 6,
                border: "1px solid var(--mantine-color-default-border)",
                background: "var(--mantine-color-body)",
              }}
            >
              <Group justify="space-between" mb={4}>
                <Group gap="xs">
                  <Badge variant="filled" size="sm">
                    v{item.version}
                  </Badge>
                  <Text size="xs" c="dimmed">
                    {date(item.created_at)}
                  </Text>
                </Group>
                {typeof item.finish_delta_minutes === "number" && item.finish_delta_minutes !== 0 && (
                  <Badge
                    size="xs"
                    variant="light"
                    color={item.finish_delta_minutes > 0 ? "red" : "teal"}
                  >
                    {formatCalendarShift(item.finish_delta_minutes)}
                  </Badge>
                )}
              </Group>

              {item.comment && (
                <Text size="sm" fw={500} mb={2}>
                  💬 {item.comment}
                </Text>
              )}

              <Group gap="xs" justify="space-between">
                <Text size="xs" c="dimmed">
                  Задач: {item.task_count} · Прогноз финиша: {date(item.finish)}
                </Text>
              </Group>

              {item.changed_tasks && item.changed_tasks.length > 0 && (
                <Text size="xs" c="dimmed" mt={4}>
                  Затронуты: {item.changed_tasks.slice(0, 4).join(", ")}
                  {item.changed_tasks.length > 4 ? ` и ещё ${item.changed_tasks.length - 4}` : ""}
                </Text>
              )}
            </Box>
          ))}
        </Stack>
      </ScrollArea>
    </article>
  );
}

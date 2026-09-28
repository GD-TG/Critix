import { Alert, Box, Button, Group, List, Stack, Text, TextInput } from "@mantine/core";
import { GitBranch } from "lucide-react";
import { formatCalendarShift } from "@/shared";
import { useDraftBanner } from "./useDraftBanner";

export function DraftBanner() {
  const {
    preview,
    dirty,
    busy,
    saving,
    simulating,
    affected,
    conflict,
    comment,
    setComment,
    openScenarioModal,
    handleCancel,
    handlePreview,
    handleApply,
    handleOverwriteServer,
    handleReloadServer,
    handleDismissConflict,
  } = useDraftBanner();

  if (conflict) {
    const serverVersion = conflict.serverResult?.version;
    return (
      <Alert
        color="red"
        title="Конфликт версий: проект изменён в другой сессии или вкладке"
        mb="lg"
      >
        <Stack gap="xs">
          <Text size="sm">
            {serverVersion
              ? `На сервере сохранена более поздняя версия (v${serverVersion}). Ваш локальный черновик не был сброшен.`
              : "На сервере сохранены изменения другой вкладки. Ваш черновик сохранён локально."}
          </Text>

          {conflict.diffs.length > 0 && (
            <Box>
              <Text size="xs" fw={600} c="dimmed" mb={4}>
                Обнаруженные расхождения:
              </Text>
              <List size="xs" spacing={2} withPadding>
                {conflict.diffs.map((diff, index) => (
                  <List.Item key={index}>{diff}</List.Item>
                ))}
              </List>
            </Box>
          )}

          <Group gap="sm" mt="xs">
            <Text size="xs">Сохранение поверх серверной версии полностью заменит её вашим черновиком, включая задачи, связи и календари. Это не объединение изменений.</Text>
            <Button
              variant="default"
              size="xs"
              disabled={busy}
              onClick={handleReloadServer}
            >
              Загрузить версию сервера (сбросить черновик)
            </Button>
            {conflict.serverResult && (
              <Button
                color="red"
                size="xs"
                loading={saving}
                disabled={simulating}
                onClick={handleOverwriteServer}
              >
                Сохранить поверх версии сервера
              </Button>
            )}
            <Button
              variant="subtle"
              size="xs"
              disabled={busy}
              onClick={handleDismissConflict}
            >
              Оставить черновик для проверки
            </Button>
          </Group>
        </Stack>
      </Alert>
    );
  }

  if (!dirty) return null;

  return (
    <Alert
      color={preview ? "orange" : "blue"}
      title={preview ? "Предпросмотр последствий" : "Есть изменения в черновике"}
      mb="lg"
    >
      <Stack gap="xs">
        <Group justify="space-between" align="center">
          <Text size="sm">
            {preview
              ? `Изменились даты ${affected.size} задач. Сдвиг завершения: ${formatCalendarShift(preview.changes!.finish_delta_minutes)}.`
              : "Рассчитайте последствия перед сохранением или сохраните как отдельный сценарий."}
          </Text>
          <Group gap="xs">
            <Button
              variant="subtle"
              size="xs"
              disabled={busy}
              onClick={handleCancel}
            >
              Отменить
            </Button>
            <Button
              variant="light"
              size="xs"
              leftSection={<GitBranch size={14} />}
              onClick={openScenarioModal}
            >
              Сохранить как сценарий...
            </Button>
            {!preview ? (
              <Button
                size="xs"
                loading={simulating}
                disabled={busy}
                onClick={handlePreview}
              >
                Показать последствия
              </Button>
            ) : (
              <Button
                size="xs"
                loading={saving}
                disabled={busy}
                onClick={handleApply}
              >
                Применить изменения
              </Button>
            )}
          </Group>
        </Group>

        {preview && (
          <Group gap="sm" mt={4}>
            <TextInput
              placeholder="Комментарий к сохранению (опционально, например: «Перенёс спринт 3»)"
              size="xs"
              style={{ flex: 1 }}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !busy) handleApply();
              }}
            />
          </Group>
        )}
      </Stack>
    </Alert>
  );
}

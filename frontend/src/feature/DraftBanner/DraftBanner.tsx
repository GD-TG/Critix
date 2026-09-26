import { Alert, Button, Group, Text } from "@mantine/core";
import { useDraftBanner } from "./useDraftBanner";

export function DraftBanner() {
  const {
    draft,
    saved,
    preview,
    dirty,
    busy,
    affected,
    handleCancel,
    handlePreview,
    handleApply,
  } = useDraftBanner();

  if (!dirty) return null;

  return (
    <Alert
      color={preview ? "orange" : "blue"}
      title={preview ? "Предпросмотр последствий" : "Есть изменения в черновике"}
      mb="lg"
    >
      <Group justify="space-between">
        <Text size="sm">
          {preview
            ? `Изменились даты ${affected.size} задач. Сдвиг завершения: ${preview.changes!.finish_delta_minutes / 60} календарных ч.`
            : "Рассчитайте последствия перед сохранением."}
        </Text>
        <Group>
          <Button
            variant="subtle"
            disabled={busy}
            onClick={handleCancel}
          >
            Отменить
          </Button>
          {!preview ? (
            <Button
              loading={busy}
              onClick={handlePreview}
            >
              Показать последствия
            </Button>
          ) : (
            <Button
              loading={busy}
              onClick={handleApply}
            >
              Применить изменения
            </Button>
          )}
        </Group>
      </Group>
    </Alert>
  );
}

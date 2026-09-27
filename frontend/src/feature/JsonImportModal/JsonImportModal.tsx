import { Alert, Button, FileInput, Group, Modal, Stack, Text, Textarea } from "@mantine/core";
import { useJsonImportModal } from "@/feature/JsonImportModal/useJsonImportModal";

export function JsonImportModal() {
  const {
    draft,
    jsonImportModal, setJsonImportModal,
    jsonInput, setJsonInput,
    jsonImportError, setJsonImportError,
    busy,
    close,
    replaceDraft,
    createAsNew,
  } = useJsonImportModal();

  return (
    <>
      {/* Full Project JSON Import Modal */}
      {jsonImportModal && (
        <Modal
          opened={jsonImportModal}
          onClose={close}
          title="Импорт полного проекта из JSON"
          size="lg"
        >
          <Stack gap="md">
            <Text size="sm" c="dimmed">
              Загрузите файл .json или вставьте JSON-снимок проекта со всеми задачами, исполнителями, персональными календарями и зависимостями.
            </Text>

            {jsonImportError && <Alert color="red">{jsonImportError}</Alert>}

            <FileInput
              label="Загрузить файл .json"
              placeholder="Выберите .json файл проекта"
              accept=".json,application/json"
              onChange={(file) => {
                if (file) {
                  const reader = new FileReader();
                  reader.onload = (e) => {
                    const content = (e.target?.result as string) || "";
                    setJsonInput(content);
                  };
                  reader.readAsText(file, "UTF-8");
                }
              }}
            />

            <Textarea
              label="Либо вставьте JSON проекта:"
              rows={8}
              placeholder='{ "name": "Мой проект", "start": "...", "deadline": "...", "tasks": [...], ... }'
              value={jsonInput}
              onChange={(e) => {
                setJsonInput(e.target.value);
                setJsonImportError("");
              }}
            />

            <Group justify="space-between" mt="md">
              <Button variant="default" onClick={() => setJsonImportModal(false)}>
                Отмена
              </Button>
              <Group gap="xs">
                {draft && (
                  <Button
                    variant="light"
                    disabled={!jsonInput.trim()}
                    onClick={replaceDraft}
                  >
                    Заменить текущий черновик
                  </Button>
                )}
                <Button
                  loading={busy}
                  disabled={!jsonInput.trim()}
                  onClick={createAsNew}
                >
                  Создать как новый проект
                </Button>
              </Group>
            </Group>
          </Stack>
        </Modal>
      )}
    </>
  );
}

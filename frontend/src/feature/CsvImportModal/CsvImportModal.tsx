import { Button, FileInput, Group, Modal, Stack, Text, Textarea } from "@mantine/core";
import { useCsvImportModal } from "@/feature/CsvImportModal/useCsvImportModal";

export function CsvImportModal() {
  const { importModal, setImportModal, csvInput, setCsvInput, handleImportCsvSubmit } = useCsvImportModal();

  return (
    <>
      {/* CSV Import Modal */}
      {importModal && (
        <Modal
          opened={importModal}
          onClose={() => setImportModal(false)}
          title="Импорт задач из CSV"
          size="lg"
        >
          <Stack gap="md">
            <Text size="sm" c="dimmed">
              Вставьте текст CSV или загрузите файл (разделители: точка с запятой или запятая).
              Формат колонок: ID; Название; Приоритет; Часы/Мин; Исполнитель; Статус; Не раньше; Требуемые навыки.
            </Text>

            <FileInput
              label="Загрузить файл .csv"
              placeholder="Выберите .csv файл"
              accept=".csv,text/csv"
              onChange={(file) => {
                if (file) {
                  const reader = new FileReader();
                  reader.onload = (e) => setCsvInput((e.target?.result as string) || "");
                  reader.readAsText(file, "UTF-8");
                }
              }}
            />

            <Textarea
              label="Либо вставьте содержимое CSV напрямую:"
              rows={8}
              placeholder="Название задачи; medium; 8; Алексей; todo; 2026-09-22T09:00:00+05:00; React, TypeScript"
              value={csvInput}
              onChange={(e) => setCsvInput(e.target.value)}
            />

            <Group justify="flex-end">
              <Button variant="default" onClick={() => setImportModal(false)}>Отмена</Button>
              <Button onClick={handleImportCsvSubmit} disabled={!csvInput.trim()}>
                Импортировать задачи
              </Button>
            </Group>
          </Stack>
        </Modal>
      )}
    </>
  );
}

import { Button, Card, Group, Modal, NumberInput, Select, Stack, Text } from "@mantine/core";
import { useDependencyModal } from "@/feature/DependencyModal/useDependencyModal";
import type { Dependency } from "@/types";

export function DependencyModal() {
  const {
    draft,
    depModal, setDepModal,
    newDepPred, setNewDepPred, newDepSucc, setNewDepSucc,
    newDepKind, setNewDepKind, newDepLagHours, setNewDepLagHours, newDepLagMode, setNewDepLagMode,
    editingDepIndex, setEditingDepIndex,
    editDepKind, setEditDepKind, editDepLagHours, setEditDepLagHours, editDepLagMode, setEditDepLagMode,
    handleAddDependencySubmit,
    handleSaveEdit,
  } = useDependencyModal();

  return (
    <>
      {/* Dependency / Link Creation Modal */}
      {depModal && (
        <Modal
          opened={depModal}
          onClose={() => setDepModal(false)}
          title="Добавить связь между задачами"
          size="md"
        >
          <Stack gap="sm">
            <Select
              label="Предшествующая задача"
              placeholder="Выберите задачу-предшественник"
              data={(draft?.tasks || []).map((t) => ({ value: t.id, label: t.name }))}
              value={newDepPred}
              onChange={(v) => setNewDepPred(v || "")}
              required
            />

            <Select
              label="Тип связи"
              data={[
                { value: "FS", label: "Окончание → Начало (FS)" },
                { value: "SS", label: "Начало → Начало (SS)" },
                { value: "FF", label: "Окончание → Окончание (FF)" },
                { value: "SF", label: "Начало → Окончание (SF)" },
              ]}
              value={newDepKind}
              onChange={(v) => setNewDepKind((v as Dependency["kind"]) || "FS")}
            />

            <Select
              label="Последующая задача"
              placeholder="Выберите зависимую задачу"
              data={(draft?.tasks || []).map((t) => ({ value: t.id, label: t.name }))}
              value={newDepSucc}
              onChange={(v) => setNewDepSucc(v || "")}
              required
            />

            <Group grow>
              <NumberInput
                label="Задержка / лаг (в часах)"
                value={newDepLagHours}
                onChange={(v) => setNewDepLagHours(Number(v || 0))}
              />
              <Select
                label="Режим задержки"
                data={[
                  { value: "working", label: "Рабочее время" },
                  { value: "elapsed", label: "Календарное время" },
                ]}
                value={newDepLagMode}
                onChange={(v) => setNewDepLagMode((v as Dependency["lag_mode"]) || "working")}
              />
            </Group>

            <Group justify="flex-end" mt="md">
              <Button variant="default" onClick={() => setDepModal(false)}>Отмена</Button>
              <Button onClick={handleAddDependencySubmit}>Добавить связь</Button>
            </Group>
          </Stack>
        </Modal>
      )}

      {/* Edit Dependency Modal */}
      {editingDepIndex !== null && draft?.dependencies[editingDepIndex] && (
        <Modal
          opened={editingDepIndex !== null}
          onClose={() => setEditingDepIndex(null)}
          title="Редактирование связи между задачами"
          size="md"
        >
          {(() => {
            const currentDep = draft.dependencies[editingDepIndex];
            const pred = draft.tasks.find((t) => t.id === currentDep.predecessor_id);
            const succ = draft.tasks.find((t) => t.id === currentDep.successor_id);
            return (
              <Stack gap="sm">
                <Card withBorder p="xs" style={{ background: "rgba(210, 10, 46, 0.04)" }}>
                  <Text size="xs" fw={700} c="dimmed">СВЯЗАННЫЕ ЗАДАЧИ:</Text>
                  <Text size="sm" fw={600}>
                    «{pred?.name || currentDep.predecessor_id}» → «{succ?.name || currentDep.successor_id}»
                  </Text>
                </Card>

                <Select
                  label="Тип связи"
                  data={[
                    { value: "FS", label: "Окончание → Начало (FS)" },
                    { value: "SS", label: "Начало → Начало (SS)" },
                    { value: "FF", label: "Окончание → Окончание (FF)" },
                    { value: "SF", label: "Начало → Окончание (SF)" },
                  ]}
                  value={editDepKind}
                  onChange={(v) => setEditDepKind((v as Dependency["kind"]) || "FS")}
                />

                <Group grow>
                  <NumberInput
                    label="Задержка / лаг (в часах)"
                    value={editDepLagHours}
                    onChange={(v) => setEditDepLagHours(Number(v || 0))}
                  />
                  <Select
                    label="Режим задержки"
                    data={[
                      { value: "working", label: "Рабочее время" },
                      { value: "elapsed", label: "Календарное время" },
                    ]}
                    value={editDepLagMode}
                    onChange={(v) => setEditDepLagMode((v as Dependency["lag_mode"]) || "working")}
                  />
                </Group>

                <Group justify="flex-end" mt="md">
                  <Button variant="default" onClick={() => setEditingDepIndex(null)}>
                    Отмена
                  </Button>
                  <Button onClick={handleSaveEdit}>
                    Сохранить изменения
                  </Button>
                </Group>
              </Stack>
            );
          })()}
        </Modal>
      )}
    </>
  );
}

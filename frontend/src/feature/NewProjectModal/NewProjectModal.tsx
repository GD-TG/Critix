import { Button, Group, Modal, Select, Stack, TextInput } from "@mantine/core";
import { ProjectDateInput } from "@/ProjectDateInput";
import { TIMEZONE_OPTIONS } from "@/shared";
import { useNewProjectModal } from "@/feature/NewProjectModal/useNewProjectModal";

export function NewProjectModal() {
  const {
    newProjectModal, setNewProjectModal,
    newProjName, setNewProjName,
    newProjTz, setNewProjTz,
    newProjStart, setNewProjStart,
    newProjDeadline, setNewProjDeadline,
    busy,
    handleCreateProjectSubmit,
  } = useNewProjectModal();

  return (
    <>
      {/* New Project Modal */}
      {newProjectModal && (
        <Modal
          opened={newProjectModal}
          onClose={() => setNewProjectModal(false)}
          title="Создание нового проекта"
          size="md"
        >
          <Stack gap="sm">
            <TextInput
              label="Название проекта"
              value={newProjName}
              onChange={(e) => setNewProjName(e.target.value)}
              required
            />

            <Select
              label="Часовой пояс IANA"
              data={TIMEZONE_OPTIONS}
              value={newProjTz}
              onChange={(v) => v && setNewProjTz(v)}
            />

            <Group grow>
              <ProjectDateInput
                label="Дата начала"
                zone={newProjTz}
                value={newProjStart}
                onChange={setNewProjStart}
              />
              <ProjectDateInput
                label="Целевой дедлайн"
                zone={newProjTz}
                value={newProjDeadline}
                onChange={setNewProjDeadline}
              />
            </Group>

            <Group justify="flex-end" mt="md">
              <Button variant="default" onClick={() => setNewProjectModal(false)}>
                Отмена
              </Button>
              <Button onClick={handleCreateProjectSubmit} loading={busy}>
                Создать проект
              </Button>
            </Group>
          </Stack>
        </Modal>
      )}
    </>
  );
}

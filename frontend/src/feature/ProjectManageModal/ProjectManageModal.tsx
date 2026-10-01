import {
  ActionIcon,
  Badge,
  Button,
  Card,
  Divider,
  Group,
  Modal,
  Stack,
  Text,
} from "@mantine/core";
import { FileJson, RotateCcw, Trash2, Upload } from "lucide-react";
import { useProjectManageModal } from "@/feature/ProjectManageModal/useProjectManageModal";

export function ProjectManageModal() {
  const {
    projects, saved, draft, busy, switchingId,
    projectManageModal, setProjectManageModal,
    setNewProjectModal, setJsonImportModal,
    deleteConfirmProject, setDeleteConfirmProject,
    handleLoadDemoProject,
    handleLoadDeliveriesDemo,
    handleDeleteProject,
    switchProject,
    exportCurrent,
  } = useProjectManageModal();

  return (
    <>
      {/* Project Management & Delete Modal */}
      {projectManageModal && (
        <Modal
          opened={projectManageModal}
          onClose={() => setProjectManageModal(false)}
          title="Управление проектами"
          size="lg"
          classNames={{ content: "project-manage-modal" }}
        >
          <Stack gap="md">
            <Group justify="space-between" wrap="wrap" gap="sm">
              <Text size="sm" c="dimmed">
                Выберите проект для переключения или создайте новый.
              </Text>
              <Group gap="xs" wrap="wrap">
                <Button size="xs" variant="light" leftSection={<RotateCcw size={13} />} onClick={handleLoadDemoProject}>
                  Демо: Классический CPM
                </Button>
                <Button size="xs" variant="light" color="indigo" leftSection={<RotateCcw size={13} />} onClick={handleLoadDeliveriesDemo}>
                  Демо: Поставки подрядчика
                </Button>
                <Button size="xs" onClick={() => setNewProjectModal(true)}>
                  + Создать проект
                </Button>
              </Group>
            </Group>

            <Group gap="xs" wrap="wrap">
              <Button size="xs" variant="default" leftSection={<Upload size={13} />} onClick={() => setJsonImportModal(true)}>
                Импорт JSON
              </Button>
              {draft && (
                <Button size="xs" variant="default" leftSection={<FileJson size={13} />} onClick={exportCurrent}>
                  Экспорт текущего в JSON
                </Button>
              )}
            </Group>

            <Divider />

            <Stack gap="xs">
              {projects.map((p) => {
                const isCurrent = saved?.id === p.id;
                return (
                  <Card key={p.id} withBorder p="xs" className="project-manage-card" style={{ background: isCurrent ? "rgba(210, 10, 46, 0.07)" : undefined }}>
                    <Group justify="space-between">
                      <Group gap="xs">
                        <span className="project-dot" />
                        <div>
                          <Text fw={700} size="sm">{p.name}</Text>
                          {isCurrent && <Badge size="xs" color="blue">Текущий активный</Badge>}
                        </div>
                      </Group>

                      <Group gap="xs">
                        {!isCurrent && (
                          <Button
                            size="xs"
                            variant="light"
                            loading={switchingId === p.id}
                            disabled={busy || Boolean(switchingId)}
                            onClick={() => switchProject(p.id, p.name)}
                          >
                            Переключиться
                          </Button>
                        )}
                        <ActionIcon
                          color="red"
                          variant="subtle"
                          title="Удалить проект"
                          onClick={() => setDeleteConfirmProject(p)}
                        >
                          <Trash2 size={16} />
                        </ActionIcon>
                      </Group>
                    </Group>
                  </Card>
                );
              })}
            </Stack>
          </Stack>
        </Modal>
      )}

      {/* Delete Project Confirmation Modal */}
      {deleteConfirmProject && (
        <Modal
          opened={Boolean(deleteConfirmProject)}
          onClose={() => setDeleteConfirmProject(null)}
          title="Подтверждение удаления проекта"
          size="sm"
        >
          <Stack gap="md">
            <Text size="sm">
              Вы уверены, что хотите навсегда удалить проект <strong>«{deleteConfirmProject.name}»</strong>? Все его задачи и графики будут безвозвратно удалены.
            </Text>

            <Group justify="flex-end">
              <Button variant="default" onClick={() => setDeleteConfirmProject(null)}>
                Отмена
              </Button>
              <Button
                color="red"
                loading={busy}
                onClick={() => handleDeleteProject(deleteConfirmProject.id)}
              >
                Удалить проект
              </Button>
            </Group>
          </Stack>
        </Modal>
      )}
    </>
  );
}

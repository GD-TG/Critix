import { Button, Card, Group, Modal, Stack, Text } from "@mantine/core";
import { GitBranch, Sparkles, Target } from "lucide-react";
import { useHelpModal } from "@/feature/HelpModal/useHelpModal";

export function HelpModal() {
  const { helpModal, setHelpModal } = useHelpModal();

  return (
    <>
      {/* Help & System Guide Modal */}
      {helpModal && (
        <Modal
          opened={helpModal}
          onClose={() => setHelpModal(false)}
          title="Справка и возможности Актион"
          size="lg"
        >
          <Stack gap="md">
            <Card withBorder p="sm" style={{ background: "rgba(210, 10, 46, 0.04)" }}>
              <Group gap="xs" mb={4}>
                <Target size={16} color="#e57470" />
                <Text fw={700} size="sm">Метод критического пути (CPM) и Базовый план</Text>
              </Group>
              <Text size="xs" c="dimmed">
                Актион автоматически рассчитывает самый длинный путь технологических зависимостей. Задачи с нулевым резервом времени (резерв = 0 ч) отмечены красной рамкой. Любая задержка на критическом пути сдвигает срок сдачи всего проекта.
              </Text>
            </Card>

            <Card withBorder p="sm">
              <Group gap="xs" mb={4}>
                <GitBranch size={16} color="var(--brand)" />
                <Text fw={700} size="sm">Интерактивная карта графа (ReactFlow)</Text>
              </Group>
              <Text size="xs" c="dimmed">
                Блоки задач можно свободно перемещать по холсту, кликать для детального редактирования, перетягивать стрелки от точки к точке для создания связей (FS/SS/FF/SF) и фильтровать только критический путь.
              </Text>
            </Card>

            <Card withBorder p="sm">
              <Group gap="xs" mb={4}>
                <Sparkles size={16} color="#9381d7" />
                <Text fw={700} size="sm">Симуляция последствий «Что если?»</Text>
              </Group>
              <Text size="xs" c="dimmed">
                Проверяйте сценарии сдвигов задач перед внесением изменений. Система покажет точный расчет смещения дедлайна и рекомендации AI по оптимизации ресурсов.
              </Text>
            </Card>

            <Group justify="flex-end" mt="xs">
              <Button onClick={() => setHelpModal(false)}>Понятно</Button>
            </Group>
          </Stack>
        </Modal>
      )}
    </>
  );
}

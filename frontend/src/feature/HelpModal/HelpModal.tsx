import React, { useState } from "react";
import {
  Badge,
  Button,
  Card,
  Divider,
  Group,
  Modal,
  Stack,
  Tabs,
  Text,
  ThemeIcon,
} from "@mantine/core";
import {
  GitBranch,
  PlayCircle,
  RotateCcw,
  Sparkles,
  Target,
} from "lucide-react";
import { useApp } from "@/context/AppContext";
import { api } from "@/api";
import type { Result } from "@/types";

export function HelpModal() {
  const {
    helpModal,
    setHelpModal,
    setActiveView,
    setDecisionLabOpened,
    setEventDialogOpened,
    run,
    list,
    accept,
    showNotification,
  } = useApp();

  const [activeTab, setActiveTab] = useState<string | null>("demo");

  const handleLoadDemo = async () => {
    await run(async () => {
      const created = await api<Result>("/demo", "POST");
      await list();
      accept(created);
      showNotification("Демо-проект «Запуск клиентского портала» успешно загружен!");
    });
  };

  return (
    <Modal
      opened={helpModal}
      onClose={() => setHelpModal(false)}
      title={
        <Group gap="xs">
          <ThemeIcon color="red" variant="light" size="md">
            <PlayCircle size={18} />
          </ThemeIcon>
          <Text fw={700} size="md">
            Гид по защите и возможностям Critix
          </Text>
        </Group>
      }
      size="lg"
    >
      <Tabs value={activeTab} onChange={setActiveTab} mb="sm">
        <Tabs.List grow>
          <Tabs.Tab value="demo" leftSection={<PlayCircle size={15} />}>
            Сценарий демо (2-3 мин)
          </Tabs.Tab>
          <Tabs.Tab value="features" leftSection={<Target size={15} />}>
            Возможности системы
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="demo" pt="md">
          <Stack gap="sm">
            <Text size="xs" c="dimmed">
              Пошаговый сценарий демонстрации ключевой ценности продукта для жюри: «Если сейчас что-то изменится — что произойдёт с проектом?»
            </Text>

            {/* Step 1 */}
            <Card withBorder p="sm" radius="md" style={{ background: "rgba(210, 10, 46, 0.03)" }}>
              <Group justify="space-between" mb={4}>
                <Group gap="xs">
                  <Badge color="red" size="sm" variant="filled">Шаг 1</Badge>
                  <Text fw={700} size="sm">Загрузка проекта с зависимостями</Text>
                </Group>
                <Button size="xs" variant="light" color="red" onClick={handleLoadDemo} leftSection={<RotateCcw size={12} />}>
                  Загрузить демо
                </Button>
              </Group>
              <Text size="xs" c="dimmed">
                Загрузите эталонный проект «Запуск клиентского портала» (12 задач, 4 исполнителя, вехи, технологические связи FS/SS/FF).
              </Text>
            </Card>

            {/* Step 2 */}
            <Card withBorder p="sm" radius="md">
              <Group justify="space-between" mb={4}>
                <Group gap="xs">
                  <Badge color="blue" size="sm" variant="light">Шаг 2</Badge>
                  <Text fw={700} size="sm">Моделирование срыва задачи (Drag-What-If)</Text>
                </Group>
                <Group gap={6}>
                  <Button size="xs" variant="subtle" onClick={() => { setActiveView("timeline"); setHelpModal(false); }}>
                    Открыть Гант
                  </Button>
                  <Button size="xs" variant="light" color="orange" onClick={() => { setEventDialogOpened(true); setHelpModal(false); }}>
                    «Что случилось?»
                  </Button>
                </Group>
              </Group>
              <Text size="xs" c="dimmed">
                Потяните полосу задачи «Разработка API» вправо на +4 дня или нажмите кнопку «Что случилось?». Внизу появится плавающая панель черновика (DraftBar).
              </Text>
            </Card>

            {/* Step 3 */}
            <Card withBorder p="sm" radius="md">
              <Group gap="xs" mb={4}>
                <Badge color="orange" size="sm" variant="light">Шаг 3</Badge>
                <Text fw={700} size="sm">Демонстрация каскадного эффекта</Text>
              </Group>
              <Text size="xs" c="dimmed">
                Покажите жюри: задержка задачи на критическом пути автоматически распространилась по графу зависимостей:
              </Text>
              <Text size="xs" fw={600} c="red" mt={4}>
                Разработка API (+4 дн.) → Интеграция (+4 дн.) → Тестирование (+4 дн.) → Срыв дедлайна на 3 дня!
              </Text>
            </Card>

            {/* Step 4 */}
            <Card withBorder p="sm" radius="md">
              <Group justify="space-between" mb={4}>
                <Group gap="xs">
                  <Badge color="grape" size="sm" variant="light">Шаг 4</Badge>
                  <Text fw={700} size="sm">Диагностика первопричины (Root-Cause)</Text>
                </Group>
                <Button size="xs" variant="subtle" color="grape" onClick={() => { setActiveView("dashboard"); setHelpModal(false); }}>
                  Открыть Обзор
                </Button>
              </Group>
              <Text size="xs" c="dimmed">
                Перейдите на вкладку «Обзор»: система алгоритмически определила задачу-виновника срыва и рассчитала финансовый штраф (35 000 ₽ / сутки = 105 000 ₽).
              </Text>
            </Card>

            {/* Step 5 */}
            <Card withBorder p="sm" radius="md" style={{ background: "rgba(37, 99, 235, 0.03)" }}>
              <Group justify="space-between" mb={4}>
                <Group gap="xs">
                  <Badge color="teal" size="sm" variant="filled">Шаг 5</Badge>
                  <Text fw={700} size="sm">Ликвидация срыва и письмо заказчику</Text>
                </Group>
                <Button size="xs" variant="light" color="blue" onClick={() => { setDecisionLabOpened(true); setHelpModal(false); }}>
                  Открыть Лабораторию
                </Button>
              </Group>
              <Text size="xs" c="dimmed">
                В «Лаборатории решений» покажите 3 стратегии выхода. Примените стратегию «Срезать скоуп» (сохранение дедлайна) и сформируйте официальное письмо заказчику в 1 клик!
              </Text>
            </Card>
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="features" pt="md">
          <Stack gap="sm">
            <Card withBorder p="sm">
              <Group gap="xs" mb={4}>
                <Target size={16} color="#d20a2e" />
                <Text fw={700} size="sm">Метод критического пути (CPM) и резервы (Slack)</Text>
              </Group>
              <Text size="xs" c="dimmed">
                Детерминированный алгоритм вычисляет самый длинный путь технологических зависимостей за O(V+E) &lt; 5 мс. Задачи с резервом = 0 ч подсвечены красным. Пунктирные «хвосты» (Float Tails) показывают свободный запас времени.
              </Text>
            </Card>

            <Card withBorder p="sm">
              <Group gap="xs" mb={4}>
                <GitBranch size={16} color="var(--brand)" />
                <Text fw={700} size="sm">Интерактивный граф (ReactFlow) и 4 типа связей</Text>
              </Group>
              <Text size="xs" c="dimmed">
                Поддержка связей FS (Finish-to-Start), SS, FF, SF с календарными и астрономическими лагами. Защита от циклических зависимостей на уровне топологии (алгоритм Кана).
              </Text>
            </Card>

            <Card withBorder p="sm">
              <Group gap="xs" mb={4}>
                <Sparkles size={16} color="#2563eb" />
                <Text fw={700} size="sm">AI советник и автономный фолбэк</Text>
              </Group>
              <Text size="xs" c="dimmed">
                Консультационный ассистент руководителя проекта. Формирует executive-отчеты для руководства (PDF/Markdown). При недоступности LLM автоматически переключается на алгоритмический анализ без сбоев.
              </Text>
            </Card>
          </Stack>
        </Tabs.Panel>
      </Tabs>

      <Divider my="sm" />

      <Group justify="flex-end">
        <Button variant="default" onClick={() => setHelpModal(false)}>
          Закрыть
        </Button>
      </Group>
    </Modal>
  );
}

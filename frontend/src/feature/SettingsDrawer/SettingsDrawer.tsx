import {
  Button,
  Card,
  Divider,
  Drawer,
  Group,
  Select,
  Stack,
  Tabs,
  Text,
  TextInput,
} from "@mantine/core";
import { CalendarEditor } from "@/CalendarEditor";
import { ProjectDateInput } from "@/ProjectDateInput";
import { TIMEZONE_OPTIONS } from "@/shared";
import { useSettingsDrawer } from "@/feature/SettingsDrawer/useSettingsDrawer";

export function SettingsDrawer() {
  const {
    draft,
    change,
    settings,
    setSettings,
    settingsTab,
    setSettingsTab,
    date,
    handleSaveBaseline,
    goToTeam,
  } = useSettingsDrawer();

  return (
    <Drawer
      opened={settings}
      onClose={() => setSettings(false)}
      title="Настройки проекта"
      position="right"
      size="xl"
    >
      {draft && (
        <Tabs value={settingsTab} onChange={setSettingsTab} defaultValue="project">
          <Tabs.List mb="md">
            <Tabs.Tab value="project">Параметры проекта</Tabs.Tab>
            <Tabs.Tab value="calendar">Календарь проекта</Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="project">
            <Stack gap="md">
              <TextInput
                label="Название проекта"
                value={draft.name}
                onChange={(e) => change({ ...draft, name: e.target.value })}
              />

              <Select
                label="Часовой пояс IANA"
                data={TIMEZONE_OPTIONS}
                value={draft.timezone}
                onChange={(v) => v && change({ ...draft, timezone: v })}
                searchable
              />

              <Group grow>
                <ProjectDateInput
                  label="Дата начала проекта"
                  zone={draft.timezone}
                  value={draft.start}
                  onChange={(value) => change({ ...draft, start: value })}
                />
                <ProjectDateInput
                  label="Целевой дедлайн"
                  zone={draft.timezone}
                  value={draft.deadline}
                  onChange={(value) => change({ ...draft, deadline: value })}
                />
              </Group>

              <Divider my="sm" />

              <Card withBorder p="sm" style={{ background: "rgba(210, 10, 46, 0.04)" }}>
                <Group justify="space-between" align="center">
                  <div>
                    <Text size="xs" fw={700} c="blue">
                      БАЗОВЫЙ ПЛАН (BASELINE)
                    </Text>
                    <Text size="xs" c="dimmed">
                      {draft.baseline
                        ? `Зафиксирован: ${date(draft.baseline.saved_at)}`
                        : "Эталонный график еще не зафиксирован"}
                    </Text>
                  </div>
                  <Button variant="light" size="xs" onClick={handleSaveBaseline}>
                    Зафиксировать текущий снимок
                  </Button>
                </Group>
              </Card>

              <Card withBorder p="sm" style={{ background: "var(--bg-subtle, rgba(0, 0, 0, 0.02))" }}>
                <Group justify="space-between" align="center">
                  <div>
                    <Text size="xs" fw={700}>
                      Управление командой и ресурсами ({draft.assignees.length} чел.)
                    </Text>
                    <Text size="xs" c="dimmed">
                      Роли, матрица компетенций, персональные отпуска и загрузка сотрудников.
                    </Text>
                  </div>
                  <Button
                    variant="light"
                    size="xs"
                    onClick={goToTeam}
                  >
                    Перейти во вкладку «Команда» →
                  </Button>
                </Group>
              </Card>
            </Stack>
          </Tabs.Panel>

          <Tabs.Panel value="calendar">
            <Stack gap="md">
              <Text size="xs" c="dimmed">
                Общий рабочий календарь определяет стандартные смены и праздничные нерабочие дни для всей компании/проекта.
              </Text>
              <CalendarEditor
                value={draft.calendar}
                onChange={(calendar) => change({ ...draft, calendar })}
              />
            </Stack>
          </Tabs.Panel>

          <Group justify="flex-end" mt="xl">
            <Button onClick={() => setSettings(false)}>
              Готово
            </Button>
          </Group>
        </Tabs>
      )}
    </Drawer>
  );
}
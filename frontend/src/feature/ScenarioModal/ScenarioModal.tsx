import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Card,
  Divider,
  Group,
  Modal,
  Select,
  Stack,
  Table,
  Tabs,
  Text,
  TextInput,
  Textarea,
} from "@mantine/core";
import { Trash2, GitBranch, Play, Check, AlertTriangle } from "lucide-react";
import { useScenarioModal } from "@/feature/ScenarioModal/useScenarioModal";

export function ScenarioModal() {
  const {
    draft,
    saved,
    scenarios,
    loadingScenarios,
    analyzingIds,
    handleAnalyzeScenario,
    activeTab,
    setActiveTab,
    newScenarioName,
    setNewScenarioName,
    newScenarioDesc,
    setNewScenarioDesc,
    actionError,
    actionBusy,
    showScenarioModal,
    simTaskChoice,
    setSimTaskChoice,
    simDelayDays,
    setSimDelayDays,
    simResult,
    setSimResult,
    simError,
    simBusy,
    date,
    formatCalendarShift,
    close,
    handleRunSimulation,
    applySimulationToDraft,
    handleCreateScenarioFromDraft,
    handleCreateScenarioFromWhatif,
    handleDeleteScenario,
    handleApplyScenario,
  } = useScenarioModal();

  if (!showScenarioModal) return null;

  return (
    <Modal
      opened={showScenarioModal}
      onClose={close}
      title={
        <Group gap="xs">
          <GitBranch size={20} />
          <Text fw={700} size="lg">Сценарии проекта (A/B сравнение вариантов)</Text>
        </Group>
      }
      size="xl"
    >
      <Tabs value={activeTab} onChange={setActiveTab}>
        <Tabs.List mb="md">
          <Tabs.Tab value="compare" rightSection={<Badge size="xs" variant="light">{scenarios.length}</Badge>}>
            Сравнение вариантов
          </Tabs.Tab>
          <Tabs.Tab value="create_draft">
            Сохранить черновик как сценарий
          </Tabs.Tab>
          <Tabs.Tab value="whatif">
            Быстрый What-If (сдвиг задачи)
          </Tabs.Tab>
        </Tabs.List>

        {actionError && (
          <Alert color="red" mb="md" withCloseButton onClose={() => {}}>
            {actionError}
          </Alert>
        )}

        <Tabs.Panel value="compare">
          <Stack gap="md">
            <Text size="sm" c="dimmed">
              Сравните исходный рабочий план с альтернативными вариантами решений в PostgreSQL. Выберите подходящий сценарий и примените его в рабочий черновик.
            </Text>

            <div className="table-responsive-container">
              <Table striped highlightOnHover withTableBorder style={{ minWidth: 640 }}>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Вариант / Сценарий</Table.Th>
                  <Table.Th>Базовая версия</Table.Th>
                  <Table.Th>Финиш расчёта</Table.Th>
                  <Table.Th>Отклонение</Table.Th>
                  <Table.Th>Дедлайн</Table.Th>
                  <Table.Th>Перегрузки</Table.Th>
                  <Table.Th>Действия</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {/* Baseline Saved Project */}
                {saved && (
                  <Table.Tr style={{ background: "rgba(34, 139, 230, 0.05)" }}>
                    <Table.Td>
                      <Group gap={6}>
                        <Badge size="xs" color="blue" variant="filled">База</Badge>
                        <Text fw={600} size="sm">Текущий рабочий план</Text>
                      </Group>
                      <Text size="xs" c="dimmed">Версия v{saved.version} на сервере</Text>
                    </Table.Td>
                    <Table.Td>
                      <Badge size="xs" color="blue" variant="light">v{saved.version} (активен)</Badge>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm" fw={500}>{date(saved.analysis.finish)}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="xs" c="dimmed">0 мин (эталон)</Text>
                    </Table.Td>
                    <Table.Td>
                      <Badge size="xs" color={saved.analysis.deadline_exceeded ? "red" : "green"}>
                        {saved.analysis.deadline_exceeded ? "Превышен" : "В срок"}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">{saved.analysis.overloads.length}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Badge size="xs" variant="outline" color="gray">Текущий</Badge>
                    </Table.Td>
                  </Table.Tr>
                )}

                {/* Scenarios List */}
                {scenarios.map((sc) => {
                  const isStale = sc.base_version !== saved?.version;
                  const deltaMin = sc.changes?.finish_delta_minutes ?? 0;
                  const exceeded = sc.analysis?.deadline_exceeded;
                  const overloadsCount = sc.analysis?.overloads.length ?? 0;

                  return (
                    <Table.Tr key={sc.id}>
                      <Table.Td>
                        <Text fw={600} size="sm">{sc.name}</Text>
                        {sc.error && <Text size="xs" c="red">{sc.error}</Text>}
                        {sc.description && <Text size="xs" c="dimmed">{sc.description}</Text>}
                        {sc.changes?.changed_task_ids && sc.changes.changed_task_ids.length > 0 && (
                          <Text size="xs" c="dimmed">Изменено задач: {sc.changes.changed_task_ids.length}</Text>
                        )}
                      </Table.Td>
                      <Table.Td>
                        {isStale ? (
                          <Badge size="xs" color="orange" leftSection={<AlertTriangle size={10} />}>
                            Устарел (база v{sc.base_version})
                          </Badge>
                        ) : (
                          <Badge size="xs" color="teal" leftSection={<Check size={10} />}>
                            Актуален (v{sc.base_version})
                          </Badge>
                        )}
                      </Table.Td>
                      <Table.Td>
                        {sc.analysis ? (
                          <Text size="sm" fw={500}>{date(sc.analysis.finish)}</Text>
                        ) : sc.error ? (
                          <Text size="xs" c="dimmed">—</Text>
                        ) : (
                          <Button
                            size="compact-xs"
                            variant="subtle"
                            loading={Boolean(analyzingIds[sc.id])}
                            onClick={() => handleAnalyzeScenario(sc.id)}
                          >
                            Рассчитать
                          </Button>
                        )}
                      </Table.Td>
                      <Table.Td>
                        {sc.error ? "—" : sc.changes ? (
                          deltaMin > 0 ? (
                            <Badge size="xs" color="red">+{formatCalendarShift(deltaMin)}</Badge>
                          ) : deltaMin < 0 ? (
                            <Badge size="xs" color="teal">{formatCalendarShift(deltaMin)}</Badge>
                          ) : (
                            <Badge size="xs" color="gray" variant="light">0 мин</Badge>
                          )
                        ) : "—"}
                      </Table.Td>
                      <Table.Td>
                        {sc.error ? (
                          <Badge size="xs" color="gray">Нет расчёта</Badge>
                        ) : sc.analysis ? (
                          <Badge size="xs" color={exceeded ? "red" : "green"}>
                            {exceeded ? "Превышен" : "В срок"}
                          </Badge>
                        ) : (
                          "—"
                        )}
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm">{sc.error || !sc.analysis ? "—" : overloadsCount}</Text>
                      </Table.Td>
                      <Table.Td>
                        <Group gap={6}>
                          <Button
                            size="compact-xs"
                            variant="light"
                            disabled={actionBusy || isStale || !!sc.error}
                            onClick={() => handleApplyScenario(sc)}
                          >
                            В черновик
                          </Button>
                          <ActionIcon
                            size="xs"
                            color="red"
                            variant="subtle"
                            loading={actionBusy}
                            onClick={() => handleDeleteScenario(sc.id)}
                            title="Удалить сценарий"
                          >
                            <Trash2 size={14} />
                          </ActionIcon>
                        </Group>
                      </Table.Td>
                    </Table.Tr>
                  );
                })}
              </Table.Tbody>
            </Table>
            </div>

            {scenarios.length === 0 && !loadingScenarios && (
              <Card withBorder p="md" style={{ textAlign: "center" }}>
                <Text size="sm" c="dimmed" mb="xs">
                  Для этого проекта пока нет сохранённых сценариев в PostgreSQL.
                </Text>
                <Group justify="center">
                  <Button size="xs" variant="light" onClick={() => setActiveTab("create_draft")}>
                    Сохранить текущий черновик как сценарий
                  </Button>
                  <Button size="xs" variant="light" onClick={() => setActiveTab("whatif")}>
                    Быстрый What-If расчёт
                  </Button>
                </Group>
              </Card>
            )}
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="create_draft">
          <Stack gap="sm">
            <Text size="sm" c="dimmed">
              Сохраните текущий вариант правок (задачи, связи, длительности) как независимый сценарий в базе данных. Вы сможете в любой момент сравнить его с рабочим планом.
            </Text>
            <TextInput
              label="Название сценария"
              placeholder="например: Перенос интеграции на 10 дней"
              value={newScenarioName}
              onChange={(e) => setNewScenarioName(e.target.value)}
              required
            />
            <Textarea
              label="Описание гипотезы (опционально)"
              placeholder="Обоснование: почему рассматриваем этот вариант и какие риски он снимает..."
              value={newScenarioDesc}
              onChange={(e) => setNewScenarioDesc(e.target.value)}
              rows={3}
            />
            <Group justify="flex-end" mt="md">
              <Button variant="default" onClick={close}>Отмена</Button>
              <Button
                loading={actionBusy}
                onClick={handleCreateScenarioFromDraft}
                disabled={!newScenarioName.trim()}
              >
                Сохранить сценарий в PostgreSQL
              </Button>
            </Group>
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="whatif">
          <Stack gap="sm">
            <Text size="sm" c="dimmed">
              Оцените влияние сдвига длительности конкретной задачи на весь критический путь и сроки проекта.
            </Text>

            <Select
              label="Выберите незавершённую задачу"
              data={(draft?.tasks || []).filter(t => t.status !== "done").map((t) => ({ value: t.id, label: t.name }))}
              value={simTaskChoice || (draft?.tasks.find(t => t.status !== "done")?.id || "")}
              onChange={(v) => { setSimTaskChoice(v || ""); setSimResult(null); }}
            />

            <div>
              <Text size="xs" fw={700} mb={4}>Увеличение длительности: <strong>{simDelayDays} рабочих часов</strong></Text>
              <input
                type="range"
                min="0"
                max="40"
                value={simDelayDays}
                onChange={(e) => { setSimDelayDays(Number(e.target.value)); setSimResult(null); }}
                style={{ width: "100%", accentColor: "var(--purple)" }}
              />
            </div>

            {simError && <Alert color="red">{simError}</Alert>}
            
            <Group>
              <Button onClick={handleRunSimulation} loading={simBusy} leftSection={<Play size={14} />}>
                Рассчитать симуляцию
              </Button>
            </Group>

            {simResult && (
              <Card withBorder p="sm" mt="xs">
                <Stack gap="xs">
                  <Text fw={700}>Результат симуляции относительно рабочего плана</Text>
                  <Group justify="space-between">
                    <Text size="sm">Прогноз завершения: <strong>{date(simResult.analysis.finish)}</strong></Text>
                    <Text size="sm">Сдвиг: <strong>{formatCalendarShift(simResult.changes?.finish_delta_minutes || 0)}</strong></Text>
                  </Group>
                  <Group justify="space-between">
                    <Text size="sm">Задачи с изменёнными датами: {simResult.changes?.changed_task_ids.length || 0}</Text>
                    <Text size="sm">Дедлайн: <strong>{simResult.analysis.deadline_exceeded ? "Превышен" : "В срок"}</strong></Text>
                  </Group>
                  <Text size="sm">Периоды перегрузки ресурсов: {simResult.analysis.overloads.length}</Text>
                  
                  <Divider my="xs" />

                  <TextInput
                    label="Название сценария для сохранения"
                    placeholder="например: Задержка поставки API"
                    value={newScenarioName}
                    onChange={(e) => setNewScenarioName(e.target.value)}
                  />

                  <Group justify="space-between" mt="xs">
                    <Button variant="light" onClick={applySimulationToDraft}>
                      Перенести в черновик
                    </Button>
                    <Button
                      loading={actionBusy}
                      onClick={handleCreateScenarioFromWhatif}
                      disabled={!newScenarioName.trim()}
                    >
                      Сохранить как сценарий
                    </Button>
                  </Group>
                </Stack>
              </Card>
            )}
          </Stack>
        </Tabs.Panel>
      </Tabs>
    </Modal>
  );
}

import { Alert, Button, Card, Modal, Select, Stack, Text } from "@mantine/core";
import { useScenarioModal } from "@/feature/ScenarioModal/useScenarioModal";

export function ScenarioModal() {
  const {
    draft,
    showScenarioModal, setShowScenarioModal,
    simTaskChoice, setSimTaskChoice,
    simDelayDays, setSimDelayDays,
    simResult, setSimResult,
    simError,
    simBusy,
    date,
    close,
    handleRunSimulation,
    applyScenario,
  } = useScenarioModal();

  return (
    <>
      {/* Scenario Modal (What if?) */}
      {showScenarioModal && (
        <Modal
          opened={showScenarioModal}
          onClose={close}
          title="ПРОВЕРКА ИЗМЕНЕНИЯ — Что если?"
          size="md"
        >
          <Stack gap="sm">
            <Text size="sm" c="dimmed">
              Проверьте последствия до того, как менять план проекта.
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
            <Button onClick={handleRunSimulation} loading={simBusy}>
              Запустить сценарий
            </Button>

            {simResult && <Card withBorder p="sm"><Stack gap="xs">
              <Text fw={700}>Результат движка относительно сохранённого плана</Text>
              <Text>Прогноз завершения: {date(simResult.analysis.finish)}</Text>
              <Text>Сдвиг: {simResult.changes?.finish_delta_minutes || 0} календарных минут</Text>
              <Text>Задачи с изменёнными датами: {simResult.changes?.changed_task_ids.length || 0}</Text>
              <Text>Дедлайн: {simResult.analysis.deadline_exceeded ? "превышен" : "не превышен"}</Text>
              <Text>Периоды перегрузки: {simResult.analysis.overloads.length}</Text>
              <Button onClick={applyScenario}>Перенести сценарий в черновик</Button>
            </Stack></Card>}
          </Stack>
        </Modal>
      )}
    </>
  );
}

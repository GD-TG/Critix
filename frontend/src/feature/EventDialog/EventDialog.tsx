import { Badge, Button, Group, Loader, Modal, NumberInput, Paper, Select, Stack, Tabs, Text, TextInput } from "@mantine/core";
import { AlertCircle, AlertTriangle, ArrowRight, Calendar, Check, Clock, UserX, Wrench, Zap } from "lucide-react";
import { useEventDialog } from "./useEventDialog";
import { formatShortDate, getZone } from "@/shared";

export function EventDialog() {
  const {
    opened,
    closeDialog,
    activeKind,
    setActiveKind,
    taskId,
    setTaskId,
    extraDays,
    setExtraDays,
    assigneeId,
    setAssigneeId,
    fromDate,
    setFromDate,
    toDate,
    setToDate,
    handoverTo,
    setHandoverTo,
    untilDate,
    setUntilDate,
    newTaskName,
    setNewTaskName,
    durationDays,
    setDurationDays,
    afterTaskId,
    setAfterTaskId,
    beforeTaskId,
    setBeforeTaskId,
    newDeadline,
    setNewDeadline,
    previewData,
    loading,
    handleApplyToDraft,
    draft,
    saved,
  } = useEventDialog();

  if (!draft) return null;

  const zone = getZone(draft, saved);
  const shortDate = (iso?: string) => (iso ? formatShortDate(iso, zone) : "—");

  const taskOptions = draft.tasks.map((t) => ({ value: t.id, label: t.name }));
  const assigneeOptions = [
    { value: "", label: "Без передачи (ожидание)" },
    ...draft.assignees.map((a) => ({ value: a.id, label: `${a.name} (${a.role || "Специалист"})` })),
  ];

  const deltaMinutes = previewData?.comparison?.finish_delta_minutes || 0;
  const deltaDays = Math.round(deltaMinutes / 1440);
  const changedCount = previewData?.comparison?.changed_task_ids?.length || 0;

  const isExceeded = previewData?.analysis?.deadline_exceeded;
  const delayMinutes = previewData?.analysis?.delay_minutes || 0;
  const lateDays = Math.ceil(delayMinutes / 1440);
  const financialRisk = lateDays > 0 ? lateDays * 35000 : 0;

  return (
    <Modal
      opened={opened}
      onClose={closeDialog}
      title={
        <Group gap="xs">
          <Zap size={18} color="var(--mantine-color-red-6)" />
          <Text fw={700}>Что случилось? Моделирование ситуации</Text>
        </Group>
      }
      size="lg"
      centered
    >
      <Tabs value={activeKind} onChange={(val) => setActiveKind(val as any)}>
        <Tabs.List grow>
          <Tabs.Tab value="harder" leftSection={<Wrench size={14} />}>
            Сложнее
          </Tabs.Tab>
          <Tabs.Tab value="absence" leftSection={<UserX size={14} />}>
            Отпуск/Болезнь
          </Tabs.Tab>
          <Tabs.Tab value="delay" leftSection={<Clock size={14} />}>
            Подрядчик
          </Tabs.Tab>
          <Tabs.Tab value="scope" leftSection={<AlertCircle size={14} />}>
            Новая задача
          </Tabs.Tab>
          <Tabs.Tab value="deadline" leftSection={<Calendar size={14} />}>
            Дедлайн
          </Tabs.Tab>
        </Tabs.List>

        <Stack mt="md" gap="sm">
          {activeKind === "harder" && (
            <>
              <Select
                label="Какая задача оказалась сложнее?"
                placeholder="Выберите задачу"
                data={taskOptions}
                value={taskId}
                onChange={(val) => setTaskId(val || "")}
                searchable
              />
              <div>
                <Text size="sm" fw={500} mb={4}>
                  Сколько дополнительных рабочих дней потребуется?
                </Text>
                <Group gap="xs" mb="xs">
                  <Button size="xs" variant={extraDays === 2 ? "filled" : "light"} color="gray" onClick={() => setExtraDays(2)}>
                    +2 дня
                  </Button>
                  <Button size="xs" variant={extraDays === 5 ? "filled" : "light"} color="gray" onClick={() => setExtraDays(5)}>
                    +5 дней
                  </Button>
                  <Button size="xs" variant={extraDays === 10 ? "filled" : "light"} color="gray" onClick={() => setExtraDays(10)}>
                    +10 дней
                  </Button>
                </Group>
                <NumberInput
                  min={1}
                  max={60}
                  value={extraDays}
                  onChange={(val) => setExtraDays(Number(val) || 1)}
                />
              </div>
            </>
          )}

          {activeKind === "absence" && (
            <>
              <Select
                label="Кто из сотрудников временно недоступен?"
                placeholder="Выберите участника"
                data={assigneeOptions.filter((a) => a.value !== "")}
                value={assigneeId}
                onChange={(val) => setAssigneeId(val || "")}
              />
              <Group grow>
                <TextInput
                  type="date"
                  label="Дата начала отсутствия"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                />
                <TextInput
                  type="date"
                  label="Дата возвращения"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                />
              </Group>
              <Select
                label="Передать задачи другому участнику?"
                placeholder="Выберите заместителя или оставьте пустым"
                data={assigneeOptions.filter((a) => a.value !== assigneeId)}
                value={handoverTo}
                onChange={(val) => setHandoverTo(val || "")}
              />
            </>
          )}

          {activeKind === "delay" && (
            <>
              <Select
                label="Какая задача ожидает внешнюю поставку / подрядчика?"
                placeholder="Выберите задачу"
                data={taskOptions}
                value={taskId}
                onChange={(val) => setTaskId(val || "")}
                searchable
              />
              <TextInput
                type="date"
                label="Новая дата готовности поставки (не раньше)"
                value={untilDate}
                onChange={(e) => setUntilDate(e.target.value)}
              />
            </>
          )}

          {activeKind === "scope" && (
            <>
              <TextInput
                label="Название новой задачи"
                value={newTaskName}
                onChange={(e) => setNewTaskName(e.target.value)}
              />
              <NumberInput
                label="Оценка трудоёмкости (рабочих дней)"
                min={1}
                max={60}
                value={durationDays}
                onChange={(val) => setDurationDays(Number(val) || 1)}
              />
              <Select
                label="Выполнять после задачи (предшественник)"
                placeholder="Начало цепочки или выберите задачу"
                data={[{ value: "", label: "Без предшественника" }, ...taskOptions]}
                value={afterTaskId}
                onChange={(val) => setAfterTaskId(val || "")}
                searchable
                clearable
              />
              <Select
                label="Блокирует задачу (последователь)"
                placeholder="Конец цепочки или выберите задачу"
                data={[{ value: "", label: "Без последователя" }, ...taskOptions]}
                value={beforeTaskId}
                onChange={(val) => setBeforeTaskId(val || "")}
                searchable
                clearable
              />
            </>
          )}

          {activeKind === "deadline" && (
            <>
              <div>
                <Text size="sm" fw={500} mb={4}>
                  Новая дата дедлайна проекта
                </Text>
                <Group gap="xs" mb="xs">
                  <Button
                    size="xs"
                    variant="light"
                    color="gray"
                    onClick={() => {
                      const d = new Date(draft.deadline);
                      d.setDate(d.getDate() + 7);
                      setNewDeadline(d.toISOString().slice(0, 10));
                    }}
                  >
                    +1 неделя
                  </Button>
                  <Button
                    size="xs"
                    variant="light"
                    color="gray"
                    onClick={() => {
                      const d = new Date(draft.deadline);
                      d.setDate(d.getDate() + 14);
                      setNewDeadline(d.toISOString().slice(0, 10));
                    }}
                  >
                    +2 недели
                  </Button>
                </Group>
                <TextInput
                  type="date"
                  value={newDeadline}
                  onChange={(e) => setNewDeadline(e.target.value)}
                />
              </div>
            </>
          )}

          {/* Секция быстрого превью последствий */}
          <Paper withBorder p="sm" radius="md" bg="var(--bg)">
            <Group justify="space-between" align="center" mb={6}>
              <Text size="xs" fw={700} c="dimmed">
                ПРЕДВАРИТЕЛЬНАЯ ОЦЕНКА ПОСЛЕДСТВИЙ (CPM)
              </Text>
              {loading && <Loader size="xs" />}
            </Group>

            {previewData ? (
              <Stack gap="xs">
                <Group justify="space-between">
                  <Text size="sm">Расчётный финиш:</Text>
                  <Group gap="xs">
                    <Text size="sm" fw={700}>
                      {shortDate(previewData.analysis?.finish)}
                    </Text>
                    {deltaDays !== 0 && (
                      <Badge color={deltaDays > 0 ? "orange" : "teal"} size="sm">
                        {deltaDays > 0 ? `+${deltaDays} дн.` : `${deltaDays} дн.`}
                      </Badge>
                    )}
                  </Group>
                </Group>

                <Group justify="space-between">
                  <Text size="sm">Затронуто задач в графе:</Text>
                  <Text size="sm" fw={600}>
                    {changedCount} шт.
                  </Text>
                </Group>

                {isExceeded && (
                  <Group justify="space-between">
                    <Group gap={4}>
                      <AlertTriangle size={14} color="var(--mantine-color-red-6)" />
                      <Text size="sm" c="red" fw={600}>
                        Превышение дедлайна:
                      </Text>
                    </Group>
                    <Text size="sm" c="red" fw={700}>
                      +{lateDays} дн. (риск: ~{financialRisk.toLocaleString("ru-RU")} ₽)
                    </Text>
                  </Group>
                )}
              </Stack>
            ) : (
              <Text size="xs" c="dimmed">
                Заполните параметры события для автоматического расчёта сдвигов.
              </Text>
            )}
          </Paper>

          <Group justify="flex-end" mt="sm">
            <Button variant="subtle" color="gray" onClick={closeDialog}>
              Отмена
            </Button>
            <Button
              color="red"
              disabled={!previewData}
              onClick={handleApplyToDraft}
              leftSection={<Check size={16} />}
            >
              Применить к черновику
            </Button>
          </Group>
        </Stack>
      </Tabs>
    </Modal>
  );
}

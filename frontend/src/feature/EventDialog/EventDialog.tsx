import { Modal, Select, NumberInput, TextInput, Button, Stack, Group } from "@mantine/core";
import { useEventDialog } from "./useEventDialog";

export interface EventDialogProps {
  opened: boolean;
  onClose: () => void;
}

export function EventDialog({ opened, onClose }: EventDialogProps) {
  const {
    draft,
    situation,
    setSituation,
    taskId,
    setTaskId,
    extraDays,
    setExtraDays,
    assigneeId,
    setAssigneeId,
    handoverTo,
    setHandoverTo,
    newStartDate,
    setNewStartDate,
    taskName,
    setTaskName,
    durationDays,
    setDurationDays,
    afterTaskId,
    setAfterTaskId,
    newDeadline,
    setNewDeadline,
    handleApply,
    closeAndReset,
  } = useEventDialog(onClose);

  if (!draft) return null;

  const taskOptions = draft.tasks.map((t) => {
    const statusText = t.status === "done" ? " [Завершена]" : t.status === "in_progress" ? " [В работе]" : " [План]";
    return { value: t.id, label: `${t.name}${statusText}` };
  });
  const assigneeOptions = draft.assignees.map((a) => ({
    value: a.id,
    label: a.role ? `${a.name} (${a.role})` : a.name,
  }));

  return (
    <Modal opened={opened} onClose={closeAndReset} title="Моделирование события" centered>
      <Stack>
        <Select
          label="Ситуация"
          placeholder="Выберите ситуацию"
          data={[
            { value: "harder", label: "Задача оказалась сложнее" },
            { value: "absence", label: "Сотрудник заболел/отпуск" },
            { value: "delay", label: "Подрядчик задерживает старт" },
            { value: "scope", label: "Заказчик добавил требование" },
            { value: "deadline", label: "Перенос дедлайна" },
          ]}
          value={situation}
          onChange={(val) => setSituation(val as any)}
        />

        {situation === "harder" && (
          <>
            <Select
              label="Задача"
              placeholder="Выберите задачу"
              data={taskOptions}
              value={taskId}
              onChange={setTaskId}
              searchable
            />
            <NumberInput
              label="Дополнительные дни"
              placeholder="+N дней"
              value={extraDays}
              onChange={setExtraDays}
              min={1}
            />
          </>
        )}

        {situation === "absence" && (
          <>
            <Select
              label="Кто отсутствует"
              placeholder="Выберите сотрудника"
              data={assigneeOptions}
              value={assigneeId}
              onChange={setAssigneeId}
              searchable
            />
            <Select
              label="Кому передать задачи"
              placeholder="Выберите сотрудника"
              data={assigneeOptions}
              value={handoverTo}
              onChange={setHandoverTo}
              searchable
            />
          </>
        )}

        {situation === "delay" && (
          <>
            <Select
              label="Задача"
              placeholder="Выберите задачу"
              data={taskOptions}
              value={taskId}
              onChange={setTaskId}
              searchable
            />
            <TextInput
              label="Новая дата старта"
              type="datetime-local"
              value={newStartDate}
              onChange={(e) => setNewStartDate(e.currentTarget.value)}
            />
          </>
        )}

        {situation === "scope" && (
          <>
            <TextInput
              label="Название новой задачи"
              placeholder="Введите название"
              value={taskName}
              onChange={(e) => setTaskName(e.currentTarget.value)}
            />
            <NumberInput
              label="Длительность (в днях)"
              value={durationDays}
              onChange={setDurationDays}
              min={1}
            />
            <Select
              label="После какой задачи"
              placeholder="Выберите предшественника"
              data={taskOptions}
              value={afterTaskId}
              onChange={setAfterTaskId}
              searchable
            />
          </>
        )}

        {situation === "deadline" && (
          <>
            <TextInput
              label="Новый дедлайн"
              type="datetime-local"
              value={newDeadline}
              onChange={(e) => setNewDeadline(e.currentTarget.value)}
            />
          </>
        )}

        <Group justify="flex-end" mt="md">
          <Button variant="default" onClick={closeAndReset}>
            Отмена
          </Button>
          <Button onClick={handleApply} disabled={!situation}>
            Применить
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

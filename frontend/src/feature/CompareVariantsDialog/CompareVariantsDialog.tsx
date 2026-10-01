import { Modal, Table, Text } from "@mantine/core";
import { useApp } from "@/context/AppContext";
import { formatDateTime, getZone } from "@/shared";

export interface CompareVariantsDialogProps {
  opened: boolean;
  onClose: () => void;
}

export function CompareVariantsDialog({ opened, onClose }: CompareVariantsDialogProps) {
  const { saved, preview, draft } = useApp();

  if (!saved || !preview || !draft) {
    return (
      <Modal opened={opened} onClose={onClose} title="Сравнение вариантов" size="xl">
        <Text>Нет данных для сравнения.</Text>
      </Modal>
    );
  }

  const zone = getZone(draft, saved);
  
  const savedFinish = saved.analysis.finish;
  const previewFinish = preview.analysis.finish;
  const deadline = draft.deadline;

  const savedFinishDate = new Date(savedFinish);
  const previewFinishDate = new Date(previewFinish);
  const deadlineDate = new Date(deadline);

  const getLateDays = (finishDate: Date) => {
    const diff = finishDate.getTime() - deadlineDate.getTime();
    return diff > 0 ? Math.ceil(diff / 86400000) : 0;
  };

  const getReserveDays = (finishDate: Date) => {
    const diff = deadlineDate.getTime() - finishDate.getTime();
    return Math.floor(diff / 86400000);
  };

  const savedReserve = getReserveDays(savedFinishDate);
  const previewReserve = getReserveDays(previewFinishDate);

  const savedLateDays = getLateDays(savedFinishDate);
  const previewLateDays = getLateDays(previewFinishDate);

  const savedPenalty = savedLateDays * 35000;
  const previewPenalty = previewLateDays * 35000;

  const savedCriticalTasksCount = saved.analysis.tasks.filter((t) => t.critical).length;
  const previewCriticalTasksCount = preview.analysis.tasks.filter((t) => t.critical).length;

  const finishDeltaDays = Math.round((previewFinishDate.getTime() - savedFinishDate.getTime()) / 86400000);
  const finishDeltaText = finishDeltaDays === 0 ? "Без изменений" : finishDeltaDays > 0 ? `+${finishDeltaDays} дн.` : `${finishDeltaDays} дн.`;

  const reserveDelta = previewReserve - savedReserve;
  const reserveDeltaText = reserveDelta === 0 ? "Без изменений" : reserveDelta > 0 ? `+${reserveDelta} дн.` : `${reserveDelta} дн.`;

  const penaltyDelta = previewPenalty - savedPenalty;
  const penaltyDeltaText = penaltyDelta === 0 ? "Без изменений" : penaltyDelta > 0 ? `+${penaltyDelta.toLocaleString("ru-RU")} руб.` : `${penaltyDelta.toLocaleString("ru-RU")} руб.`;

  const criticalTasksDelta = previewCriticalTasksCount - savedCriticalTasksCount;
  const criticalTasksDeltaText = criticalTasksDelta === 0 ? "Без изменений" : criticalTasksDelta > 0 ? `+${criticalTasksDelta}` : `${criticalTasksDelta}`;

  const hasChanges = preview.changes && (
    (preview.changes.changed_task_ids && preview.changes.changed_task_ids.length > 0) || 
    (preview.changes.removed_task_ids && preview.changes.removed_task_ids.length > 0)
  );
  const changesText = hasChanges ? "Смоделированы изменения в задачах" : "Нет изменений";

  return (
    <Modal opened={opened} onClose={onClose} title="Сравнение вариантов" size="xl">
      <Table withTableBorder withColumnBorders>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Метрика</Table.Th>
            <Table.Th>Было</Table.Th>
            <Table.Th>Стало</Table.Th>
            <Table.Th>Дельта</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          <Table.Tr>
            <Table.Td>Дата финиша</Table.Td>
            <Table.Td>{formatDateTime(savedFinish, zone)}</Table.Td>
            <Table.Td>{formatDateTime(previewFinish, zone)}</Table.Td>
            <Table.Td>{finishDeltaText}</Table.Td>
          </Table.Tr>
          <Table.Tr>
            <Table.Td>Запас до дедлайна</Table.Td>
            <Table.Td>{savedReserve} дн.</Table.Td>
            <Table.Td>{previewReserve} дн.</Table.Td>
            <Table.Td>{reserveDeltaText}</Table.Td>
          </Table.Tr>
          <Table.Tr>
            <Table.Td>Финансовый штраф</Table.Td>
            <Table.Td>{savedPenalty.toLocaleString("ru-RU")} руб.</Table.Td>
            <Table.Td>{previewPenalty.toLocaleString("ru-RU")} руб.</Table.Td>
            <Table.Td>{penaltyDeltaText}</Table.Td>
          </Table.Tr>
          <Table.Tr>
            <Table.Td>Количество задач на критическом пути</Table.Td>
            <Table.Td>{savedCriticalTasksCount}</Table.Td>
            <Table.Td>{previewCriticalTasksCount}</Table.Td>
            <Table.Td>{criticalTasksDeltaText}</Table.Td>
          </Table.Tr>
          <Table.Tr>
            <Table.Td>Изменения</Table.Td>
            <Table.Td colSpan={3}>{changesText}</Table.Td>
          </Table.Tr>
        </Table.Tbody>
      </Table>
    </Modal>
  );
}

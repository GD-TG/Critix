import { Modal, Textarea, Button, Stack, Group, CopyButton } from "@mantine/core";
import { useApp } from "@/context/AppContext";
import { formatShortDate, getZone } from "@/shared";
import { Copy, Check } from "lucide-react";

export interface BriefDialogProps {
  opened: boolean;
  onClose: () => void;
}

export function BriefDialog({ opened, onClose }: BriefDialogProps) {
  const { saved, preview, draft, costPerDay } = useApp();

  let text = "";

  if (saved && preview && draft) {
    const zone = getZone(draft, saved);
    const savedFinishDate = new Date(saved.analysis.finish);
    const previewFinishDate = new Date(preview.analysis.finish);
    const deadlineDate = new Date(draft.deadline);

    const finishDeltaDays = Math.round(
      (previewFinishDate.getTime() - savedFinishDate.getTime()) / 86400000
    );

    const getLateDays = (finishDate: Date) => {
      const diff = finishDate.getTime() - deadlineDate.getTime();
      return diff > 0 ? Math.ceil(diff / 86400000) : 0;
    };

    const previewLateDays = getLateDays(previewFinishDate);
    const previewPenalty = previewLateDays * costPerDay;

    const newDateText = formatShortDate(preview.analysis.finish, zone);

    if (finishDeltaDays > 0) {
      const penaltyText = previewPenalty > 0
        ? ` Финансовые риски: штраф составит ${previewPenalty.toLocaleString("ru-RU")} руб. Предлагаем согласовать перенос дедлайна или оптимизировать состав релиза.`
        : " Проект остаётся в рамках дедлайна, финансовых рисков нет.";
      text = `Уважаемый заказчик, из-за недавних изменений расчётный финиш проекта сдвигается на +${finishDeltaDays} дн. Новый планируемый срок: ${newDateText}.${penaltyText}`;
    } else if (finishDeltaDays < 0) {
      const earlyDays = Math.abs(finishDeltaDays);
      text = `Уважаемый заказчик, благодаря оптимизации расписания проект опережает базовый план на ${earlyDays} дн. Новый расчётный срок завершения: ${newDateText}. Рисков срыва дедлайна нет.`;
    } else {
      text = `Уважаемый заказчик, дата завершения проекта остаётся без изменений: ${newDateText}. Проект выполняется в строгом соответствии с графиком.`;
    }
  }

  return (
    <Modal opened={opened} onClose={onClose} title="Письмо заказчику" size="lg">
      {text ? (
        <Stack gap="md">
          <Textarea
            value={text}
            readOnly
            minRows={5}
            autosize
          />
          <Group justify="flex-end">
            <CopyButton value={text}>
              {({ copied, copy }) => (
                <Button
                  color={copied ? "teal" : "blue"}
                  onClick={copy}
                  leftSection={copied ? <Check size={16} /> : <Copy size={16} />}
                >
                  {copied ? "Скопировано" : "Копировать"}
                </Button>
              )}
            </CopyButton>
          </Group>
        </Stack>
      ) : (
        <div>Нет данных для формирования письма.</div>
      )}
    </Modal>
  );
}

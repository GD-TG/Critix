import { Modal, Textarea, Button, Stack, Group, CopyButton } from "@mantine/core";
import { useApp } from "@/context/AppContext";
import { formatShortDate, getZone } from "@/shared";
import { Copy, Check } from "lucide-react";

export interface BriefDialogProps {
  opened: boolean;
  onClose: () => void;
}

export function BriefDialog({ opened, onClose }: BriefDialogProps) {
  const { saved, preview, draft } = useApp();

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
    const previewPenalty = previewLateDays * 35000;

    const newDateText = formatShortDate(preview.analysis.finish, zone);

    text = `Уважаемый заказчик, из-за недавних изменений финиш проекта сдвигается на ${finishDeltaDays} дней. Новый срок: ${newDateText}. Финансовые риски: штраф составит ${previewPenalty.toLocaleString("ru-RU")} руб. Предлагаем согласовать перенос дедлайна или урезать скоуп.`;
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

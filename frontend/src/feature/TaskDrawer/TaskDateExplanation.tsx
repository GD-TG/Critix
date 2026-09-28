import { Button, Card, Stack, Text } from "@mantine/core";
import { useProjects } from "@/context/ProjectContext";
import type { Task } from "@/types";

export function TaskDateExplanation({ task, onOpen }: { task: Task; onOpen: (task: Task) => void }) {
  const { draft, view } = useProjects();
  const calculatedTask = view?.project.tasks.find((item) => item.id === task.id);
  const current = !!view && JSON.stringify(draft) === JSON.stringify(view.project)
    && JSON.stringify(task) === JSON.stringify(calculatedTask);
  const row = view?.analysis.tasks.find((item) => item.id === task.id);
  const explanation = row?.explanation;
  const date = (value: string) => new Date(value).toLocaleString("ru-RU", {
    timeZone: view?.project.timezone, dateStyle: "short", timeStyle: "short",
  });
  return <Card withBorder padding="sm">
    <Stack gap="xs">
      <Text fw={600}>Что определяет срок</Text>
      {!current ? <Text size="sm" c="dimmed">Сохраните правки карточки в черновик и нажмите «Показать последствия». Причины появятся после пересчёта.</Text>
        : !explanation || !row ? <Text size="sm" c="dimmed">Для этого результата нет объяснения. Обновите проект или пересчитайте план.</Text>
        : <>
          <Text size="sm">Начало: {date(row.start)} · окончание: {date(row.finish)}</Text>
          <Text size="xs" c="dimmed">Часовой пояс: {view?.project.timezone}</Text>
          {view?.analysis.forecast_stale && <Text size="sm" c="orange">Прогноз устарел: причины относятся к текущему расписанию, факты или длительности требуют уточнения.</Text>}
          {explanation.mode === "actual" && <Text size="sm">Начало зафиксировано фактической датой. {explanation.actual_finish ? "Окончание также задано фактом." : "Окончание рассчитано по общей длительности от фактического начала и рабочему календарю."}</Text>}
          {explanation.constraints.filter((reason) => reason.driving || reason.violated).map((reason, index) => {
            const dep = reason.dependency;
            const predecessor = view?.project.tasks.find((item) => item.id === dep?.predecessor_id);
            return <Stack key={index} gap={3}>
              <Text size="sm" c={reason.violated ? "red" : undefined}>
                {reason.violated ? "Нарушено ограничение: " : "Определяющее ограничение: "}
                {reason.source === "project_start" ? "начало проекта" : reason.source === "not_before" ? "«Начать не раньше»" : `«${predecessor?.name || dep?.predecessor_id}», связь ${dep?.kind}, лаг ${dep?.lag_minutes} мин (${dep?.lag_mode === "working" ? "рабочих" : "календарных"})`}.
                {" "}{reason.target === "start" ? "Начало" : "Окончание"} не раньше {date(reason.bound)}.
              </Text>
              {reason.calendar_adjusted && <Text size="sm">По {explanation.assignee_id ? "пересечению календарей проекта и исполнителя" : "календарю проекта"} ближайшее доступное начало — {date(reason.candidate_start!)}.</Text>}
              {predecessor && <Button variant="subtle" size="compact-xs" onClick={() => onOpen(structuredClone(predecessor))}>Открыть «{predecessor.name}»</Button>}
            </Stack>;
          })}
          {explanation.mode === "calculated" && <Text size="xs" c="dimmed">Длительность: {explanation.duration_minutes / 60} рабочих часов; окончание учитывает перерывы и нерабочее время. Перегрузка сама по себе не переносит задачу.</Text>}
        </>}
    </Stack>
  </Card>;
}

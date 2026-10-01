import { useState, useMemo } from "react";
import { useApp } from "@/context/AppContext";
import { formatShortDate, getZone } from "@/shared";

export function useBriefDialog() {
  const { draft, saved, preview, view, briefDialogOpened, setBriefDialogOpened } = useApp();
  const [activeTab, setActiveTab] = useState<string>("client");

  const texts = useMemo(() => {
    if (!draft || !saved || !view) {
      return { client: "", short: "", team: "" };
    }

    const zone = getZone(draft, saved);
    const shortDate = (iso?: string) => (iso ? formatShortDate(iso, zone) : "—");

    const baseFinish = saved.analysis.finish;
    const currentFinish = view.analysis.finish;
    const isExceeded = view.analysis.deadline_exceeded;
    const delayMinutes = view.analysis.delay_minutes || 0;
    const lateDays = Math.ceil(delayMinutes / 1440);
    const deltaMinutes = preview?.changes?.finish_delta_minutes || 0;
    const deltaDays = Math.round(deltaMinutes / 1440);

    const changedTaskIds = new Set(preview?.changes?.changed_task_ids || []);
    const changedTasks = draft.tasks.filter((t) => changedTaskIds.has(t.id));

    const financialImpact = lateDays > 0 ? lateDays * 35000 : 0; // standard penalty rate per day

    // 1. Письмо заказчику
    let client = `Уважаемый заказчик!\n\nИнформируем о текущем статусе реализации проекта «${draft.name}».\n\n`;
    if (deltaDays > 0) {
      client += `По результатам моделирования графика зафиксировано смещение срока окончания проекта на +${deltaDays} дн.\n`;
      client += `Расчётная дата завершения: ${shortDate(currentFinish)} (согласованный дедлайн: ${shortDate(draft.deadline)}).\n`;
      if (isExceeded) {
        client += `\nВНИМАНИЕ: Смещение превышает допустимый буфер. Прогнозируется задержка на ${lateDays} дн.\n`;
        client += `Оценочный размер контрактных рисков (штрафных санкций): ${financialImpact.toLocaleString("ru-RU")} ₽.\n\n`;
        client += `Факторы смещения:\n`;
        changedTasks.slice(0, 5).forEach((t) => {
          client += `- Задача «${t.name}» (длительность: ${Math.round(t.duration_minutes / 60)} ч)\n`;
        });
        client += `\nПредлагаемые меры:\n`;
        client += `1. Оптимизация параллельного выполнения технологических цепочек.\n`;
        client += `2. Перераспределение ресурсов с некритических задач.\n`;
      } else {
        client += `Смещение полностью компенсировано внутренним резервом времени (буфером). Дедлайн проекта не нарушен.\n`;
      }
    } else if (deltaDays < 0) {
      client += `Проект оптимизирован: срок сдачи сокращён на ${Math.abs(deltaDays)} дн. (план: ${shortDate(currentFinish)}).\n`;
    } else {
      client += `Проект выполняется строго в рамках согласованного расписания. Срок сдачи: ${shortDate(currentFinish)}.\n`;
    }
    client += `\nС уважением,\nКоманда проекта «${draft.name}»`;

    // 2. Коротко (Telegram / Slack)
    let short = `📊 *Статус проекта: ${draft.name}*\n`;
    short += `• Дедлайн: ${shortDate(draft.deadline)}\n`;
    short += `• Расчётный финиш: ${shortDate(currentFinish)} (${deltaDays > 0 ? `+${deltaDays} дн.` : deltaDays < 0 ? `${deltaDays} дн.` : "в графике"})\n`;
    if (isExceeded) {
      short += `• ⚠️ Риск просрочки: ${lateDays} дн. (штрафы: ~${financialImpact.toLocaleString("ru-RU")} ₽)\n`;
    } else {
      short += `• ✅ Запас до дедлайна: в пределах нормы\n`;
    }
    if (changedTasks.length > 0) {
      short += `• Затронуто задач: ${changedTasks.length} шт.`;
    }

    // 3. Команде
    let team = `Коллеги, внимание! Изменение в расписании проекта «${draft.name}»:\n\n`;
    const assigneeMap = new Map<string, string>();
    draft.assignees.forEach((a) => assigneeMap.set(a.id, a.name));

    const tasksByAssignee = new Map<string, string[]>();
    changedTasks.forEach((t) => {
      const aName = t.assignee_id ? assigneeMap.get(t.assignee_id) || t.assignee_id : "Без исполнителя";
      const list = tasksByAssignee.get(aName) || [];
      list.push(t.name);
      tasksByAssignee.set(aName, list);
    });

    if (tasksByAssignee.size > 0) {
      tasksByAssignee.forEach((tasks, person) => {
        team += `👤 ${person}:\n`;
        tasks.forEach((tName) => {
          team += `   • ${tName}\n`;
        });
      });
      team += `\nПожалуйста, скорректируйте календарный план в соответствии с обновлёнными сроками.`;
    } else {
      team += `Затронуты общие параметры проекта или системные связи. Персональные сдвиги задач минимальны.`;
    }

    return { client, short, team };
  }, [draft, saved, preview, view]);

  const closeDialog = () => setBriefDialogOpened(false);

  return {
    opened: briefDialogOpened,
    closeDialog,
    activeTab,
    setActiveTab,
    texts,
  };
}

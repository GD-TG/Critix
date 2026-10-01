import { useState, useCallback, useMemo } from "react";
import { useApp } from "@/context/AppContext";
import { api } from "@/api";
import type { Result } from "@/types";
import { formatShortDate, getZone } from "@/shared";

export function useDraftBar() {
  const {
    draft,
    saved,
    preview,
    view,
    dirty,
    change,
    accept,
    run,
    showNotification,
    setShowScenarioModal,
  } = useApp();

  const [isApplying, setIsApplying] = useState(false);

  const zone = getZone(draft, saved);
  const shortDate = (iso?: string) => (iso ? formatShortDate(iso, zone) : "—");

  const handleCancel = useCallback(() => {
    if (saved) {
      change(saved.project);
      showNotification("Черновик отменён, возвращены исходные данные");
    }
  }, [saved, change, showNotification]);

  const handleApply = useCallback(async () => {
    if (!draft || !saved) return;
    setIsApplying(true);
    try {
      const res = await run(() =>
        api<Result>(`/projects/${saved.id}`, "PUT", {
          version: saved.version,
          project: draft,
          comment: "Применено из черновика",
        })
      );
      if (res) {
        accept(res, true);
        showNotification("Изменения успешно сохранены в проекте");
      }
    } finally {
      setIsApplying(false);
    }
  }, [draft, saved, run, accept, showNotification]);

  const openScenario = useCallback(() => {
    setShowScenarioModal(true);
  }, [setShowScenarioModal]);

  return useMemo(() => {
    if (!dirty || !draft || !saved || !view) {
      return { isActive: false };
    }

    const baseFinish = saved.analysis.finish;
    const currentFinish = view.analysis.finish;
    const deltaMinutes = preview?.changes?.finish_delta_minutes || 0;
    const deltaDays = Math.round(deltaMinutes / 1440);

    const isExceeded = view.analysis.deadline_exceeded;
    const delayMinutes = view.analysis.delay_minutes || 0;
    const lateDays = Math.ceil(delayMinutes / 1440);

    const changedCount = preview?.changes?.changed_task_ids?.length || 0;
    const desc = changedCount > 0 
      ? `Черновик: изменено задач — ${changedCount}` 
      : "Черновик: параметры изменены";

    let verdict = "В графике";
    let color: "teal" | "orange" | "red" = "teal";

    if (isExceeded || lateDays > 0) {
      verdict = `Срыв срока (+${lateDays} дн.)`;
      color = "red";
    } else if (deltaDays > 0) {
      verdict = `Сдвиг (+${deltaDays} дн.)`;
      color = "orange";
    }

    const sign = deltaDays > 0 ? "+" : "";
    const finishText = deltaDays !== 0 
      ? `Финиш: ${shortDate(baseFinish)} → ${shortDate(currentFinish)} (${sign}${deltaDays} дн.)`
      : `Финиш: ${shortDate(currentFinish)}`;

    return {
      isActive: true,
      desc,
      verdict,
      color,
      finishText,
      isApplying,
      handleCancel,
      handleApply,
      openScenario,
    };
  }, [dirty, draft, saved, view, preview, isApplying, handleCancel, handleApply, openScenario]);
}

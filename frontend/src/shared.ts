import { tasksToCsv } from "./taskCsv";
import {
  defaultCalendar,
  type Dependency,
  type Person,
  type Priority,
  type Project,
  type Result,
  type Skill,
  type Task,
} from "./types";

export const copy = <T,>(value: T): T => structuredClone(value);

export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

const AVATAR_COLORS = ["ink", "orange", "green", "blue", "lilac"];

export function getAvatarClass(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash);
  const color = AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
  return `avatar-${color}`;
}

export function calculateSkillMatch(task: Task, person: Person): number {
  if (!task.required_skills || task.required_skills.length === 0) return 100;
  if (!person.skills || person.skills.length === 0) return 0;
  const personSkillNames = new Set(person.skills.map((s) => s.name.toLowerCase()));
  let matchCount = 0;
  for (const reqSkill of task.required_skills) {
    if (personSkillNames.has(reqSkill.toLowerCase())) {
      matchCount++;
    }
  }
  return Math.round((matchCount / task.required_skills.length) * 100);
}

export function exportTasksToCsv(project: Project) {
  const url = URL.createObjectURL(new Blob([tasksToCsv(project.tasks)], {type: "text/csv;charset=utf-8"}));
  const link = document.createElement("a"); link.href = url; link.download = `${project.name}_tasks.csv`;
  document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url);
}

export function exportProjectToJson(project: Project) {
  const jsonContent = JSON.stringify(project, null, 2);
  const blob = new Blob([jsonContent], { type: "application/json;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${project.name.replace(/\s+/g, "_")}_critix_export.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function parseJsonToProject(jsonStr: string): Project {
  if (typeof jsonStr !== "string" || !jsonStr.trim()) {
    throw new Error("Файл пуст или содержит некорректный текст");
  }
  if (jsonStr.length > 5 * 1024 * 1024) {
    throw new Error("Размер JSON превышает допустимый лимит 5 МБ");
  }

  let obj: any;
  try {
    obj = JSON.parse(jsonStr);
  } catch {
    throw new Error("Некорректный синтаксис JSON");
  }

  if (!obj || typeof obj !== "object" || Array.isArray(obj)) {
    throw new Error("Корневой элемент JSON должен быть объектом проекта");
  }

  if (typeof obj.name !== "string" || !obj.name.trim()) {
    throw new Error("В проекте отсутствует или пустое название (name)");
  }

  const timezone = typeof obj.timezone === "string" && obj.timezone.trim() ? obj.timezone.trim() : "Asia/Yekaterinburg";
  try {
    Intl.DateTimeFormat(undefined, { timeZone: timezone });
  } catch {
    throw new Error(`Недопустимый часовой пояс: «${timezone}»`);
  }

  if (!obj.start || typeof obj.start !== "string" || isNaN(new Date(obj.start).getTime())) {
    throw new Error("В проекте отсутствует или некорректна дата начала (start)");
  }
  if (!obj.deadline || typeof obj.deadline !== "string" || isNaN(new Date(obj.deadline).getTime())) {
    throw new Error("В проекте отсутствует или некорректна дата дедлайна (deadline)");
  }
  if (new Date(obj.start).getTime() >= new Date(obj.deadline).getTime()) {
    throw new Error("Дата старта проекта должна быть строго раньше дедлайна");
  }

  const rawTasks = Array.isArray(obj.tasks) ? obj.tasks : [];
  if (rawTasks.length > 200) {
    throw new Error("Превышен лимит количества задач (максимум 200)");
  }

  const taskIds = new Set<string>();
  const validTasks: Task[] = [];
  for (let i = 0; i < rawTasks.length; i++) {
    const t = rawTasks[i];
    if (!t || typeof t !== "object" || Array.isArray(t)) {
      throw new Error(`Задача #${i + 1} содержит недопустимое значение (null или не объект)`);
    }
    const id = typeof t.id === "string" ? t.id.trim() : String(t.id || "").trim();
    if (!id) {
      throw new Error(`Задача #${i + 1} не содержит обязательного поля id`);
    }
    if (taskIds.has(id)) {
      throw new Error(`Дубликат идентификатора задачи: «${id}»`);
    }
    taskIds.add(id);

    const name = typeof t.name === "string" && t.name.trim() ? t.name.trim() : `Задача ${id}`;
    const dur = Number.isInteger(t.duration_minutes) && t.duration_minutes >= 0 ? t.duration_minutes : 0;
    const status = ["todo", "in_progress", "done", "blocked"].includes(t.status) ? t.status : "todo";
    const priority = ["low", "medium", "high", "urgent"].includes(t.priority) ? t.priority : "medium";
    const alloc = Number.isInteger(t.allocation_percent) && t.allocation_percent >= 1 && t.allocation_percent <= 100 ? t.allocation_percent : 100;

    validTasks.push({
      id,
      name,
      duration_minutes: dur,
      priority,
      status,
      allocation_percent: alloc,
      required_skills: Array.isArray(t.required_skills) ? t.required_skills.filter((s: any) => typeof s === "string") : [],
      assignee_id: typeof t.assignee_id === "string" && t.assignee_id.trim() ? t.assignee_id.trim() : null,
      not_before: typeof t.not_before === "string" ? t.not_before : null,
      actual_start: typeof t.actual_start === "string" ? t.actual_start : null,
      actual_finish: typeof t.actual_finish === "string" ? t.actual_finish : null,
    });
  }

  const rawDeps = Array.isArray(obj.dependencies) ? obj.dependencies : [];
  if (rawDeps.length > 2000) {
    throw new Error("Превышен лимит количества связей (максимум 2000)");
  }

  const validDeps: Dependency[] = [];
  for (let i = 0; i < rawDeps.length; i++) {
    const d = rawDeps[i];
    if (!d || typeof d !== "object" || Array.isArray(d)) {
      throw new Error(`Связь #${i + 1} содержит недопустимое значение (null или не объект)`);
    }
    const predId = typeof d.predecessor_id === "string" ? d.predecessor_id.trim() : typeof d.from_task_id === "string" ? d.from_task_id.trim() : "";
    const succId = typeof d.successor_id === "string" ? d.successor_id.trim() : typeof d.to_task_id === "string" ? d.to_task_id.trim() : "";
    if (!predId || !succId) {
      throw new Error(`Связь #${i + 1} не содержит идентификаторов предшественника или последователя`);
    }
    if (predId === succId) {
      throw new Error(`Связь #${i + 1}: задача «${predId}» не может ссылаться сама на себя`);
    }
    if (!taskIds.has(predId) || !taskIds.has(succId)) {
      throw new Error(`Связь #${i + 1} ссылается на несуществующую задачу: ${predId} -> ${succId}`);
    }
    const kind = ["FS", "SS", "FF", "SF"].includes(d.kind || d.type) ? (d.kind || d.type) : "FS";
    const lag = Number.isInteger(d.lag_minutes) ? d.lag_minutes : 0;
    const lagMode = ["working", "elapsed"].includes(d.lag_mode) ? d.lag_mode : "working";

    validDeps.push({
      predecessor_id: predId,
      successor_id: succId,
      kind,
      lag_minutes: lag,
      lag_mode: lagMode,
    });
  }

  const rawAssignees = Array.isArray(obj.assignees) ? obj.assignees : [];
  if (rawAssignees.length > 100) {
    throw new Error("Превышен лимит количества участников (максимум 100)");
  }
  const validAssignees: Person[] = [];
  const assigneeIds = new Set<string>();
  for (let i = 0; i < rawAssignees.length; i++) {
    const a = rawAssignees[i];
    if (!a || typeof a !== "object" || Array.isArray(a)) continue;
    const id = typeof a.id === "string" ? a.id.trim() : String(a.id || "").trim();
    if (!id || assigneeIds.has(id)) continue;
    assigneeIds.add(id);

    const role = typeof a.role === "string" && a.role.trim() ? a.role.trim() : undefined;
    const skills: Skill[] = Array.isArray(a.skills)
      ? a.skills
          .map((s: any) => {
            if (typeof s === "string" && s.trim()) {
              return { name: s.trim(), level: "intermediate" as const };
            }
            if (s && typeof s === "object" && typeof s.name === "string" && s.name.trim()) {
              const level = ["beginner", "intermediate", "advanced", "expert"].includes(s.level)
                ? s.level
                : ("intermediate" as const);
              return { name: s.name.trim(), level };
            }
            return null;
          })
          .filter(Boolean) as Skill[]
      : [];

    validAssignees.push({
      id,
      name: typeof a.name === "string" && a.name.trim() ? a.name.trim() : `Сотрудник ${id}`,
      role,
      skills,
      calendar: a.calendar || defaultCalendar(),
    });
  }

  return {
    name: obj.name.trim(),
    timezone,
    start: obj.start,
    deadline: obj.deadline,
    calendar: obj.calendar || defaultCalendar(),
    baseline: obj.baseline || null,
    assignees: validAssignees,
    tasks: validTasks,
    dependencies: validDeps,
  };
}

export const statusLabels: Record<string, string> = {
  todo: "Запланировано",
  in_progress: "В работе",
  done: "Завершено",
  blocked: "Заблокировано",
};

export const statusColors: Record<string, string> = {
  todo: "gray",
  in_progress: "blue",
  done: "teal",
  blocked: "red",
};

export const priorityLabels: Record<Priority, string> = {
  low: "Низкий",
  medium: "Средний",
  high: "Высокий",
  urgent: "Срочный",
};

export const priorityColors: Record<Priority, string> = {
  low: "gray",
  medium: "blue",
  high: "orange",
  urgent: "red",
};

export const skillLevelLabels: Record<Skill["level"], string> = {
  beginner: "Начинающий",
  intermediate: "Средний",
  advanced: "Продвинутый",
  expert: "Эксперт",
};

export const TIMEZONE_OPTIONS = [
  { value: "Asia/Yekaterinburg", label: "Екатеринбург, Тюмень, Пермь (UTC+5)" },
  { value: "Europe/Moscow", label: "Москва, Санкт-Петербург (UTC+3)" },
  { value: "Asia/Novosibirsk", label: "Новосибирск (UTC+7)" },
  { value: "Asia/Krasnoyarsk", label: "Красноярск (UTC+7)" },
  { value: "Asia/Irkutsk", label: "Иркутск (UTC+8)" },
  { value: "Asia/Vladivostok", label: "Владивосток (UTC+10)" },
  { value: "Europe/Kaliningrad", label: "Калининград (UTC+2)" },
  { value: "Europe/London", label: "Лондон (UTC+0)" },
  { value: "Europe/Berlin", label: "Берлин, Париж (UTC+1)" },
  { value: "America/New_York", label: "Нью-Йорк (UTC-5)" },
];

export function getZone(draft: Project | null, saved: Result | null): string {
  return draft?.timezone || saved?.project.timezone || "UTC";
}

export function formatDateTime(iso: string, zone: string): string {
  return new Date(iso).toLocaleString("ru-RU", { timeZone: zone, day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function formatShortDate(iso: string, zone: string): string {
  return new Date(iso).toLocaleDateString("ru-RU", { timeZone: zone, day: "numeric", month: "short" });
}

export function getOverdueTasks(view: Result | null) {
  return (view?.analysis.tasks || []).filter((r) => r.risk_flags.includes("overdue"));
}

export function getOverloadedAssigneeIds(view: Result | null): Set<string> {
  return new Set(view?.analysis.overloads.map((o) => o.assignee_id) || []);
}

/**
 * Форматирует рабочие трудозатраты (длительность задачи, резерв) в рабочих часах.
 * 8 рабочих часов = 1 рабочий день.
 * Признак вехи определяется строго по задаче (isMilestone).
 */
export function formatWorkDuration(minutes: number, isMilestone = false): string {
  if (isMilestone) return "0 ч (веха)";
  if (minutes === 0) return "0 ч";
  const abs = Math.abs(minutes);
  const hours = abs / 60;
  if (Number.isInteger(hours)) {
    if (hours % 8 === 0 && hours >= 8) {
      const days = hours / 8;
      return `${hours} ч (${days} раб. дн.)`;
    }
    return `${hours} ч`;
  }
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return h > 0 ? `${h} ч ${m} мин` : `${m} мин`;
}

/**
 * Форматирует календарный интервал (сдвиг дедлайна, разницу дат) в календарных днях и часах.
 * 24 часа = 1 календарный день (1440 минут).
 * 48 календарных часов = ровно 2 календарных дня.
 */
export function formatCalendarDuration(minutes: number): string {
  const abs = Math.abs(minutes);
  if (abs === 0) return "0 ч";
  const days = Math.floor(abs / 1440);
  const remMinutes = abs % 1440;
  const hours = Math.floor(remMinutes / 60);
  const m = remMinutes % 60;

  const parts: string[] = [];
  if (days > 0) parts.push(`${days} дн.`);
  if (hours > 0) parts.push(`${hours} ч`);
  if (m > 0) parts.push(`${m} мин`);

  return parts.join(" ") || "0 мин";
}

/**
 * Форматирует календарный сдвиг со знаком («позже на…» / «раньше на…»).
 * Для нулевой разницы возвращает «Срок не изменился».
 */
export function formatCalendarShift(minutes: number | null | undefined): string {
  if (minutes == null) return "Срок не задан";
  if (minutes === 0) return "Срок не изменился";
  if (minutes > 0) return `позже на ${formatCalendarDuration(minutes)}`;
  return `раньше на ${formatCalendarDuration(Math.abs(minutes))}`;
}

export function formatCalendarDelta(minutes: number | null | undefined): { text: string; status: "advance" | "delay" | "ontime" | "none" } {
  if (minutes == null) return { text: "Базовый план не зафиксирован", status: "none" };
  if (minutes === 0) return { text: "Срок не изменился", status: "ontime" };
  if (minutes < 0) {
    return { text: `Опережение: раньше на ${formatCalendarDuration(Math.abs(minutes))}`, status: "advance" };
  }
  return { text: `Задержка: позже на ${formatCalendarDuration(minutes)}`, status: "delay" };
}

// Обратная совместимость для существующего кода
export function formatMinutes(minutes: number): string {
  return formatWorkDuration(minutes, false);
}

export const formatDeltaText = formatCalendarDelta;

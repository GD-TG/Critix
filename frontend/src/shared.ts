import { tasksToCsv } from "./taskCsv";
import {
  defaultCalendar,
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
  const obj = JSON.parse(jsonStr);
  if (!obj || typeof obj !== "object") {
    throw new Error("Некорректный JSON-файл");
  }
  if (!obj.name || typeof obj.name !== "string") {
    throw new Error("В проекте отсутствует название (name)");
  }
  if (!obj.start || !obj.deadline) {
    throw new Error("В проекте отсутствуют даты start или deadline");
  }
  return {
    name: obj.name,
    timezone: obj.timezone || "Asia/Yekaterinburg",
    start: obj.start,
    deadline: obj.deadline,
    calendar: obj.calendar || defaultCalendar(),
    baseline: obj.baseline || null,
    assignees: Array.isArray(obj.assignees) ? obj.assignees : [],
    tasks: Array.isArray(obj.tasks) ? obj.tasks : [],
    dependencies: Array.isArray(obj.dependencies) ? obj.dependencies : [],
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

export function formatMinutes(minutes: number): string {
  if (minutes === 0) return "0 ч (веха)";
  const abs = Math.abs(minutes);
  const hours = abs / 60;
  if (Number.isInteger(hours)) {
    if (hours % 8 === 0 && hours >= 8) {
      const days = hours / 8;
      return `${days} дн (${hours} ч)`;
    }
    return `${hours} ч`;
  }
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return h > 0 ? `${h} ч ${m} мин` : `${m} мин`;
}

export function formatDeltaText(minutes: number | null | undefined): { text: string; status: "advance" | "delay" | "ontime" | "none" } {
  if (minutes == null) return { text: "Базовый план не зафиксирован", status: "none" };
  if (minutes === 0) return { text: "Точно в графике эталона", status: "ontime" };
  if (minutes < 0) {
    return { text: `Опережение: раньше на ${formatMinutes(Math.abs(minutes))}`, status: "advance" };
  }
  return { text: `Задержка: позже на ${formatMinutes(minutes)}`, status: "delay" };
}

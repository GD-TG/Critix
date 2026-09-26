export type Calendar = {
  week: Record<string, { start: string; end: string }[]>;
  exceptions: Record<string, { start: string; end: string }[]>;
};
export type Skill = {
  name: string;
  level: "beginner" | "intermediate" | "advanced" | "expert";
};
export type Person = {
  id: string;
  name: string;
  role?: string;
  skills?: Skill[];
  calendar: Calendar;
};
export type Priority = "low" | "medium" | "high" | "urgent";
export type Task = {
  id: string;
  name: string;
  duration_minutes: number;
  priority?: Priority;
  required_skills?: string[];
  not_before: string | null;
  assignee_id: string | null;
  allocation_percent: number;
  status: "todo" | "in_progress" | "done" | "blocked";
  actual_start: string | null;
  actual_finish: string | null;
};
export type Dependency = {
  predecessor_id: string;
  successor_id: string;
  kind: "FS" | "SS" | "FF" | "SF";
  lag_minutes: number;
  lag_mode: "working" | "elapsed";
};
export type Project = {
  name: string;
  timezone: string;
  start: string;
  deadline: string;
  baseline?: {
    saved_at: string;
    finish: string;
    tasks: Record<string, { start: string; finish: string }>;
  } | null;
  calendar: Calendar;
  assignees: Person[];
  tasks: Task[];
  dependencies: Dependency[];
};
export type Analysis = {
  critical_dependencies: Dependency[];
  as_of?: string;
  baseline_delta_minutes?: number | null;
  finish: string;
  deadline_exceeded: boolean;
  delay_minutes: number;
  tasks: {
    id: string;
    start: string;
    finish: string;
    latest_start: string;
    slack_minutes: number | null;
    critical: boolean;
    risk_flags: string[];
  }[];
  overloads: {
    assignee_id: string;
    start: string;
    finish: string;
    allocation_percent: number;
    task_ids: string[];
  }[];
};
export type Result = {
  id: string;
  version: number;
  project: Project;
  analysis: Analysis;
  changes?: {
    changed_task_ids: string[];
    removed_task_ids: string[];
    finish_delta_minutes: number;
  };
};
export const defaultCalendar = (): Calendar => ({
  week: Object.fromEntries(
    [0, 1, 2, 3, 4].map((d) => [
      String(d),
      [
        { start: "09:00", end: "13:00" },
        { start: "14:00", end: "18:00" },
      ],
    ]),
  ),
  exceptions: {},
});
export const defaultTask = (): Task => ({
  id: crypto.randomUUID(),
  name: "",
  duration_minutes: 480,
  priority: "medium",
  required_skills: [],
  not_before: null,
  assignee_id: null,
  allocation_percent: 100,
  status: "todo",
  actual_start: null,
  actual_finish: null,
});

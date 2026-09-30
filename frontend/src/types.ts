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
  is_stale?: boolean;
  forecast_stale?: boolean;
  stale_task_ids?: string[];
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
    explanation?: {
      mode: "actual" | "calculated";
      actual_finish: string | null;
      duration_minutes: number;
      assignee_id: string | null;
      constraints: {
        source: "project_start" | "not_before" | "dependency";
        target: "start" | "finish";
        bound: string;
        dependency?: Dependency;
        candidate_start?: string;
        driving: boolean;
        violated: boolean;
        calendar_adjusted?: boolean;
      }[];
    };
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
    downstream_task_ids?: string[];
    critical_added_task_ids?: string[];
    critical_removed_task_ids?: string[];
    delay_before_minutes?: number;
    delay_after_minutes?: number;
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

export function safeRandomUuid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    try {
      return crypto.randomUUID();
    } catch {
      // fallback
    }
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export const defaultTask = (): Task => ({
  id: safeRandomUuid(),
  name: "Новая задача",
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

export type Scenario = {
  error?: string;
  id: string;
  project_id: string;
  name: string;
  description?: string | null;
  base_version: number;
  is_stale: boolean;
  created_at: string;
  project: Project;
  analysis?: Analysis;
  changes?: {
    changed_task_ids: string[];
    removed_task_ids: string[];
    finish_delta_minutes: number;
  };
};

export type HistoryEntry = {
  version: number;
  created_at: string;
  finish?: string;
  comment?: string | null;
  task_count: number;
  changed_tasks?: string[];
  change_details?: string[];
  finish_delta_minutes?: number;
};

export type User = {
  id: string;
  email: string;
  name: string;
  created_at: string;
};



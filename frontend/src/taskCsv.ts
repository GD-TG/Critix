import type { Person, Task } from "./types.ts";

const headers = [
  "ID",
  "Название",
  "Приоритет",
  "Длительность (мин)",
  "Исполнитель",
  "Статус",
  "Не раньше",
  "Требуемые навыки",
  "Загрузка (%)",
  "Фактическое начало",
  "Фактическое окончание",
];
const quote = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;

export function tasksToCsv(tasks: Task[]): string {
  return (
    "\uFEFF" +
    [
      headers,
      ...tasks.map((t) => [
        t.id,
        t.name,
        t.priority,
        t.duration_minutes,
        t.assignee_id,
        t.status,
        t.not_before,
        JSON.stringify(t.required_skills),
        t.allocation_percent,
        t.actual_start,
        t.actual_finish,
      ]),
    ]
      .map((row) => row.map(quote).join(";"))
      .join("\r\n")
  );
}

function readRows(text: string): string[][] {
  text = text.replace(/^\uFEFF/, "");
  const delimiter = text.split(/\r?\n/, 1)[0].includes(";") ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [],
    field = "",
    quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') {
        field += '"';
        i++;
      } else quoted = !quoted;
    } else if (!quoted && c === delimiter) {
      row.push(field);
      field = "";
    } else if (!quoted && (c === "\n" || c === "\r")) {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      if (row.some((cell) => cell.trim())) rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (quoted) throw new Error("CSV: незакрытая кавычка");
  row.push(field);
  if (row.some((cell) => cell.trim())) rows.push(row);
  return rows;
}

export function parseCsvToTasks(
  csv: string,
  people: Person[],
  existingIds: string[] = [],
): Task[] {
  const rows = readRows(csv);
  if (!rows.length) throw new Error("CSV пуст");
  if (rows.length > 300) {
    throw new Error("Превышен лимит импорта CSV (максимум 300 задач в одном файле)");
  }
  const heading = rows.shift()!.map((cell) => cell.trim());
  if (
    heading.length < 8 ||
    headers.slice(0, 8).some((h, i) => heading[i] !== h)
  )
    throw new Error(
      "Нужны заголовки из экспорта Critix. Длительность указывается в минутах.",
    );
  const ids = new Set(existingIds);
  const priorities: Record<string, Task["priority"]> = {
    low: "low",
    medium: "medium",
    high: "high",
    urgent: "urgent",
    "Низкий": "low",
    "Средний": "medium",
    "Высокий": "high",
    "Срочный": "urgent",
  };
  const statuses: Record<string, Task["status"]> = {
    todo: "todo",
    in_progress: "in_progress",
    done: "done",
    blocked: "blocked",
    "Запланировано": "todo",
    "В работе": "in_progress",
    "Завершено": "done",
    "Заблокировано": "blocked",
  };
  return rows.map((cells, i) => {
    const fail = (message: string): never => {
      throw new Error(`CSV, запись ${i + 2}: ${message}`);
    };
    const [
      id,
      name,
      priority,
      duration,
      person,
      status,
      notBefore,
      skills,
      allocation = "100",
      actualStart = "",
      actualFinish = "",
    ] = cells;
    if (cells.length !== heading.length)
      fail("число полей не совпадает с заголовками");
    if (!id || ids.has(id)) fail("ID пуст или уже существует");
    ids.add(id);
    if (!name?.trim()) fail("название пусто");
    if (!priorities[priority] || !statuses[status])
      fail("неизвестный приоритет или статус");
    if (
      !duration?.trim() ||
      !Number.isInteger(Number(duration)) ||
      Number(duration) < 0
    )
      fail("длительность должна быть целым числом минут >= 0");
    if (
      !allocation.trim() ||
      !Number.isInteger(Number(allocation)) ||
      Number(allocation) < 1 ||
      Number(allocation) > 100
    )
      fail("загрузка должна быть целым числом от 1 до 100");
    const matches = people.filter((p) => p.name === person);
    const assignee =
      people.find((p) => p.id === person) ||
      (matches.length === 1 ? matches[0] : undefined);
    if (person && !assignee)
      fail("исполнитель отсутствует или имя неоднозначно; укажите ID");
    const date = (value: string): string | null => {
      if (!value) return null;
      const d = new Date(value);
      if (
        !/(Z|[+-]\d{2}:\d{2})$/.test(value) ||
        !Number.isFinite(d.getTime()) ||
        d.getUTCSeconds() ||
        d.getUTCMilliseconds()
      )
        fail("нужна дата с часовым поясом и точностью до минуты");
      return value;
    };
    const start = date(actualStart),
      finish = date(actualFinish);
    const state = statuses[status];
    const durationNum = Number(duration);
    if (
      (state === "done" && (!start || !finish)) ||
      (state === "in_progress" && !start)
    )
      fail("нужны фактические даты, они не подставляются автоматически");
    if (
      (finish && state !== "done") ||
      (start && state === "todo") ||
      (start &&
        finish &&
        (durationNum === 0
          ? new Date(finish) < new Date(start)
          : new Date(finish) <= new Date(start)))
    )
      fail("фактические даты несовместимы со статусом");
    let requiredSkills: string[] = [];
    try {
      requiredSkills = skills?.trim().startsWith("[")
        ? JSON.parse(skills)
        : (skills || "")
            .split(",")
            .map((x) => x.trim())
            .filter(Boolean);
    } catch {
      fail("некорректный список навыков");
    }
    if (
      !Array.isArray(requiredSkills) ||
      requiredSkills.some((s) => typeof s !== "string")
    )
      fail("навыки должны быть списком строк");
    return {
      id,
      name,
      priority: priorities[priority],
      duration_minutes: durationNum,
      assignee_id: assignee?.id || null,
      status: state,
      not_before: date(notBefore),
      required_skills: requiredSkills,
      allocation_percent: Number(allocation),
      actual_start: start,
      actual_finish: finish,
    };
  });
}

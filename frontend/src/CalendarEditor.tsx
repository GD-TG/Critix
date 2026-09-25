import { Button, Group, Select, Stack, Text, TextInput } from "@mantine/core";
import { useState } from "react";
import type { Calendar } from "./types";

export function CalendarEditor({
  value,
  onChange,
}: {
  value: Calendar;
  onChange: (value: Calendar) => void;
}) {
  const [day, setDay] = useState("");
  const days = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
  const shifts = (key: string, exception: boolean) => {
    const source = exception ? value.exceptions : value.week;
    const update = (next: Calendar["week"][string]) =>
      onChange({
        ...value,
        [exception ? "exceptions" : "week"]: { ...source, [key]: next },
      });
    return (
      <Group align="end" key={key}>
        <Text w={exception ? 100 : 25} size="sm">
          {exception ? key : days[Number(key)]}
        </Text>
        {(source[key] || []).map((shift, i) => (
          <Group key={i} gap={5}>
            <TextInput
              aria-label="Начало смены"
              type="time"
              w={105}
              value={shift.start.slice(0, 5)}
              onChange={(e) =>
                update(
                  source[key].map((s, j) =>
                    i === j ? { ...s, start: e.target.value } : s,
                  ),
                )
              }
            />
            <TextInput
              aria-label="Конец смены"
              type="time"
              w={105}
              value={shift.end.slice(0, 5)}
              onChange={(e) =>
                update(
                  source[key].map((s, j) =>
                    i === j ? { ...s, end: e.target.value } : s,
                  ),
                )
              }
            />
            <Button
              variant="subtle"
              color="gray"
              aria-label="Удалить смену"
              onClick={() => update(source[key].filter((_, j) => j !== i))}
            >
              ×
            </Button>
          </Group>
        ))}
        {!(source[key] || []).length && (
          <Text size="sm" c="dimmed">
            Нерабочий день
          </Text>
        )}
        <Button
          size="compact-xs"
          variant="light"
          onClick={() =>
            update([...(source[key] || []), { start: "09:00", end: "18:00" }])
          }
        >
          + смена
        </Button>
        {exception && (
          <Button
            size="compact-xs"
            variant="subtle"
            onClick={() => {
              const next = { ...value.exceptions };
              delete next[key];
              onChange({ ...value, exceptions: next });
            }}
          >
            По расписанию недели
          </Button>
        )}
      </Group>
    );
  };
  return (
    <Stack gap="sm">
      <Text size="sm" c="dimmed">
        Время в часовом поясе проекта. Пустая дата-исключение — отпуск или
        выходной. Праздники задаются вручную.
      </Text>
      {days.map((_, i) => shifts(String(i), false))}
      <Text fw={600} mt="md">
        Исключения и отпуска
      </Text>
      {Object.keys(value.exceptions)
        .sort()
        .map((key) => shifts(key, true))}
      <Group align="end">
        <TextInput
          label="Дата исключения"
          type="date"
          value={day}
          onChange={(e) => setDay(e.target.value)}
        />
        <Button
          variant="light"
          disabled={!day}
          onClick={() => {
            onChange({
              ...value,
              exceptions: { ...value.exceptions, [day]: [] },
            });
            setDay("");
          }}
        >
          Добавить
        </Button>
      </Group>
    </Stack>
  );
}

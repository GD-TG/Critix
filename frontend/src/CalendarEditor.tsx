import React, { useState } from "react";
import {
  ActionIcon,
  Badge,
  Button,
  Card,
  Divider,
  Group,
  SegmentedControl,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
  Tooltip,
} from "@mantine/core";
import { CalendarDays, Clock, Plus, Trash2, Umbrella, Briefcase, RefreshCw } from "lucide-react";
import type { Calendar } from "./types";

interface CalendarEditorProps {
  value: Calendar;
  onChange: (value: Calendar) => void;
  title?: string;
}

const DAYS_OF_WEEK = [
  { index: 0, label: "Понедельник", short: "Пн" },
  { index: 1, label: "Вторник", short: "Вт" },
  { index: 2, label: "Среда", short: "Ср" },
  { index: 3, label: "Четверг", short: "Чт" },
  { index: 4, label: "Пятница", short: "Пт" },
  { index: 5, label: "Суббота", short: "Сб" },
  { index: 6, label: "Воскресенье", short: "Вс" },
];

export function CalendarEditor({ value, onChange, title }: CalendarEditorProps) {
  const [activeTab, setActiveTab] = useState<"week" | "exceptions">("week");

  // Single exception form state
  const [singleDate, setSingleDate] = useState("");
  const [exceptionType, setExceptionType] = useState<"vacation" | "working_full" | "working_short" | "custom">("vacation");
  const [customStart, setCustomStart] = useState("09:00");
  const [customEnd, setCustomEnd] = useState("18:00");

  // Range vacation form state
  const [rangeStart, setRangeStart] = useState("");
  const [rangeEnd, setRangeEnd] = useState("");

  const updateWeekDay = (dayIndex: number, shifts: Array<{ start: string; end: string }>) => {
    onChange({
      ...value,
      week: {
        ...value.week,
        [dayIndex]: shifts,
      },
    });
  };

  const handleAddSingleException = () => {
    if (!singleDate) return;

    let shifts: Array<{ start: string; end: string }> = [];
    if (exceptionType === "working_full") {
      shifts = [
        { start: "09:00", end: "13:00" },
        { start: "14:00", end: "18:00" },
      ];
    } else if (exceptionType === "working_short") {
      shifts = [
        { start: "09:00", end: "13:00" },
        { start: "14:00", end: "17:00" },
      ];
    } else if (exceptionType === "custom") {
      shifts = [{ start: customStart || "09:00", end: customEnd || "18:00" }];
    } // 'vacation' leaves shifts as empty array []

    onChange({
      ...value,
      exceptions: {
        ...value.exceptions,
        [singleDate]: shifts,
      },
    });
    setSingleDate("");
  };

  const handleAddRangeVacation = () => {
    if (!rangeStart || !rangeEnd) return;
    const start = new Date(rangeStart);
    const end = new Date(rangeEnd);
    if (start > end) return;

    const newExceptions = { ...value.exceptions };
    const curr = new Date(start);
    while (curr <= end) {
      const dateKey = curr.toISOString().split("T")[0];
      newExceptions[dateKey] = []; // Empty array = non-working vacation day
      curr.setUTCDate(curr.getUTCDate() + 1);
    }

    onChange({
      ...value,
      exceptions: newExceptions,
    });
    setRangeStart("");
    setRangeEnd("");
  };

  const removeException = (dateKey: string) => {
    const next = { ...value.exceptions };
    delete next[dateKey];
    onChange({ ...value, exceptions: next });
  };

  const sortedExceptions = Object.keys(value.exceptions || {}).sort();

  return (
    <Stack gap="md">
      {title && <Text fw={600} size="sm">{title}</Text>}

      <SegmentedControl
        fullWidth
        size="xs"
        value={activeTab}
        onChange={(v) => setActiveTab(v as "week" | "exceptions")}
        data={[
          { label: "Недельный график смен", value: "week" },
          { label: `Исключения и отпуска (${sortedExceptions.length})`, value: "exceptions" },
        ]}
      />

      {activeTab === "week" && (
        <Stack gap="xs">
          <Text size="xs" c="dimmed">
            Укажите рабочие смены для каждого дня недели. Время задаётся в часовом поясе проекта.
          </Text>

          <Table verticalSpacing="xs" striped highlightOnHover withTableBorder>
            <Table.Thead>
              <Table.Tr>
                <Table.Th style={{ width: 120 }}>День недели</Table.Th>
                <Table.Th>Рабочие смены / Перерывы</Table.Th>
                <Table.Th style={{ width: 100 }}>Действия</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {DAYS_OF_WEEK.map(({ index, label, short }) => {
                const dayShifts = value.week[index] || [];
                const isWorking = dayShifts.length > 0;

                return (
                  <Table.Tr key={index}>
                    <Table.Td>
                      <Group gap="xs">
                        <Badge size="xs" color={isWorking ? "blue" : "gray"}>
                          {short}
                        </Badge>
                        <Text size="xs" fw={500}>
                          {label}
                        </Text>
                      </Group>
                    </Table.Td>

                    <Table.Td>
                      {dayShifts.length === 0 ? (
                        <Text size="xs" c="dimmed">
                          Выходной день
                        </Text>
                      ) : (
                        <Group gap="xs" wrap="wrap">
                          {dayShifts.map((shift, shiftIdx) => (
                            <Group key={shiftIdx} gap={4}>
                              <TextInput
                                size="xs"
                                type="time"
                                w={95}
                                value={shift.start.slice(0, 5)}
                                onChange={(e) =>
                                  updateWeekDay(
                                    index,
                                    dayShifts.map((s, j) =>
                                      shiftIdx === j ? { ...s, start: e.target.value } : s,
                                    ),
                                  )
                                }
                              />
                              <Text size="xs" c="dimmed">
                                –
                              </Text>
                              <TextInput
                                size="xs"
                                type="time"
                                w={95}
                                value={shift.end.slice(0, 5)}
                                onChange={(e) =>
                                  updateWeekDay(
                                    index,
                                    dayShifts.map((s, j) =>
                                      shiftIdx === j ? { ...s, end: e.target.value } : s,
                                    ),
                                  )
                                }
                              />
                              <ActionIcon
                                size="xs"
                                color="red"
                                variant="subtle"
                                onClick={() =>
                                  updateWeekDay(
                                    index,
                                    dayShifts.filter((_, j) => j !== shiftIdx),
                                  )
                                }
                              >
                                ×
                              </ActionIcon>
                            </Group>
                          ))}
                        </Group>
                      )}
                    </Table.Td>

                    <Table.Td>
                      <Group gap={4}>
                        <Button
                          size="compact-xs"
                          variant="light"
                          onClick={() =>
                            updateWeekDay(index, [
                              ...dayShifts,
                              { start: "09:00", end: "18:00" },
                            ])
                          }
                        >
                          + смена
                        </Button>
                        {isWorking && (
                          <Button
                            size="compact-xs"
                            variant="subtle"
                            color="gray"
                            onClick={() => updateWeekDay(index, [])}
                          >
                            Выходной
                          </Button>
                        )}
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                );
              })}
            </Table.Tbody>
          </Table>
        </Stack>
      )}

      {activeTab === "exceptions" && (
        <Stack gap="md">
          {/* Range Vacation Form */}
          <Card withBorder p="sm" style={{ background: "rgba(210, 10, 46, 0.03)" }}>
            <Text size="xs" fw={700} mb="xs" c="blue">
              ПЕРИОД ОТПУСКА / ОТГУЛА (МАССОВОЕ ДОБАВЛЕНИЕ)
            </Text>
            <Group align="flex-end" grow>
              <TextInput
                label="Дата начала отпуска"
                type="date"
                size="xs"
                value={rangeStart}
                onChange={(e) => setRangeStart(e.target.value)}
              />
              <TextInput
                label="Дата окончания отпуска"
                type="date"
                size="xs"
                value={rangeEnd}
                onChange={(e) => setRangeEnd(e.target.value)}
              />
              <Button
                size="xs"
                variant="filled"
                color="blue"
                disabled={!rangeStart || !rangeEnd}
                onClick={handleAddRangeVacation}
              >
                Оформить отпуск на период
              </Button>
            </Group>
          </Card>

          {/* Single Day Exception Form */}
          <Card withBorder p="sm">
            <Text size="xs" fw={700} mb="xs">
              ДОБАВИТЬ ОТДЕЛЬНОЕ ИСКЛЮЧЕНИЕ / ПЕРЕНОС ДНЯ
            </Text>
            <Group align="flex-end" wrap="wrap">
              <TextInput
                label="Дата"
                type="date"
                size="xs"
                w={150}
                value={singleDate}
                onChange={(e) => setSingleDate(e.target.value)}
              />

              <Select
                label="Тип исключения"
                size="xs"
                w={220}
                data={[
                  { value: "vacation", label: "Отпуск / Выходной (без смен)" },
                  { value: "working_full", label: "Рабочий день (09:00-18:00)" },
                  { value: "working_short", label: "Сокращенный день (09:00-17:00)" },
                  { value: "custom", label: "Кастомные часы работы" },
                ]}
                value={exceptionType}
                onChange={(v) => setExceptionType(v as any)}
              />

              {exceptionType === "custom" && (
                <Group gap={4}>
                  <TextInput
                    label="Начало"
                    type="time"
                    size="xs"
                    w={90}
                    value={customStart}
                    onChange={(e) => setCustomStart(e.target.value)}
                  />
                  <TextInput
                    label="Конец"
                    type="time"
                    size="xs"
                    w={90}
                    value={customEnd}
                    onChange={(e) => setCustomEnd(e.target.value)}
                  />
                </Group>
              )}

              <Button
                size="xs"
                variant="light"
                disabled={!singleDate}
                onClick={handleAddSingleException}
              >
                + Добавить дату
              </Button>
            </Group>
          </Card>

          {/* Exceptions List */}
          <div>
            <Group justify="space-between" mb="xs">
              <Text size="xs" fw={600}>
                Зарегистрированные исключения ({sortedExceptions.length}):
              </Text>
              {sortedExceptions.length > 0 && (
                <Button
                  size="compact-xs"
                  color="red"
                  variant="subtle"
                  onClick={() => onChange({ ...value, exceptions: {} })}
                >
                  Очистить все исключения
                </Button>
              )}
            </Group>

            {sortedExceptions.length === 0 ? (
              <Text size="xs" c="dimmed">
                Нет назначенных исключений или отпусков. График рассчитывается строго по расписанию недели.
              </Text>
            ) : (
              <Table verticalSpacing="xs" striped highlightOnHover withTableBorder>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th style={{ width: 140 }}>Дата</Table.Th>
                    <Table.Th>Тип / Смены</Table.Th>
                    <Table.Th style={{ width: 100 }}>Действие</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {sortedExceptions.map((dateKey) => {
                    const shifts = value.exceptions[dateKey] || [];
                    const isVacation = shifts.length === 0;
                    const d = new Date(dateKey);
                    const formattedDate = d.toLocaleDateString("ru-RU", {
                      timeZone: "UTC",
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                      weekday: "short",
                    });

                    return (
                      <Table.Tr key={dateKey}>
                        <Table.Td>
                          <Text size="xs" fw={600}>
                            {formattedDate}
                          </Text>
                          <Text size="10px" c="dimmed">
                            {dateKey}
                          </Text>
                        </Table.Td>

                        <Table.Td>
                          {isVacation ? (
                            <Badge color="red" variant="light" size="sm">
                              Отпуск / Выходной
                            </Badge>
                          ) : (
                            <Group gap="xs" wrap="wrap">
                              <Badge color="teal" variant="light" size="sm">
                                Рабочий день
                              </Badge>
                              {shifts.map((s, idx) => (
                                <Text key={idx} size="xs">
                                  {s.start.slice(0, 5)} – {s.end.slice(0, 5)}
                                </Text>
                              ))}
                            </Group>
                          )}
                        </Table.Td>

                        <Table.Td>
                          <Group gap="xs">
                            <Button
                              size="compact-xs"
                              variant="subtle"
                              color={isVacation ? "teal" : "gray"}
                              onClick={() => {
                                const nextShifts = isVacation
                                  ? [{ start: "09:00", end: "18:00" }]
                                  : [];
                                onChange({
                                  ...value,
                                  exceptions: {
                                    ...value.exceptions,
                                    [dateKey]: nextShifts,
                                  },
                                });
                              }}
                            >
                              {isVacation ? "Сделать рабочим" : "Сделать отпуском"}
                            </Button>
                            <ActionIcon
                              size="xs"
                              color="red"
                              variant="subtle"
                              title="Удалить исключение"
                              onClick={() => removeException(dateKey)}
                            >
                              <Trash2 size={14} />
                            </ActionIcon>
                          </Group>
                        </Table.Td>
                      </Table.Tr>
                    );
                  })}
                </Table.Tbody>
              </Table>
            )}
          </div>
        </Stack>
      )}
    </Stack>
  );
}

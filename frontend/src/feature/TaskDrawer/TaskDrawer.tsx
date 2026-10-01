import {
  ActionIcon,
  Badge,
  Button,
  Card,
  Divider,
  Drawer,
  Group,
  NumberInput,
  Select,
  Stack,
  Switch,
  Text,
  TextInput,
} from "@mantine/core";
import { Trash2 } from "lucide-react";
import { ProjectDateInput } from "@/ProjectDateInput";
import { useTaskDrawer } from "@/feature/TaskDrawer/useTaskDrawer";
import { TaskDateExplanation } from "./TaskDateExplanation";

export function TaskDrawer() {
  const {
    task,
    draft,
    setTask,
    isExisting,
    newTaskSkill,
    setNewTaskSkill,
    taskInlinePredId,
    setTaskInlinePredId,
    taskInlinePredKind,
    setTaskInlinePredKind,
    taskInlinePredLagHours,
    setTaskInlinePredLagHours,
    updateTask,
    setPriority,
    setStatus,
    addRequiredSkill,
    removeRequiredSkill,
    removeIncomingDependency,
    addInlinePredecessor,
    deleteTask,
    saveTask,
    calculateSkillMatch,
    isOptional,
    toggleOptional,
    linkedDeliveries,
  } = useTaskDrawer();

  return (
    <Drawer
      opened={Boolean(task)}
      onClose={() => setTask(null)}
      title={task?.id && draft?.tasks.some((t) => t.id === task.id) ? "Редактирование задачи" : "Новая задача"}
      position="right"
      size="md"
    >
      {task && draft && (
        <Stack gap="md">
          <TaskDateExplanation task={task} onOpen={setTask} />
          <TextInput
            label="Название задачи"
            value={task.name}
            onChange={(e) => updateTask({ name: e.target.value })}
            required
          />

          <Group grow>
            <Select
              label="Приоритет"
              data={[
                { value: "low", label: "Низкий" },
                { value: "medium", label: "Средний" },
                { value: "high", label: "Высокий" },
                { value: "urgent", label: "Срочный" },
              ]}
              value={task.priority || "medium"}
              onChange={setPriority}
            />

            <NumberInput
              label="Длительность (часы)"
              description={task.duration_minutes === 0 ? "0 ч — веха без длительности" : undefined}
              value={task.duration_minutes / 60}
              min={0}
              step={0.5}
              onChange={(val) => updateTask({ duration_minutes: Math.max(0, Math.round(Number(val ?? 0) * 60)) })}
            />
          </Group>

          <Group grow>
            <Select
              label="Исполнитель"
              data={[
                { value: "", label: "Не назначен" },
                ...draft.assignees.map((a) => ({ value: a.id, label: `${a.name} ${a.role ? `(${a.role})` : ""}` })),
              ]}
              value={task.assignee_id || ""}
              onChange={(v) => updateTask({ assignee_id: v || null })}
            />

            <NumberInput
              label="Загрузка сотрудника (%)"
              min={1}
              max={100}
              value={task.allocation_percent || 100}
              onChange={(val) => updateTask({ allocation_percent: Number(val || 100) })}
            />
          </Group>

          {task.assignee_id && (
            <Group gap="xs">
              {(() => {
                const assignedPerson = draft.assignees.find((a) => a.id === task.assignee_id);
                if (!assignedPerson) return null;
                const match = calculateSkillMatch(task, assignedPerson);
                return (
                  <Badge color={match >= 80 ? "teal" : match >= 50 ? "yellow" : "red"} variant="light" size="sm">
                    Соответствие навыкам: {match}%
                  </Badge>
                );
              })()}
            </Group>
          )}

          <Select
            label="Статус задачи"
            data={[
              { value: "todo", label: "Запланировано" },
              { value: "in_progress", label: "В работе" },
              { value: "done", label: "Завершено" },
              { value: "blocked", label: "Заблокировано" },
            ]}
            value={task.status}
            onChange={setStatus}
          />

          <div>
            <Text size="xs" fw={600} mb={4}>Требуемые навыки (компетенции):</Text>
            <Group gap={4} mb={6}>
              {(task.required_skills || []).map((sk, skIdx) => (
                <Badge
                  key={skIdx}
                  size="sm"
                  variant="light"
                  color="indigo"
                  rightSection={
                    <ActionIcon
                      size="xs"
                      color="blue"
                      radius="xl"
                      variant="transparent"
                      onClick={() => removeRequiredSkill(skIdx)}
                    >
                      ✕
                    </ActionIcon>
                  }
                >
                  {sk}
                </Badge>
              ))}
            </Group>
            <Group gap="xs">
              <TextInput
                placeholder="Добавить навык (React, SQL, Figma...)"
                size="xs"
                value={newTaskSkill}
                onChange={(e) => setNewTaskSkill(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newTaskSkill.trim()) {
                    e.preventDefault();
                    addRequiredSkill();
                  }
                }}
              />
              <Button
                size="xs"
                variant="light"
                disabled={!newTaskSkill.trim()}
                onClick={addRequiredSkill}
              >
                + Добавить
              </Button>
            </Group>
          </div>

          <Divider my="xs" />

          <ProjectDateInput
            label="Начать не раньше чем (not_before)"
            zone={draft.timezone}
            value={task.not_before}
            onChange={(val) => updateTask({ not_before: val })}
          />

          {task.status === "done" && (
            <Card withBorder p="xs" style={{ background: "rgba(34, 197, 94, 0.04)", borderColor: "rgba(34, 197, 94, 0.3)" }}>
              <Group justify="space-between" mb={4}>
                <Text size="xs" fw={700} c="teal">
                  Фактические даты выполнения {task.duration_minutes === 0 ? "(Веха)" : ""}
                </Text>
                <Badge size="xs" color="teal" variant="light">
                  Завершено
                </Badge>
              </Group>
              <Text size="11px" c="dimmed" mb="xs">
                {task.duration_minutes === 0
                  ? "Для вехи фактическое начало и окончание могут совпадать."
                  : "Плановые даты подставлены по умолчанию. При необходимости скорректируйте их."}
              </Text>
              <Stack gap="xs">
                <ProjectDateInput
                  label="Фактическое начало"
                  zone={draft.timezone}
                  value={task.actual_start}
                  onChange={(val) => updateTask({ actual_start: val })}
                />
                <ProjectDateInput
                  label="Фактическое окончание"
                  zone={draft.timezone}
                  value={task.actual_finish}
                  onChange={(val) => updateTask({ actual_finish: val })}
                />
              </Stack>
            </Card>
          )}

          {(task.status === "in_progress" || task.status === "blocked") && (
            <Stack gap="xs">
              <ProjectDateInput
                label="Фактическое начало"
                zone={draft.timezone}
                value={task.actual_start}
                onChange={(val) => updateTask({ actual_start: val })}
              />
              <NumberInput
                label="Оценка остатка работы (часы)"
                description="Оценка остатка на момент расчёта (as_of). Оставьте пустым для расчета по исходной длительности."
                value={task.remaining_minutes != null ? task.remaining_minutes / 60 : undefined}
                min={0}
                step={0.5}
                onChange={(val) =>
                  updateTask({
                    remaining_minutes: val != null && val !== "" ? Math.round(Number(val) * 60) : null,
                  })
                }
              />
            </Stack>
          )}

          <Divider my="xs" label="Управление составом выпуска (Scope)" labelPosition="center" />

          <Switch
            label="Необязательная работа (Optional Scope)"
            description="Эту задачу можно перенести или исключить из текущего релиза при задержке дедлайна или поставки."
            checked={isOptional}
            onChange={(e) => toggleOptional(e.currentTarget.checked)}
          />

          {linkedDeliveries.length > 0 && (
            <Card withBorder p="xs" radius="sm" style={{ backgroundColor: "rgba(59, 130, 246, 0.05)", borderColor: "rgba(59, 130, 246, 0.3)" }}>
              <Text size="xs" fw={700} c="blue">
                Зависит от поставки подрядчика:
              </Text>
              {linkedDeliveries.map((ld) => (
                <Text key={ld.id} size="xs" c="dimmed">
                  «{ld.name}» ({ld.contractor}) — статус: {ld.status}
                </Text>
              ))}
            </Card>
          )}

          <Divider my="xs" label="Связи и зависимости (Предшественники)" labelPosition="center" />

          {/* List of existing incoming predecessors */}
          {(() => {
            const incomingDeps = (draft.dependencies || []).filter((d) => d.successor_id === task.id);
            return (
              <Stack gap="xs">
                {incomingDeps.length === 0 ? (
                  <Text size="xs" c="dimmed">Нет предшествующих задач (стартует свободно)</Text>
                ) : (
                  <Stack gap={6}>
                    <Text size="xs" fw={600}>Зависит от следующих задач:</Text>
                    {incomingDeps.map((dep, depIdx) => {
                      const predTask = draft.tasks.find((t) => t.id === dep.predecessor_id);
                      return (
                        <Card key={depIdx} withBorder p="xs" radius="sm">
                          <Group justify="space-between">
                            <div>
                              <Group gap={6}>
                                <Badge size="xs" color="indigo">{dep.kind}</Badge>
                                <Text size="xs" fw={600}>«{predTask?.name || dep.predecessor_id}»</Text>
                              </Group>
                              {dep.lag_minutes !== 0 && (
                                <Text size="xs" c="dimmed">
                                  Лаг: {dep.lag_minutes / 60} ч ({dep.lag_mode === "working" ? "раб." : "календ."})
                                </Text>
                              )}
                            </div>
                            <ActionIcon
                              size="xs"
                              color="red"
                              variant="subtle"
                              title="Удалить связь"
                              onClick={() => removeIncomingDependency(dep)}
                            >
                              <Trash2 size={13} />
                            </ActionIcon>
                          </Group>
                        </Card>
                      );
                    })}
                  </Stack>
                )}

                {/* Add predecessor inline */}
                <Card withBorder p="xs" radius="sm" style={{ background: "rgba(210, 10, 46, 0.03)" }}>
                  <Text size="xs" fw={700} mb={6}>+ Привязать задачу-предшественника:</Text>
                  <Stack gap="xs">
                    <Select
                      size="xs"
                      placeholder="Выберите задачу-предшественник"
                      data={draft.tasks
                        .filter((t) => t.id !== task.id && !incomingDeps.some((d) => d.predecessor_id === t.id))
                        .map((t) => ({ value: t.id, label: t.name }))}
                      value={taskInlinePredId}
                      onChange={(v) => setTaskInlinePredId(v || "")}
                    />
                    {taskInlinePredId && (
                      <>
                        <Group grow gap="xs">
                          <Select
                            size="xs"
                            label="Тип"
                            data={[
                              { value: "FS", label: "FS (Окончание → Начало)" },
                              { value: "SS", label: "SS (Начало → Начало)" },
                              { value: "FF", label: "FF (Окончание → Окончание)" },
                              { value: "SF", label: "SF (Начало → Окончание)" },
                            ]}
                            value={taskInlinePredKind}
                            onChange={(v) => setTaskInlinePredKind((v as typeof taskInlinePredKind) || "FS")}
                          />
                          <NumberInput
                            size="xs"
                            label="Лаг (ч)"
                            value={taskInlinePredLagHours}
                            onChange={(v) => setTaskInlinePredLagHours(Number(v || 0))}
                          />
                        </Group>
                        {draft.tasks.some((t) => t.id === task.id) && (
                          <Button
                            size="xs"
                            variant="light"
                            onClick={addInlinePredecessor}
                          >
                            Добавить связь сейчас
                          </Button>
                        )}
                      </>
                    )}
                  </Stack>
                </Card>
              </Stack>
            );
          })()}

          <Group justify="space-between" mt="md">
            {isExisting && (
              <Button
                color="red"
                variant="subtle"
                onClick={deleteTask}
              >
                Удалить задачу
              </Button>
            )}

            <Button onClick={saveTask}>
              Сохранить задачу
            </Button>
          </Group>
        </Stack>
      )}
    </Drawer>
  );
}

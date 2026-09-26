import {
  ActionIcon,
  Badge,
  Button,
  Card,
  Divider,
  Group,
  ScrollArea,
  Select,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { Plus, Trash2, Users } from "lucide-react";
import { CalendarEditor } from "@/CalendarEditor";
import { useTeamView } from "@/feature/TeamView/useTeamView";

export function TeamView() {
  const {
    draft,
    rows,
    overloadedAssigneeIds,
    selectedAssigneeId,
    setSelectedAssigneeId,
    teamMemberSearch,
    setTeamMemberSearch,
    inlineNewSkillName,
    setInlineNewSkillName,
    inlineNewSkillLevel,
    setInlineNewSkillLevel,
    activeView,
    setActiveView,
    addPerson,
    createFirstPerson,
    removePerson,
    updatePerson,
    removeSkill,
    addSkill,
    updateCalendar,
    getAvatarClass,
    getInitials,
    calculateSkillMatch,
    skillLevelLabels,
    shortDate,
    typeSkillLevel,
  } = useTeamView();

  if (activeView !== "team" || !draft) return null;

  return (
    <Card withBorder p="md" radius="md">
      <Group justify="space-between" mb="md">
        <div>
          <Title order={3}>Управление командой и ресурсами</Title>
          <Text size="sm" c="dimmed">
            Матрица компетенций, персональные рабочие графики, отпуска и загрузка сотрудников.
          </Text>
        </div>
        <Group gap="xs">
          <Button
            size="xs"
            leftSection={<Plus size={14} />}
            onClick={addPerson}
          >
            + Добавить сотрудника
          </Button>
          <Button size="xs" variant="light" onClick={() => setActiveView("dashboard")}>
            ← На Главную
          </Button>
        </Group>
      </Group>

      {draft.assignees.length === 0 ? (
        <Card withBorder p="xl" style={{ textAlign: "center" }}>
          <Users size={32} color="var(--muted)" style={{ margin: "0 auto 8px" }} />
          <Text fw={600}>В проекте пока нет сотрудников</Text>
          <Text size="xs" c="dimmed" mb="md">Добавьте участников для распределения задач и учета рабочих календарей.</Text>
          <Button
            size="xs"
            onClick={createFirstPerson}
          >
            Создать первого участника
          </Button>
        </Card>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 20, minHeight: 600 }}>
          {/* Left Column: Team Members List */}
          <div style={{ borderRight: "1px solid var(--line, #e2e8f0)", paddingRight: 16 }}>
            <TextInput
              placeholder="Поиск по имени или роли..."
              size="xs"
              mb="sm"
              value={teamMemberSearch}
              onChange={(e) => setTeamMemberSearch(e.target.value)}
            />

            <ScrollArea h={560}>
              <Stack gap={8}>
                {draft.assignees
                  .filter((p) =>
                    !teamMemberSearch ||
                    p.name.toLowerCase().includes(teamMemberSearch.toLowerCase()) ||
                    (p.role && p.role.toLowerCase().includes(teamMemberSearch.toLowerCase()))
                  )
                  .map((p) => {
                    const isSelected = (selectedAssigneeId || draft.assignees[0]?.id) === p.id;
                    const isOverloaded = overloadedAssigneeIds.has(p.id);
                    const assignedTasks = (draft.tasks || []).filter((t) => t.assignee_id === p.id);
                    const excCount = Object.keys(p.calendar?.exceptions || {}).length;

                    return (
                      <Card
                        key={p.id}
                        withBorder
                        p="xs"
                        radius="sm"
                        onClick={() => setSelectedAssigneeId(p.id)}
                        style={{
                          cursor: "pointer",
                          borderColor: isSelected ? "var(--purple, #5a75e9)" : undefined,
                          background: isSelected
                            ? "rgba(90, 117, 233, 0.08)"
                            : isOverloaded
                            ? "rgba(238, 149, 100, 0.05)"
                            : undefined,
                        }}
                      >
                        <Group justify="space-between" align="flex-start">
                          <Group gap={8} style={{ minWidth: 0, flex: 1 }}>
                            <span className={`avatar ${getAvatarClass(p.id)}`} style={{ width: 28, height: 28, fontSize: 10 }}>
                              {getInitials(p.name)}
                            </span>
                            <div style={{ minWidth: 0, flex: 1 }}>
                              <Text size="sm" fw={isSelected ? 700 : 600} lineClamp={1}>
                                {p.name}
                              </Text>
                              <Text size="11px" c="dimmed" lineClamp={1}>
                                {p.role || "Роль не указана"}
                              </Text>
                            </div>
                          </Group>
                        </Group>

                        <Group gap={4} mt={6} justify="space-between">
                          <Badge size="xs" color={isOverloaded ? "red" : "gray"} variant={isOverloaded ? "filled" : "light"}>
                            {isOverloaded ? "Перегрузка" : `${assignedTasks.length} задач`}
                          </Badge>
                          {excCount > 0 && (
                            <Badge size="xs" color="orange" variant="outline">
                              {excCount} отпусков
                            </Badge>
                          )}
                          <Text size="10px" c="dimmed">
                            {(p.skills || []).length} навыков
                          </Text>
                        </Group>
                      </Card>
                    );
                  })}
              </Stack>
            </ScrollArea>
          </div>

          {/* Right Column: Selected Member Detailed Workspace */}
          <div>
            {(() => {
              const activePerson = draft.assignees.find((p) => p.id === (selectedAssigneeId || draft.assignees[0]?.id));
              if (!activePerson) {
                return (
                  <Card withBorder p="xl" style={{ textAlign: "center" }}>
                    <Text c="dimmed">Выберите сотрудника из списка слева</Text>
                  </Card>
                );
              }

              const assignedTasks = (draft.tasks || []).filter((t) => t.assignee_id === activePerson.id);
              const isOverloaded = overloadedAssigneeIds.has(activePerson.id);

              return (
                <Stack gap="md">
                  {/* Header Card */}
                  <Card withBorder p="md" radius="sm">
                    <Group justify="space-between" align="flex-start">
                      <Group gap="md">
                        <span className={`avatar ${getAvatarClass(activePerson.id)}`} style={{ width: 44, height: 44, fontSize: 16 }}>
                          {getInitials(activePerson.name)}
                        </span>
                        <div>
                          <Group gap="xs">
                            <Text fw={700} size="lg">{activePerson.name}</Text>
                            {isOverloaded && <Badge color="red">Перегрузка {">"}100%</Badge>}
                          </Group>
                          <Text size="xs" c="dimmed">ID: {activePerson.id}</Text>
                        </div>
                      </Group>

                      <Button
                        color="red"
                        variant="subtle"
                        size="xs"
                        leftSection={<Trash2 size={13} />}
                        onClick={() => removePerson(activePerson)}
                      >
                        Удалить сотрудника
                      </Button>
                    </Group>

                    <Divider my="sm" />

                    <Group grow>
                      <TextInput
                        label="Имя и фамилия"
                        value={activePerson.name}
                        onChange={(e) => updatePerson(activePerson.id, { name: e.target.value })}
                      />
                      <TextInput
                        label="Должность / Роль"
                        placeholder="Например: Lead Backend · Python"
                        value={activePerson.role || ""}
                        onChange={(e) => updatePerson(activePerson.id, { role: e.target.value })}
                      />
                    </Group>
                  </Card>

                  {/* Skills & Tasks Grid */}
                  <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
                    {/* Skills Card */}
                    <Card withBorder p="md" radius="sm">
                      <Text fw={700} size="sm" mb="xs">Матрица навыков и компетенций</Text>
                      
                      <Group gap={6} mb="sm">
                        {(activePerson.skills || []).map((sk, skIdx) => (
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
                                onClick={() => removeSkill(activePerson.id, skIdx)}
                              >
                                ✕
                              </ActionIcon>
                            }
                          >
                            {sk.name} ({skillLevelLabels[sk.level]})
                          </Badge>
                        ))}
                        {(!activePerson.skills || activePerson.skills.length === 0) && (
                          <Text size="xs" c="dimmed">Компетенции еще не добавлены</Text>
                        )}
                      </Group>

                      <Divider my="xs" />

                      <Group gap="xs" align="flex-end">
                        <TextInput
                          label="Новый навык"
                          placeholder="React, SQL, Docker..."
                          size="xs"
                          style={{ flex: 1 }}
                          value={inlineNewSkillName}
                          onChange={(e) => setInlineNewSkillName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && inlineNewSkillName.trim()) {
                              e.preventDefault();
                              addSkill(activePerson.id);
                            }
                          }}
                        />
                        <Select
                          label="Грейд"
                          size="xs"
                          w={130}
                          data={[
                            { value: "beginner", label: "Начинающий" },
                            { value: "intermediate", label: "Средний" },
                            { value: "advanced", label: "Продвинутый" },
                            { value: "expert", label: "Эксперт" },
                          ]}
                          value={inlineNewSkillLevel}
                          onChange={(v) => setInlineNewSkillLevel(typeSkillLevel(v))}
                        />
                        <Button
                          size="xs"
                          disabled={!inlineNewSkillName.trim()}
                          onClick={() => addSkill(activePerson.id)}
                        >
                          + Добавить
                        </Button>
                      </Group>
                    </Card>

                    {/* Assigned Tasks Card */}
                    <Card withBorder p="md" radius="sm">
                      <Group justify="space-between" mb="xs">
                        <Text fw={700} size="sm">Назначенные задачи ({assignedTasks.length})</Text>
                        {isOverloaded && (
                          <Badge size="xs" color="red">
                            Перегрузка по графику
                          </Badge>
                        )}
                      </Group>

                      {assignedTasks.length === 0 ? (
                        <Text size="xs" c="dimmed">Нет назначенных задач в проекте</Text>
                      ) : (
                        <ScrollArea h={140}>
                          <Stack gap={6}>
                            {assignedTasks.map((t) => {
                              const r = rows.get(t.id);
                              const match = calculateSkillMatch(t, activePerson);
                              return (
                                <Card key={t.id} withBorder p="xs" radius="xs" style={{ background: "rgba(0,0,0,0.01)" }}>
                                  <Group justify="space-between">
                                    <div style={{ minWidth: 0, flex: 1 }}>
                                      <Text size="xs" fw={600} lineClamp={1}>«{t.name}»</Text>
                                      <Text size="10px" c="dimmed">
                                        {t.duration_minutes / 60} ч. · {t.allocation_percent || 100}% занятость {r ? `· с ${shortDate(r.start)} по ${shortDate(r.finish)}` : ""}
                                      </Text>
                                    </div>
                                    <Badge size="xs" color={match >= 80 ? "teal" : match >= 50 ? "yellow" : "red"} variant="light">
                                      Match {match}%
                                    </Badge>
                                  </Group>
                                </Card>
                              );
                            })}
                          </Stack>
                        </ScrollArea>
                      )}
                    </Card>
                  </SimpleGrid>

                  {/* Calendar & Vacation Range Editor */}
                  <Card withBorder p="md" radius="sm">
                    <Text fw={700} size="sm" mb="xs">Персональный рабочий календарь и отпуска</Text>
                    <Text size="xs" c="dimmed" mb="md">
                      Настройте индивидуальные смены, обеденные перерывы или добавьте отпуск диапазоном дат.
                    </Text>
                    <CalendarEditor
                      value={activePerson.calendar}
                      onChange={(calendar) => updateCalendar(activePerson.id, calendar)}
                    />
                  </Card>
                </Stack>
              );
            })()}
          </div>
        </div>
      )}
    </Card>
  );
}
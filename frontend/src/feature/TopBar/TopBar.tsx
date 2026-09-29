import {
  Badge,
  Button,
  Card,
  Divider,
  Group,
  Popover,
  ScrollArea,
  Stack,
  Text,
} from "@mantine/core";
import {
  AlertTriangle,
  Bell,
  Check,
  ChevronDown,
  CircleHelp,
  FileText,
  LogOut,
  Sparkles,
  User as UserIcon,
} from "lucide-react";
import { useTopBar } from "./useTopBar";

export function TopBar() {
  const {
    user,
    logout,
    draft,
    view,
    overdueTasks,
    overloadedAssigneeIds,
    shortDate,
    formatMinutes,
    formatCalendarDuration,
    rescheduleOverdue,
    setTask,
    copy,
    setActiveView,
    setExecutiveReportModal,
    setHelpModal,
    setProjectManageModal,
  } = useTopBar();

  return (
    <header className="topbar">
      <div className="breadcrumbs">
        <button
          type="button"
          className="breadcrumb-btn"
          onClick={() => setProjectManageModal(true)}
          title="Переключить проект"
        >
          <span>Проекты</span>
          <ChevronDown size={13} />
        </button>
        <span>/</span>
        <button
          type="button"
          className="breadcrumb-current"
          onClick={() => setProjectManageModal(true)}
          title="Настройки проекта"
        >
          <strong>{draft?.name || "Выбор проекта"}</strong>
        </button>
      </div>
      <div className="top-actions">
        {/* Notification Center Popover */}
        <Popover width={360} position="bottom-end" withArrow shadow="md">
          <Popover.Target>
            <button className="icon-button" aria-label="Уведомления">
              <Bell size={17} />
              {(overdueTasks.length > 0 || overloadedAssigneeIds.size > 0 || view?.analysis.deadline_exceeded) && (
                <i />
              )}
            </button>
          </Popover.Target>
          <Popover.Dropdown p="sm">
            <Stack gap="xs">
              <Group justify="space-between" align="center">
                <Group gap={6}>
                  <Text fw={700} size="sm">Центр рисков и инцидентов</Text>
                  <Badge size="xs" color={overdueTasks.length > 0 || view?.analysis.deadline_exceeded ? "red" : "blue"}>
                    {overdueTasks.length + overloadedAssigneeIds.size + (view?.analysis.deadline_exceeded ? 1 : 0)}
                  </Badge>
                </Group>
                {overdueTasks.length > 0 && (
                  <Button size="compact-xs" variant="subtle" color="red" onClick={rescheduleOverdue}>
                    Сдвинуть все
                  </Button>
                )}
              </Group>

              <Divider />

              <ScrollArea.Autosize mah={280} type="auto">
                <Stack gap="xs">
                  {view?.analysis.deadline_exceeded && (
                    <Card withBorder p="xs" style={{ background: "rgba(229, 116, 112, 0.08)", borderColor: "#e57470" }}>
                      <Group gap={6} align="flex-start">
                        <AlertTriangle size={15} color="#e57470" style={{ marginTop: 2 }} />
                        <div style={{ flex: 1 }}>
                          <Text size="xs" fw={700} c="red">Дедлайн проекта превышен</Text>
                          <Text size="11px" c="dimmed">
                            Расчетный финиш позже дедлайна на {formatCalendarDuration(view.analysis.delay_minutes)}.
                          </Text>
                        </div>
                      </Group>
                    </Card>
                  )}

                  {overdueTasks.map((ot) => {
                    const taskObj = draft?.tasks.find((x) => x.id === ot.id);
                    return (
                      <Card key={ot.id} withBorder p="xs">
                        <Group justify="space-between" align="flex-start">
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <Group gap={4} mb={2}>
                              <Badge size="xs" color="red">Просрочка</Badge>
                              <Text size="xs" fw={600} lineClamp={1}>{taskObj?.name}</Text>
                            </Group>
                            <Text size="10px" c="dimmed">
                              Плановый финиш: {shortDate(ot.finish)}
                            </Text>
                          </div>
                          <Button
                            size="compact-xs"
                            variant="light"
                            onClick={() => taskObj && setTask(copy(taskObj))}
                          >
                            Открыть
                          </Button>
                        </Group>
                      </Card>
                    );
                  })}

                  {overloadedAssigneeIds.size > 0 && (
                    <Card withBorder p="xs" style={{ background: "rgba(238, 149, 100, 0.08)" }}>
                      <Group justify="space-between" align="center">
                        <div>
                          <Text size="xs" fw={700} c="orange">Перегрузка исполнителей</Text>
                          <Text size="11px" c="dimmed">
                            {overloadedAssigneeIds.size} сотрудников имеют занятость {">"} 100%.
                          </Text>
                        </div>
                        <Button size="compact-xs" variant="light" color="orange" onClick={() => setActiveView("team")}>
                          Команда
                        </Button>
                      </Group>
                    </Card>
                  )}

                  {overdueTasks.length === 0 && overloadedAssigneeIds.size === 0 && !view?.analysis.deadline_exceeded && (
                    <Card withBorder p="sm" style={{ textAlign: "center" }}>
                      <Check size={20} color="#3eac7d" style={{ margin: "0 auto 4px" }} />
                      <Text size="xs" fw={700} c="teal">Критических рисков нет</Text>
                      <Text size="10px" c="dimmed">Все задачи укладываются в график и дедлайн.</Text>
                    </Card>
                  )}
                </Stack>
              </ScrollArea.Autosize>

              <Divider />

              <Group justify="space-between">
                <Button size="xs" variant="subtle" onClick={() => setExecutiveReportModal(true)}>
                  <FileText size={13} style={{ marginRight: 4 }} /> Отчет
                </Button>
                <Button size="xs" variant="light" onClick={() => setActiveView("ai")}>
                  <Sparkles size={13} style={{ marginRight: 4 }} /> AI Copilot
                </Button>
              </Group>
            </Stack>
          </Popover.Dropdown>
        </Popover>

        <button className="help-button" aria-label="Помощь" onClick={() => setHelpModal(true)}>
          <CircleHelp size={14} />
        </button>

        {user && (
          <Popover width={220} position="bottom-end" shadow="md">
            <Popover.Target>
              <button
                type="button"
                className="user-profile-btn"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "4px 8px",
                  borderRadius: 6,
                  border: "1px solid var(--border-color)",
                  background: "transparent",
                  color: "inherit",
                  cursor: "pointer",
                }}
                title={user.email}
              >
                <span
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: "50%",
                    background: "var(--purple)",
                    color: "#fff",
                    fontSize: 11,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 700,
                  }}
                >
                  {user.name ? user.name[0].toUpperCase() : "U"}
                </span>
                <span style={{ fontSize: 12, fontWeight: 500, maxWidth: 90, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {user.name}
                </span>
              </button>
            </Popover.Target>
            <Popover.Dropdown p="xs">
              <Stack gap="xs">
                <div>
                  <Text size="xs" fw={700}>{user.name}</Text>
                  <Text size="11px" c="dimmed">{user.email}</Text>
                </div>
                <Divider />
                <Button
                  size="compact-xs"
                  variant="subtle"
                  color="red"
                  leftSection={<LogOut size={13} />}
                  onClick={() => void logout()}
                  fullWidth
                  justify="flex-start"
                >
                  Выйти из системы
                </Button>
              </Stack>
            </Popover.Dropdown>
          </Popover>
        )}
      </div>
    </header>
  );
}

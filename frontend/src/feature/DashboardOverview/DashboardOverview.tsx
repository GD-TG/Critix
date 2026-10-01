import { useMemo } from "react";
import {
  Alert,
  Badge,
  Button,
  Card,
  Group,
  NumberInput,
  Paper,
  Popover,
  Progress,
  SimpleGrid,
  Stack,
  Text,
  ThemeIcon,
  Title,
} from "@mantine/core";
import {
  Activity,
  AlertOctagon,
  AlertTriangle,
  ArrowRight,
  Calendar,
  CheckCircle2,
  Clock,
  Coins,
  Cpu,
  Flame,
  GitBranch,
  Layers,
  Package,
  ShieldAlert,
  ShieldCheck,
  TrendingDown,
  Users,
  Zap,
} from "lucide-react";
import { useApp } from "@/context/AppContext";
import { formatShortDate, formatWorkDuration, getZone } from "@/shared";
import { AttentionPanel } from "@/feature/AttentionPanel/AttentionPanel";
import { EnginePanel } from "@/feature/EnginePanel/EnginePanel";

export function DashboardOverview() {
  const {
    draft,
    saved,
    preview,
    rows,
    setActiveView,
    openDecisionLabForTask,
    setEventDialogOpened,
    costPerDay,
    setCostPerDay,
  } = useApp();

  const view = preview || saved;
  const zone = getZone(draft, saved);
  const shortDate = (iso?: string) => (iso ? formatShortDate(iso, zone) : "—");

  // Расчет основных показателей срыва
  const finishDate = view?.analysis.finish ? new Date(view.analysis.finish) : null;
  const deadlineDate = draft?.deadline ? new Date(draft.deadline) : null;

  let lateDays = 0;
  let bufferDays = 0;
  if (finishDate && deadlineDate) {
    const diffMs = finishDate.getTime() - deadlineDate.getTime();
    const diffDays = Math.round(diffMs / 86400000);
    if (diffDays > 0) {
      lateDays = diffDays;
    } else {
      bufferDays = Math.abs(diffDays);
    }
  }

  const hasExceeded = Boolean(view?.analysis.deadline_exceeded) || lateDays > 0;
  const criticalTasks = useMemo(
    () => (draft?.tasks || []).filter((t) => rows.get(t.id)?.critical),
    [draft?.tasks, rows]
  );

  // Выявление задачи-виновника срыва (Root Cause)
  const rootCause = useMemo(() => {
    if (!hasExceeded || !draft) return null;
    const dlMs = deadlineDate ? deadlineDate.getTime() : 0;
    // Находим первую критическую задачу, которая финиширует позже дедлайна
    const breachTask = criticalTasks.find((t) => {
      const r = rows.get(t.id);
      return r && new Date(r.finish).getTime() > dlMs;
    });

    const culprit = breachTask || criticalTasks[criticalTasks.length - 1] || null;
    if (!culprit) return null;

    const culpritRow = rows.get(culprit.id);
    // Находим цепочку последующих зависимых задач
    const downstreamIds = (view?.changes?.downstream_task_ids || []).filter((id) => id !== culprit.id);
    const downstreamTasks = (draft.tasks || []).filter((t) => downstreamIds.includes(t.id));

    return {
      task: culprit,
      row: culpritRow,
      downstreamTasks,
    };
  }, [hasExceeded, draft, deadlineDate, criticalTasks, rows, view?.changes?.downstream_task_ids]);

  // Финансовый риск (штрафы за простой)
  const financialRisk = lateDays > 0 ? lateDays * costPerDay : 0;

  // Анализ загрузки команды
  const teamWorkload = useMemo(() => {
    if (!draft) return [];
    const overloads = view?.analysis.overloads || [];
    const overloadedIds = new Set(overloads.map((o) => o.assignee_id));

    return draft.assignees.map((assignee) => {
      const assignedTasks = draft.tasks.filter((t) => t.assignee_id === assignee.id);
      const totalMinutes = assignedTasks.reduce((sum, t) => sum + t.duration_minutes, 0);
      const totalDays = Math.round(totalMinutes / 480);
      const isOverloaded = overloadedIds.has(assignee.id);

      return {
        ...assignee,
        taskCount: assignedTasks.length,
        totalDays,
        isOverloaded,
      };
    });
  }, [draft, view?.analysis.overloads]);

  const overloadedCount = teamWorkload.filter((m) => m.isOverloaded).length;

  if (!draft || !view) return null;

  return (
    <Stack gap="lg" pb="xl">
      {/* 1. ГЛАВНЫЙ СТАТУС-БАННЕР РУКОВОДИТЕЛЯ */}
      <Paper
        withBorder
        p="lg"
        radius="md"
        style={{
          background: hasExceeded
            ? "linear-gradient(135deg, rgba(210, 10, 46, 0.08) 0%, rgba(210, 10, 46, 0.02) 100%)"
            : "linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(16, 185, 129, 0.02) 100%)",
          borderColor: hasExceeded ? "rgba(210, 10, 46, 0.3)" : "rgba(16, 185, 129, 0.3)",
        }}
      >
        <Group justify="space-between" align="flex-start" wrap="nowrap">
          <Group align="flex-start" gap="md">
            <ThemeIcon
              size={48}
              radius="md"
              color={hasExceeded ? "red" : "teal"}
              variant="light"
            >
              {hasExceeded ? <Flame size={28} /> : <CheckCircle2 size={28} />}
            </ThemeIcon>
            <div>
              <Group gap="xs" mb={4}>
                <Badge
                  color={hasExceeded ? "red" : "teal"}
                  size="md"
                  variant="filled"
                >
                  {hasExceeded ? `Срыв дедлайна (+${lateDays} дн.)` : "Проект в графике"}
                </Badge>
                <Badge variant="outline" color="gray" size="sm">
                  {criticalTasks.length} задач на критическом пути
                </Badge>
                {overloadedCount > 0 && (
                  <Badge color="orange" variant="light" size="sm">
                    {overloadedCount} сотрудников перегружены
                  </Badge>
                )}
              </Group>
              <Title order={3} fw={700}>
                {hasExceeded
                  ? `Прогнозируемый финиш ${shortDate(view.analysis.finish)} нарушает дедлайн (${shortDate(draft.deadline)})`
                  : `Сдача проекта запланирована на ${shortDate(view.analysis.finish)} (запас ${bufferDays} дн.)`}
              </Title>
              <Text size="sm" c="dimmed" mt={4}>
                {hasExceeded
                  ? `Критический путь заблокирован задержкой. Финансовый риск штрафных санкций составляет ${financialRisk.toLocaleString("ru-RU")} ₽.`
                  : "График сбалансирован. Все задачи критического пути укладываются в установленные контрактом сроки."}
              </Text>
            </div>
          </Group>

          <Group gap="xs">
            {hasExceeded && rootCause && (
              <Button
                color="red"
                size="sm"
                leftSection={<Coins size={16} />}
                onClick={() => openDecisionLabForTask(rootCause.task.id)}
              >
                Ликвидировать срыв в Пульте решений
              </Button>
            )}
            <Button
              variant="default"
              size="sm"
              leftSection={<Calendar size={16} />}
              onClick={() => setActiveView("timeline")}
            >
              Открыть диаграмму Ганта →
            </Button>
          </Group>
        </Group>
      </Paper>

      {/* 2. АНАЛИЗ ПЕРВОПРИЧИНЫ СРЫВА (ROOT CAUSE & CRITICAL CHAIN) */}
      {hasExceeded && rootCause && (
        <Card withBorder padding="md" radius="md">
          <Group justify="space-between" mb="xs">
            <Group gap="xs">
              <ThemeIcon color="red" size="sm" variant="light">
                <AlertOctagon size={16} />
              </ThemeIcon>
              <Text size="sm" fw={700} c="red.8">
                ГЛУБОКИЙ АНАЛИЗ ПЕРВОПРИЧИНЫ СРЫВА (ROOT CAUSE DIAGNOSTICS)
              </Text>
            </Group>
            <Badge color="red" variant="light">
              Критический узел
            </Badge>
          </Group>

          <SimpleGrid cols={{ base: 1, md: 3 }} spacing="md" mt="xs">
            {/* Виновник */}
            <Paper p="sm" bg="var(--bg)" radius="sm" withBorder>
              <Text size="xs" fw={700} c="dimmed">
                1. ИСТОЧНИК СБОЯ (ДРАЙВЕР СРЫВА)
              </Text>
              <Text size="sm" fw={700} mt={4} c="red.9">
                «{rootCause.task.name}»
              </Text>
              <Text size="xs" c="dimmed" mt={2}>
                Длительность: {formatWorkDuration(rootCause.task.duration_minutes, false)} · Свободный резерв: 0 ч
              </Text>
              <Text size="xs" mt={4}>
                Финиш задачи: <b>{shortDate(rootCause.row?.finish)}</b> (позже целевого дедлайна {shortDate(draft.deadline)}).
              </Text>
            </Paper>

            {/* Цепочка последствий */}
            <Paper p="sm" bg="var(--bg)" radius="sm" withBorder>
              <Text size="xs" fw={700} c="dimmed">
                2. КАСКАД РАСПРОСТРАНЕНИЯ ЗАДЕРЖКИ
              </Text>
              <Text size="sm" fw={600} mt={4}>
                Блокирует {rootCause.downstreamTasks.length} зависимых этапов:
              </Text>
              <Text size="xs" c="dimmed" mt={2}>
                {rootCause.downstreamTasks.length > 0
                  ? rootCause.downstreamTasks.slice(0, 3).map((t) => `«${t.name}»`).join(" → ")
                  : "Непосредственно сдвигает финальную веху сдачи проекта."}
              </Text>
              <Text size="xs" mt={4} c="orange.8" fw={600}>
                Каждый день задержки этой задачи сдвигает финиш проекта ровно на 1 день.
              </Text>
            </Paper>

            {/* Решение для PM */}
            <Paper p="sm" bg="var(--bg)" radius="sm" withBorder>
              <Text size="xs" fw={700} c="dimmed">
                3. РЕКОМЕНДУЕМЫЕ ДЕЙСТВИЯ PM
              </Text>
              <Stack gap={4} mt={4}>
                <Text size="xs">
                  • <b>Дескоупинг:</b> перенести часть объема во 2-й релиз.
                </Text>
                <Text size="xs">
                  • <b>Ресурсный маневр:</b> переключить свободных разработчиков.
                </Text>
                <Text size="xs">
                  • <b>Смещение сдачи:</b> согласовать перенос на {shortDate(view.analysis.finish)}.
                </Text>
              </Stack>
            </Paper>
          </SimpleGrid>
        </Card>
      )}

      {/* 3. КЛЮЧЕВЫЕ МЕТРИКИ В ЦИФРАХ */}
      <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} spacing="md">
        <Card withBorder p="sm" radius="md">
          <Group justify="space-between" mb={4}>
            <Text size="xs" fw={700} c="dimmed">
              ОТКЛОНЕНИЕ ОТ ДЕДЛАЙНА
            </Text>
            <ThemeIcon color={hasExceeded ? "red" : "teal"} size="sm" variant="light">
              <Clock size={14} />
            </ThemeIcon>
          </Group>
          <Text size="xl" fw={700} c={hasExceeded ? "red.7" : "teal.7"}>
            {hasExceeded ? `+${lateDays} дн.` : `-${bufferDays} дн.`}
          </Text>
          <Text size="xs" c="dimmed">
            {hasExceeded ? "Просрочка контрактного дедлайна" : "Запас времени до дедлайна"}
          </Text>
        </Card>

        <Card withBorder p="sm" radius="md">
          <Group justify="space-between" mb={4}>
            <Text size="xs" fw={700} c="dimmed">
              ФИНАНСОВЫЙ РИСК (ШТРАФЫ)
            </Text>
            <Popover width={280} position="bottom-end" shadow="md">
              <Popover.Target>
                <button
                  type="button"
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    padding: 0,
                  }}
                  title="Изменить ставку простоя"
                >
                  <ThemeIcon color={hasExceeded ? "red" : "blue"} size="sm" variant="light">
                    <Coins size={14} />
                  </ThemeIcon>
                </button>
              </Popover.Target>
              <Popover.Dropdown p="xs">
                <Text size="xs" fw={700} mb={4}>
                  Ставка штрафа / простоя
                </Text>
                <Text size="11px" c="dimmed" mb={8}>
                  Стоимость 1 дня задержки по вашему контракту:
                </Text>
                <NumberInput
                  size="xs"
                  value={costPerDay}
                  onChange={(v) => setCostPerDay(Number(v) || 0)}
                  step={5000}
                  min={0}
                  thousandSeparator=" "
                  suffix=" ₽/сутки"
                />
              </Popover.Dropdown>
            </Popover>
          </Group>
          <Text size="xl" fw={700} c={hasExceeded ? "red.7" : "gray.7"}>
            {financialRisk.toLocaleString("ru-RU")} ₽
          </Text>
          <Group gap={6} justify="space-between">
            <Text size="xs" c="dimmed">
              Ставка: {costPerDay.toLocaleString("ru-RU")} ₽ / сутки
            </Text>
            <Popover width={280} position="bottom-end" shadow="md">
              <Popover.Target>
                <Text
                  size="xs"
                  c="blue"
                  style={{ cursor: "pointer", textDecoration: "underline" }}
                >
                  изменить
                </Text>
              </Popover.Target>
              <Popover.Dropdown p="xs">
                <Text size="xs" fw={700} mb={4}>
                  Ставка штрафа / простоя
                </Text>
                <Text size="11px" c="dimmed" mb={8}>
                  Стоимость 1 дня задержки по вашему контракту:
                </Text>
                <NumberInput
                  size="xs"
                  value={costPerDay}
                  onChange={(v) => setCostPerDay(Number(v) || 0)}
                  step={5000}
                  min={0}
                  thousandSeparator=" "
                  suffix=" ₽/сутки"
                />
              </Popover.Dropdown>
            </Popover>
          </Group>
        </Card>

        <Card withBorder p="sm" radius="md">
          <Group justify="space-between" mb={4}>
            <Text size="xs" fw={700} c="dimmed">
              КРИТИЧЕСКИЙ ПУТЬ (CPM)
            </Text>
            <ThemeIcon color="red" size="sm" variant="light">
              <ShieldAlert size={14} />
            </ThemeIcon>
          </Group>
          <Text size="xl" fw={700}>
            {criticalTasks.length} из {draft.tasks.length}
          </Text>
          <Text size="xs" c="dimmed">
            Задач с нулевым резервом времени (Float = 0)
          </Text>
        </Card>

        <Card withBorder p="sm" radius="md">
          <Group justify="space-between" mb={4}>
            <Text size="xs" fw={700} c="dimmed">
              ЗАГРУЗКА КОМАНДЫ
            </Text>
            <ThemeIcon color={overloadedCount > 0 ? "orange" : "teal"} size="sm" variant="light">
              <Users size={14} />
            </ThemeIcon>
          </Group>
          <Text size="xl" fw={700} c={overloadedCount > 0 ? "orange.7" : "teal.7"}>
            {overloadedCount > 0 ? `${overloadedCount} в перегрузке` : "В норме"}
          </Text>
          <Text size="xs" c="dimmed">
            Всего специалистов в проекте: {draft.assignees.length}
          </Text>
        </Card>
      </SimpleGrid>

      {/* 4. ОПЕРАТИВНЫЕ ПАНЕЛИ: ТРЕБУЕТ ВНИМАНИЯ & МЕТРИКИ РАСПИСАНИЯ */}
      <section className="dashboard-grid">
        <AttentionPanel />
        <EnginePanel />
      </section>

      {/* 5. РЕСУРСНЫЙ РАДАР КОМАНДЫ */}
      <Card withBorder padding="md" radius="md">
        <Group justify="space-between" mb="sm">
          <div>
            <Title order={4} fw={700}>
              Ресурсный баланс команды проекта
            </Title>
            <Text size="xs" c="dimmed">
              Распределение трудоемкости задач между специалистами и календарные конфликты
            </Text>
          </div>
          <Button
            size="xs"
            variant="light"
            color="teal"
            leftSection={<Users size={14} />}
            onClick={() => setActiveView("team")}
          >
            Управление командой
          </Button>
        </Group>

        <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="sm">
          {teamWorkload.map((m) => (
            <Paper key={m.id} withBorder p="xs" radius="sm" bg="var(--bg)">
              <Group justify="space-between" mb={4}>
                <Group gap="xs">
                  <span className="avatar mini-avatar avatar-blue">
                    {m.name.slice(0, 2).toUpperCase()}
                  </span>
                  <div>
                    <Text size="xs" fw={700}>
                      {m.name}
                    </Text>
                    <Text size="9px" c="dimmed">
                      {m.role || "Исполнитель"}
                    </Text>
                  </div>
                </Group>
                {m.isOverloaded ? (
                  <Badge color="red" size="xs" variant="light">
                    &gt;100% FTE
                  </Badge>
                ) : (
                  <Badge color="teal" size="xs" variant="light">
                    Норма
                  </Badge>
                )}
              </Group>

              <Group justify="space-between" mt={6}>
                <Text size="xs" c="dimmed">
                  Задач: <b>{m.taskCount}</b>
                </Text>
                <Text size="xs" c="dimmed">
                  Трудоемкость: <b>{m.totalDays} дн.</b>
                </Text>
              </Group>
            </Paper>
          ))}
        </SimpleGrid>
      </Card>

      {/* 6. РАДАР ВНЕШНИХ ПОСТАВОК ПОДРЯДЧИКОВ */}
      {draft.deliveries && draft.deliveries.length > 0 && (
        <Card withBorder padding="md" radius="md">
          <Group justify="space-between" mb="xs">
            <Group gap="xs">
              <ThemeIcon color="blue" size="sm" variant="light">
                <Package size={16} />
              </ThemeIcon>
              <Title order={4} fw={700}>
                Внешние поставки и зависимости подрядчиков ({draft.deliveries.length})
              </Title>
            </Group>
          </Group>

          <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="sm" mt="xs">
            {draft.deliveries.map((del) => (
              <Paper key={del.id} withBorder p="xs" radius="sm">
                <Group justify="space-between" mb={2}>
                  <Text size="xs" fw={700}>
                    {del.name}
                  </Text>
                  <Badge
                    size="xs"
                    color={
                      del.status === "accepted"
                        ? "teal"
                        : del.status === "rework"
                        ? "red"
                        : "blue"
                    }
                  >
                    {del.status === "accepted"
                      ? "Принято"
                      : del.status === "rework"
                      ? "Доработка"
                      : "Ожидается"}
                  </Badge>
                </Group>
                <Text size="xs" c="dimmed">
                  Подрядчик: <b>{del.contractor}</b> · Срок: {shortDate(del.promised_at)}
                </Text>
              </Paper>
            ))}
          </SimpleGrid>
        </Card>
      )}
    </Stack>
  );
}

import { useEffect, useState } from "react";
import {
  Alert,
  Badge,
  Button,
  Card,
  CopyButton,
  Divider,
  Group,
  Modal,
  NumberInput,
  Paper,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Text,
  ThemeIcon,
  Title,
} from "@mantine/core";
import {
  AlertTriangle,
  ArrowRight,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Coins,
  Copy,
  FileText,
  Flame,
  Layers,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Zap,
} from "lucide-react";
import { api } from "../../api";
import { useApp } from "../../context/AppContext";
import { formatShortDate, getZone } from "../../shared";
import type { Project, Result, Task } from "../../types";

const formatMoney = (v: number) => `${v.toLocaleString("ru-RU")} ₽`;

export function DecisionLab({
  opened,
  onClose,
  onLoadDemo,
}: {
  opened: boolean;
  onClose: () => void;
  onLoadDemo?: () => Promise<void>;
}) {
  const { draft, saved, preview, decisionLabTaskId, change, showNotification } = useApp();
  const view = preview || saved;
  const zone = getZone(draft, saved);
  const shortDate = (iso?: string) => (iso ? formatShortDate(iso, zone) : "—");

  // Состояние симуляции
  const [selectedTaskId, setSelectedTaskId] = useState<string>("");
  const [delayDays, setDelayDays] = useState<number>(3);
  const [costPerDay, setCostPerDay] = useState<number>(35000);
  const [stressOffset, setStressOffset] = useState<number>(0);
  const [letterOpened, setLetterOpened] = useState<boolean>(false);
  const [selectedStrategy, setSelectedStrategy] = useState<string>("descope");

  const [simResult, setSimResult] = useState<Result | null>(null);
  const [simBusy, setSimBusy] = useState<boolean>(false);
  const [simError, setSimError] = useState<string>("");

  // Инициализация при открытии
  useEffect(() => {
    if (opened && draft && draft.tasks.length > 0) {
      const initialTask =
        decisionLabTaskId ||
        draft.tasks.find((t) => t.status !== "done" && (saved || view)?.analysis.tasks.find((r) => r.id === t.id)?.critical)?.id ||
        draft.tasks.find((t) => t.status !== "done")?.id ||
        draft.tasks[0].id;
      setSelectedTaskId(initialTask);
    }
  }, [opened, decisionLabTaskId, draft, saved, view]);

  // Запуск симуляции на реальном CPM-графе
  useEffect(() => {
    if (!opened || !saved || !draft || !selectedTaskId) return;

    let isMounted = true;
    const runSim = async () => {
      setSimBusy(true);
      setSimError("");
      try {
        const modifiedProject: Project = {
          ...draft,
          tasks: draft.tasks.map((t) =>
            t.id === selectedTaskId
              ? {
                  ...t,
                  duration_minutes: Math.max(480, t.duration_minutes + Math.round((delayDays + stressOffset) * 480)),
                  ...(t.status === "done" ? { status: "in_progress" as const, actual_finish: null } : {}),
                }
              : t
          ),
        };

        const res = await api<Result>(`/projects/${saved.id}/simulate`, "POST", {
          version: saved.version,
          project: modifiedProject,
        });

        if (isMounted) {
          setSimResult(res);
        }
      } catch (err: unknown) {
        if (isMounted) {
          setSimError(err instanceof Error ? err.message : "Ошибка симуляции графа");
        }
      } finally {
        if (isMounted) {
          setSimBusy(false);
        }
      }
    };

    const timer = setTimeout(() => {
      void runSim();
    }, 150);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [opened, saved, draft, selectedTaskId, delayDays, stressOffset]);

  if (!draft || draft.tasks.length === 0) {
    return (
      <Modal opened={opened} onClose={onClose} size="lg" title="Пульт решений: Срок · Деньги · Состав">
        <Stack gap="md" p="md" align="center">
          <ThemeIcon size={48} radius="xl" color="red" variant="light">
            <Coins size={24} />
          </ThemeIcon>
          <Title order={3}>В проекте пока нет задач</Title>
          <Text size="sm" c="dimmed" ta="center">
            Чтобы смоделировать последствия задержек и рассчитать финансовые риски на реальном критическом пути,
            загрузите демонстрационный проект.
          </Text>
          {onLoadDemo && (
            <Button
              color="red"
              onClick={async () => {
                await onLoadDemo();
                onClose();
              }}
            >
              Загрузить Демо-проект «Запуск портала»
            </Button>
          )}
        </Stack>
      </Modal>
    );
  }

  // Данные выбранной задачи
  const activeTask = draft.tasks.find((t) => t.id === selectedTaskId);
  const activeTaskRow = saved?.analysis.tasks.find((r) => r.id === selectedTaskId) || view?.analysis.tasks.find((r) => r.id === selectedTaskId);
  const isCritical = Boolean(activeTaskRow?.critical);
  const originalSlackMinutes = activeTaskRow?.slack_minutes ?? 0;
  const originalSlackDays = Math.round(originalSlackMinutes / 480);

  // Метрики симуляции
  const finishDeltaMinutes = simResult?.changes?.finish_delta_minutes ?? 0;
  const finishDeltaDays = Math.round(finishDeltaMinutes / 480);
  const newFinishIso = simResult?.analysis.finish;
  const deadlineExceeded = Boolean(simResult?.analysis.deadline_exceeded);
  const delayMinutes = simResult?.analysis.delay_minutes ?? 0;
  const lateDays = Math.round(delayMinutes / 480);
  const downstreamIds = simResult?.changes?.downstream_task_ids ?? [];
  const downstreamTasks = draft.tasks.filter((t) => downstreamIds.includes(t.id));

  // Финансовый ущерб
  const financialDamage = lateDays > 0 ? lateDays * costPerDay : 0;

  // Кандидаты на дескоупинг (некритичные задачи с низким/средним приоритетом)
  const descopeCandidates = draft.tasks.filter(
    (t) =>
      t.id !== selectedTaskId &&
      t.status !== "done" &&
      !downstreamIds.includes(t.id) &&
      (t.priority === "low" || t.priority === "medium" || !view?.analysis.tasks.find((r) => r.id === t.id)?.critical)
  );

  // Применить в проект
  const handleApplyToDraft = () => {
    if (simResult) {
      change(simResult.project);
      showNotification(`Задержка задачи «${activeTask?.name}» применена как черновик What-If!`);
      onClose();
    }
  };

  // Генерация письма заказчику
  const generateClientLetter = () => {
    const taskName = activeTask?.name || "ключевая задача";
    const deadlineStr = shortDate(draft.deadline);
    const newFinishStr = shortDate(newFinishIso);

    if (finishDeltaDays <= 0) {
      if (originalSlackDays >= delayDays && originalSlackDays > 0) {
        return `Уважаемый партнер!

Информируем о статусе выполнения проекта «${draft.name}».
По задаче «${taskName}» зафиксировано смещение на ${delayDays} дн.

Благодаря наличию технологического резерва времени (${originalSlackDays} дн.), данная задержка полностью укладывается в график.
Плановая дата сдачи проекта (${deadlineStr}) остается неизменной. Дополнительных финансовых расходов и срыва дедлайна нет.

С уважением,
Руководитель проекта Critix`;
      }

      return `Уважаемый партнер!

Информируем о статусе выполнения проекта «${draft.name}».
По задаче «${taskName}» зафиксировано смещение на ${delayDays} дн.

Собственный резерв времени задачи исчерпан, однако текущая дата сдачи проекта (${deadlineStr}) удерживается за счет параллельных веток графика.
Задача взята под усиленный контроль руководителя для предотвращения выхода на критический путь.

С уважением,
Руководитель проекта Critix`;
    }

    if (selectedStrategy === "descope") {
      const cutNames = descopeCandidates.slice(0, 2).map((t) => `«${t.name}»`);
      return `Уважаемый партнер!

В связи с задержкой задачи «${taskName}» на ${delayDays} дн., возник риск смещения финального дедлайна (${deadlineStr}) на ${lateDays} дн. с потенциальным договорным штрафом в размере ${formatMoney(financialDamage)}.

Чтобы гарантированно сдать проект в установленный срок (${deadlineStr}) и избежать штрафных санкций, предлагаем оптимизировать состав первого релиза:
1. Запуск ${deadlineStr} (в срок!): сохраняются все критические модули системы.
2. Второстепенные задачи (${cutNames.length > 0 ? cutNames.join(", ") : "некритический функционал"}) переносятся во второй релиз.

Просим согласовать предложенную оптимизацию релиза.
С уважением,
Руководитель проекта Critix`;
    }

    return `Уважаемый партнер!

Уведомляем о смещении расчетного срока завершения проекта «${draft.name}» в связи с непредвиденной задержкой задачи «${taskName}» на ${delayDays} дн.

• Исходный дедлайн: ${deadlineStr}
• Новый расчетный срок готовности: ${newFinishStr} (смещение на ${lateDays} дн.)
• Объем релиза: сохраняется 100% заявленного функционала
• Расчетный финансовый риск/штраф: ${formatMoney(financialDamage)}

Просим согласовать перенос даты приемки.
С уважением,
Команда проекта Critix`;
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      size="80rem"
      title={
        <Group gap="xs">
          <ThemeIcon color="red" size="md" radius="md">
            <Coins size={18} />
          </ThemeIcon>
          <Title order={3} fw={700}>
            Пульт решений: Срок · Деньги · Состав запуска
          </Title>
          <Badge variant="light" color="blue">
            Анализ реального проекта
          </Badge>
        </Group>
      }
      styles={{
        header: { borderBottom: "1px solid var(--line)" },
        body: { padding: "1.5rem" },
      }}
    >
      <Stack gap="xl">
        {/* БЛОК 1: Выбор задачи из проекта и параметры сдвига */}
        <Paper withBorder p="md" radius="md" bg="var(--bg)">
          <SimpleGrid cols={{ base: 1, md: 3 }} spacing="lg">
            {/* Выбор задачи */}
            <Stack gap={4}>
              <Text size="xs" fw={700} c="dimmed">
                1. КАКАЯ ЗАДАЧА ОПАЗДЫВАЕТ?
              </Text>
              <Select
                searchable
                size="sm"
                value={selectedTaskId}
                onChange={(val) => val && setSelectedTaskId(val)}
                data={draft.tasks.map((t) => {
                  const r = saved?.analysis.tasks.find((x) => x.id === t.id) || view?.analysis.tasks.find((x) => x.id === t.id);
                  const crit = r?.critical;
                  const slack = Math.round((r?.slack_minutes ?? 0) / 480);
                  const statusStr = t.status === "done" ? " [Завершена]" : t.status === "in_progress" ? " [В работе]" : " [План]";
                  return {
                    value: t.id,
                    label: `${t.name}${statusStr} (${crit ? "Критическая" : `Резерв: ${slack} дн.`})`,
                  };
                })}
              />
              <Group gap="xs">
                {isCritical ? (
                  <Badge color="red" variant="light" size="xs">
                    На критическом пути (0 дн. резерва)
                  </Badge>
                ) : (
                  <Badge color="teal" variant="light" size="xs">
                    Есть резерв: {originalSlackDays} дн.
                  </Badge>
                )}
                <Text size="xs" c="dimmed">
                  Длительность: {Math.round((activeTask?.duration_minutes ?? 0) / 480)} дн.
                </Text>
              </Group>
            </Stack>

            {/* Величина задержки */}
            <Stack gap={4}>
              <Text size="xs" fw={700} c="dimmed">
                2. НА СКОЛЬКО ДНЕЙ ЗАДЕРЖКА?
              </Text>
              <NumberInput
                value={delayDays}
                min={1}
                max={60}
                size="sm"
                allowDecimal={false}
                onChange={(v) => setDelayDays(Number(v) || 1)}
              />
              <Group gap="xs">
                {[1, 3, 5, 10].map((d) => (
                  <Button
                    key={d}
                    size="compact-xs"
                    variant={delayDays === d ? "filled" : "subtle"}
                    color={delayDays === d ? "red" : "gray"}
                    onClick={() => setDelayDays(d)}
                  >
                    +{d} дн.
                  </Button>
                ))}
              </Group>
            </Stack>

            {/* Цена простоя в день */}
            <Stack gap={4}>
              <Text size="xs" fw={700} c="dimmed">
                3. ЦЕНА 1 ДНЯ ПРОСТОЯ (ШТРАФ + LOSS)
              </Text>
              <NumberInput
                value={costPerDay}
                min={0}
                step={5000}
                size="sm"
                allowDecimal={false}
                onChange={(v) => setCostPerDay(Number(v) || 0)}
              />
              <Text size="xs" c="dimmed">
                Расчетный штраф за сутки просрочки дедлайна
              </Text>
            </Stack>
          </SimpleGrid>
        </Paper>

        {simError && (
          <Alert color="red" icon={<AlertTriangle size={18} />}>
            {simError}
          </Alert>
        )}

        {/* БЛОК 2: Вердикт движка на реальном CPM-графе */}
        {simResult && (
          <Stack gap="md">
            {finishDeltaDays <= 0 ? (
              originalSlackDays >= delayDays && originalSlackDays > 0 ? (
                /* СЛУЧАЙ А: Задержка безопасна, полностью укладывается в технологический резерв задачи */
                <Paper withBorder p="md" radius="md" bg="var(--mantine-color-teal-0)" style={{ borderColor: "var(--mantine-color-teal-4)" }}>
                  <Group align="flex-start" wrap="nowrap">
                    <ThemeIcon color="teal" size="lg" radius="md">
                      <CheckCircle2 size={24} />
                    </ThemeIcon>
                    <Stack gap={4}>
                      <Text fw={700} size="md" c="teal.9">
                        Задержка безопасна: дата сдачи проекта НЕ изменится!
                      </Text>
                      <Text size="sm">
                        У задачи «{activeTask?.name}» есть свободный резерв времени ({originalSlackDays} дн.). Задержка на {delayDays} дн. полностью укладывается в запас.
                        Проект финиширует в срок: <b>{shortDate(newFinishIso)}</b>.
                      </Text>
                      <Text size="xs" c="dimmed">
                        Финансовые штрафы: <b>0 ₽</b> · Оставшийся резерв задачи: {Math.max(0, originalSlackDays - delayDays)} дн.
                      </Text>
                    </Stack>
                  </Group>
                </Paper>
              ) : (
                /* СЛУЧАЙ Б: Резерв задачи исчерпан, финиш пока удерживается параллельной цепочкой */
                <Paper withBorder p="md" radius="md" bg="var(--mantine-color-yellow-0)" style={{ borderColor: "var(--mantine-color-yellow-5)" }}>
                  <Group align="flex-start" wrap="nowrap">
                    <ThemeIcon color="yellow" size="lg" radius="md">
                      <AlertTriangle size={24} />
                    </ThemeIcon>
                    <Stack gap={4}>
                      <Text fw={700} size="md" c="yellow.9">
                        Внимание: технологический резерв задачи исчерпан!
                      </Text>
                      <Text size="sm">
                        Собственный запас времени задачи «{activeTask?.name}» ({originalSlackDays} дн.) исчерпан задержкой на {delayDays} дн.
                        Общая дата сдачи проекта (<b>{shortDate(newFinishIso)}</b>) пока удерживается за счет параллельной критической цепочки работ. Задача «{activeTask?.name}» перешла в критическую зону без права на дальнейшие задержки.
                      </Text>
                      <Text size="xs" c="dimmed">
                        Штрафы на текущий момент: <b>0 ₽</b> (находится на грани срыва дедлайна).
                      </Text>
                    </Stack>
                  </Group>
                </Paper>
              )
            ) : (
              /* СЛУЧАЙ В: Задержка ломает критический путь */
              <Paper withBorder p="md" radius="md" bg="var(--mantine-color-red-0)" style={{ borderColor: "var(--mantine-color-red-4)" }}>
                <Group align="flex-start" wrap="nowrap">
                  <ThemeIcon color="red" size="lg" radius="md">
                    <Flame size={24} />
                  </ThemeIcon>
                  <Stack gap={4}>
                    <Text fw={700} size="md" c="red.9">
                      Критический сбой: финиш проекта сдвигается на +{finishDeltaDays} дн.!
                    </Text>
                    <Text size="sm">
                      Задача находится на критическом пути. Задержка смещает финиш проекта с <b>{shortDate(view?.analysis.finish)}</b> на <b>{shortDate(newFinishIso)}</b>.
                      {deadlineExceeded && ` Дедлайн (${shortDate(draft.deadline)}) сорван на ${lateDays} дн.`}
                    </Text>
                    <Group gap="xl" mt={4}>
                      <Text size="xs" fw={700} c="red.8">
                        Финансовый убыток: {formatMoney(financialDamage)}
                      </Text>
                      {downstreamTasks.length > 0 && (
                        <Text size="xs" c="dimmed">
                          Сдвинутся зависимые задачи ({downstreamTasks.length}): {downstreamTasks.slice(0, 3).map((t) => `«${t.name}»`).join(", ")}
                          {downstreamTasks.length > 3 ? "..." : ""}
                        </Text>
                      )}
                    </Group>
                  </Stack>
                </Group>
              </Paper>
            )}

            {/* БЛОК 3: Сравнение 3 бизнес-стратегий выхода */}
            <Stack gap="xs">
              <Text fw={700} size="sm" c="dimmed">
                СТРАТЕГИИ ДЕЙСТВИЙ (ВЫБЕРИТЕ ДЛЯ СОГЛАСОВАНИЯ):
              </Text>
              <SimpleGrid cols={{ base: 1, md: 3 }} spacing="md">
                {/* Стратегия 1 */}
                <Card
                  withBorder
                  padding="md"
                  radius="md"
                  style={{
                    borderColor: selectedStrategy === "accept" ? "var(--mantine-color-blue-6)" : "var(--line)",
                    boxShadow: selectedStrategy === "accept" ? "0 0 0 2px var(--mantine-color-blue-5)" : undefined,
                  }}
                >
                  <Stack gap="xs" justify="space-between" h="100%">
                    <div>
                      <Badge color="red" variant="light" size="xs">
                        +{finishDeltaDays} дн. сдвиг
                      </Badge>
                      <Title order={5} mt={4}>
                        1. Принять перенос срока
                      </Title>
                      <Text size="xs" c="dimmed" mt={4}>
                        Сохранить весь объем задач, но сдвинуть сдачу и принять финансовый риск.
                      </Text>
                    </div>
                    <Paper p="xs" bg="var(--bg)" radius="sm">
                      <Text size="xs">
                        Новый финиш: <b>{shortDate(newFinishIso)}</b>
                      </Text>
                      <Text size="xs" c="red.7" fw={600}>
                        Штраф: {formatMoney(financialDamage)}
                      </Text>
                      <Text size="11px" c="dimmed">
                        100% задач проекта сохраняются
                      </Text>
                    </Paper>
                    <Button
                      size="xs"
                      variant={selectedStrategy === "accept" ? "filled" : "light"}
                      color={selectedStrategy === "accept" ? "blue" : "gray"}
                      onClick={() => setSelectedStrategy("accept")}
                    >
                      {selectedStrategy === "accept" ? "Выбрано" : "Выбрать этот вариант"}
                    </Button>
                  </Stack>
                </Card>

                {/* Стратегия 2 */}
                <Card
                  withBorder
                  padding="md"
                  radius="md"
                  style={{
                    borderColor: selectedStrategy === "descope" ? "var(--mantine-color-blue-6)" : "var(--line)",
                    boxShadow: selectedStrategy === "descope" ? "0 0 0 2px var(--mantine-color-blue-5)" : undefined,
                  }}
                >
                  <Stack gap="xs" justify="space-between" h="100%">
                    <div>
                      <Badge color="teal" variant="light" size="xs">
                        В срок к дедлайну!
                      </Badge>
                      <Title order={5} mt={4}>
                        2. Срезать скоуп (MVP в срок)
                      </Title>
                      <Text size="xs" c="dimmed" mt={4}>
                        Исключить второстепенные задачи с низким приоритетом, чтобы спасти дату релиза.
                      </Text>
                    </div>
                    <Paper p="xs" bg="var(--bg)" radius="sm">
                      <Text size="xs" c="teal.8" fw={700}>
                        Финиш: {shortDate(draft.deadline)} (в срок!)
                      </Text>
                      <Text size="xs" c="teal.8" fw={600}>
                        Штраф: 0 ₽ (экономия {formatMoney(financialDamage)})
                      </Text>
                      <Text size="11px" c="dimmed">
                        {descopeCandidates.length > 0
                          ? `Кандидаты на срез: ${descopeCandidates.slice(0, 2).map((t) => t.name).join(", ")}`
                          : "Требуется сократить объем задерживающейся задачи"}
                      </Text>
                    </Paper>
                    <Button
                      size="xs"
                      variant={selectedStrategy === "descope" ? "filled" : "light"}
                      color={selectedStrategy === "descope" ? "blue" : "gray"}
                      onClick={() => setSelectedStrategy("descope")}
                    >
                      {selectedStrategy === "descope" ? "Выбрано" : "Выбрать этот вариант"}
                    </Button>
                  </Stack>
                </Card>

                {/* Стратегия 3 */}
                <Card
                  withBorder
                  padding="md"
                  radius="md"
                  style={{
                    borderColor: selectedStrategy === "stage" ? "var(--mantine-color-blue-6)" : "var(--line)",
                    boxShadow: selectedStrategy === "stage" ? "0 0 0 2px var(--mantine-color-blue-5)" : undefined,
                  }}
                >
                  <Stack gap="xs" justify="space-between" h="100%">
                    <div>
                      <Badge color="blue" variant="light" size="xs">
                        Поэтапно (2 релиза)
                      </Badge>
                      <Title order={5} mt={4}>
                        3. Поэтапный запуск
                      </Title>
                      <Text size="xs" c="dimmed" mt={4}>
                        Запустить ядро в дедлайн, а задерживающийся модуль выпустить вторым этапом.
                      </Text>
                    </div>
                    <Paper p="xs" bg="var(--bg)" radius="sm">
                      <Text size="xs">
                        Релиз 1: <b>{shortDate(draft.deadline)}</b> (основа)
                      </Text>
                      <Text size="xs">
                        Релиз 2: <b>{shortDate(newFinishIso)}</b> (+доработка)
                      </Text>
                      <Text size="xs" c="teal.8" fw={600}>
                        Штраф заказчику: 0 ₽
                      </Text>
                    </Paper>
                    <Button
                      size="xs"
                      variant={selectedStrategy === "stage" ? "filled" : "light"}
                      color={selectedStrategy === "stage" ? "blue" : "gray"}
                      onClick={() => setSelectedStrategy("stage")}
                    >
                      {selectedStrategy === "stage" ? "Выбрано" : "Выбрать этот вариант"}
                    </Button>
                  </Stack>
                </Card>
              </SimpleGrid>
            </Stack>

            {/* БЛОК 4: Стресс-проверка устойчивости */}
            <Paper withBorder p="sm" radius="md">
              <Group justify="space-between">
                <div>
                  <Text size="xs" fw={700}>
                    ПРОВЕРКА НАДЕЖНОСТИ (STRESS-TEST)
                  </Text>
                  <Text size="xs" c="dimmed">
                    Что будет, если задержка задачи «{activeTask?.name}» вырастет еще сильнее?
                  </Text>
                </div>
                <Group gap="xs">
                  {[0, 2, 4, 7].map((offset) => (
                    <Button
                      key={offset}
                      size="xs"
                      variant={stressOffset === offset ? "filled" : "light"}
                      color={stressOffset === offset ? "red" : "gray"}
                      onClick={() => setStressOffset(offset)}
                    >
                      {offset === 0 ? "Базовая задержка" : `+${offset} дн. сбоя`}
                    </Button>
                  ))}
                </Group>
              </Group>
            </Paper>

            {/* БЛОК 5: Действия (Применить в проект + Письмо) */}
            <Group justify="space-between" mt="md">
              <Group gap="sm">
                <Button color="red" leftSection={<FileText size={16} />} onClick={() => setLetterOpened(true)}>
                  Сформировать письмо заказчику
                </Button>
                <Button variant="light" color="blue" leftSection={<Layers size={16} />} onClick={handleApplyToDraft}>
                  Применить как черновик в Гант
                </Button>
              </Group>
              <Button variant="default" onClick={onClose}>
                Закрыть
              </Button>
            </Group>
          </Stack>
        )}
      </Stack>

      {/* Модальное окно с письмом */}
      <Modal
        opened={letterOpened}
        onClose={() => setLetterOpened(false)}
        size="lg"
        title={
          <Group gap="xs">
            <Sparkles size={18} color="var(--mantine-color-red-6)" />
            <Text fw={700}>Служебное письмо для заказчика / руководства</Text>
          </Group>
        }
      >
        <Stack gap="md">
          <Text size="xs" c="dimmed">
            Письмо сформировано на основе реальных данных задачи «{activeTask?.name}» и графа проекта «{draft.name}»:
          </Text>

          <Paper withBorder p="md" radius="md" bg="var(--bg)">
            <Text size="xs" style={{ whiteSpace: "pre-wrap", fontFamily: "monospace" }}>
              {generateClientLetter()}
            </Text>
          </Paper>

          <Group justify="space-between">
            <CopyButton value={generateClientLetter()}>
              {({ copied, copy }) => (
                <Button color={copied ? "teal" : "red"} leftSection={copied ? <Check size={16} /> : <Copy size={16} />} onClick={copy}>
                  {copied ? "Текст скопирован!" : "Скопировать письмо в буфер"}
                </Button>
              )}
            </CopyButton>
            <Button variant="subtle" onClick={() => setLetterOpened(false)}>
              Закрыть
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Modal>
  );
}

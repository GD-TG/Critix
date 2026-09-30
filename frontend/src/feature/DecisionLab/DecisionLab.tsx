import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Badge,
  Button,
  Card,
  Checkbox,
  CopyButton,
  Divider,
  Group,
  Modal,
  NumberInput,
  Paper,
  SimpleGrid,
  Stack,
  Table,
  Text,
  TextInput,
  ThemeIcon,
  Title,
  Tooltip,
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
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Zap,
} from "lucide-react";
import { api } from "../../api";

export type Outcome = {
  id: string;
  name: string;
  required: boolean;
  needs_supplier: boolean;
  days: number;
};

export type Case = {
  title: string;
  start: string;
  deadline: string;
  supplier_due: string;
  delay_days: number;
  review_days: number;
  stress_days: number;
  extra_expense: number;
  loss_per_day: number;
  penalty_per_day: number;
  penalty_cap: number;
  phase_expense: number;
  outcomes: Outcome[];
};

export type Variant = {
  id: string;
  title: string;
  launch: string;
  late_days: number;
  included: string[];
  excluded: string[];
  deferred: string[];
  second_release: string | null;
  costs: {
    extra_expense: number;
    phase_expense: number;
    contractual_penalty: number;
    estimated_loss: number;
    total: number;
  };
  tolerance_days: number | null;
  tolerance_at_least: boolean;
  stress: { extra_days: number; launch: string; on_time: boolean; total: number }[];
};

export type Evaluation = {
  currency: string;
  variants: Variant[];
  baseline_finish: string;
  outcomes: { id: string; name: string; finish: string }[];
  assumptions: string[];
};

const formatMoney = (v: number) => `${v.toLocaleString("ru-RU")} ₽`;
const formatDate = (v: string) => (v ? v.split("-").reverse().join(".") : "—");

function fromToday(offsetDays: number) {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const PRESET_SITUATIONS = [
  {
    id: "supplier_delay",
    icon: Clock,
    title: "Подрядчик задерживает API",
    subtitle: "Поставка задерживается на 4 дня. Успеем ли к дедлайну?",
    init: (): Case => ({
      title: "Задержка поставки внешнего сервиса",
      start: fromToday(0),
      supplier_due: fromToday(7),
      deadline: fromToday(14),
      delay_days: 4,
      review_days: 1,
      stress_days: 10,
      extra_expense: 0,
      loss_per_day: 25000,
      penalty_per_day: 15000,
      penalty_cap: 500000,
      phase_expense: 30000,
      outcomes: [
        { id: "core", name: "Прием заказов и оформление клиентом (Core)", required: true, needs_supplier: true, days: 2 },
        { id: "payments", name: "Онлайн-оплата и фискализация", required: true, needs_supplier: true, days: 3 },
        { id: "reports", name: "Автоматический экспорт отчётности в 1С", required: false, needs_supplier: true, days: 5 },
      ],
    }),
  },
  {
    id: "deadline_moved",
    icon: Calendar,
    title: "Дедлайн перенесен на раньше",
    subtitle: "Заказчик требует запуск на 5 дней быстрее. Что можно отложить?",
    init: (): Case => ({
      title: "Ускоренный релиз под рекламную кампанию",
      start: fromToday(0),
      supplier_due: fromToday(5),
      deadline: fromToday(9),
      delay_days: 0,
      review_days: 1,
      stress_days: 10,
      extra_expense: 0,
      loss_per_day: 40000,
      penalty_per_day: 20000,
      penalty_cap: 300000,
      phase_expense: 20000,
      outcomes: [
        { id: "landing", name: "Основной сайт и форма заявок", required: true, needs_supplier: false, days: 3 },
        { id: "auth", name: "Личный кабинет пользователя", required: true, needs_supplier: true, days: 3 },
        { id: "analytics", name: "Дашборд сквозной аналитики", required: false, needs_supplier: true, days: 4 },
      ],
    }),
  },
  {
    id: "rework_bugs",
    icon: AlertTriangle,
    title: "Не пройдена приёмка / Баги",
    subtitle: "Найдено 12 дефектов, требуется +3 дня доработок.",
    init: (): Case => ({
      title: "Доработки после первичного тестирования",
      start: fromToday(0),
      supplier_due: fromToday(6),
      deadline: fromToday(13),
      delay_days: 3,
      review_days: 2,
      stress_days: 10,
      extra_expense: 20000,
      loss_per_day: 30000,
      penalty_per_day: 10000,
      penalty_cap: 200000,
      phase_expense: 25000,
      outcomes: [
        { id: "fixes", name: "Устранение критических уязвимостей", required: true, needs_supplier: true, days: 2 },
        { id: "ui_polish", name: "Исправление верстки и адаптива", required: true, needs_supplier: false, days: 2 },
        { id: "dark_theme", name: "Темная тема и анимации интерфейса", required: false, needs_supplier: false, days: 4 },
      ],
    }),
  },
];

export function DecisionLab({ opened, onClose }: { opened: boolean; onClose: () => void }) {
  const [activeSituation, setActiveSituation] = useState<string>("supplier_delay");
  const [params, setParams] = useState<Case>(() => PRESET_SITUATIONS[0].init());
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const [selectedVariantId, setSelectedVariantId] = useState<string>("minimum");
  const [stressOffset, setStressOffset] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [letterOpened, setLetterOpened] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const reqId = useRef(0);

  const calculate = async (c: Case) => {
    const currentTicket = ++reqId.current;
    setLoading(true);
    setErrorMessage("");
    try {
      const res = await api<Evaluation>("/decision-lab/evaluate", "POST", c);
      if (currentTicket === reqId.current) {
        setEvaluation(res);
        if (res.variants.length > 0 && !res.variants.some((v) => v.id === selectedVariantId)) {
          setSelectedVariantId(res.variants[0].id);
        }
      }
    } catch (err: unknown) {
      if (currentTicket === reqId.current) {
        setErrorMessage(err instanceof Error ? err.message : "Ошибка расчёта вариантов");
      }
    } finally {
      if (currentTicket === reqId.current) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    if (opened) {
      void calculate(params);
    }
  }, [opened]);

  const selectPreset = (situationId: string) => {
    setActiveSituation(situationId);
    const item = PRESET_SITUATIONS.find((s) => s.id === situationId);
    if (item) {
      const freshCase = item.init();
      setParams(freshCase);
      setStressOffset(0);
      void calculate(freshCase);
    }
  };

  const updateParam = <K extends keyof Case>(key: K, value: Case[K]) => {
    const updated = { ...params, [key]: value };
    setParams(updated);
    void calculate(updated);
  };

  const toggleOutcomeRequired = (id: string, required: boolean) => {
    const outcomes = params.outcomes.map((o) => (o.id === id ? { ...o, required } : o));
    updateParam("outcomes", outcomes);
  };

  const selectedVariant = evaluation?.variants.find((v) => v.id === selectedVariantId) || evaluation?.variants[0];

  // Генератор делового письма заказчику
  const generateClientLetter = () => {
    if (!evaluation || !selectedVariant) return "";
    const deadlineFormatted = formatDate(params.deadline);
    const newDateFormatted = formatDate(selectedVariant.launch);
    const penaltyTotal = formatMoney(params.delay_days * (params.penalty_per_day + params.loss_per_day));

    if (selectedVariant.id === "minimum" || selectedVariant.id === "phased") {
      const cutFeatures = selectedVariant.excluded.length > 0 ? selectedVariant.excluded : selectedVariant.deferred;
      return `Уважаемый партнер!

В связи с задержкой внешних поставок/API на ${params.delay_days} дн., мы провели оперативный аудит сценариев сохранения дедлайна проекта.

Чтобы не срывать критическую дату запуска ${deadlineFormatted} и исключить договорные финансовые риски (${penaltyTotal}), предлагаем согласовать ${selectedVariant.title.toLowerCase()}:

1. Запуск ${deadlineFormatted} (в срок!):
   Включает ключевой функционал:
   • ${selectedVariant.included.join("\n   • ")}

2. ${selectedVariant.id === "phased" ? `Второй релиз (${formatDate(selectedVariant.second_release || "")}):` : "Откладывается в бэклог:"}
   • ${cutFeatures.join("\n   • ")}

Данное решение сохраняет бизнес-дедлайн и обеспечивает запас устойчивости до ${selectedVariant.tolerance_days ?? 0} дн. на случай непредвиденных сбоев.

Просим согласовать предложенный план выпуска.
С уважением,
Руководитель проекта Critix`;
    }

    return `Уважаемый партнер!

Уведомляем о необходимости согласования сдвига даты запуска проекта в связи с задержкой поставщика на ${params.delay_days} дн.

• Новая планируемая дата запуска: ${newDateFormatted} (сдвиг относительно дедлайна ${deadlineFormatted}: +${selectedVariant.late_days} дн.).
• Состав релиза: сохраняется 100% заявленного функционала:
  • ${selectedVariant.included.join("\n  • ")}
• Оценка финансовых потерь и штрафных санкций: ${formatMoney(selectedVariant.costs.total)}.

Просим подтвердить перенос даты релиза.
С уважением,
Команда проекта Critix`;
  };

  const costPerDay = params.penalty_per_day + params.loss_per_day;

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      size="85rem"
      title={
        <Group gap="xs">
          <ThemeIcon color="red" size="md" radius="md">
            <Coins size={18} />
          </ThemeIcon>
          <Title order={3} fw={700}>
            Пульт решений: Срок · Деньги · Состав запуска
          </Title>
          <Badge variant="light" color="blue">
            Executive What-If
          </Badge>
        </Group>
      }
      styles={{
        header: { borderBottom: "1px solid var(--line)" },
        body: { padding: "1.5rem" },
      }}
    >
      <Stack gap="xl">
        {/* БЛОК 1: Выбор типовой ситуации */}
        <Stack gap="xs">
          <Text fw={600} size="sm" c="dimmed">
            1. ЧТО СЛУЧИЛОСЬ В ПРОЕКТЕ? (ВЫБЕРИТЕ СИТУАЦИЮ В 1 КЛИК)
          </Text>
          <SimpleGrid cols={{ base: 1, md: 3 }} spacing="md">
            {PRESET_SITUATIONS.map((sit) => {
              const Icon = sit.icon;
              const isSelected = activeSituation === sit.id;
              return (
                <Card
                  key={sit.id}
                  withBorder
                  padding="md"
                  radius="md"
                  onClick={() => selectPreset(sit.id)}
                  style={{
                    cursor: "pointer",
                    borderColor: isSelected ? "var(--mantine-color-red-6)" : "var(--line)",
                    backgroundColor: isSelected ? "var(--mantine-color-red-0)" : "var(--surface)",
                    transition: "all 0.15s ease",
                  }}
                >
                  <Group align="flex-start" wrap="nowrap">
                    <ThemeIcon color={isSelected ? "red" : "gray"} variant={isSelected ? "filled" : "light"} size="lg" radius="md">
                      <Icon size={20} />
                    </ThemeIcon>
                    <Stack gap={4}>
                      <Text fw={700} size="sm" c={isSelected ? "red.8" : "inherit"}>
                        {sit.title}
                      </Text>
                      <Text size="xs" c="dimmed">
                        {sit.subtitle}
                      </Text>
                    </Stack>
                  </Group>
                </Card>
              );
            })}
          </SimpleGrid>
        </Stack>

        {/* БЛОК 2: Базовые параметры (простые и понятные) */}
        <Paper withBorder p="md" radius="md" bg="var(--bg)">
          <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="lg">
            <Stack gap={4}>
              <Text size="xs" fw={600} c="dimmed">
                ДНЕЙ ЗАДЕРЖКИ
              </Text>
              <NumberInput
                value={params.delay_days}
                min={0}
                max={60}
                size="sm"
                allowDecimal={false}
                onChange={(val) => updateParam("delay_days", Number(val) || 0)}
              />
              <Text size="xs" c="dimmed">
                На сколько дней опаздывает поставка/фикс
              </Text>
            </Stack>

            <Stack gap={4}>
              <Text size="xs" fw={600} c="dimmed">
                ЦЕНА 1 ДНЯ ПРОСТОЯ (ШТРАФ + УБЫТОК)
              </Text>
              <NumberInput
                value={costPerDay}
                min={0}
                step={5000}
                size="sm"
                allowDecimal={false}
                onChange={(val) => {
                  const total = Number(val) || 0;
                  const penalty = Math.round(total * 0.4);
                  const loss = total - penalty;
                  const updated = { ...params, penalty_per_day: penalty, loss_per_day: loss };
                  setParams(updated);
                  void calculate(updated);
                }}
              />
              <Text size="xs" c="dimmed">
                Штраф заказчику + простой команды за сутки
              </Text>
            </Stack>

            <Stack gap={4}>
              <Text size="xs" fw={600} c="dimmed">
                ЦЕЛЕВОЙ ДЕДЛАЙН ЗАПУСКА
              </Text>
              <TextInput
                type="date"
                size="sm"
                value={params.deadline}
                onChange={(e) => updateParam("deadline", e.currentTarget.value)}
              />
              <Text size="xs" c="dimmed">
                Дата, за нарушение которой начисляются штрафы
              </Text>
            </Stack>
          </SimpleGrid>

          <Divider my="md" />

          {/* Состав возможностей релиза */}
          <Stack gap="xs">
            <Group justify="space-between">
              <Text size="xs" fw={600} c="dimmed">
                СОСТАВ РЕЛИЗА (ОТМЕТЬТЕ, ЧТО КРИТИЧНО ДЛЯ ПЕРВОГО ЗАПУСКА):
              </Text>
              <Text size="xs" c="dimmed">
                Снятие галочки позволяет выпустить MVP в срок
              </Text>
            </Group>
            <SimpleGrid cols={{ base: 1, md: 3 }} spacing="sm">
              {params.outcomes.map((o) => (
                <Paper key={o.id} withBorder p="xs" radius="sm" bg="var(--surface)">
                  <Group justify="space-between" wrap="nowrap">
                    <Stack gap={2} style={{ flex: 1 }}>
                      <Text size="xs" fw={600} lineClamp={1}>
                        {o.name}
                      </Text>
                      <Text size="11px" c="dimmed">
                        Трудоемкость: {o.days} дн. {o.needs_supplier ? "· ждет API" : "· своя разработка"}
                      </Text>
                    </Stack>
                    <Checkbox
                      size="xs"
                      color="red"
                      label="Обязательно"
                      checked={o.required}
                      onChange={(e) => toggleOutcomeRequired(o.id, e.currentTarget.checked)}
                    />
                  </Group>
                </Paper>
              ))}
            </SimpleGrid>
          </Stack>
        </Paper>

        {errorMessage && (
          <Alert color="red" icon={<AlertTriangle size={18} />}>
            {errorMessage}
          </Alert>
        )}

        {/* БЛОК 3: Три стратегии выхода из ситуации */}
        {evaluation && (
          <Stack gap="md">
            <Group justify="space-between" align="baseline">
              <Title order={4}>Сравнение 3 вариантов решения:</Title>
              <Text size="xs" c="dimmed">
                Выберите стратегию, чтобы сформировать служебную записку или письмо заказчику
              </Text>
            </Group>

            <SimpleGrid cols={{ base: 1, md: 3 }} spacing="md">
              {evaluation.variants.map((v) => {
                const isSelected = selectedVariantId === v.id;
                const isLate = v.late_days > 0;
                const isPhased = v.id === "phased";
                const isMin = v.id === "minimum";

                return (
                  <Card
                    key={v.id}
                    withBorder
                    padding="lg"
                    radius="md"
                    style={{
                      borderColor: isSelected ? "var(--mantine-color-blue-6)" : "var(--line)",
                      boxShadow: isSelected ? "0 0 0 2px var(--mantine-color-blue-5)" : undefined,
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                    }}
                  >
                    <Stack gap="sm">
                      <Group justify="space-between">
                        <Badge color={isLate ? "red" : isPhased ? "blue" : "teal"} variant="light" size="sm">
                          {isLate ? `Опоздание на ${v.late_days} дн.` : "В срок к дедлайну!"}
                        </Badge>
                        {v.tolerance_days !== null && v.tolerance_days > 0 && (
                          <Badge color="green" variant="dot" size="sm">
                            Запас: +{v.tolerance_days} дн.
                          </Badge>
                        )}
                      </Group>

                      <Title order={4}>{v.title}</Title>

                      <Paper p="xs" radius="sm" bg="var(--bg)">
                        <Group justify="space-between">
                          <Text size="xs" c="dimmed">
                            Дата запуска:
                          </Text>
                          <Text size="sm" fw={700} c={isLate ? "red.7" : "green.7"}>
                            {formatDate(v.launch)}
                          </Text>
                        </Group>
                        <Group justify="space-between" mt={4}>
                          <Text size="xs" c="dimmed">
                            Финансовый убыток:
                          </Text>
                          <Text size="sm" fw={700}>
                            {formatMoney(v.costs.total)}
                          </Text>
                        </Group>
                      </Paper>

                      <Stack gap={4}>
                        <Text size="xs" fw={600}>
                          Состав первого запуска:
                        </Text>
                        {v.included.map((item) => (
                          <Text key={item} size="xs" c="dimmed">
                            • {item}
                          </Text>
                        ))}
                      </Stack>

                      {v.excluded.length > 0 && (
                        <Alert color="orange" p="xs" radius="sm">
                          <Text size="xs" fw={600}>
                            Жертвуем (не войдет в запуск):
                          </Text>
                          <Text size="xs">{v.excluded.join("; ")}</Text>
                        </Alert>
                      )}

                      {v.deferred.length > 0 && (
                        <Alert color="blue" p="xs" radius="sm">
                          <Text size="xs" fw={600}>
                            2-й этап ({formatDate(v.second_release || "")}):
                          </Text>
                          <Text size="xs">{v.deferred.join("; ")}</Text>
                        </Alert>
                      )}
                    </Stack>

                    <Button
                      mt="md"
                      fullWidth
                      variant={isSelected ? "filled" : "light"}
                      color={isSelected ? "blue" : "gray"}
                      onClick={() => setSelectedVariantId(v.id)}
                    >
                      {isSelected ? "Выбрано для решения" : "Выбрать это решение"}
                    </Button>
                  </Card>
                );
              })}
            </SimpleGrid>

            {/* БЛОК 4: Стресс-проверка устойчивости */}
            <Paper withBorder p="md" radius="md">
              <Group justify="space-between" align="center" wrap="wrap">
                <Stack gap={2}>
                  <Group gap="xs">
                    <ShieldCheck size={18} color="var(--mantine-color-green-6)" />
                    <Text fw={700} size="sm">
                      Проверка устойчивости решения (Stress-Tolerance)
                    </Text>
                  </Group>
                  <Text size="xs" c="dimmed">
                    Показывает, выдержит ли план, если подрядчик задержится еще на несколько дней
                  </Text>
                </Stack>
                <Group gap="xs">
                  <Text size="xs" fw={600}>
                    Дополнительный сбой:
                  </Text>
                  {[0, 2, 4, 7].map((days) => (
                    <Button
                      key={days}
                      size="xs"
                      variant={stressOffset === days ? "filled" : "light"}
                      color={stressOffset === days ? "red" : "gray"}
                      onClick={() => setStressOffset(days)}
                    >
                      {days === 0 ? "Текущие условия" : `+${days} дн.`}
                    </Button>
                  ))}
                </Group>
              </Group>

              {selectedVariant && (
                <Table mt="md" withTableBorder withColumnBorders>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Вариант решения</Table.Th>
                      <Table.Th>Дата релиза при задержке +{stressOffset} дн.</Table.Th>
                      <Table.Th>Дедлайн {formatDate(params.deadline)}</Table.Th>
                      <Table.Th>Штрафы и потери</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {evaluation.variants.map((v) => {
                      const item = v.stress[stressOffset] || v.stress[0];
                      return (
                        <Table.Tr key={v.id} style={{ fontWeight: v.id === selectedVariantId ? 600 : 400 }}>
                          <Table.Td>{v.title}</Table.Td>
                          <Table.Td>{formatDate(item.launch)}</Table.Td>
                          <Table.Td>
                            {item.on_time ? (
                              <Badge color="green" size="sm">
                                Сохранен
                              </Badge>
                            ) : (
                              <Badge color="red" size="sm">
                                Нарушен
                              </Badge>
                            )}
                          </Table.Td>
                          <Table.Td>{formatMoney(item.total)}</Table.Td>
                        </Table.Tr>
                      );
                    })}
                  </Table.Tbody>
                </Table>
              )}
            </Paper>

            {/* БЛОК 5: Киллер-фича — письмо заказчику */}
            <Group justify="space-between" mt="md">
              <Button
                size="md"
                color="red"
                leftSection={<FileText size={18} />}
                onClick={() => setLetterOpened(true)}
              >
                Сформировать письмо заказчику / руководству
              </Button>
              <Button variant="default" size="md" onClick={onClose}>
                Закрыть пульт
              </Button>
            </Group>
          </Stack>
        )}
      </Stack>

      {/* Модальное окно с готовым письмом */}
      <Modal
        opened={letterOpened}
        onClose={() => setLetterOpened(false)}
        size="lg"
        title={
          <Group gap="xs">
            <Sparkles size={18} color="var(--mantine-color-red-6)" />
            <Text fw={700}>Согласование решения с заказчиком / инвестором</Text>
          </Group>
        }
      >
        <Stack gap="md">
          <Text size="sm" c="dimmed">
            Готовый текст служебного письма с аргументацией, расчетом финансовых рисков и предложением оптимального варианта:
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
                  {copied ? "Скопировано в буфер!" : "Скопировать текст письма"}
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

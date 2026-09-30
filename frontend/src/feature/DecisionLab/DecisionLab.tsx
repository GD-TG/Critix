import { useRef, useState } from "react";
import { Alert, Badge, Button, Card, Checkbox, Group, Modal, NumberInput, SimpleGrid, Stack, Table, Text, TextInput, Title } from "@mantine/core";
import { api } from "../../api";
type Outcome = { id: string; name: string; required: boolean; needs_supplier: boolean; days: number };
type Case = { title: string; start: string; deadline: string; supplier_due: string; delay_days: number; review_days: number; stress_days: number; extra_expense: number; loss_per_day: number; penalty_per_day: number; penalty_cap: number; phase_expense: number; outcomes: Outcome[] };
type Variant = { id: string; title: string; launch: string; late_days: number; included: string[]; excluded: string[]; deferred: string[]; second_release: string | null; costs: { extra_expense: number; phase_expense: number; contractual_penalty: number; estimated_loss: number; total: number }; tolerance_days: number | null; tolerance_at_least: boolean; stress: { extra_days: number; launch: string; on_time: boolean; total: number }[] };
type Evaluation = { variants: Variant[]; baseline_finish: string; assumptions: string[] };
const money = (v: number) => `${v.toLocaleString("ru-RU")} ₽`;
const date = (v: string) => v.split("-").reverse().join(".");
const cases = [
  { title: "Подрядчик сдвигает срок", description: "Обещанный результат придёт позже. Ждать всё или запускаться частями?", question: "На сколько дней задержится подрядчик?", field: "delay_days", value: 4 },
  { title: "Запуск нужен раньше", description: "Дедлайн приблизился. Что можно сохранить в первом выпуске?", question: "Сколько дней осталось до запуска?", field: "deadline", value: 12 },
  { title: "Результат вернули на доработку", description: "Первая проверка не пройдена. Как исправления повлияют на запуск?", question: "Сколько дней займёт доработка?", field: "delay_days", value: 3 },
] as const;
function fromToday(days: number) {
  const value = new Date(); value.setHours(12, 0, 0, 0); value.setDate(value.getDate() + days);
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}
function casePreset(index: number): Case {
  const value = preset();
  value.title = cases[index].title;
  if (index === 1) { value.delay_days = 0; value.deadline = fromToday(12); }
  if (index === 2) { value.delay_days = 3; value.review_days = 2; }
  return value;
}
function preset(): Case {
  const day = (offset: number) => { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + offset); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
  return { title: "Подрядчик задерживает запуск портала", start: day(0), supplier_due: day(7), deadline: day(14), delay_days: 4, review_days: 1, stress_days: 14, extra_expense: 50000, loss_per_day: 30000, penalty_per_day: 10000, penalty_cap: 100000, phase_expense: 25000,
    outcomes: [{ id: "orders", name: "Клиенты могут оформлять заказы", required: true, needs_supplier: true, days: 2 }, { id: "reports", name: "Заказчик получает автоматическую отчётность", required: false, needs_supplier: true, days: 6 }, { id: "support", name: "Поддержка готова принимать обращения", required: true, needs_supplier: false, days: 5 }] };
}
export function DecisionLab({ opened, onClose }: { opened: boolean; onClose: () => void }) {
  const [input, setInput] = useState<Case>(preset);
  const [result, setResult] = useState<Evaluation | null>(null);
  const [choice, setChoice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [stress, setStress] = useState(0);
  const [selectedCase, setSelectedCase] = useState<number | null>(null);
  const quickValue = selectedCase === 1 ? Math.round((Date.parse(input.deadline) - Date.parse(fromToday(0))) / 86400000) : input.delay_days;
  const revision = useRef(0);
  const change = (next: Case) => { revision.current++; setInput(next); setResult(null); setChoice(""); setError(""); setBusy(false); };
  const update = (key: keyof Case, value: unknown) => change({ ...input, [key]: value });
  const numeric = (key: keyof Case, label: string, max = 1000000000) => <NumberInput key={key} label={label} value={input[key] as number} min={0} max={max} allowDecimal={false} allowNegative={false} onChange={v => update(key, Number(v) || 0)} />;
  const outcome = (id: string, patch: Partial<Outcome>) => update("outcomes", input.outcomes.map(o => o.id === id ? { ...o, ...patch } : o));
  async function calculate(source = input) {
    const ticket = revision.current;
    setBusy(true); setError(""); setResult(null); setChoice("");
    try { const value = await api<Evaluation>("/decision-lab/evaluate", "POST", source); if (ticket === revision.current) { setResult(value); setStress(0); } }
    catch (e) { if (ticket === revision.current) setError(e instanceof Error ? e.message : "Не удалось выполнить расчёт"); }
    finally { if (ticket === revision.current) setBusy(false); }
  }
  function openCase(index: number) {
    const source = casePreset(index);
    change(source); setSelectedCase(index);
    void calculate(source);
  }
  function download() {
    const url = URL.createObjectURL(new Blob([JSON.stringify({ inputs: input, calculation: result, selected_variant: choice, recorded_at: new Date().toISOString(), status: "draft_not_approved" }, null, 2)], { type: "application/json" }));
    const link = document.createElement("a"); link.href = url; link.download = "critix-decision.json"; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <Modal opened={opened} onClose={onClose} fullScreen title="Готовые ситуации"><Stack maw={1180} mx="auto" p="md" gap="lg">
    {selectedCase === null ? <Stack gap="xl" py="xl">
      <div><Badge variant="light">Без настройки проекта</Badge><Title order={1} mt="sm">Что произошло?</Title><Text size="lg" c="dimmed" mt="sm">Выберите ситуацию. Покажем, что будет со сроком, деньгами и результатом — и какие есть варианты.</Text></div>
      <SimpleGrid cols={{ base: 1, md: 3 }}>{cases.map((item, index) => <Card key={item.title} withBorder padding="xl" radius="lg"><Stack h="100%" justify="space-between"><div><Text c="dimmed" size="sm">Ситуация {index + 1}</Text><Title order={3} mt="sm">{item.title}</Title><Text mt="md">{item.description}</Text></div><Button mt="lg" onClick={() => openCase(index)}>Посмотреть варианты</Button></Stack></Card>)}</SimpleGrid>
      <Text c="dimmed">Начнём с готового примера: запуск сервиса через две недели. Основная возможность — принимать заказы, дополнительная — получать отчётность. Вводить задачи и сотрудников не нужно.</Text>
    </Stack> : <>
    <Group justify="space-between"><Button variant="subtle" onClick={() => { revision.current++; setSelectedCase(null); setResult(null); setBusy(false); }}>← Другие ситуации</Button><Badge variant="light">Учебный пример · можно изменить условия</Badge></Group>
    <div><Title order={2}>{cases[selectedCase].title}</Title><Text c="dimmed" mt="xs">{cases[selectedCase].description}</Text></div>
    <Card withBorder padding="lg"><Group align="end" justify="space-between">
      <NumberInput disabled={busy} label={cases[selectedCase].question} value={Number.isFinite(quickValue) ? quickValue : 0} min={selectedCase === 1 ? 7 : 0} max={365} allowDecimal={false} onChange={v => { const n = Number(v) || 0; change({ ...input, ...(selectedCase === 1 ? { deadline: fromToday(n) } : { delay_days: n }) }); }} />
      <Text size="sm">Цель: запуск {input.deadline ? date(input.deadline) : "дата не задана"}.<br />Обязательных результатов: {input.outcomes.filter(o => o.required).length}. Можно отложить: {input.outcomes.filter(o => !o.required).length}.</Text>
      <Button loading={busy} onClick={() => calculate()}>Показать последствия</Button>
    </Group></Card>
    <Text size="sm" c="dimmed">Все суммы — условия примера, не данные вашего проекта. Сроки считаются в календарных днях. Текущий проект не изменяется.</Text>
    {error && <Alert color="red" role="alert">{error}</Alert>}
    {busy && <Text role="status">Сравниваем варианты…</Text>}
    <details><summary style={{ cursor: "pointer" }}>Уточнить расчёт: результаты, даты и деньги</summary><Stack mt="md">
    <Card withBorder><Stack><Title order={3}>1. Ситуация и ограничения</Title>
      <TextInput label="Что запускаем" value={input.title} maxLength={160} onChange={e => update("title", e.currentTarget.value)} />
      <SimpleGrid cols={{ base: 1, sm: 3 }}>{([["start", "Начало"], ["supplier_due", "Обещанная поставка"], ["deadline", "Крайний срок запуска"]] as const).map(([key, label]) => <TextInput key={key} type="date" label={label} value={input[key]} onChange={e => update(key, e.currentTarget.value)} />)}</SimpleGrid>
      <SimpleGrid cols={{ base: 1, sm: 3 }}>{numeric("delay_days", "Задержка подрядчика, дней", 365)}{numeric("review_days", "Приёмка, дней", 30)}{numeric("stress_days", "Дополнительная задержка для проверки (1–30)", 30)}</SimpleGrid>
    </Stack></Card>
    <Card withBorder><Stack><Title order={3}>2. Что должен получить заказчик</Title><Text size="sm" c="dimmed">Обязательные результаты входят во все варианты. Для зависимых результатов длительность считается после приёмки, для независимых — от начала проекта.</Text>
      {input.outcomes.map(o => <Card key={o.id} withBorder padding="sm"><Stack gap="xs"><Group align="end"><TextInput style={{ flex: 1 }} label="Результат для заказчика" value={o.name} maxLength={160} onChange={e => outcome(o.id, { name: e.currentTarget.value })} /><NumberInput label="Длительность, дней" w={170} value={o.days} min={0} max={365} allowDecimal={false} onChange={v => outcome(o.id, { days: Number(v) || 0 })} /></Group>
        <Group><Checkbox label="Обязателен для запуска" checked={o.required} onChange={e => outcome(o.id, { required: e.currentTarget.checked })} /><Checkbox label="Ждёт поставку подрядчика" checked={o.needs_supplier} onChange={e => outcome(o.id, { needs_supplier: e.currentTarget.checked })} /><Button variant="subtle" color="red" size="xs" disabled={input.outcomes.length === 1} onClick={() => update("outcomes", input.outcomes.filter(x => x.id !== o.id))}>Удалить результат</Button></Group>
      </Stack></Card>)}
      <Button variant="light" disabled={input.outcomes.length >= 30} onClick={() => update("outcomes", [...input.outcomes, { id: crypto.randomUUID(), name: "Новый результат", required: false, needs_supplier: true, days: 1 }])}>Добавить результат</Button>
    </Stack></Card>
    <Card withBorder><Stack><Title order={3}>3. Финансовые условия, ₽</Title><Text size="sm" c="dimmed">Дополнительные расходы относительно исходного плана. Штраф — выплата вашей стороны за задержку первого выпуска; лимит 0 отключает штраф. Подтвердите, что сокращённый запуск выполняет условия договора.</Text>
      <SimpleGrid cols={{ base: 1, sm: 2 }}>{numeric("extra_expense", "Дополнительные расходы во всех вариантах")}{numeric("phase_expense", "Доплата за отдельный второй выпуск")}{numeric("penalty_per_day", "Штраф за день просрочки")}{numeric("penalty_cap", "Лимит штрафа")}{numeric("loss_per_day", "Оценка потерь за день задержки запуска")}</SimpleGrid>
      <Text size="sm">Потери от исключённых возможностей не включены: сравнивайте состав результата, а не только сумму.</Text>
    </Stack></Card>
    <Button loading={busy} onClick={() => calculate()}>Пересчитать с моими условиями</Button>
    </Stack></details>
    {result && <Stack gap="lg" aria-live="polite"><Title order={3}>Что можно сделать</Title>
      <Alert color={result.variants[0].late_days ? "orange" : "teal"} title={result.variants[0].late_days ? `Если сохранить всё, запуск опоздает на ${result.variants[0].late_days} дн.` : "Полный результат укладывается в срок"}>{result.variants.some(v => v.id !== "full" && v.late_days === 0) ? "Чтобы сохранить дату, можно выпустить обязательную часть. Ниже — что вы получите и чем придётся пожертвовать." : "Сравните варианты ниже: стоимость сама по себе не определяет лучшее решение."}</Alert>
      <SimpleGrid cols={{ base: 1, md: 3 }}>{result.variants.map(v => <Card key={v.id} withBorder style={{ borderColor: choice === v.id ? "var(--mantine-color-blue-6)" : undefined }}><Stack>
        <Title order={4}>{{full: "Дождаться всего", minimum: "Убрать необязательное", phased: "Запуститься частями"}[v.id] || v.title}</Title><Badge color={v.late_days ? "red" : "teal"}>{v.late_days ? `Позже на ${v.late_days} дн.` : "В пределах срока"}</Badge><Text fw={700} size="xl">{date(v.launch)}</Text><Text fw={600}>Расходы и возможные потери: {money(v.costs.total)}</Text>
        <details><summary>Из чего складывается сумма</summary><Text size="sm">Расходы: {money(v.costs.extra_expense + v.costs.phase_expense)}<br />Штраф: {money(v.costs.contractual_penalty)}<br />Оценка потерь: {money(v.costs.estimated_loss)}</Text></details>
        <Text size="sm"><b>К запуску:</b> {v.included.join("; ")}</Text>
        {!!v.excluded.length && <Text size="sm" c="orange"><b>Исключаем:</b> {v.excluded.join("; ")}. Срок их выпуска не обещан.</Text>}
        {!!v.deferred.length && <Text size="sm"><b>Второй выпуск {date(v.second_release!)}:</b> {v.deferred.join("; ")}</Text>}
        <Text size="sm">{v.tolerance_days === null ? "Уже не выдерживает дедлайн" : `Запас к дополнительной задержке: ${v.tolerance_at_least ? "не менее " : ""}${v.tolerance_days} дн.`}</Text>
        <Button variant={choice === v.id ? "filled" : "light"} onClick={() => setChoice(v.id)}>{choice === v.id ? "Выбран для обсуждения" : "Выбрать для обсуждения"}</Button>
      </Stack></Card>)}</SimpleGrid>
      <Card withBorder><Stack><Title order={3}>А если подрядчик задержится ещё?</Title><Group>{[0, 1, 3, 7].filter(n => n <= input.stress_days).map(n => <Button key={n} variant={stress === n ? "filled" : "light"} onClick={() => setStress(n)}>{n === 0 ? "Как сейчас" : `Ещё ${n} дн.`}</Button>)}</Group>
        <Table.ScrollContainer minWidth={550}><Table><Table.Thead><Table.Tr><Table.Th>Вариант</Table.Th><Table.Th>Первый выпуск</Table.Th><Table.Th>Дедлайн</Table.Th><Table.Th>Расходы + оценка потерь</Table.Th></Table.Tr></Table.Thead><Table.Tbody>{result.variants.map(v => { const s = v.stress[stress]; return <Table.Tr key={v.id}><Table.Td>{v.title}</Table.Td><Table.Td>{date(s.launch)}</Table.Td><Table.Td>{s.on_time ? "Сохранён" : "Нарушен"}</Table.Td><Table.Td>{money(s.total)}</Table.Td></Table.Tr>; })}</Table.Tbody></Table></Table.ScrollContainer>
      </Stack></Card>
      <details><summary>Допущения и границы расчёта</summary><Stack mt="sm">{result.assumptions.map(a => <Text key={a} size="sm">{a}</Text>)}</Stack></details>
      <Group><Button disabled={!choice} onClick={download}>Скачать выбранное решение и расчёт</Button><Text size="sm" c="dimmed">Черновик для обсуждения. Не является согласованием и не изменяет проект.</Text></Group>
    </Stack>}
    </>}
  </Stack></Modal>;
}

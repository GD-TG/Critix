import {
  Alert,
  Badge,
  Button,
  Card,
  Divider,
  Group,
  Loader,
  Modal,
  Paper,
  Radio,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Calendar,
  CheckCircle2,
  Clock,
  Package,
  RotateCcw,
  ShieldCheck,
  Truck,
  Users,
} from "lucide-react";
import { useDeliveriesModal } from "./useDeliveriesModal";
import { formatShortDate, getZone } from "@/shared";

export function DeliveriesModal() {
  const {
    opened,
    closeModal,
    loadingCases,
    deliveryCases,
    selectedDelivery,
    selectedAction,
    expectedDate,
    setExpectedDate,
    reason,
    setReason,
    loadingPreview,
    previewData,
    selectedDecision,
    setSelectedDecision,
    decisionOwner,
    setDecisionOwner,
    isApplying,
    selectDeliveryAndAction,
    resetAction,
    handleComputePreview,
    handleApplyDecision,
    draft,
    saved,
  } = useDeliveriesModal();

  const zone = getZone(draft, saved);
  const shortDate = (iso?: string | null) => (iso ? formatShortDate(iso, zone) : "—");

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "waiting":
        return <Badge color="blue" variant="light">Ожидание передачи</Badge>;
      case "delivered":
        return <Badge color="orange" variant="light">Передано на приёмку</Badge>;
      case "rework":
        return <Badge color="red" variant="light">На доработке</Badge>;
      case "accepted":
        return <Badge color="teal" variant="light">Принято</Badge>;
      default:
        return <Badge color="gray">{status}</Badge>;
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={closeModal}
      title={
        <Group gap="xs">
          <Truck size={18} color="var(--mantine-color-blue-6)" />
          <Text fw={700} size="md">
            Поставки подрядчиков и решения по выпуску
          </Text>
        </Group>
      }
      size="xl"
      centered
    >
      <Stack gap="md">
        <Text size="xs" c="dimmed">
          Математическая модель связей проекта с внешними поставками. Движок отслеживает обещанные сроки,
          календарные дни приёмки и рассчитывает сценарные варианты (сохранение полного объёма vs исключение необязательных работ для защиты дедлайна).
        </Text>

        {loadingCases ? (
          <Group justify="center" p="xl">
            <Loader size="sm" />
            <Text size="sm">Загрузка данных по поставкам...</Text>
          </Group>
        ) : deliveryCases.length === 0 ? (
          <Alert color="blue" icon={<Package size={16} />}>
            В текущем проекте нет зарегистрированных внешних поставок.
            Чтобы протестировать сценарий поставок с переносом API и исключением отчёта, загрузите демо-проект «Пилот с внешним подрядчиком».
          </Alert>
        ) : (
          <Stack gap="sm">
            {deliveryCases.map((d) => (
              <Card key={d.delivery_id} withBorder p="sm" radius="md">
                <Group justify="space-between" align="flex-start" wrap="wrap" gap="sm">
                  <div>
                    <Group gap="xs">
                      <Text fw={700} size="sm">
                        {d.name}
                      </Text>
                      {getStatusBadge(d.status)}
                    </Group>
                    <Text size="xs" c="dimmed" mt={2}>
                      Подрядчик: <b>{d.contractor}</b> | Приёмка: {d.review_days} кал. дн.
                    </Text>
                  </div>

                  <Group gap="xs">
                    <Badge variant="outline" color="gray" size="sm" leftSection={<Clock size={12} />}>
                      Обещано: {shortDate(d.promised_at)}
                    </Badge>
                    {d.expected_at && (
                      <Badge variant="outline" color={d.status === "rework" ? "red" : "blue"} size="sm" leftSection={<Calendar size={12} />}>
                        Ожидается: {shortDate(d.expected_at)}
                      </Badge>
                    )}
                  </Group>
                </Group>

                {d.dependent_tasks.length > 0 && (
                  <Group gap={6} mt="xs">
                    <Text size="11px" c="dimmed">Зависимые задачи в проекте:</Text>
                    {d.dependent_tasks.map((task) => (
                      <Badge key={task.id} size="xs" variant="subtle" color="indigo">
                        {task.name}
                      </Badge>
                    ))}
                  </Group>
                )}

                <Divider my="xs" />

                <Group justify="space-between" align="center">
                  <Text size="xs" fw={600} c="dimmed">
                    Доступные действия:
                  </Text>
                  <Group gap="xs" wrap="wrap">
                    {d.actions.map((act) => (
                      <Button
                        key={act.kind}
                        size="xs"
                        variant={selectedDelivery?.delivery_id === d.delivery_id && selectedAction?.kind === act.kind ? "filled" : "light"}
                        color={act.kind === "accept" ? "teal" : act.kind === "reject" ? "red" : act.kind === "submit" ? "orange" : "blue"}
                        onClick={() => selectDeliveryAndAction(d.delivery_id, act)}
                      >
                        {act.name}
                      </Button>
                    ))}
                  </Group>
                </Group>
              </Card>
            ))}
          </Stack>
        )}

        {/* Action Form & Preview Area */}
        {selectedDelivery && selectedAction && (
          <Paper withBorder p="md" radius="md" style={{ backgroundColor: "var(--surface)" }}>
            <Group justify="space-between" align="center" mb="sm">
              <Group gap="xs">
                <Badge color="blue" size="md">
                  {selectedAction.name}
                </Badge>
                <Text size="sm" fw={600}>
                  для поставки «{selectedDelivery.name}»
                </Text>
              </Group>
              <Button size="xs" variant="subtle" color="gray" onClick={resetAction}>
                Сбросить
              </Button>
            </Group>

            <Stack gap="xs">
              {selectedAction.requires_date && (
                <div>
                  <TextInput
                    label="Новый ожидаемый срок передачи результата"
                    type="datetime-local"
                    value={expectedDate}
                    onChange={(e) => setExpectedDate(e.target.value)}
                    required
                  />
                  <Group gap={6} mt={4}>
                    <Text size="11px" c="dimmed">Быстрый выбор:</Text>
                    <Button
                      size="compact-xs"
                      variant="light"
                      onClick={() => {
                        const d = new Date();
                        d.setDate(d.getDate() + 1);
                        setExpectedDate(d.toISOString().slice(0, 16));
                      }}
                    >
                      +1 день
                    </Button>
                    <Button
                      size="compact-xs"
                      variant="light"
                      onClick={() => {
                        const d = new Date();
                        d.setDate(d.getDate() + 2);
                        setExpectedDate(d.toISOString().slice(0, 16));
                      }}
                    >
                      +2 дня
                    </Button>
                    <Button
                      size="compact-xs"
                      variant="light"
                      onClick={() => {
                        const d = new Date();
                        d.setDate(d.getDate() + 7);
                        setExpectedDate(d.toISOString().slice(0, 16));
                      }}
                    >
                      +1 неделя
                    </Button>
                  </Group>
                </div>
              )}

              <TextInput
                label="Причина / основание изменения"
                placeholder="Например: Подрядчик подтвердил перенос срока передачи API на один день"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                required
              />

              <Group justify="flex-end" mt="xs">
                <Button
                  size="xs"
                  color="blue"
                  loading={loadingPreview}
                  onClick={handleComputePreview}
                  leftSection={<RotateCcw size={14} />}
                >
                  Рассчитать последствия в движке
                </Button>
              </Group>
            </Stack>

            {/* Preview Results */}
            {previewData && (
              <Stack gap="sm" mt="md">
                <Divider label="Результаты расчёта последствий в CPM-движке" labelPosition="center" />

                <Group justify="space-between">
                  <Text size="xs" c="dimmed">
                    Исходный финиш проекта: <b>{shortDate(previewData.before.forecast_finish)}</b>
                  </Text>
                  <Text size="xs" c="dimmed">
                    Дедлайн: <b>{shortDate(previewData.before.deadline)}</b>
                  </Text>
                </Group>

                <Radio.Group
                  value={selectedDecision}
                  onChange={(val) => setSelectedDecision(val as any)}
                  label="Выберите вариант управленческого решения по выпуску:"
                >
                  <Stack gap="xs" mt="xs">
                    {previewData.variants.map((v) => {
                      const deltaDays = Math.round(v.impact.finish_delta_minutes / 1440);
                      const isExceeded = v.impact.deadline_exceeded;
                      const hasDeferred = (v.impact.deferred_tasks || []).length > 0;

                      return (
                        <Card
                          key={v.decision}
                          withBorder
                          p="sm"
                          radius="md"
                          style={{
                            borderColor:
                              selectedDecision === v.decision
                                ? "var(--mantine-color-blue-6)"
                                : "var(--line)",
                            backgroundColor:
                              selectedDecision === v.decision
                                ? "rgba(59, 130, 246, 0.04)"
                                : undefined,
                          }}
                        >
                          <Group justify="space-between" align="flex-start" wrap="nowrap">
                            <Radio
                              value={v.decision}
                              label={
                                <div>
                                  <Text size="sm" fw={700}>
                                    {v.name}
                                  </Text>
                                  <Text size="xs" c="dimmed" mt={2}>
                                    {v.description}
                                  </Text>
                                </div>
                              }
                            />
                            <Badge
                              color={isExceeded ? "red" : "teal"}
                              variant="light"
                              size="sm"
                            >
                              {isExceeded ? "Дедлайн нарушен" : "Дедлайн соблюдён"}
                            </Badge>
                          </Group>

                          <Group gap="md" mt="xs">
                            <Text size="xs">
                              Прогноз финиша: <b>{shortDate(v.impact.finish_after)}</b>{" "}
                              {deltaDays !== 0 && (
                                <Text
                                  span
                                  c={deltaDays > 0 ? "orange" : "teal"}
                                  fw={600}
                                >
                                  ({deltaDays > 0 ? `+${deltaDays}` : deltaDays} дн.)
                                </Text>
                              )}
                            </Text>

                            {hasDeferred && (
                              <Badge color="orange" variant="outline" size="xs">
                                Исключены из выпуска: {(v.impact.deferred_tasks || []).join(", ")}
                              </Badge>
                            )}
                          </Group>

                          {v.impact.moved_tasks && v.impact.moved_tasks.length > 0 && (
                            <div style={{ marginTop: 8 }}>
                              <Text size="11px" fw={600} c="dimmed" mb={4}>
                                Сдвинутые работы цепочки:
                              </Text>
                              <Table striped withTableBorder>
                                <Table.Thead>
                                  <Table.Tr>
                                    <Table.Th>Задача</Table.Th>
                                    <Table.Th>Прежний финиш</Table.Th>
                                    <Table.Th>Новый финиш</Table.Th>
                                  </Table.Tr>
                                </Table.Thead>
                                <Table.Tbody>
                                  {v.impact.moved_tasks.slice(0, 5).map((mt) => (
                                    <Table.Tr key={mt.id}>
                                      <Table.Td>{mt.name}</Table.Td>
                                      <Table.Td>{shortDate(mt.before_finish)}</Table.Td>
                                      <Table.Td>
                                        <Text c="orange" fw={600}>
                                          {shortDate(mt.after_finish)}
                                        </Text>
                                      </Table.Td>
                                    </Table.Tr>
                                  ))}
                                </Table.Tbody>
                              </Table>
                            </div>
                          )}
                        </Card>
                      );
                    })}
                  </Stack>
                </Radio.Group>

                <TextInput
                  label="Ответственный за решение (Decision Owner)"
                  description="Фиксирует управленческое решение команды в журнале истории версий"
                  value={decisionOwner}
                  onChange={(e) => setDecisionOwner(e.target.value)}
                  required
                  mt="xs"
                />

                <Group justify="space-between" align="center" mt="sm">
                  <Text size="11px" c="dimmed">
                    Запись решения атомарно увеличивает версию проекта и заносится в аудит-лог.
                  </Text>
                  <Button
                    color="teal"
                    loading={isApplying}
                    onClick={handleApplyDecision}
                    leftSection={<CheckCircle2 size={16} />}
                  >
                    Применить решение в проект
                  </Button>
                </Group>
              </Stack>
            )}
          </Paper>
        )}
      </Stack>
    </Modal>
  );
}

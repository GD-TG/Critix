import { Badge, Button, Group, Paper, Text } from "@mantine/core";
import { AlertCircle, AlertTriangle, CheckCircle2, FlaskConical, Package, ShieldAlert } from "lucide-react";
import { useStatusStrip } from "./useStatusStrip";

export function StatusStrip() {
  const data = useStatusStrip();
  if (!data) return null;

  const {
    health,
    healthText,
    finishText,
    bufferText,
    isExceeded,
    deadlineText,
    criticalCount,
    dirty,
    deltaDays,
    hasDeliveries,
    deliveriesCount,
    openDeliveriesModal,
    openDecisionLab,
  } = data;

  const healthColor = health === "red" ? "red" : health === "orange" ? "orange" : "teal";
  const HealthIcon = health === "red" ? AlertCircle : health === "orange" ? AlertTriangle : CheckCircle2;

  return (
    <Paper
      withBorder
      p="xs"
      radius="md"
      mb="sm"
      style={{
        backgroundColor: "var(--surface)",
        borderColor: "var(--line)",
      }}
    >
      <Group justify="space-between" align="center" wrap="nowrap" style={{ overflowX: "auto" }}>
        <Group gap="sm" wrap="nowrap">
          <Badge
            variant="light"
            color={healthColor}
            size="md"
            leftSection={<HealthIcon size={14} />}
          >
            {healthText}
          </Badge>

          <Text size="sm" fw={600} c={dirty && deltaDays > 0 ? "orange" : undefined}>
            {finishText}
          </Text>

          <Text size="sm" c="dimmed">
            |
          </Text>

          <Text size="sm" fw={500} c={isExceeded ? "red" : "teal"}>
            {bufferText}
          </Text>

          <Text size="sm" c="dimmed">
            |
          </Text>

          <Text size="sm" c="dimmed">
            {deadlineText}
          </Text>

          {criticalCount > 0 && (
            <>
              <Text size="sm" c="dimmed">
                |
              </Text>
              <Badge color="red" variant="subtle" size="sm" leftSection={<ShieldAlert size={13} />}>
                {criticalCount} критических
              </Badge>
            </>
          )}
        </Group>

        <Group gap="xs" wrap="nowrap">
          {hasDeliveries && (
            <Button
              size="xs"
              variant="light"
              color="indigo"
              leftSection={<Package size={14} />}
              onClick={openDeliveriesModal}
            >
              Поставки ({deliveriesCount})
            </Button>
          )}
          <Button
            size="xs"
            variant="subtle"
            color="gray"
            leftSection={<FlaskConical size={14} />}
            onClick={openDecisionLab}
          >
            Лаборатория решений
          </Button>
        </Group>
      </Group>
    </Paper>
  );
}

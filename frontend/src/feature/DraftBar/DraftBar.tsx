import { Affix, Badge, Button, Group, Paper, Text, Transition } from "@mantine/core";
import { Check, GitBranch, X } from "lucide-react";
import { useDraftBar } from "./useDraftBar";

export function DraftBar() {
  const data = useDraftBar();

  if (!data.isActive) return null;

  const {
    desc,
    verdict,
    color,
    finishText,
    isApplying,
    handleCancel,
    handleApply,
    openScenario,
  } = data;

  return (
    <Affix position={{ bottom: 18, left: "50%" }} style={{ transform: "translateX(-50%)", zIndex: 1000, width: "calc(100% - 32px)", maxWidth: "860px" }}>
      <Transition transition="slide-up" mounted={true}>
        {(transitionStyles) => (
          <Paper
            withBorder
            shadow="xl"
            p="sm"
            radius="md"
            style={{
              ...transitionStyles,
              backgroundColor: "var(--surface)",
              borderColor: color === "red" ? "var(--mantine-color-red-6)" : "var(--line)",
              boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
            }}
          >
            <Group justify="space-between" align="center" wrap="wrap" gap="sm">
              <div>
                <Text size="sm" fw={700}>
                  {desc}
                </Text>
                <Group gap="xs" mt={2}>
                  <Badge color={color} size="sm" variant="light">
                    {verdict}
                  </Badge>
                  <Text size="xs" c="dimmed">
                    {finishText}
                  </Text>
                </Group>
              </div>

              <Group gap="xs" wrap="nowrap">
                <Button
                  variant="subtle"
                  color="gray"
                  size="xs"
                  onClick={handleCancel}
                  leftSection={<X size={14} />}
                >
                  Отменить
                </Button>
                <Button
                  variant="light"
                  color="gray"
                  size="xs"
                  onClick={openScenario}
                  leftSection={<GitBranch size={14} />}
                >
                  В варианты (Сценарии)
                </Button>
                <Button
                  color="teal"
                  size="xs"
                  loading={isApplying}
                  onClick={handleApply}
                  leftSection={<Check size={14} />}
                >
                  Применить в проект
                </Button>
              </Group>
            </Group>
          </Paper>
        )}
      </Transition>
    </Affix>
  );
}

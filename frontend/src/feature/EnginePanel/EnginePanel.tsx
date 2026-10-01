import { Badge, Button, Card, Group, SimpleGrid, Text, ThemeIcon } from "@mantine/core";
import { AlertCircle, CheckCircle2, Clock, ShieldAlert, ShieldCheck } from "lucide-react";
import { useEnginePanel } from "./useEnginePanel";

export function EnginePanel() {
  const {
    draft,
    view,
    preview,
    shortDate,
    lateDays,
    bufferDays,
    criticalCount,
    nonCriticalCount,
    maxSlackHours,
    openDecisionLabForTask,
  } = useEnginePanel();

  if (!draft || !view) return null;

  const hasExceeded = view.analysis.deadline_exceeded || lateDays > 0;

  return (
    <article className="panel health-panel">
      <div className="panel-header">
        <div>
          <Group gap="xs" align="center">
            <h2>Метрики расписания</h2>
            {hasExceeded ? (
              <Badge color="red" variant="light" size="sm">
                Риск срыва дедлайна
              </Badge>
            ) : (
              <Badge color="teal" variant="light" size="sm">
                План в графике
              </Badge>
            )}
            {preview && (
              <Badge color="yellow" variant="outline" size="xs">
                Черновик
              </Badge>
            )}
          </Group>
          <p>Сводная информация о состоянии расписания, резервах времени и критическом пути</p>
        </div>
      </div>

      <div style={{ padding: "0 20px 20px 20px" }}>
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
          {/* КАРТОЧКА 1: Статус дедлайна */}
          <Card withBorder p="sm" radius="md">
            <Group justify="space-between" mb={4}>
              <Text size="xs" fw={700} c="dimmed">
                СТАТУС ДЕДЛАЙНА
              </Text>
              <ThemeIcon color={hasExceeded ? "red" : "teal"} size="sm" variant="light">
                {hasExceeded ? <AlertCircle size={14} /> : <CheckCircle2 size={14} />}
              </ThemeIcon>
            </Group>
            <Text size="lg" fw={700} c={hasExceeded ? "red.7" : "green.7"}>
              {hasExceeded ? `Срыв на ${lateDays} дн.` : "В графике"}
            </Text>
            <Text size="xs" c="dimmed">
              {hasExceeded
                ? "Прогнозируемая дата завершения позже целевого дедлайна"
                : "Прогнозируемая дата завершения укладывается в целевой дедлайн"}
            </Text>
          </Card>

          {/* КАРТОЧКА 2: Финиш vs Дедлайн */}
          <Card withBorder p="sm" radius="md">
            <Group justify="space-between" mb={4}>
              <Text size="xs" fw={700} c="dimmed">
                ФИНИШ VS ЦЕЛЕВОЙ ДЕДЛАЙН
              </Text>
              <ThemeIcon color="blue" size="sm" variant="light">
                <Clock size={14} />
              </ThemeIcon>
            </Group>
            <Text size="sm" fw={700}>
              Финиш: {shortDate(view.analysis.finish)}
            </Text>
            <Text size="xs" c="dimmed">
              Дедлайн: {shortDate(draft.deadline)} ·{" "}
              <span style={{ fontWeight: 600, color: hasExceeded ? "var(--mantine-color-red-7)" : "var(--mantine-color-teal-7)" }}>
                {hasExceeded ? `Опоздание: ${lateDays} дн.` : `Запас: ${bufferDays} дн.`}
              </span>
            </Text>
          </Card>

          {/* КАРТОЧКА 3: Критический путь */}
          <Card withBorder p="sm" radius="md">
            <Group justify="space-between" mb={4}>
              <Text size="xs" fw={700} c="dimmed">
                КРИТИЧЕСКИЙ ПУТЬ (CPM)
              </Text>
              <ThemeIcon color="red" size="sm" variant="light">
                <ShieldAlert size={14} />
              </ThemeIcon>
            </Group>
            <Text size="sm" fw={700}>
              {criticalCount} из {draft.tasks.length} задач на критическом пути
            </Text>
            <Text size="xs" c="dimmed">
              Задачи с нулевым резервом времени: любая задержка сдвигает сдачу всего проекта
            </Text>
          </Card>

          {/* КАРТОЧКА 4: Резервы времени (Float) */}
          <Card withBorder p="sm" radius="md">
            <Group justify="space-between" mb={4}>
              <Text size="xs" fw={700} c="dimmed">
                РЕЗЕРВЫ НЕКРИТИЧЕСКИХ ЗАДАЧ
              </Text>
              <ThemeIcon color="teal" size="sm" variant="light">
                <ShieldCheck size={14} />
              </ThemeIcon>
            </Group>
            <Text size="sm" fw={700}>
              {nonCriticalCount} задач имеют свободный буфер
            </Text>
            <Text size="xs" c="dimmed">
              Максимальный запас задачи: до {maxSlackHours} ч. (их сдвиг безопасен для дедлайна)
            </Text>
          </Card>
        </SimpleGrid>
      </div>
    </article>
  );
}

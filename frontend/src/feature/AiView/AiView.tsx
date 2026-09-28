import { Alert, Button, Card, Divider, Group, ScrollArea, SimpleGrid, Stack, Text, Title } from "@mantine/core";
import { AlertTriangle, Sparkles } from "lucide-react";
import { AICopilotChat } from "@/AICopilotChat";
import { AiMarkdown } from "@/AiMarkdown";
import { useAiView } from "@/feature/AiView/useAiView";

export function AiView() {
  const { saved, draft, aiText, aiReport, aiBusy, aiError, dirty, activeView, setActiveView, generateAudit } = useAiView();

  if (activeView !== "ai" || !saved || !draft) return null;

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <div>
          <Title order={3}>AI Copilot и Центр анализа рисков</Title>
          <Text size="sm" c="dimmed">
            Интерактивный диалог с AI по проекту, экспресс-аудит критического пути и стратегические рекомендации.
          </Text>
        </div>
        <Button size="xs" variant="light" onClick={() => setActiveView("dashboard")}>
          ← На Главную
        </Button>
      </Group>

      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
        <AICopilotChat
          key={saved.id}
          project={saved.project}
          projectId={saved.id}
          result={saved}
        />

        <Card withBorder p="md">
          <Group justify="space-between" mb="sm">
            <div>
              <Title order={4} style={{ fontSize: 16 }}>
                {aiReport?.source === "engine" ? "Расчетная сводка проекта" : "Экспресс-аудит рисков (Автоотчет)"}
              </Title>
              {aiReport && (
                <Text size="11px" c={aiReport.source === "engine" ? "orange" : "teal"} fw={600}>
                  Источник: {aiReport.source === "engine" ? "Аналитический движок CPM" : "Нейросетевая модель (LLM)"}
                </Text>
              )}
            </div>
            <Button
              size="xs"
              loading={aiBusy}
              disabled={dirty}
              onClick={generateAudit}
            >
              <Sparkles size={14} style={{ marginRight: 6 }} /> Сформировать аудит
            </Button>
          </Group>

          <Divider mb="sm" />
          <Text size="xs" c="dimmed" mb="sm">Анализ сохранённого плана, версия {saved.version}.</Text>
          {dirty && <Alert color="blue" mb="sm">Сохраните изменения перед формированием нового аудита.</Alert>}
          {aiError && <Alert color="red" mb="sm">{aiError}</Alert>}

          {aiReport?.source === "engine" && (
            <Alert
              icon={<AlertTriangle size={16} />}
              color="yellow"
              title="AI недоступен. Ниже расчётная сводка"
              mb="sm"
            >
              Провайдер AI временно недоступен или не настроен. Сводка сформирована аналитическим ядром проекта на основе графа CPM и производственного календаря.
            </Alert>
          )}

          {aiText ? (
            <ScrollArea style={{ maxHeight: 520 }}>
              <AiMarkdown content={aiText} />
            </ScrollArea>
          ) : (
            <Text size="sm" c="dimmed">
              Нажмите «Сформировать аудит», чтобы получить структурированный отчёт по 4 разделам: статус дедлайна, критический путь, ресурсы и шаги оптимизации.
            </Text>
          )}
        </Card>
      </SimpleGrid>
    </Stack>
  );
}

import { Button, Card, Divider, Group, ScrollArea, SimpleGrid, Stack, Text, Title } from "@mantine/core";
import { Sparkles } from "lucide-react";
import { AICopilotChat } from "@/AICopilotChat";
import { AiMarkdown } from "@/AiMarkdown";
import { useAiView } from "@/feature/AiView/useAiView";

export function AiView() {
  const { saved, draft, aiText, aiBusy, activeView, setActiveView, generateAudit } = useAiView();

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
            <Title order={4} style={{ fontSize: 16 }}>
              Экспресс-аудит рисков (Автоотчет)
            </Title>
            <Button
              size="xs"
              loading={aiBusy}
              onClick={generateAudit}
            >
              <Sparkles size={14} style={{ marginRight: 6 }} /> Сформировать аудит
            </Button>
          </Group>

          <Divider mb="sm" />

          {aiText ? (
            <ScrollArea style={{ maxHeight: 520 }}>
              <AiMarkdown content={aiText} />
            </ScrollArea>
          ) : (
            <Text size="sm" c="dimmed">
              Нажмите «Сформировать аудит», чтобы AI подготовил структурированный отчёт по 4 разделам: статус дедлайна, критический путь, ресурсы и шаги оптимизации.
            </Text>
          )}
        </Card>
      </SimpleGrid>
    </Stack>
  );
}
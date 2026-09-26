import React, { useState, useRef, useEffect } from "react";
import {
  ActionIcon,
  Badge,
  Button,
  Card,
  Divider,
  Group,
  Loader,
  Paper,
  ScrollArea,
  Stack,
  Text,
  Textarea,
  Title,
} from "@mantine/core";
import {
  AlertTriangle,
  Bot,
  CornerDownLeft,
  Eraser,
  HelpCircle,
  Send,
  Sparkles,
  Target,
  User,
  Zap,
} from "lucide-react";
import { api } from "./api";
import type { Project, Result } from "./types";

export interface ChatMessageItem {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

interface AICopilotChatProps {
  project: Project;
  projectId: string;
  result?: Result | null;
}

const QUICK_PROMPTS = [
  "Какие задачи на критическом пути несут наибольший риск для дедлайна?",
  "У кого из сотрудников есть перегрузки и как их оптимально устранить?",
  "Проанализируй соответствие навыков команды назначенным задачам.",
  "Какую гипотезу стоит проверить через симуляцию и почему?",
  "Дай пошаговые рекомендации для ускорения финиша проекта.",
];

export function AICopilotChat({ project, projectId, result }: AICopilotChatProps) {
  const storageKey = `critix_chat_${projectId}`;

  const [messages, setMessages] = useState<ChatMessageItem[]>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // fallback
    }
    return [
      {
        id: "welcome",
        role: "assistant",
        content: `Здравствуйте! Я ваш AI Copilot и консультант по проекту **«${project.name}»**.\n\nЯ отвечаю по сохранённому плану. Изменения сроков проверяются отдельной симуляцией. Чем я могу помочь? Можете выбрать быстрый вопрос ниже или задать свой.`,
        timestamp: new Date().toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }),
      },
    ];
  });

  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollViewportRef = useRef<HTMLDivElement>(null);

  // Sync to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(messages));
    } catch {
      // ignore
    }
  }, [messages, storageKey]);

  // When switching projects, load the respective project's chat
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setMessages(parsed);
          return;
        }
      }
    } catch {
      // fallback
    }
    setMessages([
      {
        id: "welcome",
        role: "assistant",
        content: `Здравствуйте! Я ваш AI Copilot и консультант по проекту **«${project.name}»**.\n\nЯ отвечаю по сохранённому плану. Изменения сроков проверяются отдельной симуляцией. Чем я могу помочь? Можете выбрать быстрый вопрос ниже или задать свой.`,
        timestamp: new Date().toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }),
      },
    ]);
  }, [projectId, project.name, storageKey]);

  const scrollToBottom = () => {
    if (scrollViewportRef.current) {
      scrollViewportRef.current.scrollTo({
        top: scrollViewportRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, busy]);

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || input).trim();
    if (!text || busy) return;

    const userMessage: ChatMessageItem = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
      timestamp: new Date().toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setBusy(true);

    try {
      const payloadMessages = [...messages, userMessage].filter((m) => !m.id.startsWith("welcome")).slice(-10).map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const res = await api<{ available: boolean; reply: string }>(
        `/projects/${projectId}/chat`,
        "POST",
        { messages: payloadMessages, project: project },
      );

      const assistantMessage: ChatMessageItem = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: res.reply || "Не удалось сформировать ответ.",
        timestamp: new Date().toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (e: any) {
      const errorMessage: ChatMessageItem = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: `Ошибка связи с AI-сервисом: ${e.message || "Попробуйте позже."}`,
        timestamp: new Date().toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setBusy(false);
    }
  };

  const handleClear = () => {
    const initial: ChatMessageItem[] = [
      {
        id: "welcome-reset",
        role: "assistant",
        content: `Контекст очищен. Готов к новым вопросам по проекту **«${project.name}»**.`,
        timestamp: new Date().toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }),
      },
    ];
    setMessages(initial);
    try {
      localStorage.setItem(storageKey, JSON.stringify(initial));
    } catch {
      // ignore
    }
  };

  return (
    <Card withBorder p="md" style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <Group justify="space-between" mb="sm">
        <Group gap="xs">
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: "rgba(210, 10, 46, 0.12)",
              display: "grid",
              placeItems: "center",
              color: "var(--blue)",
            }}
          >
            <Sparkles size={18} />
          </div>
          <div>
            <Title order={4} style={{ fontSize: 16 }}>
              AI Copilot & Аналитик проекта
            </Title>
            <Text size="xs" c="dimmed">
              Консультации по сохранённому плану; расчёт изменений — в симуляции
            </Text>
          </div>
        </Group>

        <Group gap="xs">
          <Badge color="blue" variant="light" size="sm">
            Консультация
          </Badge>
          <ActionIcon variant="subtle" color="gray" title="Очистить историю диалога" onClick={handleClear}>
            <Eraser size={16} />
          </ActionIcon>
        </Group>
      </Group>

      <Divider mb="xs" />

      {/* Messages Scroll Area */}
      <ScrollArea
        style={{ flex: 1, minHeight: 380, maxHeight: 520, paddingRight: 8 }}
        viewportRef={scrollViewportRef}
      >
        <Stack gap="sm">
          {messages.map((m) => {
            const isUser = m.role === "user";
            return (
              <Group
                key={m.id}
                align="flex-start"
                justify={isUser ? "flex-end" : "flex-start"}
                wrap="nowrap"
              >
                {!isUser && (
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: "50%",
                      background: "var(--blue, #d20a2e)",
                      color: "#fff",
                      display: "grid",
                      placeItems: "center",
                      flexShrink: 0,
                    }}
                  >
                    <Bot size={16} />
                  </div>
                )}

                <div
                  style={{
                    maxWidth: "80%",
                    padding: "10px 14px",
                    borderRadius: isUser ? "14px 14px 2px 14px" : "14px 14px 14px 2px",
                    background: isUser
                      ? "var(--blue, #d20a2e)"
                      : "var(--bg, rgba(210, 10, 46, 0.04))",
                    color: isUser ? "#ffffff" : "var(--ink, #1c2330)",
                    border: isUser ? "none" : "1px solid var(--line, #e2e8f0)",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.03)",
                  }}
                >
                  <Text size="sm" style={{ whiteSpace: "pre-wrap", lineHeight: 1.5 }}>
                    {m.content}
                  </Text>
                  <Text
                    size="10px"
                    style={{
                      marginTop: 4,
                      textAlign: isUser ? "right" : "left",
                      opacity: 0.7,
                    }}
                  >
                    {m.timestamp}
                  </Text>
                </div>

                {isUser && (
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: "50%",
                      background: "var(--ink, #1c2330)",
                      color: "#fff",
                      display: "grid",
                      placeItems: "center",
                      flexShrink: 0,
                    }}
                  >
                    <User size={16} />
                  </div>
                )}
              </Group>
            );
          })}

          {busy && (
            <Group align="center" gap="xs">
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  background: "var(--blue, #d20a2e)",
                  color: "#fff",
                  display: "grid",
                  placeItems: "center",
                  flexShrink: 0,
                }}
              >
                <Bot size={16} />
              </div>
              <div
                style={{
                  padding: "8px 14px",
                  borderRadius: "14px 14px 14px 2px",
                  background: "var(--bg, rgba(210, 10, 46, 0.04))",
                  border: "1px solid var(--line, #e2e8f0)",
                }}
              >
                <Group gap="xs">
                  <Loader size="xs" color="blue" />
                  <Text size="xs" c="dimmed">
                    AI анализирует критический путь и формирует ответ...
                  </Text>
                </Group>
              </div>
            </Group>
          )}
        </Stack>
      </ScrollArea>

      <Divider my="xs" />

      {/* Quick Prompts Chips */}
      <div style={{ marginBottom: 10 }}>
        <Text size="10px" fw={700} c="dimmed" mb={4}>
          БЫСТРЫЕ ВОПРОСЫ К ПРОЕКТУ:
        </Text>
        <Group gap={6} wrap="wrap">
          {QUICK_PROMPTS.map((prompt, idx) => (
            <Button
              key={idx}
              size="compact-xs"
              variant="light"
              color="gray"
              disabled={busy}
              onClick={() => handleSendMessage(prompt)}
            >
              {prompt}
            </Button>
          ))}
        </Group>
      </div>

      {/* Input Form */}
      <Group align="flex-end" gap="xs">
        <Textarea
          placeholder="Спросите AI о рисках, перегрузках, дедлайне или сценариях оптимизации (Enter для отправки)..."
          size="xs"
          style={{ flex: 1 }}
          minRows={2}
          maxRows={4}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void handleSendMessage();
            }
          }}
          disabled={busy}
        />
        <Button
          color="blue"
          size="sm"
          loading={busy}
          disabled={!input.trim()}
          onClick={() => void handleSendMessage()}
          leftSection={<Send size={14} />}
        >
          Отправить
        </Button>
      </Group>
    </Card>
  );
}

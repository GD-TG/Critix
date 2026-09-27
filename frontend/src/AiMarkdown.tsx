import React from "react";
import { Badge, Card, Group, Stack, Text, ThemeIcon } from "@mantine/core";
import {
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  Lightbulb,
  Sparkles,
  Target,
  Users,
  Zap,
} from "lucide-react";

interface AiMarkdownProps {
  content: string;
}

function parseFormattedText(text: string): React.ReactNode[] {
  // Regex to match **bold** and `code`
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={index} style={{ fontWeight: 600, color: "var(--ink, #1c2330)" }}>
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code
          key={index}
          style={{
            fontFamily: "monospace",
            fontSize: "0.85em",
            background: "rgba(0,0,0,0.06)",
            padding: "2px 5px",
            borderRadius: 4,
          }}
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    return part;
  });
}

function getSectionIconAndColor(title: string): { icon: React.ReactNode; color: string; bg: string } {
  const lower = title.toLowerCase();
  if (lower.includes("статус") || lower.includes("дедлайн") || lower.includes("1.")) {
    return {
      icon: <Target size={15} />,
      color: "blue",
      bg: "rgba(34, 139, 230, 0.06)",
    };
  }
  if (lower.includes("критическ") || lower.includes("cpm") || lower.includes("2.")) {
    return {
      icon: <Zap size={15} />,
      color: "red",
      bg: "rgba(229, 116, 112, 0.08)",
    };
  }
  if (lower.includes("команд") || lower.includes("ресурс") || lower.includes("3.")) {
    return {
      icon: <Users size={15} />,
      color: "orange",
      bg: "rgba(238, 149, 100, 0.08)",
    };
  }
  if (lower.includes("рекомендац") || lower.includes("шаг") || lower.includes("4.")) {
    return {
      icon: <Lightbulb size={15} />,
      color: "teal",
      bg: "rgba(62, 172, 125, 0.08)",
    };
  }
  return {
    icon: <Sparkles size={15} />,
    color: "gray",
    bg: "rgba(0,0,0,0.03)",
  };
}

export function AiMarkdown({ content }: AiMarkdownProps) {
  if (!content) return null;

  // Split content by sections (starting with ### or ## or #)
  const lines = content.split(/\r?\n/);
  const elements: React.ReactNode[] = [];
  let currentSectionTitle = "";
  let currentSectionLines: string[] = [];

  const flushSection = (key: string | number) => {
    if (!currentSectionTitle && currentSectionLines.length === 0) return;

    if (currentSectionTitle) {
      const { icon, color, bg } = getSectionIconAndColor(currentSectionTitle);
      elements.push(
        <Card
          key={`section-${key}`}
          withBorder
          p="sm"
          radius="md"
          style={{ background: bg, marginBottom: 10 }}
        >
          <Group gap="xs" mb={6}>
            <ThemeIcon size="sm" color={color} variant="light" radius="xl">
              {icon}
            </ThemeIcon>
            <Text fw={700} size="sm" style={{ color: "var(--ink, #1c2330)" }}>
              {currentSectionTitle.replace(/^[#\s🎯⚡👥💡]+/, "").trim()}
            </Text>
          </Group>
          <Stack gap={4}>
            {currentSectionLines.map((line, lIdx) => {
              const trimmed = line.trim();
              if (!trimmed) return null;
              if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
                return (
                  <Group key={lIdx} align="flex-start" gap="xs" wrap="nowrap">
                    <span style={{ color: "var(--brand, #d20a2e)", lineHeight: "1.4" }}>•</span>
                    <Text size="sm" style={{ lineHeight: 1.5, flex: 1 }}>
                      {parseFormattedText(trimmed.slice(2))}
                    </Text>
                  </Group>
                );
              }
              if (/^\d+\.\s/.test(trimmed)) {
                const match = trimmed.match(/^(\d+)\.\s(.*)$/);
                return (
                  <Group key={lIdx} align="flex-start" gap="xs" wrap="nowrap">
                    <Badge size="xs" variant="filled" color={color} circle>
                      {match ? match[1] : "•"}
                    </Badge>
                    <Text size="sm" style={{ lineHeight: 1.5, flex: 1 }}>
                      {parseFormattedText(match ? match[2] : trimmed)}
                    </Text>
                  </Group>
                );
              }
              return (
                <Text key={lIdx} size="sm" style={{ lineHeight: 1.5 }}>
                  {parseFormattedText(line)}
                </Text>
              );
            })}
          </Stack>
        </Card>,
      );
    } else {
      // Unsectioned lines
      elements.push(
        <Stack key={`unsectioned-${key}`} gap={4} mb="xs">
          {currentSectionLines.map((line, lIdx) => {
            const trimmed = line.trim();
            if (!trimmed) return null;
            if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
              return (
                <Group key={lIdx} align="flex-start" gap="xs" wrap="nowrap">
                  <span style={{ color: "var(--brand, #d20a2e)" }}>•</span>
                  <Text size="sm" style={{ lineHeight: 1.5, flex: 1 }}>
                    {parseFormattedText(trimmed.slice(2))}
                  </Text>
                </Group>
              );
            }
            return (
              <Text key={lIdx} size="sm" style={{ lineHeight: 1.5 }}>
                {parseFormattedText(line)}
              </Text>
            );
          })}
        </Stack>,
      );
    }

    currentSectionTitle = "";
    currentSectionLines = [];
  };

  let sectionCounter = 0;
  for (const line of lines) {
    if (line.startsWith("### ") || line.startsWith("## ") || line.startsWith("# ")) {
      flushSection(sectionCounter++);
      currentSectionTitle = line;
    } else {
      currentSectionLines.push(line);
    }
  }
  flushSection(sectionCounter++);

  return <div className="ai-markdown-content">{elements}</div>;
}

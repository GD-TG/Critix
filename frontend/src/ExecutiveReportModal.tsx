import React, { useRef, useState } from "react";
import {
  Badge,
  Button,
  Card,
  Divider,
  Group,
  Modal,
  SimpleGrid,
  Stack,
  Table,
  Text,
  Title,
} from "@mantine/core";
import {
  AlertTriangle,
  CalendarDays,
  Check,
  Download,
  FileText,
  Gauge,
  Printer,
  Sparkles,
  Target,
  Users,
} from "lucide-react";
import { AiMarkdown } from "./AiMarkdown";
import { formatDeltaText, formatMinutes } from "./shared";
import type { Project, Result } from "./types";

interface ExecutiveReportModalProps {
  opened: boolean;
  onClose: () => void;
  project: Project;
  result?: Result | null;
  aiSummary?: string;
}

export function ExecutiveReportModal({
  opened,
  onClose,
  project,
  result,
  aiSummary,
}: ExecutiveReportModalProps) {
  const formatDate = (iso?: string | null) =>
    iso
      ? new Date(iso).toLocaleDateString("ru-RU", {
          timeZone: project.timezone,
          day: "numeric",
          month: "short",
          year: "numeric",
        })
      : "—";
  const formatTime = (iso?: string | null) =>
    iso
      ? new Date(iso).toLocaleString("ru-RU", {
          timeZone: project.timezone,
          day: "numeric",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      : "—";
  const [copyStatus, setCopyStatus] = useState("");
  const printRef = useRef<HTMLDivElement>(null);

  const completedTasks = project.tasks.filter((t) => t.status === "done");
  const inProgressTasks = project.tasks.filter((t) => t.status === "in_progress");
  const progressPercent = project.tasks.length
    ? Math.round((completedTasks.length / project.tasks.length) * 100)
    : 0;

  const rows = new Map((result?.analysis.tasks || []).map((r) => [r.id, r]));
  const criticalTasks = project.tasks.filter((t) => rows.get(t.id)?.critical);
  const overloads = result?.analysis.overloads || [];
  const deadlineExceeded = result?.analysis.deadline_exceeded;
  const finishDate = result?.analysis.finish;
  const baselineDelta = result?.analysis.baseline_delta_minutes;
  const deltaInfo = formatDeltaText(baselineDelta);

  // Generate Markdown text for export / copy
  const generateMarkdown = (): string => {
    const lines: string[] = [
      `# Исполнительный отчет по проекту: ${project.name}`,
      `**Дата формирования**: ${formatTime(new Date().toISOString())}`,
      `**Статус дедлайна**: ${deadlineExceeded ? "⚠️ Превышение дедлайна" : "✅ В плановом графике"}`,
      `**Базовый план (Baseline)**: ${deltaInfo.text}`,
      `**Часовой пояс**: ${project.timezone}`,
      `**Плановый старт**: ${formatDate(project.start)} | **Целевой дедлайн**: ${formatDate(project.deadline)}`,
      `**Расчетный финиш**: ${formatTime(finishDate)}`,
      "",
      "---",
      "## 1. Сводные метрики (Executive KPIs)",
      `- **Прогресс проекта**: ${progressPercent}% (${completedTasks.length} из ${project.tasks.length} задач завершено, ${inProgressTasks.length} в работе)`,
      `- **Критический путь (CPM)**: ${criticalTasks.length} задач (0 часов резерва)`,
      `- **Перегрузки команды**: ${overloads.length > 0 ? `Обнаружено ${overloads.length} периодов перегрузки` : "Отсутствуют (баланс в норме)"}`,
      "",
      "---",
      "## 2. Задачи на критическом пути (CPM)",
      "| ID | Задача | Исполнитель | Длительность | Старт → Финиш |",
      "|---|---|---|---|---|",
    ];

    criticalTasks.forEach((t) => {
      const p = project.assignees.find((a) => a.id === t.assignee_id);
      const r = rows.get(t.id);
      lines.push(
        `| ${t.id} | ${t.name} | ${p?.name || "—"} | ${formatMinutes(t.duration_minutes)} | ${r ? `${formatDate(r.start)} → ${formatDate(r.finish)}` : "—"} |`,
      );
    });

    lines.push("", "---", "## 3. Состав команды и компетенции");
    lines.push("| Имя | Роль | Навыки | Нерабочие исключения |");
    lines.push("|---|---|---|---|");
    project.assignees.forEach((a) => {
      const skills = (a.skills || []).map((s) => `${s.name} (${s.level})`).join(", ") || "—";
      const exceptionsCount = Object.values(a.calendar?.exceptions || {}).filter((shifts) => shifts.length === 0).length;
      lines.push(`| ${a.name} | ${a.role || "—"} | ${skills} | ${exceptionsCount} дней |`);
    });

    if (aiSummary) {
      lines.push("", "---", "## 4. Стратегические рекомендации AI Copilot", aiSummary);
    }

    lines.push("", "---", "## 5. Полный реестр задач проекта");
    lines.push("| ID | Задача | Статус | Приоритет | Исполнитель | Длительность | Резерв (Slack) |");
    lines.push("|---|---|---|---|---|---|---|");
    project.tasks.forEach((t) => {
      const p = project.assignees.find((a) => a.id === t.assignee_id);
      const r = rows.get(t.id);
      const slack = r?.critical
        ? "Критический (0 ч)"
        : r?.slack_minutes != null
        ? formatMinutes(r.slack_minutes)
        : "—";
      lines.push(
        `| ${t.id} | ${t.name} | ${t.status} | ${t.priority || "medium"} | ${p?.name || "—"} | ${formatMinutes(t.duration_minutes)} | ${slack} |`,
      );
    });

    return lines.join("\n");
  };

  const handleDownloadMarkdown = () => {
    const md = generateMarkdown();
    const blob = new Blob([md], { type: "text/markdown;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${project.name}_executive_report.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleCopyMarkdown = async () => {
    try {
      await navigator.clipboard.writeText(generateMarkdown());
      setCopyStatus("Отчёт скопирован в буфер обмена");
      setTimeout(() => setCopyStatus(""), 3000);
    } catch {
      setCopyStatus("Копирование недоступно. Скачайте Markdown-файл.");
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Исполнительный отчет для руководства (Executive Summary)"
      size="xl"
    >
      <Stack gap="md">
        {/* Action Header */}
        {copyStatus && (
          <Badge color="teal" variant="light" size="sm">
            {copyStatus}
          </Badge>
        )}
        <Group justify="space-between" align="center" className="no-print">
          <Text size="xs" c="dimmed">
            Сформирован автоматический отчет со всеми метриками CPM, анализом рисков и выводами.
          </Text>
          <Group gap="xs">
            <Button
              size="xs"
              variant="default"
              leftSection={<Download size={14} />}
              onClick={handleDownloadMarkdown}
            >
              Скачать .MD
            </Button>
            <Button
              size="xs"
              variant="default"
              leftSection={<FileText size={14} />}
              onClick={handleCopyMarkdown}
            >
              Копировать текст
            </Button>
            <Button
              size="xs"
              color="red"
              leftSection={<Printer size={14} />}
              onClick={handlePrint}
            >
              Печать / Экспорт в PDF
            </Button>
          </Group>
        </Group>

        {/* Printable Document Container */}
        <div
          ref={printRef}
          className="executive-print-report"
          style={{
            background: "var(--surface, #ffffff)",
            padding: 24,
            borderRadius: 12,
            border: "1px solid var(--line, #e2e8f0)",
          }}
        >
          {/* Report Header */}
          <div
            style={{
              borderBottom: "2px solid var(--line, #e2e8f0)",
              paddingBottom: 16,
              marginBottom: 16,
            }}
          >
            <Group justify="space-between" align="flex-start">
              <div>
                <Group gap="xs" mb={6}>
                  <Badge size="sm" color={deadlineExceeded ? "red" : "teal"}>
                    {deadlineExceeded ? "Превышение дедлайна" : "В плановом графике"}
                  </Badge>
                  {baselineDelta != null && (
                    <Badge size="sm" color={deltaInfo.status === "advance" ? "teal" : deltaInfo.status === "delay" ? "red" : "blue"} variant="light">
                      {deltaInfo.text}
                    </Badge>
                  )}
                </Group>
                <Title order={2} style={{ fontSize: 22 }}>
                  {project.name}
                </Title>
                <Text size="xs" c="dimmed" mt={2}>
                  Часовой пояс: {project.timezone} · Сгенерировано: {formatTime(new Date().toISOString())}
                </Text>
              </div>
              <div style={{ textAlign: "right" }}>
                <Text size="xs" fw={700} c="red">
                  CRITIX · ОТЧЁТ РУКОВОДИТЕЛЯ
                </Text>
                <Text size="xs" c="dimmed">
                  Метод критического пути (CPM)
                </Text>
              </div>
            </Group>
          </div>

          {/* KPI Cards */}
          <SimpleGrid cols={{ base: 2, sm: 4 }} mb="md">
            <Card withBorder p="xs">
              <Text size="xs" c="dimmed">Прогресс проекта</Text>
              <Text size="lg" fw={800} c="red">{progressPercent}%</Text>
              <Text size="10px" c="dimmed">{completedTasks.length} из {project.tasks.length} задач</Text>
            </Card>

            <Card withBorder p="xs">
              <Text size="xs" c="dimmed">Расчетный финиш</Text>
              <Text size="sm" fw={700} c={deadlineExceeded ? "red" : "teal"}>
                {formatDate(finishDate)}
              </Text>
              <Text size="10px" c="dimmed">Дедлайн: {formatDate(project.deadline)}</Text>
            </Card>

            <Card withBorder p="xs">
              <Text size="xs" c="dimmed">Критический путь</Text>
              <Text size="lg" fw={800} c="red">{criticalTasks.length}</Text>
              <Text size="10px" c="dimmed">задач с нулевым запасом</Text>
            </Card>

            <Card withBorder p="xs">
              <Text size="xs" c="dimmed">Баланс команды</Text>
              <Text size="sm" fw={700} c={overloads.length > 0 ? "orange" : "teal"}>
                {overloads.length > 0 ? `${overloads.length} перегрузок` : "В норме"}
              </Text>
              <Text size="10px" c="dimmed">{project.assignees.length} исполнителей</Text>
            </Card>
          </SimpleGrid>

          {/* AI Strategic Analysis */}
          {aiSummary && (
            <Card withBorder p="sm" mb="md" style={{ background: "rgba(210, 10, 46, 0.04)" }}>
              <Group gap="xs" mb={8}>
                <Sparkles size={16} color="var(--brand, #d20a2e)" />
                <Text size="xs" fw={700} c="red">
                  СТРАТЕГИЧЕСКИЙ АНАЛИЗ И РЕКОМЕНДАЦИИ AI
                </Text>
              </Group>
              <AiMarkdown content={aiSummary} />
            </Card>
          )}

          {/* Critical Path Tasks Table */}
          <Title order={4} size="sm" mb="xs">
            Задачи на критическом пути (наивысший приоритет внимания)
          </Title>
          <Table striped highlightOnHover withTableBorder mb="md" verticalSpacing="xs">
            <Table.Thead>
              <Table.Tr>
                <Table.Th style={{ width: 60 }}>ID</Table.Th>
                <Table.Th>Задача</Table.Th>
                <Table.Th>Исполнитель / Роль</Table.Th>
                <Table.Th>Длительность</Table.Th>
                <Table.Th>Плановые даты</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {criticalTasks.map((t) => {
                const p = project.assignees.find((a) => a.id === t.assignee_id);
                const r = rows.get(t.id);
                const isMilestone = t.duration_minutes === 0;
                return (
                  <Table.Tr key={t.id}>
                    <Table.Td>{t.id}</Table.Td>
                    <Table.Td fw={600}>
                      <Group gap={6}>
                        {isMilestone ? (
                          <Badge size="xs" color="violet" variant="filled">
                            Веха
                          </Badge>
                        ) : (
                          <Badge size="xs" color="red" variant="filled">
                            CPM
                          </Badge>
                        )}
                        <span>{t.name}</span>
                      </Group>
                    </Table.Td>
                    <Table.Td>
                      {p ? `${p.name} (${p.role || "Роль не указана"})` : "—"}
                    </Table.Td>
                    <Table.Td>{formatMinutes(t.duration_minutes)}</Table.Td>
                    <Table.Td>{r ? `${formatDate(r.start)} → ${formatDate(r.finish)}` : "—"}</Table.Td>
                  </Table.Tr>
                );
              })}
            </Table.Tbody>
          </Table>

          {/* Team Workload Table */}
          <Title order={4} size="sm" mb="xs">
            Команда и распределение нагрузки
          </Title>
          <Table striped highlightOnHover withTableBorder verticalSpacing="xs">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Сотрудник</Table.Th>
                <Table.Th>Должность / Роль</Table.Th>
                <Table.Th>Ключевые компетенции</Table.Th>
                <Table.Th>Задач</Table.Th>
                <Table.Th>Нерабочие исключения</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {project.assignees.map((a) => {
                const count = project.tasks.filter((t) => t.assignee_id === a.id).length;
                const excCount = Object.values(a.calendar?.exceptions || {}).filter(
                  (shifts) => shifts.length === 0,
                ).length;
                return (
                  <Table.Tr key={a.id}>
                    <Table.Td fw={600}>{a.name}</Table.Td>
                    <Table.Td>{a.role || "Роль не указана"}</Table.Td>
                    <Table.Td>
                      <Group gap={4}>
                        {(a.skills || []).map((s, idx) => (
                          <Badge key={idx} size="xs" variant="light" color="indigo">
                            {s.name}
                          </Badge>
                        ))}
                      </Group>
                    </Table.Td>
                    <Table.Td>{count}</Table.Td>
                    <Table.Td>{excCount > 0 ? `${excCount} дн.` : "—"}</Table.Td>
                  </Table.Tr>
                );
              })}
            </Table.Tbody>
          </Table>
        </div>
      </Stack>
    </Modal>
  );
}

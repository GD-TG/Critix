import { Badge, Button, Group, Menu, Text } from "@mantine/core";
import {
  AlertCircle,
  AlertTriangle,
  BookmarkCheck,
  CheckCircle2,
  ChevronDown,
  Download,
  FileJson,
  FileText,
  FlaskConical,
  Package,
  ShieldAlert,
  SlidersHorizontal,
  Sparkles,
  Upload,
} from "lucide-react";
import { useDashboardHeader } from "./useDashboardHeader";

export function DashboardHeader() {
  const {
    draft,
    view,
    lastUpdated,
    zone,
    dirty,
    preview,
    health,
    healthText,
    finishText,
    bufferText,
    isExceeded,
    deadlineText,
    criticalCount,
    hasDeliveries,
    deliveriesCount,
    openDeliveriesModal,
    openDecisionLab,
    handleSaveAsBaseline,
    exportProjectToJson,
    exportTasksToCsv,
    setSimResult,
    setShowScenarioModal,
    setExecutiveReportModal,
    setJsonImportModal,
    setImportModal,
    setEventDialogOpened,
  } = useDashboardHeader();

  const healthColor = health === "red" ? "red" : health === "orange" ? "orange" : "teal";
  const HealthIcon = health === "red" ? AlertCircle : health === "orange" ? AlertTriangle : CheckCircle2;

  return (
    <section className="page-heading" style={{ flexWrap: "wrap", alignItems: "center", gap: 12 }}>
      <div style={{ minWidth: 280, flex: "1 1 auto" }}>
        <Group gap="xs" align="center" wrap="nowrap">
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, lineHeight: 1.2 }}>
            {draft?.name || "Создайте или выберите проект"}
          </h1>
          {draft && (
            <Badge
              variant="light"
              color={healthColor}
              size="sm"
              leftSection={<HealthIcon size={13} />}
            >
              {healthText}
            </Badge>
          )}
        </Group>

        {draft && view && (
          <Group gap="xs" mt={4} wrap="wrap" style={{ fontSize: 12, color: "var(--muted)" }}>
            <span>
              <strong>Финиш:</strong> {finishText}
            </span>
            <span>·</span>
            <span>
              <strong>Дедлайн:</strong> {deadlineText}
            </span>
            <span>·</span>
            <span style={{ fontWeight: 600, color: isExceeded ? "var(--mantine-color-red-6)" : "var(--mantine-color-teal-6)" }}>
              {bufferText}
            </span>
            {criticalCount > 0 && (
              <>
                <span>·</span>
                <span style={{ color: "var(--mantine-color-red-6)", display: "inline-flex", alignItems: "center", gap: 3 }}>
                  <ShieldAlert size={12} /> {criticalCount} на крит. пути
                </span>
              </>
            )}
            <span>·</span>
            <span>{zone}</span>
          </Group>
        )}

        {dirty && !preview && (
          <Text c="orange" size="xs" mt={2} fw={500}>
            Черновик изменён. Проверьте последствия изменений в симуляторе.
          </Text>
        )}
      </div>

      <div className="heading-actions" style={{ flexWrap: "nowrap", gap: 8 }}>
        <Button
          size="xs"
          variant="light"
          color="orange"
          disabled={!draft?.tasks.length}
          onClick={() => setEventDialogOpened(true)}
          leftSection={<Sparkles size={14} />}
        >
          Что случилось?
        </Button>

        <Button
          size="xs"
          variant="default"
          disabled={!draft?.tasks.length}
          onClick={() => {
            setSimResult(null);
            setShowScenarioModal(true);
          }}
          leftSection={<Sparkles size={14} />}
        >
          Симуляция (What-If)
        </Button>

        <Button
          size="xs"
          variant="subtle"
          color="gray"
          onClick={openDecisionLab}
          leftSection={<FlaskConical size={14} />}
        >
          Лаборатория
        </Button>

        {hasDeliveries && (
          <Button
            size="xs"
            variant="light"
            color="indigo"
            onClick={openDeliveriesModal}
            leftSection={<Package size={14} />}
          >
            Поставки ({deliveriesCount})
          </Button>
        )}

        {draft && (
          <Menu shadow="md" width={240} position="bottom-end">
            <Menu.Target>
              <Button size="xs" variant="default" rightSection={<ChevronDown size={12} />} leftSection={<SlidersHorizontal size={14} />}>
                Действия
              </Button>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Label>Отчеты и управление</Menu.Label>
              <Menu.Item leftSection={<FileText size={14} />} onClick={() => setExecutiveReportModal(true)}>
                Отчет для руководства (PDF/MD)
              </Menu.Item>
              <Menu.Item leftSection={<BookmarkCheck size={14} />} onClick={handleSaveAsBaseline}>
                {draft.baseline ? "Обновить базовый план" : "Зафиксировать базовый план"}
              </Menu.Item>
              <Menu.Divider />
              <Menu.Label>Экспорт и импорт</Menu.Label>
              <Menu.Item leftSection={<FileJson size={14} />} onClick={() => exportProjectToJson(draft)}>
                Экспорт проекта в JSON
              </Menu.Item>
              <Menu.Item leftSection={<Upload size={14} />} onClick={() => setJsonImportModal(true)}>
                Импорт проекта из JSON
              </Menu.Item>
              <Menu.Item leftSection={<Download size={14} />} onClick={() => exportTasksToCsv(draft)}>
                Экспорт задач в CSV
              </Menu.Item>
              <Menu.Item leftSection={<Upload size={14} />} onClick={() => setImportModal(true)}>
                Импорт задач из CSV
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        )}
      </div>
    </section>
  );
}

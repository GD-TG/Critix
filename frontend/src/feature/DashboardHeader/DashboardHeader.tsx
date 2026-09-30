import { Menu, Text } from "@mantine/core";
import {
  BookmarkCheck,
  ChevronDown,
  Download,
  FileJson,
  FileText,
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
    handleSaveAsBaseline,
    exportProjectToJson,
    exportTasksToCsv,
    setSimResult,
    setShowScenarioModal,
    setExecutiveReportModal,
    setJsonImportModal,
    setImportModal,
  } = useDashboardHeader();

  return (
    <section className="page-heading">
      <div>
        <div className="eyebrow">
          <span className="status-dot" />
          {view?.analysis.deadline_exceeded ? "Есть превышение" : "В работе"}
          <span className="heading-separator">·</span>
          обновлено в {lastUpdated.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}
        </div>
        <h1>{draft?.name || "Создайте или выберите проект"}</h1>
        <p>План, команда и последствия изменений — на одном экране. Часовой пояс: {zone}.</p>
        {dirty && !preview && <Text c="orange" size="sm">Черновик изменён. Даты, риски, отчёт и AI относятся к сохранённому плану до проверки последствий.</Text>}
      </div>

      <div className="heading-actions">
        <button className="secondary-button" disabled={!draft?.tasks.length} onClick={() => {setSimResult(null); setShowScenarioModal(true);}}>
          <Sparkles size={14} /> Симуляция (What-If)
        </button>
        {draft && (
          <Menu shadow="md" width={240} position="bottom-end">
            <Menu.Target>
              <button className="secondary-button">
                <SlidersHorizontal size={14} /> Действия и экспорт <ChevronDown size={12} />
              </button>
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

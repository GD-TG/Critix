import React from "react";
import { createRoot } from "react-dom/client";
import {
  Button,
  Card,
  Drawer,
  Group,
  MantineProvider,
  Paper,
  SegmentedControl,
  Stack,
  Text,
  ThemeIcon,
  Title,
} from "@mantine/core";
import { Calendar, Activity, FlaskConical, Zap } from "lucide-react";
import "@mantine/core/styles.css";
import "@xyflow/react/dist/style.css";
import "./style.css";
import { ErrorBoundary } from "./ErrorBoundary";
import { actionTheme } from "./theme";
import { AppProvider, useApp } from "./context/AppContext";
import { AuthForm } from "./feature/AuthForm/AuthForm";
import { SideForm } from "./feature/SideForm/SideForm";
import { TopBar } from "./feature/TopBar/TopBar";
import { DashboardHeader } from "./feature/DashboardHeader/DashboardHeader";
import { DashboardOverview } from "./feature/DashboardOverview/DashboardOverview";
import { StatusStrip } from "./feature/StatusStrip/StatusStrip";
import { DraftBar } from "./feature/DraftBar/DraftBar";
import { DeliveriesModal } from "./feature/DeliveriesModal/DeliveriesModal";
import { TimelinePanel } from "./feature/TimelinePanel/TimelinePanel";
import { GraphView } from "./feature/GraphView/GraphView";
import { TasksTableView } from "./feature/TasksTableView/TasksTableView";
import { TeamView } from "./feature/TeamView/TeamView";
import { LinksView } from "./feature/LinksView/LinksView";
import { AiView } from "./feature/AiView/AiView";
import { TaskDrawer } from "./feature/TaskDrawer/TaskDrawer";
import { SettingsDrawer } from "./feature/SettingsDrawer/SettingsDrawer";
import { DependencyModal } from "./feature/DependencyModal/DependencyModal";
import { CsvImportModal } from "./feature/CsvImportModal/CsvImportModal";
import { JsonImportModal } from "./feature/JsonImportModal/JsonImportModal";
import { ProjectManageModal } from "./feature/ProjectManageModal/ProjectManageModal";
import { NewProjectModal } from "./feature/NewProjectModal/NewProjectModal";
import { ScenarioModal } from "./feature/ScenarioModal/ScenarioModal";
import { HelpModal } from "./feature/HelpModal/HelpModal";
import { Toast } from "./feature/Toast/Toast";
import { ExecutiveReportModal } from "./ExecutiveReportModal";
import { api } from "./api";
import type { Result } from "./types";
import { DecisionLab } from "./feature/DecisionLab/DecisionLab";
import { EventDialog } from "./feature/EventDialog/EventDialog";
import { BriefDialog } from "./feature/BriefDialog/BriefDialog";
import { CompareVariantsDialog } from "./feature/CompareVariantsDialog/CompareVariantsDialog";

export function App() {
  const {
    logged,
    colorScheme,
    draft,
    saved,
    preview,
    error,
    activeView,
    setActiveView,
    setProjectManageModal,
    executiveReportModal,
    setExecutiveReportModal,
    aiText,
    aiReport,
    run,
    list,
    accept,
    showNotification,
    mobileNavOpened,
    setMobileNavOpened,
    decisionLabOpened,
    setDecisionLabOpened,
    openDecisionLabForTask,
    eventDialogOpened,
    setEventDialogOpened,
    compareVariantsOpened,
    setCompareVariantsOpened,
    briefDialogOpened,
    setBriefDialogOpened,
  } = useApp();

  const view = preview || saved;

  const scrollToSection = (id: string) => {
    setActiveView("dashboard");
    requestAnimationFrame(() => {
      setTimeout(() => {
        const el = document.getElementById(id);
        if (el) el.scrollIntoView({ behavior: "smooth" });
      }, 120);
    });
  };

  const handleLoadDemoProject = async () => {
    await run(async () => {
      const created = await api<Result>("/demo", "POST");
      await list();
      accept(created);
      setProjectManageModal(false);
      showNotification("Демо-проект «Запуск клиентского портала» успешно загружен!");
    });
  };

  const handleLoadDeliveriesDemo = async () => {
    await run(async () => {
      const created = await api<Result>("/demo/deliveries", "POST");
      await list();
      accept(created);
      setProjectManageModal(false);
      showNotification("Демо-проект «Пилот: оплата от внешнего подрядчика» успешно загружен!");
    });
  };

  if (!logged) {
    return <AuthForm />;
  }

  return (
    <MantineProvider forceColorScheme={colorScheme} theme={actionTheme}>
      <div className="app-shell">
        <div className="desktop-sidebar">
          <SideForm onScrollTo={scrollToSection} />
        </div>

        <Drawer
          opened={mobileNavOpened}
          onClose={() => setMobileNavOpened(false)}
          size="280px"
          padding={0}
          withCloseButton={false}
          className="mobile-nav-drawer"
        >
          <SideForm onScrollTo={scrollToSection} />
        </Drawer>

        <main className="main-content">
          <TopBar />

          <div className="content-wrap" id="overview">
            {!draft && (
              <Card withBorder mb="md">
                <Stack>
                  <Title order={3}>Нет выбранного проекта</Title>
                  <Text>Создайте проект, откройте существующий или загрузите демо.</Text>
                  <Group wrap="wrap" gap="xs">
                    <Button onClick={() => setProjectManageModal(true)}>Управление проектами</Button>
                    <Button variant="light" onClick={handleLoadDemoProject}>Демо: Классический CPM</Button>
                    <Button variant="light" color="indigo" onClick={handleLoadDeliveriesDemo}>Демо: Поставки подрядчика</Button>
                  </Group>
                </Stack>
              </Card>
            )}

            <DashboardHeader />

            {error && (
              <div className="api-note">
                <Zap size={14} /> {error}
              </div>
            )}

            {draft && view && activeView === "dashboard" && (
              <ErrorBoundary fallbackTitle="Ошибка отображения обзора проекта">
                <DashboardOverview />
              </ErrorBoundary>
            )}

            {draft && view && activeView === "timeline" && (
              <ErrorBoundary fallbackTitle="Ошибка отображения плана проекта">
                <TimelinePanel />
              </ErrorBoundary>
            )}

            <ErrorBoundary fallbackTitle="Ошибка отображения графа проекта">
              <GraphView />
            </ErrorBoundary>

            <ErrorBoundary fallbackTitle="Ошибка отображения таблицы задач">
              <TasksTableView />
            </ErrorBoundary>

            <ErrorBoundary fallbackTitle="Ошибка отображения команды проекта">
              <TeamView />
            </ErrorBoundary>

            <ErrorBoundary fallbackTitle="Ошибка отображения зависимостей">
              <LinksView />
            </ErrorBoundary>

            <ErrorBoundary fallbackTitle="Ошибка отображения AI советника">
              <AiView />
            </ErrorBoundary>
          </div>
        </main>
      </div>

      <Toast />
      <ErrorBoundary fallbackTitle="Ошибка лаборатории решений">
        <DecisionLab
          opened={decisionLabOpened}
          onClose={() => setDecisionLabOpened(false)}
          onLoadDemo={handleLoadDemoProject}
        />
      </ErrorBoundary>

      <DependencyModal />

      <CsvImportModal />

      <JsonImportModal />

      <ProjectManageModal />

      <NewProjectModal />

      <ScenarioModal />

      <TaskDrawer />

      <SettingsDrawer />

      <HelpModal />

      {draft && (
        <ErrorBoundary fallbackTitle="Ошибка формирования исполнительного отчета">
          <ExecutiveReportModal
            opened={executiveReportModal}
            onClose={() => setExecutiveReportModal(false)}
            project={view?.project || draft}
            result={view}
            aiSummary={aiText}
            aiSource={aiReport?.source || "llm"}
          />
        </ErrorBoundary>
      )}

      <EventDialog opened={eventDialogOpened} onClose={() => setEventDialogOpened(false)} />
      <BriefDialog opened={briefDialogOpened} onClose={() => setBriefDialogOpened(false)} />
      <CompareVariantsDialog opened={compareVariantsOpened} onClose={() => setCompareVariantsOpened(false)} />

      <DraftBar />
      <DeliveriesModal />
    </MantineProvider>
  );
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <AppProvider>
        <App />
      </AppProvider>
    </ErrorBoundary>
  </React.StrictMode>,
);

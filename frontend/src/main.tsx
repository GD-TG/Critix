import React from "react";
import { createRoot } from "react-dom/client";
import {
  Button,
  Card,
  Group,
  MantineProvider,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { Zap } from "lucide-react";
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
import { DraftBanner } from "./feature/DraftBanner/DraftBanner";
import { MetricsGrid } from "./feature/MetricsGrid/MetricsGrid";
import { TimelinePanel } from "./feature/TimelinePanel/TimelinePanel";
import { AttentionPanel } from "./feature/AttentionPanel/AttentionPanel";
import { DecisionPanel } from "./feature/DecisionPanel/DecisionPanel";
import { HistoryPanel } from "./feature/HistoryPanel/HistoryPanel";
import { EnginePanel } from "./feature/EnginePanel/EnginePanel";
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
    run,
    list,
    accept,
    showNotification,
  } = useApp();

  const view = preview || saved;

  const scrollToSection = (id: string) => {
    setActiveView("dashboard");
    setTimeout(() => {
      const el = document.getElementById(id);
      if (el) el.scrollIntoView({ behavior: "smooth" });
    }, 50);
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

  if (!logged) {
    return <AuthForm />;
  }

  return (
    <MantineProvider forceColorScheme={colorScheme} theme={actionTheme}>
      <div className="app-shell">
        <SideForm onScrollTo={scrollToSection} />

        <main className="main-content">
          <TopBar />

          <div className="content-wrap" id="overview">
            {!draft && (
              <Card withBorder>
                <Stack>
                  <Title order={3}>Нет выбранного проекта</Title>
                  <Text>Создайте проект, откройте существующий или загрузите демо.</Text>
                  <Group>
                    <Button onClick={() => setProjectManageModal(true)}>Управление проектами</Button>
                    <Button variant="light" onClick={handleLoadDemoProject}>Загрузить Демо-проект</Button>
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

            <MetricsGrid />

            <DraftBanner />

            {activeView === "dashboard" && draft && view && (
              <>
                <section className="dashboard-grid">
                  <TimelinePanel />

                  <aside className="side-column">
                    <AttentionPanel />
                    <DecisionPanel />
                  </aside>
                </section>

                <section className="bottom-grid">
                  <HistoryPanel />
                  <EnginePanel />
                </section>
              </>
            )}

            <GraphView />

            <TasksTableView />

            <TeamView />

            <LinksView />

            <AiView />
          </div>
        </main>
      </div>

      <Toast />

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
        <ExecutiveReportModal
          opened={executiveReportModal}
          onClose={() => setExecutiveReportModal(false)}
          project={view?.project || draft}
          result={view}
          aiSummary={aiText}
        />
      )}
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

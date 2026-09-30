import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Button,
  Card,
  Drawer,
  Group,
  MantineProvider,
  Paper,
  Stack,
  Text,
  ThemeIcon,
  Title,
} from "@mantine/core";
import { Coins, Zap } from "lucide-react";
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
import { DecisionLab } from "./feature/DecisionLab/DecisionLab";

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
            <Paper
              withBorder
              p="sm"
              mb="md"
              radius="md"
              style={{
                background: "linear-gradient(90deg, rgba(210,10,46,0.06) 0%, rgba(255,255,255,0) 100%)",
                borderColor: "rgba(210,10,46,0.25)",
              }}
            >
              <Group justify="space-between" wrap="wrap" gap="xs">
                <Group gap="xs">
                  <ThemeIcon color="red" variant="light" size="md" radius="md">
                    <Coins size={16} />
                  </ThemeIcon>
                  <div>
                    <Text fw={700} size="sm">
                      Пульт решений: Срок · Деньги · Состав запуска
                    </Text>
                    <Text size="xs" c="dimmed">
                      Подрядчик опаздывает или горит дедлайн? Оцените штрафы и спасите запуск за 1 клик.
                    </Text>
                  </div>
                </Group>
                <Button
                  color="red"
                  size="xs"
                  onClick={() => openDecisionLabForTask()}
                >
                  Разобрать ситуацию и риски
                </Button>
              </Group>
            </Paper>
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

            <DraftBanner />

            {activeView === "dashboard" && draft && view && (
              <>
                <MetricsGrid />

                <section className="dashboard-grid">
                  <AttentionPanel />

                  <EnginePanel />
                </section>

                <HistoryPanel />
              </>
            )}

            {activeView === "timeline" && draft && view && (
              <TimelinePanel />
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

            <AiView />
          </div>
        </main>
      </div>

      <Toast />
      <DecisionLab
        opened={decisionLabOpened}
        onClose={() => setDecisionLabOpened(false)}
        onLoadDemo={handleLoadDemoProject}
      />

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
          aiSource={aiReport?.source || "llm"}
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

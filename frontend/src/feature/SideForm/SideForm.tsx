import { ActionIcon, Group, SegmentedControl, Text } from "@mantine/core";
import {
  AlertTriangle, Check, ChevronDown, GitBranch,
  LayoutDashboard, Link as LinkIcon, LogOut, Plus,
  Settings, Users,
} from "lucide-react";
import { CritixLogo } from "@/CritixLogo";
import { getInitials, getAvatarClass } from "@/shared";
import { useSideForm } from "./useSideForm";

type Props = {
  onScrollTo: (id: string) => void;
};

export function SideForm({ onScrollTo }: Props) {
  const {
    draft, colorScheme, toggleTheme,
    activeView, setActiveView,
    setProjectManageModal, setSettings,
    setSelectedAssigneeId, handleSelectAssignee, addPerson, logout,
    totalTasksCount, overdueTasks, overloadedAssigneeIds,
  } = useSideForm(onScrollTo);

  return (
    <aside className="sidebar">
      <div className="brand">
        <CritixLogo size={32} />
        <span>Critix</span>
      </div>

      <div className="workspace-label">РАБОЧЕЕ ПРОСТРАНСТВО</div>

      <button className="project-switcher" onClick={() => setProjectManageModal(true)}>
        <span className="project-dot" />
        <span>
          <strong>{draft?.name || "Выберите проект"}</strong>
          <small>{draft?.timezone || "Проект не выбран"}</small>
        </span>
        <ChevronDown size={15} />
      </button>

      <nav className="main-nav">
        <button className="nav-item" onClick={() => onScrollTo("overview")}>
          <LayoutDashboard size={16} /> Обзор
        </button>
        <button className="nav-item" onClick={() => onScrollTo("timeline")}>
          <GitBranch size={16} /> План проекта
        </button>
        <button className={`nav-item ${activeView === "tasks_table" ? "active" : ""}`} onClick={() => setActiveView("tasks_table")}>
          <Check size={16} /> Задачи
          <span className="nav-count">{totalTasksCount}</span>
        </button>
        <button className={`nav-item ${activeView === "graph" ? "active" : ""}`} onClick={() => setActiveView("graph")}>
          <GitBranch size={16} /> Карта связей
        </button>
        <button className={`nav-item ${activeView === "team" ? "active" : ""}`} onClick={() => setActiveView("team")}>
          <Users size={16} /> Команда
          {overloadedAssigneeIds.size > 0 && <span className="nav-count warning">!</span>}
        </button>
        <button className={`nav-item ${activeView === "links" ? "active" : ""}`} onClick={() => setActiveView("links")}>
          <LinkIcon size={16} /> Зависимости
          <span className="nav-count">{draft?.dependencies.length || 0}</span>
        </button>
        <button className={`nav-item ${activeView === "ai" ? "active" : ""}`} onClick={() => setActiveView("ai")}>
          <AlertTriangle size={16} /> Риски & AI
          {overdueTasks.length > 0 && <span className="nav-count warning">{overdueTasks.length}</span>}
        </button>
      </nav>

      <div className="sidebar-divider" />

      <div className="workspace-label">КОМАНДА</div>
      <div className="team-stack">
        {(draft?.assignees || []).map((person) => (
          <span
            key={person.id}
            title={person.name}
            className={`avatar ${getAvatarClass(person.id)}`}
            onClick={() => handleSelectAssignee(person.id)}
            style={{ cursor: "pointer" }}
          >
            {getInitials(person.name)}
          </span>
        ))}
        <button className="avatar add-person" title="Добавить участника" onClick={addPerson}>
          <Plus size={14} />
        </button>
      </div>
      <div className="workspace-label team-caption" onClick={() => setActiveView("team")} style={{ cursor: "pointer" }}>
        {draft?.assignees.length || 0} участников · роли и графики
      </div>

      <div className="sidebar-bottom">
        <button className="nav-item" onClick={() => setSettings(true)}>
          <Settings size={16} /> Настройки проекта
        </button>

        <Group justify="space-between" mt="xs" px="xs">
          <Text size="xs" c="dimmed">Тема:</Text>
          <SegmentedControl
            size="xs"
            value={colorScheme}
            onChange={(v) => toggleTheme(v as "dark" | "light")}
            data={[
              { label: "Светлая", value: "light" },
              { label: "Тёмная", value: "dark" },
            ]}
          />
        </Group>

        <div className="user-card">
          <span className="avatar avatar-ink">PM</span>
          <span>
            <strong>Руководитель</strong>
            <small>Администратор проекта</small>
          </span>
          <ActionIcon variant="subtle" color="gray" size="sm" title="Выйти" onClick={() => void logout()}>
            <LogOut size={15} />
          </ActionIcon>
        </div>
      </div>
    </aside>
  );
}

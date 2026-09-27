import { useState } from "react";
import { useProjects } from "@/context/ProjectContext";
import { useUi } from "@/context/UiContext";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/api";
import { defaultCalendar, type Result } from "@/types";

export function useNewProjectModal() {
  const { run, list, accept } = useProjects();
  const { newProjectModal, setNewProjectModal, showNotification } = useUi();
  const { busy } = useAuth();

  const [newProjName, setNewProjName] = useState("Новый проект");
  const [newProjTz, setNewProjTz] = useState("Asia/Yekaterinburg");
  const [newProjStart, setNewProjStart] = useState(() => new Date(Math.ceil(Date.now() / 60000) * 60000).toISOString());
  const [newProjDeadline, setNewProjDeadline] = useState(() => new Date(Math.ceil(Date.now() / 60000) * 60000 + 14 * 86400000).toISOString());

  const handleCreateProjectSubmit = async () => {
    if (!newProjName.trim()) return;
    await run(async () => {
      const created = await api<Result>("/projects", "POST", {
        name: newProjName.trim(),
        timezone: newProjTz,
        start: newProjStart,
        deadline: newProjDeadline,
        calendar: defaultCalendar(),
        assignees: [],
        tasks: [],
        dependencies: [],
      });
      await list();
      accept(created);
      setNewProjectModal(false);
      showNotification(`Проект «${newProjName}» создан`);
    });
  };

  return {
    newProjectModal, setNewProjectModal,
    newProjName, setNewProjName,
    newProjTz, setNewProjTz,
    newProjStart, setNewProjStart,
    newProjDeadline, setNewProjDeadline,
    busy,
    handleCreateProjectSubmit,
  };
}

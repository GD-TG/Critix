import { useRef, useState } from "react";
import { useProjects } from "@/context/ProjectContext";
import { useUi } from "@/context/UiContext";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/api";
import { exportProjectToJson } from "@/shared";
import type { Result } from "@/types";

export function useProjectManageModal() {
  const { projects, saved, draft, dirty, list, run, accept, clearProject } = useProjects();
  const {
    projectManageModal, setProjectManageModal,
    setNewProjectModal, setJsonImportModal,
    deleteConfirmProject, setDeleteConfirmProject,
    showNotification,
  } = useUi();
  const { busy } = useAuth();

  const handleLoadDemoProject = async () => {
    await run(async () => {
      const created = await api<Result>("/demo", "POST");
      await list();
      accept(created);
      setProjectManageModal(false);
      showNotification("Демо-проект «Запуск клиентского портала» успешно загружен!");
    });
  };

  const handleDeleteProject = async (id: string) => {
    await run(async () => {
      await api(`/projects/${id}`, "DELETE");
      showNotification("Проект успешно удален");
      const updatedList = await list();
      setDeleteConfirmProject(null);
      if (saved?.id === id) {
        if (updatedList.length > 0) {
          accept(await api<Result>(`/projects/${updatedList[0].id}`));
        } else {
          clearProject();
        }
      }
    });
  };

  const [switchingId, setSwitchingId] = useState<string | null>(null);
  const switchGen = useRef(0);

  const switchProject = (id: string, name: string) => {
    if (dirty && !window.confirm("В текущем проекте есть несохранённые изменения. Переключить проект без сохранения?")) {
      return;
    }
    switchGen.current += 1;
    const currentGen = switchGen.current;
    setSwitchingId(id);

    void run(async () => {
      try {
        const result = await api<Result>(`/projects/${id}`);
        if (switchGen.current === currentGen) {
          accept(result);
          setProjectManageModal(false);
          showNotification(`Переключено на проект «${name}»`);
        }
      } finally {
        if (switchGen.current === currentGen) {
          setSwitchingId(null);
        }
      }
    });
  };

  const exportCurrent = () => {
    if (draft) exportProjectToJson(draft);
  };

  return {
    projects, saved, draft, dirty, busy, switchingId,
    projectManageModal, setProjectManageModal,
    setNewProjectModal, setJsonImportModal,
    deleteConfirmProject, setDeleteConfirmProject,
    handleLoadDemoProject,
    handleDeleteProject,
    switchProject,
    exportCurrent,
  };
}

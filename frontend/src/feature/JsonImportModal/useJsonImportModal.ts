import { useState } from "react";
import { useProjects } from "@/context/ProjectContext";
import { useUi } from "@/context/UiContext";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/api";
import { parseJsonToProject } from "@/shared";
import type { Result } from "@/types";

export function useJsonImportModal() {
  const { draft, change, run, list, accept } = useProjects();
  const { jsonImportModal, setJsonImportModal, showNotification } = useUi();
  const { busy } = useAuth();
  const [jsonInput, setJsonInput] = useState("");
  const [jsonImportError, setJsonImportError] = useState("");

  const close = () => {
    setJsonImportModal(false);
    setJsonInput("");
    setJsonImportError("");
  };

  const replaceDraft = () => {
    try {
      const parsed = parseJsonToProject(jsonInput);
      change(parsed);
      setJsonImportModal(false);
      setJsonInput("");
      showNotification(`Проект «${parsed.name}» загружен в текущий черновик`);
    } catch (err: any) {
      setJsonImportError(err?.message || "Ошибка структуры JSON");
    }
  };

  const createAsNew = () => {
    void run(async () => {
      try {
        const parsed = parseJsonToProject(jsonInput);
        const created = await api<Result>("/projects", "POST", parsed);
        await list();
        accept(created);
        setJsonImportModal(false);
        setJsonInput("");
        showNotification(`Проект «${parsed.name}» создан и открыт`);
      } catch (err: any) {
        setJsonImportError(err?.message || "Ошибка создания проекта через API");
      }
    });
  };

  return {
    draft,
    jsonImportModal, setJsonImportModal,
    jsonInput, setJsonInput,
    jsonImportError, setJsonImportError,
    busy,
    close,
    replaceDraft,
    createAsNew,
  };
}

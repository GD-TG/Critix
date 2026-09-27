import { useApp } from "@/context/AppContext";
import { api } from "@/api";
import { copy } from "@/shared";
import type { Result } from "@/types";

export function useDraftBanner() {
  const {
    draft, saved, preview, dirty, busy, run, list,
    setDraft, setPreview,
    accept: acceptFromCtx,
  } = useApp();

  const affected = new Set(preview?.changes?.changed_task_ids || []);

  const accept = (result: Result) => acceptFromCtx(result);

  const handleCancel = () => {
    setDraft(copy(saved!.project));
    setPreview(null);
  };

  const handlePreview = () =>
    void run(async () =>
      setPreview(
        await api<Result>(
          `/projects/${saved!.id}/simulate`,
          "POST",
          { version: saved!.version, project: draft },
        ),
      ),
    );

  const handleApply = () =>
    void run(async () => {
      accept(
        await api<Result>(
          `/projects/${saved!.id}`,
          "PUT",
          { version: saved!.version, project: draft },
        ),
      );
      await list();
    });

  return {
    draft,
    saved,
    preview,
    dirty,
    busy,
    affected,
    handleCancel,
    handlePreview,
    handleApply,
  };
}

import { useUi } from "@/context/UiContext";

export function useHelpModal() {
  const { helpModal, setHelpModal } = useUi();
  return { helpModal, setHelpModal };
}

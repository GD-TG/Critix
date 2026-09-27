import { useUi } from "@/context/UiContext";

export function useToast() {
  const { toast } = useUi();
  return { toast };
}

import { useToast } from "@/feature/Toast/useToast";

export function Toast() {
  const { toast } = useToast();

  return (
    <div className={`toast ${toast ? "show" : ""}`} role="status">
      {toast}
    </div>
  );
}

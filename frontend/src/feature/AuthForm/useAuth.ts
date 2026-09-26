import { useState } from "react";
import { api } from "../../api";

type UseAuthOptions = {
  onSuccess?: () => void | Promise<void>;
};

export function useAuth({ onSuccess }: UseAuthOptions = {}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const login = async (password: string) => {
    setBusy(true);
    setError("");
    try {
      await api("/login", "POST", { password });
      if (onSuccess) await onSuccess();
      return true;
    } catch (e: any) {
      setError(e.message || "Ошибка входа");
      return false;
    } finally {
      setBusy(false);
    }
  };

  const logout = async () => {
    setBusy(true);
    setError("");
    try {
      await api("/logout", "POST");
    } catch (e: any) {
      setError(e.message || "Ошибка выхода");
    } finally {
      setBusy(false);
    }
  };

  return { busy, error, login, logout, setError };
}
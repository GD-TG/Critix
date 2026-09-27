import { useState } from "react";
import { api } from "@/api";
import { useApp } from "@/context/AppContext";
import type { Result } from "@/types";

export function useAuthForm() {
  const { login, busy, error, list, accept } = useApp();
  const [password, setPassword] = useState("");

  const handleLogin = async () => {
    const ok = await login(password);
    if (ok) {
      const data = await list();
      if (data.length > 0) {
        const result = await api<Result>(`/projects/${data[0].id}`);
        accept(result);
      }
    }
  };

  return { password, setPassword, handleLogin, busy, error };
}

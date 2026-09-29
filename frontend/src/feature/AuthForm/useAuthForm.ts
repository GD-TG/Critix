import { useState } from "react";
import { api } from "@/api";
import { useApp } from "@/context/AppContext";
import type { Result } from "@/types";

export function useAuthForm() {
  const { login, register, demoLogin, busy, error, setError, list, accept } = useApp();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");

  const loadProjectsAfterAuth = async () => {
    try {
      const data = await list();
      if (data && data.length > 0) {
        const result = await api<Result>(`/projects/${data[0].id}`);
        accept(result);
      }
    } catch {
      // Ignored
    }
  };

  const handleLogin = async () => {
    const trimmedEmail = email.trim();
    if (!password) {
      setError("Введите пароль");
      return;
    }
    const ok = trimmedEmail
      ? await login(trimmedEmail, password)
      : await login(password); // legacy fallback
    if (ok) {
      await loadProjectsAfterAuth();
    }
  };

  const handleRegister = async () => {
    const trimmedEmail = email.trim();
    const trimmedName = name.trim();
    if (!trimmedEmail) {
      setError("Укажите email");
      return;
    }
    if (!trimmedName) {
      setError("Укажите ваше имя или роль");
      return;
    }
    if (!password || password.length < 6) {
      setError("Пароль должен содержать не менее 6 символов");
      return;
    }
    const ok = await register(trimmedEmail, password, trimmedName);
    if (ok) {
      await loadProjectsAfterAuth();
    }
  };

  const handleDemoLogin = async () => {
    const ok = await demoLogin();
    if (ok) {
      await loadProjectsAfterAuth();
    }
  };

  const handleSubmit = async () => {
    if (mode === "login") {
      await handleLogin();
    } else {
      await handleRegister();
    }
  };

  return {
    mode,
    setMode,
    email,
    setEmail,
    password,
    setPassword,
    name,
    setName,
    busy,
    error,
    handleSubmit,
    handleDemoLogin,
  };
}

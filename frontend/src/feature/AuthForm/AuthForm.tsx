import { PasswordInput, Button, Alert, Title, Text, MantineProvider } from "@mantine/core";
import { useState } from "react";
import { useApp } from "@/context/AppContext";
import { api } from "@/api";
import type { Result } from "@/types";

type Props = {
  colorScheme: "dark" | "light";
  actionLogo: string;
  actionTheme: any;
};

export function AuthForm({ colorScheme, actionLogo, actionTheme }: Props) {
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

  return (
    <MantineProvider forceColorScheme={colorScheme} theme={actionTheme}>
      <main className="login-screen">
        <aside className="login-panel">
          <div className="login-statement">
            <span className="login-overline">РАБОЧЕЕ ПРОСТРАНСТВО</span>
            <h1>Проект<br />в фокусе<span>.</span></h1>
            <p>Сроки, связи и решения команды — в одном плане.</p>
          </div>
          <div className="login-panel-footer">
            <span>ПРОЕКТНОЕ УПРАВЛЕНИЕ</span>
            <span>АКТИОН</span>
          </div>
        </aside>
        <section className="login-main">
          <div className="login-form">
            <div className="login-lockup">
              <img src={actionLogo} alt="Логотип Актион" />
              <span>Актион</span>
            </div>
            <div className="login-form-heading">
              <span>ВХОД В СИСТЕМУ</span>
              <Title order={2}>С возвращением</Title>
              <Text c="dimmed" size="sm">Введите пароль руководителя, чтобы продолжить.</Text>
            </div>

            {error && <Alert color="red">{error}</Alert>}

            <PasswordInput
              label="Пароль руководителя"
              placeholder="Введите пароль"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />

            <Button
              className="login-submit"
              fullWidth
              loading={busy}
              onClick={() => void handleLogin()}
            >
              Войти в рабочее пространство
            </Button>
            <div className="login-secure-note">
              <span />Доступ только для участников команды
            </div>
          </div>
          <span className="login-copyright">© АКТИОН · ПЛАНИРОВАНИЕ ПРОЕКТОВ</span>
        </section>
      </main>
    </MantineProvider>
  );
}
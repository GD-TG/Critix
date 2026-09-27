import { PasswordInput, Button, Alert, Title, Text, MantineProvider, Group } from "@mantine/core";
import { useApp } from "@/context/AppContext";
import { actionTheme } from "@/theme";
import { CritixLogo } from "@/CritixLogo";
import { useAuthForm } from "./useAuthForm";

export function AuthForm() {
  const { colorScheme } = useApp();
  const { password, setPassword, handleLogin, busy, error } = useAuthForm();

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
            <span>CRITIX</span>
          </div>
        </aside>
        <section className="login-main">
          <div className="login-form">
            <div className="login-lockup">
              <CritixLogo size={40} />
              <span>Critix</span>
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
          <span className="login-copyright">© CRITIX · МЕТОД КРИТИЧЕСКОГО ПУТИ И УПРАВЛЕНИЕ РЕСУРСАМИ</span>
        </section>
      </main>
    </MantineProvider>
  );
}

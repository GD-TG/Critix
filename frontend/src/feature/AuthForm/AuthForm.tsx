import {
  Alert,
  Button,
  MantineProvider,
  PasswordInput,
  SegmentedControl,
  Stack,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { useApp } from "@/context/AppContext";
import { actionTheme } from "@/theme";
import { CritixLogo } from "@/CritixLogo";
import { useAuthForm } from "./useAuthForm";

export function AuthForm() {
  const { colorScheme } = useApp();
  const {
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
  } = useAuthForm();

  return (
    <MantineProvider forceColorScheme={colorScheme} theme={actionTheme}>
      <main className="login-screen">
        <aside className="login-panel">
          <div className="login-statement">
            <span className="login-overline">РАБОЧЕЕ ПРОСТРАНСТВО</span>
            <h1>
              Проект<br />в фокусе<span>.</span>
            </h1>
            <p>Сроки, связи, риски и выравнивание ресурсов — в единой системе принятия решений.</p>
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

            <SegmentedControl
              fullWidth
              value={mode}
              onChange={(val) => setMode(val as "login" | "register")}
              data={[
                { label: "Вход", value: "login" },
                { label: "Регистрация", value: "register" },
              ]}
              mb="md"
            />

            <div className="login-form-heading">
              <span>{mode === "login" ? "АВТОРИЗАЦИЯ" : "СОЗДАНИЕ АККАУНТА"}</span>
              <Title order={2}>
                {mode === "login" ? "С возвращением" : "Новый руководитель"}
              </Title>
              <Text c="dimmed" size="sm">
                {mode === "login"
                  ? "Войдите в свой аккаунт. Демо-проект доступен после входа."
                  : "Зарегистрируйтесь для ведения собственных проектов с изоляцией данных."}
              </Text>
            </div>

            {error && <Alert color="red" mb="xs">{error}</Alert>}

            <Stack gap="xs">
              {mode === "register" && (
                <TextInput
                  label="Ваше имя"
                  placeholder="Иван Петров"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              )}

              <TextInput
                label="Email"
                placeholder={mode === "login" ? "pm@critix.ru (или оставьте пустым)" : "pm@critix.ru"}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />

              <PasswordInput
                label="Пароль"
                placeholder="Введите пароль"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !busy) void handleSubmit();
                }}
                required
              />

              <Button
                className="login-submit"
                fullWidth
                loading={busy}
                onClick={() => void handleSubmit()}
                mt="xs"
              >
                {mode === "login" ? "Войти в систему" : "Зарегистрироваться"}
              </Button>

            </Stack>

            <div className="login-secure-note" style={{ marginTop: 14 }}>
              <span />Индивидуальная рабочая область для каждого аккаунта
            </div>
          </div>
          <span className="login-copyright">
            © CRITIX · МЕТОД КРИТИЧЕСКОГО ПУТИ И УПРАВЛЕНИЕ РЕСУРСАМИ
          </span>
        </section>
      </main>
    </MantineProvider>
  );
}

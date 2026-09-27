import React, { Component, type ErrorInfo, type ReactNode } from "react";
import { Alert, Button, Card, Stack, Text, Title } from "@mantine/core";
import { AlertTriangle, RotateCcw } from "lucide-react";

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <Card withBorder p="xl" radius="md" style={{ margin: "24px 0", background: "var(--bg-card, #fff)" }}>
          <Stack gap="md" align="center" style={{ textAlign: "center" }}>
            <div style={{ color: "#d20a2e" }}>
              <AlertTriangle size={40} />
            </div>
            <Title order={4}>{this.props.fallbackTitle || "В этом представлении произошла непредвиденная ошибка"}</Title>
            <Text size="sm" c="dimmed" style={{ maxWidth: 500 }}>
              Не удалось отобразить раздел. Сбой отображения не сохраняет изменения: проверьте черновик и последнюю сохранённую версию проекта.
            </Text>
            {this.state.error && (
              <Alert color="red" variant="light" style={{ width: "100%", maxWidth: 600, textAlign: "left" }}>
                <Text size="xs" style={{ fontFamily: "monospace", wordBreak: "break-all" }}>
                  {this.state.error.message || String(this.state.error)}
                </Text>
              </Alert>
            )}
            <Button
              leftSection={<RotateCcw size={14} />}
              color="dark"
              size="xs"
              onClick={this.handleReset}
            >
              Сбросить представление и продолжить
            </Button>
          </Stack>
        </Card>
      );
    }

    return this.props.children;
  }
}

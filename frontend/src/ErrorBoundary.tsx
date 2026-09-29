import React, { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RotateCcw, RefreshCw } from "lucide-react";

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
        <div
          role="alert"
          style={{
            margin: "24px auto",
            maxWidth: 640,
            padding: "24px 28px",
            borderRadius: 12,
            border: "1px solid var(--border-color, #e2e8f0)",
            background: "var(--bg-card, #ffffff)",
            color: "var(--text-primary, #1e293b)",
            boxShadow: "0 4px 12px rgba(0, 0, 0, 0.06)",
            fontFamily: "var(--mantine-font-family, system-ui, -apple-system, sans-serif)",
            textAlign: "center",
          }}
        >
          <div style={{ color: "#d20a2e", marginBottom: 12, display: "flex", justifyContent: "center" }}>
            <AlertTriangle size={42} strokeWidth={2.2} />
          </div>

          <h3
            style={{
              margin: "0 0 8px",
              fontSize: "1.15rem",
              fontWeight: 700,
              color: "#0f172a",
            }}
          >
            {this.props.fallbackTitle || "В этом представлении произошла непредвиденная ошибка"}
          </h3>

          <p
            style={{
              margin: "0 0 16px",
              fontSize: "0.875rem",
              color: "#64748b",
              lineHeight: 1.5,
            }}
          >
            Не удалось отобразить раздел. Сбой отображения не сохраняет изменения: проверьте черновик и последнюю сохранённую версию проекта.
          </p>

          {this.state.error && (
            <div
              style={{
                margin: "0 0 18px",
                padding: "10px 14px",
                borderRadius: 8,
                background: "#fef2f2",
                border: "1px solid #fee2e2",
                color: "#991b1b",
                fontSize: "0.8rem",
                fontFamily: "monospace",
                textAlign: "left",
                wordBreak: "break-all",
                maxHeight: 160,
                overflowY: "auto",
              }}
            >
              {this.state.error.message || String(this.state.error)}
            </div>
          )}

          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={this.handleReset}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "8px 16px",
                borderRadius: 6,
                border: "none",
                background: "#0f172a",
                color: "#ffffff",
                fontSize: "0.85rem",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              <RotateCcw size={14} />
              Попробовать снова
            </button>

            <button
              type="button"
              onClick={() => window.location.reload()}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "8px 16px",
                borderRadius: 6,
                border: "1px solid #cbd5e1",
                background: "#ffffff",
                color: "#334155",
                fontSize: "0.85rem",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              <RefreshCw size={14} />
              Перезагрузить страницу
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

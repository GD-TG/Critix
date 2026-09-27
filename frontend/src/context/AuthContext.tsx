import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";
import { api } from "@/api";

interface AuthContextValue {
  logged: boolean;
  setLogged: (v: boolean) => void;
  busy: boolean;
  setBusy: (v: boolean) => void;
  error: string;
  setError: (v: string) => void;
  login: (password: string) => Promise<boolean>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [logged, setLogged] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const login = useCallback(async (password: string) => {
    setBusy(true);
    setError("");
    try {
      await api("/login", "POST", { password });
      setLogged(true);
      return true;
    } catch (e: any) {
      setError(e.message || "Ошибка входа");
      return false;
    } finally {
      setBusy(false);
    }
  }, []);

  const logout = useCallback(async () => {
    await api("/logout", "POST");
    setLogged(false);
  }, []);

  const value: AuthContextValue = {
    logged, setLogged,
    busy, setBusy,
    error, setError,
    login, logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth должен использоваться внутри AuthProvider");
  return context;
}

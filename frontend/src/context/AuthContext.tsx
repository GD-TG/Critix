import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { api } from "@/api";
import type { User } from "@/types";

interface AuthContextValue {
  user: User | null;
  logged: boolean;
  setLogged: (v: boolean) => void;
  busy: boolean;
  setBusy: (v: boolean) => void;
  error: string;
  setError: (v: string) => void;
  login: (emailOrPassword: string, password?: string) => Promise<boolean>;
  register: (email: string, password: string, name: string) => Promise<boolean>;
  demoLogin: () => Promise<boolean>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [logged, setLogged] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const checkAuth = useCallback(async () => {
    try {
      const me = await api<User>("/auth/me");
      if (me && me.id) {
        setUser(me);
        setLogged(true);
      }
    } catch {
      // Not logged in or session expired
      setLogged(false);
      setUser(null);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const login = useCallback(async (emailOrPassword: string, password?: string) => {
    setBusy(true);
    setError("");
    try {
      if (password !== undefined) {
        // Multi-user login
        const res = await api<User>("/auth/login", "POST", {
          email: emailOrPassword,
          password,
        });
        setUser(res);
      } else {
        // Legacy single-password login fallback
        await api("/login", "POST", { password: emailOrPassword });
        try {
          const me = await api<User>("/auth/me");
          setUser(me);
        } catch {
          // Keep null if transient
        }
      }
      setLogged(true);
      return true;
    } catch (e: any) {
      setError(e.message || "Ошибка входа");
      return false;
    } finally {
      setBusy(false);
    }
  }, []);

  const register = useCallback(async (email: string, password: string, name: string) => {
    setBusy(true);
    setError("");
    try {
      const res = await api<User>("/auth/register", "POST", {
        email,
        password,
        name,
      });
      setUser(res);
      setLogged(true);
      return true;
    } catch (e: any) {
      setError(e.message || "Ошибка регистрации");
      return false;
    } finally {
      setBusy(false);
    }
  }, []);

  const demoLogin = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      const res = await api<User>("/auth/demo", "POST");
      setUser(res);
      setLogged(true);
      return true;
    } catch (e: any) {
      setError(e.message || "Ошибка быстрого входа");
      return false;
    } finally {
      setBusy(false);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await api("/auth/logout", "POST");
    } catch {
      await api("/logout", "POST");
    }
    setUser(null);
    setLogged(false);
  }, []);

  const value: AuthContextValue = {
    user,
    logged,
    setLogged,
    busy,
    setBusy,
    error,
    setError,
    login,
    register,
    demoLogin,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth должен использоваться внутри AuthProvider");
  return context;
}

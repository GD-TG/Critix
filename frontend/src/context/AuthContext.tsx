import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
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
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [logged, setLogged] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const authGen = useRef(0);

  const checkAuth = useCallback(async () => {
    const gen = ++authGen.current;
    try {
      const me = await api<User>("/auth/me");
      if (authGen.current !== gen) return;
      if (me && me.id) {
        setUser(me);
        setLogged(true);
      } else {
        setUser(null);
        setLogged(false);
      }
    } catch {
      if (authGen.current === gen) {
        setLogged(false);
        setUser(null);
      }
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const login = useCallback(async (emailOrPassword: string, password?: string) => {
    const gen = ++authGen.current;
    setBusy(true);
    setError("");
    try {
      if (password !== undefined) {
        // Multi-user login
        const res = await api<User>("/auth/login", "POST", {
          email: emailOrPassword,
          password,
        });
        if (authGen.current !== gen) return false;
        setUser(res);
      } else {
        // Legacy single-password login fallback
        await api("/login", "POST", { password: emailOrPassword });
        if (authGen.current !== gen) return false;
        try {
          const me = await api<User>("/auth/me");
          if (authGen.current === gen) {
            setUser(me);
          }
        } catch {
          // Keep null if transient
        }
      }
      if (authGen.current === gen) {
        setLogged(true);
      }
      return true;
    } catch (e: any) {
      if (authGen.current === gen) {
        setError(e.message || "Ошибка входа");
      }
      return false;
    } finally {
      if (authGen.current === gen) {
        setBusy(false);
      }
    }
  }, []);

  const register = useCallback(async (email: string, password: string, name: string) => {
    const gen = ++authGen.current;
    setBusy(true);
    setError("");
    try {
      const res = await api<User>("/auth/register", "POST", {
        email,
        password,
        name,
      });
      if (authGen.current !== gen) return false;
      setUser(res);
      setLogged(true);
      return true;
    } catch (e: any) {
      if (authGen.current === gen) {
        setError(e.message || "Ошибка регистрации");
      }
      return false;
    } finally {
      if (authGen.current === gen) {
        setBusy(false);
      }
    }
  }, []);

  const logout = useCallback(async () => {
    authGen.current += 1;
    setUser(null);
    setLogged(false);
    try {
      await api("/auth/logout", "POST");
    } catch {
      await api("/logout", "POST");
    }
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
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth должен использоваться внутри AuthProvider");
  return context;
}

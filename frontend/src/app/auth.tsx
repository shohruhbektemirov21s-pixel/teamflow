import { useQueryClient } from "@tanstack/react-query";
import { createContext, type ReactNode, useCallback, useContext, useEffect, useState } from "react";

import { api, ApiError, UNAUTHORIZED_EVENT } from "@/shared/api";
import type { Me } from "@/shared/types";

interface AuthState {
  user: Me | null;
  ready: boolean;
  login: (username: string, password: string) => Promise<Me>;
  logout: () => Promise<void>;
}

const AuthCtx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Me | null>(null);
  const [ready, setReady] = useState(false);
  const qc = useQueryClient();

  useEffect(() => {
    (async () => {
      try {
        await api.get("/auth/csrf/");
        setUser(await api.get<Me>("/auth/me/"));
      } catch (e) {
        if (!(e instanceof ApiError) || e.status !== 401) console.error(e);
        setUser(null);
      } finally {
        setReady(true);
      }
    })();
  }, []);

  // Sessiya tugasa (401) — login sahifasiga
  useEffect(() => {
    const onUnauthorized = () => {
      setUser((prev) => {
        if (prev !== null) {
          qc.clear();
          return null;
        }
        return prev;
      });
    };
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
  }, [qc]);

  const login = useCallback(async (username: string, password: string) => {
    const me = await api.post<Me>("/auth/login/", { username, password });
    await api.get("/auth/csrf/"); // login'dan keyin CSRF token yangilanadi
    setUser(me);
    return me;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post("/auth/logout/");
    } finally {
      setUser(null);
      qc.clear();
      await api.get("/auth/csrf/").catch(() => {});
    }
  }, [qc]);

  return <AuthCtx.Provider value={{ user, ready, login, logout }}>{children}</AuthCtx.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("AuthProvider yo'q");
  return ctx;
}

/** Faqat kirgan foydalanuvchi ichida ishlatiladi. */
export function useMe(): Me {
  const { user } = useAuth();
  if (!user) throw new Error("Foydalanuvchi kirmagan");
  return user;
}

export const isManager = (u: Me) => u.role === "pm" || u.role === "boss";

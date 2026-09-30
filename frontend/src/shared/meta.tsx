/**
 * Ma'lumotnomalar — BACKENDDAN (`/api/meta/`): rollar, muhimlik, holatlar, loyiha darajalari va
 * joriy rol uchun ruxsat etilgan vazifa o'tishlari. Frontendda bu ro'yxatlar qattiq yozilmaydi.
 */
import { useQuery } from "@tanstack/react-query";
import { createContext, type ReactNode, useContext, useEffect, useState } from "react";

import { api } from "./api";
import { T } from "./text";

export interface Choice<V extends string = string> {
  value: V;
  label: string;
}

export interface MetaData {
  roles: Choice[];
  register_roles: Choice[];
  priorities: Choice[];
  task_statuses: Choice[];
  order_statuses: Choice[];
  project_stages: Choice[];
  task_moves: { from: string; to: string }[];
  /** Telegram bot username'i (`@` siz); bot ulanmagan bo'lsa bo'sh */
  telegram_bot: string;
}

export type MetaGroup = Exclude<keyof MetaData, "task_moves" | "telegram_bot">;

const Ctx = createContext<MetaData | null>(null);

export function MetaProvider({ userKey, children }: { userKey: string | number; children: ReactNode }) {
  // Kalit foydalanuvchiga bog'liq: `task_moves` rolga qarab o'zgaradi
  const query = useQuery({
    queryKey: ["meta", userKey],
    queryFn: () => api.get<MetaData>("/meta/"),
    staleTime: 5 * 60 * 1000,
    retry: 2,
  });

  const [timedOut, setTimedOut] = useState(false);
  useEffect(() => {
    if (query.data) {
      setTimedOut(false);
      return;
    }
    const t = setTimeout(() => setTimedOut(true), 3000);
    return () => clearTimeout(t);
  }, [query.data, query.fetchStatus]);

  if (query.error) {
    return (
      <div className="page" style={{ maxWidth: 440, margin: "80px auto", textAlign: "center" }}>
        <div className="callout tone-danger" style={{ marginBottom: 16 }}>
          {query.error.message || T.common.errorGeneric}
        </div>
        <button className="btn btn-primary" onClick={() => query.refetch()}>
          {T.common.retry}
        </button>
      </div>
    );
  }

  if (!query.data) {
    return (
      <div className="page" style={{ maxWidth: 440, margin: "80px auto", display: "flex", flexDirection: "column", gap: 16, alignItems: "center" }}>
        <div className="skeleton" style={{ height: 280, width: "100%", borderRadius: "var(--radius)" }} />
        {timedOut && (
          <div className="row" style={{ gap: 12 }}>
            <span className="small muted">{T.common.loading}...</span>
            <button className="btn btn-sm btn-primary" onClick={() => query.refetch()}>
              {T.common.retry}
            </button>
          </div>
        )}
      </div>
    );
  }

  return <Ctx.Provider value={query.data}>{children}</Ctx.Provider>;
}

export function useMeta() {
  const data = useContext(Ctx);
  if (!data) throw new Error("MetaProvider yo'q");
  return {
    ...data,
    /** Qiymat → server bergan nom */
    label: (group: MetaGroup, value: string) => data[group].find((c) => c.value === value)?.label ?? value,
    /** Guruhdagi qiymatlar tartibi (server tartibida) */
    values: <V extends string>(group: MetaGroup) => data[group].map((c) => c.value as V),
    options: <V extends string>(group: MetaGroup) => data[group] as Choice<V>[],
  };
}

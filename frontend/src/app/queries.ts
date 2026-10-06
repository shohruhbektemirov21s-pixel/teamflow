import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, qs } from "@/shared/api";
import { useState } from "react";
import type { Dashboard, Developer, Me, Paged, Project } from "@/shared/types";

import type { Counter } from "./nav";

export function usePagedList<T>(baseKey: readonly unknown[], path: string,
  params: Record<string, string | number | undefined>, enabled = true) {
  const filterKey = JSON.stringify([baseKey, params]);
  const [position, setPosition] = useState({ filterKey, page: 1 });
  const page = position.filterKey === filterKey ? position.page : 1;
  if (position.filterKey !== filterKey) setPosition({ filterKey, page: 1 });
  const queryKey = [...baseKey, page];
  const query = useQuery({
    queryKey,
    queryFn: async () => {
      const result = await api.get<Paged<T> | T[]>(`${path}${qs({ ...params, page: page === 1 ? undefined : page })}`);
      return Array.isArray(result) ? { count: result.length, next: null, previous: null, results: result } : result;
    },
    enabled,
  });
  return { ...query, data: query.data?.results, pagination: query.data, page, queryKey,
    onPageChange: (nextPage: number) => setPosition({ filterKey, page: nextPage }) };
}

/** O'zgargan bo'limlarning keshini yangilash; domains berilmasa barcha ma'lumotlar yangilanadi. */
export function useRefresh(domains?: readonly string[]) {
  const qc = useQueryClient();
  return () => qc.invalidateQueries(domains ? { predicate: (query) => domains.includes(String(query.queryKey[0])) } : undefined);
}

/** O'qilmagan bildirishnomalar soni (yon panel, sarlavha va Bildirishnomalar sahifasi — bitta kesh). */
export function useUnreadCount() {
  return useQuery({
    queryKey: ["notifications", "unread"],
    queryFn: () => api.get<{ count: number }>("/notifications/unread_count/"),
    refetchInterval: 30_000,
    select: (d) => d.count,
  });
}

/** Yon paneldagi raqamlar. */
export function useCounters(me: Me): Record<Counter, number> {
  const notif = useUnreadCount();
  const dash = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => api.get<Dashboard>("/dashboard/"),
    enabled: me.role !== "department",
    refetchInterval: 60_000,
  });
  return {
    notifications: notif.data ?? 0,
    myWork: me.role === "developer" ? (dash.data?.totals.active ?? 0) : 0,
    review: dash.data?.totals.review ?? 0,
    orders: dash.data?.orders_pending ?? 0,
  };
}

export function useProjects(enabled = true) {
  return useQuery({
    queryKey: ["projects", "all"],
    queryFn: async () => {
      const projects: Pick<Project, "id" | "name" | "code">[] = [];
      let page = 1;
      let result: Paged<Pick<Project, "id" | "name" | "code">>;
      do {
        result = await api.get<typeof result>(`/projects/lookup/${qs({ page_size: 100, page: page === 1 ? undefined : page })}`);
        projects.push(...result.results);
        page += 1;
      } while (result.next);
      return projects;
    },
    enabled,
    staleTime: 60_000,
  });
}

export function useDevelopers(enabled = true, search = "", ids: readonly number[] = []) {
  const selected = [...ids].sort((a, b) => a - b).join(",");
  return useQuery({
    queryKey: ["developers", search, selected],
    queryFn: () => api.get<Developer[]>(`/developers/${qs({ q: search, ids: selected })}`),
    placeholderData: keepPreviousData,
    enabled,
    staleTime: 5 * 60_000,
  });
}

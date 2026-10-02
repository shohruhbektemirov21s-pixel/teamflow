import { useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/shared/api";
import type { Dashboard, Developer, Me, Paged, Project } from "@/shared/types";

import type { Counter } from "./nav";

/** Mutatsiyadan keyin barcha ro'yxat va hisoblagichlarni yangilash (ma'lumot hajmi kichik — sodda va ishonchli). */
export function useRefresh() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries();
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
      const projects: Project[] = [];
      let page = 1;
      let result: Paged<Project>;
      do {
        result = await api.get<Paged<Project>>(`/projects/${page === 1 ? "" : `?page=${page}`}`);
        projects.push(...result.results);
        page += 1;
      } while (result.next);
      return projects;
    },
    enabled,
  });
}

export function useDevelopers(enabled = true) {
  return useQuery({
    queryKey: ["developers"],
    queryFn: () => api.get<Developer[]>("/developers/"),
    enabled,
  });
}

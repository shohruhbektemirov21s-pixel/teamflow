import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { api } from "@/shared/api";

import { usePagedList, useProjects, useRefresh } from "./queries";

it("faqat o'zgargan bo'limlarni yangilab, qolgan keshni saqlaydi", async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(["notifications", "unread"], { count: 1 });
  client.setQueryData(["dashboard"], { totals: {} });
  client.setQueryData(["tasks"], []);
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  const { result } = renderHook(() => useRefresh(["notifications"]), { wrapper });
  await result.current();
  expect(client.getQueryState(["notifications", "unread"])?.isInvalidated).toBe(true);
  expect(client.getQueryState(["dashboard"])?.isInvalidated).toBe(false);
  expect(client.getQueryState(["tasks"])?.isInvalidated).toBe(false);
  client.clear();
});

describe("useProjects", () => {
  it("loyiha tanlash uchun keyingi sahifalarni ham oladi", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    vi.mocked(api.get).mockImplementation(async (path) => {
      if (path === "/projects/lookup/?page_size=100") return { count: 101, next: "/api/projects/lookup/?page=2", previous: null, results: [{ id: 1, name: "Birinchi" }] } as never;
      if (path === "/projects/lookup/?page_size=100&page=2") return { count: 101, next: null, previous: "/api/projects/lookup/", results: [{ id: 101, name: "Yuz birinchi" }] } as never;
      throw new Error(`Kutilmagan GET: ${path}`);
    });
    const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;

    const { result } = renderHook(() => useProjects(), { wrapper });

    await waitFor(() => expect(result.current.data?.map((p) => p.id)).toEqual([1, 101]));
  });
});

it("sahifalangan ro'yxat ikkinchi sahifani oladi va filtr almashganda birinchiga qaytadi", async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  vi.mocked(api.get).mockImplementation(async (path) => ({
    count: 120, next: "next", previous: path.includes("page=2") ? "previous" : null,
    results: [{ id: path.includes("page=2") ? 51 : path.includes("q=new") ? 99 : 1 }],
  }) as never);
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  const { result, rerender } = renderHook(({ q }) => usePagedList<{ id: number }>(["people", q], "/people/", { q }),
    { wrapper, initialProps: { q: "old" } });
  await waitFor(() => expect(result.current.data?.[0]?.id).toBe(1));
  act(() => result.current.onPageChange(2));
  await waitFor(() => expect(result.current.data?.[0]?.id).toBe(51));
  expect(result.current.pagination?.count).toBe(120);
  rerender({ q: "new" });
  await waitFor(() => expect(result.current.data?.[0]?.id).toBe(99));
  expect(result.current.page).toBe(1);
  rerender({ q: "old" });
  await waitFor(() => expect(result.current.data?.[0]?.id).toBe(1));
  expect(result.current.page).toBe(1);
  client.clear();
});

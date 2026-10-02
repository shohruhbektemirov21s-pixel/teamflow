import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { api } from "@/shared/api";

import { useProjects } from "./queries";

describe("useProjects", () => {
  it("loyiha tanlash uchun keyingi sahifalarni ham oladi", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    vi.mocked(api.get).mockImplementation(async (path) => {
      if (path === "/projects/") return { count: 51, next: "/api/projects/?page=2", previous: null, results: [{ id: 1, name: "Birinchi" }] } as never;
      if (path === "/projects/?page=2") return { count: 51, next: null, previous: "/api/projects/", results: [{ id: 51, name: "Ellik birinchi" }] } as never;
      throw new Error(`Kutilmagan GET: ${path}`);
    });
    const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;

    const { result } = renderHook(() => useProjects(), { wrapper });

    await waitFor(() => expect(result.current.data?.map((p) => p.id)).toEqual([1, 51]));
  });
});

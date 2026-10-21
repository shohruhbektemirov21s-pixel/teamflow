import { fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { api } from "@/shared/api";
import { listStats } from "@/test/fixtures";
import { mockGet, renderApp } from "@/test/render";

import ProjectsPage from "./ProjectsPage";

const project = (over: Record<string, unknown>) => ({
  id: 1, code: "PRJ-1", name: "Portal", description: "", stage: "started", start_date: "2026-09-01", end_date: "2026-11-01",
  order_id: null, members: [], progress: { total: 0, done: 0 }, created_at: "2026-09-01T10:00:00Z", ...over,
});

describe("ProjectsPage", () => {
  it("keyingi sahifani ochadi va qidiruvda birinchi sahifaga qaytadi", async () => {
    mockGet({
      "/projects/stats/": listStats(),
      "/projects/?page_size=10": { count: 51, next: "/api/projects/?page=2", previous: null, results: [] },
      "/projects/?page_size=10&page=2": { count: 51, next: null, previous: "/api/projects/", results: [project({ id: 51, name: "Ellik birinchi loyiha" })] },
      "/projects/?q=portal&page_size=10": { count: 0, next: null, previous: null, results: [] },
    });
    renderApp(<ProjectsPage />);

    fireEvent.click(await screen.findByRole("button", { name: /Keyingi/ }));
    expect(await screen.findByText("Ellik birinchi loyiha")).toBeTruthy();

    fireEvent.change(screen.getByRole("textbox", { name: "Qidirish" }), { target: { value: "portal" } });
    await waitFor(() => expect(api.get).toHaveBeenCalledWith("/projects/?q=portal&page_size=10"));
  });

  it("ro'yxatda loyiha nomi ostida izoh ko'rinmaydi; ko'rsatkichlar serverdan", async () => {
    mockGet({
      "/projects/stats/": listStats({ totals: { all: 42, planned: 3, started: 5, pending_approval: 2, done: 7 } }),
      "/projects/?page_size=10": { count: 1, next: null, previous: null, results: [project({ description: "Uzun loyiha izohi" })] },
    });
    renderApp(<ProjectsPage />);

    expect(await screen.findByText("Portal")).toBeTruthy();
    expect(screen.queryByText("Uzun loyiha izohi")).toBeNull();
    expect(await screen.findByText("Barcha loyihalar")).toBeTruthy();
    expect(await screen.findByText("1 ta loyiha")).toBeTruthy();
  });
});

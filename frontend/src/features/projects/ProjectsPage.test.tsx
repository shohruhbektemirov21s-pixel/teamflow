import { fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { api } from "@/shared/api";
import { mockGet, renderApp } from "@/test/render";

import ProjectsPage from "./ProjectsPage";

describe("ProjectsPage", () => {
  it("keyingi sahifani ochadi va qidiruvda birinchi sahifaga qaytadi", async () => {
    mockGet({
      "/projects/": { count: 51, next: "/api/projects/?page=2", previous: null, results: [] },
      "/projects/?page=2": { count: 51, next: null, previous: "/api/projects/", results: [
        { id: 51, code: "200000051", name: "Ellik birinchi loyiha", description: "", stage: "started",
          start_date: "2026-09-01", end_date: "2026-11-01", order_id: null, members: [],
          progress: { total: 0, done: 0 }, created_at: "2026-09-01T10:00:00Z" },
      ] },
      "/projects/?q=portal": { count: 0, next: null, previous: null, results: [] },
    });
    renderApp(<ProjectsPage />);

    fireEvent.click(await screen.findByRole("button", { name: /Keyingi/ }));
    expect(await screen.findByText("Ellik birinchi loyiha")).toBeTruthy();

    fireEvent.change(screen.getByRole("textbox", { name: "Qidirish" }), { target: { value: "portal" } });
    await waitFor(() => expect(api.get).toHaveBeenCalledWith("/projects/?q=portal"));
  });

  it("ro'yxatda loyiha nomi ostida izoh ko'rinmaydi", async () => {
    mockGet({
      "/projects/": { count: 1, next: null, previous: null, results: [
        { id: 1, code: "PRJ-1", name: "Portal", description: "Uzun loyiha izohi", stage: "started",
          start_date: "2026-09-01", end_date: "2026-11-01", order_id: null, members: [],
          progress: { total: 0, done: 0 }, created_at: "2026-09-01T10:00:00Z" },
      ] },
    });
    renderApp(<ProjectsPage />);

    expect(await screen.findByText("Portal")).toBeTruthy();
    expect(screen.queryByText("Uzun loyiha izohi")).toBeNull();
  });
});

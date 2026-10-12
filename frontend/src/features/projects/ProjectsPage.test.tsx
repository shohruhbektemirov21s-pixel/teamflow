import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ModalHost } from "@/app/modals";
import { api } from "@/shared/api";
import { T } from "@/shared/text";
import type { Project } from "@/shared/types";
import { PM, testUser } from "@/test/fixtures";
import { mockGet, renderApp } from "@/test/render";

import ProjectsPage from "./ProjectsPage";

const project = (over: Partial<Project> = {}): Project => ({
  id: 1, code: "PRJ-1", name: "Portal", description: "Ichki portal haqida", stage: "started",
  start_date: "2026-09-01", end_date: "2026-11-01", order_id: null, members: [],
  progress: { total: 4, done: 1 }, created_at: "2026-09-01T10:00:00Z",
  status: "active", technologies: ["Django", "React"], cover: null, ...over,
});
const page = (...rows: Project[]) => ({ count: rows.length, next: null, previous: null, results: rows });

afterEach(() => {
  testUser.current = PM;
  localStorage.clear();
});

describe("ProjectsPage", () => {
  it("keyingi sahifani ochadi va qidiruvda birinchi sahifaga qaytadi", async () => {
    mockGet({
      "/projects/": { count: 51, next: "/api/projects/?page=2", previous: null, results: [] },
      "/projects/?page=2": { count: 51, next: null, previous: "/api/projects/", results: [project({ id: 51, name: "Ellik birinchi loyiha" })] },
      "/projects/?q=portal": page(),
    });
    renderApp(<ProjectsPage />);

    fireEvent.click(await screen.findByRole("button", { name: /Keyingi/ }));
    expect(await screen.findByText("Ellik birinchi loyiha")).toBeTruthy();

    fireEvent.change(screen.getByRole("textbox", { name: "Qidirish" }), { target: { value: "portal" } });
    await waitFor(() => expect(api.get).toHaveBeenCalledWith("/projects/?q=portal"));
  });

  it("kartada tavsif, holat, sanalar, texnologiyalar, progress va 'Ko'rish' tugmasi bor", async () => {
    mockGet({ "/projects/": page(project()) });
    renderApp(<ProjectsPage />);

    expect(await screen.findByText("Portal")).toBeTruthy();
    expect(screen.getByText("Ichki portal haqida")).toBeTruthy();
    expect(screen.getByText(T.projects.status.active, { selector: ".badge" })).toBeTruthy();
    expect(screen.getByText(T.projects.period("01.09.2026", "01.11.2026"))).toBeTruthy();
    expect(screen.getByText("Django")).toBeTruthy();
    expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("25");
    expect(screen.getByRole("button", { name: T.projects.view })).toBeTruthy();
  });

  it("holat filtri serverdan so'raydi: Bajarilgan, Jarayonda, Kechikkan", async () => {
    mockGet({
      "/projects/": page(project()),
      "/projects/?status=done": page(project({ id: 2, name: "Tugagan ish", status: "done" })),
      "/projects/?status=overdue": page(project({ id: 3, name: "Kechikkan ish", status: "overdue" })),
    });
    renderApp(<ProjectsPage />);
    await screen.findByText("Portal");
    const group = screen.getByRole("group", { name: T.projects.statusFilter });
    expect(within(group).getAllByRole("button").map((b) => b.textContent)).toEqual([T.common.all, "Bajarilgan", "Jarayonda", "Kechikkan"]);

    fireEvent.click(within(group).getByRole("button", { name: "Bajarilgan" }));
    expect(await screen.findByText("Tugagan ish")).toBeTruthy();
    fireEvent.click(within(group).getByRole("button", { name: "Kechikkan" }));
    expect(await screen.findByText("Kechikkan ish")).toBeTruthy();
  });

  it("ro'yxat ko'rinishiga o'tadi va tanlov eslab qolinadi", async () => {
    mockGet({ "/projects/": page(project()) });
    renderApp(<ProjectsPage />);
    await screen.findByText("Portal");

    fireEvent.click(screen.getByRole("button", { name: T.projects.viewList }));
    expect(localStorage.getItem("projects-view")).toBe("list");
    expect(document.querySelector(".prow")).toBeTruthy();
    expect(document.querySelector(".pcard")).toBeNull();
  });

  it("kartaga bosilganda loyiha oynasi ochiladi (alohida modal emas, mavjud ProjectModal)", async () => {
    mockGet({ "/projects/": page(project()), "/projects/1/": { ...project(), actions: {}, files: [], completion: null, stage_targets: [] } });
    renderApp(<><ProjectsPage /><ModalHost /></>);
    fireEvent.click(await screen.findByRole("button", { name: T.projects.view }));
    await waitFor(() => expect(api.get).toHaveBeenCalledWith("/projects/1/"));
  }, 20_000);

  it("'Yangi loyiha' tugmasi faqat PM/Boshliqqa chiqadi", async () => {
    mockGet({ "/projects/": page() });
    const first = renderApp(<ProjectsPage />);
    expect((await screen.findAllByRole("button", { name: T.projects.new })).length).toBeGreaterThan(0);
    first.unmount();

    testUser.current = { ...PM, role: "developer" };
    mockGet({ "/projects/": page() });
    renderApp(<ProjectsPage />);
    await screen.findByText(T.projects.empty);
    expect(screen.queryByRole("button", { name: T.projects.new })).toBeNull();
  });
});

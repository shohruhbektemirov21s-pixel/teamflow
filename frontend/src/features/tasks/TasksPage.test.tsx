import { fireEvent, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { api } from "@/shared/api";
import type { Me } from "@/shared/types";
import { listStats, PM, taskDetail, testUser } from "@/test/fixtures";
import { mockGet, renderApp } from "@/test/render";

import TasksPage from "./TasksPage";

const DEV: Me = { ...PM, id: 3, username: "jasur", full_name: "Jasur Alimov", role: "developer", role_label: "Dasturchi" };
const page = (title: string) => ({ count: 1, next: null, previous: null, results: [taskDetail({ title })] });
const STATS = { "/tasks/stats/": listStats({ tabs: { all: 5, control: 1, in_progress: 2, in_review: 0, done: 2 } }) };

afterEach(() => {
  testUser.current = PM;
});

describe("TasksPage", () => {
  it("dasturchiga faqat o'ziga biriktirilgan vazifalar so'raladi", async () => {
    testUser.current = DEV;
    mockGet({ ...STATS, "/tasks/?mine=1&page_size=10": page("Mening vazifam") });
    renderApp(<TasksPage />);

    expect(await screen.findByText("Mening vazifam")).toBeTruthy();
    expect(api.get).toHaveBeenCalledWith("/tasks/?mine=1&page_size=10");
  });

  it("menejerga hamma vazifalar so'raladi; ko'rsatkichlar va sonlar serverdan", async () => {
    mockGet({ ...STATS, "/tasks/?page_size=10": page("Jamoa vazifasi") });
    renderApp(<TasksPage />);

    expect(await screen.findByText("Jamoa vazifasi")).toBeTruthy();
    expect(api.get).not.toHaveBeenCalledWith(expect.stringContaining("mine=1"));
    expect(await screen.findByText("Barcha vazifalar")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Hammasi\s*5/ })).toBeTruthy();
    expect(screen.getByText("1 ta vazifa")).toBeTruthy();
  });

  it("holat tugmasi bosilsa shu holat bo'yicha so'raladi", async () => {
    mockGet({
      ...STATS,
      "/tasks/?page_size=10": page("Hammasi"),
      "/tasks/?status=done&page_size=10": { ...page("Tugagan vazifa"), count: 7 },
    });
    renderApp(<TasksPage />);

    fireEvent.click(await screen.findByRole("button", { name: /Bajarildi/ }));

    expect(await screen.findByText("Tugagan vazifa")).toBeTruthy();
    expect(await screen.findByText("7 ta vazifa")).toBeTruthy();
  });

  it("'Faqat kechikkanlar' va 'Men yaratganlar' tugmalari serverga filtr yuboradi", async () => {
    mockGet({
      ...STATS,
      "/tasks/?page_size=10": page("Hammasi"),
      "/tasks/?bucket=overdue&page_size=10": page("Kechikkan vazifa"),
      "/tasks/?bucket=overdue&created=me&page_size=10": page("Mening kechikkanim"),
    });
    renderApp(<TasksPage />);

    fireEvent.click(await screen.findByRole("button", { name: /Faqat kechikkanlar/ }));
    expect(await screen.findByText("Kechikkan vazifa")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Men yaratganlar/ }));
    expect(await screen.findByText("Mening kechikkanim")).toBeTruthy();
  });

  it("muhimlik filtri va Muddat sarlavhasi bilan saralash", async () => {
    mockGet({
      ...STATS,
      "/tasks/?page_size=10": page("Odatdagi"),
      "/tasks/?priority=urgent&page_size=10": page("Shoshilinch vazifa"),
      "/tasks/?priority=urgent&sort=due&page_size=10": page("Yaqini birinchi"),
      "/tasks/?priority=urgent&sort=-due&page_size=10": page("Uzog'i birinchi"),
    });
    renderApp(<TasksPage />);

    fireEvent.change(await screen.findByLabelText("Muhimlik"), { target: { value: "urgent" } });
    expect(await screen.findByText("Shoshilinch vazifa")).toBeTruthy();

    const header = await screen.findByRole("button", { name: /Muddat bo'yicha saralash/ });
    fireEvent.click(header);
    expect(await screen.findByText("Yaqini birinchi")).toBeTruthy();
    fireEvent.click(header);
    expect(await screen.findByText("Uzog'i birinchi")).toBeTruthy();
  });

  it("keyingi sahifadagi vazifani ochib ko'rsatadi", async () => {
    mockGet({
      ...STATS,
      "/tasks/?page_size=10": { ...page("Birinchi vazifa"), count: 51, next: "/api/tasks/?page=2" },
      "/tasks/?page_size=10&page=2": { ...page("Ellik birinchi vazifa"), count: 51, previous: "/api/tasks/" },
    });
    renderApp(<TasksPage />);

    fireEvent.click(await screen.findByRole("button", { name: /Keyingi/ }));

    expect(await screen.findByText("Ellik birinchi vazifa")).toBeTruthy();
    expect(api.get).toHaveBeenCalledWith("/tasks/?page_size=10&page=2");
  });
});

import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { T } from "@/shared/text";
import type { PeopleSummary, Person } from "@/shared/types";
import { JASUR, PM, testUser } from "@/test/fixtures";
import { mockGet, renderApp } from "@/test/render";

import PeoplePage from "./PeoplePage";

const person: Person = {
  ...JASUR, specialty: "Backend", role_label: "Dasturchi", active_tasks: 1, total_tasks: 4, high_tasks: 1,
  overdue_tasks: 0, review_tasks: 0, done_tasks: 0, doing: [],
  work: [{ id: 12, code: "483920157", title: "API tayyorlash", status: "control", priority: "high", due_at: null, is_overdue: false, project: { id: 8, name: "Portal", code: "PRJ-8" } }],
  projects: [{ id: 8, name: "Portal", code: "PRJ-8", stage: "started", end_date: "2099-01-01" }],
};
const SUMMARY: PeopleSummary = { all: 2, active: 1, free: 1 };
const paged = (results: Person[], summary: PeopleSummary = SUMMARY) => ({ count: results.length, next: null, previous: null, results, summary });

function LocationState() {
  const location = useLocation();
  return <output data-testid="modal-state">{JSON.stringify(location.state)}</output>;
}

beforeEach(() => { try { localStorage.clear(); } catch { /* jsdom */ } });
afterEach(() => { testUser.current = PM; });

describe("PeoplePage", () => {
  it.each(["boss", "pm"] as const)("%s sarlavha, vazifa va yuklamani ko'radi va profilni ochadi", async (role) => {
    testUser.current = { ...PM, role };
    mockGet({ [role === "boss" ? "/people/?paginated=1" : "/people/?role=developer&paginated=1"]: paged([person]) });
    renderApp(<><PeoplePage /><LocationState /></>);
    expect(await screen.findByRole("heading", { name: T.people.pageTitle })).toBeTruthy();
    const card = await screen.findByRole("article");
    within(card).getByText("API tayyorlash");
    expect(within(card).getByText("PRJ-8 · Portal")).toBeTruthy();
    expect(within(card).getByText("#483920157")).toBeTruthy();
    expect(within(card).getByText(T.people.loadTasks(1))).toBeTruthy();
    expect(within(card).getByText(T.people.loadHigh(1))).toBeTruthy();
    expect(within(card).getByRole("meter", { name: T.people.loadLabel }).getAttribute("aria-valuenow")).toBe("1");
    fireEvent.click(within(card).getByRole("button", { name: T.people.profileOpen }));
    await waitFor(() => expect(screen.getByTestId("modal-state").textContent).toContain('"person":3'));
  });

  it("vazifa va loyiha tugmalari tegishli oynani ochadi", async () => {
    // Vazifasi bo'lmagan xodimda — faol loyihasi ko'rinadi
    const projectOnly = { ...person, id: 5, full_name: "Loyihali xodim", active_tasks: 0, work: [] };
    mockGet({ "/people/?role=developer&paginated=1": paged([person, projectOnly]) });
    renderApp(<><PeoplePage /><LocationState /></>);
    const [withTask, withProject] = await screen.findAllByRole("article");
    fireEvent.click(within(withTask!).getByRole("button", { name: /^API tayyorlash/ }));
    await waitFor(() => expect(screen.getByTestId("modal-state").textContent).toContain('"task":12'));
    fireEvent.click(within(withTask!).getByRole("button", { name: `${T.people.openTask}: API tayyorlash` }));
    fireEvent.click(within(withProject!).getByRole("button", { name: /PortalPRJ-8/ }));
    await waitFor(() => expect(screen.getByTestId("modal-state").textContent).toContain('"project":8'));
  });

  it("muddati o'tgan vazifa ogohlantiriladi va qatorda 3 tagacha ish, qolgani 'Yana N ta'", async () => {
    const overdueTask = { ...person.work![0]!, id: 13, title: "Kechikkan ish", is_overdue: true, due_at: "2026-10-01T10:00:00Z" };
    const many: Person = { ...person, active_tasks: 5, overdue_tasks: 1, work: [person.work![0]!, overdueTask] };
    mockGet({ "/people/?role=developer&paginated=1": paged([many]) });
    renderApp(<PeoplePage />);
    const card = await screen.findByRole("article");
    // Muddati o'tgan sana rang bilan birga matn (ekran o'qigich) va belgi bilan ham ko'rinadi
    expect(card.querySelector(".pc-task-due.overdue .sr-only")?.textContent).toBe(T.dashboard.overdue);
    expect(within(card).getByText(T.people.loadOverdue(1))).toBeTruthy();
    expect(within(card).getByRole("button", { name: T.people.moreWork(3) })).toBeTruthy();
  });

  it("kartada tugmalar bir-biriga joylanmaydi va safarda vazifa berilmaydi", async () => {
    mockGet({ "/people/?role=developer&paginated=1": paged([{ ...person, is_on_business_trip: true }]) });
    renderApp(<PeoplePage />);
    const card = await screen.findByRole("article");
    expect((within(card).getByRole("button", { name: T.people.giveTask }) as HTMLButtonElement).disabled).toBe(true);
    expect(within(card).getByText(T.people.onBusinessTrip)).toBeTruthy();
    expect(card.querySelector("button button")).toBeNull();
  });

  it("Faol / Bo'sh chiplari sonlarni ko'rsatadi va ro'yxatni filtrlaydi", async () => {
    const free = { ...person, id: 4, full_name: "Bo'sh xodim", active_tasks: 0, work: [], projects: [] };
    mockGet({
      "/people/?role=developer&paginated=1": paged([person, free]),
      "/people/?role=developer&state=free&paginated=1": paged([free]),
      "/people/?role=developer&state=active&paginated=1": paged([person]),
    });
    renderApp(<PeoplePage />);
    await screen.findAllByRole("article");
    const chip = (name: string) => screen.getByRole("button", { name: new RegExp(`^${name}\\d`) });
    expect(chip(T.people.state.all).textContent).toContain("2");
    expect(chip(T.people.state.active).textContent).toContain("1");
    expect(chip(T.people.state.all).getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(chip(T.people.state.free));
    await waitFor(() => expect(screen.queryByText("Jasur Alimov")).toBeNull());
    expect(await screen.findByText("Bo'sh xodim")).toBeTruthy();
    expect(chip(T.people.state.free).getAttribute("aria-pressed")).toBe("true");
    expect(chip(T.people.state.all).textContent).toContain("2"); // sonlar holat tanlovi bilan o'zgarmaydi
    fireEvent.click(chip(T.people.state.active));
    expect(await screen.findByText("Jasur Alimov")).toBeTruthy();
  });

  it("loyiha nomi bilan xodim topiladi va saralash serverga yuboriladi", async () => {
    const free = { ...person, id: 4, full_name: "Bo'sh xodim", active_tasks: 0, work: [], projects: [] };
    mockGet({
      "/people/?role=developer&paginated=1": paged([person, free]),
      "/people/?role=developer&q=portal&paginated=1": paged([person]),
      "/people/?role=developer&sort=free&paginated=1": paged([free, person]),
    });
    renderApp(<PeoplePage />);
    await screen.findAllByRole("article");
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "Portal" } });
    await waitFor(() => expect(screen.queryByText("Bo'sh xodim")).toBeNull());
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "" } });
    await screen.findByText("Bo'sh xodim");
    fireEvent.click(screen.getByRole("button", { name: new RegExp(T.people.sortLabel) }));
    fireEvent.click(screen.getByRole("option", { name: T.people.sort.free }));
    await waitFor(() => expect(screen.getAllByRole("article")[0]!.textContent).toContain("Bo'sh xodim"));
  });

  it("ro'yxat va kartalar ko'rinishi almashadi va eslab qolinadi", async () => {
    mockGet({ "/people/?role=developer&paginated=1": paged([person]) });
    const { unmount } = renderApp(<PeoplePage />);
    await screen.findByRole("article");
    expect(screen.getByRole("button", { name: T.people.viewList }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("article").className).toContain("list");
    fireEvent.click(screen.getByRole("button", { name: T.people.viewGrid }));
    expect(screen.getByRole("article").className).toContain("grid");
    unmount();
    renderApp(<PeoplePage />);
    await screen.findByRole("article");
    expect(screen.getByRole("button", { name: T.people.viewGrid }).getAttribute("aria-pressed")).toBe("true");
  });

  it("vazifa muddati oralig'i bo'yicha filtrlaydi, teskari oraliqda so'rov yubormaydi va tozalanadi", async () => {
    const inRange: Person = { ...person, range_tasks: 3, work: [{ ...person.work![0]!, status: "done" }] };
    mockGet({
      "/people/?role=developer&paginated=1": paged([person]),
      "/people/?role=developer&due_from=2026-10-01&paginated=1": paged([inRange]),
      "/people/?role=developer&due_from=2026-10-01&due_to=2026-10-07&paginated=1": paged([inRange]),
    });
    renderApp(<PeoplePage />);
    await screen.findByRole("article");
    expect(screen.getByText(T.people.col.doing)).toBeTruthy();
    fireEvent.change(screen.getByLabelText(T.filters.dateFrom), { target: { value: "2026-10-01" } });
    fireEvent.change(screen.getByLabelText(T.filters.dateTo), { target: { value: "2026-10-07" } });
    expect(await screen.findByText(T.people.col.inRange)).toBeTruthy();
    expect(within(screen.getByRole("article")).getByRole("button", { name: T.people.moreWork(2) })).toBeTruthy();
    expect(screen.getByRole("status").textContent).toContain(T.people.rangeHint);

    fireEvent.change(screen.getByLabelText(T.filters.dateTo), { target: { value: "2026-09-01" } });
    expect(await screen.findByText(T.people.rangeError)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: T.filters.clear }));
    await waitFor(() => expect(screen.queryByText(T.people.rangeError)).toBeNull());
    expect((screen.getByLabelText(T.filters.dateFrom) as HTMLInputElement).value).toBe("");
    expect(await screen.findByText(T.people.col.doing)).toBeTruthy();
  });
});

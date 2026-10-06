import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { useLocation } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";

import { T } from "@/shared/text";
import type { Person } from "@/shared/types";
import { JASUR, PM, testUser } from "@/test/fixtures";
import { mockGet, renderApp } from "@/test/render";

import PeoplePage from "./PeoplePage";

const person: Person = {
  ...JASUR, specialty: "Backend", role_label: "Dasturchi", active_tasks: 1,
  overdue_tasks: 0, review_tasks: 0, done_tasks: 0, doing: [],
  work: [{ id: 12, title: "API tayyorlash", status: "control", due_at: null, is_overdue: false, project: { id: 8, name: "Portal", code: "PRJ-8" } }],
  projects: [{ id: 8, name: "Portal", code: "PRJ-8", stage: "started", end_date: "2099-01-01" }],
};

function LocationState() {
  const location = useLocation();
  return <output data-testid="modal-state">{JSON.stringify(location.state)}</output>;
}

afterEach(() => { testUser.current = PM; });

describe("PeoplePage", () => {
  it.each(["boss", "pm"] as const)("%s ishlarni ko'radi va profilni ochadi", async (role) => {
    testUser.current = { ...PM, role };
    mockGet({ [role === "boss" ? "/people/?paginated=1" : "/people/?role=developer&paginated=1"]: [person] });
    renderApp(<><PeoplePage /><LocationState /></>);
    const table = await screen.findByRole("table");
    await within(table).findByText("API tayyorlash");
    expect(within(table).getByText("PRJ-8 · Portal")).toBeTruthy();
    fireEvent.click(within(table).getByRole("button", { name: T.people.profileOpen }));
    await waitFor(() => expect(screen.getByTestId("modal-state").textContent).toContain('"person":3'));
  });

  it("vazifa va loyiha tugmalari tegishli oynani ochadi", async () => {
    mockGet({ "/people/?role=developer&paginated=1": [person] });
    renderApp(<><PeoplePage /><LocationState /></>);
    const table = await screen.findByRole("table");
    fireEvent.click(await within(table).findByRole("button", { name: /API tayyorlash/ }));
    await waitFor(() => expect(screen.getByTestId("modal-state").textContent).toContain('"task":12'));
    fireEvent.click(within(table).getByRole("button", { name: /PortalPRJ-8/ }));
    await waitFor(() => expect(screen.getByTestId("modal-state").textContent).toContain('"project":8'));
  });

  it("karta ichida tugmalar bir-biriga joylanmaydi va safarda vazifa berilmaydi", async () => {
    mockGet({ "/people/?role=developer&paginated=1": [{ ...person, is_on_business_trip: true }] });
    renderApp(<PeoplePage />);
    const table = await screen.findByRole("table");
    expect((await within(table).findByRole("button", { name: T.people.giveTask }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: T.people.viewGrid }));
    const card = screen.getByRole("article");
    expect(card.querySelector("button button")).toBeNull();
    expect(within(card).getByRole("button", { name: T.people.profileOpen })).toBeTruthy();
  });

  it("loyiha nomi bilan xodim topiladi va bo'shlar filtri ishlaydi", async () => {
    const free = { ...person, id: 4, full_name: "Bo'sh xodim", active_tasks: 0, work: [], projects: [] };
    mockGet({
      "/people/?role=developer&paginated=1": [person, free],
      "/people/?role=developer&q=portal&paginated=1": [person],
      "/people/?role=developer&free=1&paginated=1": [free],
      "/people/?role=developer&q=portal&free=1&paginated=1": [],
    });
    renderApp(<PeoplePage />);
    await screen.findByRole("table");
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "Portal" } });
    await waitFor(() => expect(screen.queryByText("Bo'sh xodim")).toBeNull());
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: T.people.onlyFree }));
    await waitFor(() => expect(screen.queryByText("Jasur Alimov")).toBeNull());
    expect(screen.getByRole("button", { name: T.people.onlyFree }).getAttribute("aria-pressed")).toBe("true");
  });
});

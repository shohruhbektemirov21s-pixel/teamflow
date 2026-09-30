import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useModal } from "@/app/modals";
import { T } from "@/shared/text";
import type { Project } from "@/shared/types";
import { JASUR, taskDetail } from "@/test/fixtures";
import { mockGet, renderApp } from "@/test/render";

import DayModal from "./DayModal";

const DAY = "2026-09-30";
const PROJECT: Project = {
  id: 7, code: "PRJ-7", name: "Hujjat aylanishi", description: "", stage: "started",
  start_date: "2026-09-01", end_date: DAY, order_id: null, members: [JASUR], progress: { total: 4, done: 1 },
  created_at: "2026-09-01T09:00:00Z",
};

/** Qaysi modal ochiq — tarix holatidan (manzil satriga yozilmaydi). */
function OpenModal() {
  return <output aria-label="modal">{useModal().params.toString()}</output>;
}

const renderDay = () =>
  renderApp(
    <>
      <DayModal date={DAY} />
      <OpenModal />
    </>,
  );

describe("Taqvim: kun modali", () => {
  it("shu kungi vazifalar va tugaydigan loyihalarni ko'rsatadi; vazifa bosilsa vazifa modali ochiladi", async () => {
    mockGet({
      [`/tasks/?date=${DAY}&all=1`]: [taskDetail({ id: 12, title: "Kirish sahifasi" })],
      [`/projects/?end_from=${DAY}&end_to=${DAY}&all=1`]: [PROJECT],
    });
    renderDay();

    expect(await screen.findByText("Kirish sahifasi")).toBeTruthy();
    expect(screen.getByText("Hujjat aylanishi")).toBeTruthy();
    expect(screen.getByText(T.calendar.dayCount(1, 1))).toBeTruthy();

    fireEvent.click(screen.getByText("Kirish sahifasi"));
    expect(screen.getByLabelText("modal").textContent).toBe("task=12");
  });

  it("loyiha bosilsa loyiha modali ochiladi", async () => {
    mockGet({
      [`/tasks/?date=${DAY}&all=1`]: [],
      [`/projects/?end_from=${DAY}&end_to=${DAY}&all=1`]: [PROJECT],
    });
    renderDay();

    fireEvent.click(await screen.findByText("Hujjat aylanishi"));
    expect(screen.getByLabelText("modal").textContent).toBe("project=7");
  });

  it("bo'sh kunda nima qilish kerakligi yoziladi", async () => {
    mockGet({ [`/tasks/?date=${DAY}&all=1`]: [], [`/projects/?end_from=${DAY}&end_to=${DAY}&all=1`]: [] });
    renderDay();

    expect(await screen.findByText(T.calendar.dayEmpty)).toBeTruthy();
    expect(screen.getByText(T.calendar.dayEmptyHint)).toBeTruthy();
  });
});

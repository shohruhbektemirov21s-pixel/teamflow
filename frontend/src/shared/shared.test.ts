import { describe, expect, it } from "vitest";

import { daysUntil, fmtDate, initials, isoDate, minDate, minDateTime, parseDate, relativeDue } from "./format";
import { boardMove } from "./status";
import type { TaskStatus } from "./types";

// Dasturchi uchun `/api/meta/` javobidagi `task_moves` (backend tasks/workflow.py)
const DEV_MOVES = [
  { from: "control", to: "in_progress" },
  { from: "in_progress", to: "in_review" },
];
const STATUSES: TaskStatus[] = ["control", "in_progress", "in_review", "done"];

describe("format", () => {
  it("sanani dd.mm.yyyy ko'rinishida beradi (UTC siljishisiz)", () => {
    expect(fmtDate("2026-01-05")).toBe("05.01.2026");
    expect(parseDate("2026-12-31").getDate()).toBe(31);
    expect(fmtDate(null)).toBe("—");
  });

  it("muddatgacha kunlar", () => {
    const now = new Date(2026, 8, 28, 15, 0);
    expect(daysUntil("2026-09-30", now)).toBe(2);
    expect(daysUntil("2026-09-27", now)).toBe(-1);
    expect(daysUntil("2026-09-28", now)).toBe(0);
  });

  it("bajarilgan vazifada muddat ogohlantirishi chiqmaydi", () => {
    expect(relativeDue("2020-01-01", true)).toBeNull();
    expect(relativeDue("2020-01-01")?.tone).toBe("danger");
  });

  it("bosh harflar", () => {
    expect(initials("Jasur Alimov")).toBe("JA");
    expect(initials("  malika ")).toBe("M");
  });
});

describe("doska qoidasi (server bergan task_moves bo'yicha)", () => {
  it("dasturchi faqat oldinga, bittadan suradi", () => {
    expect(boardMove(DEV_MOVES, "control", "in_progress")).toBe("start");
    expect(boardMove(DEV_MOVES, "in_progress", "in_review")).toBe("submit");
  });

  it("Bajarildi ga dasturchi o'tkaza olmaydi, orqaga ham yo'q", () => {
    for (const from of STATUSES) expect(boardMove(DEV_MOVES, from, "done")).toBeNull();
    expect(boardMove(DEV_MOVES, "in_progress", "control")).toBeNull();
    expect(boardMove(DEV_MOVES, "control", "in_review")).toBeNull();
  });

  it("server ruxsat bermagan o'tish doskada ham yo'q", () => {
    expect(boardMove([], "control", "in_progress")).toBeNull();
  });
});

describe("muddat maydonlari: bugundan oldingi sana tanlanmaydi", () => {
  const today = isoDate(new Date());
  const shift = (days: number) => { const d = new Date(); d.setDate(d.getDate() + days); return isoDate(d); };

  it("yangi yozuvda eng erta sana — bugun", () => {
    expect(minDate()).toBe(today);
    expect(minDateTime()).toBe(`${today}T00:00`);
  });

  it("boshlanish sanasidan oldin tugash sanasi tanlanmaydi", () => {
    expect(minDate(null, shift(3))).toBe(shift(3));
    expect(minDate(null, shift(-3))).toBe(today);
    expect(minDateTime(null, `${shift(2)}T10:30`)).toBe(`${shift(2)}T10:30`);
  });

  it("tahrirlashda eski o'tgan sana o'zgartirmasdan qolishi mumkin", () => {
    expect(minDate(shift(-5))).toBe(shift(-5));
    expect(minDate(shift(5))).toBe(today);
    expect(minDateTime(`${shift(-2)}T09:00`)).toBe(`${shift(-2)}T00:00`);
  });
});

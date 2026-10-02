import { fireEvent, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { api } from "@/shared/api";
import { T } from "@/shared/text";
import type { Me, Order } from "@/shared/types";
import { PM, testUser } from "@/test/fixtures";
import { mockGet, renderApp } from "@/test/render";

import DepartmentHome from "./DepartmentHome";

const DEPT: Me = {
  ...PM, id: 9, username: "it", full_name: "Shoxrux Hamidov", first_name: "Shoxrux", role: "department",
  role_label: "Boshqarma", department_name: "IT boshqarmasi",
};

const order = (id: number, title: string, status: Order["status"]): Order => ({
  id, title, description: "", priority: "medium", priority_label: "O'rtacha", status, status_label: "",
  requested_due_date: "2026-11-01", start_date: null, end_date: null, version: 1, created_at: "2026-09-29T10:00:00Z",
  submitted_by: { id: DEPT.id, full_name: DEPT.full_name, role: "department", department_name: DEPT.department_name },
} as Order);

const PERIODS = [
  { key: "year", label: "Yil boshidan", since: "2026-01-01", counts: { sent: 5, rejected: 2, approved: 3 } },
  { key: "month", label: "Oy boshidan", since: "2026-09-01", counts: { sent: 3, rejected: 1, approved: 1 } },
  { key: "week", label: "Hafta boshidan", since: "2026-09-28", counts: { sent: 2, rejected: 1, approved: 0 } },
];
const EMPTY = { count: 0, next: null, previous: null, results: [] };

afterEach(() => {
  testUser.current = PM;
});

describe("DepartmentHome", () => {
  it("bosh sahifadagi buyurtmalarning keyingi sahifasini ochadi", async () => {
    testUser.current = DEPT;
    mockGet({
      "/dashboard/": { orders: { submitted: 51, rejected: 0, approved: 0 }, periods: PERIODS },
      "/orders/": { count: 51, next: "/api/orders/?page=2", previous: null, results: [order(1, "Birinchi buyurtma", "submitted")] },
      "/orders/?page=2": { count: 51, next: null, previous: "/api/orders/", results: [order(51, "Ellik birinchi buyurtma", "submitted")] },
    });
    renderApp(<DepartmentHome />);

    fireEvent.click(await screen.findByRole("button", { name: /Keyingi/ }));
    expect(await screen.findByText("Ellik birinchi buyurtma")).toBeTruthy();
  });

  it("o'z buyurtmalari va holat kartalari chiqadi, qo'shimcha eslatma yo'q", async () => {
    testUser.current = DEPT;
    mockGet({
      "/dashboard/": { orders: { submitted: 1, rejected: 1, approved: 2 }, periods: PERIODS },
      "/orders/": { count: 2, next: null, previous: null, results: [order(1, "Kadrlar tizimi", "submitted"), order(2, "Hujjat aylanishi", "rejected")] },
      "/orders/?status=approved%2Cproject_created": EMPTY,
    });
    renderApp(<DepartmentHome />);

    expect(await screen.findByText("Kadrlar tizimi")).toBeTruthy();
    expect(screen.getByText("Hujjat aylanishi")).toBeTruthy();
    expect(screen.queryByText(/sababini o'qing/)).toBeNull();
    expect(screen.getByRole("heading", { name: T.dashboard.hello("Shoxrux") })).toBeTruthy();

    // "Tasdiqlangan" kartasi loyihaga aylanganlarni ham ko'rsatadi (soni bilan mos)
    const cards = screen.getAllByRole("button", { pressed: false }).filter((b) => b.classList.contains("total"));
    fireEvent.click(cards[2]!);
    expect(await screen.findByText(T.orders.empty)).toBeTruthy();
    expect(api.get).toHaveBeenCalledWith("/orders/?status=approved%2Cproject_created");
  });

  it("yil/oy/hafta kartalari boshqa bosh panellardagidek; raqam bosilsa ro'yxat shu davr va toifa bo'yicha", async () => {
    testUser.current = DEPT;
    mockGet({
      "/dashboard/": { orders: { submitted: 1, rejected: 1, approved: 2 }, periods: PERIODS },
      "/orders/": EMPTY,
      "/orders/?period=week&bucket=rejected": { count: 1, next: null, previous: null, results: [order(3, "Haftalik rad", "rejected")] },
    });
    renderApp(<DepartmentHome />);

    expect(await screen.findByText("Yil boshidan")).toBeTruthy();
    expect(screen.getByText("Oy boshidan")).toBeTruthy();
    const week = screen.getByText("Hafta boshidan").closest(".period") as HTMLElement;
    const rejected = Array.from(week.querySelectorAll("button")).find((b) => b.textContent?.includes(T.dashboard.deptRejected))!;
    fireEvent.click(rejected);

    expect(await screen.findByText("Haftalik rad")).toBeTruthy();
    expect(screen.getByText(T.dashboard.tableTitle("Hafta boshidan", T.dashboard.deptRejected))).toBeTruthy();
  });
});

import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { mockGet, renderApp } from "@/test/render";

import OrdersPage from "./OrdersPage";

describe("OrdersPage", () => {
  it("keyingi sahifadagi buyurtmani ko'rsatadi", async () => {
    mockGet({
      "/orders/": { count: 51, next: "/api/orders/?page=2", previous: null, results: [] },
      "/orders/?page=2": { count: 51, next: null, previous: "/api/orders/", results: [
        { id: 51, title: "Ellik birinchi buyurtma", description: "", priority: "medium", priority_label: "O'rtacha",
          status: "submitted", status_label: "Yuborilgan", requested_due_date: "2026-11-01", start_date: null,
          end_date: null, version: 1, created_at: "2026-09-29T10:00:00Z",
          submitted_by: { id: 9, full_name: "Boshqarma", role: "department", department_name: "IT" } },
      ] },
    });
    renderApp(<OrdersPage />);

    fireEvent.click(await screen.findByRole("button", { name: /Keyingi/ }));
    expect(await screen.findByText("Ellik birinchi buyurtma")).toBeTruthy();
  });

  it("ro'yxatda buyurtma nomi ostida izoh ko'rinmaydi", async () => {
    mockGet({
      "/orders/": { count: 1, next: null, previous: null, results: [
        { id: 1, title: "Portal", description: "Uzun izoh matni", priority: "medium", priority_label: "O'rtacha",
          status: "submitted", status_label: "Yuborilgan", requested_due_date: "2026-11-01", start_date: null,
          end_date: null, version: 1, created_at: "2026-09-29T10:00:00Z",
          submitted_by: { id: 9, full_name: "Boshqarma", role: "department", department_name: "IT" } },
      ] },
    });
    renderApp(<OrdersPage />);

    expect(await screen.findByText("Portal")).toBeTruthy();
    expect(screen.queryByText("Uzun izoh matni")).toBeNull();
  });
});

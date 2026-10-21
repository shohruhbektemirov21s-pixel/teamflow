import { fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { api } from "@/shared/api";
import { listStats } from "@/test/fixtures";
import { mockGet, renderApp } from "@/test/render";

import OrdersPage from "./OrdersPage";

const order = (over: Record<string, unknown> = {}) => ({
  id: 1, title: "Portal", description: "", priority: "medium", priority_label: "O'rtacha",
  status: "submitted", status_label: "Yuborilgan", requested_due_date: "2026-11-01", start_date: null,
  end_date: null, version: 1, created_at: "2026-09-29T10:00:00Z", project: null,
  submitted_by: { id: 9, full_name: "Boshqarma", role: "department", department_name: "IT" }, ...over,
});
const page = (...results: ReturnType<typeof order>[]) => ({ count: results.length, next: null, previous: null, results });

describe("OrdersPage", () => {
  it("keyingi sahifadagi buyurtmani ko'rsatadi", async () => {
    mockGet({
      "/orders/stats/": listStats(),
      "/orders/?page_size=10": { count: 51, next: "/api/orders/?page=2", previous: null, results: [] },
      "/orders/?page_size=10&page=2": { count: 51, next: null, previous: "/api/orders/", results: [order({ id: 51, title: "Ellik birinchi buyurtma" })] },
    });
    renderApp(<OrdersPage />);

    fireEvent.click(await screen.findByRole("button", { name: /Keyingi/ }));
    expect(await screen.findByText("Ellik birinchi buyurtma")).toBeTruthy();
  });

  it("ko'rsatkich kartalari va holat tugmalaridagi sonlar serverdan keladi", async () => {
    mockGet({
      "/orders/stats/": listStats({ totals: { all: 124, submitted: 18, planned: 34, done: 62, urgent: 10 }, tabs: { all: 124, submitted: 18, approved: 28, rejected: 6, done: 62 } }),
      "/orders/?page_size=10": page(order()),
    });
    renderApp(<OrdersPage />);

    expect(await screen.findByText("Muvaffaqiyatli yakunlangan")).toBeTruthy();
    expect(screen.getByText("Tezkor ishlov talab etadi")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Rad etilgan\s*6/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Hammasi\s*124/ })).toBeTruthy();
  });

  it("holat tugmasi va filtrlar serverga yuboriladi", async () => {
    mockGet({
      "/orders/stats/": listStats(),
      "/orders/?page_size=10": page(order({ title: "Filtrsiz buyurtma" })),
      "/orders/?stage=done&page_size=10": page(order({ title: "Yakunlangan buyurtma" })),
      "/orders/?stage=done&priority=urgent&page_size=10": page(order({ title: "Shoshilinch tugagan" })),
      "/orders/?stage=done&priority=urgent&department=IT+boshqarma&page_size=10": page(order({ title: "IT ning tugagani" })),
    });
    renderApp(<OrdersPage />);

    fireEvent.click(await screen.findByRole("button", { name: /Yakunlangan\s*1/ }));
    expect(await screen.findByText("Yakunlangan buyurtma")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Muhimlik"), { target: { value: "urgent" } });
    expect(await screen.findByText("Shoshilinch tugagan")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Boshqarma"), { target: { value: "IT boshqarma" } });
    expect(await screen.findByText("IT ning tugagani")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Filtrni tozalash" }));
    expect(await screen.findByText("Filtrsiz buyurtma")).toBeTruthy();
  });

  it("menejerga boshqarma va yuboruvchi, sahifa oxirida soni ko'rinadi", async () => {
    mockGet({
      "/orders/stats/": listStats(),
      "/orders/?page_size=10": page(order({ submitted_by: { id: 9, full_name: "Aziza Karimova", role: "department", department_name: "IT boshqarma" } })),
    });
    renderApp(<OrdersPage />);

    expect(await screen.findByText("Portal")).toBeTruthy();
    expect(screen.getByText("Aziza Karimova")).toBeTruthy();
    expect(screen.getByText("1 ta buyurtma")).toBeTruthy();
  });

  it("'Muddati yaqin' tugmasi va saralash serverga yuboriladi", async () => {
    mockGet({
      "/orders/stats/": listStats(),
      "/orders/?page_size=10": page(order({ title: "Hammasi" })),
      "/orders/?due_soon=1&page_size=10": page(order({ title: "Yaqin buyurtma" })),
      "/orders/?sort=-priority&due_soon=1&page_size=10": page(order({ title: "Muhim yaqin buyurtma" })),
    });
    renderApp(<OrdersPage />);

    fireEvent.click(await screen.findByRole("button", { name: /Muddati yaqin/ }));
    expect(await screen.findByText("Yaqin buyurtma")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Saralash"), { target: { value: "-priority" } });
    expect(await screen.findByText("Muhim yaqin buyurtma")).toBeTruthy();
  });

  it("sahifadagi son o'zgartirilsa page_size yuboriladi", async () => {
    mockGet({
      "/orders/stats/": listStats(),
      "/orders/?page_size=10": page(order()),
      "/orders/?page_size=25": page(order({ title: "Yigirma besh" })),
    });
    renderApp(<OrdersPage />);

    await screen.findByText("Portal");
    fireEvent.change(screen.getByLabelText(/Har sahifada/), { target: { value: "25" } });
    await waitFor(() => expect(api.get).toHaveBeenCalledWith("/orders/?page_size=25"));
    expect(await screen.findByText("Yigirma besh")).toBeTruthy();
  });

  it("ro'yxatda buyurtma nomi ostida izoh ko'rinmaydi", async () => {
    mockGet({
      "/orders/stats/": listStats(),
      "/orders/?page_size=10": page(order({ description: "Uzun izoh matni" })),
    });
    renderApp(<OrdersPage />);

    expect(await screen.findByText("Portal")).toBeTruthy();
    expect(screen.queryByText("Uzun izoh matni")).toBeNull();
  });
});

import { fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { api } from "@/shared/api";
import { T } from "@/shared/text";
import type { OrderDetail } from "@/shared/types";
import { mockGet, renderApp } from "@/test/render";

import OrderModal from "./OrderModal";

/** Buyurtma — loyihasi "Tasdiqlash kutilmoqda" holatida, joriy foydalanuvchi qaror chiqara oladi
 * (server `actions.decide_completion` orqali aytadi — frontend rolga qarab o'zi hal qilmaydi). */
const ORDER: OrderDetail = {
  id: 5, title: "Hisobot moduli", description: "Oylik hisobot", priority: "medium", status: "project_created",
  requested_due_date: "2026-11-01", start_date: "2026-10-01", end_date: "2026-11-15",
  submitted_by: { id: 9, full_name: "Shoxrux Hamidov", role: "department", department_name: "IT boshqarmasi" },
  version: 1, created_at: "2026-09-01T10:00:00Z",
  approved_by: { id: 2, full_name: "Sardor Rustamov", role: "pm", department_name: "" },
  pm_note: "", decided_at: "2026-09-02T10:00:00Z",
  versions: [{
    id: 1, number: 1, file: { id: 1, name: "tz.docx", size: 100, url: "/api/files/order-version/1/" },
    note: "", decision: "approved", decision_label: "Tasdiqlangan", reject_reason: "",
    decided_by: null, decided_at: null, created_at: "2026-09-01T10:00:00Z",
  }],
  project: { id: 7, stage: "pending_approval", stage_label: "Tasdiqlash kutilmoqda" },
  actions: {
    approve: false, reject: false, new_version: false, create_project: false, edit_dates: false,
    view_project: false, decide_completion: true,
  },
};

it("boshqarmaga yakunlash izohi va fayllarini ko'rsatadi", async () => {
  mockGet({ "/orders/5/": { ...ORDER, completion_report: {
    note: "Portal ishga tushirildi", files: [{ id: 10, name: "natija.pdf", size: 100, url: "/api/files/project/10/" }],
  } } });
  renderApp(<OrderModal id={5} />);
  expect(await screen.findByText("Portal ishga tushirildi")).toBeTruthy();
  expect(screen.getByText("natija.pdf")).toBeTruthy();
});

function setup(overrides: Partial<OrderDetail> = {}) {
  mockGet({ "/orders/5/": { ...ORDER, ...overrides } });
  renderApp(<OrderModal id={5} />);
}

describe("OrderModal — loyihani yakunlashni tasdiqlash", () => {
  it("decide_completion bo'lsa tasdiqlash/rad etish tugmalari chiqadi", async () => {
    setup();
    expect(await screen.findByText(T.orders.completionTitle)).toBeTruthy();
    expect(screen.getByRole("button", { name: T.orders.confirmCompletion })).toBeTruthy();
    expect(screen.getByRole("button", { name: T.orders.rejectCompletion })).toBeTruthy();
  });

  it("tasdiqlash bosilsa loyihani tasdiqlash so'rovi ketadi", async () => {
    setup();
    vi.mocked(api.post).mockResolvedValue({ ok: true });
    fireEvent.click(await screen.findByRole("button", { name: T.orders.confirmCompletion }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith("/projects/7/confirm-completion/"));
  });

  it("rad etish sababi majburiy va to'g'ri so'rovga yuboriladi", async () => {
    setup();
    vi.mocked(api.post).mockResolvedValue({ ok: true });
    fireEvent.click(await screen.findByRole("button", { name: T.orders.rejectCompletion }));
    const submit = await screen.findByRole("button", { name: T.orders.rejectCompletion });
    expect((submit as HTMLButtonElement).disabled).toBe(true);

    fireEvent.change(screen.getByPlaceholderText(T.orders.rejectCompletionPh), { target: { value: "Hujjat yetarli emas" } });
    fireEvent.click(screen.getByRole("button", { name: T.orders.rejectCompletion }));
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith("/projects/7/reject-completion/", { reason: "Hujjat yetarli emas" }),
    );
  });

  it("rad etish oynasi buyurtma oynasi ustida alohida ochiladi, Esc faqat uni yopadi", async () => {
    setup();
    fireEvent.click(await screen.findByRole("button", { name: T.orders.rejectCompletion }));

    expect(await screen.findByText(T.orders.rejectCompletionSubtitle)).toBeTruthy();
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    expect(screen.getByRole("dialog", { name: T.orders.rejectCompletion })).toBeTruthy();

    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(screen.queryByText(T.orders.rejectCompletionSubtitle)).toBeNull());
    expect(screen.getByRole("dialog", { name: ORDER.title })).toBeTruthy();
  });

  it("decide_completion bo'lmasa qaror tugmalari ko'rinmaydi (axborot banneri qoladi)", async () => {
    setup({ actions: { ...ORDER.actions, decide_completion: false } });
    await screen.findByText(T.orders.completionTitle); // loyiha hali kutilmoqda — hammaga ko'rinadi
    expect(screen.queryByRole("button", { name: T.orders.confirmCompletion })).toBeNull();
    expect(screen.queryByRole("button", { name: T.orders.rejectCompletion })).toBeNull();
  });
});

describe("OrderModal — buyurtmani tasdiqlash va rad etish", () => {
  it("rad etilgan buyurtmaga TZ v2 fayl va izoh bilan yuboriladi", async () => {
    setup({ status: "rejected", project: null, actions: { ...ORDER.actions, decide_completion: false, new_version: true } });
    vi.mocked(api.post).mockResolvedValue({ ok: true });
    fireEvent.click(await screen.findByRole("button", { name: T.orders.newVersion }));
    const send = screen.getByRole("button", { name: T.orders.send });
    expect((send as HTMLButtonElement).disabled).toBe(true);
    const file = new File(["TZ v2"], "tz-v2.docx", { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
    const input = screen.getByRole("dialog").querySelector('input[type="file"]')!;
    fireEvent.change(input, { target: { files: [file] } });
    expect((send as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByPlaceholderText(T.orders.newVersionPh), { target: { value: "Kamchiliklar tuzatildi" } });
    fireEvent.click(send);
    await waitFor(() => {
      const call = vi.mocked(api.post).mock.calls.find(([path]) => path === "/orders/5/versions/");
      expect(call).toBeTruthy();
      const body = call![1] as FormData;
      expect(body.get("note")).toBe("Kamchiliklar tuzatildi");
      expect((body.get("file") as File).name).toBe("tz-v2.docx");
    });
    expect(await screen.findByText(T.orders.versionToast)).toBeTruthy();
  });
  const submitted = {
    status: "submitted" as const,
    project: null,
    actions: { ...ORDER.actions, approve: true, reject: true, decide_completion: false },
  };

  it("Tasdiqlash — alohida oyna, sanalar bilan so'rov ketadi", async () => {
    setup(submitted);
    vi.mocked(api.post).mockResolvedValue({ ok: true });
    fireEvent.click(await screen.findByRole("button", { name: T.orders.approve }));

    expect(await screen.findByText(T.orders.approveSubtitle)).toBeTruthy();
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: T.orders.approve }));

    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith("/orders/5/approve/", {
        start_date: "2026-10-01", end_date: "2026-11-15", note: "", priority: "medium",
      }),
    );
  });

  it("Rad etish — sababsiz tugma o'chiq, sabab bilan so'rov ketadi", async () => {
    setup(submitted);
    vi.mocked(api.post).mockResolvedValue({ ok: true });
    fireEvent.click(await screen.findByRole("button", { name: T.orders.reject }));

    expect(await screen.findByText(T.orders.rejectSubtitle)).toBeTruthy();
    const send = screen.getByRole("button", { name: T.orders.reject });
    expect((send as HTMLButtonElement).disabled).toBe(true);

    fireEvent.change(screen.getByPlaceholderText(T.orders.rejectPh), { target: { value: "TZ to'liq emas" } });
    fireEvent.click(screen.getByRole("button", { name: T.orders.reject }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith("/orders/5/reject/", { reason: "TZ to'liq emas" }));
  });
});

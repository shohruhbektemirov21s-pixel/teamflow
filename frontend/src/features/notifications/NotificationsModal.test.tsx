import { fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useModal } from "@/app/modals";
import { api } from "@/shared/api";
import { T } from "@/shared/text";
import type { Notice } from "@/shared/types";
import { mockGet, renderApp } from "@/test/render";

import NotificationsModal from "./NotificationsModal";

const now = new Date();
const yesterday = new Date(now.getTime() - 26 * 3600 * 1000);

const notice = (id: number, overrides: Partial<Notice>): Notice => ({
  id, kind: "task_assigned", kind_label: "Vazifa berildi", message: `Xabar ${id}`, is_read: true,
  created_at: now.toISOString(), target: { type: "task", id }, needs_ack: false, ...overrides,
});

/** Qaysi modal ochiq — tarix holatidan (manzil satriga yozilmaydi). */
function OpenModal() {
  return <output aria-label="modal">{useModal().params.toString()}</output>;
}

const renderModal = () =>
  renderApp(
    <>
      <NotificationsModal />
      <OpenModal />
    </>,
  );

describe("NotificationsModal", () => {
  it("dasturchiga rozilik savoli va Ha/Yo'q tugmalarini ko'rsatadi", async () => {
    vi.mocked(api.post).mockResolvedValue({});
    mockGet({
      "/notifications/": { count: 1, next: null, previous: null, results: [notice(1, {
        kind: "project_completion_ack_requested", needs_ack: true, target: { type: "project", id: 7 },
      })] },
      "/notifications/unread_count/": { count: 0 },
    });
    renderModal();
    expect(await screen.findByText(T.notifications.ackQuestion)).toBeTruthy();
    expect(screen.getByRole("button", { name: T.notifications.ackReject })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: T.notifications.ackConfirm }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith("/projects/7/completion-ack/", { confirmed: true }));
  });

  it("kun bo'yicha guruhlaydi va o'qilmaganlarni ajratib ko'rsatadi", async () => {
    mockGet({
      "/notifications/": { count: 2, next: null, previous: null, results: [
        notice(1, { is_read: false, message: "Yangi vazifa" }),
        notice(2, { created_at: yesterday.toISOString(), kind: "comment", kind_label: "Yangi izoh", message: "Izoh yozildi" }),
      ] },
      "/notifications/unread_count/": { count: 1 },
    });
    renderModal();

    expect(await screen.findByRole("dialog")).toBeTruthy();
    expect(await screen.findByRole("region", { name: T.notifications.today })).toBeTruthy();
    expect(screen.getByRole("region", { name: T.notifications.yesterday })).toBeTruthy();
    expect(screen.getByText("Yangi vazifa").closest("button")?.className).toContain("unread");
    expect(screen.getByText("Izoh yozildi").closest("button")?.className).not.toContain("unread");
    expect(await screen.findByText(T.notifications.unreadCount(1))).toBeTruthy();
  });

  it("o'qilmaganlar filtrida bo'sh bo'lsa, alohida xabar chiqadi", async () => {
    mockGet({
      "/notifications/": { count: 0, next: null, previous: null, results: [] },
      "/notifications/?unread=1": { count: 0, next: null, previous: null, results: [] },
      "/notifications/unread_count/": { count: 0 },
    });
    renderModal();

    fireEvent.click(await screen.findByRole("button", { name: T.notifications.unread }));

    expect(await screen.findByText(T.notifications.emptyUnread)).toBeTruthy();
    expect(screen.getByText(T.notifications.allRead)).toBeTruthy();
  });

  it("keyingi sahifadagi bildirishnomani ko'rsatadi", async () => {
    mockGet({
      "/notifications/": { count: 51, next: "/api/notifications/?page=2", previous: null, results: [notice(1, {})] },
      "/notifications/?page=2": { count: 51, next: null, previous: "/api/notifications/", results: [notice(51, {})] },
      "/notifications/unread_count/": { count: 0 },
    });
    renderModal();

    fireEvent.click(await screen.findByRole("button", { name: /Keyingi/ }));

    expect(await screen.findByText("Xabar 51")).toBeTruthy();
  });

  it("bosilsa tegishli nishon (task) modali shu modal o'rniga ochiladi", async () => {
    mockGet({
      "/notifications/": { count: 1, next: null, previous: null, results: [notice(1, { message: "Topshirilgan vazifa" })] },
      "/notifications/unread_count/": { count: 0 },
    });
    renderModal();

    fireEvent.click(await screen.findByText("Topshirilgan vazifa"));

    expect(screen.getByLabelText("modal").textContent).toBe("task=1");
  });
});

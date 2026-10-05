import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { T } from "@/shared/text";
import type { Notice } from "@/shared/types";
import { mockGet, renderApp } from "@/test/render";

import NotificationsPage from "./NotificationsPage";

const now = new Date();
const yesterday = new Date(now.getTime() - 26 * 3600 * 1000);

const notice = (id: number, overrides: Partial<Notice>): Notice => ({
  id, kind: "task_assigned", kind_label: "Vazifa berildi", message: `Xabar ${id}`, is_read: true,
  created_at: now.toISOString(), target: { type: "task", id }, needs_ack: false, ...overrides,
});

describe("NotificationsPage", () => {
  it("kun bo'yicha guruhlaydi va o'qilmaganlarni ajratib ko'rsatadi", async () => {
    mockGet({
      "/notifications/": { count: 2, next: null, previous: null, results: [
        notice(1, { is_read: false, message: "Yangi vazifa" }),
        notice(2, { created_at: yesterday.toISOString(), kind: "comment", kind_label: "Yangi izoh", message: "Izoh yozildi" }),
      ] },
      "/notifications/unread_count/": { count: 1 },
    });
    renderApp(<NotificationsPage />);

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
    renderApp(<NotificationsPage />);

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
    renderApp(<NotificationsPage />);

    fireEvent.click(await screen.findByRole("button", { name: /Keyingi/ }));

    expect(await screen.findByText("Xabar 51")).toBeTruthy();
  });
});

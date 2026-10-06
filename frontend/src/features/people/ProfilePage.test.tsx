import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { api } from "@/shared/api";
import { T } from "@/shared/text";
import type { Me } from "@/shared/types";
import { PM, taskDetail, testUser } from "@/test/fixtures";
import { mockGet, renderApp } from "@/test/render";

import ProfilePage from "./ProfilePage";

const DEV: Me = { ...PM, id: 3, username: "jasur", full_name: "Jasur Alimov", role: "developer", role_label: "Dasturchi" };
const PROFILE = { ...DEV, date_joined: "2026-09-01T10:00:00Z", stats: { active: 1, in_review: 0, done: 0, overdue: 0 } };

afterEach(() => {
  testUser.current = PM;
});

describe("ProfilePage", () => {
  it("boshliq profilidan xodimni xizmat safariga chiqaradi", async () => {
    testUser.current = { ...PM, role: "boss", role_label: "Boshliq" };
    mockGet({
      "/auth/profile/": { ...PROFILE, ...testUser.current, stats: null },
      "/people/?paginated=1": [{ id: 3, full_name: "Jasur Alimov", role: "developer", role_label: "Dasturchi", is_on_business_trip: false }],
    });
    vi.mocked(api.put).mockResolvedValue({ id: 3, is_on_business_trip: true, business_trip_return_date: "2099-01-01" });
    renderApp(<ProfilePage />);

    const panel = await screen.findByRole("region", { name: T.profile.businessTrips });
    fireEvent.change(await screen.findByLabelText(T.profile.tripEmployee), { target: { value: "3" } });
    fireEvent.change(screen.getByLabelText(T.profile.tripReturnDate), { target: { value: "2099-01-01" } });
    fireEvent.click(screen.getByRole("button", { name: T.profile.tripSet }));

    expect(panel).toBeTruthy();
    await waitFor(() => expect(api.put).toHaveBeenCalledWith("/people/3/business-trip/", { return_date: "2099-01-01" }));
  });

  it("dasturchi profilida faqat o'z vazifalari chiqadi", async () => {
    testUser.current = DEV;
    mockGet({
      "/auth/profile/": PROFILE,
      "/tasks/?mine=1": [taskDetail({ title: "Mening vazifam" })],
    });
    renderApp(<ProfilePage />);

    expect(await screen.findByRole("region", { name: T.profile.myTasks })).toBeTruthy();
    expect(await screen.findByText("Mening vazifam")).toBeTruthy();
    expect(api.get).toHaveBeenCalledWith("/tasks/?mine=1");
  });

  it("menejer profilida vazifalar ro'yxati so'ralmaydi", async () => {
    mockGet({ "/auth/profile/": { ...PROFILE, ...PM, stats: null } });
    renderApp(<ProfilePage />);

    expect(await screen.findByText(T.profile.editInfoTitle)).toBeTruthy();
    expect(screen.queryByRole("region", { name: T.profile.myTasks })).toBeNull();
    expect(api.get).not.toHaveBeenCalledWith("/tasks/?mine=1");
  });

  it("Telegram izohida bot havolasi bor (bot nomi serverdan, /meta/)", async () => {
    mockGet({ "/auth/profile/": { ...PROFILE, ...PM, stats: null } });
    renderApp(<ProfilePage />);

    const link = await screen.findByRole("link", { name: "@teamflow_test_bot" });
    expect(link.getAttribute("href")).toBe("https://t.me/teamflow_test_bot");
  });

  it("profil rasmini yuklash: fayl tanlansa /auth/avatar/ ga yuboriladi", async () => {
    mockGet({ "/auth/profile/": { ...PROFILE, ...PM, stats: null } });
    const { container } = renderApp(<ProfilePage />);

    expect(await screen.findByRole("button", { name: T.profile.photoUpload })).toBeTruthy();
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["x"], "men.png", { type: "image/png" });
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => expect(api.post).toHaveBeenCalledWith("/auth/avatar/", expect.any(FormData)));
    const sent = vi.mocked(api.post).mock.calls[0]![1] as FormData;
    expect(sent.get("avatar")).toBe(file);
  });
});

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

    expect(await screen.findByText(T.profile.personalTitle)).toBeTruthy();
    expect(screen.queryByRole("region", { name: T.profile.myTasks })).toBeNull();
    expect(api.get).not.toHaveBeenCalledWith("/tasks/?mine=1");
  });



  it("oddiy foydalanuvchi o'z baholarini ko'radi, loyiha va vazifa bo'limlari yo'q", async () => {
    testUser.current = { ...PM, role: "user", role_label: "Oddiy foydalanuvchi" };
    mockGet({
      "/auth/profile/": { ...PROFILE, ...testUser.current, stats: null },
      "/portfolio/ratings/?mine=1": {
        count: 1, next: null, previous: null,
        results: [{ id: 1, item_id: 7, item_title: "Shaxsiy sayt", developer: { id: 3, full_name: "Jasur Alimov" }, author: PM, stars: 4, text: "Yaxshi", created_at: "2026-10-10T10:00:00Z", updated_at: "2026-10-10T10:00:00Z" }],
      },
    });
    renderApp(<ProfilePage />);

    expect(await screen.findByText("Shaxsiy sayt")).toBeTruthy();
    expect(screen.queryByRole("region", { name: T.profile.myProjects })).toBeNull();
    expect(screen.queryByRole("region", { name: T.profile.myTasks })).toBeNull();
    expect(api.get).not.toHaveBeenCalledWith("/projects/");
  });

  it("dasturchi profilida loyihalari, texnologiyalari va reytingi bor", async () => {
    testUser.current = DEV;
    mockGet({
      "/auth/profile/": { ...PROFILE, portfolio: { rating: 4.5, reviews_count: 2, projects_count: 1, technologies: ["Django"] } },
      "/tasks/?mine=1": [],
      "/projects/": [{ id: 9, code: "PRJ-1", name: "Savdo tizimi", status: "active", end_date: "2026-12-01", stage: "in_progress" }],
    });
    renderApp(<ProfilePage />);

    expect(await screen.findByText("Savdo tizimi")).toBeTruthy();
    expect(await screen.findByText("Django")).toBeTruthy();
    expect(screen.getByRole("button", { name: T.profile.openPortfolio })).toBeTruthy();
  });
});

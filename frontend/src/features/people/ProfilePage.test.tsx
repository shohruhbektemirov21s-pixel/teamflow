import { screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

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
  it("dasturchi profilida faqat o'z vazifalari chiqadi", async () => {
    testUser.current = DEV;
    mockGet({
      "/auth/profile/": PROFILE,
      "/tasks/?mine=1&all=1": [taskDetail({ title: "Mening vazifam" })],
    });
    renderApp(<ProfilePage />);

    expect(await screen.findByRole("region", { name: T.profile.myTasks })).toBeTruthy();
    expect(await screen.findByText("Mening vazifam")).toBeTruthy();
    expect(api.get).toHaveBeenCalledWith("/tasks/?mine=1&all=1");
  });

  it("menejer profilida vazifalar ro'yxati so'ralmaydi", async () => {
    mockGet({ "/auth/profile/": { ...PROFILE, ...PM, stats: null } });
    renderApp(<ProfilePage />);

    expect(await screen.findByText(T.profile.editInfoTitle)).toBeTruthy();
    expect(screen.queryByRole("region", { name: T.profile.myTasks })).toBeNull();
    expect(api.get).not.toHaveBeenCalledWith("/tasks/?mine=1&all=1");
  });
});

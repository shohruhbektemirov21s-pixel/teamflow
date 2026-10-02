import { fireEvent, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { api } from "@/shared/api";
import type { Me } from "@/shared/types";
import { PM, taskDetail, testUser } from "@/test/fixtures";
import { mockGet, renderApp } from "@/test/render";

import TasksPage from "./TasksPage";

const DEV: Me = { ...PM, id: 3, username: "jasur", full_name: "Jasur Alimov", role: "developer", role_label: "Dasturchi" };
const page = (title: string) => ({ count: 1, next: null, previous: null, results: [taskDetail({ title })] });

afterEach(() => {
  testUser.current = PM;
});

describe("TasksPage", () => {
  it("dasturchiga faqat o'ziga biriktirilgan vazifalar so'raladi", async () => {
    testUser.current = DEV;
    mockGet({ "/tasks/?mine=1": page("Mening vazifam") });
    renderApp(<TasksPage />);

    expect(await screen.findByText("Mening vazifam")).toBeTruthy();
    expect(api.get).toHaveBeenCalledWith("/tasks/?mine=1");
  });

  it("menejerga hamma vazifalar so'raladi", async () => {
    mockGet({ "/tasks/": page("Jamoa vazifasi") });
    renderApp(<TasksPage />);

    expect(await screen.findByText("Jamoa vazifasi")).toBeTruthy();
    expect(api.get).not.toHaveBeenCalledWith("/tasks/?mine=1");
  });

  it("keyingi sahifadagi vazifani ochib ko'rsatadi", async () => {
    mockGet({
      "/tasks/": { ...page("Birinchi vazifa"), count: 51, next: "/api/tasks/?page=2" },
      "/tasks/?page=2": { ...page("Ellik birinchi vazifa"), count: 51, previous: "/api/tasks/" },
    });
    renderApp(<TasksPage />);

    fireEvent.click(await screen.findByRole("button", { name: /Keyingi/ }));

    expect(await screen.findByText("Ellik birinchi vazifa")).toBeTruthy();
    expect(api.get).toHaveBeenCalledWith("/tasks/?page=2");
  });
});

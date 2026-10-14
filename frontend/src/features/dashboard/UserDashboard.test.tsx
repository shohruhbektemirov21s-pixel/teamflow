import { fireEvent, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { T } from "@/shared/text";
import type { PortfolioDeveloper } from "@/shared/types";
import { PM, testUser } from "@/test/fixtures";
import { mockGet, renderApp } from "@/test/render";

import UserDashboard from "./UserDashboard";

const dev = (id: number, name: string, following: boolean): PortfolioDeveloper => ({
  id, full_name: name, role: "developer", department_name: "", avatar: null, specialty: "Backend dasturchi",
  rating: 4.5, reviews_count: 2, followers_count: 3, projects_count: 1, tasks_done: 4, is_following: following, rank: id,
  projects: ["Portal", "Sayt"], projects_extra: 2, experience_months: 30,
  technologies: ["Python"], cover: null,
});
const page = (...rows: PortfolioDeveloper[]) => ({ count: rows.length, next: null, previous: null, results: rows });
const SUMMARY = {
  developers: 3, developers_growth: 12, average_rating: 4.6, rated_projects: 7, active_projects: 5, following: 1,
  specialties: [{ id: 5, name: "Backend dasturchi", count: 1 }],
};

afterEach(() => {
  testUser.current = PM;
  localStorage.clear();
});

describe("UserDashboard", () => {
  it("ko'rsatkichlar, o'sish va kartadagi ma'lumotlarni backenddan ko'rsatadi", async () => {
    testUser.current = { ...PM, id: 20, role: "user", role_label: "Oddiy foydalanuvchi" };
    mockGet({ "/portfolio/summary/": SUMMARY, "/portfolio/": page(dev(1, "Jasur Alimov", false)) });
    renderApp(<UserDashboard />);

    expect(await screen.findByText("Jasur Alimov")).toBeTruthy();
    expect(await screen.findByText("4.6")).toBeTruthy();
    expect(screen.getByText("+12%")).toBeTruthy();
    expect(screen.getByText(T.user.statActive)).toBeTruthy();
    expect(screen.getByText("Python")).toBeTruthy();
    expect(screen.queryByText("Portal")).toBeNull();
    expect(screen.getByText(T.user.experienceShort(30))).toBeTruthy();
  });

  it("olib tashlangan subtitle, chiplar, qo'llanma va ko'rinish almashtirgichni ko'rsatmaydi", async () => {
    mockGet({ "/portfolio/summary/": SUMMARY, "/portfolio/": page(dev(1, "Jasur Alimov", false)) });
    renderApp(<UserDashboard />);

    await screen.findByText("Jasur Alimov");
    expect(screen.queryByText(T.user.subtitle)).toBeNull();
    expect(screen.queryByText(T.user.howTitle)).toBeNull();
    expect(screen.queryByText(T.user.filterFollowing)).toBeNull();
    expect(screen.queryByRole("group", { name: T.user.viewLabel })).toBeNull();
    expect(screen.queryByRole("button", { name: /Backend dasturchi \(1\)/ })).toBeNull();
  });

  it("saralash tanlansa so'rovga sort qo'shiladi", async () => {
    mockGet({
      "/portfolio/summary/": SUMMARY,
      "/portfolio/": page(dev(1, "Jasur Alimov", false)),
      "/portfolio/?sort=followers": page(dev(3, "Bobur Rahimov", false)),
    });
    renderApp(<UserDashboard />);

    await screen.findByText("Jasur Alimov");
    fireEvent.click(screen.getByRole("button", { name: new RegExp(T.user.sortLabel) }));
    fireEvent.click(screen.getByRole("option", { name: T.user.sort.followers }));
    expect(await screen.findByText("Bobur Rahimov")).toBeTruthy();
  });

  it("kartadagi yurak tugmasi kuzatish holatini ko'rsatadi", async () => {
    mockGet({ "/portfolio/summary/": SUMMARY, "/portfolio/": page(dev(1, "Jasur Alimov", true)) });
    renderApp(<UserDashboard />);

    const heart = await screen.findByRole("button", { name: T.user.unfollowAria("Jasur Alimov") });
    expect(heart.getAttribute("aria-pressed")).toBe("true");
  });

  it("kartada backenddan kelgan real muqova va texnologiyalarni ko'rsatadi", async () => {
    const developer = {
      ...dev(1, "Jasur Alimov", false),
      cover: "/api/portfolio/covers/10/",
      technologies: ["Python", "Django"],
    };
    mockGet({ "/portfolio/summary/": SUMMARY, "/portfolio/": page(developer) });
    renderApp(<UserDashboard />);

    expect((await screen.findByRole("img", { name: T.user.developerCoverAlt("Jasur Alimov") })).getAttribute("src")).toBe(developer.cover);
    expect(screen.getByText("Python")).toBeTruthy();
    expect(screen.getByText("Django")).toBeTruthy();
  });

});

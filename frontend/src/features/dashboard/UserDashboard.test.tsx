import { fireEvent, screen, within } from "@testing-library/react";
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
  technologies: ["Python"], cover: null, working_on: null, latest_comment: null,
  status: { state: "free", active_tasks: 0, trip_return_date: null },
});
const page = (...rows: PortfolioDeveloper[]) => ({ count: rows.length, next: null, previous: null, results: rows });
const SUMMARY = {
  developers: 3, developers_growth: 12, average_rating: 4.6, rated_projects: 7, active_projects: 5, completed_projects: 36,
  busy_developers: 2, following: 1, specialties: [{ id: 5, name: "Backend dasturchi", count: 1 }],
  series: { developers: [0, 1, 0, 0, 0, 0, 1, 1], rated_projects: [0, 0, 0, 0, 1, 0, 2, 4], completed_projects: [0, 0, 1, 0, 0, 2, 0, 3] },
  technologies: ["Python", "React"],
};

afterEach(() => {
  testUser.current = PM;
  localStorage.clear();
});

describe("UserDashboard", () => {
  it("ko'rsatkichlar (grafik bilan) va kartadagi ma'lumotlarni backenddan ko'rsatadi", async () => {
    testUser.current = { ...PM, id: 20, role: "user", role_label: "Oddiy foydalanuvchi" };
    mockGet({ "/portfolio/summary/": SUMMARY, "/portfolio/": page(dev(1, "Jasur Alimov", false)) });
    renderApp(<UserDashboard />);

    expect(await screen.findByText("Jasur Alimov")).toBeTruthy();
    expect(await screen.findByText("4.6")).toBeTruthy();
    expect(screen.getByText(T.user.statCompleted)).toBeTruthy();
    expect(screen.getByText(T.user.statBusy)).toBeTruthy();
    expect(await screen.findByText("36")).toBeTruthy();
    expect(screen.getByRole("img", { name: `${T.user.statDevelopers}: ${T.user.trendCaption}` })).toBeTruthy();
    expect(within(screen.getByLabelText(T.portfolio.technologies)).getByText("Python")).toBeTruthy();
    expect(screen.queryByText("Portal")).toBeNull();
    expect(screen.getByText(T.user.cardReviews)).toBeTruthy();
  });

  it("kartada 'Hozir band' loyiha, bo'sh dasturchida 'Hozir band emas' va so'nggi sharh ko'rinadi", async () => {
    const busy = {
      ...dev(2, "Malika Karimova", false),
      status: { state: "busy" as const, active_tasks: 1, trip_return_date: null },
      working_on: { name: "Admin panel dashboard", description: "Korxona uchun boshqaruv paneli" },
      latest_comment: { author: "Azizbek Qodirov", text: "Juda professional ishlaydi", created_at: new Date().toISOString(), stars: 5 },
    };
    const trip = { ...dev(3, "Bobur Rahimov", false), status: { state: "trip" as const, active_tasks: 2, trip_return_date: "2026-11-05" } };
    mockGet({ "/portfolio/summary/": SUMMARY, "/portfolio/": page(dev(1, "Jasur Alimov", false), busy, trip) });
    renderApp(<UserDashboard />);

    await screen.findByText("Jasur Alimov");
    expect(screen.getByText("Admin panel dashboard")).toBeTruthy();
    expect(screen.getByText("Korxona uchun boshqaruv paneli")).toBeTruthy();
    expect(screen.getByText(T.user.activeTasks(1))).toBeTruthy();
    expect(screen.getAllByText(T.user.notBusy)).toHaveLength(1);
    expect(screen.getByText(T.user.latestComment)).toBeTruthy();
    expect(screen.getByText("Azizbek Qodirov")).toBeTruthy();
    expect(screen.getByText("Juda professional ishlaydi")).toBeTruthy();
    expect(screen.getByRole("img", { name: T.portfolio.starsOf(5) })).toBeTruthy();
    expect(screen.getAllByText(T.user.viewProfile)).toHaveLength(3);
    expect(screen.getAllByText(T.user.writeReview)).toHaveLength(3);
  });

  it("texnologiya, bandlik va reyting filtrlari so'rovga qo'shiladi", async () => {
    mockGet({
      "/portfolio/summary/": SUMMARY,
      "/portfolio/": page(dev(1, "Jasur Alimov", false)),
      "/portfolio/?technology=React": page(dev(4, "Texno Dasturchi", false)),
      "/portfolio/?status=busy": page(dev(5, "Band Dasturchi", false)),
      "/portfolio/?min_rating=4": page(dev(6, "Yuqori Reyting", false)),
    });
    renderApp(<UserDashboard />);

    await screen.findByText("Jasur Alimov");
    fireEvent.change(screen.getByLabelText(T.user.filterTechnology), { target: { value: "React" } });
    expect(await screen.findByText("Texno Dasturchi")).toBeTruthy();
    fireEvent.change(screen.getByLabelText(T.user.filterTechnology), { target: { value: "" } });
    fireEvent.change(screen.getByLabelText(T.user.filterStatus), { target: { value: "busy" } });
    expect(await screen.findByText("Band Dasturchi")).toBeTruthy();
    fireEvent.change(screen.getByLabelText(T.user.filterStatus), { target: { value: "" } });
    fireEvent.change(screen.getByLabelText(T.user.filterRating), { target: { value: "4" } });
    expect(await screen.findByText("Yuqori Reyting")).toBeTruthy();
  });

  it("kartada dasturchining hozirgi holati matn bilan ko'rinadi (bo'sh, band, xizmat safarida)", async () => {
    testUser.current = { ...PM, id: 20, role: "user", role_label: "Oddiy foydalanuvchi" };
    const busy = { ...dev(2, "Malika Karimova", false), status: { state: "busy" as const, active_tasks: 3, trip_return_date: null } };
    const trip = { ...dev(3, "Bobur Rahimov", false), status: { state: "trip" as const, active_tasks: 1, trip_return_date: "2026-11-05" } };
    mockGet({ "/portfolio/summary/": SUMMARY, "/portfolio/": page(dev(1, "Jasur Alimov", false), busy, trip) });
    renderApp(<UserDashboard />);

    await screen.findByText("Jasur Alimov");
    expect(screen.getAllByText(T.portfolio.status.free).length).toBeGreaterThan(0);
    expect(screen.getAllByText(T.portfolio.status.busy(3)).length).toBeGreaterThan(0);
    expect(screen.getAllByText(T.portfolio.status.trip("05.11.2026")).length).toBeGreaterThan(0);
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
    fireEvent.change(screen.getByLabelText(T.user.sortLabel), { target: { value: "followers" } });
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
    const tags = within(screen.getByLabelText(T.portfolio.technologies));
    expect(tags.getByText("Python")).toBeTruthy();
    expect(tags.getByText("Django")).toBeTruthy();
  });

});

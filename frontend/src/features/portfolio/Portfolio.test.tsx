import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ModalHost } from "@/app/modals";
import { api } from "@/shared/api";
import { T } from "@/shared/text";
import type { PortfolioDetail, PortfolioDeveloper, PortfolioItemDetail } from "@/shared/types";
import { JASUR, MALIKA, PM, testUser } from "@/test/fixtures";
import { mockGet, renderApp } from "@/test/render";

import PortfolioModal from "./PortfolioModal";
import PortfolioPage from "./PortfolioPage";

const dev = (over: Partial<PortfolioDeveloper>): PortfolioDeveloper => ({
  ...JASUR, specialty: "Backend", technologies: "", rating: null, reviews_count: 0, followers_count: 0,
  projects_count: 0, tasks_done: 0, is_following: false, rank: null, ...over,
});

const SUMMARY = { developers_count: 2, avg_rating: 4.5, rated_items_count: 1 };

const DETAIL: PortfolioDetail = {
  ...dev({ rating: 4.5, reviews_count: 2, followers_count: 3, projects_count: 1, tasks_done: 7 }),
  experience: { since: "2024-01-15", months: 26 },
  years: [{ year: 2026, projects: 1, tasks: 7 }],
  months: [], days: [], tasks_late: 0,
  items: [{ id: 10, is_auto: true, title: "Portal", link: "", start_date: "2025-01-01", end_date: null,
    project_type: "", project_type_label: "", preview_image: null,
    project: { code: "PRJ-1", stage: "started" }, tasks_done: 7, rating: 4.5, reviews_count: 2, videos_count: 1 }],
  recent_tasks: [{ id: 1, code: "100000001", title: "Kirish sahifasi", project: "Portal", completed_at: "2026-10-01T10:00:00Z" }],
  actions: { follow: true, add: false },
};

const ITEM: PortfolioItemDetail = {
  ...DETAIL.items[0]!, description: "Ichki portal", manual: { title: "", start_date: null, end_date: null },
  owner: JASUR, videos: [{ id: 5, name: "demo.mp4", size: 2048, url: "/api/portfolio/videos/5/" }], my_review: null,
  actions: { edit: false, delete: false, upload: false, review: true },
};

afterEach(() => { testUser.current = PM; });

describe("Portfolio sahifasi", () => {
  it("dasturchilar reyting tartibida va o'rni bilan ko'rinadi, bosilsa portfolio ochiladi", async () => {
    mockGet({
      "/portfolio/summary/": SUMMARY,
      "/portfolio/projects/": { count: 0, next: null, previous: null, results: [] },
      "/portfolio/": { count: 2, next: null, previous: null, results: [
        dev({ id: MALIKA.id, full_name: MALIKA.full_name, rating: 4.8, reviews_count: 5, followers_count: 2, rank: 1 }),
        dev({ rating: null, rank: 2, is_following: true }),
      ] },
      [`/portfolio/${MALIKA.id}/`]: { ...DETAIL, id: MALIKA.id, full_name: MALIKA.full_name },
    });
    renderApp(<><PortfolioPage /><ModalHost /></>);
    const rows = await screen.findAllByRole("button", { name: /Karimova|Alimov/ });
    expect(rows[0]!.textContent).toContain(MALIKA.full_name);
    expect(within(rows[0]!).getByLabelText(T.portfolio.rank(1))).toBeTruthy();
    expect(within(rows[0]!).getByRole("img", { name: T.portfolio.starsOf(4.8) })).toBeTruthy();
    expect(within(rows[1]!).getByText(T.portfolio.noRating)).toBeTruthy();
    expect(within(rows[1]!).getByText(T.portfolio.following)).toBeTruthy();
    // PM'da "Mening portfoliom" yo'q (portfolio faqat dasturchilarda)
    expect(screen.queryByRole("button", { name: T.portfolio.mine })).toBeNull();

    fireEvent.click(rows[0]!);
    const dialog = await screen.findByRole("dialog", { name: T.portfolio.title });
    expect(await within(dialog).findByRole("button", { name: /Portal/ })).toBeTruthy();
    expect(within(dialog).getByText(T.portfolio.experience(26))).toBeTruthy();
  }, 20_000); // ModalHost modalni lazy yuklaydi — birinchi transform sekin

  it("statistika kartalari, texnologiya chiplari va loyihalar grid ko'rinadi", async () => {
    mockGet({
      "/portfolio/summary/": SUMMARY,
      "/portfolio/projects/": { count: 1, next: null, previous: null, results: [
        { id: 10, is_auto: true, title: "Portal", link: "", start_date: null, end_date: null,
          project_type: "website", project_type_label: "Veb-sayt", preview_image: null,
          project: { code: "PRJ-1", stage: "started" }, tasks_done: null, rating: 4.5, reviews_count: 2,
          videos_count: 0, owner: JASUR },
      ] },
      "/portfolio/": { count: 1, next: null, previous: null, results: [
        dev({ rank: 1, technologies: "React, Django, PostgreSQL, Docker" }),
      ] },
    });
    renderApp(<PortfolioPage />);
    expect(await screen.findByText(String(SUMMARY.developers_count))).toBeTruthy();
    expect(screen.getAllByText(String(SUMMARY.avg_rating)).length).toBeGreaterThan(0);
    // "React" filtr chipida ham, dasturchi qatorida ham chiqadi
    expect(screen.getAllByText("React").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByRole("button", { name: T.portfolio.filterAll })).toBeTruthy();
    expect(screen.getByText("+1")).toBeTruthy(); // 4 ta texnologiyadan 3 tasi ko'rinadi, 1 tasi "+1"
    expect(await screen.findByRole("button", { name: /Portal/ })).toBeTruthy();
  });

  it("saralash 'Ism bo'yicha'ga o'zgartirilsa so'rovga sort=name qo'shiladi", async () => {
    mockGet({
      "/portfolio/summary/": SUMMARY,
      "/portfolio/projects/": { count: 0, next: null, previous: null, results: [] },
      "/portfolio/": { count: 1, next: null, previous: null, results: [dev({ rank: 1 })] },
    });
    renderApp(<PortfolioPage />);
    await screen.findByText(JASUR.full_name);
    vi.mocked(api.get).mockClear();
    vi.mocked(api.get).mockImplementation(async (path: string) => {
      if (path === "/portfolio/?sort=name") return { count: 1, next: null, previous: null, results: [dev({ rank: null })] };
      throw new Error(`Kutilmagan GET: ${path}`);
    });
    fireEvent.change(screen.getByLabelText(T.portfolio.sort), { target: { value: "name" } });
    await waitFor(() => expect(api.get).toHaveBeenCalledWith("/portfolio/?sort=name"));
  });

  it("dasturchiga o'z portfoliosi tugmasi chiqadi", async () => {
    testUser.current = { ...PM, id: JASUR.id, role: "developer" };
    mockGet({
      "/portfolio/summary/": SUMMARY,
      "/portfolio/projects/": { count: 0, next: null, previous: null, results: [] },
      "/portfolio/": { count: 0, next: null, previous: null, results: [] },
    });
    renderApp(<PortfolioPage />);
    expect(await screen.findByRole("button", { name: T.portfolio.mine })).toBeTruthy();
    expect(await screen.findByText(T.portfolio.empty)).toBeTruthy();
  });
});

describe("Portfolio oynasi", () => {
  it("boshqa foydalanuvchi kuzata oladi", async () => {
    mockGet({ [`/portfolio/${JASUR.id}/`]: DETAIL });
    vi.mocked(api.post).mockResolvedValue({});
    renderApp(<PortfolioModal id={JASUR.id} />);
    fireEvent.click(await screen.findByRole("button", { name: T.portfolio.follow }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith(`/portfolio/${JASUR.id}/follow/`));
    expect(screen.queryByRole("button", { name: T.portfolio.add })).toBeNull();
  });

  it("egasiga 'Loyiha qo'shish' chiqadi, kuzatish chiqmaydi", async () => {
    mockGet({ [`/portfolio/${JASUR.id}/`]: { ...DETAIL, items: [], actions: { follow: false, add: true } } });
    renderApp(<PortfolioModal id={JASUR.id} />);
    expect(await screen.findByRole("button", { name: T.portfolio.add })).toBeTruthy();
    expect(screen.queryByRole("button", { name: T.portfolio.follow })).toBeNull();
    expect(screen.getByText(T.portfolio.projectsEmptyOwner)).toBeTruthy();
  });

  it("loyihada video ko'rinadi va yulduz tanlanib baho saqlanadi", async () => {
    mockGet({
      [`/portfolio/items/${ITEM.id}/`]: ITEM,
      [`/portfolio/items/${ITEM.id}/reviews/`]: { count: 0, next: null, previous: null, results: [] },
    });
    vi.mocked(api.post).mockResolvedValue(ITEM);
    renderApp(<PortfolioModal id={JASUR.id} item={ITEM.id} />);
    const dialog = await screen.findByRole("dialog", { name: "Portal" });
    expect(dialog.querySelector('video[src="/api/portfolio/videos/5/"]')).toBeTruthy();

    // Yulduzsiz saqlab bo'lmaydi
    const save = within(dialog).getByRole("button", { name: T.portfolio.reviewSave });
    expect((save as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(within(dialog).getByLabelText(T.portfolio.reviewText), { target: { value: "Zo'r ish" } });
    fireEvent.click(save);
    expect(await within(dialog).findByText(T.portfolio.starsRequired)).toBeTruthy();
    expect(api.post).not.toHaveBeenCalled();

    fireEvent.click(within(dialog).getByRole("radio", { name: T.portfolio.starN(4) }));
    fireEvent.click(save);
    await waitFor(() => expect(api.post).toHaveBeenCalledWith(`/portfolio/items/${ITEM.id}/reviews/`, { stars: 4, text: "Zo'r ish" }));
  });

  it("o'z loyihasida baholash yo'q, tahrirlash bor", async () => {
    mockGet({
      [`/portfolio/items/${ITEM.id}/`]: { ...ITEM, actions: { edit: true, delete: false, upload: true, review: false } },
      [`/portfolio/items/${ITEM.id}/reviews/`]: { count: 0, next: null, previous: null, results: [] },
    });
    renderApp(<PortfolioModal id={JASUR.id} item={ITEM.id} />);
    expect(await screen.findByText(T.portfolio.ownHint)).toBeTruthy();
    expect(screen.queryByRole("radiogroup")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: T.common.edit }));
    expect(await screen.findByText(T.portfolio.fields.autoNote)).toBeTruthy();
    expect(screen.queryByLabelText(new RegExp(T.portfolio.fields.title))).toBeNull();
  });

  it("yangi loyiha formasi nomsiz saqlanmaydi, saqlangach yuboradi", async () => {
    mockGet({});
    vi.mocked(api.post).mockResolvedValue({ ...ITEM, id: 11 });
    renderApp(<PortfolioModal id={JASUR.id} add />);
    const save = await screen.findByRole("button", { name: T.common.save });
    expect((save as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText(new RegExp(T.portfolio.fields.title)), { target: { value: "Telegram bot" } });
    fireEvent.change(screen.getByLabelText(T.portfolio.fields.link), { target: { value: "https://github.com/x/bot" } });
    fireEvent.click(save);
    await waitFor(() => expect(api.post).toHaveBeenCalledWith("/portfolio/items/", {
      title: "Telegram bot", description: "", link: "https://github.com/x/bot", start_date: null, end_date: null, project_type: "",
    }));
  });
});

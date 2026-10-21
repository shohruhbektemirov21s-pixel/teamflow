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
  ...JASUR, specialty: "Backend", rating: null, reviews_count: 0, followers_count: 0, projects_count: 0,
  tasks_done: 0, is_following: false, rank: null, status: { state: "free", active_tasks: 0, trip_return_date: null }, ...over,
});

const DETAIL: PortfolioDetail = {
  ...dev({ rating: 4.5, reviews_count: 2, followers_count: 3, projects_count: 1, tasks_done: 7 }),
  experience: { since: "2024-01-15", months: 26 },
  years: [{ year: 2026, projects: 1, tasks: 7 }],
  items: [{ id: 10, is_auto: true, title: "Portal", link: "", start_date: "2025-01-01", end_date: null,
    project: { code: "PRJ-1", stage: "started" }, tasks_done: 7, rating: 4.5, reviews_count: 2, videos_count: 1 }],
  recent_tasks: [{ id: 1, code: "100000001", title: "Kirish sahifasi", project: "Portal", completed_at: "2026-10-01T10:00:00Z" }],
  current_projects: [],
  actions: { follow: true, add: false },
};

const ITEM: PortfolioItemDetail = {
  ...DETAIL.items[0]!, description: "Ichki portal", manual: { title: "", start_date: null, end_date: null },
  owner: JASUR, videos: [{ id: 5, name: "demo.mp4", size: 2048, url: "/api/portfolio/videos/5/" }], attachments: [], my_review: null,
  actions: { edit: false, delete: false, upload: false, review: true },
};

afterEach(() => { testUser.current = PM; });

describe("Portfolio sahifasi", () => {
  it("dasturchilar reyting tartibida va o'rni bilan ko'rinadi, bosilsa portfolio ochiladi", async () => {
    mockGet({
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
    fireEvent.click(await within(dialog).findByRole("tab", { name: T.portfolio.tabs.projects }));
    expect(await within(dialog).findByRole("button", { name: /Portal/ })).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("tab", { name: T.portfolio.tabs.overview }));
    expect(await within(dialog).findByText(T.portfolio.experience(26))).toBeTruthy();
  }, 20_000); // ModalHost modalni lazy yuklaydi — birinchi transform sekin

  it("dasturchiga o'z portfoliosi tugmasi chiqadi", async () => {
    testUser.current = { ...PM, id: JASUR.id, role: "developer" };
    mockGet({ "/portfolio/": { count: 0, next: null, previous: null, results: [] } });
    renderApp(<PortfolioPage />);
    expect(await screen.findByRole("button", { name: T.portfolio.mine })).toBeTruthy();
    expect(await screen.findByText(T.portfolio.empty)).toBeTruthy();
  });
});

describe("Portfolio oynasi", () => {
  it("oddiy foydalanuvchi dasturchining holatini va hozir mas'ul loyihalarini ko'radi", async () => {
    testUser.current = { ...PM, id: 20, role: "user", role_label: "Oddiy foydalanuvchi" };
    mockGet({
      [`/portfolio/${JASUR.id}/`]: {
        ...DETAIL,
        status: { state: "busy", active_tasks: 2, trip_return_date: null },
        current_projects: [{ code: "PRJ-1", name: "Ichki portal", stage: "started", active_tasks: 2 }],
      },
    });
    renderApp(<PortfolioModal id={JASUR.id} />);

    const dialog = await screen.findByRole("dialog", { name: T.portfolio.title });
    expect(await within(dialog).findByText(T.portfolio.currentProjects)).toBeTruthy();
    expect(within(dialog).getByText("Ichki portal")).toBeTruthy();
    expect(within(dialog).getByText("PRJ-1")).toBeTruthy();
    expect(within(dialog).getByText(T.portfolio.currentProjectTasks(2))).toBeTruthy();
    expect(within(dialog).getAllByText(T.portfolio.status.busy(2)).length).toBeGreaterThan(0);
  });

  it("faol loyihasi bo'lmasa, buni aytadi", async () => {
    mockGet({ [`/portfolio/${JASUR.id}/`]: DETAIL });
    renderApp(<PortfolioModal id={JASUR.id} />);
    const dialog = await screen.findByRole("dialog", { name: T.portfolio.title });
    expect(await within(dialog).findByText(T.portfolio.currentProjectsEmpty)).toBeTruthy();
    expect(within(dialog).getAllByText(T.portfolio.status.free).length).toBeGreaterThan(0);
  });

  it("profil ma'lumotlarini Umumiy, Loyihalar va Baholar tablariga ajratadi", async () => {
    const richDetail = {
      ...DETAIL,
      bio: "Murakkab backend tizimlarini yarataman.",
      items: [{
        ...DETAIL.items[0]!,
        cover: "/api/portfolio/covers/10/",
        technologies: ["Python", "Django"],
      }],
      reviews: [{
        id: 31,
        author: MALIKA,
        stars: 5,
        created_at: "2026-10-10T08:00:00Z",
        updated_at: "2026-10-10T08:00:00Z",
        item: { id: 10, title: "Portal" },
      }],
    };
    mockGet({ [`/portfolio/${JASUR.id}/`]: richDetail });
    renderApp(<PortfolioModal id={JASUR.id} />);

    const dialog = await screen.findByRole("dialog", { name: T.portfolio.title });
    expect((await within(dialog).findByRole("tab", { name: T.portfolio.tabs.overview })).getAttribute("aria-selected")).toBe("true");
    expect(await within(dialog).findByText("Murakkab backend tizimlarini yarataman.")).toBeTruthy();
    expect(within(dialog).queryByText("Xabar yuborish")).toBeNull();

    fireEvent.click(within(dialog).getByRole("tab", { name: T.portfolio.tabs.projects }));
    expect((await within(dialog).findByRole("img", { name: "Portal muqovasi" })).getAttribute("src")).toBe("/api/portfolio/covers/10/");
    expect(within(dialog).getByText("Python")).toBeTruthy();
    expect(within(dialog).getByText("Django")).toBeTruthy();

    fireEvent.click(within(dialog).getByRole("tab", { name: T.portfolio.tabs.reviews }));
    expect(await within(dialog).findByText(MALIKA.full_name)).toBeTruthy();
    expect(within(dialog).getByText("Portal")).toBeTruthy();
  });

  it("muqovasiz loyiha uchun rasm o'rniga placeholder ko'rsatadi", async () => {
    mockGet({ [`/portfolio/${JASUR.id}/`]: { ...DETAIL, items: [{ ...DETAIL.items[0]!, cover: null, technologies: [] }] } });
    renderApp(<PortfolioModal id={JASUR.id} />);

    const dialog = await screen.findByRole("dialog", { name: T.portfolio.title });
    fireEvent.click(await within(dialog).findByRole("tab", { name: T.portfolio.tabs.projects }));
    expect(await within(dialog).findByLabelText("Portal uchun muqova mavjud emas")).toBeTruthy();
  });

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
    fireEvent.click(screen.getByRole("tab", { name: T.portfolio.tabs.projects }));
    expect(await screen.findByText(T.portfolio.projectsEmptyOwner)).toBeTruthy();
  });

  it("loyihada video ko'rinadi va yulduz tanlanib baho saqlanadi", async () => {
    mockGet({
      [`/portfolio/items/${ITEM.id}/`]: ITEM,
      [`/portfolio/items/${ITEM.id}/comments/`]: { count: 0, next: null, previous: null, results: [] },
      [`/portfolio/items/${ITEM.id}/history/`]: { count: 0, next: null, previous: null, results: [] },
    });
    vi.mocked(api.post).mockResolvedValue(ITEM);
    renderApp(<PortfolioModal id={JASUR.id} item={ITEM.id} />);
    const dialog = await screen.findByRole("dialog", { name: "Portal" });
    expect(dialog.querySelector('video[src="/api/portfolio/videos/5/"]')).toBeTruthy();

    // Yulduzsiz saqlab bo'lmaydi
    const save = within(dialog).getByRole("button", { name: T.portfolio.reviewSave });
    expect((save as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(within(dialog).getByRole("radio", { name: T.portfolio.starN(4) }));
    fireEvent.click(save);
    await waitFor(() => expect(api.post).toHaveBeenCalledWith(`/portfolio/items/${ITEM.id}/reviews/`, { stars: 4 }));
  });

  it("sharh yuboriladi (bahodan alohida) va o'z sharhini o'chirish mumkin, boshqasiniki yo'q", async () => {
    const mine = { id: 1, author: PM, text: "Birinchi sharh", created_at: "2026-10-10T08:00:00Z", can_delete: true };
    const others = { id: 2, author: MALIKA, text: "Boshqaning sharhi", created_at: "2026-10-10T09:00:00Z", can_delete: false };
    mockGet({
      [`/portfolio/items/${ITEM.id}/`]: ITEM,
      [`/portfolio/items/${ITEM.id}/comments/`]: { count: 2, next: null, previous: null, results: [others, mine] },
      [`/portfolio/items/${ITEM.id}/history/`]: { count: 0, next: null, previous: null, results: [] },
    });
    vi.mocked(api.post).mockResolvedValue({});
    vi.mocked(api.del).mockResolvedValue(undefined);
    renderApp(<PortfolioModal id={JASUR.id} item={ITEM.id} />);
    const dialog = await screen.findByRole("dialog", { name: "Portal" });
    expect(await within(dialog).findByText("Boshqaning sharhi")).toBeTruthy();
    expect(within(dialog).getByText("Birinchi sharh")).toBeTruthy();
    // faqat o'z sharhida o'chirish tugmasi bor
    expect(within(dialog).getAllByRole("button", { name: T.portfolio.commentDelete })).toHaveLength(1);

    const send = within(dialog).getByRole("button", { name: T.portfolio.commentSend });
    expect((send as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(within(dialog).getByLabelText(T.portfolio.commentLabel), { target: { value: "  Ikkinchi sharh " } });
    fireEvent.click(send);
    await waitFor(() => expect(api.post).toHaveBeenCalledWith(`/portfolio/items/${ITEM.id}/comments/`, { text: "Ikkinchi sharh" }));
    expect(api.post).not.toHaveBeenCalledWith(`/portfolio/items/${ITEM.id}/reviews/`, expect.anything());

    fireEvent.click(within(dialog).getByRole("button", { name: T.portfolio.commentDelete }));
    fireEvent.click(await screen.findByRole("button", { name: T.common.yes }));
    await waitFor(() => expect(api.del).toHaveBeenCalledWith(`/portfolio/items/${ITEM.id}/comments/${mine.id}/`));
  });

  const attachments = [
    { id: 1, name: "ekran.png", kind: "image" as const, size: 1000, url: "/api/portfolio/attachments/1/", created_at: "2026-10-10T08:00:00Z" },
    { id: 2, name: "hisobot.pdf", kind: "file" as const, size: 2048, url: "/api/portfolio/attachments/2/", created_at: "2026-10-11T08:00:00Z" },
  ];
  const history = [
    { id: 9, verb: "portfolio_file_added", message: "Jasur Alimov fayl qo'shdi: hisobot.pdf", created_at: "2026-10-11T08:00:00Z" },
  ];
  const attachmentRoutes = (actions: PortfolioItemDetail["actions"]) => ({
    [`/portfolio/items/${ITEM.id}/`]: { ...ITEM, attachments, actions },
    [`/portfolio/items/${ITEM.id}/comments/`]: { count: 0, next: null, previous: null, results: [] },
    [`/portfolio/items/${ITEM.id}/history/`]: { count: 1, next: null, previous: null, results: history },
  });

  it("boshqa foydalanuvchi rasm, fayl va tarixni ko'radi, yuklash va o'chirish yo'q", async () => {
    mockGet(attachmentRoutes({ edit: false, delete: false, upload: false, review: true }));
    renderApp(<PortfolioModal id={JASUR.id} item={ITEM.id} />);
    const dialog = await screen.findByRole("dialog", { name: "Portal" });
    expect(within(dialog).getByRole("img", { name: "ekran.png" }).getAttribute("src")).toBe("/api/portfolio/attachments/1/");
    expect(within(dialog).getByText("hisobot.pdf")).toBeTruthy();
    expect(within(dialog).getByRole("link", { name: new RegExp(T.portfolio.attachmentDownload) }).getAttribute("href")).toBe("/api/portfolio/attachments/2/");
    expect(await within(dialog).findByText("Jasur Alimov fayl qo'shdi: hisobot.pdf")).toBeTruthy();
    expect(within(dialog).queryByText(T.portfolio.attachmentPick)).toBeNull();
    expect(within(dialog).queryByRole("button", { name: T.portfolio.attachmentDelete })).toBeNull();
  });

  it("egasi fayl yuklaydi va o'chiradi", async () => {
    mockGet(attachmentRoutes({ edit: true, delete: false, upload: true, review: false }));
    vi.mocked(api.post).mockResolvedValue({});
    vi.mocked(api.del).mockResolvedValue(undefined);
    renderApp(<PortfolioModal id={JASUR.id} item={ITEM.id} />);
    const dialog = await screen.findByRole("dialog", { name: "Portal" });
    const input = dialog.querySelector('input[type="file"][accept*=".docx"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File(["pdf"], "yangi.pdf", { type: "application/pdf" })] } });
    fireEvent.click(await within(dialog).findByRole("button", { name: T.portfolio.attachmentUpload }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith(`/portfolio/items/${ITEM.id}/attachments/`, expect.any(FormData)));
    const body = vi.mocked(api.post).mock.calls[0]![1] as FormData;
    expect((body.get("file") as File).name).toBe("yangi.pdf");

    fireEvent.click(within(dialog).getAllByRole("button", { name: T.portfolio.attachmentDelete })[0]!);
    fireEvent.click(await screen.findByRole("button", { name: T.common.yes }));
    await waitFor(() => expect(api.del).toHaveBeenCalledWith(`/portfolio/items/${ITEM.id}/attachments/1/`));
  });

  it("o'z loyihasida baholash yo'q, tahrirlash bor", async () => {
    mockGet({
      [`/portfolio/items/${ITEM.id}/`]: { ...ITEM, actions: { edit: true, delete: false, upload: true, review: false } },
      [`/portfolio/items/${ITEM.id}/comments/`]: { count: 0, next: null, previous: null, results: [] },
      [`/portfolio/items/${ITEM.id}/history/`]: { count: 0, next: null, previous: null, results: [] },
    });
    renderApp(<PortfolioModal id={JASUR.id} item={ITEM.id} />);
    expect(await screen.findByText(T.portfolio.ownHint)).toBeTruthy();
    expect(screen.queryByRole("radiogroup")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: T.common.edit }));
    expect(await screen.findByText(T.portfolio.fields.autoNote)).toBeTruthy();
    expect(screen.queryByLabelText(new RegExp(T.portfolio.fields.title))).toBeNull();
  });

  it("yangi loyiha formasi texnologiya va muqovani saqlaydi", async () => {
    mockGet({});
    vi.mocked(api.post).mockImplementation(async (url) => url === "/portfolio/items/" ? { ...ITEM, id: 11 } : {});
    renderApp(<PortfolioModal id={JASUR.id} add />);
    const save = await screen.findByRole("button", { name: T.common.save });
    expect((save as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText(new RegExp(T.portfolio.fields.title)), { target: { value: "Telegram bot" } });
    fireEvent.change(screen.getByLabelText(T.portfolio.fields.link), { target: { value: "https://github.com/x/bot" } });
    fireEvent.change(screen.getByLabelText(T.portfolio.fields.technologies), { target: { value: "Python, Django" } });
    const cover = new File(["cover"], "cover.png", { type: "image/png" });
    fireEvent.change(screen.getByLabelText(T.portfolio.fields.cover), { target: { files: [cover] } });
    fireEvent.click(save);
    await waitFor(() => expect(api.post).toHaveBeenCalledWith("/portfolio/items/", {
      title: "Telegram bot", description: "", link: "https://github.com/x/bot", start_date: null, end_date: null,
      technologies: ["Python", "Django"],
    }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith("/portfolio/items/11/cover/", expect.any(FormData)));
    const coverCall = vi.mocked(api.post).mock.calls.find(([url]) => url === "/portfolio/items/11/cover/");
    expect((coverCall?.[1] as FormData).get("cover")).toBe(cover);
  });

  it("muqova sifatida rasm bo'lmagan faylni brauzerning o'zida rad etadi", async () => {
    renderApp(<PortfolioModal id={JASUR.id} add />);
    const invalid = new File(["x"], "cover.pdf", { type: "application/pdf" });
    fireEvent.change(await screen.findByLabelText(T.portfolio.fields.cover), { target: { files: [invalid] } });
    expect((await screen.findByRole("alert")).textContent).toContain("JPG, PNG yoki WEBP");
  });
});

import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { JASUR, PM, taskDetail, testUser } from "@/test/fixtures";
import { api, ApiError } from "@/shared/api";
import { mockGet, renderApp } from "@/test/render";
import { T } from "@/shared/text";

import PersonModal from "./PersonModal";

const ROW = {
  ...JASUR, role_label: "Dasturchi", specialty: "Backend",
  active_tasks: 0, overdue_tasks: 0, review_tasks: 0, done_tasks: 1, doing: [],
};

const R = T.people.responsible;
const RESP = `/people/${JASUR.id}/responsible-projects/`;
const BASE = { [`/people/${JASUR.id}/`]: ROW, [`/tasks/?assignee=${JASUR.id}`]: [], [RESP]: { can_manage: true, can_post: true, projects: [] } };

afterEach(() => { testUser.current = PM; });

describe("PersonModal", () => {
  it.each(["boss", "pm"] as const)("%s mas'ul loyiha qo'shadi va unga yangilik yozadi", async (role) => {
    testUser.current = { ...PM, role };
    const project = { id: 5, name: "Kadrlar portali", description: "Ichki tizim", created_at: "2026-10-14T09:00:00Z", updated_at: "2026-10-14T09:00:00Z", news_count: 0, last_news_at: null };
    let projects: unknown[] = [];
    mockGet({ ...BASE, "/responsible-projects/5/news/": { count: 0, next: null, previous: null, results: [] } });
    const staticGet = vi.mocked(api.get).getMockImplementation()!;
    vi.mocked(api.get).mockImplementation(async (path: string) =>
      path === RESP ? ({ can_manage: true, can_post: true, projects } as never) : staticGet(path));
    vi.mocked(api.post).mockImplementation(async (path: string) => {
      if (path === RESP) { projects = [project]; return project as never; }
      return { id: 1, text: "API tayyor", created_at: "2026-10-14T10:00:00Z", author: { id: 1, full_name: "PM" } } as never;
    });
    renderApp(<PersonModal id={JASUR.id} />);
    const region = await screen.findByRole("region", { name: R.title });
    expect(await within(region).findByText(R.empty)).toBeTruthy();
    fireEvent.click(within(region).getByRole("button", { name: R.add }));
    fireEvent.change(within(region).getByLabelText(R.name), { target: { value: "Kadrlar portali" } });
    fireEvent.change(within(region).getByLabelText(R.description), { target: { value: "Ichki tizim" } });
    fireEvent.click(within(region).getByRole("button", { name: T.common.save }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith(RESP, { name: "Kadrlar portali", description: "Ichki tizim" }));
    expect(await within(region).findByText("Kadrlar portali")).toBeTruthy();
    fireEvent.click(within(region).getByRole("button", { name: R.newsN(0) }));
    fireEvent.change(await within(region).findByLabelText(R.newsLabel), { target: { value: "API tayyor" } });
    fireEvent.click(within(region).getByRole("button", { name: R.newsAdd }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith("/responsible-projects/5/news/", { text: "API tayyor" }));
  });

  it("server ruxsat bermasa qo'shish/tahrirlash tugmalari yo'q", async () => {
    mockGet({ ...BASE, [RESP]: { can_manage: false, can_post: true, projects: [{ id: 5, name: "Kadrlar portali", description: "", created_at: "2026-10-14T09:00:00Z", updated_at: "2026-10-14T09:00:00Z", news_count: 2, last_news_at: "2026-10-14T09:00:00Z" }] } });
    renderApp(<PersonModal id={JASUR.id} />);
    const region = await screen.findByRole("region", { name: R.title });
    expect(await within(region).findByText("Kadrlar portali")).toBeTruthy();
    expect(within(region).queryByRole("button", { name: R.add })).toBeNull();
    expect(within(region).queryByRole("button", { name: T.common.edit })).toBeNull();
    expect(within(region).getByRole("button", { name: R.newsN(2) })).toBeTruthy();
  });

  it("loyiha saqlash xatosi maydon yonida, matn qoladi", async () => {
    mockGet({ ...BASE, [RESP]: { can_manage: true, can_post: true, projects: [] } });
    vi.mocked(api.post).mockRejectedValue(new ApiError(400, "Xato", { name: ["Nom juda uzun"] }));
    renderApp(<PersonModal id={JASUR.id} />);
    fireEvent.click(await screen.findByRole("button", { name: R.add }));
    fireEvent.change(screen.getByLabelText(R.name), { target: { value: "API" } });
    fireEvent.click(screen.getByRole("button", { name: T.common.save }));
    expect(await screen.findByText("Nom juda uzun")).toBeTruthy();
    expect((screen.getByLabelText(R.name) as HTMLInputElement).value).toBe("API");
  });

  it("boshqarma xodimida mas'ul loyihalar bo'limi yo'q", async () => {
    testUser.current = { ...PM, role: "boss" };
    mockGet({ [`/people/${JASUR.id}/`]: { ...ROW, role: "department", role_label: "Boshqarma" } });
    renderApp(<PersonModal id={JASUR.id} />);
    expect(await screen.findByText(T.people.devOnly)).toBeTruthy();
    expect(screen.queryByRole("region", { name: R.title })).toBeNull();
  });

  it("profil loyiha va barcha vazifalarni ko'rsatadi", async () => {
    mockGet({
      [`/people/${JASUR.id}/`]: { ...ROW, projects: [{ id: 8, name: "Xodim portali", code: "PRJ-8", stage: "done", end_date: "2026-10-01" }] },
      [`/tasks/?assignee=${JASUR.id}`]: [taskDetail({ title: "Profil vazifasi" })],
      [RESP]: BASE[RESP],
    });
    renderApp(<PersonModal id={JASUR.id} />);
    expect(await screen.findByText("Xodim portali")).toBeTruthy();
    expect(await screen.findByText("Profil vazifasi")).toBeTruthy();
  });

  it("profil yuklanmasa qayta urinish ko'rinadi", async () => {
    mockGet({});
    renderApp(<PersonModal id={99} />);
    expect(await screen.findByRole("button", { name: T.common.retry })).toBeTruthy();
  });

  it("vazifalar yuklanmasa hisobotda yolg'on nol ko'rsatmaydi", async () => {
    mockGet({ [`/people/${JASUR.id}/`]: ROW, [RESP]: BASE[RESP] });
    renderApp(<PersonModal id={JASUR.id} />);
    fireEvent.click(await screen.findByRole("tab", { name: T.people.report }));
    expect(await screen.findByRole("button", { name: T.common.retry })).toBeTruthy();
    expect(screen.queryByText("0%")).toBeNull();
  });
  it("faqat shu xodimning vazifalarini so'raydi (avval `??assignee` bilan hammasi kelardi)", async () => {
    // mockGet noma'lum yo'lda xato beradi — URL noto'g'ri bo'lsa vazifa chiqmaydi
    mockGet({
      [`/people/${JASUR.id}/`]: ROW,
      [`/tasks/?assignee=${JASUR.id}`]: [taskDetail({ title: "Jasurning vazifasi", status: "done" })],
      [RESP]: BASE[RESP],
    });
    renderApp(<PersonModal id={JASUR.id} />);

    expect(await screen.findByText("Jasurning vazifasi")).toBeTruthy();
    expect(screen.getByText(T.people.freeNow)).toBeTruthy();
    expect(screen.queryByText(/undefined/)).toBeNull();
  });
});

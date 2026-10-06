import { fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { api, ApiError } from "@/shared/api";
import { T } from "@/shared/text";
import type { ProjectDetail } from "@/shared/types";
import { JASUR, MALIKA, PM } from "@/test/fixtures";
import { mockGet, renderApp } from "@/test/render";

import ProjectModal from "./ProjectModal";

const PROJECT: ProjectDetail = {
  id: 1, code: "200000001", name: "Portal", description: "", stage: "started",
  start_date: "2026-09-01", end_date: "2026-11-01", order_id: null,
  members: [JASUR], progress: { total: 0, done: 0 }, created_at: "2026-09-01T10:00:00Z",
  created_by: { id: PM.id, full_name: PM.full_name, role: "pm", department_name: "" },
  files: [], order: null,
  actions: { edit: true, edit_info: true, members: true, files: true, add_task: true },
  stage_targets: ["planned", "needs_fix", "done"],
  completion: null,
};

function setup(overrides: Partial<ProjectDetail> = {}) {
  mockGet({
    "/projects/1/": { ...PROJECT, ...overrides },
    "/tasks/?project=1": [],
    ...Object.fromEntries(["", "mal"].flatMap((q) => [[], [JASUR.id], [JASUR.id, MALIKA.id]].map((ids) => {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      if (ids.length) params.set("ids", ids.join(","));
      return [`/developers/${params.size ? `?${params}` : ""}`, [
        { id: JASUR.id, full_name: JASUR.full_name, specialty: "Backend" },
        { id: MALIKA.id, full_name: MALIKA.full_name, specialty: "Frontend" },
      ]];
    }))),
  });
  renderApp(<ProjectModal id={1} />);
}

describe("ProjectModal — yakunlash", () => {
  it("vazifalarni faqat vazifalar tabi ochilganda yuklaydi", async () => {
    setup();
    await screen.findByRole("button", { name: T.projects.requestCompletion });
    expect(api.get).not.toHaveBeenCalledWith("/tasks/?project=1");
    expect(api.get).not.toHaveBeenCalledWith("/developers/");
    fireEvent.click(screen.getByRole("tab", { name: /Vazifalar/ }));
    await waitFor(() => expect(api.get).toHaveBeenCalledWith("/tasks/?project=1"));
  });

  it("hamma rozi bo'lgach PM yakunlaydi va oldingi hisobotni saqlaydi", async () => {
    vi.mocked(api.patch).mockResolvedValue({ ...PROJECT, stage: "done", completion: null });
    setup({ completion_note: "Portal tayyor", completion: { requested_at: "2026-10-06T10:00:00Z", pending: [], confirmed: [JASUR] } });
    expect(await screen.findByText(T.projects.completionAckReady)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: T.projects.requestCompletion }));
    await waitFor(() => expect(api.patch).toHaveBeenCalledWith("/projects/1/", { stage: "done" }));
    expect(screen.queryByRole("dialog", { name: T.projects.completionModalTitle })).toBeNull();
  });

  it("alohida modal ochadi, izoh va fayllarni birga yuboradi", async () => {
    vi.mocked(api.patch).mockResolvedValue({ ...PROJECT, stage: "pending_approval", completion: null });
    setup();
    fireEvent.click(await screen.findByRole("button", { name: T.projects.requestCompletion }));
    expect(api.patch).not.toHaveBeenCalled();
    const dialog = screen.getByRole("dialog", { name: T.projects.completionModalTitle });
    expect(dialog.parentElement?.classList.contains("overlay-stacked")).toBe(true);
    expect(document.querySelector('.overlay[aria-hidden="true"]')).toBeTruthy();
    fireEvent.change(screen.getByLabelText(T.projects.completionNote), { target: { value: "Portal tayyor" } });
    const file = new File(["result"], "hisobot.pdf", { type: "application/pdf" });
    fireEvent.change(dialog.querySelector('input[type="file"]')!, { target: { files: [file] } });
    fireEvent.click(screen.getByRole("button", { name: T.projects.completionSend }));
    await waitFor(() => expect(api.patch).toHaveBeenCalled());
    const [url, payload] = vi.mocked(api.patch).mock.calls[0]!;
    expect(url).toBe("/projects/1/");
    expect((payload as FormData).get("stage")).toBe("done");
    expect((payload as FormData).get("completion_note")).toBe("Portal tayyor");
    expect((payload as FormData).getAll("files")).toEqual([file]);
    await waitFor(() => expect(screen.queryByRole("dialog", { name: T.projects.completionModalTitle })).toBeNull());
    expect(screen.getByRole("dialog")).toBeTruthy();
  });

  it("bekor qilish yakunlash so'rovini yubormaydi", async () => {
    setup();
    fireEvent.click(await screen.findByRole("button", { name: T.projects.requestCompletion }));
    fireEvent.click(screen.getByRole("button", { name: T.common.cancel }));
    expect(api.patch).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog", { name: T.projects.completionModalTitle })).toBeNull();
    expect(screen.getByRole("dialog")).toBeTruthy();
  });

  it("yuborish xatosida izohni saqlab, qayta urinishga imkon beradi", async () => {
    vi.mocked(api.patch).mockRejectedValueOnce(new ApiError(400, "Fayl yuklanmadi"));
    setup();
    fireEvent.click(await screen.findByRole("button", { name: T.projects.requestCompletion }));
    fireEvent.change(screen.getByLabelText(T.projects.completionNote), { target: { value: "Portal tayyor" } });
    fireEvent.click(screen.getByRole("button", { name: T.projects.completionSend }));
    await screen.findAllByText("Fayl yuklanmadi");
    expect(screen.getByRole("dialog", { name: T.projects.completionModalTitle })).toBeTruthy();
    expect((screen.getByLabelText(T.projects.completionNote) as HTMLTextAreaElement).value).toBe("Portal tayyor");
  });
});

describe("ProjectModal — Jamoa", () => {
  it.each(["done", "pending_approval"] as const)("%s loyihada vazifa qo'shish va berish yashiriladi", async (stage) => {
    setup({ stage, stage_targets: [] });
    await screen.findByRole("tab", { name: /Jamoa/ });
    expect(screen.queryByRole("button", { name: T.projects.addTask })).toBeNull();
    fireEvent.click(screen.getByRole("tab", { name: /Jamoa/ }));
    await screen.findByText(JASUR.full_name);
    expect(screen.queryByRole("button", { name: new RegExp(T.projects.giveTask) })).toBeNull();
  });

  it("dasturchi tasdig'i kutilayotganda vazifa qo'shish yashiriladi", async () => {
    setup({ completion: { requested_at: "2026-10-06T10:00:00Z", pending: [JASUR], confirmed: [] } });
    await screen.findByRole("tab", { name: /Jamoa/ });
    expect(screen.queryByRole("button", { name: T.projects.addTask })).toBeNull();
  });
  it("faqat loyiha a'zolarini ko'rsatadi, qolganlar qidiruv orqali qo'shiladi", async () => {
    setup();
    fireEvent.click(await screen.findByRole("tab", { name: /Jamoa/ }));

    expect(await screen.findByText(JASUR.full_name)).toBeTruthy();
    expect(screen.queryByText(MALIKA.full_name)).toBeNull();

    fireEvent.change(screen.getByLabelText(T.projects.teamSearchPh), { target: { value: "mal" } });
    fireEvent.click(await screen.findByRole("button", { name: new RegExp(MALIKA.full_name) }));

    expect(screen.getByText(T.projects.teamUnsaved)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: new RegExp(T.projects.saveTeam) }));
    await waitFor(() => expect(api.put).toHaveBeenCalledWith("/projects/1/members/", { member_ids: [JASUR.id, MALIKA.id] }));
  });

  it("jamoa saqlanmaguncha vazifa berish tugmasi o'chiq", async () => {
    setup();
    fireEvent.click(await screen.findByRole("tab", { name: /Jamoa/ }));
    const give = await screen.findByRole("button", { name: new RegExp(T.projects.giveTask) });
    expect((give as HTMLButtonElement).disabled).toBe(false);

    fireEvent.change(screen.getByLabelText(T.projects.teamSearchPh), { target: { value: "mal" } });
    fireEvent.click(await screen.findByRole("button", { name: new RegExp(MALIKA.full_name) }));
    expect(screen.getByText(T.projects.teamSaveFirst)).toBeTruthy();
    expect((give as HTMLButtonElement).disabled).toBe(true);
  });
});

describe("ProjectModal — tarix", () => {
  it("keyingi tarix sahifasini ko'rsatadi", async () => {
    mockGet({
      "/projects/1/": PROJECT,
      "/tasks/?project=1": [],
      "/developers/": [],
      "/history/?project=1&paginated=1": { count: 21, next: true, previous: false, results: [] },
      "/history/?project=1&paginated=1&page=2": { count: 21, next: false, previous: true, results: [
        { id: 21, actor: null, verb: "task_created", message: "Eski voqea", created_at: "2026-09-01T10:00:00Z", target: null },
      ] },
    });
    renderApp(<ProjectModal id={1} />);

    fireEvent.click(await screen.findByRole("tab", { name: T.projects.tabHistory }));
    fireEvent.click(await screen.findByRole("button", { name: /Keyingi/ }));

    expect(await screen.findByText("Eski voqea")).toBeTruthy();
  });
});

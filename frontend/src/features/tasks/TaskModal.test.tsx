import { fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { api } from "@/shared/api";
import { JASUR, MALIKA, taskDetail } from "@/test/fixtures";
import { mockGet, renderApp } from "@/test/render";
import { T } from "@/shared/text";

import TaskModal from "./TaskModal";

describe("TaskModal", () => {
  it("ruxsatsiz submit havolasi formani ochmaydi", async () => {
    mockGet({ "/tasks/1/": taskDetail({ actions: { ...taskDetail().actions, submit: false } }) });
    renderApp(<TaskModal id={1} submitMode />);

    await screen.findByText(T.tasks.info);
    expect(screen.queryByText(T.tasks.submitTitle)).toBeNull();
  });

  it("ish jurnali yozuvi muallif bilan chiqadi (avval `wl.user` tufayli modal sinardi)", async () => {
    mockGet({
      "/tasks/1/": taskDetail({
        worklog_hours: "2.50",
        worklogs: [{ id: 7, author: JASUR, work_date: "2026-09-29", hours: "2.50", note: "Forma yozildi", can_delete: true }],
      }),
      "/projects/1/": { id: 1, members: [] },
    });
    renderApp(<TaskModal id={1} />);

    expect(await screen.findByText(JASUR.full_name, { selector: "b" })).toBeTruthy();
    expect(screen.getByText("Forma yozildi")).toBeTruthy();
    expect(screen.getByText(T.tasks.worklog(2.5))).toBeTruthy();
    expect(screen.getByText("29.09.2026")).toBeTruthy();
    expect(screen.getByRole("button", { name: T.common.delete })).toBeTruthy(); // can_delete
  });

  it("bajarilgan vazifada 'Bugun tugaydi' yozilmaydi", async () => {
    const due = new Date();
    due.setHours(23, 0, 0, 0);
    mockGet({
      "/tasks/1/": taskDetail({ status: "done", due_at: due.toISOString(), completed_at: new Date().toISOString() }),
      "/projects/1/": { id: 1, members: [] },
    });
    renderApp(<TaskModal id={1} />);

    await screen.findByText(T.tasks.info);
    expect(screen.queryByText(T.common.daysLeft(0))).toBeNull();
  });

  it("ijrochi qo'shish: qidiruvdan dasturchi tanlanadi va saqlanadi", async () => {
    mockGet({
      "/tasks/1/": taskDetail({ actions: { ...taskDetail().actions, manage_assignees: true } }),
      "/developers/": [
        { id: JASUR.id, full_name: JASUR.full_name, specialty: "Backend" },
        { id: MALIKA.id, full_name: MALIKA.full_name, specialty: "Frontend" },
      ],
    });
    renderApp(<TaskModal id={1} />);

    fireEvent.click(await screen.findByRole("button", { name: T.tasks.assigneesEdit }));
    fireEvent.change(screen.getByLabelText(`${T.tasks.assignees}: ${T.tasks.picker.searchPh}`), { target: { value: "mal" } });
    fireEvent.click(await screen.findByRole("button", { name: new RegExp(MALIKA.full_name) }));
    fireEvent.click(screen.getByRole("button", { name: T.common.save }));

    await waitFor(() => expect(api.put).toHaveBeenCalledWith("/tasks/1/assignees/", { assignee_ids: [JASUR.id, MALIKA.id] }));
  });

  it("ruxsat bo'lmasa ijrochini o'zgartirish tugmasi chiqmaydi", async () => {
    mockGet({ "/tasks/1/": taskDetail() });
    renderApp(<TaskModal id={1} />);

    await screen.findByText(T.tasks.info);
    expect(screen.queryByRole("button", { name: T.tasks.assigneesEdit })).toBeNull();
  });

  it("sub-vazifada bir nechta ijrochi ko'rinadi", async () => {
    mockGet({
      "/tasks/1/": taskDetail({
        subtasks: [{ id: 5, title: "Test yozish", is_done: false, assignees: [JASUR, MALIKA], can_toggle: true }],
      }),
    });
    renderApp(<TaskModal id={1} />);

    expect(await screen.findByText("Test yozish")).toBeTruthy();
    expect(screen.getByTitle(`${JASUR.full_name}, ${MALIKA.full_name}`)).toBeTruthy();
  });

  it("sub-vazifa qatoriga bosilsa ijrochi tahrirlash paneli ochiladi/yopiladi", async () => {
    mockGet({
      "/tasks/1/": taskDetail({
        subtasks: [{ id: 5, title: "Test yozish", is_done: false, assignees: [JASUR], can_toggle: true, can_delete: true }],
      }),
    });
    renderApp(<TaskModal id={1} />);

    const row = await screen.findByRole("button", { name: `${T.tasks.subtaskPeople}: Test yozish` });
    expect(screen.queryByText(`${T.tasks.subtaskPeople}: Test yozish`)).toBeNull();

    fireEvent.click(row);
    expect(await screen.findByText(`${T.tasks.subtaskPeople}: Test yozish`)).toBeTruthy();

    fireEvent.click(row);
    await waitFor(() => expect(screen.queryByText(`${T.tasks.subtaskPeople}: Test yozish`)).toBeNull());
  });

  it("ruxsat bo'lmagan sub-vazifa qatori bosilmaydi", async () => {
    mockGet({
      "/tasks/1/": taskDetail({
        subtasks: [{ id: 5, title: "Test yozish", is_done: false, assignees: [JASUR], can_toggle: true, can_delete: false }],
      }),
    });
    renderApp(<TaskModal id={1} />);

    const row = await screen.findByRole("button", { name: `${T.tasks.subtaskPeople}: Test yozish` });
    expect((row as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(row);
    expect(screen.queryByText(`${T.tasks.subtaskPeople}: Test yozish`)).toBeNull();
  });

  it("arxivlangan vazifa izohlari faqat o'qiladi", async () => {
    mockGet({
      "/tasks/1/": taskDetail({ archived_at: "2026-10-02T10:00:00Z" }),
      "/comments/?target_type=task&target_id=1": [],
    });
    renderApp(<TaskModal id={1} />);

    expect(await screen.findByText(T.tasks.archived)).toBeTruthy();
    expect(screen.queryByRole("textbox", { name: T.common.comments })).toBeNull();
  });

  describe("Tekshiruvga yuborish oynasi", () => {
    const canSubmit = () => taskDetail({ status: "in_progress", actions: { ...taskDetail().actions, submit: true } });

    it("alohida ekran: sarlavha, izoh, hisoblagich va fayllar soni", async () => {
      mockGet({ "/tasks/1/": canSubmit() });
      renderApp(<TaskModal id={1} submitMode />);

      expect(await screen.findByText(T.tasks.submitSubtitle)).toBeTruthy();
      expect(screen.getByText(T.tasks.submitCounter(0, 1000))).toBeTruthy();
      expect(screen.getByText(T.common.attachedCount(0))).toBeTruthy();
      expect(screen.queryByText(T.tasks.info)).toBeNull(); // vazifa tafsilotlari o'rnini egallagan
    });

    it("bo'sh matn bilan serverga yubormaydi, xato maydon yonida chiqadi", async () => {
      mockGet({ "/tasks/1/": canSubmit() });
      renderApp(<TaskModal id={1} submitMode />);

      fireEvent.click(await screen.findByRole("button", { name: T.tasks.submit }));

      expect(await screen.findByText(T.common.required)).toBeTruthy();
      expect(api.post).not.toHaveBeenCalled();
    });

    it("yozilganda hisoblagich yangilanadi va xato yo'qoladi", async () => {
      mockGet({ "/tasks/1/": canSubmit() });
      renderApp(<TaskModal id={1} submitMode />);

      fireEvent.click(await screen.findByRole("button", { name: T.tasks.submit }));
      await screen.findByText(T.common.required);
      fireEvent.change(screen.getByRole("textbox", { name: /Nima qildingiz/ }), { target: { value: "Tayyor" } });

      expect(screen.getByText(T.tasks.submitCounter(6, 1000))).toBeTruthy();
      expect(screen.queryByText(T.common.required)).toBeNull();
    });

    it("ruxsat etilmagan va 20 MB dan katta fayl qabul qilinmaydi", async () => {
      mockGet({ "/tasks/1/": canSubmit() });
      renderApp(<TaskModal id={1} submitMode />);
      await screen.findByText(T.tasks.submitSubtitle);

      const big = new File(["x"], "katta.pdf");
      Object.defineProperty(big, "size", { value: 21 * 1024 * 1024 });
      const ok = new File(["x"], "hisobot.pdf");
      const input = document.querySelector<HTMLInputElement>('input[type="file"]')!;
      fireEvent.change(input, { target: { files: [new File(["x"], "virus.exe"), big, ok] } });

      expect(await screen.findByText(/Qabul qilinmadi: virus\.exe, katta\.pdf/)).toBeTruthy();
      expect(screen.getByText("hisobot.pdf")).toBeTruthy();
      expect(screen.getByText(T.common.attachedCount(1))).toBeTruthy();
    });
  });
});

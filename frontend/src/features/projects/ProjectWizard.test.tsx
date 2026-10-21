import { fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { api } from "@/shared/api";
import { T } from "@/shared/text";
import { JASUR, MALIKA, META } from "@/test/fixtures";
import { mockGet, renderApp } from "@/test/render";

import ProjectWizard from "./ProjectWizard";

const DEVS = [
  { id: JASUR.id, full_name: JASUR.full_name, specialty: "Backend" },
  { id: MALIKA.id, full_name: MALIKA.full_name, specialty: "Frontend" },
];

const STAGES = [
  { value: "planned", label: "Rejalashtirilgan" },
  { value: "started", label: "Boshlangan" },
  { value: "needs_fix", label: "Tuzatish kerak" },
  { value: "pending_approval", label: "Tasdiqlash kutilmoqda" },
  { value: "done", label: "Yakunlangan" },
];

describe("ProjectWizard — xodimlarga alohida vazifa", () => {
  it("yaratishda ichki tasdiqlash holatini tanlashga qo'ymaydi", async () => {
    mockGet({ "/meta/": { ...META, project_stages: STAGES }, "/developers/": DEVS, [`/developers/?ids=${MALIKA.id}`]: DEVS, [`/developers/?ids=${JASUR.id}`]: DEVS });
    renderApp(<ProjectWizard />);
    expect(await screen.findByText(T.projects.stage)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Tasdiqlash kutilmoqda" })).toBeNull();
  });

  it("har bir xodimga vazifa (sana, fayl) bilan loyihani bitta so'rovda yaratadi", async () => {
    mockGet({ "/developers/": DEVS, [`/developers/?ids=${MALIKA.id}`]: DEVS, [`/developers/?ids=${JASUR.id}`]: DEVS });
    vi.mocked(api.post).mockResolvedValue({ id: 7, code: "200000007" });
    renderApp(<ProjectWizard />);

    // 1-qadam: asosiy
    fireEvent.change(await screen.findByLabelText(new RegExp(T.projects.code)), { target: { value: "PRJ-9" } });
    fireEvent.change(screen.getByLabelText(new RegExp(T.projects.name)), { target: { value: "Portal" } });
    const [start, end] = Array.from(document.querySelectorAll<HTMLInputElement>('input[type="date"]'));
    fireEvent.change(start!, { target: { value: "2026-10-01" } });
    fireEvent.change(end!, { target: { value: "2026-10-31" } });
    fireEvent.click(screen.getByRole("button", { name: new RegExp(T.common.next) }));

    // 2-qadam: jamoa
    fireEvent.click(await screen.findByRole("checkbox", { name: new RegExp(MALIKA.full_name) }));
    fireEvent.click(screen.getByRole("button", { name: new RegExp(T.common.next) }));

    // 3-qadam: Malikaga vazifa
    const section = await screen.findByRole("region", { name: MALIKA.full_name });
    fireEvent.click(section.querySelector("button")!);
    fireEvent.change(screen.getByLabelText(T.projects.quickTaskPh), { target: { value: "Maket" } });
    fireEvent.change(screen.getByLabelText(T.tasks.startsAt), { target: { value: "2026-10-02T09:00" } });
    fireEvent.change(screen.getByLabelText(T.tasks.dueAt), { target: { value: "2026-10-05T18:00" } });
    const file = new File(["x"], "maket.pdf", { type: "application/pdf" });
    const taskFileInput = section.querySelector<HTMLInputElement>('input[type="file"]')!;
    fireEvent.change(taskFileInput, { target: { files: [file] } });

    fireEvent.click(screen.getByRole("button", { name: new RegExp(T.projects.create) }));

    await waitFor(() => expect(api.post).toHaveBeenCalled());
    const [url, body] = vi.mocked(api.post).mock.calls[0]!;
    expect(url).toBe("/projects/setup/");
    const fd = body as FormData;
    expect(fd.get("code")).toBe("PRJ-9");
    const tasks = JSON.parse(String(fd.get("tasks")));
    expect(tasks).toEqual([
      {
        title: "Maket",
        assignee_id: MALIKA.id,
        starts_at: new Date("2026-10-02T09:00").toISOString(),
        due_at: new Date("2026-10-05T18:00").toISOString(),
      },
    ]);
    expect((fd.get("task_files_0") as File).name).toBe("maket.pdf");
    expect(JSON.parse(String(fd.get("member_ids")))).toEqual([MALIKA.id]);
  });

  it("tugash vaqti boshlanishdan oldin bo'lsa yaratib bo'lmaydi", async () => {
    mockGet({ "/developers/": DEVS, [`/developers/?ids=${MALIKA.id}`]: DEVS, [`/developers/?ids=${JASUR.id}`]: DEVS });
    renderApp(<ProjectWizard />);

    fireEvent.change(await screen.findByLabelText(new RegExp(T.projects.code)), { target: { value: "PRJ-10" } });
    fireEvent.change(screen.getByLabelText(new RegExp(T.projects.name)), { target: { value: "Portal" } });
    const [start, end] = Array.from(document.querySelectorAll<HTMLInputElement>('input[type="date"]'));
    fireEvent.change(start!, { target: { value: "2026-10-01" } });
    fireEvent.change(end!, { target: { value: "2026-10-31" } });
    fireEvent.click(screen.getByRole("button", { name: new RegExp(T.common.next) }));
    fireEvent.click(await screen.findByRole("checkbox", { name: new RegExp(JASUR.full_name) }));
    fireEvent.click(screen.getByRole("button", { name: new RegExp(T.common.next) }));

    const section = await screen.findByRole("region", { name: JASUR.full_name });
    fireEvent.click(section.querySelector("button")!);
    fireEvent.change(screen.getByLabelText(T.projects.quickTaskPh), { target: { value: "API" } });
    fireEvent.change(screen.getByLabelText(T.tasks.startsAt), { target: { value: "2026-10-05T09:00" } });
    fireEvent.change(screen.getByLabelText(T.tasks.dueAt), { target: { value: "2026-10-02T09:00" } });

    expect(screen.getByText(T.projects.taskEndBeforeStart)).toBeTruthy();
    expect((screen.getByRole("button", { name: new RegExp(T.projects.create) }) as HTMLButtonElement).disabled).toBe(true);
  });
});

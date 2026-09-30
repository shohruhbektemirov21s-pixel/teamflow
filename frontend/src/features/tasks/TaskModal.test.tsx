import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { JASUR, taskDetail } from "@/test/fixtures";
import { mockGet, renderApp } from "@/test/render";
import { T } from "@/shared/text";

import TaskModal from "./TaskModal";

describe("TaskModal", () => {
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
});

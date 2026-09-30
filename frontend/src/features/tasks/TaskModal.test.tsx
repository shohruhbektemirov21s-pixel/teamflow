import { fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { api } from "@/shared/api";
import { JASUR, MALIKA, taskDetail } from "@/test/fixtures";
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
});

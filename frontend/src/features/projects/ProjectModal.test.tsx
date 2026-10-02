import { fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { api } from "@/shared/api";
import { T } from "@/shared/text";
import type { ProjectDetail } from "@/shared/types";
import { JASUR, MALIKA, PM } from "@/test/fixtures";
import { mockGet, renderApp } from "@/test/render";

import ProjectModal from "./ProjectModal";

const PROJECT: ProjectDetail = {
  id: 1, code: "PRJ-1", name: "Portal", description: "", stage: "started",
  start_date: "2026-09-01", end_date: "2026-11-01", order_id: null,
  members: [JASUR], progress: { total: 0, done: 0 }, created_at: "2026-09-01T10:00:00Z",
  created_by: { id: PM.id, full_name: PM.full_name, role: "pm", department_name: "" },
  files: [], order: null,
  actions: { edit: true, edit_info: true, members: true, files: true, add_task: true },
  stage_targets: ["planned", "needs_fix", "done"],
};

function setup() {
  mockGet({
    "/projects/1/": PROJECT,
    "/tasks/?project=1&all=1": [],
    "/developers/": [
      { id: JASUR.id, full_name: JASUR.full_name, specialty: "Backend" },
      { id: MALIKA.id, full_name: MALIKA.full_name, specialty: "Frontend" },
    ],
  });
  renderApp(<ProjectModal id={1} />);
}

describe("ProjectModal — Jamoa", () => {
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

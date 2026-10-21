import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { api } from "@/shared/api";
import { T } from "@/shared/text";
import { JASUR, PM, testUser } from "@/test/fixtures";
import { mockGet, renderApp } from "@/test/render";

import { ResponsibleProjects } from "./ResponsibleProjects";

const R = T.people.responsible;
const project = { id: 7, name: "Ichki portal", description: "Kadrlar uchun", created_at: "2026-10-10T08:00:00Z", updated_at: "2026-10-10T08:00:00Z", news_count: 0, last_news_at: null };

afterEach(() => { testUser.current = PM; });

describe("ResponsibleProjects", () => {
  it("dasturchi o'z mas'ul loyihasini o'zi qo'shadi", async () => {
    testUser.current = { ...PM, id: JASUR.id, role: "developer" };
    mockGet({ [`/people/${JASUR.id}/responsible-projects/`]: { can_manage: true, can_post: true, projects: [] } });
    vi.mocked(api.post).mockResolvedValue({ ...project, name: "Mening loyiham" });
    renderApp(<ResponsibleProjects employeeId={JASUR.id} own />);
    expect(await screen.findByText(R.emptyOwnManage)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: R.add }));
    const region = screen.getByRole("region", { name: R.title });
    fireEvent.change(within(region).getByRole("textbox", { name: new RegExp(R.name) }), { target: { value: "Mening loyiham" } });
    fireEvent.click(within(region).getByRole("button", { name: T.common.save }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith(`/people/${JASUR.id}/responsible-projects/`, expect.objectContaining({ name: "Mening loyiham" })));
  });

  it("ruxsat bo'lmasa (can_manage yo'q) qo'shish tugmasi chiqmaydi", async () => {
    testUser.current = { ...PM, id: JASUR.id, role: "pm" };
    mockGet({ [`/people/${JASUR.id}/responsible-projects/`]: { can_manage: false, can_post: true, projects: [project] } });
    renderApp(<ResponsibleProjects employeeId={JASUR.id} own />);
    expect(await screen.findByText("Ichki portal")).toBeTruthy();
    expect(screen.queryByRole("button", { name: R.add })).toBeNull();
  });
});

import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { api } from "@/shared/api";
import { T } from "@/shared/text";
import { JASUR, PM, taskDetail, testUser } from "@/test/fixtures";
import { mockGet, renderApp } from "@/test/render";

import TaskFormModal from "./TaskFormModal";

const DEV = { ...PM, id: JASUR.id, username: "jasur", full_name: JASUR.full_name, role: "developer" as const, role_label: "Dasturchi" };
const LOOKUP = "/projects/lookup/?page_size=100";
const projects = (...names: string[]) => ({ count: names.length, next: null, previous: null, results: names.map((name, i) => ({ id: i + 1, name, code: `P-${i + 1}` })) });

afterEach(() => { testUser.current = PM; });

function saveButton() {
  return screen.getByRole("button", { name: T.common.save }) as HTMLButtonElement;
}

describe("TaskFormModal", () => {
  it("dasturchi loyiha tanlamasdan vazifa qo'shadi", async () => {
    testUser.current = DEV;
    mockGet({ [LOOKUP]: projects("Portal") });
    vi.mocked(api.post).mockResolvedValue(taskDetail({ id: 9, project: null }));
    renderApp(<TaskFormModal />);
    const select = (await screen.findByRole("combobox", { name: new RegExp(T.tasks.project) })) as HTMLSelectElement;
    await screen.findByRole("option", { name: "Portal" });
    // Bitta loyiha bo'lsa ham dasturchiga avtomatik tanlanmaydi — "Loyihasiz" qoladi
    expect(select.value).toBe("");
    expect(screen.getByRole("option", { name: T.tasks.noProject })).toBeTruthy();
    expect(screen.getByText(T.tasks.noProjectHint)).toBeTruthy();
    fireEvent.change(screen.getByPlaceholderText(T.tasks.namePh), { target: { value: "Kitob o'qish" } });
    expect(saveButton().disabled).toBe(false);
    fireEvent.click(saveButton());
    await waitFor(() => expect(api.post).toHaveBeenCalled());
    const [path, body] = vi.mocked(api.post).mock.calls[0]!;
    expect(path).toBe("/tasks/");
    const form = body as FormData;
    expect(form.has("project")).toBe(false);
    expect(form.get("title")).toBe("Kitob o'qish");
    expect(form.get("assignee_ids")).toBe(JSON.stringify([JASUR.id]));
  });

  it("PM uchun loyiha majburiy bo'lib qoladi", async () => {
    mockGet({ [LOOKUP]: projects("Portal", "CRM") });
    renderApp(<TaskFormModal />);
    await screen.findByRole("option", { name: "CRM" });
    expect(screen.getByRole("option", { name: T.tasks.pickProject })).toBeTruthy();
    expect(screen.queryByRole("option", { name: T.tasks.noProject })).toBeNull();
    fireEvent.change(screen.getByPlaceholderText(T.tasks.namePh), { target: { value: "Login" } });
    expect(saveButton().disabled).toBe(true);
  });
});

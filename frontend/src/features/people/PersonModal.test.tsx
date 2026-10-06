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

afterEach(() => { testUser.current = PM; });

describe("PersonModal", () => {
  it.each(["boss", "pm"] as const)("%s mas'uliyatni kiritib saqlaydi va tahrirlaydi", async (role) => {
    testUser.current = { ...PM, role };
    mockGet({ [`/people/${JASUR.id}/`]: ROW, [`/tasks/?assignee=${JASUR.id}`]: [] });
    vi.mocked(api.patch).mockResolvedValue({ id: JASUR.id, responsibilities: "API va serverlar" });
    renderApp(<PersonModal id={JASUR.id} />);
    fireEvent.click(await screen.findByRole("button", { name: T.people.responsibilitiesAdd }));
    const region = screen.getByRole("region", { name: T.people.responsibilities });
    fireEvent.change(within(region).getByLabelText(T.people.responsibilities), { target: { value: "API va serverlar" } });
    fireEvent.click(within(region).getByRole("button", { name: T.common.save }));
    await waitFor(() => expect(api.patch).toHaveBeenCalledWith(`/people/${JASUR.id}/responsibilities/`, { responsibilities: "API va serverlar" }));
    expect(await within(region).findByText("API va serverlar")).toBeTruthy();
    fireEvent.click(within(region).getByRole("button", { name: T.people.responsibilitiesEdit }));
    expect((within(region).getByLabelText(T.people.responsibilities) as HTMLTextAreaElement).value).toBe("API va serverlar");
  });

  it("bekor qilish matnni saqlamaydi", async () => {
    mockGet({ [`/people/${JASUR.id}/`]: { ...ROW, responsibilities: "Eski mas'uliyat" }, [`/tasks/?assignee=${JASUR.id}`]: [] });
    renderApp(<PersonModal id={JASUR.id} />);
    fireEvent.click(await screen.findByRole("button", { name: T.people.responsibilitiesEdit }));
    fireEvent.change(screen.getByRole("textbox", { name: T.people.responsibilities }), { target: { value: "Yangi matn" } });
    fireEvent.click(screen.getByRole("button", { name: T.common.cancel }));
    expect(screen.getByText("Eski mas'uliyat")).toBeTruthy();
    expect(api.patch).not.toHaveBeenCalled();
  });

  it("saqlash xatosida matn qoladi va qayta saqlash mumkin", async () => {
    mockGet({ [`/people/${JASUR.id}/`]: ROW, [`/tasks/?assignee=${JASUR.id}`]: [] });
    vi.mocked(api.patch).mockRejectedValue(new ApiError(400, "Xato", { responsibilities: ["Matn juda uzun"] }));
    renderApp(<PersonModal id={JASUR.id} />);
    fireEvent.click(await screen.findByRole("button", { name: T.people.responsibilitiesAdd }));
    fireEvent.change(screen.getByRole("textbox", { name: T.people.responsibilities }), { target: { value: "API" } });
    fireEvent.click(screen.getByRole("button", { name: T.common.save }));
    expect(await screen.findByText("Matn juda uzun")).toBeTruthy();
    expect((screen.getByRole("textbox", { name: T.people.responsibilities }) as HTMLTextAreaElement).value).toBe("API");
    expect((screen.getByRole("button", { name: T.common.save }) as HTMLButtonElement).disabled).toBe(false);
  });
  it("profil loyiha va barcha vazifalarni ko'rsatadi", async () => {
    mockGet({
      [`/people/${JASUR.id}/`]: { ...ROW, projects: [{ id: 8, name: "Xodim portali", code: "PRJ-8", stage: "done", end_date: "2026-10-01" }] },
      [`/tasks/?assignee=${JASUR.id}`]: [taskDetail({ title: "Profil vazifasi" })],
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
    mockGet({ [`/people/${JASUR.id}/`]: ROW });
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
    });
    renderApp(<PersonModal id={JASUR.id} />);

    expect(await screen.findByText("Jasurning vazifasi")).toBeTruthy();
    expect(screen.getByText(T.people.freeNow)).toBeTruthy();
    expect(screen.queryByText(/undefined/)).toBeNull();
  });
});

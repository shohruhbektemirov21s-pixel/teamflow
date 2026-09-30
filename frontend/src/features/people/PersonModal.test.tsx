import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { JASUR, taskDetail } from "@/test/fixtures";
import { mockGet, renderApp } from "@/test/render";
import { T } from "@/shared/text";

import PersonModal from "./PersonModal";

const ROW = {
  ...JASUR, role_label: "Dasturchi", specialty: "Backend",
  active_tasks: 0, overdue_tasks: 0, review_tasks: 0, done_tasks: 1, doing: [],
};

describe("PersonModal", () => {
  it("faqat shu xodimning vazifalarini so'raydi (avval `??assignee` bilan hammasi kelardi)", async () => {
    // mockGet noma'lum yo'lda xato beradi — URL noto'g'ri bo'lsa vazifa chiqmaydi
    mockGet({
      [`/people/${JASUR.id}/`]: ROW,
      [`/tasks/?assignee=${JASUR.id}&all=1`]: [taskDetail({ title: "Jasurning vazifasi", status: "done" })],
    });
    renderApp(<PersonModal id={JASUR.id} />);

    expect(await screen.findByText("Jasurning vazifasi")).toBeTruthy();
    expect(screen.getByText(T.people.freeNow)).toBeTruthy();
    expect(screen.queryByText(/undefined/)).toBeNull();
  });
});

import { fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MALIKA, PM } from "@/test/fixtures";
import { mockGet, renderApp } from "@/test/render";
import { T } from "@/shared/text";
import { api } from "@/shared/api";

import MessagesPage from "./MessagesPage";

describe("MessagesPage", () => {
  it("polling eski xabarlarni saqlaydi va faqat yangi xabarlarni oladi", async () => {
    mockGet({
      "/chat/conversations/": [{ partner: MALIKA, last_message: "Old", unread_count: 0 }],
      [`/chat/messages/?partner=${MALIKA.id}`]: [
        { id: 10, text: "Old", created_at: "2026-09-30T08:00:00Z", author_id: MALIKA.id },
      ],
      [`/chat/messages/?partner=${MALIKA.id}&after=10`]: [
        { id: 11, text: "New", created_at: "2026-09-30T08:01:00Z", author_id: MALIKA.id },
      ],
      [`/chat/messages/?partner=${MALIKA.id}&after=11`]: [],
    });
    renderApp(<MessagesPage />);
    fireEvent.click(await screen.findByRole("button", { name: new RegExp(MALIKA.full_name) }));
    await screen.findByText("Old", { selector: ".bubble" });
    await screen.findByText("New", { selector: ".bubble" }, { timeout: 7000 });
    expect(screen.getByText("Old", { selector: ".bubble" })).toBeTruthy();
    await waitFor(() => expect(api.get).toHaveBeenCalledWith(`/chat/messages/?partner=${MALIKA.id}&after=11`), { timeout: 7000 });
    expect(screen.getAllByText("New", { selector: ".bubble" })).toHaveLength(1);
  }, 20000);
  it("qidiruvdan yangi odam tanlansa suhbat ochiladi, o'z xabarim 'mine' uslubida", async () => {
    mockGet({
      "/chat/conversations/": [],
      "/chat/people/?q=Mal": [MALIKA],
      [`/chat/messages/?partner=${MALIKA.id}`]: [
        { id: 1, text: "Salom!", created_at: "2026-09-30T08:00:00Z", author_id: MALIKA.id },
        { id: 2, text: "Assalomu alaykum", created_at: "2026-09-30T08:01:00Z", author_id: PM.id },
      ],
    });
    renderApp(<MessagesPage />);

    fireEvent.change(await screen.findByLabelText(T.chat.searchPh), { target: { value: "Mal" } });
    fireEvent.click(await screen.findByRole("button", { name: new RegExp(MALIKA.full_name) }));

    const mine = await screen.findByText("Assalomu alaykum");
    expect(mine.className).toContain("mine");
    expect(screen.getByText("Salom!").className).not.toContain("mine");
    expect(screen.getByLabelText(T.chat.messagePh)).toBeTruthy();
  });
});

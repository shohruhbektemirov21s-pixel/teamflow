import { fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

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
    await screen.findByText("Old", { selector: ".bubble-text" });
    await screen.findByText("New", { selector: ".bubble-text" }, { timeout: 7000 });
    expect(screen.getByText("Old", { selector: ".bubble-text" })).toBeTruthy();
    await waitFor(() => expect(api.get).toHaveBeenCalledWith(`/chat/messages/?partner=${MALIKA.id}&after=11`), { timeout: 7000 });
    expect(screen.getAllByText("New", { selector: ".bubble-text" })).toHaveLength(1);
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
    expect(mine.closest(".bubble")?.className).toContain("mine");
    expect(screen.getByText("Salom!").closest(".bubble")?.className).not.toContain("mine");
    expect(screen.getByLabelText(T.chat.messagePh)).toBeTruthy();
  });
  it("yuborish muvaffaqiyatsiz bo'lsa xato chiqadi va 'Qayta yuborish' xabarni qayta yuboradi", async () => {
    mockGet({
      "/chat/conversations/": [{ partner: MALIKA, last_message: "Old", last_at: "2026-09-30T08:00:00Z", outgoing: false, unread_count: 0 }],
      [`/chat/messages/?partner=${MALIKA.id}`]: [],
    });
    vi.mocked(api.post)
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce({ id: 5, text: "Salom", created_at: "2026-09-30T09:00:00Z", author_id: PM.id });
    renderApp(<MessagesPage />);
    fireEvent.click(await screen.findByRole("button", { name: new RegExp(MALIKA.full_name) }));

    fireEvent.change(await screen.findByLabelText(T.chat.messagePh), { target: { value: "Salom" } });
    fireEvent.keyDown(screen.getByLabelText(T.chat.messagePh), { key: "Enter" });

    await screen.findByText(T.chat.failed);
    fireEvent.click(screen.getByRole("button", { name: new RegExp(T.chat.retry) }));
    await waitFor(() => expect(screen.queryByText(T.chat.failed)).toBeNull());
    expect(api.post).toHaveBeenCalledTimes(2);
    expect(await screen.findByText("Salom", { selector: ".bubble-text" })).toBeTruthy();
  });
});

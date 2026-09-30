import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MALIKA, PM } from "@/test/fixtures";
import { mockGet, renderApp } from "@/test/render";
import { T } from "@/shared/text";

import MessagesPage from "./MessagesPage";

describe("MessagesPage", () => {
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

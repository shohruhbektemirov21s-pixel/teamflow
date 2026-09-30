import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { api } from "@/shared/api";
import { mockGet, renderApp } from "@/test/render";

import SuggestionsPage from "./SuggestionsPage";

describe("SuggestionsPage", () => {
  it("to'g'ri manzilga murojaat qiladi va sahifalangan javobni ko'rsatadi", async () => {
    mockGet({
      "/suggestions/?status=pending": {
        count: 1,
        next: null,
        previous: null,
        results: [
          {
            id: 5, title: "Qorong'i rejim", body: "Kechasi ko'z charchaydi", is_anonymous: true, author: null,
            status: "pending", votes_for: 2, votes_against: 0, my_vote: null, created_at: "2026-09-29T08:00:00Z",
          },
        ],
      },
    });
    renderApp(<SuggestionsPage />);

    expect(await screen.findByText("Qorong'i rejim")).toBeTruthy();
    expect(vi.mocked(api.get).mock.calls.map((c) => c[0])).not.toContainEqual(expect.stringContaining("/api/"));
  });
});

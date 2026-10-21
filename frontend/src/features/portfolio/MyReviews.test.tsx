import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { T } from "@/shared/text";
import { mockGet, renderApp } from "@/test/render";

import { MyReviews } from "./MyReviews";

describe("MyReviews", () => {
  it("qo'ygan baholarni ro'yxat qiladi", async () => {
    mockGet({
      "/portfolio/my-reviews/": {
        count: 1, next: null, previous: null,
        results: [{ id: 1, item_id: 7, item_title: "Shaxsiy sayt", developer: { id: 3, full_name: "Jasur Alimov" }, stars: 5, updated_at: "2026-10-10T10:00:00Z" }],
      },
    });
    renderApp(<MyReviews />);
    expect(await screen.findByText("Shaxsiy sayt")).toBeTruthy();
  });

  it("baho bo'lmasa keyingi qadamni tushuntiradi", async () => {
    mockGet({ "/portfolio/my-reviews/": { count: 0, next: null, previous: null, results: [] } });
    renderApp(<MyReviews />);
    expect(await screen.findByText(T.user.myReviewsEmpty)).toBeTruthy();
    expect(screen.getByText(T.user.myReviewsEmptyHint)).toBeTruthy();
  });
});

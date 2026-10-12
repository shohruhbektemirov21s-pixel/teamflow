import { fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { api } from "@/shared/api";
import { T } from "@/shared/text";
import { MALIKA } from "@/test/fixtures";
import { mockGet, renderApp } from "@/test/render";

import RatingsPage from "./RatingsPage";

const SUMMARY = { developers: 1, developers_growth: null, average_rating: null, rated_projects: 0, active_projects: 0, following: 0, specialties: [] };
const EMPTY = { count: 0, next: null, previous: null, results: [] };

describe("RatingsPage", () => {
  it("baholarni muallif, loyiha, yulduz va sharh bilan ko'rsatadi", async () => {
    mockGet({
      "/portfolio/summary/": { ...SUMMARY, average_rating: 4.5, rated_projects: 2 },
      "/portfolio/ratings/": {
        count: 1, next: null, previous: null,
        results: [{
          id: 1, item_id: 7, item_title: "Shaxsiy sayt", developer: { id: 3, full_name: "Jasur Alimov" }, author: MALIKA,
          stars: 5, text: "Ajoyib", created_at: "2026-10-10T10:00:00Z", updated_at: "2026-10-10T10:00:00Z",
        }],
      },
    });
    renderApp(<RatingsPage />);
    expect(await screen.findByText("Ajoyib")).toBeTruthy();
    expect(screen.getByText(MALIKA.full_name)).toBeTruthy();
    expect(screen.getByText(/Shaxsiy sayt/)).toBeTruthy();
    expect(screen.getByText("10.10.2026")).toBeTruthy();
  });

  it("baho bo'lmasa 'Hali baholanmagan' va keyingi qadam chiqadi; saralash serverga uzatiladi", async () => {
    mockGet({ "/portfolio/summary/": SUMMARY, "/portfolio/ratings/": EMPTY, "/portfolio/ratings/?sort=high": EMPTY });
    renderApp(<RatingsPage />);
    expect(await screen.findByText(T.ratings.empty)).toBeTruthy();
    expect(screen.getByText(T.portfolio.noRating)).toBeTruthy();
    fireEvent.change(screen.getByLabelText(T.ratings.sortLabel), { target: { value: "high" } });
    await waitFor(() => expect(api.get).toHaveBeenCalledWith("/portfolio/ratings/?sort=high"));
  });
});

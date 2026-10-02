import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { T } from "@/shared/text";
import { mockGet, renderApp } from "@/test/render";

import SearchPalette from "./SearchPalette";

describe("SearchPalette", () => {
  it("kod yozilsa aynan o'sha vazifa kodi bilan chiqadi", async () => {
    mockGet({
      "/search/?q=100000012": {
        tasks: [{ id: 12, code: "100000012", title: "Kirish sahifasi", status: "in_progress", project: "Portal" }],
        projects: [],
        orders: [],
        people: [],
      },
    });
    renderApp(<SearchPalette onClose={vi.fn()} />);

    fireEvent.change(await screen.findByRole("textbox", { name: T.search.title }), { target: { value: "100000012" } });

    expect(await screen.findByText("Kirish sahifasi")).toBeTruthy();
    expect(screen.getByText("100000012")).toBeTruthy();
  });
});

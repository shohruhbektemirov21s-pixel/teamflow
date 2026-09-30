import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { T } from "@/shared/text";
import { mockGet, renderApp } from "@/test/render";

import SearchPalette from "./SearchPalette";

describe("SearchPalette", () => {
  it("kod yozilsa aynan o'sha vazifa kodi bilan chiqadi", async () => {
    mockGet({
      "/search/?q=TSK-12": {
        tasks: [{ id: 12, code: "TSK-12", title: "Kirish sahifasi", status: "in_progress", project: "Portal" }],
        projects: [],
        orders: [],
        people: [],
      },
    });
    renderApp(<SearchPalette onClose={vi.fn()} />);

    fireEvent.change(await screen.findByRole("textbox", { name: T.search.title }), { target: { value: "TSK-12" } });

    expect(await screen.findByText("Kirish sahifasi")).toBeTruthy();
    expect(screen.getByText("TSK-12")).toBeTruthy();
  });
});

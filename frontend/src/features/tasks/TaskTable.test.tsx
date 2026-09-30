import { fireEvent, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";

import { mockGet, renderApp } from "@/test/render";
import { T } from "@/shared/text";

import { EMPTY_FILTERS, TaskFilters, type TaskFilterState } from "./TaskTable";

function Harness() {
  const [value, setValue] = useState<TaskFilterState>(EMPTY_FILTERS);
  return <TaskFilters value={value} onChange={setValue} showPerson />;
}

describe("TaskFilters", () => {
  it("'Loyiha' filtri yo'q; tozalash tugmasi faqat filtr berilganda chiqadi", async () => {
    mockGet({});
    renderApp(<Harness />);
    const search = await screen.findByLabelText(T.filters.search);

    expect(screen.queryByLabelText(T.filters.project)).toBeNull();
    expect(screen.queryByRole("button", { name: T.filters.clear })).toBeNull();

    fireEvent.change(search, { target: { value: "login" } });
    fireEvent.click(await screen.findByRole("button", { name: T.filters.clear }));
    expect((search as HTMLInputElement).value).toBe("");
    expect(screen.queryByRole("button", { name: T.filters.clear })).toBeNull();
  });

  it("'Filtrlar' tugmasi qo'shimcha filtrlarni ochib-yopadi (telefon)", async () => {
    mockGet({});
    renderApp(<Harness />);
    const toggle = await screen.findByRole("button", { name: new RegExp(T.filters.toggle) });
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
  });
});

import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";

import { Dropdown } from "./Dropdown";

const OPTIONS = [
  { value: "a", label: "Birinchi" },
  { value: "b", label: "Ikkinchi" },
  { value: "c", label: "Uchinchi" },
] as const;

function Harness({ onPick }: { onPick?: (value: string) => void }) {
  const [value, setValue] = useState<"a" | "b" | "c">("a");
  return (
    <div>
      <Dropdown
        value={value}
        options={[...OPTIONS]}
        ariaLabel="Saralash"
        prefix="Saralash:"
        onChange={(next) => {
          setValue(next);
          onPick?.(next);
        }}
      />
      <button type="button">Tashqarida</button>
    </div>
  );
}

describe("Dropdown", () => {
  it("tugmada tanlangan variantni ko'rsatadi va bosilganda ro'yxat ochiladi", () => {
    render(<Harness />);
    const trigger = screen.getByRole("button", { name: /Saralash/ });
    expect(trigger.textContent).toContain("Saralash: Birinchi");
    expect(screen.queryByRole("listbox")).toBeNull();
    fireEvent.click(trigger);
    expect(screen.getAllByRole("option")).toHaveLength(3);
    expect(screen.getByRole("option", { name: "Birinchi" }).getAttribute("aria-selected")).toBe("true");
  });

  it("variantni bosib tanlaydi va ro'yxat yopiladi", () => {
    const picked: string[] = [];
    render(<Harness onPick={(v) => picked.push(v)} />);
    fireEvent.click(screen.getByRole("button", { name: /Saralash/ }));
    fireEvent.click(screen.getByRole("option", { name: "Uchinchi" }));
    expect(picked).toEqual(["c"]);
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(screen.getByRole("button", { name: /Saralash/ }).textContent).toContain("Uchinchi");
  });

  it("klaviatura: ↓ bilan ochadi, ↓ ↓ Enter tanlaydi, Esc yopadi", () => {
    render(<Harness />);
    const trigger = screen.getByRole("button", { name: /Saralash/ });
    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    const list = screen.getByRole("listbox");
    fireEvent.keyDown(list, { key: "ArrowDown" });
    fireEvent.keyDown(list, { key: "ArrowDown" });
    fireEvent.keyDown(list, { key: "Enter" });
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(screen.getByRole("button", { name: /Saralash/ }).textContent).toContain("Uchinchi");

    fireEvent.click(screen.getByRole("button", { name: /Saralash/ }));
    fireEvent.keyDown(screen.getByRole("listbox"), { key: "Escape" });
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: /Saralash/ }));
  });

  it("tashqariga bosilganda yopiladi", () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: /Saralash/ }));
    fireEvent.pointerDown(screen.getByRole("button", { name: "Tashqarida" }));
    expect(screen.queryByRole("listbox")).toBeNull();
  });
});

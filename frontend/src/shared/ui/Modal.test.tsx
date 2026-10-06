import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { T } from "../text";
import { Modal } from "./Modal";
import { Tabs } from "./index";

describe("Modal keyboard navigation", () => {
  it("focuses an enabled visible field and skips hidden uploads and disabled controls", () => {
    render(<Modal title="Sinov" onClose={vi.fn()} footer={<button>Saqlash</button>}>
      <input type="file" hidden />
      <input aria-label="Disabled" disabled />
      <div style={{ display: "none" }}><button>Hidden</button></div>
      <input aria-label="Nomi" />
    </Modal>);
    expect(document.activeElement).toBe(screen.getByLabelText("Nomi"));
    screen.getByRole("button", { name: "Saqlash" }).focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(document.activeElement).toBe(screen.getByRole("button", { name: T.common.close }));
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Saqlash" }));
  });

  it("keeps focus in the dialog when its current control becomes disabled", () => {
    const { rerender } = render(<Modal title="Sinov" onClose={vi.fn()}><button>Saqlash</button></Modal>);
    screen.getByRole("button", { name: "Saqlash" }).focus();
    rerender(<Modal title="Sinov" onClose={vi.fn()}><button disabled>Saqlash</button></Modal>);
    fireEvent.keyDown(document, { key: "Tab" });
    expect(document.activeElement).toBe(screen.getByRole("button", { name: T.common.close }));
  });
});

describe("Tabs keyboard navigation", () => {
  it("supports arrow keys, Home and End and keeps one tab in the tab order", () => {
    function Harness() {
      const [value, setValue] = useState("main");
      return <Tabs value={value} onChange={setValue} tabs={[{ key: "main", label: "Umumiy" }, { key: "files", label: "Fayllar" }, { key: "history", label: "Tarix" }]} />;
    }
    render(<Harness />);
    const tabs = screen.getAllByRole("tab");
    tabs[0]!.focus();
    fireEvent.keyDown(tabs[0]!, { key: "ArrowRight" });
    expect(document.activeElement).toBe(tabs[1]);
    expect(tabs[1]!.getAttribute("aria-selected")).toBe("true");
    expect(tabs[0]!.tabIndex).toBe(-1);
    fireEvent.keyDown(tabs[1]!, { key: "End" });
    expect(document.activeElement).toBe(tabs[2]);
    fireEvent.keyDown(tabs[2]!, { key: "Home" });
    expect(document.activeElement).toBe(tabs[0]);
    fireEvent.keyDown(tabs[0]!, { key: "ArrowLeft" });
    expect(document.activeElement).toBe(tabs[2]);
  });
});

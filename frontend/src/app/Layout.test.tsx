import { fireEvent, screen } from "@testing-library/react";
import { Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { mockGet, renderApp } from "@/test/render";

import Layout from "./Layout";

function renderLayout() {
  mockGet({
    "/notifications/unread_count/": { count: 2 },
    "/dashboard/": { totals: { active: 3, review: 1 }, orders_pending: 4 },
  });

  return renderApp(
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<div>Sahifa mazmuni</div>} />
      </Route>
    </Routes>,
  );
}

beforeEach(() => {
  localStorage.clear();
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn().mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }),
  });
});

describe("Layout accessibility", () => {
  it("klaviatura foydalanuvchisini bevosita asosiy kontentga olib o'tadi", async () => {
    renderLayout();
    await screen.findByText("Sahifa mazmuni");

    const skipLink = screen.getByRole("link", { name: "Asosiy qismga o'tish" });
    const main = screen.getByRole("main");

    expect(skipLink.getAttribute("href")).toBe("#main-content");
    expect(main.id).toBe("main-content");
    expect(main.getAttribute("tabindex")).toBe("-1");
  });

  it("mobil menyu pardasini tushunarli nomlangan tugma bilan yopadi", async () => {
    renderLayout();
    await screen.findByText("Sahifa mazmuni");

    fireEvent.click(screen.getByRole("button", { name: "Menyuni ochish" }));

    const closeMenu = screen.getByRole("button", { name: "Menyuni yopish" });
    expect(closeMenu.classList.contains("open")).toBe(true);
    fireEvent.click(closeMenu);
    expect(closeMenu.classList.contains("open")).toBe(false);
  });

  it("mobil menyuni Escape bilan ham yopadi", async () => {
    renderLayout();
    await screen.findByText("Sahifa mazmuni");

    fireEvent.click(screen.getByRole("button", { name: "Menyuni ochish" }));
    fireEvent.keyDown(document, { key: "Escape" });

    const backdrop = document.querySelector<HTMLButtonElement>("button.sidebar-backdrop");
    expect(backdrop?.classList.contains("open")).toBe(false);
  });

  it("tema tugmasi joriy qorong'i rejim holatini bildiradi", async () => {
    renderLayout();
    await screen.findByText("Sahifa mazmuni");

    const themeButton = screen.getByRole("button", { name: "Tungi / kunduzgi rejim" });
    expect(themeButton.getAttribute("aria-pressed")).toBe("false");

    fireEvent.click(themeButton);
    expect(themeButton.getAttribute("aria-pressed")).toBe("true");
  });
});

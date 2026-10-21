import { screen } from "@testing-library/react";
import { expect, it } from "vitest";

import { T } from "@/shared/text";
import { mockGet, renderApp } from "@/test/render";

import { LoginPage } from "./AuthPages";

it("kirish formasini sahifaning asosiy semantik qismida ko'rsatadi", async () => {
  mockGet({});
  renderApp(<LoginPage />, "/kirish");

  await screen.findByRole("heading", { name: T.auth.loginTitle });
  expect(screen.getByRole("main").className).toContain("auth-main");
});

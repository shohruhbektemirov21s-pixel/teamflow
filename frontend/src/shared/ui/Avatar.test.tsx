import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { JASUR } from "@/test/fixtures";
import { mockGet, renderApp } from "@/test/render";

import { Avatar } from "./index";

describe("Avatar", () => {
  it("rasm bo'lsa rasm, bo'lmasa bosh harflar", async () => {
    mockGet({});
    const { container } = renderApp(
      <>
        <Avatar user={{ ...JASUR, avatar: "/api/avatars/3/?v=abc" }} />
        <Avatar user={{ id: 4, full_name: "Malika Karimova" }} />
      </>,
    );
    expect(await screen.findByText("MK")).toBeTruthy();
    expect(container.querySelector('img[src="/api/avatars/3/?v=abc"]')).toBeTruthy();
  });

  it("sichqoncha ustiga kelsa profil kartochkasi chiqadi: ism familiya, rol", async () => {
    mockGet({});
    renderApp(<Avatar user={JASUR} size="sm" />);

    fireEvent.mouseEnter(await screen.findByText("JA"));
    const card = await screen.findByRole("tooltip");
    expect(card.textContent).toContain(JASUR.full_name);
    expect(card.textContent).toContain("Dasturchi");

    fireEvent.mouseLeave(screen.getAllByText("JA")[0]!);
    expect(screen.queryByRole("tooltip")).toBeNull();
  });
});

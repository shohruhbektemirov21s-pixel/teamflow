import { fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ModalHost } from "@/app/modals";
import { T } from "@/shared/text";
import { mockGet, renderApp } from "@/test/render";

import PhotoModal from "./PhotoModal";
import { ProfileHeader } from "./ProfileHeader";

const USER = { id: 3, full_name: "Jasur Alimov", avatar: "/api/avatars/3/?v=abc" };

describe("Profil rasmi oynasi", () => {
  it("profil rasmi bosilsa katta ko'rinishda ochiladi, Esc yopadi", async () => {
    mockGet({});
    renderApp(
      <>
        <ProfileHeader user={USER} subtitle="Backend" />
        <ModalHost />
      </>,
    );

    fireEvent.click(await screen.findByRole("button", { name: T.people.photoOpen }));
    const dialog = await screen.findByRole("dialog", { name: T.people.photoOf(USER.full_name) });
    expect(dialog.querySelector(`img[src="${USER.avatar}"]`)).toBeTruthy();

    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("rasm bo'lmasa avatar bosiladigan tugma emas", async () => {
    mockGet({});
    renderApp(<ProfileHeader user={{ id: 4, full_name: "Malika Karimova" }} subtitle="Frontend" />);

    expect(await screen.findByText("Malika Karimova")).toBeTruthy();
    expect(screen.queryByRole("button", { name: T.people.photoOpen })).toBeNull();
  });

  it("begona manzildagi rasm ko'rsatilmaydi", async () => {
    mockGet({});
    renderApp(<PhotoModal src="https://example.com/x.jpg" name="Jasur Alimov" />);

    const dialog = await screen.findByRole("dialog");
    expect(dialog.querySelector("img")).toBeNull();
  });
});

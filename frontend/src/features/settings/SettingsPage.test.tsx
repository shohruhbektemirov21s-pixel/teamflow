import { fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { api, ApiError } from "@/shared/api";
import { T } from "@/shared/text";
import { PM } from "@/test/fixtures";
import { mockGet, renderApp } from "@/test/render";

import SettingsPage from "./SettingsPage";

const PROFILE = {
  ...PM, date_joined: "2026-09-01T10:00:00Z", bio: "Eski", email: "", last_login: "2026-10-10T08:00:00Z",
  telegram_connected: false, telegram_username: "", stats: null,
};

describe("SettingsPage", () => {
  it("profil: ism, email va bio saqlanadi; bo'sh ism bilan saqlab bo'lmaydi", async () => {
    mockGet({ "/auth/profile/": PROFILE });
    vi.mocked(api.patch).mockResolvedValue(PROFILE);
    renderApp(<SettingsPage />);

    const first = (await screen.findByLabelText(new RegExp(T.profile.firstName))) as HTMLInputElement;
    fireEvent.change(first, { target: { value: "" } });
    expect((screen.getByRole("button", { name: T.common.save }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(first, { target: { value: "Yangi" } });
    fireEvent.change(screen.getByLabelText(T.settings.email), { target: { value: "a@b.uz" } });
    fireEvent.click(screen.getByRole("button", { name: T.common.save }));

    await waitFor(() =>
      expect(api.patch).toHaveBeenCalledWith("/auth/profile/", expect.objectContaining({ first_name: "Yangi", email: "a@b.uz", bio: "Eski" })),
    );
  });

  it("server xatosi maydon ostida ko'rinadi", async () => {
    mockGet({ "/auth/profile/": PROFILE });
    vi.mocked(api.patch).mockRejectedValue(new ApiError(400, "Xato", { email: ["Email manzilni to'g'ri kiriting."] }));
    renderApp(<SettingsPage />);

    await screen.findByLabelText(new RegExp(T.profile.firstName));
    fireEvent.click(screen.getByRole("button", { name: T.common.save }));
    expect(await screen.findByText("Email manzilni to'g'ri kiriting.")).toBeTruthy();
  });

  it("xavfsizlik: parol takrorlanmasa yuborilmaydi, to'g'ri bo'lsa serverga ketadi", async () => {
    mockGet({ "/auth/profile/": PROFILE });
    vi.mocked(api.post).mockResolvedValue({});
    renderApp(<SettingsPage />);

    fireEvent.click(await screen.findByRole("button", { name: T.settings.sections.security }));
    fireEvent.change(await screen.findByLabelText(T.profile.currentPassword), { target: { value: "Eski-parol-1" } });
    fireEvent.change(screen.getByLabelText(T.profile.newPassword), { target: { value: "Yangi-parol-2026" } });
    fireEvent.change(screen.getByLabelText(T.settings.passwordRepeat), { target: { value: "Boshqa" } });
    expect(screen.getByText(T.settings.passwordMismatch)).toBeTruthy();
    expect((screen.getByRole("button", { name: T.profile.changePassword }) as HTMLButtonElement).disabled).toBe(true);

    fireEvent.change(screen.getByLabelText(T.settings.passwordRepeat), { target: { value: "Yangi-parol-2026" } });
    fireEvent.click(screen.getByRole("button", { name: T.profile.changePassword }));
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith("/auth/password/", { current_password: "Eski-parol-1", new_password: "Yangi-parol-2026" }),
    );
  });

  it("bildirishnomalar: Telegram holati va saqlash; ko'rinish: rejim tanlanadi va saqlanadi", async () => {
    mockGet({ "/auth/profile/": PROFILE });
    vi.mocked(api.patch).mockResolvedValue(PROFILE);
    renderApp(<SettingsPage />);

    fireEvent.click(await screen.findByRole("button", { name: T.settings.sections.notifications }));
    expect(await screen.findByText(T.settings.telegramNotConnected)).toBeTruthy();
    fireEvent.change(screen.getByLabelText(T.profile.telegram), { target: { value: "@ali" } });
    fireEvent.click(screen.getByRole("button", { name: T.common.save }));
    await waitFor(() => expect(api.patch).toHaveBeenCalledWith("/auth/profile/", { telegram_username: "@ali" }));

    fireEvent.click(screen.getByRole("button", { name: T.settings.sections.appearance }));
    fireEvent.click(screen.getByRole("radio", { name: T.settings.themeDark }));
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(localStorage.getItem("theme")).toBe("dark");
    fireEvent.click(screen.getByRole("radio", { name: T.settings.themeLight }));
    expect(document.documentElement.dataset.theme).toBe("light");
  });
});

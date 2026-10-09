import { fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { api } from "@/shared/api";
import { T } from "@/shared/text";
import { mockGet, renderApp } from "@/test/render";

import { RegisterPage } from "./AuthPages";

describe("Ro'yxatdan o'tish", () => {
  it("mutaxassislik so'ralmaydi va yuborilmaydi", async () => {
    mockGet({});
    vi.mocked(api.post).mockResolvedValue({});
    renderApp(<RegisterPage />, "/royxat");

    await screen.findByLabelText(new RegExp(T.auth.firstName));
    expect(screen.queryByText("Mutaxassislik")).toBeNull();
    expect(screen.queryByRole("combobox")).toBeNull();

    const fill = (label: string, value: string) =>
      fireEvent.change(screen.getByLabelText(new RegExp(`^${label}`)), { target: { value } });
    fill(T.auth.firstName, "Ali");
    fill(T.auth.lastName, "Valiyev");
    fill(T.auth.username, "ali");
    fill(T.auth.password, "Kuchli-parol-2026");
    fireEvent.click(screen.getByRole("button", { name: T.auth.register }));

    await waitFor(() => expect(api.post).toHaveBeenCalled());
    const [path, body] = vi.mocked(api.post).mock.calls[0]!;
    expect(path).toBe("/auth/register/");
    expect(body).not.toHaveProperty("specialty");
    expect(body).toMatchObject({ first_name: "Ali", last_name: "Valiyev", username: "ali", role: "developer" });
  });
});

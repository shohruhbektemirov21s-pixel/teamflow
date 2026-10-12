import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { api } from "@/shared/api";
import { T } from "@/shared/text";
import { mockGet, renderApp } from "@/test/render";

import NewDeveloperModal from "./NewDeveloperModal";

const N = T.people.newDeveloper;

beforeEach(() => {
  mockGet({ "/specialties/": [{ id: 5, name: "Backend" }] });
  vi.mocked(api.post).mockReset();
});

describe("NewDeveloperModal", () => {
  it("majburiy maydonlar to'lmaguncha tugma o'chiq, to'lgach ma'lumot hisob sifatida yuboriladi", async () => {
    vi.mocked(api.post).mockResolvedValue({ detail: "ok" } as never);
    renderApp(<NewDeveloperModal />);
    const submit = await screen.findByRole("button", { name: N.submit });
    expect((submit as HTMLButtonElement).disabled).toBe(true);

    fireEvent.change(screen.getByLabelText(new RegExp(`^${N.firstName}`)), { target: { value: "Ali" } });
    fireEvent.change(screen.getByLabelText(new RegExp(`^${N.lastName}`)), { target: { value: "Valiyev" } });
    await screen.findByRole("option", { name: "Backend" });
    fireEvent.change(screen.getByLabelText(new RegExp(`^${N.specialty}`)), { target: { value: "5" } });
    fireEvent.change(screen.getByLabelText(T.techField.label), { target: { value: "Python, Django" } });
    fireEvent.change(screen.getByLabelText(new RegExp(`^${N.username}`)), { target: { value: "ali_dev" } });
    fireEvent.change(screen.getByLabelText(new RegExp(`^${N.password}`)), { target: { value: "Yaxshi-Parol-2026" } });
    expect((submit as HTMLButtonElement).disabled).toBe(false);

    fireEvent.click(submit);
    await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1));
    const [path, body] = vi.mocked(api.post).mock.calls[0] as [string, FormData];
    expect(path).toBe("/people/new-developer/");
    expect(body.get("username")).toBe("ali_dev");
    expect(body.get("specialty")).toBe("5");
    expect(body.get("technologies")).toBe(JSON.stringify(["Python", "Django"]));
  });

  it("noto'g'ri rasm turi yuborilmaydi", async () => {
    renderApp(<NewDeveloperModal />);
    await screen.findByRole("button", { name: N.submit });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File(["x"], "a.gif", { type: "image/gif" })] } });
    expect(await screen.findByText(N.photoType)).toBeTruthy();
  });
});

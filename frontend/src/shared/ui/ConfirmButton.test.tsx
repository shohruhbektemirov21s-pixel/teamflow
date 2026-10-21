import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { T } from "../text";
import { ConfirmButton } from "./index";

afterEach(() => vi.useRealTimers());

describe("ConfirmButton", () => {
  it("o'chirish alohida oynada ochiladi va faqat orqaga sanash tugagach faollashadi", () => {
    vi.useFakeTimers();
    const onConfirm = vi.fn();
    render(<ConfirmButton delay={3} onConfirm={onConfirm}>{T.common.delete}</ConfirmButton>);

    fireEvent.click(screen.getByRole("button", { name: T.common.delete }));
    expect(screen.getByRole("dialog", { name: new RegExp(T.common.confirmDeleteTitle) })).toBeTruthy();
    const confirm = screen.getByRole("button", { name: T.common.deleteWait(3) }) as HTMLButtonElement;
    expect(confirm.disabled).toBe(true);
    fireEvent.click(confirm);
    expect(onConfirm).not.toHaveBeenCalled();

    act(() => { vi.advanceTimersByTime(1000); });
    expect(screen.getByRole("button", { name: T.common.deleteWait(2) })).toBeTruthy();
    act(() => { vi.advanceTimersByTime(1000); });
    act(() => { vi.advanceTimersByTime(1000); });
    const ready = screen.getByRole("button", { name: T.common.yes }) as HTMLButtonElement;
    expect(ready.disabled).toBe(false);

    fireEvent.click(ready);
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("bekor qilish oynani yopadi va hech narsa o'chirmaydi", () => {
    const onConfirm = vi.fn();
    render(<ConfirmButton delay={0} onConfirm={onConfirm}>{T.common.delete}</ConfirmButton>);
    fireEvent.click(screen.getByRole("button", { name: T.common.delete }));
    fireEvent.click(screen.getByRole("button", { name: T.common.cancel }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(onConfirm).not.toHaveBeenCalled();
  });
});

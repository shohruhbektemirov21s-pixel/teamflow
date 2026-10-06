import { act, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LiveProvider, useFallbackInterval } from "./live";

/** Soxta WebSocket: testdan ochish, xabar yuborish va uzish boshqariladi. */
class FakeSocket {
  static last: FakeSocket | null = null;
  onopen: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  onclose: ((e: { code: number }) => void) | null = null;
  constructor(public url: string) {
    FakeSocket.last = this;
  }
  close() {}
}

function setup() {
  const client = new QueryClient();
  client.setQueryData(["notifications", "unread"], { count: 1 });
  client.setQueryData(["dashboard"], { totals: {} });
  client.setQueryData(["chat", "messages", 5], []);
  client.setQueryData(["chat", "messages", 6], []);
  client.setQueryData(["tasks"], []);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <LiveProvider>{children}</LiveProvider>
    </QueryClientProvider>
  );
  const hook = renderHook(() => useFallbackInterval(30_000), { wrapper });
  const invalidated = (key: unknown[]) => client.getQueryState(key)?.isInvalidated;
  return { hook, invalidated };
}

describe("LiveProvider", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("WebSocket", FakeSocket);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("ulanganda polling o'chadi, uzilganda zaxira oraliq qaytadi", () => {
    const { hook } = setup();
    expect(hook.result.current).toBe(30_000);
    act(() => FakeSocket.last?.onopen?.());
    expect(hook.result.current).toBe(false);
    act(() => FakeSocket.last?.onclose?.({ code: 1006 }));
    expect(hook.result.current).toBe(30_000);
  });

  it("hodisa faqat tegishli keshni yangilaydi va bir soniyada jamlanadi", () => {
    const { invalidated } = setup();
    act(() => FakeSocket.last?.onopen?.());
    act(() => {
      FakeSocket.last?.onmessage?.({ data: JSON.stringify({ type: "chat", partner: 5 }) });
      FakeSocket.last?.onmessage?.({ data: JSON.stringify({ type: "notification" }) });
    });
    expect(invalidated(["notifications", "unread"])).toBe(false); // hali jamlanmoqda
    act(() => vi.advanceTimersByTime(1000));
    expect(invalidated(["notifications", "unread"])).toBe(true);
    expect(invalidated(["dashboard"])).toBe(true);
    expect(invalidated(["chat", "messages", 5])).toBe(true);
    expect(invalidated(["chat", "messages", 6])).toBe(false);
    expect(invalidated(["tasks"])).toBe(false);
  });

  it("sessiya tugaganda (4401) qayta ulanmaydi", () => {
    setup();
    const first = FakeSocket.last;
    act(() => first?.onclose?.({ code: 4401 }));
    act(() => vi.advanceTimersByTime(60_000));
    expect(FakeSocket.last).toBe(first);
  });

  it("uzilsa qayta ulanadi va o'tkazib yuborilganlarni yangilaydi", () => {
    const { invalidated } = setup();
    const first = FakeSocket.last;
    act(() => first?.onopen?.());
    act(() => first?.onclose?.({ code: 1006 }));
    act(() => vi.advanceTimersByTime(30_000));
    expect(FakeSocket.last).not.toBe(first);
    act(() => FakeSocket.last?.onopen?.());
    act(() => vi.advanceTimersByTime(1000));
    expect(invalidated(["dashboard"])).toBe(true);
  });
});

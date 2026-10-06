import { useQueryClient } from "@tanstack/react-query";
import { createContext, type ReactNode, useContext, useEffect, useState } from "react";

/** Server hodisasi (`backend/apps/core/realtime.py`): ma'lumot emas, faqat "nima o'zgardi" belgisi. */
type LiveEvent = { type: "notification" } | { type: "chat"; partner: number };

const LiveContext = createContext(false);

/** WebSocket ulanganmi. Ulangan bo'lsa polling o'chadi — yangilanish hodisa bilan keladi. */
export function useLive() {
  return useContext(LiveContext);
}

/** Polling oralig'i: WebSocket ishlasa — yo'q, uzilgan bo'lsa — zaxira oraliq. */
export function useFallbackInterval(ms: number): number | false {
  return useLive() ? false : ms;
}

const MAX_DELAY = 30_000;
const UNAUTHORIZED = 4401;

/** Kirgan foydalanuvchi uchun `/ws/events/` ulanishi. Uzilsa tasodifiy kechikish bilan qayta ulanadi
 * (server qayta ishga tushganda minglab tab bir vaqtda urilmasin), qayta ulangach o'tkazib yuborilgan
 * o'zgarishlar uchun tegishli keshlar yangilanadi. */
export function LiveProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (typeof WebSocket === "undefined") return;
    let socket: WebSocket | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let attempt = 0;
    let stopped = false;
    // Ketma-ket hodisalar (masalan, menejerga bir soniyada 10 ta bildirishnoma) bitta yangilanishga jamlanadi
    const pending = new Map<string, readonly unknown[]>();
    let flushTimer: ReturnType<typeof setTimeout> | undefined;

    const invalidate = (...keys: (readonly unknown[])[]) => {
      for (const key of keys) pending.set(JSON.stringify(key), key);
      flushTimer ??= setTimeout(() => {
        flushTimer = undefined;
        for (const key of pending.values()) qc.invalidateQueries({ queryKey: key });
        pending.clear();
      }, 1000);
    };

    const onEvent = (event: LiveEvent) => {
      if (event.type === "notification") invalidate(["notifications"], ["dashboard"]);
      else if (event.type === "chat") invalidate(["chat", "conversations"], ["chat", "messages", event.partner]);
    };

    const connect = () => {
      const scheme = window.location.protocol === "https:" ? "wss" : "ws";
      socket = new WebSocket(`${scheme}://${window.location.host}/ws/events/`);
      socket.onopen = () => {
        if (attempt > 0) invalidate(["notifications"], ["dashboard"], ["chat"]); // uzilish paytida o'tkazib yuborilganlar
        attempt = 0;
        setConnected(true);
      };
      socket.onmessage = (msg) => {
        try {
          onEvent(JSON.parse(String(msg.data)) as LiveEvent);
        } catch {
          // noma'lum xabar — e'tiborsiz
        }
      };
      socket.onclose = (e) => {
        setConnected(false);
        if (stopped || e.code === UNAUTHORIZED) return; // sessiya tugagan — REST 401 login'ga olib boradi
        attempt += 1;
        const delay = Math.random() * Math.min(MAX_DELAY, 1000 * 2 ** attempt);
        timer = setTimeout(connect, delay);
      };
    };

    connect();
    return () => {
      stopped = true;
      clearTimeout(timer);
      clearTimeout(flushTimer);
      socket?.close();
    };
  }, [qc]);

  return <LiveContext.Provider value={connected}>{children}</LiveContext.Provider>;
}

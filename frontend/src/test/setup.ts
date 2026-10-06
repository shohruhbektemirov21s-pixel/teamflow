/** Vitest umumiy sozlamasi: API va joriy foydalanuvchi soxtalashtiriladi, har testdan keyin DOM tozalanadi. */
import { cleanup, configure } from "@testing-library/react";
import { afterEach, vi } from "vitest";

// To'liq svit parallel ishlaganda ikki bosqichli async testlar (sahifalash) standart 1000ms'ga sig'may qolardi.
configure({ asyncUtilTimeout: 5000 });

vi.mock("@/shared/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/shared/api")>();
  return { ...actual, api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), del: vi.fn() } };
});

vi.mock("@/app/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/app/auth")>();
  const { testUser } = await import("./fixtures");
  return {
    ...actual,
    useMe: () => testUser.current,
    useAuth: () => ({ user: testUser.current, ready: true, login: vi.fn(), logout: vi.fn(), refresh: vi.fn() }),
  };
});

if (typeof Element !== "undefined") {
  Element.prototype.scrollIntoView = () => {}; // jsdom'da yo'q
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

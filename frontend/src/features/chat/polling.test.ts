import { describe, expect, it } from "vitest";

import { CHAT_POLL_FAST_MS, CHAT_POLL_MAX_MS, nextChatPollDelay } from "./polling";

describe("nextChatPollDelay", () => {
  it("polls quickly after an update and backs off while chat is idle", () => {
    expect(nextChatPollDelay(CHAT_POLL_FAST_MS, true)).toBe(CHAT_POLL_FAST_MS);
    expect(nextChatPollDelay(CHAT_POLL_FAST_MS, false)).toBe(10_000);
    expect(nextChatPollDelay(10_000, false)).toBe(20_000);
    expect(nextChatPollDelay(20_000, false)).toBe(40_000);
    expect(nextChatPollDelay(40_000, false)).toBe(CHAT_POLL_MAX_MS);
    expect(nextChatPollDelay(CHAT_POLL_MAX_MS, false)).toBe(CHAT_POLL_MAX_MS);
  });
});

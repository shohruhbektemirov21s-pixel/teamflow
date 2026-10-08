export const CHAT_POLL_FAST_MS = 5_000;
export const CHAT_POLL_MAX_MS = 60_000;

export function nextChatPollDelay(currentMs: number, hasUpdates: boolean): number {
  if (hasUpdates) return CHAT_POLL_FAST_MS;
  return Math.min(Math.max(currentMs, CHAT_POLL_FAST_MS) * 2, CHAT_POLL_MAX_MS);
}

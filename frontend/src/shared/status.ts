/** Holat → rang (tone). Ranglar bitta joyda; matnlar `text.ts` da. */
import type { OrderStatus, Priority, ProjectStage, TaskStatus } from "./types";

export type Tone = "slate" | "info" | "warning" | "violet" | "success" | "danger" | "primary";

export const TASK_TONE: Record<TaskStatus, Tone> = {
  control: "info",
  in_progress: "warning",
  in_review: "violet",
  done: "success",
};

export const ORDER_TONE: Record<OrderStatus, Tone> = {
  submitted: "info",
  approved: "success",
  rejected: "danger",
  project_created: "primary",
};

export const STAGE_TONE: Record<ProjectStage, Tone> = {
  planned: "slate",
  started: "info",
  needs_fix: "warning",
  done: "success",
};

export const PRIORITY_TONE: Record<Priority, Tone> = {
  low: "slate",
  medium: "info",
  high: "warning",
  urgent: "danger",
};

/** Bildirishnoma turi (backend `Notification.Kind`) → rang. Noma'lum tur — slate. */
export const NOTICE_TONE: Record<string, Tone> = {
  order_submitted: "info",
  order_resubmitted: "info",
  order_approved: "success",
  order_rejected: "danger",
  task_assigned: "primary",
  task_submitted: "violet",
  task_accepted: "success",
  task_returned: "warning",
  comment: "slate",
};

/**
 * Doskada sudrab o'tkazish. Ruxsat etilgan o'tishlar SERVERDAN keladi (`/api/meta/` → `task_moves`,
 * manba: backend `tasks/workflow.py`). Doskada faqat ikki amal bor:
 * boshlash (→ Jarayonda) va tekshiruvga yuborish (→ Tekshiruvda, izoh bilan).
 * Tekshiruv qarori (qabul/qaytarish) doskada emas — vazifa modalida.
 */
export type BoardMove = "start" | "submit" | null;

export function boardMove(moves: { from: string; to: string }[], from: TaskStatus, to: TaskStatus): BoardMove {
  if (!moves.some((m) => m.from === from && m.to === to)) return null;
  if (from === "control" && to === "in_progress") return "start";
  if (to === "in_review") return "submit";
  return null;
}

const AVATAR_COLORS = ["#4f46e5", "#0891b2", "#7c3aed", "#db2777", "#ea580c", "#059669", "#2563eb", "#9333ea"];

export function avatarColor(id: number): string {
  return AVATAR_COLORS[id % AVATAR_COLORS.length]!;
}

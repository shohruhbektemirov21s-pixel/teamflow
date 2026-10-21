import { fmtDate } from "@/shared/format";
import { T } from "@/shared/text";
import type { DeveloperStatus } from "@/shared/types";
import { Badge } from "@/shared/ui";
import type { Tone } from "@/shared/status";

const TONE: Record<DeveloperStatus["state"], Tone> = { free: "success", busy: "warning", trip: "info" };

/** Holat matni — rang yolg'iz belgi bo'lib qolmasin (matn bilan birga). */
export function statusText(status: DeveloperStatus): string {
  if (status.state === "trip" && status.trip_return_date) return T.portfolio.status.trip(fmtDate(status.trip_return_date));
  if (status.state === "busy") return T.portfolio.status.busy(status.active_tasks);
  return T.portfolio.status.free;
}

export function StatusBadge({ status }: { status: DeveloperStatus }) {
  return <Badge tone={TONE[status.state]}>{statusText(status)}</Badge>;
}

/** Avatar burchagidagi nuqta (haqiqiy holat rangida). */
export function StatusDot({ status }: { status: DeveloperStatus }) {
  return <span className={`uonline-dot is-${status.state}`} role="img" aria-label={statusText(status)} title={statusText(status)} />;
}

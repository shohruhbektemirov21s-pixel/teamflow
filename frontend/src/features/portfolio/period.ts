import { fmtDate } from "@/shared/format";
import { T } from "@/shared/text";

/** "01.02.2024 — 05.06.2024" / "01.02.2024 — hozir"; sana bo'lmasa bo'sh (bo'sh maydon yashiriladi). */
export function periodText(start: string | null, end: string | null) {
  if (!start && !end) return "";
  return T.portfolio.period(start ? fmtDate(start) : "…", end ? fmtDate(end) : T.portfolio.now);
}

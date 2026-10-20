import { ChevronLeft, ChevronRight } from "lucide-react";

import { T } from "@/shared/text";
import { Button } from "./index";

type PageData = { next: string | boolean | null; previous: string | boolean | null; count?: number };

export const PAGE_SIZES = [10, 25, 50] as const;

/** Ko'rsatiladigan sahifa raqamlari: birinchi, oxirgi va joriy atrofi; oraliq — "…" (null). */
export function pageWindow(page: number, pages: number): (number | null)[] {
  const wanted = new Set([1, pages, page - 1, page, page + 1].filter((p) => p >= 1 && p <= pages));
  const sorted = [...wanted].sort((a, b) => a - b);
  const out: (number | null)[] = [];
  sorted.forEach((p, i) => {
    if (i && p - sorted[i - 1]! > 1) out.push(null);
    out.push(p);
  });
  return out;
}

/**
 * DRF ro'yxatlarining sahifalash boshqaruvi.
 * Oddiy ko'rinish (oldingi/keyingi): faqat `data`, `page`, `onPageChange`.
 * To'liq ko'rinish (`pageSize` va `onPageSizeChange` berilsa): chapda "N ta …", o'ngda "Har sahifada", raqamli sahifalar.
 */
export function Pagination({ data, page, onPageChange, pageSize, onPageSizeChange, unit }: {
  data: PageData | undefined;
  page: number;
  onPageChange: (page: number) => void;
  pageSize?: number;
  onPageSizeChange?: (size: number) => void;
  /** Son uchun matn, masalan `T.orders.found` ("7 ta buyurtma"). */
  unit?: (n: number) => string;
}) {
  if (!data) return null;
  const full = pageSize !== undefined && onPageSizeChange !== undefined && data.count !== undefined;
  if (!full) {
    if (!data.next && !data.previous) return null;
    return (
      <nav className="row-wrap pagination" aria-label={T.common.pages}>
        <Button size="sm" disabled={!data.previous} onClick={() => onPageChange(page - 1)}>{T.workDone.prev}</Button>
        <span className="small muted">{T.workDone.page(page)}</span>
        <Button size="sm" disabled={!data.next} onClick={() => onPageChange(page + 1)}>{T.workDone.next}</Button>
      </nav>
    );
  }
  const total = data.count!;
  const pages = Math.max(1, Math.ceil(total / pageSize!));
  return (
    <nav className="pager" aria-label={T.common.pages}>
      <span className="small muted pager-count">{unit ? unit(total) : total}</span>
      <div className="pager-controls">
        <label className="pager-size small muted">
          {T.list.perPage}
          <select className="select" value={pageSize} onChange={(e) => onPageSizeChange!(Number(e.target.value))}>
            {PAGE_SIZES.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
        <div className="pager-pages">
          <button type="button" className="pager-btn" disabled={!data.previous} onClick={() => onPageChange(page - 1)} aria-label={T.workDone.prev}>
            <ChevronLeft size={16} />
          </button>
          {pageWindow(page, pages).map((p, i) =>
            p === null ? (
              <span key={`gap${i}`} className="pager-gap" aria-hidden>…</span>
            ) : (
              <button key={p} type="button" className="pager-btn" aria-current={p === page ? "page" : undefined} aria-label={T.workDone.page(p)} onClick={() => onPageChange(p)}>
                {p}
              </button>
            ),
          )}
          <button type="button" className="pager-btn" disabled={!data.next} onClick={() => onPageChange(page + 1)} aria-label={T.workDone.next}>
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </nav>
  );
}

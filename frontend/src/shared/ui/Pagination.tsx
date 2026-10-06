import { T } from "@/shared/text";
import { Button } from "./index";

/** DRF ro'yxatlarining oldingi/keyingi sahifalari uchun umumiy boshqaruv. */
export function Pagination({ data, page, onPageChange }: {
  data: { next: string | boolean | null; previous: string | boolean | null } | undefined;
  page: number;
  onPageChange: (page: number) => void;
}) {
  if (!data || (!data.next && !data.previous)) return null;
  return (
    <nav className="row-wrap pagination" aria-label={T.common.pages}>
      <Button size="sm" disabled={!data.previous} onClick={() => onPageChange(page - 1)}>{T.workDone.prev}</Button>
      <span className="small muted">{T.workDone.page(page)}</span>
      <Button size="sm" disabled={!data.next} onClick={() => onPageChange(page + 1)}>{T.workDone.next}</Button>
    </nav>
  );
}

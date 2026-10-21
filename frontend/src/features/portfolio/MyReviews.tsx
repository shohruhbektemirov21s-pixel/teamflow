import { Star } from "lucide-react";
import { Link } from "react-router-dom";

import { useModal } from "@/app/modals";
import { usePagedList } from "@/app/queries";
import { fmtDate } from "@/shared/format";
import { T } from "@/shared/text";
import type { MyReview } from "@/shared/types";
import { Empty, ErrorBox, SkeletonRows } from "@/shared/ui";
import { Pagination } from "@/shared/ui/Pagination";

import { Stars } from "./Stars";

/** Oddiy foydalanuvchi profilida: o'zi qo'ygan baholar. Qator bosilsa shu loyiha ochiladi (o'zgartirish mumkin). */
export function MyReviews() {
  const { open } = useModal();
  const list = usePagedList<MyReview>(["portfolio", "my-reviews"], "/portfolio/my-reviews/", {});
  const rows = list.data ?? [];

  return (
    <section className="card" aria-label={T.user.myReviews}>
      <div className="card-head">
        <h3 className="grow">
          {T.user.myReviews} {list.pagination && <span className="count-pill soft">{list.pagination.count}</span>}
        </h3>
      </div>
      {list.error && <div className="card-pad"><ErrorBox error={list.error} onRetry={() => list.refetch()} /></div>}
      {list.isLoading && <div className="card-pad"><SkeletonRows rows={3} /></div>}
      {list.data && !rows.length && (
        <Empty icon={<Star />} title={T.user.myReviewsEmpty} hint={T.user.myReviewsEmptyHint}
          action={<Link className="btn btn-primary" to="/">{T.user.myReviewsCta}</Link>} />
      )}
      {rows.map((r) => (
        <button key={r.id} type="button" className="list-row clickable" onClick={() => open({ portfolio: r.developer.id, item: r.item_id })}>
          <span className="grow stack-sm" style={{ gap: 4, minWidth: 0, textAlign: "left" }}>
            <b className="ellipsis">{r.item_title}</b>
            <span className="small muted ellipsis">{T.user.reviewOf(r.developer.full_name)} · {fmtDate(r.updated_at)}</span>
          </span>
          <Stars value={r.stars} />
        </button>
      ))}
      <Pagination data={list.pagination} page={list.page} onPageChange={list.onPageChange} />
    </section>
  );
}

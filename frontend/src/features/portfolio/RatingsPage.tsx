import { useQuery } from "@tanstack/react-query";
import { Search, Star } from "lucide-react";
import { useState } from "react";

import { useMe } from "@/app/auth";
import { useModal } from "@/app/modals";
import { usePagedList } from "@/app/queries";
import { api } from "@/shared/api";
import { fmtDate } from "@/shared/format";
import { useDebounced } from "@/shared/hooks";
import { T } from "@/shared/text";
import type { PortfolioSummary, Rating } from "@/shared/types";
import { Avatar, Empty, ErrorBox, SkeletonRows } from "@/shared/ui";
import { Pagination } from "@/shared/ui/Pagination";

import { Stars } from "./Stars";

type RatingSort = "new" | "high" | "low";

/** Oddiy foydalanuvchi: barcha baholar (`/baholarim`). Qidiruv — loyiha yoki dasturchi nomi bo'yicha;
 * saralash — yangi / yuqori / past baho; "Faqat meniki" o'zi qo'ygan baholarni qoldiradi.
 * Karta bosilsa loyiha oynasi ochiladi (baholash va o'zgartirish shu yerda). */
export default function RatingsPage() {
  const me = useMe();
  const { open } = useModal();
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<RatingSort>("new");
  const [mine, setMine] = useState(false);
  const q = useDebounced(search.trim());

  const summary = useQuery({ queryKey: ["portfolio", "summary"], queryFn: () => api.get<PortfolioSummary>("/portfolio/summary/") });
  const list = usePagedList<Rating>(["portfolio", "ratings", q, sort, mine], "/portfolio/ratings/", {
    q: q || undefined,
    sort: sort === "new" ? undefined : sort,
    mine: mine ? 1 : undefined,
  });
  const rows = list.data ?? [];
  const filtered = Boolean(q) || mine;

  return (
    <div className="stack">
      <div className="uhead">
        <div className="uhead-text">
          <h1 className="uhead-title">{T.ratings.title}</h1>
        </div>
        {summary.data && (
          <div className="ratings-avg" aria-label={T.ratings.average}>
            <Stars
              value={summary.data.average_rating}
              count={summary.data.average_rating === null ? undefined : summary.data.rated_projects}
              size={20}
            />
          </div>
        )}
      </div>

      <div className="utoolbar">
        <label className="people-search uhead-search">
          <Search size={18} className="muted" aria-hidden />
          <input type="search" placeholder={T.ratings.searchPh} aria-label={T.ratings.searchPh} value={search} onChange={(e) => setSearch(e.target.value)} />
        </label>
        <select className="input usort" aria-label={T.ratings.sortLabel} value={sort} onChange={(e) => setSort(e.target.value as RatingSort)}>
          <option value="new">{T.ratings.sortNew}</option>
          <option value="high">{T.ratings.sortHigh}</option>
          <option value="low">{T.ratings.sortLow}</option>
        </select>
        <label className="check-inline">
          <input type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)} />
          <span>{T.ratings.onlyMine}</span>
        </label>
      </div>

      {list.error && <ErrorBox error={list.error} onRetry={() => list.refetch()} />}
      {list.isLoading && <SkeletonRows rows={4} />}
      {list.data && !rows.length && (
        <div className="card">
          <Empty
            icon={<Star />}
            title={filtered ? T.ratings.notFound : T.ratings.empty}
            hint={filtered ? T.ratings.notFoundHint : T.ratings.emptyHint}
          />
        </div>
      )}
      {rows.length > 0 && (
        <ul className="rating-list">
          {rows.map((r) => (
            <li key={r.id}>
              <button type="button" className="card rating-card" onClick={() => open({ portfolio: r.developer.id, item: r.item_id })}>
                <Avatar user={r.author} size="sm" card={false} />
                <span className="rating-body">
                  <span className="rating-top">
                    <b className="ellipsis">{r.author.id === me.id ? T.ratings.you : r.author.full_name}</b>
                    <time className="small muted" dateTime={r.updated_at}>{fmtDate(r.updated_at)}</time>
                  </span>
                  <Stars value={r.stars} />
                  <span className="small muted ellipsis">{r.item_title} · {T.ratings.developer(r.developer.full_name)}</span>
                  {r.text && <span className="rating-text">{r.text}</span>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <Pagination data={list.pagination} page={list.page} onPageChange={list.onPageChange} />
    </div>
  );
}

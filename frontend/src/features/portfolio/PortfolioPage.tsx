import { FolderKanban, MessageSquare, Search, Trophy, UserCheck, Users } from "lucide-react";
import { useState } from "react";

import { useMe } from "@/app/auth";
import { useModal } from "@/app/modals";
import { usePagedList } from "@/app/queries";
import { useDebounced } from "@/shared/hooks";
import { T } from "@/shared/text";
import type { PortfolioDeveloper } from "@/shared/types";
import { Avatar, Badge, Button, Empty, ErrorBox, SkeletonRows } from "@/shared/ui";
import { Pagination } from "@/shared/ui/Pagination";

import { Stars } from "./Stars";

/**
 * Portfolio (`/portfolio`, hamma rol): barcha dasturchilar reyting bo'yicha — eng balandi tepada.
 * Qator bosilsa dasturchining portfoliosi (modal) ochiladi.
 */
export default function PortfolioPage() {
  const me = useMe();
  const { open } = useModal();
  const [q, setQ] = useState("");
  const search = useDebounced(q.trim());
  const list = usePagedList<PortfolioDeveloper>(["portfolio", "list", search], "/portfolio/", { q: search });
  const rows = list.data ?? [];

  return (
    <div className="stack">
      <div className="page-toolbar">
        <label className="people-search portfolio-search">
          <Search size={18} className="muted" />
          <input type="search" placeholder={T.portfolio.searchPh} aria-label={T.portfolio.searchPh} value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        {list.pagination && <span className="small muted" role="status">{T.portfolio.found(list.pagination.count)}</span>}
        {me.role === "developer" && (
          <div className="page-actions">
            <Button variant="primary" icon={<Trophy size={16} />} onClick={() => open({ portfolio: me.id })}>
              {T.portfolio.mine}
            </Button>
          </div>
        )}
      </div>

      {list.error && <ErrorBox error={list.error} onRetry={() => list.refetch()} />}
      {list.isLoading && <div className="card"><SkeletonRows rows={6} /></div>}
      {list.data && !rows.length && <div className="card"><Empty icon={<Users />} title={T.portfolio.empty} hint={T.portfolio.emptyHint} /></div>}
      {rows.length > 0 && (
        <div className="card">
          {rows.map((d) => (
            <button key={d.id} type="button" className="list-row clickable portfolio-row" onClick={() => open({ portfolio: d.id })}>
              {d.rank !== null && (
                <span className={`rank-pill ${d.rank <= 3 ? `top top-${d.rank}` : ""}`} aria-label={T.portfolio.rank(d.rank)}>
                  {d.rank}
                </span>
              )}
              <Avatar user={d} />
              <span className="grow stack-sm" style={{ gap: 4, minWidth: 0 }}>
                <span className="row-wrap" style={{ gap: 8 }}>
                  <b className="ellipsis">{d.full_name}</b>
                  {d.is_following && <Badge tone="info" dot={false}><UserCheck size={13} /> {T.portfolio.following}</Badge>}
                </span>
                <span className="small muted ellipsis">{d.specialty || T.portfolio.developer}</span>
              </span>
              <span className="portfolio-row-stats">
                <Stars value={d.rating} />
                <span className="row-wrap small muted" style={{ gap: 12 }}>
                  <span className="row" style={{ gap: 4 }}><Users size={14} /> {T.portfolio.followersN(d.followers_count)}</span>
                  <span className="row" style={{ gap: 4 }}><MessageSquare size={14} /> {T.portfolio.reviewsN(d.reviews_count)}</span>
                  <span className="row" style={{ gap: 4 }}><FolderKanban size={14} /> {T.portfolio.projectsN(d.projects_count)}</span>
                </span>
              </span>
            </button>
          ))}
        </div>
      )}
      <Pagination data={list.pagination} page={list.page} onPageChange={list.onPageChange} />
    </div>
  );
}

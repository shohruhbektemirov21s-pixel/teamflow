import { useQuery } from "@tanstack/react-query";
import { FolderKanban, Search, SlidersHorizontal, Trophy, UserCheck, Users } from "lucide-react";
import { useState } from "react";

import { useMe } from "@/app/auth";
import { useModal } from "@/app/modals";
import { usePagedList } from "@/app/queries";
import { api } from "@/shared/api";
import { useDebounced } from "@/shared/hooks";
import { T } from "@/shared/text";
import type { PortfolioDeveloper, PortfolioItem, PortfolioSummary } from "@/shared/types";
import { Avatar, Badge, Button, Empty, ErrorBox, SkeletonRows } from "@/shared/ui";
import { Pagination } from "@/shared/ui/Pagination";

import { Stars } from "./Stars";

/** Texnologiyalar matnini (vergul bilan ajratilgan) chiplarga ajratadi, ko'pi bilan `limit` ta ko'rsatadi. */
function techChips(technologies: string, limit = 3) {
  const items = technologies.split(",").map((t) => t.trim()).filter(Boolean);
  if (!items.length) return null;
  const shown = items.slice(0, limit);
  const rest = items.length - shown.length;
  return (
    <span className="portfolio-dev-tech">
      {shown.map((t) => <span key={t} className="tech-chip">{t}</span>)}
      {rest > 0 && <span className="tech-chip">+{rest}</span>}
    </span>
  );
}

function SummaryCards({ data }: { data?: PortfolioSummary }) {
  return (
    <div className="portfolio-stats">
      <div className="portfolio-stat">
        <span className="total-icon tone-violet"><Users /></span>
        <span className="stack-sm" style={{ gap: 2 }}>
          <span className="small muted">{T.portfolio.summary.developers}</span>
          <b>{data ? data.developers_count : "…"}</b>
        </span>
      </div>
      <div className="portfolio-stat">
        <span className="total-icon tone-warning"><Trophy /></span>
        <span className="stack-sm" style={{ gap: 2 }}>
          <span className="small muted">{T.portfolio.summary.avgRating}</span>
          <b>{data?.avg_rating ?? "—"}</b>
        </span>
      </div>
      <div className="portfolio-stat">
        <span className="total-icon tone-success"><FolderKanban /></span>
        <span className="stack-sm" style={{ gap: 2 }}>
          <span className="small muted">{T.portfolio.summary.ratedItems}</span>
          <b>{data ? data.rated_items_count : "…"}</b>
        </span>
      </div>
    </div>
  );
}

function DeveloperRow({ d, onOpen }: { d: PortfolioDeveloper; onOpen: () => void }) {
  return (
    <button type="button" className="card card-pad portfolio-dev-row clickable" onClick={onOpen}>
      <Avatar user={d} size="lg" />
      <span className="portfolio-dev-row-body">
        <span className="row-wrap" style={{ gap: 8 }}>
          {d.rank !== null && (
            <span className={`rank-pill ${d.rank <= 3 ? `top top-${d.rank}` : ""}`} aria-label={T.portfolio.rank(d.rank)}>
              {d.rank}
            </span>
          )}
          <b className="ellipsis">{d.full_name}</b>
          {d.is_following && <Badge tone="info" dot={false}><UserCheck size={12} /> {T.portfolio.following}</Badge>}
        </span>
        <span className="small muted ellipsis">{d.specialty || T.portfolio.developer}</span>
        {d.technologies && techChips(d.technologies)}
        <span className="portfolio-dev-row-foot">
          <span className="row-wrap" style={{ gap: 12 }}>
            <Stars value={d.rating} count={d.reviews_count} size={14} />
            <span className="row small muted" style={{ gap: 4 }}>
              <FolderKanban size={13} /> {T.portfolio.projectsN(d.projects_count)}
            </span>
          </span>
          <span className="btn btn-sm">{T.portfolio.viewProfile}</span>
        </span>
      </span>
    </button>
  );
}

function ProjectTile({ item }: { item: PortfolioItem & { owner: NonNullable<PortfolioItem["owner"]> } }) {
  const { open } = useModal();
  return (
    <button
      type="button"
      className="portfolio-post-tile"
      style={item.preview_image ? { backgroundImage: `url(${item.preview_image})` } : undefined}
      onClick={() => open({ portfolio: item.owner.id, item: item.id })}
      aria-label={item.title}
    >
      {!item.preview_image && <span className="portfolio-post-placeholder"><FolderKanban size={28} /></span>}
      {item.rating !== null && (
        <span className="portfolio-post-rating"><Trophy size={11} /> {item.rating.toFixed(1)}</span>
      )}
      <span className="portfolio-post-overlay">
        <b>{item.title}</b>
        <span>{item.owner.full_name}</span>
      </span>
    </button>
  );
}

export default function PortfolioPage() {
  const me = useMe();
  const { open } = useModal();
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<"rating" | "name">("rating");
  const [projectsQ, setProjectsQ] = useState("");
  const search = useDebounced(q.trim());
  const projectsSearch = useDebounced(projectsQ.trim());

  const summary = useQuery({ queryKey: ["portfolio", "summary"], queryFn: () => api.get<PortfolioSummary>("/portfolio/summary/") });

  const list = usePagedList<PortfolioDeveloper>(["portfolio", "list", search, sort], "/portfolio/",
    { q: search, sort: sort === "name" ? "name" : undefined });
  const projects = usePagedList<PortfolioItem & { owner: NonNullable<PortfolioItem["owner"]> }>(
    ["portfolio", "projects", projectsSearch], "/portfolio/projects/", { q: projectsSearch });

  const rows = list.data ?? [];
  const techFilters = Array.from(new Set(
    rows.flatMap((d) => d.technologies.split(",").map((t) => t.trim()).filter(Boolean)),
  )).slice(0, 8);

  return (
    <div className="stack">
      <SummaryCards data={summary.data} />

      <div className="page-toolbar">
        <label className="people-search portfolio-search">
          <Search size={18} className="muted" />
          <input type="search" placeholder={T.portfolio.searchPh} aria-label={T.portfolio.searchPh} value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        <label className="row-wrap" style={{ gap: 8 }}>
          <SlidersHorizontal size={16} className="muted" />
          <select className="select" aria-label={T.portfolio.sort} value={sort} onChange={(e) => setSort(e.target.value as "rating" | "name")}>
            <option value="rating">{T.portfolio.sortRating}</option>
            <option value="name">{T.portfolio.sortName}</option>
          </select>
        </label>
        {list.pagination && <span className="small muted" role="status">{T.portfolio.found(list.pagination.count)}</span>}
        {me.role === "developer" && (
          <div className="page-actions">
            <Button variant="primary" className="btn-gradient" icon={<Trophy size={16} />} onClick={() => open({ portfolio: me.id })}>
              {T.portfolio.mine}
            </Button>
          </div>
        )}
      </div>

      {techFilters.length > 0 && (
        <div className="portfolio-filter-chips">
          <button type="button" className={`portfolio-filter-chip ${!q ? "active" : ""}`} onClick={() => setQ("")}>
            {T.portfolio.filterAll}
          </button>
          {techFilters.map((t) => (
            <button key={t} type="button" className={`portfolio-filter-chip ${q === t ? "active" : ""}`} onClick={() => setQ(t)}>
              {t}
            </button>
          ))}
        </div>
      )}

      {list.error && <ErrorBox error={list.error} onRetry={() => list.refetch()} />}
      {list.isLoading && <div className="card"><SkeletonRows rows={4} /></div>}
      {list.data && !rows.length && <div className="card"><Empty icon={<Users />} title={T.portfolio.empty} hint={T.portfolio.emptyHint} /></div>}
      {rows.length > 0 && (
        <div className="portfolio-dev-rows">
          {rows.map((d) => <DeveloperRow key={d.id} d={d} onOpen={() => open({ portfolio: d.id })} />)}
        </div>
      )}
      <Pagination data={list.pagination} page={list.page} onPageChange={list.onPageChange} />

      <div className="page-toolbar" style={{ marginTop: 8 }}>
        <b style={{ fontSize: 16 }}>{T.portfolio.projectsTitle}</b>
        <label className="people-search portfolio-search">
          <Search size={16} className="muted" />
          <input type="search" placeholder={T.portfolio.projectsSearchPh} aria-label={T.portfolio.projectsSearchPh}
            value={projectsQ} onChange={(e) => setProjectsQ(e.target.value)} />
        </label>
        {projects.pagination && <span className="small muted" role="status">{T.portfolio.projectsFound(projects.pagination.count)}</span>}
      </div>
      {projects.error && <ErrorBox error={projects.error} onRetry={() => projects.refetch()} />}
      {projects.isLoading && <div className="card"><SkeletonRows rows={3} /></div>}
      {projects.data && !projects.data.length && (
        <div className="card"><Empty icon={<FolderKanban />} title={T.portfolio.projectsGridEmpty} /></div>
      )}
      {projects.data && projects.data.length > 0 && (
        <div className="portfolio-post-grid">
          {projects.data.map((p) => <ProjectTile key={p.id} item={p} />)}
        </div>
      )}
      <Pagination data={projects.pagination} page={projects.page} onPageChange={projects.onPageChange} />
    </div>
  );
}

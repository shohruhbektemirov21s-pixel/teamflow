import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowUpDown, ChevronRight, FolderKanban, Heart, Search, Star, TrendingUp, UserCheck, Users, X } from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";

import { useModal } from "@/app/modals";
import { usePagedList, useRefresh } from "@/app/queries";
import { api } from "@/shared/api";
import { useDebounced } from "@/shared/hooks";
import { T } from "@/shared/text";
import type { PortfolioDeveloper, PortfolioSummary } from "@/shared/types";
import { Avatar, Button, Empty, ErrorBox, SkeletonRows, useToast } from "@/shared/ui";
import { Pagination } from "@/shared/ui/Pagination";

type SortKey = keyof typeof T.user.sort;

function StatCard({ value, label, icon, tone, badge, star, loading }: {
  value: string | number; label: string; icon: ReactNode; tone: "violet" | "amber" | "blue" | "indigo";
  badge?: string | null; star?: boolean; loading?: boolean;
}) {
  return (
    <div className="card ustat">
      <span className={`ustat-icon tone-${tone}`} aria-hidden>{icon}</span>
      <div className="ustat-text">
        <b className="ustat-value">
          {loading ? <span className="skeleton ustat-skel" /> : value}
          {star && !loading && <Star size={18} className="ustar" aria-hidden />}
        </b>
        <span className="muted">{label}</span>
      </div>
      {badge && <span className="ustat-badge"><TrendingUp size={12} aria-hidden /> {badge}</span>}
    </div>
  );
}

function RatingLine({ d }: { d: PortfolioDeveloper }) {
  return d.rating === null ? (
    <span className="ucard-rating"><span className="udot" aria-hidden /><span className="muted">{T.portfolio.noRating}</span></span>
  ) : (
    <span className="ucard-rating">
      <Star size={16} className="ustar" aria-hidden />
      <b>{d.rating.toFixed(1)}</b>
      <span className="muted">({T.portfolio.reviewsN(d.reviews_count)})</span>
    </span>
  );
}

function DeveloperCard({ d }: { d: PortfolioDeveloper }) {
  const { open } = useModal();
  const toast = useToast();
  const refresh = useRefresh(["portfolio", "profile"]);
  const follow = useMutation({
    mutationFn: (on: boolean) => (on ? api.post(`/portfolio/${d.id}/follow/`) : api.del(`/portfolio/${d.id}/follow/`)),
    onSuccess: (_r, on) => {
      toast(on ? T.portfolio.followedToast : T.portfolio.unfollowedToast);
      refresh();
    },
    onError: (error) => toast(error.message, "error"),
  });
  const openProfile = () => open({ portfolio: d.id });
  const experience = d.experience_months != null ? T.user.experienceShort(d.experience_months) : "–";

  return (
    <article className="card ucard" onClick={openProfile}>
      <div
        className={d.cover ? "ucover" : `ucover ucover-${((d.id - 1) % 5) + 1}`}
        role={!d.cover ? "img" : undefined}
        aria-label={!d.cover ? T.user.developerCoverEmpty(d.full_name) : undefined}
      >
        {d.cover && (
          <img
            src={d.cover}
            alt={T.user.developerCoverAlt(d.full_name)}
            loading="lazy"
            style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "inherit" }}
          />
        )}
        <button
          type="button"
          className="uheart"
          aria-pressed={d.is_following}
          aria-label={d.is_following ? T.user.unfollowAria(d.full_name) : T.user.followAria(d.full_name)}
          disabled={follow.isPending}
          onClick={(event) => {
            event.stopPropagation();
            follow.mutate(!d.is_following);
          }}
        >
          <Heart size={18} aria-hidden />
        </button>
      </div>
      <div className="ucard-main">
        <span className="ucard-avatar">
          <Avatar user={d} size="xl" card={false} />
        </span>
        <div className="ucard-head">
          <div className="ucard-id">
            <b className="ucard-name ellipsis">{d.full_name}</b>
            <span className="muted ellipsis">{d.specialty || T.portfolio.developer}</span>
          </div>
          <button type="button" className="uview" onClick={(event) => { event.stopPropagation(); openProfile(); }}>
            {T.user.viewProfile}<ChevronRight size={16} aria-hidden />
          </button>
        </div>
        <RatingLine d={d} />
        {!!d.technologies?.length && (
          <div className="ucard-tags" aria-label={T.portfolio.technologies}>
            {d.technologies.slice(0, 3).map((technology) => <span key={technology} className="utag">{technology}</span>)}
            {d.technologies.length > 3 && <span className="utag utag-more">+{d.technologies.length - 3}</span>}
          </div>
        )}
        <dl className="ucard-stats">
          <div><dt><FolderKanban size={14} aria-hidden /> {T.user.cardProjects}</dt><dd>{d.projects_count}</dd></div>
          <div><dt><Star size={14} aria-hidden /> {T.user.cardRating}</dt><dd>{d.rating === null ? "–" : d.rating.toFixed(1)}</dd></div>
          <div><dt><UserCheck size={14} aria-hidden /> {T.user.cardExperience}</dt><dd>{experience}</dd></div>
        </dl>
      </div>
    </article>
  );
}

/** Oddiy foydalanuvchi bosh sahifasi: qidiruv, reyting saralashi va haqiqiy portfolio ma'lumotlari. */
export default function UserDashboard() {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<SortKey>("rating");
  const searchRef = useRef<HTMLInputElement>(null);
  const search = useDebounced(q.trim());
  const summary = useQuery({ queryKey: ["portfolio", "summary"], queryFn: () => api.get<PortfolioSummary>("/portfolio/summary/") });
  const list = usePagedList<PortfolioDeveloper>(["portfolio", "list", search, sort], "/portfolio/", {
    q: search,
    sort: sort === "rating" ? undefined : sort,
  });
  const rows = list.data ?? [];
  const stats = summary.data;

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="stack">
      <div className="uhead"><div className="uhead-text"><h1 className="uhead-title">{T.user.title}</h1></div></div>

      <div className="utoolbar">
        <label className="people-search uhead-search">
          <Search size={18} className="muted" aria-hidden />
          <input
            ref={searchRef}
            type="search"
            placeholder={T.user.searchPh}
            aria-label={T.user.searchPh}
            value={q}
            onChange={(event) => setQ(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape" && q) {
                event.preventDefault();
                setQ("");
              }
            }}
          />
          {q ? (
            <button
              type="button"
              className="uhead-clear-btn"
              aria-label={T.common.clear}
              title={T.common.clear}
              onClick={(event) => {
                event.preventDefault();
                setQ("");
                searchRef.current?.focus();
              }}
            >
              <X size={15} aria-hidden />
            </button>
          ) : (
            <kbd className="ukbd" aria-hidden>{T.user.searchKbd}</kbd>
          )}
        </label>
        <label className="usort-wrap">
          <ArrowUpDown size={18} aria-hidden />
          <select className="input usort" aria-label={T.user.sortLabel} value={sort} onChange={(event) => setSort(event.target.value as SortKey)}>
            {(Object.keys(T.user.sort) as SortKey[]).map((key) => <option key={key} value={key}>{T.user.sort[key]}</option>)}
          </select>
        </label>
      </div>

      <div className="ustats">
        <StatCard tone="violet" icon={<Users size={22} />} loading={summary.isLoading} value={stats ? stats.developers : "–"} label={T.user.statDevelopers}
          badge={stats?.developers_growth ? `+${stats.developers_growth}%` : null} />
        <StatCard tone="amber" icon={<Star size={22} />} loading={summary.isLoading} value={stats?.average_rating != null ? stats.average_rating.toFixed(1) : "–"}
          label={T.user.statRating} star={stats?.average_rating != null} />
        <StatCard tone="blue" icon={<FolderKanban size={22} />} loading={summary.isLoading} value={stats ? stats.rated_projects : "–"} label={T.user.statRated} />
        <StatCard tone="indigo" icon={<TrendingUp size={22} />} loading={summary.isLoading} value={stats ? stats.active_projects : "–"} label={T.user.statActive} />
      </div>

      {list.error && <ErrorBox error={list.error} onRetry={() => list.refetch()} />}
      {list.isLoading && <div className="card"><SkeletonRows rows={4} /></div>}
      {list.data && !rows.length && (
        <div className="card">
          <Empty
            icon={<Users />}
            title={T.portfolio.empty}
            hint={T.portfolio.emptyHint}
            action={
              q ? (
                <Button size="sm" variant="ghost" onClick={() => { setQ(""); searchRef.current?.focus(); }}>
                  {T.common.clear}
                </Button>
              ) : undefined
            }
          />
        </div>
      )}
      <div className="ugrid">{rows.map((developer) => <DeveloperCard key={developer.id} d={developer} />)}</div>
      <Pagination data={list.pagination} page={list.page} onPageChange={list.onPageChange} />
    </div>
  );
}

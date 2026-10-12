import { useMutation, useQuery } from "@tanstack/react-query";
import { ChevronRight, FolderKanban, Heart, LayoutGrid, List, Search, Star, TrendingUp, UserCheck, Users } from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";

import { useModal } from "@/app/modals";
import { usePagedList, useRefresh } from "@/app/queries";
import { api } from "@/shared/api";
import { useDebounced } from "@/shared/hooks";
import { T } from "@/shared/text";
import type { PortfolioDeveloper, PortfolioSummary } from "@/shared/types";
import { Avatar, Button, Empty, ErrorBox, SkeletonRows, useToast } from "@/shared/ui";
import { Pagination } from "@/shared/ui/Pagination";

const HINT_KEY = "user-how-seen";
const VIEW_KEY = "user-view";
type SortKey = keyof typeof T.user.sort;
type View = "grid" | "list";

function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* brauzer xotirasi yopiq bo'lishi mumkin */
  }
}

function HowItWorks({ onClose }: { onClose: () => void }) {
  return (
    <section className="card uhow" aria-label={T.user.howTitle}>
      <b className="uhow-title">{T.user.howTitle}</b>
      <ol className="uhow-steps">
        {T.user.howSteps.map((step, i) => (
          <li key={step}><span className="uhow-num" aria-hidden>{i + 1}</span>{step}</li>
        ))}
      </ol>
      <Button size="sm" onClick={onClose}>{T.user.howClose}</Button>
    </section>
  );
}

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

function DeveloperCard({ d, view }: { d: PortfolioDeveloper; view: View }) {
  const { open } = useModal();
  const toast = useToast();
  const refresh = useRefresh(["portfolio"]);
  const follow = useMutation({
    mutationFn: (on: boolean) => (on ? api.post(`/portfolio/${d.id}/follow/`) : api.del(`/portfolio/${d.id}/follow/`)),
    onSuccess: (_r, on) => {
      toast(on ? T.portfolio.followedToast : T.portfolio.unfollowedToast);
      refresh();
    },
  });
  const openProfile = () => open({ portfolio: d.id });
  const heart = (
    <button
      type="button"
      className="uheart"
      aria-pressed={d.is_following}
      aria-label={d.is_following ? T.user.unfollowAria(d.full_name) : T.user.followAria(d.full_name)}
      disabled={follow.isPending}
      onClick={(e) => { e.stopPropagation(); follow.mutate(!d.is_following); }}
    >
      <Heart size={18} aria-hidden />
    </button>
  );
  const viewBtn = (
    <button type="button" className="uview" onClick={(e) => { e.stopPropagation(); openProfile(); }}>
      {T.user.viewProfile}<ChevronRight size={16} aria-hidden />
    </button>
  );
  const experience = d.experience_months != null ? T.user.experienceShort(d.experience_months) : "–";

  if (view === "list") {
    return (
      <article className="card urow" onClick={openProfile}>
        <Avatar user={d} size="lg" card={false} />
        <div className="urow-name">
          <b className="ellipsis">{d.full_name}</b>
          <span className="muted ellipsis">{d.specialty || T.portfolio.developer}</span>
        </div>
        <RatingLine d={d} />
        <span className="urow-meta muted"><FolderKanban size={14} aria-hidden /> {T.portfolio.projectsN(d.projects_count)}</span>
        <span className="urow-meta muted">{experience}</span>
        {heart}
        {viewBtn}
      </article>
    );
  }

  return (
    <article className="card ucard" onClick={openProfile}>
      <div className={`ucover ucover-${d.id % 6}`}>{heart}</div>
      <div className="ucard-main">
        <span className="ucard-avatar"><Avatar user={d} size="xl" card={false} /></span>
        <div className="ucard-head">
          <div className="ucard-id">
            <b className="ucard-name ellipsis">{d.full_name}</b>
            <span className="muted ellipsis">{d.specialty || T.portfolio.developer}</span>
          </div>
          {viewBtn}
        </div>
        <RatingLine d={d} />
        {!!d.projects?.length && (
          <div className="ucard-tags" aria-label={T.user.cardProjects}>
            {d.projects.map((title) => <span key={title} className="utag" title={title}>{title}</span>)}
            {!!d.projects_extra && <span className="utag utag-more">+{d.projects_extra}</span>}
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

/** Oddiy foydalanuvchi bosh sahifasi ("Dasturchilar portfoliosi"): barcha ma'lumot backenddan. */
export default function UserDashboard() {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<SortKey>("rating");
  const [view, setView] = useState<View>(() => (readStorage(VIEW_KEY) === "list" ? "list" : "grid"));
  const [seen, setSeen] = useState(() => readStorage(HINT_KEY) === "1");
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
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const closeHint = () => {
    setSeen(true);
    writeStorage(HINT_KEY, "1");
  };
  const changeView = (next: View) => {
    setView(next);
    writeStorage(VIEW_KEY, next);
  };

  const loading = summary.isLoading;

  return (
    <div className="stack">
      <div className="uhead">
        <h1 className="uhead-title">{T.user.title}</h1>
      </div>

      <div className="utoolbar">
        <label className="people-search uhead-search">
          <Search size={18} className="muted" aria-hidden />
          <input ref={searchRef} type="search" placeholder={T.user.searchPh} aria-label={T.user.searchPh} value={q} onChange={(e) => setQ(e.target.value)} />
          <kbd className="ukbd" aria-hidden>{T.user.searchKbd}</kbd>
        </label>
        <select className="input usort" aria-label={T.user.sortLabel} value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
          {(Object.keys(T.user.sort) as SortKey[]).map((key) => <option key={key} value={key}>{T.user.sort[key]}</option>)}
        </select>
        <div className="uview-toggle" role="group" aria-label={T.user.viewLabel}>
          <button type="button" aria-pressed={view === "grid"} aria-label={T.user.viewGrid} title={T.user.viewGrid} onClick={() => changeView("grid")}><LayoutGrid size={18} /></button>
          <button type="button" aria-pressed={view === "list"} aria-label={T.user.viewList} title={T.user.viewList} onClick={() => changeView("list")}><List size={18} /></button>
        </div>
      </div>

      {!seen && <HowItWorks onClose={closeHint} />}

      <div className="ustats">
        <StatCard tone="violet" icon={<Users size={22} />} loading={loading} value={stats ? stats.developers : "–"} label={T.user.statDevelopers}
          badge={stats?.developers_growth ? `+${stats.developers_growth}%` : null} />
        <StatCard tone="amber" icon={<Star size={22} />} loading={loading} value={stats?.average_rating != null ? stats.average_rating.toFixed(1) : "–"}
          label={T.user.statRating} star={stats?.average_rating != null} />
        <StatCard tone="blue" icon={<FolderKanban size={22} />} loading={loading} value={stats ? stats.rated_projects : "–"} label={T.user.statRated} />
        <StatCard tone="indigo" icon={<TrendingUp size={22} />} loading={loading} value={stats ? stats.active_projects : "–"} label={T.user.statActive} />
      </div>

      {list.error && <ErrorBox error={list.error} onRetry={() => list.refetch()} />}
      {list.isLoading && <div className="card"><SkeletonRows rows={4} /></div>}
      {list.data && !rows.length && (
        <div className="card"><Empty icon={<Users />} title={T.portfolio.empty} hint={T.portfolio.emptyHint} /></div>
      )}
      <div className={view === "grid" ? "ugrid" : "ulist"}>
        {rows.map((d) => <DeveloperCard key={d.id} d={d} view={view} />)}
      </div>
      <Pagination data={list.pagination} page={list.page} onPageChange={list.onPageChange} />
    </div>
  );
}

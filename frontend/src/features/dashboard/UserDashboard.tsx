import { useMutation, useQuery } from "@tanstack/react-query";
import { Briefcase, CheckCircle2, Eye, FolderKanban, Heart, MessageSquare, Plane, RotateCcw, Search, Star, Users, X } from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";

import { useModal } from "@/app/modals";
import { usePagedList, useRefresh } from "@/app/queries";
import { api } from "@/shared/api";
import { initials, timeAgo } from "@/shared/format";
import { useDebounced } from "@/shared/hooks";
import { T } from "@/shared/text";
import type { PortfolioDeveloper, PortfolioSummary } from "@/shared/types";
import { AnimatedNumber, Avatar, Button, Empty, ErrorBox, Skeleton, useToast } from "@/shared/ui";
import { Pagination } from "@/shared/ui/Pagination";

import { StatusBadge, StatusDot, statusText } from "../portfolio/DeveloperStatus";

type SortKey = keyof typeof T.user.sort;
type StatusKey = keyof typeof T.user.statusOptions;
type Tint = "primary" | "warning" | "info" | "success";
const MAX_TAGS = 3;

/** Haftalik qo'shilganlar → har haftadagi jami (oxirgi ustun = hozirgi jami). Grafik o'sishni ko'rsatadi. */
function cumulative(weekly: number[], total: number): number[] {
  let rest = total - weekly.reduce((sum, n) => sum + n, 0);
  return weekly.map((n) => (rest += n));
}

/** So'nggi haftalar grafigi: ustunchalar. Hammasi nol bo'lsa — bir xil past ustunlar. */
function MiniBars({ values, label }: { values: number[]; label: string }) {
  const max = Math.max(...values, 1);
  return (
    <span className="pf-bars" role="img" aria-label={label}>
      {values.map((v, i) => <i key={i} style={{ height: `${Math.max(12, Math.round((v / max) * 100))}%` }} />)}
    </span>
  );
}

function Kpi({ index, value, label, icon, tint, series, star, loading }: {
  index: number; value: string | number; label: string; icon: ReactNode; tint: Tint;
  series?: number[]; star?: boolean; loading?: boolean;
}) {
  return (
    <div className="pf-kpi" style={{ ["--i" as string]: index, ["--tint" as string]: `var(--${tint})`, ["--tint-soft" as string]: `var(--${tint}-soft)` }}>
      <span className="pf-kpi-icon" aria-hidden>{icon}</span>
      <div className="pf-kpi-body">
        <b className="pf-kpi-value">
          {loading ? <Skeleton w={44} h={26} /> : typeof value === "number" ? <AnimatedNumber value={value} /> : value}
          {star && !loading && <Star className="pf-star" aria-hidden />}
        </b>
        <span className="pf-kpi-label">{label}</span>
      </div>
      {series && !loading && <MiniBars values={series} label={`${label}: ${T.user.trendCaption}`} />}
    </div>
  );
}

function Rating({ d }: { d: PortfolioDeveloper }) {
  if (d.rating === null) return <span className="pf-rating is-empty">{T.portfolio.noRating}</span>;
  return (
    <span className="pf-rating">
      <Star className="pf-star" aria-hidden />
      <b>{d.rating.toFixed(1)}</b>
      <small>({T.portfolio.reviewsN(d.reviews_count)})</small>
    </span>
  );
}

/** "Hozir band" qatori: har doim bitta joyda, shuning uchun kartalar bir xil balandlikda. */
function WorkNow({ d }: { d: PortfolioDeveloper }) {
  const { state, active_tasks } = d.status;
  if (state === "busy" && d.working_on) {
    return (
      <div className="pf-now is-busy">
        <span className="pf-now-icon" aria-hidden><Briefcase /></span>
        <div className="pf-now-text">
          <small>{T.user.nowWorking}</small>
          <b>{d.working_on.name}</b>
          {d.working_on.description && <span>{d.working_on.description}</span>}
        </div>
        <span className="pf-now-pill">{T.user.activeTasks(active_tasks)}</span>
      </div>
    );
  }
  if (state === "free") {
    return (
      <div className="pf-now is-free">
        <span className="pf-now-icon" aria-hidden><CheckCircle2 /></span>
        <div className="pf-now-text">
          <b>{T.user.notBusy}</b>
          <span>{T.user.notBusyHint}</span>
        </div>
      </div>
    );
  }
  return (
    <div className={`pf-now ${state === "trip" ? "is-trip" : "is-busy"}`}>
      <span className="pf-now-icon" aria-hidden>{state === "trip" ? <Plane /> : <Briefcase />}</span>
      <div className="pf-now-text"><b>{statusText(d.status)}</b></div>
    </div>
  );
}

function LatestComment({ d }: { d: PortfolioDeveloper }) {
  const comment = d.latest_comment;
  if (!comment) {
    return (
      <div className="pf-quote is-empty">
        <MessageSquare aria-hidden />
        <b>{T.user.noComment}</b>
        <small>{T.user.noCommentHint}</small>
      </div>
    );
  }
  return (
    <div className="pf-quote">
      <span className="pf-quote-title">{T.user.latestComment}</span>
      <div className="pf-quote-head">
        <span className="pf-quote-ava" aria-hidden>{initials(comment.author)}</span>
        <span className="pf-quote-name">{comment.author}</span>
        {comment.stars !== null && (
          <span className="pf-quote-stars" role="img" aria-label={T.portfolio.starsOf(comment.stars)}>
            {[1, 2, 3, 4, 5].map((i) => <Star key={i} className={i <= comment.stars! ? "" : "off"} aria-hidden />)}
          </span>
        )}
        <span className="pf-quote-time">{timeAgo(comment.created_at)}</span>
      </div>
      <p className="pf-quote-text">{comment.text}</p>
    </div>
  );
}

function DeveloperCard({ d, index }: { d: PortfolioDeveloper; index: number }) {
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
  const technologies = d.technologies ?? [];

  return (
    <article className="pf-card" style={{ ["--i" as string]: Math.min(index, 8) }} onClick={openProfile}>
      <div
        className={d.cover ? "pf-cover" : `pf-cover c${((d.id - 1) % 5) + 1}`}
        role={!d.cover ? "img" : undefined}
        aria-label={!d.cover ? T.user.developerCoverEmpty(d.full_name) : undefined}
      >
        {d.cover && <img src={d.cover} alt={T.user.developerCoverAlt(d.full_name)} loading="lazy" />}
        <button
          type="button"
          className="pf-heart"
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
      <div className="pf-body">
        <div className="pf-id">
          <span className="pf-avatar">
            <Avatar user={d} size="xl" card={false} />
            <StatusDot status={d.status} />
          </span>
          <div className="pf-who">
            <b className="pf-name">{d.full_name}</b>
            <span className="pf-spec">{d.specialty || T.portfolio.developer}</span>
          </div>
          <Rating d={d} />
        </div>
        <div className="pf-tags" aria-label={T.portfolio.technologies}>
          <StatusBadge status={d.status} />
          {technologies.slice(0, MAX_TAGS).map((technology) => <span key={technology} className="pf-tag">{technology}</span>)}
          {technologies.length > MAX_TAGS && <span className="pf-tag more">+{technologies.length - MAX_TAGS}</span>}
        </div>
        <dl className="pf-metrics">
          <div className="pf-metric"><dd><b>{d.projects_count}</b></dd><dt><span>{T.user.cardProjects}</span></dt></div>
          <div className="pf-metric"><dd><b>{d.rating === null ? "–" : d.rating.toFixed(1)}</b></dd><dt><span>{T.user.cardRating}</span></dt></div>
          <div className="pf-metric"><dd><b>{d.reviews_count}</b></dd><dt><span>{T.user.cardReviews}</span></dt></div>
        </dl>
        <WorkNow d={d} />
        <LatestComment d={d} />
        <div className="pf-actions">
          <button type="button" className="pf-btn primary" onClick={(event) => { event.stopPropagation(); openProfile(); }}>
            <Eye aria-hidden />{T.user.viewProfile}
          </button>
          <button type="button" className="pf-btn" onClick={(event) => { event.stopPropagation(); open({ portfolio: d.id, tab: "projects" }); }}>
            <MessageSquare aria-hidden />{T.user.writeReview}
          </button>
        </div>
      </div>
    </article>
  );
}

/** Oddiy foydalanuvchi bosh sahifasi: ko'rsatkichlar, qidiruv, filtrlar va dasturchi kartalari (hammasi portfolio API'dan). */
export default function UserDashboard() {
  const [q, setQ] = useState("");
  const [technology, setTechnology] = useState("");
  const [status, setStatus] = useState<"" | StatusKey>("");
  const [minRating, setMinRating] = useState("");
  const [sort, setSort] = useState<SortKey>("rating");
  const searchRef = useRef<HTMLInputElement>(null);
  const search = useDebounced(q.trim());
  const summary = useQuery({ queryKey: ["portfolio", "summary"], queryFn: () => api.get<PortfolioSummary>("/portfolio/summary/") });
  const list = usePagedList<PortfolioDeveloper>(["portfolio", "list", search, technology, status, minRating, sort], "/portfolio/", {
    q: search,
    technology: technology || undefined,
    status: status || undefined,
    min_rating: minRating || undefined,
    sort: sort === "rating" ? undefined : sort,
  });
  const rows = list.data ?? [];
  const stats = summary.data;
  const filtered = !!(q || technology || status || minRating);
  const clear = () => {
    setQ("");
    setTechnology("");
    setStatus("");
    setMinRating("");
    searchRef.current?.focus();
  };

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
    <div className="pf-page">
      <div className="pf-head">
        <h1 className="pf-title">{T.user.title}</h1>
        {list.pagination && <span className="pf-count" aria-live="polite">{T.user.resultCount(list.pagination.count)}</span>}
      </div>

      <div className="pf-kpis">
        <Kpi index={0} tint="primary" icon={<Users />} loading={summary.isLoading} value={stats ? stats.developers : "–"} label={T.user.statDevelopers}
          series={stats ? cumulative(stats.series.developers, stats.developers) : undefined} />
        <Kpi index={1} tint="warning" icon={<Star />} loading={summary.isLoading} value={stats?.average_rating != null ? stats.average_rating.toFixed(1) : "–"}
          label={T.user.statRating} star={stats?.average_rating != null} />
        <Kpi index={2} tint="info" icon={<FolderKanban />} loading={summary.isLoading} value={stats ? stats.completed_projects : "–"}
          label={T.user.statCompleted} series={stats ? cumulative(stats.series.completed_projects, stats.completed_projects) : undefined} />
        <Kpi index={3} tint="success" icon={<CheckCircle2 />} loading={summary.isLoading} value={stats ? stats.busy_developers : "–"} label={T.user.statBusy} />
      </div>

      <div className="pf-filters" role="search">
        <label className="pf-search">
          <Search size={18} aria-hidden />
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
            <button type="button" className="pf-x" aria-label={T.common.clear} title={T.common.clear} onClick={(event) => { event.preventDefault(); setQ(""); searchRef.current?.focus(); }}>
              <X size={15} aria-hidden />
            </button>
          ) : (
            <kbd className="pf-kbd" aria-hidden>{T.user.searchKbd}</kbd>
          )}
        </label>
        {!!stats?.technologies.length && (
          <select className={`pf-select ${technology ? "is-set" : ""}`} aria-label={T.user.filterTechnology} value={technology} onChange={(event) => setTechnology(event.target.value)}>
            <option value="">{T.user.filterTechnology}</option>
            {stats.technologies.map((name) => <option key={name} value={name}>{name}</option>)}
          </select>
        )}
        <select className={`pf-select ${status ? "is-set" : ""}`} aria-label={T.user.filterStatus} value={status} onChange={(event) => setStatus(event.target.value as "" | StatusKey)}>
          <option value="">{T.user.filterStatus}</option>
          {(Object.keys(T.user.statusOptions) as StatusKey[]).map((key) => <option key={key} value={key}>{T.user.statusOptions[key]}</option>)}
        </select>
        <select className={`pf-select ${minRating ? "is-set" : ""}`} aria-label={T.user.filterRating} value={minRating} onChange={(event) => setMinRating(event.target.value)}>
          <option value="">{T.user.filterRating}</option>
          {[5, 4, 3].map((n) => <option key={n} value={n}>{T.user.ratingFrom(n)}</option>)}
        </select>
        <select className="pf-select" aria-label={T.user.sortLabel} value={sort} onChange={(event) => setSort(event.target.value as SortKey)}>
          {(Object.keys(T.user.sort) as SortKey[]).map((key) => <option key={key} value={key}>{T.user.sort[key]}</option>)}
        </select>
        {filtered && (
          <button type="button" className="pf-reset" onClick={clear}><RotateCcw size={15} aria-hidden />{T.common.clear}</button>
        )}
      </div>

      {list.error && <ErrorBox error={list.error} onRetry={() => list.refetch()} />}
      {list.isLoading && (
        <div className="pf-grid" aria-busy="true">
          {[0, 1, 2].map((i) => <Skeleton key={i} h={520} style={{ borderRadius: "var(--radius)" }} />)}
        </div>
      )}
      {list.data && !rows.length && (
        <div className="card">
          <Empty
            icon={<Users />}
            title={T.portfolio.empty}
            hint={T.portfolio.emptyHint}
            action={filtered ? <Button size="sm" variant="ghost" onClick={clear}>{T.common.clear}</Button> : undefined}
          />
        </div>
      )}
      {!!rows.length && <div className="pf-grid">{rows.map((developer, index) => <DeveloperCard key={developer.id} d={developer} index={index} />)}</div>}
      <Pagination data={list.pagination} page={list.page} onPageChange={list.onPageChange} />
    </div>
  );
}

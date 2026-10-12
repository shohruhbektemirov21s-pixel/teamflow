import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { CalendarDays, ChevronRight, FolderKanban, LayoutGrid, List, Plus } from "lucide-react";
import { useState } from "react";

import { isManager, useMe } from "@/app/auth";
import { useModal } from "@/app/modals";
import { api, qs } from "@/shared/api";
import { fmtDate } from "@/shared/format";
import { useDebounced } from "@/shared/hooks";
import type { Tone } from "@/shared/status";
import { T } from "@/shared/text";
import type { Paged, Project, ProjectStatus } from "@/shared/types";
import { Badge, Button, CodeTag, Empty, ErrorBox, People, Skeleton } from "@/shared/ui";
import { Pagination } from "@/shared/ui/Pagination";

const VIEW_KEY = "projects-view";
const FILTERS: ProjectStatus[] = ["done", "active", "overdue"];
const STATUS_TONE: Record<ProjectStatus, Tone> = { done: "success", active: "info", overdue: "danger" };
const CARD_TECH = 4;
type View = "grid" | "list";

function readView(): View {
  try {
    return localStorage.getItem(VIEW_KEY) === "list" ? "list" : "grid";
  } catch {
    return "grid";
  }
}

function Technologies({ names, limit }: { names: string[]; limit: number }) {
  if (!names.length) return null;
  const extra = names.length - limit;
  return (
    <span className="pf-chips">
      {names.slice(0, limit).map((name) => <span key={name} className="utag" title={name}>{name}</span>)}
      {extra > 0 && <span className="utag utag-more">{T.portfolio.moreTech(extra)}</span>}
    </span>
  );
}

function Dates({ p }: { p: Project }) {
  return (
    <span className="row small muted" style={{ gap: 4 }}>
      <CalendarDays size={14} aria-hidden /> {T.projects.period(fmtDate(p.start_date), fmtDate(p.end_date))}
    </span>
  );
}

function Progress({ p }: { p: Project }) {
  const pct = p.progress.total ? Math.round((p.progress.done / p.progress.total) * 100) : 0;
  return (
    <div className="stack-sm" style={{ gap: 4 }}>
      <div className="progress" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={T.projects.progress(p.progress.done, p.progress.total)}>
        <span style={{ width: `${pct}%` }} />
      </div>
      <span className="small muted">{T.projects.progress(p.progress.done, p.progress.total)}</span>
    </div>
  );
}

function Cover({ p, className }: { p: Project; className: string }) {
  return p.cover
    ? <img className={className} src={p.cover} alt="" loading="lazy" />
    : <div className={`${className} ucover-${p.id % 6}`} aria-hidden />;
}

function ProjectCard({ p, view, onOpen }: { p: Project; view: View; onOpen: () => void }) {
  const status = <Badge tone={STATUS_TONE[p.status]}>{T.projects.status[p.status]}</Badge>;
  const viewButton = (
    <Button size="sm" icon={<ChevronRight size={14} />} onClick={(e) => { e.stopPropagation(); onOpen(); }}>{T.projects.view}</Button>
  );

  if (view === "list")
    return (
      <article className="card prow" onClick={onOpen}>
        <Cover p={p} className="prow-cover" />
        <div className="prow-name">
          <b className="ellipsis">{p.name}</b>
          <span className="small muted ellipsis"><CodeTag code={p.code} />{p.description ? ` ${p.description}` : ""}</span>
        </div>
        {status}
        <Dates p={p} />
        <div className="prow-progress"><Progress p={p} /></div>
        <People users={p.members} />
        {viewButton}
      </article>
    );

  return (
    <article className="card pcard" onClick={onOpen}>
      <Cover p={p} className="pcard-cover" />
      <div className="pcard-body">
        <div className="pcard-top">
          <b className="pcard-title">{p.name}</b>
          {status}
        </div>
        <CodeTag code={p.code} />
        {p.description && <p className="pcard-text">{p.description}</p>}
        <Dates p={p} />
        <Technologies names={p.technologies} limit={CARD_TECH} />
        <Progress p={p} />
        <div className="pcard-foot">
          <People users={p.members} />
          {viewButton}
        </div>
      </div>
    </article>
  );
}

export default function ProjectsPage() {
  const me = useMe();
  const manager = isManager(me);
  const { open } = useModal();
  const [status, setStatus] = useState<"" | ProjectStatus>("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [view, setView] = useState<View>(readView);
  const search = useDebounced(q);
  const query = useQuery({
    queryKey: ["projects", status, search, page],
    queryFn: () => api.get<Paged<Project>>(`/projects/${qs({ status, q: search, page: page === 1 ? undefined : page })}`),
    placeholderData: keepPreviousData,
  });
  const changeView = (next: View) => {
    setView(next);
    try {
      localStorage.setItem(VIEW_KEY, next);
    } catch {
      /* brauzer xotirasi yopiq bo'lishi mumkin */
    }
  };
  const rows = query.data?.results;

  return (
    <>
      <div className="page-toolbar">
        <input className="input page-search" placeholder={T.common.search} value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} aria-label={T.common.search} />
        {manager && (
          <div className="page-actions">
            <Button variant="primary" icon={<Plus />} onClick={() => open({ new: "project" })}>
              {T.projects.new}
            </Button>
          </div>
        )}
        <div className="toolbar-filters toolbar-split">
          <div className="chips" role="group" aria-label={T.projects.statusFilter}>
            <button className="chip" aria-pressed={status === ""} onClick={() => { setStatus(""); setPage(1); }}>
              {T.common.all}
            </button>
            {FILTERS.map((s) => (
              <button key={s} className="chip" aria-pressed={status === s} onClick={() => { setStatus(s); setPage(1); }}>
                {T.projects.status[s]}
              </button>
            ))}
          </div>
          <div className="uview-toggle" role="group" aria-label={T.projects.viewLabel}>
            <button type="button" aria-pressed={view === "grid"} aria-label={T.projects.viewGrid} title={T.projects.viewGrid} onClick={() => changeView("grid")}><LayoutGrid size={18} /></button>
            <button type="button" aria-pressed={view === "list"} aria-label={T.projects.viewList} title={T.projects.viewList} onClick={() => changeView("list")}><List size={18} /></button>
          </div>
        </div>
      </div>
      {query.error && <ErrorBox error={query.error} onRetry={() => query.refetch()} />}
      {query.isLoading && (
        <div className={view === "grid" ? "pgrid" : "plist"}>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} h={view === "grid" ? 300 : 72} />
          ))}
        </div>
      )}
      {rows && !rows.length && (
        <div className="card">
          <Empty
            icon={<FolderKanban />}
            title={T.projects.empty}
            hint={manager ? T.projects.emptyHint : T.projects.emptyDev}
            action={
              manager && (
                <Button variant="primary" icon={<Plus />} onClick={() => open({ new: "project" })}>
                  {T.projects.new}
                </Button>
              )
            }
          />
        </div>
      )}
      {!!rows?.length && (
        <div className={view === "grid" ? "pgrid" : "plist"}>
          {rows.map((p) => <ProjectCard key={p.id} p={p} view={view} onOpen={() => open({ project: p.id })} />)}
        </div>
      )}
      <Pagination data={query.isPlaceholderData ? undefined : query.data} page={page} onPageChange={setPage} />
    </>
  );
}

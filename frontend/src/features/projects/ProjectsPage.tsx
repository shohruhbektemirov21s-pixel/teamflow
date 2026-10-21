import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { AlertTriangle, CalendarDays, CheckCircle2, Clock, FolderKanban, Hourglass, Layers, Play, Plus, Search, ShieldX, Wrench } from "lucide-react";
import { type ReactNode, useState } from "react";

import { isManager, useMe } from "@/app/auth";
import { useModal } from "@/app/modals";
import { api, qs } from "@/shared/api";
import { fmtDate } from "@/shared/format";
import { useDebounced } from "@/shared/hooks";
import { useMeta } from "@/shared/meta";
import { T } from "@/shared/text";
import type { ListStats, Paged, Project, ProjectStage } from "@/shared/types";
import { Badge, Button, CodeTag, Empty, ErrorBox, People, Skeleton, StageBadge } from "@/shared/ui";
import { StatRow, type StatItem, TabChips, type TabItem } from "@/shared/ui/ListKit";
import { Pagination } from "@/shared/ui/Pagination";

const STAT_ICONS: Record<string, [ReactNode, StatItem["tone"]]> = {
  all: [<FolderKanban key="i" />, "primary"],
  planned: [<Clock key="i" />, "slate"],
  started: [<Play key="i" />, "info"],
  pending_approval: [<Hourglass key="i" />, "violet"],
  done: [<CheckCircle2 key="i" />, "success"],
};
const TAB_ICONS: Record<ProjectStage, ReactNode> = {
  planned: <Clock size={16} />,
  started: <Play size={16} />,
  needs_fix: <Wrench size={16} />,
  rejected: <ShieldX size={16} />,
  pending_approval: <Hourglass size={16} />,
  done: <CheckCircle2 size={16} />,
};

export default function ProjectsPage() {
  const me = useMe();
  const manager = isManager(me);
  const { open } = useModal();
  const meta = useMeta();
  const [stage, setStage] = useState<"" | ProjectStage>("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const search = useDebounced(q);
  const query = useQuery({
    queryKey: ["projects", stage, search, page, pageSize],
    queryFn: () => api.get<Paged<Project>>(`/projects/${qs({ stage, q: search, page_size: pageSize, page: page === 1 ? undefined : page })}`),
    placeholderData: keepPreviousData,
  });
  const stats = useQuery({ queryKey: ["projects", "stats"], queryFn: () => api.get<ListStats>("/projects/stats/") });

  const cards: StatItem[] | undefined = stats.data && (["all", "planned", "started", "pending_approval", "done"] as const).map((key) => ({
    key, label: T.projects.stats[key]![0], caption: T.projects.stats[key]![1],
    icon: STAT_ICONS[key]![0], tone: STAT_ICONS[key]![1], value: stats.data.totals[key] ?? 0, series: stats.data.series[key],
  }));
  const tabs: TabItem[] = [
    { key: "", label: T.common.all, icon: <Layers size={16} />, count: stats.data?.tabs.all },
    ...meta.options<ProjectStage>("project_stages").map((s) => ({ key: s.value, label: s.label, icon: TAB_ICONS[s.value] ?? <AlertTriangle size={16} />, count: stats.data?.tabs[s.value] })),
  ];

  return (
    <>
      <StatRow items={cards} />

      <section className="card list-panel">
        <div className="list-top list-top-last">
          <TabChips tabs={tabs} value={stage} onChange={(key) => { setStage(key as "" | ProjectStage); setPage(1); }} label={T.projects.stage} />
          <div className="list-search">
            <Search size={16} aria-hidden />
            <input className="input" placeholder={T.projects.searchPh} value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} aria-label={T.common.search} />
          </div>
          {manager && (
            <Button variant="primary" icon={<Plus />} onClick={() => open({ new: "project" })}>
              {T.projects.new}
            </Button>
          )}
        </div>
      </section>

      {query.error && <ErrorBox error={query.error} onRetry={() => query.refetch()} />}
      {query.isLoading && (
        <div className="project-grid">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} h={170} />
          ))}
        </div>
      )}
      {query.data && !query.data.results.length && (
        <div className="card">
          <Empty
            icon={<FolderKanban />}
            title={T.projects.empty}
            hint={manager ? T.projects.emptyHint : T.projects.emptyDev}
          />
        </div>
      )}
      <div className="project-grid">
        {query.data?.results.map((p) => {
          const pct = p.progress.total ? Math.round((p.progress.done / p.progress.total) * 100) : 0;
          return (
            <button key={p.id} className="card project-card clickable" onClick={() => open({ project: p.id })}>
              <div className="row">
                <StageBadge stage={p.stage} />
                {p.order_id && (
                  <Badge tone="slate" dot={false}>
                    {T.projects.fromOrder}
                  </Badge>
                )}
              </div>
              <h3>
                <CodeTag code={p.code} /> {p.name}
              </h3>
              <div className="stack-sm" style={{ gap: 4 }}>
                <div className="progress">
                  <span style={{ width: `${pct}%` }} />
                </div>
                <span className="small muted">{T.projects.progress(p.progress.done, p.progress.total)}</span>
              </div>
              <div className="row">
                <People users={p.members} />
                <span className="spacer" />
                <span className="row small muted" style={{ gap: 4 }}>
                  <CalendarDays size={14} /> {fmtDate(p.end_date)}
                </span>
              </div>
            </button>
          );
        })}
      </div>
      {query.data && (
        <div className="card">
          <Pagination
            data={query.isPlaceholderData ? undefined : query.data}
            page={page}
            onPageChange={setPage}
            pageSize={pageSize}
            onPageSizeChange={(size) => { setPageSize(size); setPage(1); }}
            unit={T.projects.found}
          />
        </div>
      )}
    </>
  );
}

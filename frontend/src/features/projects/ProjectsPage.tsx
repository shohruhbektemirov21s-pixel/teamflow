import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { CalendarDays, FolderKanban, Plus } from "lucide-react";
import { useState } from "react";

import { isManager, useMe } from "@/app/auth";
import { useModal } from "@/app/modals";
import { api, qs } from "@/shared/api";
import { fmtDate } from "@/shared/format";
import { useDebounced } from "@/shared/hooks";
import { useMeta } from "@/shared/meta";
import { T } from "@/shared/text";
import type { Paged, Project, ProjectStage } from "@/shared/types";
import { Badge, Button, CodeTag, Empty, ErrorBox, People, Skeleton, StageBadge } from "@/shared/ui";
import { Pagination } from "@/shared/ui/Pagination";

export default function ProjectsPage() {
  const me = useMe();
  const manager = isManager(me);
  const { open } = useModal();
  const meta = useMeta();
  const [stage, setStage] = useState<"" | ProjectStage>("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const search = useDebounced(q);
  const query = useQuery({
    queryKey: ["projects", stage, search, page],
    queryFn: () => api.get<Paged<Project>>(`/projects/${qs({ stage, q: search, page: page === 1 ? undefined : page })}`),
    placeholderData: keepPreviousData,
  });

  return (
    <>
      <div className="page-toolbar">
        <div className="chips">
          <button className="chip" aria-pressed={stage === ""} onClick={() => { setStage(""); setPage(1); }}>
            {T.common.all}
          </button>
          {meta.options<ProjectStage>("project_stages").map((s) => (
            <button key={s.value} className="chip" aria-pressed={stage === s.value} onClick={() => { setStage(s.value); setPage(1); }}>
              {s.label}
            </button>
          ))}
        </div>
        <span className="spacer" />
        <input className="input" style={{ maxWidth: 260 }} placeholder={T.common.search} value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} aria-label={T.common.search} />
        {manager && (
          <Button variant="primary" icon={<Plus />} onClick={() => open({ new: "project" })}>
            {T.projects.new}
          </Button>
        )}
      </div>
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
      <Pagination data={query.isPlaceholderData ? undefined : query.data} page={page} onPageChange={setPage} />
    </>
  );
}

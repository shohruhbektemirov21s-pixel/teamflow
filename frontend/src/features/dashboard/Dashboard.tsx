import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { AlertTriangle, ClipboardCheck, Clock, FileText, FolderKanban, Plus, Users } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";

import { isManager, useMe } from "@/app/auth";
import { useModal } from "@/app/modals";
import { EMPTY_FILTERS, filterParams, TaskFilters, type TaskFilterState, TaskTable } from "@/features/tasks/TaskTable";
import { api, qs } from "@/shared/api";
import { fmtDate } from "@/shared/format";
import { useDebounced } from "@/shared/hooks";
import { useMeta } from "@/shared/meta";
import { T } from "@/shared/text";
import type { Bucket, Dashboard as DashboardData, Paged, PeriodKey, Person, Task } from "@/shared/types";
import { Avatar, Badge, Button, Drawer, ErrorBox, Segmented, Skeleton } from "@/shared/ui";

interface Selection {
  bucket: Bucket;
  period?: PeriodKey;
  title: string;
}

const PERIOD_BUCKETS: { key: "active" | "overdue" | "done"; label: string }[] = [
  { key: "active", label: T.dashboard.active },
  { key: "overdue", label: T.dashboard.overdue },
  { key: "done", label: T.dashboard.done },
];

/** Bosh panel. PM/Boshliq — jamoa + hammaning vazifalari; dasturchi — faqat o'ziniki. */
export default function Dashboard() {
  const me = useMe();
  const manager = isManager(me);
  const { open } = useModal();
  const [selected, setSelected] = useState<Selection | null>(null);
  const dash = useQuery({ queryKey: ["dashboard"], queryFn: () => api.get<DashboardData>("/dashboard/") });
  const d = dash.data;

  const pick = (s: Selection) =>
    setSelected((cur) => (cur && cur.bucket === s.bucket && cur.period === s.period ? null : s));
  const isOn = (bucket: Bucket, period?: PeriodKey) => selected?.bucket === bucket && selected?.period === period;

  return (
    <>
      <div className="hero">
        <div className="grow">
          <h1>{T.dashboard.hello(me.first_name || me.full_name)}</h1>
          <p className="muted" style={{ marginTop: 4 }}>
            {d
              ? manager
                ? T.dashboard.managerSummary(d.totals.review, d.orders_pending ?? 0)
                : T.dashboard.devSummary(d.totals.active, d.totals.overdue)
              : T.common.loading}
          </p>
        </div>
        {manager ? (
          <>
            {(d?.orders_pending ?? 0) > 0 && (
              <Link to="/buyurtmalar" className="btn">
                <FileText /> {T.nav.orders}
                <span className="count-pill">{d?.orders_pending}</span>
              </Link>
            )}
            <Button icon={<FolderKanban />} onClick={() => open({ new: "project" })}>
              {T.projects.new}
            </Button>
            <Button variant="primary" icon={<Plus />} onClick={() => open({ new: "task" })}>
              {T.tasks.new}
            </Button>
          </>
        ) : (
          <Link to="/mening-ishim" className="btn btn-primary">
            {T.nav.myWork}
          </Link>
        )}
      </div>

      {manager && <TeamStrip boss={me.role === "boss"} />}

      {dash.error && <ErrorBox error={dash.error} onRetry={() => dash.refetch()} />}
      <div className="period-grid">
        {d
          ? d.periods.map((p) => (
              <div key={p.key} className="card period">
                <div className="period-title">
                  <h3>{p.label}</h3>
                  <span className="small muted">{T.dashboard.since(fmtDate(p.since))}</span>
                </div>
                <div className="period-nums">
                  {PERIOD_BUCKETS.map((b) => {
                    const n = p.counts[b.key];
                    return (
                      <button
                        key={b.key}
                        className="stat"
                        aria-pressed={isOn(b.key, p.key)}
                        onClick={() => pick({ bucket: b.key, period: p.key, title: T.dashboard.tableTitle(p.label, b.label) })}
                      >
                        <span className={`stat-num ${n ? "" : "zero"}`} style={b.key === "overdue" && n ? { color: "var(--danger)" } : undefined}>
                          {n}
                        </span>
                        <span className="stat-label">{b.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))
          : [0, 1, 2].map((i) => <Skeleton key={i} h={132} />)}
      </div>

      <div className="total-grid">
        {(
          [
            { bucket: "late", label: T.dashboard.late, icon: Clock, tone: "warning" },
            { bucket: "overdue", label: T.dashboard.overdue, icon: AlertTriangle, tone: "danger" },
            { bucket: "review", label: T.dashboard.review, icon: ClipboardCheck, tone: "violet" },
          ] as const
        ).map((c) => (
          <button key={c.bucket} className="card total clickable" aria-pressed={isOn(c.bucket)} onClick={() => pick({ bucket: c.bucket, title: c.label })}>
            <span className={`total-icon tone-${c.tone}`}>
              <c.icon />
            </span>
            <span className="grow">
              <span className="stat-label" style={{ display: "block" }}>
                {c.label}
              </span>
              <span className="stat-num">{d ? d.totals[c.bucket] : "…"}</span>
            </span>
          </button>
        ))}
      </div>

      {selected ? (
        <SelectedTasks selection={selected} onClose={() => setSelected(null)} manager={manager} mine={!manager} />
      ) : (
        <p className="muted" style={{ textAlign: "center" }}>
          {T.dashboard.pickCard}
        </p>
      )}
    </>
  );
}

function SelectedTasks({ selection, onClose, manager, mine }: { selection: Selection; onClose: () => void; manager: boolean; mine: boolean }) {
  const [filters, setFilters] = useState<TaskFilterState>(EMPTY_FILTERS);
  const debounced = useDebounced(filters);
  const query = useQuery({
    queryKey: ["tasks", "dashboard", selection.bucket, selection.period, debounced, mine],
    queryFn: () =>
      api.get<Paged<Task>>(`/tasks/${qs({ bucket: selection.bucket, period: selection.period, mine: mine ? 1 : undefined, ...filterParams(debounced) })}`),
    placeholderData: keepPreviousData,
  });
  return (
    <div className="card">
      <div className="card-head">
        <h3 className="grow">
          {selection.title} {query.data && <span className="count-pill soft">{query.data.count}</span>}
        </h3>
        <Button size="sm" onClick={onClose}>
          {T.common.close}
        </Button>
      </div>
      <TaskFilters value={filters} onChange={setFilters} showPerson={manager} showStatus={selection.bucket === "active" || selection.bucket === "overdue"} />
      {query.error ? (
        <div className="card-pad">
          <ErrorBox error={query.error} />
        </div>
      ) : (
        <TaskTable tasks={query.data?.results} loading={query.isLoading} />
      )}
    </div>
  );
}

/** Jamoa: kimda nechta vazifa, vazifasi yo'qlar birinchi. Boshliq — hamma xodimlar, rol bo'yicha. */
function TeamStrip({ boss }: { boss: boolean }) {
  const [role, setRole] = useState<string>(boss ? "" : "developer");
  const [person, setPerson] = useState<Person | null>(null);
  const meta = useMeta();
  const people = useQuery({ queryKey: ["people", role], queryFn: () => api.get<Person[]>(`/people/${qs({ role })}`) });

  return (
    <section className="stack">
      <div className="row-wrap">
        <Users size={18} className="muted" />
        <h2>{boss ? T.dashboard.everyone : T.dashboard.team}</h2>
        <span className="small muted">{T.dashboard.teamHint}</span>
        <span className="spacer" />
        {boss && (
          <Segmented
            value={role}
            onChange={setRole}
            options={[{ value: "", label: T.common.all }, ...meta.roles.filter((r) => r.value !== "boss")]}
          />
        )}
      </div>
      {people.error && <ErrorBox error={people.error} />}
      <div className="people">
        {people.isLoading && [0, 1, 2, 3].map((i) => <Skeleton key={i} h={130} />)}
        {people.data?.map((p) => (
          <button key={p.id} className="card person clickable" onClick={() => setPerson(p)}>
            <div className="row">
              <Avatar user={p} />
              <div className="grow" style={{ minWidth: 0 }}>
                <div className="ellipsis" style={{ fontWeight: 650 }}>
                  {p.full_name}
                </div>
                <div className="small muted ellipsis">{p.department_name || p.specialty || p.role_label}</div>
              </div>
            </div>
            {p.role === "developer" || p.active_tasks || p.done_tasks ? (
              <div className="person-nums">
                {p.active_tasks === 0 ? <Badge tone="success">{T.dashboard.free}</Badge> : <Badge tone="info">{T.dashboard.active}: {p.active_tasks}</Badge>}
                {p.overdue_tasks > 0 && <Badge tone="danger">{T.dashboard.overdue}: {p.overdue_tasks}</Badge>}
                {p.review_tasks > 0 && <Badge tone="violet">{meta.label("task_statuses", "in_review")}: {p.review_tasks}</Badge>}
              </div>
            ) : (
              <Badge tone="slate" dot={false}>
                {p.role_label}
              </Badge>
            )}
            <div className="small muted ellipsis">{p.doing[0] ? `▶ ${p.doing[0].title}` : T.dashboard.noDoing}</div>
          </button>
        ))}
      </div>
      {person && <PersonDrawer person={person} onClose={() => setPerson(null)} />}
    </section>
  );
}

function PersonDrawer({ person, onClose }: { person: Person; onClose: () => void }) {
  const { open } = useModal();
  const meta = useMeta();
  const tasks = useQuery({
    queryKey: ["tasks", "person", person.id],
    queryFn: () => api.get<Task[]>(`/tasks/${qs({ assignee: person.id, all: 1 })}`),
    enabled: person.role === "developer",
  });
  return (
    <Drawer
      title={
        <span className="row">
          <Avatar user={person} size="lg" />
          <span className="stack-sm" style={{ gap: 0 }}>
            <b style={{ fontSize: 16 }}>{person.full_name}</b>
            <span className="small muted">{person.department_name || person.specialty || person.role_label}</span>
          </span>
        </span>
      }
      onClose={onClose}
    >
      <div className="stack">
        <div className="grid-3">
          <div className="card card-pad" style={{ textAlign: "center" }}>
            <div className="stat-num">{person.active_tasks}</div>
            <div className="stat-label">{T.dashboard.active}</div>
          </div>
          <div className="card card-pad" style={{ textAlign: "center" }}>
            <div className="stat-num" style={{ color: person.overdue_tasks ? "var(--danger)" : undefined }}>
              {person.overdue_tasks}
            </div>
            <div className="stat-label">{T.dashboard.overdue}</div>
          </div>
          <div className="card card-pad" style={{ textAlign: "center" }}>
            <div className="stat-num">{person.done_tasks}</div>
            <div className="stat-label">{T.dashboard.done}</div>
          </div>
        </div>
        {person.role === "developer" && (
          <>
            <div className="section-title">{T.dashboard.personTasks}</div>
            {tasks.isLoading && <Skeleton h={80} />}
            {tasks.data && !tasks.data.length && <p className="muted">{T.tasks.empty}</p>}
            {tasks.data?.map((t) => (
              <button key={t.id} className="card card-pad clickable stack-sm" style={{ textAlign: "left", font: "inherit", color: "inherit" }} onClick={() => open({ task: t.id })}>
                <span className="row">
                  <b className="grow">{t.title}</b>
                  <Badge tone={t.status === "done" ? "success" : t.is_overdue ? "danger" : "info"}>{meta.label("task_statuses", t.status)}</Badge>
                </span>
                <span className="small muted">
                  {t.project.name} · {t.due_at ? fmtDate(t.due_at) : T.common.notSet}
                </span>
              </button>
            ))}
          </>
        )}
      </div>
    </Drawer>
  );
}

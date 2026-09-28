import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { AlertTriangle, CalendarDays, ClipboardCheck, Clock, FileText, FolderKanban, Plus, Users } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";

import { isManager, useMe } from "@/app/auth";
import { useModal } from "@/app/modals";
import { EMPTY_FILTERS, filterParams, TaskFilters, type TaskFilterState, TaskTable } from "@/features/tasks/TaskTable";
import { api, qs } from "@/shared/api";
import { fmtDate } from "@/shared/format";
import { useDebounced } from "@/shared/hooks";
import { T } from "@/shared/text";
import type { Bucket, Dashboard as DashboardData, Paged, PeriodKey, Task } from "@/shared/types";
import { Button, ErrorBox, Skeleton } from "@/shared/ui";

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

/** Bosh panel. Haftalik jami ishlar markaziy o'rinda; xodimlar esa /xodimlar sahifasiga o'tkazilgan. */
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

  const weekPeriod = d?.periods.find((p) => p.key === "week");
  const otherPeriods = d?.periods.filter((p) => p.key !== "week") ?? [];
  const weekTotal = weekPeriod ? weekPeriod.counts.active + weekPeriod.counts.done : 0;

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
            <Link to="/xodimlar" className="btn">
              <Users size={16} /> {T.nav.people}
            </Link>
            {(d?.orders_pending ?? 0) > 0 && (
              <Link to="/buyurtmalar" className="btn">
                <FileText size={16} /> {T.nav.orders}
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

      {dash.error && <ErrorBox error={dash.error} onRetry={() => dash.refetch()} />}

      {/* ─── Haftalik jami ishlar (Asosiy ko'rsatkich) ─── */}
      <section className="weekly-hero">
        <div className="row-wrap">
          <div className="grow">
            <div className="row" style={{ gap: 8 }}>
              <CalendarDays className="muted" size={20} />
              <h2>{T.dashboard.weeklyHeroTitle}</h2>
              {weekPeriod && (
                <span className="small muted">
                  ({fmtDate(weekPeriod.since)} — bugun)
                </span>
              )}
            </div>
            <p className="small muted" style={{ marginTop: 3 }}>
              {weekPeriod ? T.dashboard.weeklyHeroSubtitle(fmtDate(weekPeriod.since)) : T.common.loading}
            </p>
          </div>
          {weekPeriod && (
            <span className="badge tone-primary" style={{ fontSize: 13, height: 28, padding: "0 12px" }}>
              {T.dashboard.weeklyTotal(weekTotal)}
            </span>
          )}
        </div>

        <div className="weekly-grid">
          <button
            className="stat-card clickable"
            aria-pressed={isOn("active", "week")}
            onClick={() => pick({ bucket: "active", period: "week", title: "Haftalik faol vazifalar" })}
          >
            <span className="stat-label">{T.dashboard.active}</span>
            <span className="stat-num" style={{ color: "var(--primary)" }}>
              {weekPeriod ? weekPeriod.counts.active : "…"}
            </span>
            <span className="small muted">Hozir bajarilayotgan ishlar</span>
          </button>

          <button
            className="stat-card clickable"
            aria-pressed={isOn("overdue", "week")}
            onClick={() => pick({ bucket: "overdue", period: "week", title: "Haftalik muddati o'tgan vazifalar" })}
          >
            <span
              className="stat-label"
              style={{ color: (weekPeriod?.counts.overdue ?? 0) > 0 ? "var(--danger)" : undefined }}
            >
              {T.dashboard.overdue}
            </span>
            <span
              className="stat-num"
              style={{ color: (weekPeriod?.counts.overdue ?? 0) > 0 ? "var(--danger)" : undefined }}
            >
              {weekPeriod ? weekPeriod.counts.overdue : "…"}
            </span>
            <span className="small muted">Muddatidan kechikkan</span>
          </button>

          <button
            className="stat-card clickable"
            aria-pressed={isOn("done", "week")}
            onClick={() => pick({ bucket: "done", period: "week", title: "Haftalik bajarilgan vazifalar" })}
          >
            <span className="stat-label" style={{ color: "var(--success)" }}>
              {T.dashboard.done}
            </span>
            <span className="stat-num" style={{ color: "var(--success)" }}>
              {weekPeriod ? weekPeriod.counts.done : "…"}
            </span>
            <span className="small muted">Yakunlangan topshiriqlar</span>
          </button>
        </div>
      </section>

      {/* ─── Boshqa davrlar: Oy boshidan va Yil boshidan ─── */}
      <div className="grid-2">
        {d
          ? otherPeriods.map((p) => (
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
          : [0, 1].map((i) => <Skeleton key={i} h={132} />)}
      </div>

      {/* ─── Umumiy nazorat ko'rsatkichlari ─── */}
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

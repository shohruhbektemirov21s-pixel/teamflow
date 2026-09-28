import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { AlertTriangle, Clock, Hourglass, FileText, FolderKanban, Plus, Users, ChevronRight, ChevronDown } from "lucide-react";
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
  { key: "active", label: "Nazoratda" },
  { key: "overdue", label: "Muddati o'tgan" },
  { key: "done", label: "Bajarilganlar" },
];

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

  const getDropdownLabel = (key: string) => {
    if (key === "year") return new Date().getFullYear().toString();
    if (key === "month") return new Date().toLocaleString("uz-UZ", { month: "long" });
    if (key === "week") return "Bu hafta";
    return "";
  };

  return (
    <>
      <div className="hero">
        <div className="grow">
          <h1>{T.dashboard.hello(me.first_name || me.full_name)}</h1>
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

      <div className="grid-3" style={{ marginBottom: 24 }}>
        {d ? d.periods.map((p) => (
          <div key={p.key} className="card period" style={{ padding: "20px" }}>
            <div className="row" style={{ justifyContent: "space-between", marginBottom: 16 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>{p.label}</h3>
                <span className="small muted">{fmtDate(p.since)} — bugun</span>
              </div>
              <div className="badge" style={{ background: "var(--bg)", border: "1px solid var(--border)", color: "var(--text)" }}>
                {getDropdownLabel(p.key)} <ChevronDown size={14} style={{ marginLeft: 4 }} />
              </div>
            </div>
            <div className="period-nums" style={{ display: "flex", gap: 12 }}>
              {PERIOD_BUCKETS.map((b) => {
                const n = p.counts[b.key];
                return (
                  <button
                    key={b.key}
                    className="stat"
                    aria-pressed={isOn(b.key, p.key)}
                    onClick={() => pick({ bucket: b.key, period: p.key, title: `${p.label} — ${b.label}` })}
                    style={{ flex: 1, padding: "12px 8px", background: isOn(b.key, p.key) ? "var(--bg)" : "transparent" }}
                  >
                    <span className={`stat-num ${n ? "" : "zero"}`} style={{ fontSize: 24, marginBottom: 4, color: b.key === "overdue" && n ? "var(--danger)" : "var(--text)" }}>
                      {n}
                    </span>
                    <span className="stat-label" style={{ fontSize: 12, opacity: 0.8 }}>{b.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )) : [0, 1, 2].map((i) => <Skeleton key={i} h={140} />)}
      </div>

      <div className="grid-3" style={{ marginBottom: 24 }}>
        {(
          [
            { bucket: "late", label: "Muddati buzib bajarilgan", icon: Clock, tone: "danger" },
            { bucket: "overdue", label: "Muddati o'tgan", icon: AlertTriangle, tone: "danger" },
            { bucket: "review", label: "Kutilmoqda", icon: Hourglass, tone: "primary" },
          ] as const
        ).map((c) => (
          <button key={c.bucket} className="card total clickable" aria-pressed={isOn(c.bucket)} onClick={() => pick({ bucket: c.bucket, title: c.label })} style={{ padding: "16px 20px", display: "flex", alignItems: "center", gap: 16 }}>
            <span className={`total-icon tone-${c.tone}`} style={{ width: 40, height: 40 }}>
              <c.icon size={20} />
            </span>
            <span className="grow" style={{ textAlign: "left" }}>
              <span className="stat-label" style={{ display: "block", fontSize: 13, marginBottom: 2 }}>
                {c.label}
              </span>
              <span className="stat-num" style={{ fontSize: 20 }}>{d ? d.totals[c.bucket] : "—"}</span>
            </span>
            <ChevronRight size={18} className="muted" />
          </button>
        ))}
      </div>

      {selected && (
        <SelectedTasks selection={selected} onClose={() => setSelected(null)} manager={manager} mine={!manager} />
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
    <div className="card" style={{ marginTop: 24 }}>
      <div className="card-head">
        <h3 className="grow">
          {selection.title} {query.data && <span className="count-pill soft">{query.data.count}</span>}
        </h3>
        <Button size="sm" onClick={onClose}>
          Yopish
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

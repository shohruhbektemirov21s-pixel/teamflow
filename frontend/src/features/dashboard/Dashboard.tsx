import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { AlertTriangle, Clock, Hourglass, FileText, FolderKanban, Plus, Users, ChevronRight } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";

import { isManager, useMe } from "@/app/auth";
import { useModal } from "@/app/modals";
import { EMPTY_FILTERS, filterParams, TaskFilters, type TaskFilterState, TaskTable } from "@/features/tasks/TaskTable";
import { api, qs } from "@/shared/api";
import { useDebounced } from "@/shared/hooks";
import { T } from "@/shared/text";
import type { Bucket, Dashboard as DashboardData, Paged, PeriodKey, Task } from "@/shared/types";
import { Button, ErrorBox } from "@/shared/ui";

import { PeriodCards } from "./PeriodCards";

interface Selection {
  bucket: Bucket;
  period?: PeriodKey;
  title: string;
}

const PERIOD_BUCKETS: { key: "active" | "overdue" | "done"; label: string; alert?: boolean }[] = [
  { key: "active", label: T.dashboard.active },
  { key: "overdue", label: T.dashboard.overdue, alert: true },
  { key: "done", label: T.dashboard.done },
];

export default function Dashboard() {
  const me = useMe();
  const manager = isManager(me);
  const { open } = useModal();
  // Bosh panelga kirganda haftalik faol vazifalar jadvali darrov ochiq turadi (foydalanuvchi yopishi mumkin).
  const [selected, setSelected] = useState<Selection | null>({ bucket: "active", period: "week", title: T.dashboard.weekActive });
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

      <PeriodCards
        periods={d?.periods}
        buckets={PERIOD_BUCKETS}
        isOn={isOn}
        onPick={(bucket, period, title) => pick({ bucket, period, title })}
      />

      <div className="grid-3">
        {(
          [
            { bucket: "late", label: T.dashboard.late, icon: Clock, tone: "danger" },
            { bucket: "overdue", label: T.dashboard.overdue, icon: AlertTriangle, tone: "danger" },
            { bucket: "review", label: T.dashboard.review, icon: Hourglass, tone: "primary" },
          ] as const
        ).map((c) => (
          <button key={c.bucket} className="card total clickable" aria-pressed={isOn(c.bucket)} onClick={() => pick({ bucket: c.bucket, title: c.label })}>
            <span className={`total-icon tone-${c.tone}`}>
              <c.icon size={20} />
            </span>
            <span className="grow">
              <span className="stat-label">
                {c.label}
              </span>
              <span className="stat-num">{d ? d.totals[c.bucket] : "—"}</span>
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

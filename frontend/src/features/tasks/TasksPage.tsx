import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { AlertTriangle, BarChart3, CheckCircle2, CircleDot, Eye, Layers, ListChecks, Loader2, Plus, Search, ShieldCheck, User, UserCheck, X } from "lucide-react";
import { type ReactNode, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { isManager, useMe } from "@/app/auth";
import { useModal } from "@/app/modals";
import { api, qs } from "@/shared/api";
import { useDebounced } from "@/shared/hooks";
import { useMeta } from "@/shared/meta";
import { T } from "@/shared/text";
import type { ListStats, Paged, Task, TaskStatus } from "@/shared/types";
import { Button, ErrorBox, Field } from "@/shared/ui";
import { ClearFilters, DateRange, FilterSelect, SortSelect, StatRow, type StatItem, TabChips, type TabItem } from "@/shared/ui/ListKit";
import { Pagination } from "@/shared/ui/Pagination";

import { EMPTY_FILTERS, filterParams, type TaskFilterState, TaskTable } from "./TaskTable";

const STAT_ICONS: Record<string, [ReactNode, StatItem["tone"]]> = {
  all: [<ListChecks key="i" />, "primary"],
  in_progress: [<Loader2 key="i" />, "warning"],
  in_review: [<Eye key="i" />, "violet"],
  done: [<CheckCircle2 key="i" />, "success"],
  overdue: [<AlertTriangle key="i" />, "danger"],
};
const TAB_ICONS: Record<string, ReactNode> = {
  control: <ShieldCheck size={16} />,
  in_progress: <Loader2 size={16} />,
  in_review: <Eye size={16} />,
  done: <CheckCircle2 size={16} />,
};

export default function TasksPage() {
  const me = useMe();
  const meta = useMeta();
  const manager = isManager(me);
  const { open } = useModal();
  const [params, setParams] = useSearchParams();
  const [filters, setFilters] = useState<TaskFilterState>(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const debounced = useDebounced(filters);
  const assignee = params.get("assignee");
  const assigneeLabel = params.get("assignee_label");

  // Dasturchiga — faqat o'ziga biriktirilgan vazifalar (sub-vazifasi bor boshqa vazifalar ro'yxatda chiqmaydi)
  const mine = manager ? undefined : 1;
  const query = useQuery({
    queryKey: ["tasks", "list", debounced, assignee, mine, page, pageSize],
    queryFn: () => api.get<Paged<Task>>(`/tasks/${qs({ ...filterParams(debounced), assignee, mine, page_size: pageSize, page: page === 1 ? undefined : page })}`),
    placeholderData: keepPreviousData,
  });
  const stats = useQuery({ queryKey: ["tasks", "stats"], queryFn: () => api.get<ListStats>("/tasks/stats/") });

  const change = (patch: Partial<TaskFilterState>) => {
    setFilters((prev) => ({ ...prev, ...patch }));
    setPage(1);
  };
  const clearAssignee = () => {
    const next = new URLSearchParams(params);
    next.delete("assignee");
    next.delete("assignee_label");
    setParams(next);
    setPage(1);
  };

  const cards: StatItem[] | undefined = stats.data && (["all", "in_progress", "in_review", "done", "overdue"] as const).map((key) => ({
    key, label: T.tasks.stats[key]![0], caption: T.tasks.stats[key]![1],
    icon: STAT_ICONS[key]![0], tone: STAT_ICONS[key]![1], value: stats.data.totals[key] ?? 0, series: stats.data.series[key],
  }));
  const tabs: TabItem[] = [
    { key: "", label: T.common.all, icon: <Layers size={16} />, count: stats.data?.tabs.all },
    ...meta.task_statuses.map((s) => ({ key: s.value, label: s.label, icon: TAB_ICONS[s.value as TaskStatus] ?? <CircleDot size={16} />, count: stats.data?.tabs[s.value] })),
  ];
  const dirty = JSON.stringify(filters) !== JSON.stringify(EMPTY_FILTERS);

  return (
    <>
      <StatRow items={cards} />

      {assignee && (
        <div className="page-toolbar">
          <span className="chip" aria-pressed="true">
            {assigneeLabel}
            <button className="icon-btn" style={{ width: 20, height: 20, color: "inherit" }} onClick={clearAssignee} aria-label={T.common.clear}>
              <X size={14} />
            </button>
          </span>
        </div>
      )}

      <section className="card list-panel">
        <div className="list-top">
          <TabChips tabs={tabs} value={filters.status} onChange={(status) => change({ status })} label={T.filters.status} />
          <div className="list-search">
            <Search size={16} aria-hidden />
            <input className="input" placeholder={T.tasks.searchPh} value={filters.q} onChange={(e) => change({ q: e.target.value })} aria-label={T.filters.search} />
          </div>
        </div>

        <div className="list-filters">
          <FilterSelect label={T.list.priority} icon={<BarChart3 />} value={filters.priority} onChange={(priority) => change({ priority })}>
            <option value="">{T.list.allPriorities}</option>
            {meta.options("priorities").map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          </FilterSelect>
          {manager && (
            <Field label={T.filters.person}>
              {(id) => (
                <div className="select-icon">
                  <User />
                  <input id={id} className="input" placeholder={T.filters.personPh} value={filters.assignee_name} onChange={(e) => change({ assignee_name: e.target.value })} />
                </div>
              )}
            </Field>
          )}
          <DateRange label={T.list.dueRange} from={filters.date_from} to={filters.date_to} onFrom={(date_from) => change({ date_from })} onTo={(date_to) => change({ date_to })} />
          <ClearFilters active={dirty} onClick={() => { setFilters(EMPTY_FILTERS); setPage(1); }} />
          <div className="filters-actions">
            <button type="button" className="chip" aria-pressed={!!filters.overdue} onClick={() => change({ overdue: filters.overdue ? "" : "1" })}>
              <AlertTriangle size={14} /> {T.filters.onlyOverdue}
            </button>
            <button type="button" className="chip" aria-pressed={!!filters.created} onClick={() => change({ created: filters.created ? "" : "me" })}>
              <UserCheck size={14} /> {T.filters.createdByMe}
            </button>
            <SortSelect value={filters.sort} onChange={(sort) => change({ sort })} options={T.filters.taskSorts} />
            <Button variant="primary" icon={<Plus />} onClick={() => open({ new: "task" })}>
              {T.tasks.new}
            </Button>
          </div>
        </div>

        {query.error ? (
          <div className="card-pad">
            <ErrorBox error={query.error} onRetry={() => query.refetch()} />
          </div>
        ) : (
          <TaskTable tasks={query.data?.results} loading={query.isLoading} showProject sort={filters.sort} onSort={(sort) => change({ sort })} />
        )}
        <Pagination
          data={query.isPlaceholderData ? undefined : query.data}
          page={page}
          onPageChange={setPage}
          pageSize={pageSize}
          onPageSizeChange={(size) => { setPageSize(size); setPage(1); }}
          unit={T.tasks.found}
        />
      </section>
    </>
  );
}

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { BarChart3, Building2, CheckCircle2, Clock, FileText, Flame, Layers, Plus, Search, ShieldCheck, ShieldX, Sparkles } from "lucide-react";
import { type ReactNode, useState } from "react";

import { useMe } from "@/app/auth";
import { useModal } from "@/app/modals";
import { api, qs } from "@/shared/api";
import { useDebounced } from "@/shared/hooks";
import { useMeta } from "@/shared/meta";
import { T } from "@/shared/text";
import type { ListStats, Order, Paged, ProjectStage } from "@/shared/types";
import { Button, Empty, ErrorBox, SkeletonRows } from "@/shared/ui";
import { ClearFilters, DateRange, FilterSelect, SortSelect, StatRow, type StatItem, TabChips, type TabItem } from "@/shared/ui/ListKit";
import { Pagination } from "@/shared/ui/Pagination";

import { OrdersTable } from "./OrdersTable";

/** Holat tanlovi: bo'sh — hammasi; "status:…" — buyurtma holati; "stage:…" — buyurtmadan yaratilgan loyiha darajasi. */
const HOLAT = {
  all: "",
  submitted: "status:submitted",
  approved: "status:approved,project_created",
  rejected: "status:rejected",
  done: "stage:done",
} as const;

const holatParams = (holat: string) => {
  const i = holat.indexOf(":");
  return i < 0 ? {} : { [holat.slice(0, i)]: holat.slice(i + 1) };
};

interface Filters {
  holat: string;
  priority: string;
  department: string;
  sentFrom: string;
  sentTo: string;
  sort: string;
  dueSoon: boolean;
}
const EMPTY: Filters = { holat: "", priority: "", department: "", sentFrom: "", sentTo: "", sort: "", dueSoon: false };

const STAT_ICONS: Record<string, [ReactNode, StatItem["tone"]]> = {
  all: [<FileText key="i" />, "primary"],
  submitted: [<Sparkles key="i" />, "info"],
  planned: [<Clock key="i" />, "slate"],
  done: [<CheckCircle2 key="i" />, "success"],
  urgent: [<Flame key="i" />, "danger"],
};

export default function OrdersPage() {
  const me = useMe();
  const dept = me.role === "department";
  const meta = useMeta();
  const { open } = useModal();
  const [f, setF] = useState<Filters>(EMPTY);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const search = useDebounced(q);
  const change = (patch: Partial<Filters>) => {
    setF((prev) => ({ ...prev, ...patch }));
    setPage(1);
  };

  const query = useQuery({
    queryKey: ["orders", f, search, page, pageSize],
    queryFn: () =>
      api.get<Paged<Order>>(`/orders/${qs({
        ...holatParams(f.holat), priority: f.priority, department: f.department, sent_from: f.sentFrom, sent_to: f.sentTo,
        sort: f.sort, due_soon: f.dueSoon ? 1 : undefined, q: search, page_size: pageSize, page: page === 1 ? undefined : page,
      })}`),
    placeholderData: keepPreviousData,
  });
  const stats = useQuery({ queryKey: ["orders", "stats"], queryFn: () => api.get<ListStats>("/orders/stats/") });

  const cards: StatItem[] | undefined = stats.data && (["all", "submitted", "planned", "done", "urgent"] as const).map((key) => ({
    key, label: T.orders.stats[key]![0], caption: T.orders.stats[key]![1],
    icon: STAT_ICONS[key]![0], tone: STAT_ICONS[key]![1], value: stats.data.totals[key] ?? 0, series: stats.data.series[key],
  }));
  const tabs: TabItem[] = [
    { key: HOLAT.all, label: T.common.all, icon: <Layers size={16} />, count: stats.data?.tabs.all },
    { key: HOLAT.submitted, label: T.orders.tabs.submitted!, icon: <Sparkles size={16} />, count: stats.data?.tabs.submitted },
    { key: HOLAT.approved, label: T.orders.tabs.approved!, icon: <ShieldCheck size={16} />, count: stats.data?.tabs.approved },
    { key: HOLAT.rejected, label: T.orders.tabs.rejected!, icon: <ShieldX size={16} />, count: stats.data?.tabs.rejected },
    { key: HOLAT.done, label: meta.label("project_stages", "done"), icon: <CheckCircle2 size={16} />, count: stats.data?.tabs.done },
  ];
  const dirty = JSON.stringify(f) !== JSON.stringify(EMPTY) || q !== "";
  const stages = meta.options<ProjectStage>("project_stages");

  return (
    <>
      <StatRow items={cards} />

      <section className="card list-panel">
        <div className="list-top">
          <TabChips tabs={tabs} value={f.holat} onChange={(holat) => change({ holat })} label={T.filters.status} />
          <div className="list-search">
            <Search size={16} aria-hidden />
            <input className="input" placeholder={T.orders.searchPh} value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} aria-label={T.common.search} />
          </div>
        </div>

        <div className="list-filters">
          <FilterSelect label={T.filters.status} icon={<ShieldCheck />} value={f.holat} onChange={(holat) => change({ holat })}>
            <option value="">{T.list.allStatuses}</option>
            <optgroup label={T.list.groupOrder}>
              <option value={HOLAT.submitted}>{meta.label("order_statuses", "submitted")}</option>
              <option value={HOLAT.approved}>{meta.label("order_statuses", "approved")}</option>
              <option value={HOLAT.rejected}>{meta.label("order_statuses", "rejected")}</option>
            </optgroup>
            <optgroup label={T.list.groupProject}>
              {stages.map((s) => <option key={s.value} value={`stage:${s.value}`}>{s.label}</option>)}
            </optgroup>
          </FilterSelect>
          <FilterSelect label={T.list.priority} icon={<BarChart3 />} value={f.priority} onChange={(priority) => change({ priority })}>
            <option value="">{T.list.allPriorities}</option>
            {meta.options("priorities").map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          </FilterSelect>
          {!dept && (
            <FilterSelect label={T.list.department} icon={<Building2 />} value={f.department} onChange={(department) => change({ department })}>
              <option value="">{T.list.allDepartments}</option>
              {stats.data?.departments?.map((d) => <option key={d} value={d}>{d}</option>)}
            </FilterSelect>
          )}
          <DateRange label={T.list.sentRange} from={f.sentFrom} to={f.sentTo} onFrom={(sentFrom) => change({ sentFrom })} onTo={(sentTo) => change({ sentTo })} />
          <ClearFilters active={dirty} onClick={() => { setF(EMPTY); setQ(""); setPage(1); }} />
          <div className="filters-actions">
            <button type="button" className="chip" aria-pressed={f.dueSoon} onClick={() => change({ dueSoon: !f.dueSoon })}>
              <Clock size={14} /> {T.filters.dueSoon}
            </button>
            <SortSelect value={f.sort} onChange={(sort) => change({ sort })} options={T.filters.orderSorts} />
            {dept && (
              <Button variant="primary" icon={<Plus />} onClick={() => open({ new: "order" })}>
                {T.orders.new}
              </Button>
            )}
          </div>
        </div>

        {query.error && (
          <div className="card-pad">
            <ErrorBox error={query.error} onRetry={() => query.refetch()} />
          </div>
        )}
        {query.isLoading && <SkeletonRows />}
        {query.data && !query.data.results.length && (
          <Empty icon={<FileText />} title={T.orders.empty} hint={dept ? T.orders.emptyDept : T.orders.emptyManager} />
        )}
        {query.data && query.data.results.length > 0 && (
          <OrdersTable orders={query.data.results} showDepartment={!dept} rich sort={f.sort} onSort={(sort) => change({ sort })} />
        )}
        <Pagination
          data={query.isPlaceholderData ? undefined : query.data}
          page={page}
          onPageChange={setPage}
          pageSize={pageSize}
          onPageSizeChange={(size) => { setPageSize(size); setPage(1); }}
          unit={T.orders.found}
        />
      </section>
    </>
  );
}

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { FileText, Plus } from "lucide-react";
import { useState } from "react";

import { useMe } from "@/app/auth";
import { useModal } from "@/app/modals";
import { api, qs } from "@/shared/api";
import { fmtDate } from "@/shared/format";
import { useDebounced } from "@/shared/hooks";
import { useMeta } from "@/shared/meta";
import { T } from "@/shared/text";
import type { DepartmentDashboard, Order, OrderStatus, Paged } from "@/shared/types";
import { Button, Empty, ErrorBox, OrderStatusBadge, PriorityBadge, SkeletonRows } from "@/shared/ui";

const TABS: ("" | OrderStatus)[] = ["submitted", "approved", "rejected", "project_created", ""];

export default function OrdersPage() {
  const me = useMe();
  const dept = me.role === "department";
  const { open } = useModal();
  const meta = useMeta();
  const [status, setStatus] = useState<"" | OrderStatus>(dept ? "" : "submitted");
  const [q, setQ] = useState("");
  const search = useDebounced(q);

  const query = useQuery({
    queryKey: ["orders", status, search],
    queryFn: () => api.get<Paged<Order>>(`/orders/${qs({ status, q: search })}`),
    placeholderData: keepPreviousData,
  });
  const summary = useQuery({
    queryKey: ["dashboard", "department"],
    queryFn: () => api.get<DepartmentDashboard>("/dashboard/"),
    enabled: dept,
  });

  return (
    <>
      <div className="page-head">
        <div className="grow">
          <h1>{dept ? T.orders.myTitle : T.orders.title}</h1>
          {dept && me.department_name && <p>{me.department_name}</p>}
        </div>
        {dept && (
          <Button variant="primary" size="lg" icon={<Plus />} onClick={() => open({ new: "order" })}>
            {T.orders.new}
          </Button>
        )}
      </div>

      {dept && summary.data && (
        <div className="total-grid">
          {(
            [
              ["submitted", summary.data.orders.submitted, "info"],
              ["rejected", summary.data.orders.rejected, "danger"],
              ["approved", summary.data.orders.approved, "success"],
            ] as const
          ).map(([key, n, tone]) => (
            <button key={key} className="card total clickable" aria-pressed={status === key} onClick={() => setStatus(status === key ? "" : key)}>
              <span className={`total-icon tone-${tone}`}>
                <FileText />
              </span>
              <span>
                <span className="stat-label" style={{ display: "block" }}>
                  {meta.label("order_statuses", key)}
                </span>
                <span className="stat-num">{n}</span>
              </span>
            </button>
          ))}
        </div>
      )}

      <div className="card">
        <div className="card-toolbar">
          {!dept && (
            <div className="chips">
              {TABS.map((s) => (
                <button key={s || "all"} className="chip" aria-pressed={status === s} onClick={() => setStatus(s)}>
                  {s ? T.orders.tabs[s] : T.common.all}
                </button>
              ))}
            </div>
          )}
          <span className="spacer" />
          <input className="input" style={{ maxWidth: 280 }} placeholder={T.common.search} value={q} onChange={(e) => setQ(e.target.value)} aria-label={T.common.search} />
        </div>
        {query.error && (
          <div className="card-pad">
            <ErrorBox error={query.error} onRetry={() => query.refetch()} />
          </div>
        )}
        {query.isLoading && <SkeletonRows />}
        {query.data && !query.data.results.length && (
          <Empty
            icon={<FileText />}
            title={T.orders.empty}
            hint={dept ? T.orders.emptyDept : T.orders.emptyManager}
            action={
              dept && (
                <Button variant="primary" icon={<Plus />} onClick={() => open({ new: "order" })}>
                  {T.orders.new}
                </Button>
              )
            }
          />
        )}
        {query.data && query.data.results.length > 0 && (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>{T.orders.name}</th>
                  {!dept && <th>{T.orders.department}</th>}
                  <th>{T.filters.status}</th>
                  <th>{T.orders.priority}</th>
                  <th>{T.orders.requestedDue}</th>
                  <th>{T.orders.sentAt}</th>
                </tr>
              </thead>
              <tbody>
                {query.data.results.map((o) => (
                  <tr key={o.id} tabIndex={0} onClick={() => open({ order: o.id })} onKeyDown={(e) => e.key === "Enter" && open({ order: o.id })}>
                    <td style={{ minWidth: 240 }}>
                      <div className="task-title">
                        {o.title} {o.version && o.version > 1 && <span className="badge tone-slate">{T.orders.version(o.version)}</span>}
                      </div>
                      {o.description && <div className="small muted ellipsis" style={{ maxWidth: 420 }}>{o.description}</div>}
                    </td>
                    {!dept && (
                      <td>
                        <div style={{ fontWeight: 600 }}>{o.submitted_by.department_name}</div>
                        <div className="small muted">{o.submitted_by.full_name}</div>
                      </td>
                    )}
                    <td>
                      <OrderStatusBadge status={o.status} />
                    </td>
                    <td>
                      <PriorityBadge priority={o.priority} />
                    </td>
                    <td className="nowrap">{fmtDate(o.requested_due_date)}</td>
                    <td className="nowrap muted">{fmtDate(o.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

import { FileText } from "lucide-react";

import { useModal } from "@/app/modals";
import { fmtDate } from "@/shared/format";
import { useMeta } from "@/shared/meta";
import type { Tone } from "@/shared/status";
import { T } from "@/shared/text";
import type { DepartmentDashboard, Order, OrderStatus } from "@/shared/types";
import { OrderStatusBadge, PriorityBadge, StageBadge } from "@/shared/ui";

/**
 * Boshqarma holat kartalari (bosh panel va "Buyurtmalarim" — bir xil). Bosilsa ro'yxat `/orders/?status=` bo'yicha filtrlanadi.
 * "Tasdiqlangan" soni serverda loyihaga aylanganlarni ham o'z ichiga oladi — filtr ham shunday.
 */
export function OrderStatusCards({ counts, value, onChange }: { counts: DepartmentDashboard["orders"]; value: string; onChange: (filter: string) => void }) {
  const meta = useMeta();
  const cards: [OrderStatus, string, number, Tone][] = [
    ["submitted", "submitted", counts.submitted, "info"],
    ["rejected", "rejected", counts.rejected, "danger"],
    ["approved", "approved,project_created", counts.approved, "success"],
  ];
  return (
    <div className="total-grid">
      {cards.map(([key, filter, n, tone]) => (
        <button key={key} className="card total clickable" aria-pressed={value === filter} onClick={() => onChange(value === filter ? "" : filter)}>
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
  );
}

/** Buyurtmalar jadvali. `showDepartment` — menejer uchun (boshqarma o'zinikini ko'radi, ustun kerak emas). */
export function OrdersTable({ orders, showDepartment }: { orders: Order[]; showDepartment: boolean }) {
  const { open } = useModal();
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th>{T.orders.name}</th>
            {showDepartment && <th className="hide-sm">{T.orders.department}</th>}
            <th className="hide-sm">{T.filters.status}</th>
            <th className="hide-sm">{T.orders.priority}</th>
            <th className="hide-sm">{T.orders.requestedDue}</th>
            <th className="hide-sm">{T.orders.sentAt}</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => (
            <tr key={o.id} tabIndex={0} onClick={() => open({ order: o.id })} onKeyDown={(e) => e.key === "Enter" && open({ order: o.id })}>
              <td style={{ minWidth: 240 }}>
                <div className="task-title">
                  {o.title} {o.version && o.version > 1 && <span className="badge tone-slate">{T.orders.version(o.version)}</span>}
                </div>
                <div className="row-wrap show-sm" style={{ marginTop: 8 }}>
                  {o.status === "project_created" && o.project ? <StageBadge stage={o.project.stage} /> : <OrderStatusBadge status={o.status} />}
                  <PriorityBadge priority={o.priority} />
                  <span className="small muted">{T.orders.requestedDue}: {fmtDate(o.requested_due_date)}</span>
                </div>
                {showDepartment && <div className="small muted show-sm" style={{ marginTop: 6 }}>{o.submitted_by.department_name}</div>}
              </td>
              {showDepartment && (
                <td className="hide-sm">
                  <div style={{ fontWeight: 600 }}>{o.submitted_by.department_name}</div>
                  <div className="small muted">{o.submitted_by.full_name}</div>
                </td>
              )}
              <td className="hide-sm">
                {o.status === "project_created" && o.project ? (
                  <StageBadge stage={o.project.stage} />
                ) : (
                  <OrderStatusBadge status={o.status} />
                )}
              </td>
              <td className="hide-sm">
                <PriorityBadge priority={o.priority} />
              </td>
              <td className="nowrap hide-sm">{fmtDate(o.requested_due_date)}</td>
              <td className="nowrap muted hide-sm">{fmtDate(o.created_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

import { FileText } from "lucide-react";

import { useModal } from "@/app/modals";
import { fmtDate } from "@/shared/format";
import { useMeta } from "@/shared/meta";
import type { Tone } from "@/shared/status";
import { T } from "@/shared/text";
import type { DepartmentDashboard, Order, OrderStatus } from "@/shared/types";
import { OrderStatusBadge, PriorityBadge } from "@/shared/ui";

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
            {showDepartment && <th>{T.orders.department}</th>}
            <th>{T.filters.status}</th>
            <th>{T.orders.priority}</th>
            <th>{T.orders.requestedDue}</th>
            <th>{T.orders.sentAt}</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => (
            <tr key={o.id} tabIndex={0} onClick={() => open({ order: o.id })} onKeyDown={(e) => e.key === "Enter" && open({ order: o.id })}>
              <td style={{ minWidth: 240 }}>
                <div className="task-title">
                  {o.title} {o.version && o.version > 1 && <span className="badge tone-slate">{T.orders.version(o.version)}</span>}
                </div>
                {o.description && <div className="small muted ellipsis" style={{ maxWidth: 420 }}>{o.description}</div>}
              </td>
              {showDepartment && (
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
  );
}

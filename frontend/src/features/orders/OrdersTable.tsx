import { FileText } from "lucide-react";

import { useModal } from "@/app/modals";
import { fmtDate } from "@/shared/format";
import type { Tone } from "@/shared/status";
import { T } from "@/shared/text";
import type { Order, OrderStatus } from "@/shared/types";
import { Avatar, Due, OrderStatusBadge, PriorityBadge, SortHeader, StageBadge } from "@/shared/ui";

/** Buyurtma ikonkasi rangi holatga mos: yangi — ko'k, tasdiqlangan — yashil, rad etilgan — qizil, loyiha — asosiy. */
const ICON_TONE: Record<OrderStatus, Tone> = { submitted: "info", approved: "success", rejected: "danger", project_created: "primary" };

/** Rad etilgan yoki loyihasi yakunlangan buyurtmada "kechikdi" ko'rsatilmaydi. */
const isClosed = (o: Order) => o.status === "rejected" || o.project?.stage === "done";

/** Buyurtmalar jadvali. `showDepartment` — menejer uchun (boshqarma o'zinikini ko'radi, kim yuborgani kerak emas). */
export function OrdersTable({ orders, showDepartment, rich = false, sort, onSort }: {
  orders: Order[]; showDepartment: boolean;
  /** Buyurtmalar sahifasi ko'rinishi (ikonka, boshqarma avatari, muddat matni, muhimlik ikonkasi). Bosh panelda — oddiy jadval. */
  rich?: boolean;
  /** Ikkalasi ham berilsa, "Muhimlik", "Muddat" va "Yuborilgan" sarlavhalari bosilib saralanadi. */
  sort?: string; onSort?: (s: string) => void;
}) {
  const { open } = useModal();
  const statusBadge = (o: Order) =>
    o.status === "project_created" && o.project ? <StageBadge stage={o.project.stage} /> : <OrderStatusBadge status={o.status} />;
  const head = (label: string, first: string, second: string) =>
    onSort ? <SortHeader className="hide-sm" label={label} first={first} second={second} sort={sort ?? ""} onSort={onSort} /> : <th className="hide-sm">{label}</th>;
  return (
    <div className="table-wrap">
      <table className="table orders-table">
        <thead>
          <tr>
            <th>{T.orders.name}</th>
            {showDepartment && <th className="hide-sm">{T.orders.department}</th>}
            <th className="hide-sm">{T.filters.status}</th>
            {head(T.orders.priority, "-priority", "priority")}
            {head(T.orders.requestedDue, "due", "-due")}
            {head(T.orders.sentAt, "-created", "created")}
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => (
            <tr key={o.id} tabIndex={0} onClick={() => open({ order: o.id })} onKeyDown={(e) => e.key === "Enter" && open({ order: o.id })}>
              <td style={{ minWidth: 240 }}>
                <div className={rich ? "order-cell" : undefined}>
                  {rich && (
                    <span className={`order-icon tone-${ICON_TONE[o.status]}`}>
                      <FileText />
                    </span>
                  )}
                  <div className={rich ? "order-main" : undefined}>
                    <div className="task-title">
                      {o.title} {o.version && o.version > 1 && <span className="badge tone-slate">{T.orders.version(o.version)}</span>}
                    </div>
                    {showDepartment && <div className="small muted show-sm">{o.submitted_by.department_name}</div>}
                    <div className="row-wrap show-sm" style={{ marginTop: 8 }}>
                      {statusBadge(o)}
                      <PriorityBadge priority={o.priority} icon={rich} />
                      <span className="small muted">{T.orders.requestedDue}: {fmtDate(o.requested_due_date)}</span>
                    </div>
                  </div>
                </div>
              </td>
              {showDepartment && (
                <td className="hide-sm">
                  {rich ? (
                    <div className="order-dept">
                      <Avatar user={o.submitted_by} size="sm" card={false} />
                      <div style={{ minWidth: 0 }}>
                        <div className="order-dept-name">{o.submitted_by.department_name || o.submitted_by.full_name}</div>
                        {o.submitted_by.department_name && <div className="small muted">{o.submitted_by.full_name}</div>}
                      </div>
                    </div>
                  ) : (
                    <>
                      <div style={{ fontWeight: 600 }}>{o.submitted_by.department_name}</div>
                      <div className="small muted">{o.submitted_by.full_name}</div>
                    </>
                  )}
                </td>
              )}
              <td className="hide-sm">{statusBadge(o)}</td>
              <td className="hide-sm">
                <PriorityBadge priority={o.priority} icon={rich} />
              </td>
              <td className={rich ? "hide-sm" : "nowrap hide-sm"}>
                {rich ? <Due value={o.requested_due_date} done={isClosed(o)} format={fmtDate} /> : fmtDate(o.requested_due_date)}
              </td>
              <td className="nowrap muted hide-sm">{fmtDate(o.created_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

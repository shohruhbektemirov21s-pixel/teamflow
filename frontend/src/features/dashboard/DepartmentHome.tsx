import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { FileText, Plus } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";

import { useMe } from "@/app/auth";
import { useModal } from "@/app/modals";
import { OrdersTable, OrderStatusCards } from "@/features/orders/OrdersTable";
import { api, qs } from "@/shared/api";
import { useMeta } from "@/shared/meta";
import { T } from "@/shared/text";
import type { DepartmentDashboard, Order, OrderBucket, Paged, PeriodKey } from "@/shared/types";
import { Button, Empty, ErrorBox, Skeleton, SkeletonRows } from "@/shared/ui";

import { PeriodCards } from "./PeriodCards";

const PERIOD_BUCKETS: { key: OrderBucket; label: string; alert?: boolean }[] = [
  { key: "sent", label: T.dashboard.deptSent },
  { key: "rejected", label: T.dashboard.deptRejected, alert: true },
  { key: "approved", label: T.dashboard.deptApproved },
];

/** Ro'yxat filtri: davr kartasi (`period` + `bucket`) yoki holat kartasi (`status`). */
interface Selection {
  params: { status?: string; period?: PeriodKey; bucket?: OrderBucket };
  title: string;
}

/**
 * Boshqarma bosh paneli: yil/oy/hafta boshidan kartalari (boshqa bosh panellar bilan bir xil), buyurtmalar holati
 * va o'z buyurtmalari ro'yxati (server faqat o'zinikini beradi). Karta bosilsa ro'yxat filtrlanadi.
 */
export default function DepartmentHome() {
  const me = useMe();
  const { open } = useModal();
  const meta = useMeta();
  const [selected, setSelected] = useState<Selection | null>(null);
  const status = selected?.params.status ?? "";
  const toggle = (next: Selection) =>
    setSelected((cur) => (cur && JSON.stringify(cur.params) === JSON.stringify(next.params) ? null : next));
  const summary = useQuery({
    queryKey: ["dashboard", "department"],
    queryFn: () => api.get<DepartmentDashboard>("/dashboard/"),
  });
  const orders = useQuery({
    queryKey: ["orders", "department-home", selected?.params],
    queryFn: () => api.get<Paged<Order>>(`/orders/${qs({ ...selected?.params })}`),
    placeholderData: keepPreviousData,
  });
  const newOrder = () => open({ new: "order" });

  return (
    <>
      <div className="hero">
        <div className="grow">
          <h1>{T.dashboard.hello(me.first_name || me.full_name)}</h1>
          {me.department_name && <p className="muted">{me.department_name}</p>}
        </div>
        <Link to="/buyurtmalar" className="btn">
          <FileText size={16} /> {T.nav.myOrders}
        </Link>
        <Button variant="primary" icon={<Plus />} onClick={newOrder}>
          {T.orders.new}
        </Button>
      </div>

      {summary.error && <ErrorBox error={summary.error} onRetry={() => summary.refetch()} />}

      <PeriodCards
        periods={summary.data?.periods}
        buckets={PERIOD_BUCKETS}
        isOn={(bucket, period) => selected?.params.bucket === bucket && selected.params.period === period}
        onPick={(bucket, period, title) => toggle({ params: { period, bucket }, title })}
      />

      <h2 className="section-title">
        {T.dashboard.departmentTitle}
      </h2>
      {summary.data ? (
        <OrderStatusCards
          counts={summary.data.orders}
          value={status}
          onChange={(filter) => setSelected(filter ? { params: { status: filter }, title: meta.label("order_statuses", filter.split(",")[0]!) } : null)}
        />
      ) : (
        <div className="grid-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} h={84} />
          ))}
        </div>
      )}

      <section className="card" style={{ marginTop: 24 }} aria-label={T.dashboard.deptOrders}>
        <div className="card-head">
          <h3 className="grow">
            {selected ? selected.title : T.dashboard.deptOrders} {orders.data && <span className="count-pill soft">{orders.data.count}</span>}
          </h3>
          {selected && (
            <Button size="sm" variant="ghost" onClick={() => setSelected(null)}>
              {T.filters.clear}
            </Button>
          )}
        </div>
        {orders.error ? (
          <div className="card-pad">
            <ErrorBox error={orders.error} onRetry={() => orders.refetch()} />
          </div>
        ) : orders.isLoading ? (
          <SkeletonRows />
        ) : !orders.data?.results.length ? (
          <Empty
            icon={<FileText />}
            title={T.orders.empty}
            hint={T.orders.emptyDept}
            action={
              <Button variant="primary" icon={<Plus />} onClick={newOrder}>
                {T.orders.new}
              </Button>
            }
          />
        ) : (
          <OrdersTable orders={orders.data.results} showDepartment={false} />
        )}
      </section>
    </>
  );
}

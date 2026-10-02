import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { FileText, Plus } from "lucide-react";
import { useState } from "react";

import { useMe } from "@/app/auth";
import { useModal } from "@/app/modals";
import { api, qs } from "@/shared/api";
import { useDebounced } from "@/shared/hooks";
import { T } from "@/shared/text";
import type { DepartmentDashboard, Order, OrderStatus, Paged } from "@/shared/types";
import { Button, Empty, ErrorBox, SkeletonRows } from "@/shared/ui";

import { OrdersTable, OrderStatusCards } from "./OrdersTable";

// "Hammasi" birinchi va standart tanlov (foydalanuvchi talabi)
const TABS: ("" | OrderStatus)[] = ["", "submitted", "approved", "rejected"];

export default function OrdersPage() {
  const me = useMe();
  const dept = me.role === "department";
  const { open } = useModal();
  const [status, setStatus] = useState<string>("");
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

      {dept && summary.data && <OrderStatusCards counts={summary.data.orders} value={status} onChange={setStatus} />}

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
        {query.data && query.data.results.length > 0 && <OrdersTable orders={query.data.results} showDepartment={!dept} />}
      </div>
    </>
  );
}

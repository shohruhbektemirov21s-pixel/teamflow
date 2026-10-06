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
import { Pagination } from "@/shared/ui/Pagination";

import { OrdersTable, OrderStatusCards } from "./OrdersTable";

// "Hammasi" birinchi va standart tanlov (foydalanuvchi talabi)
const TABS: ("" | OrderStatus)[] = ["", "submitted", "approved", "rejected"];

export default function OrdersPage() {
  const me = useMe();
  const dept = me.role === "department";
  const { open } = useModal();
  const [status, setStatus] = useState<string>("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const search = useDebounced(q);

  const query = useQuery({
    queryKey: ["orders", status, search, page],
    queryFn: () => api.get<Paged<Order>>(`/orders/${qs({ status, q: search, page: page === 1 ? undefined : page })}`),
    placeholderData: keepPreviousData,
  });
  const summary = useQuery({
    queryKey: ["dashboard", "department"],
    queryFn: () => api.get<DepartmentDashboard>("/dashboard/"),
    enabled: dept,
  });

  return (
    <>
      {dept && (
        <div className="page-toolbar">
          <span className="spacer" />
          <Button variant="primary" icon={<Plus />} onClick={() => open({ new: "order" })}>
            {T.orders.new}
          </Button>
        </div>
      )}

      {dept && summary.data && <OrderStatusCards counts={summary.data.orders} value={status} onChange={(value) => { setStatus(value); setPage(1); }} />}

      <div className="card">
        <div className="card-toolbar">
          {!dept && (
            <div className="chips">
              {TABS.map((s) => (
                <button key={s || "all"} className="chip" aria-pressed={status === s} onClick={() => { setStatus(s); setPage(1); }}>
                  {s ? T.orders.tabs[s] : T.common.all}
                </button>
              ))}
            </div>
          )}
          <span className="spacer" />
          <input className="input" style={{ maxWidth: 280 }} placeholder={T.common.search} value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} aria-label={T.common.search} />
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
        <Pagination data={query.isPlaceholderData ? undefined : query.data} page={page} onPageChange={setPage} />
      </div>
    </>
  );
}

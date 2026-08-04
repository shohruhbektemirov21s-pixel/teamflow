import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { History } from "lucide-react";
import { useState } from "react";

import { useModal } from "@/app/modals";
import { api, qs } from "@/shared/api";
import { fmtDateTime } from "@/shared/format";
import { useDebounced } from "@/shared/hooks";
import { T } from "@/shared/text";
import type { HistoryItem } from "@/shared/types";
import { Avatar, Empty, ErrorBox, SkeletonRows } from "@/shared/ui";

/** Umumiy tarix: kim, qachon, nima qildi. Menejer — hammaniki, boshqalar — o'ziniki. */
export default function HistoryPage() {
  const { open } = useModal();
  const [q, setQ] = useState("");
  const search = useDebounced(q);
  const query = useQuery({
    queryKey: ["history", search],
    queryFn: () => api.get<HistoryItem[]>(`/history/${qs({ q: search })}`),
    placeholderData: keepPreviousData,
  });

  const go = (h: HistoryItem) => {
    if (h.target?.type === "task") open({ task: h.target.id });
    else if (h.target?.type === "order") open({ order: h.target.id });
    else if (h.target?.type === "project") open({ project: h.target.id });
  };

  return (
    <>
      <div className="page-head">
        <h1 className="grow">{T.history.title}</h1>
        <input className="input" style={{ maxWidth: 300 }} placeholder={T.history.searchPh} value={q} onChange={(e) => setQ(e.target.value)} aria-label={T.history.searchPh} />
      </div>
      <div className="card card-pad">
        {query.error && <ErrorBox error={query.error} onRetry={() => query.refetch()} />}
        {query.isLoading && <SkeletonRows />}
        {query.data && !query.data.length && <Empty icon={<History />} title={T.history.empty} />}
        <div className="timeline">
          {query.data?.map((h) => (
            <div
              key={h.id}
              className="timeline-item"
              style={{ cursor: h.target ? "pointer" : undefined }}
              onClick={() => go(h)}
            >
              {h.actor ? <Avatar user={h.actor} size="sm" /> : <span className="avatar sm" style={{ background: "var(--slate)" }} />}
              <div className="grow">
                <div>{h.message}</div>
                <div className="small muted">{fmtDateTime(h.created_at)}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

import { useMutation, useQuery } from "@tanstack/react-query";
import { Bell, CheckCheck } from "lucide-react";
import { useState } from "react";

import { useModal } from "@/app/modals";
import { useRefresh } from "@/app/queries";
import { api, qs } from "@/shared/api";
import { timeAgo } from "@/shared/format";
import { T } from "@/shared/text";
import type { Notice, Paged } from "@/shared/types";
import { Button, Empty, ErrorBox, Segmented, SkeletonRows } from "@/shared/ui";

/** Bildirishnomalar: bosilganda o'qildi deb belgilanadi va tegishli modal ochiladi. */
export default function NotificationsPage() {
  const { open } = useModal();
  const refresh = useRefresh();
  const [filter, setFilter] = useState<"" | "1">("");
  const query = useQuery({
    queryKey: ["notifications", "list", filter],
    queryFn: () => api.get<Paged<Notice>>(`/notifications/${qs({ unread: filter })}`),
  });
  const readAll = useMutation({ mutationFn: () => api.post("/notifications/read_all/"), onSuccess: () => refresh() });

  const click = async (n: Notice) => {
    if (!n.is_read) api.post(`/notifications/${n.id}/read/`).then(() => refresh());
    if (n.target?.type === "task") open({ task: n.target.id });
    else if (n.target?.type === "order") open({ order: n.target.id });
    else if (n.target?.type === "project") open({ project: n.target.id });
  };

  const unread = query.data?.results.filter((n) => !n.is_read).length ?? 0;
  return (
    <>
      <div className="page-head">
        <div className="grow">
          <h1>{T.notifications.title}</h1>
        </div>
        <Segmented
          value={filter}
          onChange={setFilter}
          options={[
            { value: "", label: T.common.all },
            { value: "1", label: T.notifications.unread },
          ]}
        />
        <Button icon={<CheckCheck />} disabled={!unread} loading={readAll.isPending} onClick={() => readAll.mutate()}>
          {T.notifications.readAll}
        </Button>
      </div>
      <div className="card">
        {query.error && (
          <div className="card-pad">
            <ErrorBox error={query.error} onRetry={() => query.refetch()} />
          </div>
        )}
        {query.isLoading && <SkeletonRows />}
        {query.data && !query.data.results.length && <Empty icon={<Bell />} title={T.notifications.empty} hint={T.notifications.emptyHint} />}
        {query.data?.results.map((n) => (
          <button
            key={n.id}
            className="palette-item"
            style={{ borderRadius: 0, padding: "14px 16px", borderBottom: "1px solid var(--border)", background: n.is_read ? undefined : "var(--primary-soft)" }}
            onClick={() => click(n)}
          >
            <span
              style={{ width: 8, height: 8, borderRadius: "50%", background: n.is_read ? "transparent" : "var(--primary)", flex: "none" }}
              aria-label={n.is_read ? undefined : T.notifications.unread}
            />
            <span className="grow stack-sm" style={{ gap: 2 }}>
              <span className="small muted" style={{ fontWeight: 600 }}>
                {n.kind_label}
              </span>
              <span style={{ fontWeight: n.is_read ? 500 : 650 }}>{n.message}</span>
            </span>
            <span className="small muted nowrap">{timeAgo(n.created_at)}</span>
          </button>
        ))}
      </div>
    </>
  );
}

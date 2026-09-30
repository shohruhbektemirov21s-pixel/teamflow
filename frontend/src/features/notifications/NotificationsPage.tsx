import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Bell,
  BellOff,
  CheckCheck,
  CheckCircle2,
  FilePlus2,
  FileText,
  FileX2,
  Hourglass,
  ListChecks,
  type LucideIcon,
  MessageSquare,
  RotateCcw,
} from "lucide-react";
import { useState } from "react";

import { useModal } from "@/app/modals";
import { useRefresh, useUnreadCount } from "@/app/queries";
import { api, qs } from "@/shared/api";
import { fmtDate, isoDate, timeAgo } from "@/shared/format";
import { NOTICE_TONE } from "@/shared/status";
import { T } from "@/shared/text";
import type { Notice, Paged } from "@/shared/types";
import { Button, Empty, ErrorBox, Segmented, SkeletonRows } from "@/shared/ui";

/** Bildirishnoma turi → ikonka (rangi `NOTICE_TONE` da). */
const NOTICE_ICON: Record<string, LucideIcon> = {
  order_submitted: FileText,
  order_resubmitted: FilePlus2,
  order_approved: CheckCircle2,
  order_rejected: FileX2,
  task_assigned: ListChecks,
  task_submitted: Hourglass,
  task_accepted: CheckCircle2,
  task_returned: RotateCcw,
  comment: MessageSquare,
};

/** Kun bo'yicha guruhlash: "Bugun", "Kecha", keyin sana. Tartib serverdagidek (yangisi tepada). */
function groupByDay(items: Notice[], now = new Date()): { label: string; items: Notice[] }[] {
  const today = isoDate(now);
  const yesterday = isoDate(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1));
  const groups: { key: string; label: string; items: Notice[] }[] = [];
  for (const n of items) {
    const key = isoDate(new Date(n.created_at));
    let group = groups.at(-1);
    if (!group || group.key !== key) {
      const label = key === today ? T.notifications.today : key === yesterday ? T.notifications.yesterday : fmtDate(key);
      group = { key, label, items: [] };
      groups.push(group);
    }
    group.items.push(n);
  }
  return groups;
}

/** Bildirishnomalar: bosilganda o'qildi deb belgilanadi va tegishli modal ochiladi. */
export default function NotificationsPage() {
  const { open } = useModal();
  const refresh = useRefresh();
  const [filter, setFilter] = useState<"" | "1">("");
  const query = useQuery({
    queryKey: ["notifications", "list", filter],
    queryFn: () => api.get<Paged<Notice>>(`/notifications/${qs({ unread: filter })}`),
  });
  const unread = useUnreadCount().data ?? 0;
  const readAll = useMutation({ mutationFn: () => api.post("/notifications/read_all/"), onSuccess: () => refresh() });

  const click = (n: Notice) => {
    if (!n.is_read) api.post(`/notifications/${n.id}/read/`).then(() => refresh());
    if (n.target?.type === "task") open({ task: n.target.id });
    else if (n.target?.type === "order") open({ order: n.target.id });
    else if (n.target?.type === "project") open({ project: n.target.id });
  };

  const items = query.data?.results ?? [];
  return (
    <>
      <div className="page-head">
        <div className="grow">
          <h1>{T.notifications.title}</h1>
          <p>{unread ? T.notifications.unreadCount(unread) : T.notifications.allRead}</p>
        </div>
        <Segmented
          value={filter}
          onChange={setFilter}
          label={T.notifications.title}
          options={[
            { value: "", label: T.common.all },
            { value: "1", label: T.notifications.unread },
          ]}
        />
        <Button icon={<CheckCheck />} disabled={!unread} loading={readAll.isPending} onClick={() => readAll.mutate()}>
          {T.notifications.readAll}
        </Button>
      </div>

      {query.error && <ErrorBox error={query.error} onRetry={() => query.refetch()} />}
      {query.isLoading && (
        <div className="card">
          <SkeletonRows />
        </div>
      )}
      {query.data && !items.length && (
        <div className="card">
          {filter ? (
            <Empty icon={<BellOff />} title={T.notifications.emptyUnread} hint={T.notifications.emptyUnreadHint} />
          ) : (
            <Empty icon={<Bell />} title={T.notifications.empty} hint={T.notifications.emptyHint} />
          )}
        </div>
      )}

      {groupByDay(items).map((g) => (
        <section key={g.label} className="notice-group" aria-label={g.label}>
          <h2 className="section-title">{g.label}</h2>
          <div className="card">
            {g.items.map((n) => {
              const Icon = NOTICE_ICON[n.kind] ?? Bell;
              return (
                <button key={n.id} type="button" className={`notice ${n.is_read ? "" : "unread"}`} onClick={() => click(n)}>
                  <span className={`total-icon tone-${NOTICE_TONE[n.kind] ?? "slate"}`} aria-hidden>
                    <Icon />
                  </span>
                  <span className="grow stack-sm" style={{ gap: 2 }}>
                    <span className="notice-kind">{n.kind_label}</span>
                    <span className="notice-msg">{n.message}</span>
                  </span>
                  <span className="notice-meta">
                    <span className="small muted nowrap">{timeAgo(n.created_at)}</span>
                    {!n.is_read && <span className="notice-dot" role="img" aria-label={T.notifications.unread} />}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      ))}
    </>
  );
}

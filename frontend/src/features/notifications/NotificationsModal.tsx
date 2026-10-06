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
  X,
} from "lucide-react";
import { useState } from "react";

import { useModal } from "@/app/modals";
import { useRefresh, useUnreadCount } from "@/app/queries";
import { api, ApiError, qs } from "@/shared/api";
import { fmtDate, isoDate, timeAgo } from "@/shared/format";
import { NOTICE_TONE } from "@/shared/status";
import { T } from "@/shared/text";
import type { Notice, Paged } from "@/shared/types";
import { Button, Empty, ErrorBox, Field, Modal, Segmented, SkeletonRows, useToast } from "@/shared/ui";
import { Pagination } from "@/shared/ui/Pagination";

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
  project_completion_ack_requested: Hourglass,
  project_completion_ack_rejected: RotateCcw,
  project_completion_ack_done: CheckCircle2,
  project_completion_requested: Hourglass,
  project_completion_approved: CheckCircle2,
  project_completion_rejected: RotateCcw,
};

/** Loyihani yakunlashga tasdiq so'ralgan bildirishnoma: tugmalar bildirishnomaning o'zida (yangi modal yo'q).
 * "Yo'q" bosilsa, shu qatorning ostida sabab maydoni ochiladi. */
function AckNotice({ notice, Icon, onOpen }: { notice: Notice; Icon: LucideIcon; onOpen: () => void }) {
  const toast = useToast();
  const refresh = useRefresh(["notifications", "project", "projects", "orders", "order", "dashboard"]);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);

  const ack = useMutation({
    mutationFn: (data: { confirmed: boolean; reason?: string }) =>
      api.post(`/projects/${notice.target!.id}/completion-ack/`, data),
    onSuccess: () => {
      toast(T.notifications.ackSent);
      setRejecting(false);
      refresh();
    },
    onError: (e: Error) => {
      const err = e instanceof ApiError ? e : new ApiError(0, e.message);
      if (err.field("reason")) setFieldError(T.notifications.ackReasonRequired);
      else toast(err.message, "error");
    },
  });

  return (
    <div className={`notice ${notice.is_read ? "" : "unread"}`} style={{ flexWrap: "wrap" }}>
      <button type="button" className="row grow" style={{ textAlign: "left", font: "inherit", color: "inherit", background: "none", border: 0, padding: 0 }} onClick={onOpen}>
        <span className={`total-icon tone-${NOTICE_TONE[notice.kind] ?? "slate"}`} aria-hidden>
          <Icon />
        </span>
        <span className="grow stack-sm" style={{ gap: 2 }}>
          <span className="notice-kind">{T.notifications.ackQuestion}</span>
          <span className="notice-msg">{notice.message}</span>
        </span>
        <span className="notice-meta">
          <span className="small muted nowrap">{timeAgo(notice.created_at)}</span>
          {!notice.is_read && <span className="notice-dot" role="img" aria-label={T.notifications.unread} />}
        </span>
      </button>
      {!rejecting ? (
        <span className="row" style={{ gap: 8, width: "100%", justifyContent: "flex-end" }}>
          <Button size="sm" variant="ghost" icon={<X size={16} />} onClick={() => setRejecting(true)}>
            {T.notifications.ackReject}
          </Button>
          <Button size="sm" variant="success" icon={<CheckCircle2 size={16} />} loading={ack.isPending} onClick={() => ack.mutate({ confirmed: true })}>
            {T.notifications.ackConfirm}
          </Button>
        </span>
      ) : (
        <div className="stack-sm" style={{ width: "100%", gap: 8 }}>
          <Field label={T.notifications.ackReject} error={fieldError ?? undefined}>
            {(fid, bad) => (
              <textarea
                id={fid}
                className="textarea"
                aria-invalid={bad}
                placeholder={T.notifications.ackReasonPh}
                value={reason}
                onChange={(e) => (setReason(e.target.value), setFieldError(null))}
                autoFocus
              />
            )}
          </Field>
          <span className="row" style={{ gap: 8, justifyContent: "flex-end" }}>
            <Button size="sm" variant="ghost" onClick={() => (setRejecting(false), setReason(""), setFieldError(null))}>
              {T.common.cancel}
            </Button>
            <Button size="sm" variant="danger" disabled={!reason.trim()} loading={ack.isPending} onClick={() => ack.mutate({ confirmed: false, reason })}>
              {T.notifications.ackReasonSend}
            </Button>
          </span>
        </div>
      )}
    </div>
  );
}

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

/** Bildirishnomalar modali: tepadagi qo'ng'iroq ikonkasi ochadi (sahifa emas — foydalanuvchi talabi, 2026-10-05).
 * Bosilganda o'qildi deb belgilanadi va tegishli modal shu modal o'rniga ochiladi (modal ustida modal yo'q). */
export default function NotificationsModal() {
  const { open, close } = useModal();
  const refresh = useRefresh(["notifications"]);
  const [filter, setFilter] = useState<"" | "1">("");
  const [page, setPage] = useState(1);
  const query = useQuery({
    queryKey: ["notifications", "list", filter, page],
    queryFn: () => api.get<Paged<Notice>>(`/notifications/${qs({ unread: filter, page: page === 1 ? undefined : page })}`),
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
    <Modal
      size="lg"
      title={T.notifications.title}
      subtitle={<span className="muted small">{unread ? T.notifications.unreadCount(unread) : T.notifications.allRead}</span>}
      headerExtra={
        <Segmented
          value={filter}
          onChange={(value) => { setFilter(value); setPage(1); }}
          label={T.notifications.title}
          options={[
            { value: "", label: T.common.all },
            { value: "1", label: T.notifications.unread },
          ]}
        />
      }
      onClose={close}
      footer={
        <>
          <span className="spacer" />
          <Button icon={<CheckCheck />} disabled={!unread} loading={readAll.isPending} onClick={() => readAll.mutate()}>
            {T.notifications.readAll}
          </Button>
        </>
      }
    >
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
              if (n.needs_ack) return <AckNotice key={n.id} notice={n} Icon={Icon} onOpen={() => click(n)} />;
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
      <Pagination data={query.data} page={page} onPageChange={setPage} />
    </Modal>
  );
}

import { useMutation, useQuery } from "@tanstack/react-query";
import { Building2, CalendarCheck, CalendarDays, CheckCircle2, Clock, Eye, Flag, FolderKanban, Pencil, Send, User, XCircle } from "lucide-react";
import { type ReactNode, useState } from "react";

import { useModal } from "@/app/modals";
import { useRefresh } from "@/app/queries";
import { Comments } from "@/features/comments/Comments";
import { DocTitle, DocViewer } from "@/features/docs/DocViewer";
import { api, ApiError, formData } from "@/shared/api";
import { fmtDate, fmtDateTime, minDate, relativeDue } from "@/shared/format";
import { useMeta } from "@/shared/meta";
import { T } from "@/shared/text";
import type { FileInfo, OrderDetail, Priority } from "@/shared/types";
import {
  Badge,
  Button,
  Callout,
  ErrorBox,
  Field,
  FileList,
  FilePicker,
  FileRow,
  Meta,
  Modal,
  OrderStatusBadge,
  PriorityBadge,
  Skeleton,
  Stepper,
  StageBadge,
  Tabs,
  useToast,
} from "@/shared/ui";

type Panel = null | "approve" | "reject" | "version" | "dates" | "reject_completion";
type Tab = "main" | "doc" | "history" | "comments";

const STEP: Record<OrderDetail["status"], number> = { submitted: 1, rejected: 2, approved: 2, project_created: 3 };

/** Modal: buyurtma ko'rish. Tugmalar rolga va holatga qarab (server `actions` beradi). */
export default function OrderModal({ id }: { id: number }) {
  const { close, open } = useModal();
  const toast = useToast();
  const refresh = useRefresh();
  const meta = useMeta();
  const query = useQuery({ queryKey: ["order", id], queryFn: () => api.get<OrderDetail>(`/orders/${id}/`) });
  const order = query.data;

  const [tab, setTab] = useState<Tab>("main");
  const [panel, setPanel] = useState<Panel>(null);
  const [viewing, setViewing] = useState<FileInfo | null>(null);
  const [form, setForm] = useState({ start_date: "", end_date: "", note: "", reason: "", priority: "" as "" | Priority });
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<ApiError | null>(null);

  const openPanel = (p: Panel) => {
    setError(null);
    if (order && (p === "approve" || p === "dates")) {
      setForm((f) => ({ ...f, start_date: order.start_date ?? "", end_date: order.end_date ?? order.requested_due_date, priority: order.priority }));
    }
    setPanel(p);
  };

  type ActionKind = Exclude<Panel, null> | "confirm_completion";

  const act = useMutation({
    mutationFn: async (kind: ActionKind) => {
      if (kind === "approve")
        return api.post(`/orders/${id}/approve/`, { start_date: form.start_date, end_date: form.end_date, note: form.note, priority: form.priority || undefined });
      if (kind === "reject") return api.post(`/orders/${id}/reject/`, { reason: form.reason });
      if (kind === "dates") return api.post(`/orders/${id}/dates/`, { start_date: form.start_date, end_date: form.end_date });
      if (kind === "version") return api.post(`/orders/${id}/versions/`, formData({ note: form.note }, files, "file"));
      if (kind === "confirm_completion") return api.post(`/projects/${order!.project!.id}/confirm-completion/`);
      return api.post(`/projects/${order!.project!.id}/reject-completion/`, { reason: form.reason });
    },
    onSuccess: (_d, kind) => {
      toast(
        {
          approve: T.orders.approvedToast, reject: T.orders.rejectedToast, version: T.orders.versionToast,
          dates: T.orders.datesToast, confirm_completion: T.orders.completionConfirmedToast,
          reject_completion: T.orders.completionRejectedToast,
        }[kind],
      );
      setPanel(null);
      setFiles([]);
      setForm((f) => ({ ...f, note: "", reason: "" }));
      refresh();
    },
    onError: (e: Error) => setError(e instanceof ApiError ? e : new ApiError(0, e.message)),
  });

  if (viewing)
    return (
      <Modal size="lg" title={<DocTitle file={viewing} onBack={() => setViewing(null)} />} onClose={close}>
        <DocViewer file={viewing} />
      </Modal>
    );

  if (!order)
    return (
      <Modal size="lg" title={query.error ? T.common.notFound : T.common.loading} onClose={close}>
        {query.error ? <ErrorBox error={query.error} /> : <Skeleton h={260} />}
      </Modal>
    );

  const a = order.actions;
  const latest = order.versions[order.versions.length - 1];
  const lastRejected = [...order.versions].reverse().find((v) => v.decision === "rejected");
  const due = relativeDue(order.requested_due_date, order.status === "project_created");
  const fe = (k: string) => error?.field(k);
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));

  // "Tasdiqlash", "Rad etish" va boshqa amallar — buyurtma oynasi ustida alohida, qora fonli modal
  // (vazifani tekshiruvga yuborish oynasi kabi; foydalanuvchi istisnosi, 2026-10-06).
  const panelModal = (() => {
    if (!panel) return null;
    const common = error && !Object.keys(error.fields).length && <Callout tone="danger">{error.message}</Callout>;
    const screen = (
      opts: { icon: ReactNode; tone: "primary" | "success" | "danger"; title: string; subtitle: string; label: string; disabled: boolean },
      body: ReactNode,
    ) => (
      <Modal
        size="md"
        stacked
        title={
          <span className="row" style={{ gap: 12 }}>
            <span className={`modal-icon-badge ${opts.tone === "primary" ? "" : opts.tone}`}>{opts.icon}</span>
            <span>{opts.title}</span>
          </span>
        }
        subtitle={opts.subtitle}
        onClose={() => setPanel(null)}
        dirty={Boolean(form.note || form.reason || files.length)}
        footer={
          <>
            <span className="spacer" />
            <Button variant="default" onClick={() => setPanel(null)}>
              {T.common.cancel}
            </Button>
            <Button variant={opts.tone} icon={opts.icon} loading={act.isPending} disabled={opts.disabled} onClick={() => act.mutate(panel)}>
              {opts.label}
            </Button>
          </>
        }
      >
        <div className="stack" style={{ gap: 16 }}>
          {common}
          {body}
        </div>
      </Modal>
    );
    if (panel === "approve" || panel === "dates")
      return screen(
        panel === "approve"
          ? { icon: <CheckCircle2 />, tone: "success", title: T.orders.approve, subtitle: T.orders.approveSubtitle, label: T.orders.approve, disabled: !form.start_date || !form.end_date }
          : { icon: <CalendarDays />, tone: "primary", title: T.orders.editDates, subtitle: T.orders.datesSubtitle, label: T.common.save, disabled: !form.start_date || !form.end_date },
        <>
          <div className="grid-2">
            <Field label={T.orders.startDate} required error={fe("start_date")}>
              {(fid, bad) => <input id={fid} type="date" className="input" aria-invalid={bad} min={minDate(panel === "dates" ? order.start_date : null)} value={form.start_date} onChange={set("start_date")} autoFocus />}
            </Field>
            <Field label={T.orders.endDate} required error={fe("end_date")} hint={`${T.orders.requestedDue}: ${fmtDate(order.requested_due_date)}`}>
              {(fid, bad) => <input id={fid} type="date" className="input" aria-invalid={bad} value={form.end_date} min={minDate(panel === "dates" ? order.end_date : null, form.start_date)} onChange={set("end_date")} />}
            </Field>
          </div>
          {panel === "approve" && (
            <>
              <Field label={T.orders.priority}>
                {(fid) => (
                  <select id={fid} className="select" value={form.priority} onChange={set("priority")}>
                    {meta.priorities.map((p) => (
                      <option key={p.value} value={p.value}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                )}
              </Field>
              <Field label={T.orders.note}>
                {(fid) => <textarea id={fid} className="textarea" style={{ minHeight: 88 }} placeholder={T.orders.notePh} value={form.note} onChange={set("note")} />}
              </Field>
            </>
          )}
        </>,
      );
    if (panel === "reject" || panel === "reject_completion") {
      const isOrder = panel === "reject";
      return screen(
        {
          icon: <XCircle />,
          tone: "danger",
          title: isOrder ? T.orders.reject : T.orders.rejectCompletion,
          subtitle: isOrder ? T.orders.rejectSubtitle : T.orders.rejectCompletionSubtitle,
          label: isOrder ? T.orders.reject : T.orders.rejectCompletion,
          disabled: !form.reason.trim(),
        },
        <Field label={isOrder ? T.orders.rejectTitle : T.orders.rejectCompletionTitle} required error={fe("reason")}>
          {(fid, bad) => (
            <textarea
              id={fid}
              className="textarea"
              aria-invalid={bad}
              style={{ minHeight: 104 }}
              placeholder={isOrder ? T.orders.rejectPh : T.orders.rejectCompletionPh}
              value={form.reason}
              onChange={set("reason")}
              autoFocus
            />
          )}
        </Field>,
      );
    }
    return screen(
      { icon: <Send />, tone: "primary", title: T.orders.newVersion, subtitle: T.orders.newVersionSubtitle, label: T.orders.send, disabled: files.length !== 1 || !form.note.trim() },
      <>
        <FilePicker files={files} onChange={setFiles} multiple={false} accept=".docx,.pdf" label={T.orders.tzFile} hint={T.orders.tzHint} invalid={Boolean(fe("file"))} />
        {fe("file") && <span className="field-error">{fe("file")}</span>}
        <Field label={T.orders.fixed} required error={fe("note")}>
          {(fid, bad) => <textarea id={fid} className="textarea" aria-invalid={bad} placeholder={T.orders.newVersionPh} value={form.note} onChange={set("note")} />}
        </Field>
      </>,
    );
  })();

  const footer = (
    <>
      {a.reject && (
        <Button variant="danger" icon={<XCircle />} onClick={() => openPanel("reject")}>
          {T.orders.reject}
        </Button>
      )}
      {a.decide_completion && (
        <Button variant="danger" icon={<XCircle />} onClick={() => openPanel("reject_completion")}>
          {T.orders.rejectCompletion}
        </Button>
      )}
      {a.edit_dates && (
        <Button variant="ghost" icon={<Pencil />} onClick={() => openPanel("dates")}>
          {T.orders.editDates}
        </Button>
      )}
      <span className="spacer" />
      {a.new_version && (
        <Button variant="primary" icon={<Send />} onClick={() => openPanel("version")}>
          {T.orders.newVersion}
        </Button>
      )}
      {a.approve && (
        <Button variant="success" icon={<CheckCircle2 />} onClick={() => openPanel("approve")}>
          {T.orders.approve}
        </Button>
      )}
      {a.decide_completion && (
        <Button variant="success" icon={<CheckCircle2 />} loading={act.isPending} onClick={() => act.mutate("confirm_completion")}>
          {T.orders.confirmCompletion}
        </Button>
      )}
      {a.view_project && order.project && (
        <Button variant="primary" icon={<FolderKanban />} onClick={() => open({ project: order.project!.id })}>
          {T.orders.openProject}
        </Button>
      )}
      {!a.reject && !a.approve && !a.new_version && !a.decide_completion && !(a.view_project && order.project) && !a.create_project && (
        <Button onClick={close}>{T.common.close}</Button>
      )}
    </>
  );

  return (
    <>
    <Modal
      size="lg"
      covered={Boolean(panel)}
      title={order.title}
      subtitle={
        <>
          {order.status === "project_created" && order.project ? <StageBadge stage={order.project.stage} /> : <OrderStatusBadge status={order.status} />}
          <PriorityBadge priority={order.priority} />
          {latest && <Badge tone="slate" dot={false}>TZ {T.orders.version(latest.number)}</Badge>}
        </>
      }
      headerExtra={
        a.create_project && (
          <Button variant="primary" icon={<FolderKanban />} onClick={() => open({ new: "project", order: order.id })}>
            {T.orders.createProject}
          </Button>
        )
      }
      onClose={close}
      footer={footer}
    >
      <div className="stack" style={{ gap: 18 }}>
        <Stepper steps={T.orders.steps} current={STEP[order.status]} bad={order.status === "rejected"} />
        {order.status === "submitted" && a.new_version === false && order.actions.approve === false && (
          <Callout tone="info">{T.orders.waitingDecision}</Callout>
        )}
        {order.status === "rejected" && lastRejected && (
          <Callout tone="danger">
            <b>{T.orders.rejectReason}:</b> {lastRejected.reject_reason}
            {a.new_version && <div style={{ marginTop: 4 }}>{T.orders.rejectedInfo}</div>}
          </Callout>
        )}
        {order.project?.stage === "pending_approval" && <Callout tone="info">{T.orders.completionTitle}</Callout>}
        <Tabs<Tab>
          value={tab}
          onChange={setTab}
          tabs={[
            { key: "main", label: T.orders.tabMain },
            { key: "doc", label: T.orders.tabDoc },
            { key: "history", label: `${T.orders.tabHistory} (${order.versions.length})` },
            { key: "comments", label: T.common.comments },
          ]}
        />
        {tab === "main" && (
          <div className="modal-split">
            <div className="stack" style={{ gap: 20 }}>
              <div>
                <div className="section-title">{T.orders.description}</div>
                <p className="prose">{order.description || T.common.none}</p>
              </div>
              {order.pm_note && (
                <div>
                  <div className="section-title">{T.orders.pmNote}</div>
                  <p className="prose">{order.pm_note}</p>
                </div>
              )}
              {order.completion_report && (order.completion_report.note || order.completion_report.files.length > 0) && (
                <div className="stack-sm">
                  <div className="section-title">{T.projects.completionReport}</div>
                  {order.completion_report.note && <p className="prose">{order.completion_report.note}</p>}
                  <FileList files={order.completion_report.files} onOpen={setViewing} />
                </div>
              )}
              {latest && (
                <div>
                  <div className="section-title">
                    {T.orders.tzFile} · {T.orders.version(latest.number)}
                  </div>
                  <FileRow file={latest.file} onOpen={setViewing} />
                  {latest.note && (
                    <p className="small muted" style={{ marginTop: 6 }}>
                      {T.orders.fixed}: {latest.note}
                    </p>
                  )}
                </div>
              )}
            </div>
            <aside className="card card-pad meta">
              <Meta icon={<Building2 />} label={T.orders.department}>
                {order.submitted_by.department_name}
              </Meta>
              <Meta icon={<User />} label={T.orders.sender}>
                {order.submitted_by.full_name}
              </Meta>
              <Meta icon={<CalendarDays />} label={T.orders.requestedDue}>
                {fmtDate(order.requested_due_date)}
                {due && (
                  <div className="small" style={{ color: due.tone === "muted" ? "var(--muted)" : `var(--${due.tone})` }}>
                    {due.text}
                  </div>
                )}
              </Meta>
              <Meta icon={<CalendarCheck />} label={T.orders.pmDates}>
                {order.start_date ? `${fmtDate(order.start_date)} — ${fmtDate(order.end_date)}` : <span className="muted">{T.common.notSet}</span>}
              </Meta>
              {order.approved_by && (
                <Meta icon={<User />} label={T.orders.responsiblePm}>
                  {order.approved_by.full_name}
                </Meta>
              )}
              <Meta icon={<Flag />} label={T.orders.priority}>
                <PriorityBadge priority={order.priority} />
              </Meta>
              <Meta icon={<Clock />} label={T.orders.sentAt}>
                {fmtDateTime(order.created_at)}
              </Meta>
            </aside>
          </div>
        )}
        {tab === "doc" &&
          (latest ? (
            <div className="stack">
              <div className="row">
                <span className="grow small muted">
                  {latest.file.name} · {T.orders.version(latest.number)}
                </span>
                <Button size="sm" icon={<Eye />} onClick={() => setViewing(latest.file)}>
                  {T.docs.fullscreen}
                </Button>
              </div>
              <DocViewer file={latest.file} />
            </div>
          ) : (
            <FileList files={[]} />
          ))}
        {tab === "history" && (
          <div className="timeline">
            {[...order.versions].reverse().map((v) => (
              <div key={v.id} className="timeline-item">
                <span className="badge tone-primary" style={{ height: 28 }}>
                  {T.orders.version(v.number)}
                </span>
                <div className="grow stack-sm">
                  <div className="row-wrap">
                    <span className="muted small">{fmtDateTime(v.created_at)}</span>
                    <span className="spacer" />
                    <Badge tone={v.decision === "approved" ? "success" : v.decision === "rejected" ? "danger" : "info"}>{v.decision_label}</Badge>
                  </div>
                  <FileRow file={v.file} onOpen={setViewing} />
                  {v.note && (
                    <p className="small">
                      <b>{T.orders.fixed}:</b> {v.note}
                    </p>
                  )}
                  {v.reject_reason && (
                    <p className="small" style={{ color: "var(--danger)" }}>
                      <b>{T.orders.rejectReason}:</b> {v.reject_reason}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
        {tab === "comments" && <Comments type="order" id={order.id} />}
      </div>
    </Modal>
    {panelModal}
    </>
  );
}

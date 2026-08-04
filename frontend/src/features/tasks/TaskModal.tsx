import { useMutation, useQuery } from "@tanstack/react-query";
import {
  CalendarClock,
  CheckCircle2,
  Flag,
  FolderKanban,
  Pencil,
  Play,
  RotateCcw,
  Send,
  Trash2,
  Upload,
  User,
  Users,
} from "lucide-react";
import { useEffect, useState } from "react";

import { useModal } from "@/app/modals";
import { useRefresh } from "@/app/queries";
import { DocTitle, DocViewer } from "@/features/docs/DocViewer";
import { Comments } from "@/features/comments/Comments";
import { api, ApiError, formData } from "@/shared/api";
import { fmtDateTime, timeAgo } from "@/shared/format";
import { useMeta } from "@/shared/meta";
import { T } from "@/shared/text";
import type { FileInfo, TaskDetail } from "@/shared/types";
import {
  Avatar,
  Badge,
  Button,
  Callout,
  ConfirmButton,
  Due,
  ErrorBox,
  Field,
  FileList,
  FilePicker,
  Meta,
  Modal,
  PriorityBadge,
  Skeleton,
  Stepper,
  Tabs,
  TaskStatusBadge,
  useToast,
} from "@/shared/ui";

type Panel = null | "submit" | "return";
type Tab = "main" | "review" | "comments";

/** Modal: vazifa ko'rish. Tekshiruv (qabul/qaytarish) ham shu yerda — alohida modal ochilmaydi. */
export default function TaskModal({ id, submitMode }: { id: number; submitMode?: boolean }) {
  const { close, open } = useModal();
  const toast = useToast();
  const refresh = useRefresh();
  const meta = useMeta();
  const query = useQuery({ queryKey: ["task", id], queryFn: () => api.get<TaskDetail>(`/tasks/${id}/`) });
  const task = query.data;

  const [tab, setTab] = useState<Tab>("main");
  const [panel, setPanel] = useState<Panel>(submitMode ? "submit" : null);
  const [note, setNote] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [viewing, setViewing] = useState<FileInfo | null>(null);
  const [noteError, setNoteError] = useState<string>();

  useEffect(() => {
    if (submitMode) setPanel("submit");
  }, [submitMode]);
  useEffect(() => {
    if (task?.actions.review && task.status === "in_review") setTab("review");
  }, [task?.actions.review, task?.status]);

  const act = useMutation({
    mutationFn: async (kind: "start" | "submit" | "accept" | "return" | "delete" | "files") => {
      if (kind === "start") return api.post(`/tasks/${id}/start/`);
      if (kind === "submit") return api.post(`/tasks/${id}/submit/`, formData({ note }, files));
      if (kind === "accept") return api.post(`/tasks/${id}/review/`, { decision: "accept", note });
      if (kind === "return") return api.post(`/tasks/${id}/review/`, { decision: "return", note });
      if (kind === "files") return api.post(`/tasks/${id}/files/`, formData({}, files));
      return api.del(`/tasks/${id}/`);
    },
    onSuccess: (_d, kind) => {
      const msg = {
        start: T.tasks.startedToast,
        submit: T.tasks.submittedToast,
        accept: T.tasks.acceptedToast,
        return: T.tasks.returnedToast,
        delete: T.tasks.deletedToast,
        files: T.common.saved,
      }[kind];
      toast(msg);
      setPanel(null);
      setNote("");
      setFiles([]);
      setNoteError(undefined);
      refresh();
      if (kind === "delete") close();
    },
    onError: (e: Error) => {
      const fieldMsg = e instanceof ApiError ? e.field("note") : undefined;
      if (fieldMsg) setNoteError(fieldMsg);
      else toast(e.message, "error");
    },
  });

  const toggle = useMutation({
    mutationFn: ({ sid, done }: { sid: number; done: boolean }) => api.post(`/tasks/${id}/subtasks/${sid}/toggle/`, { is_done: done }),
    onSuccess: () => refresh(),
    onError: (e: Error) => toast(e.message, "error"),
  });

  if (viewing)
    return (
      <Modal size="lg" title={<DocTitle file={viewing} onBack={() => setViewing(null)} />} onClose={close}>
        <DocViewer file={viewing} />
      </Modal>
    );

  if (!task)
    return (
      <Modal size="lg" title={query.error ? T.common.notFound : T.common.loading} onClose={close}>
        {query.error ? <ErrorBox error={query.error} /> : <Skeleton h={240} />}
      </Modal>
    );

  const statuses = meta.task_statuses;
  const step = statuses.findIndex((s) => s.value === task.status);
  const lastReturned = [...task.submissions].reverse().find((s) => s.decision === "returned");
  const pending = [...task.submissions].reverse().find((s) => s.decision === "pending");

  const footer = (() => {
    const a = task.actions;
    if (panel === "submit" || panel === "return") {
      const isSubmit = panel === "submit";
      return (
        <div className="inline-panel">
          <Field label={isSubmit ? T.tasks.submitTitle : T.tasks.returnTitle} required error={noteError}>
            {(fid, bad) => (
              <textarea
                id={fid}
                className="textarea"
                aria-invalid={bad}
                autoFocus
                placeholder={isSubmit ? T.tasks.submitPh : T.tasks.returnPh}
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            )}
          </Field>
          {isSubmit && <FilePicker files={files} onChange={setFiles} />}
          <div className="row">
            <span className="spacer" />
            <Button variant="ghost" onClick={() => (setPanel(null), setNoteError(undefined))}>
              {T.common.cancel}
            </Button>
            <Button
              variant={isSubmit ? "primary" : "danger"}
              icon={isSubmit ? <Send /> : <RotateCcw />}
              loading={act.isPending}
              onClick={() => act.mutate(isSubmit ? "submit" : "return")}
            >
              {isSubmit ? T.tasks.submitSend : T.tasks.returnSend}
            </Button>
          </div>
        </div>
      );
    }
    const left = (
      <>
        {a.delete && (
          <ConfirmButton onConfirm={() => act.mutate("delete")} loading={act.isPending}>
            <Trash2 /> {T.common.delete}
          </ConfirmButton>
        )}
        {a.edit && (
          <Button variant="ghost" icon={<Pencil />} onClick={() => open({ new: "task", edit: task.id, project: task.project.id })}>
            {T.common.edit}
          </Button>
        )}
      </>
    );
    return (
      <>
        {left}
        <span className="spacer" />
        {a.review && (
          <>
            <Button variant="danger" icon={<RotateCcw />} onClick={() => setPanel("return")}>
              {T.tasks.return}
            </Button>
            <Button variant="success" icon={<CheckCircle2 />} loading={act.isPending} onClick={() => act.mutate("accept")}>
              {T.tasks.accept}
            </Button>
          </>
        )}
        {a.start && (
          <Button variant="primary" icon={<Play />} loading={act.isPending} onClick={() => act.mutate("start")}>
            {T.tasks.start}
          </Button>
        )}
        {a.submit && (
          <Button variant="primary" icon={<Send />} onClick={() => setPanel("submit")}>
            {T.tasks.submit}
          </Button>
        )}
      </>
    );
  })();

  return (
    <Modal
      size="lg"
      title={task.title}
      subtitle={
        <>
          <TaskStatusBadge status={task.status} />
          <PriorityBadge priority={task.priority} />
          {task.is_overdue && <Badge tone="danger">{T.dashboard.overdue}</Badge>}
          {task.finished_late && <Badge tone="warning">{T.dashboard.late}</Badge>}
        </>
      }
      onClose={close}
      dirty={Boolean(panel && note.trim())}
      footer={footer}
    >
      <div className="stack" style={{ gap: 18 }}>
        <Stepper steps={statuses.map((s) => s.label)} current={step} bad={task.status === "in_progress" && Boolean(lastReturned)} />
        {task.status === "in_progress" && lastReturned && (
          <Callout tone="warning">
            <b>{T.tasks.returnTitle}</b> {lastReturned.review_note}
          </Callout>
        )}
        {task.actions.review && pending && (
          <Callout tone="info">
            <b>
              {pending.submitted_by.full_name} · {timeAgo(pending.submitted_at)}:
            </b>{" "}
            {pending.note}
          </Callout>
        )}
        <Tabs<Tab>
          value={tab}
          onChange={setTab}
          tabs={[
            { key: "main", label: T.tasks.tabMain },
            { key: "review", label: `${T.tasks.tabReview} (${task.submissions.length})` },
            { key: "comments", label: T.common.comments },
          ]}
        />
        {tab === "main" && (
          <div className="modal-split">
            <div className="stack" style={{ gap: 20 }}>
              {task.description && <p className="prose">{task.description}</p>}
              <div>
                <div className="section-title">
                  {T.tasks.subtasks} {task.subtasks.length > 0 && `· ${task.subtasks_progress.done}/${task.subtasks_progress.total}`}
                </div>
                {task.subtasks.length ? (
                  <div className="stack-sm">
                    {task.subtasks.map((s) => (
                      <label key={s.id} className="pick" style={{ cursor: s.can_toggle ? "pointer" : "default" }}>
                        <input
                          type="checkbox"
                          checked={s.is_done}
                          disabled={!s.can_toggle || toggle.isPending}
                          onChange={(e) => toggle.mutate({ sid: s.id, done: e.target.checked })}
                        />
                        <span className="grow" style={{ textDecoration: s.is_done ? "line-through" : undefined, color: s.is_done ? "var(--muted)" : undefined }}>
                          {s.title}
                        </span>
                        {s.assignee ? (
                          <span className="row small muted">
                            <Avatar user={s.assignee} size="sm" /> {s.assignee.full_name}
                          </span>
                        ) : (
                          <span className="small muted">{T.tasks.subtaskNobody}</span>
                        )}
                      </label>
                    ))}
                  </div>
                ) : (
                  <p className="small muted">{T.common.none}</p>
                )}
              </div>
              <div>
                <div className="section-title">{T.common.files}</div>
                <FileList files={task.files} onOpen={setViewing} />
                {task.actions.add_files && (
                  <div className="stack-sm" style={{ marginTop: 8 }}>
                    <FilePicker files={files} onChange={setFiles} />
                    {files.length > 0 && panel === null && (
                      <Button size="sm" icon={<Upload />} loading={act.isPending} onClick={() => act.mutate("files")}>
                        {T.common.save}
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </div>
            <aside className="card card-pad meta">
              <Meta icon={<FolderKanban />} label={T.tasks.project}>
                <button className="btn-ghost" style={{ border: 0, padding: 0, cursor: "pointer", color: "var(--primary)", fontWeight: 600, background: "none" }} onClick={() => open({ project: task.project.id })}>
                  {task.project.name}
                </button>
              </Meta>
              <Meta icon={<Users />} label={T.tasks.assignees}>
                <div className="stack-sm">
                  {task.assignees.map((u) => (
                    <span key={u.id} className="row">
                      <Avatar user={u} size="sm" /> {u.full_name}
                    </span>
                  ))}
                </div>
              </Meta>
              <Meta icon={<CalendarClock />} label={T.tasks.dueAt}>
                <Due value={task.due_at} done={task.status === "done"} format={fmtDateTime} />
              </Meta>
              {task.starts_at && (
                <Meta icon={<CalendarClock />} label={T.tasks.startsAt}>
                  {fmtDateTime(task.starts_at)}
                </Meta>
              )}
              {task.completed_at && (
                <Meta icon={<CheckCircle2 />} label={meta.label("task_statuses", "done")}>
                  {fmtDateTime(task.completed_at)}
                </Meta>
              )}
              <Meta icon={<Flag />} label={T.tasks.priority}>
                <PriorityBadge priority={task.priority} />
              </Meta>
              <Meta icon={<User />} label={T.tasks.createdBy}>
                {task.created_by.full_name}
              </Meta>
            </aside>
          </div>
        )}
        {tab === "review" &&
          (task.submissions.length ? (
            <div className="timeline">
              {[...task.submissions].reverse().map((s) => (
                <div key={s.id} className="timeline-item">
                  <Avatar user={s.submitted_by} size="sm" />
                  <div className="grow stack-sm">
                    <div className="row-wrap">
                      <b>{s.submitted_by.full_name}</b>
                      <span className="muted small">
                        {T.tasks.round(s.round)} · {fmtDateTime(s.submitted_at)}
                      </span>
                      <span className="spacer" />
                      <Badge tone={s.decision === "accepted" ? "success" : s.decision === "returned" ? "danger" : "violet"}>{s.decision_label}</Badge>
                    </div>
                    <p className="prose" style={{ color: "var(--text)" }}>
                      {s.note}
                    </p>
                    {s.files.length > 0 && <FileList files={s.files} onOpen={setViewing} />}
                    {s.reviewed_by && (
                      <div className="callout tone-slate" style={{ marginTop: 4 }}>
                        <div>
                          <b>
                            {T.tasks.reviewer}: {s.reviewed_by.full_name}
                          </b>
                          {s.review_note && <div className="prose">{s.review_note}</div>}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="muted">{T.tasks.noSubmissions}</p>
          ))}
        {tab === "comments" && <Comments type="task" id={task.id} />}
      </div>
    </Modal>
  );
}

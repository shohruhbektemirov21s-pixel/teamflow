import { useMe } from '@/app/auth';
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  
  
  CheckCircle2,
  Clock3,
  
  FolderKanban,
  Pencil,
  Play,
  Plus,
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
import type { FileInfo, ProjectDetail, TaskDetail } from "@/shared/types";
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
  TaskStatusBadge,
  useToast,
} from "@/shared/ui";

type Panel = null | "submit" | "return";


/** Modal: vazifa ko'rish. Tekshiruv (qabul/qaytarish) ham shu yerda — alohida modal ochilmaydi. */
export default function TaskModal({ id, submitMode }: { id: number; submitMode?: boolean }) {
  const { close, open } = useModal();
  const toast = useToast();
  const refresh = useRefresh();
  const meta = useMeta();
  const me = useMe();
  const query = useQuery({ queryKey: ["task", id], queryFn: () => api.get<TaskDetail>(`/tasks/${id}/`) });
  const task = query.data;

  const projectTeam = useQuery({
    queryKey: ["project", task?.project.id],
    queryFn: () => api.get<ProjectDetail>(`/projects/${task!.project.id}/`),
    enabled: Boolean(task?.project.id),
  });

  
  const [panel, setPanel] = useState<Panel>(submitMode ? "submit" : null);
  const [note, setNote] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [viewing, setViewing] = useState<FileInfo | null>(null);
  const [noteError, setNoteError] = useState<string>();

  const [isAddingSubtask, setIsAddingSubtask] = useState(false);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("");
  const [newSubtaskAssignee, setNewSubtaskAssignee] = useState<number | "">("");
  const [workNote, setWorkNote] = useState("");
  const [workHours, setWorkHours] = useState("1");

  useEffect(() => {
    if (submitMode) setPanel("submit");
  }, [submitMode]);
  

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

  const addSubtask = useMutation({
    mutationFn: (data: { title: string; assignee_id?: number | null }) => api.post(`/tasks/${id}/subtasks/`, data),
    onSuccess: () => {
      refresh();
      setNewSubtaskTitle("");
      setNewSubtaskAssignee("");
      setIsAddingSubtask(false);
      toast("Sub-vazifa qo'shildi");
    },
    onError: (e: Error) => toast(e.message, "error"),
  });

  const deleteSubtask = useMutation({
    mutationFn: (sid: number) => api.del(`/tasks/${id}/subtasks/${sid}/`),
    onSuccess: () => {
      refresh();
      toast("Sub-vazifa o'chirildi");
    },
    onError: (e: Error) => toast(e.message, "error"),
  });

  const worklog = useMutation({
    mutationFn: () => api.post<TaskDetail>(`/tasks/${id}/worklogs/`, { work_date: new Date().toISOString().slice(0, 10), hours: workHours, note: workNote }),
    onSuccess: () => {
      setWorkNote("");
      setWorkHours("1");
      refresh();
      toast("Ish jurnali saqlandi");
    },
    onError: (e: Error) => toast(e.message, "error"),
  });
  const deleteWorklog = useMutation({
    mutationFn: (entryId: number) => api.del<TaskDetail>(`/tasks/${id}/worklogs/${entryId}/`),
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
      title={<><span className="muted">{task.code}</span> {task.title}</>}
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
              {pending.submitted_by.full_name} — {timeAgo(pending.submitted_at)}:
            </b>{" "}
            {pending.note}
          </Callout>
        )}
        
        <div className="modal-split" style={{ marginTop: 8 }}>
          <div className="stack" style={{ gap: 16 }}>
            {task.description && <p className="prose" style={{ marginBottom: 8 }}>{task.description}</p>}
            
            <details className="details-section" open>
              <summary>Sub-vazifalar {task.subtasks.length > 0 && `(${task.subtasks_progress.done}/${task.subtasks_progress.total})`}</summary>
              <div className="details-content stack-sm">
                {task.subtasks.length ? (
                  <div className="stack-sm">
                    {task.subtasks.map((s) => (
                      <div key={s.id} className="row" style={{ width: "100%", gap: 6 }}>
                        <label className="pick grow" style={{ cursor: s.can_toggle ? "pointer" : "default", margin: 0 }}>
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
                        {s.can_delete && (
                          <button
                            type="button"
                            className="icon-btn"
                            title={T.common.delete}
                            disabled={deleteSubtask.isPending}
                            onClick={() => deleteSubtask.mutate(s.id)}
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="small muted">{T.common.none}</p>
                )}
                {task.actions.manage_subtasks && (
                  <div style={{ marginTop: 10 }}>
                    {!isAddingSubtask ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        icon={<Plus size={14} />}
                        onClick={() => setIsAddingSubtask(true)}
                      >
                        Sub-vazifa qo'shish
                      </Button>
                    ) : (
                      <form
                        className="row-wrap"
                        style={{
                          gap: 8,
                          padding: 10,
                          background: "var(--surface-muted)",
                          border: "1px solid var(--border)",
                          borderRadius: "var(--radius-sm)",
                        }}
                        onSubmit={(e) => {
                          e.preventDefault();
                          if (!newSubtaskTitle.trim()) return;
                          addSubtask.mutate({
                            title: newSubtaskTitle,
                            assignee_id: newSubtaskAssignee ? Number(newSubtaskAssignee) : null,
                          });
                        }}
                      >
                        <input
                          autoFocus
                          className="input grow"
                          placeholder="Nima qilinishi kerak?"
                          value={newSubtaskTitle}
                          onChange={(e) => setNewSubtaskTitle(e.target.value)}
                        />
                        <select
                          className="select"
                          value={newSubtaskAssignee}
                          onChange={(e) => setNewSubtaskAssignee(e.target.value ? Number(e.target.value) : "")}
                        >
                          <option value="">Odam tanlash...</option>
                          {projectTeam.data?.members.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.full_name}
                            </option>
                          ))}
                        </select>
                        <Button type="submit" size="sm" variant="primary" loading={addSubtask.isPending}>
                          {T.common.save}
                        </Button>
                        <Button type="button" size="sm" variant="ghost" onClick={() => setIsAddingSubtask(false)}>
                          {T.common.cancel}
                        </Button>
                      </form>
                    )}
                  </div>
                )}
              </div>
            </details>

            {task.submissions.length > 0 && (
              <details className="details-section" open>
                <summary>Topshirilgan ish ({task.submissions.length})</summary>
                <div className="details-content">
                  <div className="timeline">
                    {[...task.submissions].reverse().map((s) => (
                      <div key={s.id} className="timeline-item">
                        <Avatar user={s.submitted_by} size="sm" />
                        <div className="grow">
                          <div className="row" style={{ justifyContent: "space-between" }}>
                            <b>{s.submitted_by.full_name}</b>
                            <span className="small muted">{fmtDateTime(s.submitted_at)}</span>
                          </div>
                          <p style={{ margin: "4px 0" }}>{s.note}</p>
                          {s.files.length > 0 && <FileList files={s.files} onOpen={setViewing} />}
                          {s.decision && (
                            <div className="row small mt-2" style={{ color: s.decision === "accepted" ? "var(--success)" : s.decision === "returned" ? "var(--danger)" : "var(--muted)" }}>
                              {s.decision === "accepted" && <CheckCircle2 size={14} />}
                              {s.decision === "returned" && <RotateCcw size={14} />}
                              {s.decision === "pending" && <Clock3 size={14} />}
                              {s.decision === "accepted" && T.tasks.accept}
                              {s.decision === "returned" && <>{T.tasks.return}: {s.review_note}</>}
                              {s.decision === "pending" && "Kutilmoqda"}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </details>
            )}

            <details className="details-section" open={Number(task.worklog_hours) > 0}>
              <summary>Ish jurnali ({task.worklog_hours} soat)</summary>
              <div className="details-content stack">
                {task.actions.log_work && (
                  <form className="card card-pad row-wrap" onSubmit={(event) => { event.preventDefault(); if (workNote.trim()) worklog.mutate(); }}>
                    <input className="input" type="number" min="0.01" max="24" step="0.25" style={{ width: 112 }} value={workHours} aria-label="Sarflangan soat" onChange={(event) => setWorkHours(event.target.value)} />
                    <input className="input grow" placeholder="Bugun nima qildingiz?" value={workNote} onChange={(event) => setWorkNote(event.target.value)} />
                    <Button type="submit" variant="primary" loading={worklog.isPending} disabled={!workNote.trim()}>
                      Qayd etish
                    </Button>
                  </form>
                )}
                {task.worklogs && task.worklogs.length > 0 ? (
                  <div className="stack-sm">
                    {task.worklogs.map((wl: any) => (
                      <div key={wl.id} className="row">
                        <Avatar user={wl.user} size="sm" />
                        <span className="grow">
                          <b>{wl.user.full_name}</b> <span className="muted">— {wl.hours} soat</span>
                          <p className="small muted" style={{ margin: 0 }}>{wl.note}</p>
                        </span>
                        <span className="small muted">{fmtDateTime(wl.created_at)}</span>
                        {task.actions.log_work && wl.user.id === me?.id && (
                          <button type="button" className="icon-btn" title="O'chirish" onClick={() => deleteWorklog.mutate(wl.id)}>
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="small muted">Ish jurnali bo'sh.</p>
                )}
              </div>
            </details>

            <details className="details-section" open>
              <summary>Izohlar</summary>
              <div className="details-content">
                <Comments type="task" id={task.id} />
              </div>
            </details>
          </div>

          <aside className="stack" style={{ gap: 16 }}>
            <details className="details-section" open>
              <summary>Ma'lumotlar</summary>
              <div className="details-content stack-sm">
                <Meta icon={<FolderKanban />} label={"Loyiha"}>{task.project.name}</Meta>
                <Meta icon={<Due value={task.due_at} format={fmtDateTime} />} label={"Muddat"}>{fmtDateTime(task.due_at)}</Meta>
                <Meta icon={<Users />} label={"Ijrochilar"}>
                  <div className="chips">{task.assignees.map((u) => <Avatar key={u.id} user={u} size="sm" />)}</div>
                </Meta>
                <Meta icon={<User />} label="Yaratdi">{task.created_by.full_name}</Meta>
              </div>
            </details>

            <details className="details-section" open>
              <summary>Fayllar ({task.files.length})</summary>
              <div className="details-content stack-sm">
                {task.files.length > 0 ? (
                  <FileList files={task.files} onOpen={setViewing} />
                ) : (
                  <span className="small muted">Fayllar yo'q</span>
                )}
                {task.actions.add_files && (
                  <form onSubmit={(e) => { e.preventDefault(); if (files.length) act.mutate("files"); }}>
                    <div className="row" style={{ marginTop: 10 }}>
                      <FilePicker files={files} onChange={setFiles} />
                      {files.length > 0 && (
                        <Button type="submit" variant="primary" size="sm" loading={act.isPending} icon={<Upload size={14} />}>
                          Yuklash
                        </Button>
                      )}
                    </div>
                  </form>
                )}
              </div>
            </details>
          </aside>
        </div>
      </div>
    </Modal>
  );
}

import { useMutation, useQuery } from "@tanstack/react-query";
import {
  CalendarClock,
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
  UserPlus,
  Users,
} from "lucide-react";
import { useEffect, useState } from "react";

import { useMe } from "@/app/auth";
import { useModal } from "@/app/modals";
import { useRefresh } from "@/app/queries";
import { DocTitle, DocViewer } from "@/features/docs/DocViewer";
import { Comments } from "@/features/comments/Comments";
import { DeveloperPicker } from "@/features/people/DeveloperPicker";
import { api, ApiError, formData } from "@/shared/api";
import { fmtDate, fmtDateTime } from "@/shared/format";
import { useMeta } from "@/shared/meta";
import { T } from "@/shared/text";
import type { FileInfo, Submission, TaskDetail, WorkLog } from "@/shared/types";
import {
  Avatar,
  Badge,
  Button,
  Callout,
  CodeTag,
  ConfirmButton,
  Due,
  ErrorBox,
  Field,
  FileList,
  FilePicker,
  Meta,
  Modal,
  People,
  PriorityBadge,
  Skeleton,
  Stepper,
  TaskStatusBadge,
  useToast,
} from "@/shared/ui";

type Panel = null | "submit" | "return";


/** Modal: vazifa ko'rish. Tekshiruv (qabul/qaytarish) ham shu yerda — alohida modal ochilmaydi. */
export default function TaskModal({ id, submitMode }: { id: number; submitMode?: boolean }) {
  const me = useMe();
  const { close, open } = useModal();
  const toast = useToast();
  const refresh = useRefresh();
  const meta = useMeta();
  const query = useQuery({ queryKey: ["task", id], queryFn: () => api.get<TaskDetail>(`/tasks/${id}/`) });
  const task = query.data;


  
  const [panel, setPanel] = useState<Panel>(submitMode ? "submit" : null);
  const [note, setNote] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [viewing, setViewing] = useState<FileInfo | null>(null);
  const [noteError, setNoteError] = useState<string>();

  const [isAddingSubtask, setIsAddingSubtask] = useState(false);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("");
  const [newSubtaskPeople, setNewSubtaskPeople] = useState<number[]>([]);
  // Ichki tahrir paneli: vazifa ijrochilari yoki bitta sub-vazifa ijrochilari (modal ustida modal yo'q)
  const [peopleEdit, setPeopleEdit] = useState<null | { target: "task" } | { target: "subtask"; sid: number }>(null);
  const [peopleDraft, setPeopleDraft] = useState<number[]>([]);
  const [workNote, setWorkNote] = useState("");
  const [workHours, setWorkHours] = useState("1");

  useEffect(() => {
    if (submitMode) setPanel("submit");
  }, [submitMode]);
  

  const act = useMutation({
    mutationFn: async (kind: "start" | "submit" | "accept" | "return" | "delete" | "files") => {
      if (kind === "start") return api.post(`/tasks/${id}/start/`);
      if (kind === "submit") return api.post<TaskDetail>(`/tasks/${id}/submit/`, formData({ note }, files));
      if (kind === "accept") return api.post(`/tasks/${id}/review/`, { decision: "accept", note });
      if (kind === "return") return api.post(`/tasks/${id}/review/`, { decision: "return", note });
      if (kind === "files") return api.post(`/tasks/${id}/files/`, formData({}, files));
      return api.del(`/tasks/${id}/`);
    },
    onSuccess: (d, kind) => {
      // Menejer ijrochi bo'lmay yuborsa, submit_ack to'ldirilgan holda qaytadi — hali yuborilmadi,
      // ijrochi tasdiqlashini kutamiz (submittedToast emas).
      const msg =
        kind === "submit" && (d as TaskDetail | undefined)?.submit_ack
          ? T.tasks.submitAckRequestedToast
          : {
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
    mutationFn: (data: { title: string; assignee_ids: number[] }) => api.post(`/tasks/${id}/subtasks/`, data),
    onSuccess: () => {
      refresh();
      setNewSubtaskTitle("");
      setNewSubtaskPeople([]);
      setIsAddingSubtask(false);
      toast(T.tasks.subtaskAddedToast);
    },
    onError: (e: Error) => toast(e.message, "error"),
  });

  const savePeople = useMutation({
    mutationFn: () =>
      peopleEdit?.target === "subtask"
        ? api.patch(`/tasks/${id}/subtasks/${peopleEdit.sid}/`, { assignee_ids: peopleDraft })
        : api.put(`/tasks/${id}/assignees/`, { assignee_ids: peopleDraft }),
    onSuccess: () => {
      toast(peopleEdit?.target === "subtask" ? T.tasks.subtaskPeopleSavedToast : T.tasks.assigneesSavedToast);
      setPeopleEdit(null);
      refresh();
    },
    onError: (e: Error) => toast(e.message, "error"),
  });

  const deleteSubtask = useMutation({
    mutationFn: (sid: number) => api.del(`/tasks/${id}/subtasks/${sid}/`),
    onSuccess: () => {
      refresh();
      toast(T.tasks.subtaskDeletedToast);
    },
    onError: (e: Error) => toast(e.message, "error"),
  });

  const worklog = useMutation({
    mutationFn: () => api.post<TaskDetail>(`/tasks/${id}/worklogs/`, { work_date: new Date().toISOString().slice(0, 10), hours: workHours, note: workNote }),
    onSuccess: () => {
      setWorkNote("");
      setWorkHours("1");
      refresh();
      toast(T.tasks.worklogSavedToast);
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

  const closeSubmit = () => (setPanel(null), setNote(""), setFiles([]), setNoteError(undefined));

  const footer = (() => {
    const a = task.actions;
    if (panel === "return") {
      return (
        <div className="inline-panel">
          <Field label={T.tasks.returnTitle} required error={noteError}>
            {(fid, bad) => (
              <textarea
                id={fid}
                className="textarea"
                aria-invalid={bad}
                autoFocus
                placeholder={T.tasks.returnPh}
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            )}
          </Field>
          <div className="row">
            <span className="spacer" />
            <Button variant="ghost" onClick={() => (setPanel(null), setNoteError(undefined))}>
              {T.common.cancel}
            </Button>
            <Button variant="danger" icon={<RotateCcw />} loading={act.isPending} onClick={() => act.mutate("return")}>
              {T.tasks.returnSend}
            </Button>
          </div>
        </div>
      );
    }
    const left = (
      <>
        {a.delete && (
          <ConfirmButton onConfirm={() => act.mutate("delete")} loading={act.isPending} confirmText={T.tasks.archiveConfirm}>
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
    <>
    <Modal
      size="lg"
      title={<><CodeTag code={task.code} /> {task.title}</>}
      subtitle={
        <>
          <TaskStatusBadge status={task.status} />
          {task.archived_at && <Badge tone="slate">{T.tasks.archived}</Badge>}
          <PriorityBadge priority={task.priority} />
          {task.is_overdue && <Badge tone="danger">{T.dashboard.overdue}</Badge>}
          {task.finished_late && <Badge tone="warning">{T.dashboard.late}</Badge>}
        </>
      }
      onClose={close}
      dirty={panel === "return" && Boolean(note.trim())}
      footer={footer}
    >
      <div className="stack" style={{ gap: 18 }}>
        <Stepper steps={statuses.map((s) => s.label)} current={step} bad={task.status === "in_progress" && Boolean(lastReturned)} />
        {task.status === "in_progress" && lastReturned && (
          <Callout tone="warning">
            <b>{T.tasks.returnTitle}</b> {lastReturned.review_note}
          </Callout>
        )}
        {task.submit_ack && (
          <Callout tone="info">{T.tasks.submitAckPending(task.submit_ack.pending.map((u) => u.full_name).join(", "))}</Callout>
        )}

        <div className="modal-split" style={{ marginTop: 8 }}>
          <div className="stack" style={{ gap: 16 }}>
            {task.description && <p className="prose" style={{ marginBottom: 8 }}>{task.description}</p>}

            <details className="details-section" open>
              <summary>{T.tasks.subtasks} {task.subtasks.length > 0 && `(${task.subtasks_progress.done}/${task.subtasks_progress.total})`}</summary>
              <div className="details-content stack-sm">
                {task.subtasks.length ? (
                  <div className="stack-sm">
                    {task.subtasks.map((s) => (
                      <div key={s.id} className="stack-sm">
                        <div className="row pick" style={{ width: "100%", gap: 6, margin: 0 }}>
                          <input
                            type="checkbox"
                            checked={s.is_done}
                            disabled={!s.can_toggle || toggle.isPending}
                            onChange={(e) => toggle.mutate({ sid: s.id, done: e.target.checked })}
                          />
                          <button
                            type="button"
                            className="row grow"
                            style={{ background: "none", border: 0, padding: 0, textAlign: "left", font: "inherit", color: "inherit", cursor: s.can_delete ? "pointer" : "default" }}
                            disabled={!s.can_delete}
                            aria-expanded={peopleEdit?.target === "subtask" && peopleEdit.sid === s.id}
                            aria-label={`${T.tasks.subtaskPeople}: ${s.title}`}
                            onClick={() => {
                              if (peopleEdit?.target === "subtask" && peopleEdit.sid === s.id) {
                                setPeopleEdit(null);
                                return;
                              }
                              setPeopleEdit({ target: "subtask", sid: s.id });
                              setPeopleDraft(s.assignees.map((u) => u.id));
                            }}
                          >
                            <span className="grow" style={{ textDecoration: s.is_done ? "line-through" : undefined, color: s.is_done ? "var(--muted)" : undefined }}>
                              {s.title}
                            </span>
                            {s.assignees.length ? <People users={s.assignees} /> : <span className="small muted">{T.tasks.subtaskNobody}</span>}
                          </button>
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
                        {peopleEdit?.target === "subtask" && peopleEdit.sid === s.id && (
                          <PeopleEditor
                            label={`${T.tasks.subtaskPeople}: ${s.title}`}
                            value={peopleDraft}
                            onChange={setPeopleDraft}
                            known={s.assignees}
                            saving={savePeople.isPending}
                            onSave={() => savePeople.mutate()}
                            onCancel={() => setPeopleEdit(null)}
                          />
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
                        {T.tasks.subtaskAdd}
                      </Button>
                    ) : (
                      <form
                        className="row-wrap"
                        style={{
                          gap: 8,
                          padding: 10,
                          background: "var(--surface-2)",
                          border: "1px solid var(--border)",
                          borderRadius: "var(--radius-sm)",
                        }}
                        onSubmit={(e) => {
                          e.preventDefault();
                          if (!newSubtaskTitle.trim()) return;
                          addSubtask.mutate({ title: newSubtaskTitle, assignee_ids: newSubtaskPeople });
                        }}
                      >
                        <input
                          autoFocus
                          className="input"
                          style={{ width: "100%" }}
                          placeholder={T.tasks.subtaskNewPh}
                          aria-label={T.tasks.subtaskNewPh}
                          value={newSubtaskTitle}
                          onChange={(e) => setNewSubtaskTitle(e.target.value)}
                        />
                        <div style={{ width: "100%" }}>
                          <span className="field-label">{T.tasks.subtaskPickPerson}</span>
                          <DeveloperPicker label={T.tasks.subtaskPickPerson} value={newSubtaskPeople} onChange={setNewSubtaskPeople} />
                          <span className="field-hint">{T.tasks.picker.joinHint}</span>
                        </div>
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

            <SubmissionsSection submissions={task.submissions} onOpenFile={setViewing} />

            <details className="details-section" open={Number(task.worklog_hours) > 0}>
              <summary>{T.tasks.worklog(Number(task.worklog_hours))}</summary>
              <div className="details-content stack">
                {task.actions.log_work && (
                  <form className="card card-pad row-wrap" onSubmit={(event) => { event.preventDefault(); if (workNote.trim()) worklog.mutate(); }}>
                    <input className="input" type="number" min="0.01" max="24" step="0.25" style={{ width: 112 }} value={workHours} aria-label={T.tasks.worklogHours} onChange={(event) => setWorkHours(event.target.value)} />
                    <input className="input grow" placeholder={T.tasks.worklogPh} value={workNote} onChange={(event) => setWorkNote(event.target.value)} />
                    <Button type="submit" variant="primary" loading={worklog.isPending} disabled={!workNote.trim()}>
                      {T.tasks.worklogSave}
                    </Button>
                  </form>
                )}
                {task.worklogs && task.worklogs.length > 0 ? (
                  <div className="stack-sm">
                    {task.worklogs.map((wl: WorkLog) => (
                      <div key={wl.id} className="row">
                        <Avatar user={wl.author} size="sm" />
                        <span className="grow">
                          <b>{wl.author.full_name}</b> <span className="muted">— {T.tasks.worklogItem(Number(wl.hours))}</span>
                          <p className="small muted" style={{ margin: 0 }}>{wl.note}</p>
                        </span>
                        <span className="small muted">{fmtDate(wl.work_date)}</span>
                        {wl.can_delete && (
                          <button type="button" className="icon-btn" title={T.common.delete} aria-label={T.common.delete} onClick={() => deleteWorklog.mutate(wl.id)}>
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="small muted">{T.tasks.worklogEmpty}</p>
                )}
              </div>
            </details>

            <details className="details-section" open>
              <summary>Izohlar</summary>
              <div className="details-content">
                <Comments type="task" id={task.id} readOnly={Boolean(task.archived_at)} />
              </div>
            </details>
          </div>

          <aside className="stack" style={{ gap: 16 }}>
            <details className="details-section" open>
              <summary>{T.tasks.info}</summary>
              <div className="details-content stack-sm">
                <Meta icon={<FolderKanban />} label={T.tasks.project}>{task.project.name}</Meta>
                <Meta icon={<CalendarClock />} label={T.tasks.col.due}>
                  <Due value={task.due_at} done={task.status === "done"} format={fmtDateTime} />
                </Meta>
                <Meta icon={<Users />} label={T.tasks.assignees}>
                  <div className="stack-sm">
                    {task.assignees.map((u) => (
                      <span key={u.id} className="row small">
                        <Avatar user={u} size="sm" /> {u.full_name}
                      </span>
                    ))}
                    {task.actions.manage_assignees && peopleEdit?.target !== "task" && (
                      <div>
                        <Button
                          size="sm"
                          variant="ghost"
                          icon={<UserPlus size={14} />}
                          onClick={() => {
                            setPeopleEdit({ target: "task" });
                            setPeopleDraft(task.assignees.map((u) => u.id));
                          }}
                        >
                          {T.tasks.assigneesEdit}
                        </Button>
                      </div>
                    )}
                  </div>
                </Meta>
                {peopleEdit?.target === "task" && (
                  <PeopleEditor
                    label={T.tasks.assignees}
                    value={peopleDraft}
                    onChange={setPeopleDraft}
                    known={task.assignees}
                    locked={me.role === "developer" ? [me.id] : []}
                    saving={savePeople.isPending}
                    disabled={!peopleDraft.length}
                    onSave={() => savePeople.mutate()}
                    onCancel={() => setPeopleEdit(null)}
                  />
                )}
                <Meta icon={<User />} label={T.tasks.createdByShort}>{task.created_by.full_name}</Meta>
              </div>
            </details>

            <details className="details-section" open>
              <summary>Fayllar ({task.files.length})</summary>
              <div className="details-content stack-sm">
                {task.files.length > 0 ? (
                  <FileList files={task.files} onOpen={setViewing} />
                ) : (
                  <span className="small muted">{T.tasks.noFiles}</span>
                )}
                {task.actions.add_files && (
                  <form onSubmit={(e) => { e.preventDefault(); if (files.length) act.mutate("files"); }}>
                    <div className="row" style={{ marginTop: 10 }}>
                      <FilePicker files={files} onChange={setFiles} />
                      {files.length > 0 && (
                        <Button type="submit" variant="primary" size="sm" loading={act.isPending} icon={<Upload size={14} />}>
                          {T.tasks.upload}
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
    {panel === "submit" && (
      <Modal
        size="sm"
        title={T.tasks.submit}
        onClose={closeSubmit}
        dirty={Boolean(note.trim() || files.length)}
        footer={
          <>
            <span className="spacer" />
            <Button variant="ghost" onClick={closeSubmit}>
              {T.common.cancel}
            </Button>
            <Button variant="primary" icon={<Send />} loading={act.isPending} onClick={() => act.mutate("submit")}>
              {T.tasks.submitSend}
            </Button>
          </>
        }
      >
        <div className="stack">
          <Field label={T.tasks.submitTitle} required error={noteError}>
            {(fid, bad) => (
              <textarea
                id={fid}
                className="textarea"
                aria-invalid={bad}
                autoFocus
                placeholder={T.tasks.submitPh}
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            )}
          </Field>
          <FilePicker files={files} onChange={setFiles} />
        </div>
      </Modal>
    )}
    </>
  );
}


/** Tekshiruvga yuborilgan izoh va fayllar tarixi. PM tekshirishda shu bo'lim ko'rinadi. */
function SubmissionsSection({ submissions, onOpenFile }: { submissions: Submission[]; onOpenFile: (f: FileInfo) => void }) {
  if (!submissions.length) return null;
  return (
    <details className="details-section" open>
      <summary>Topshirilgan ish ({submissions.length})</summary>
      <div className="details-content">
        <div className="timeline">
          {[...submissions].reverse().map((s) => (
            <div key={s.id} className="timeline-item">
              <Avatar user={s.submitted_by} size="sm" />
              <div className="grow">
                <div className="row" style={{ justifyContent: "space-between" }}>
                  <b>{s.submitted_by.full_name}</b>
                  <span className="small muted">{fmtDateTime(s.submitted_at)}</span>
                </div>
                <p style={{ margin: "4px 0" }}>{s.note}</p>
                {s.files.length > 0 && <FileList files={s.files} onOpen={onOpenFile} />}
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
  );
}

/** Ichki panel: ijrochilarni tanlash va saqlash (vazifa yoki sub-vazifa uchun). */
function PeopleEditor({
  label,
  value,
  onChange,
  known,
  locked,
  saving,
  disabled,
  onSave,
  onCancel,
}: {
  label: string;
  value: number[];
  onChange: (ids: number[]) => void;
  known: { id: number; full_name: string }[];
  locked?: number[];
  saving: boolean;
  disabled?: boolean;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="stack-sm" style={{ padding: 12, background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)" }}>
      <span className="field-label">{label}</span>
      <DeveloperPicker label={label} value={value} onChange={onChange} known={known} locked={locked} />
      <span className="field-hint">{T.tasks.picker.joinHint}</span>
      <div className="row" style={{ gap: 8 }}>
        <Button size="sm" variant="primary" loading={saving} disabled={disabled} onClick={onSave}>
          {T.common.save}
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>
          {T.common.cancel}
        </Button>
      </div>
    </div>
  );
}

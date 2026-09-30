import { useMutation, useQuery } from "@tanstack/react-query";
import { CalendarDays, FileText, Plus, Save, Upload, User } from "lucide-react";
import { useEffect, useState } from "react";

import { useModal } from "@/app/modals";
import { useDevelopers, useRefresh } from "@/app/queries";
import { Comments } from "@/features/comments/Comments";
import { DocTitle, DocViewer } from "@/features/docs/DocViewer";
import { TaskTable } from "@/features/tasks/TaskTable";
import { api, ApiError, formData, qs } from "@/shared/api";
import { fmtDate } from "@/shared/format";
import { useMeta } from "@/shared/meta";
import { T } from "@/shared/text";
import type { FileInfo, HistoryItem, ProjectDetail, ProjectStage, Task } from "@/shared/types";
import {
  Avatar,
  Button,
  Callout,
  ErrorBox,
  Field,
  FileList,
  FilePicker,
  Meta,
  Modal,
  Skeleton,
  StageBadge,
  Tabs,
  useToast,
} from "@/shared/ui";

type Tab = "main" | "tasks" | "team" | "files" | "comments" | "history";

/** Modal: loyiha ko'rish/tahrirlash. Buyurtmadan yaratilgan loyihada faqat sanalar va daraja o'zgaradi. */
export default function ProjectModal({ id }: { id: number }) {
  const { close, open } = useModal();
  const toast = useToast();
  const refresh = useRefresh();
  const meta = useMeta();
  const query = useQuery({ queryKey: ["project", id], queryFn: () => api.get<ProjectDetail>(`/projects/${id}/`) });
  const tasks = useQuery({ queryKey: ["tasks", "project", id], queryFn: () => api.get<Task[]>(`/tasks/${qs({ project: id, all: 1 })}`) });
  const p = query.data;
  const manager = Boolean(p?.actions.edit);
  const developers = useDevelopers(manager);

  const [tab, setTab] = useState<Tab>("main");
  const [viewing, setViewing] = useState<FileInfo | null>(null);
  const [form, setForm] = useState({ name: "", description: "", start_date: "", end_date: "" });
  const [members, setMembers] = useState<number[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<ApiError | null>(null);

  const history = useQuery({
    queryKey: ["history", "project", id],
    queryFn: () => api.get<{ results: HistoryItem[] }>(`/history/${qs({ project: id, paginated: 1 })}`),
    enabled: tab === "history",
  });

  useEffect(() => {
    if (!p) return;
    setForm({ name: p.name, description: p.description, start_date: p.start_date, end_date: p.end_date });
    setMembers(p.members.map((m) => m.id));
  }, [p]);

  const onError = (e: Error) => {
    const err = e instanceof ApiError ? e : new ApiError(0, e.message);
    setError(err);
    if (!Object.keys(err.fields).length) toast(err.message, "error");
  };
  const done = (msg: string) => () => {
    toast(msg);
    setError(null);
    refresh();
  };

  const save = useMutation({
    mutationFn: () => api.patch(`/projects/${id}/`, p?.actions.edit_info ? form : { start_date: form.start_date, end_date: form.end_date }),
    onSuccess: done(T.common.saved),
    onError,
  });
  const setStage = useMutation({ mutationFn: (stage: ProjectStage) => api.patch(`/projects/${id}/`, { stage }), onSuccess: done(T.common.saved), onError });
  const saveTeam = useMutation({ mutationFn: () => api.put(`/projects/${id}/members/`, { member_ids: members }), onSuccess: done(T.projects.teamSaved), onError });
  const upload = useMutation({
    mutationFn: () => api.post(`/projects/${id}/files/`, formData({}, files)),
    onSuccess: () => (setFiles([]), done(T.common.saved)()),
    onError,
  });

  if (viewing)
    return (
      <Modal size="lg" title={<DocTitle file={viewing} onBack={() => setViewing(null)} />} onClose={close}>
        <DocViewer file={viewing} />
      </Modal>
    );

  if (!p)
    return (
      <Modal size="lg" title={query.error ? T.common.notFound : T.common.loading} onClose={close}>
        {query.error ? <ErrorBox error={query.error} /> : <Skeleton h={260} />}
      </Modal>
    );

  const infoDirty = form.name !== p.name || form.description !== p.description || form.start_date !== p.start_date || form.end_date !== p.end_date;
  const teamDirty = JSON.stringify([...members].sort()) !== JSON.stringify(p.members.map((m) => m.id).sort());
  const fe = (k: string) => error?.field(k);
  const pct = p.progress.total ? Math.round((p.progress.done / p.progress.total) * 100) : 0;

  return (
    <Modal
      size="lg"
      title={p.name}
      subtitle={
        <>
          <StageBadge stage={p.stage} />
          <span className="small muted">
            {fmtDate(p.start_date)} — {fmtDate(p.end_date)}
          </span>
        </>
      }
      headerExtra={
        manager && (
          <select className="select" style={{ width: 180 }} value={p.stage} aria-label={T.projects.stage} onChange={(e) => setStage.mutate(e.target.value as ProjectStage)}>
            {meta.project_stages.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        )
      }
      onClose={close}
      dirty={(infoDirty || teamDirty || files.length > 0) && manager}
      footer={
        <>
          {p.actions.add_task && (
            <Button icon={<Plus />} onClick={() => open({ new: "task", project: p.id })}>
              {T.projects.addTask}
            </Button>
          )}
          <span className="spacer" />
          {tab === "main" && manager && (
            <Button variant="primary" icon={<Save />} disabled={!infoDirty} loading={save.isPending} onClick={() => save.mutate()}>
              {T.common.save}
            </Button>
          )}
          {tab === "team" && manager && (
            <Button variant="primary" icon={<Save />} disabled={!teamDirty} loading={saveTeam.isPending} onClick={() => saveTeam.mutate()}>
              {T.projects.saveTeam}
            </Button>
          )}
          {tab === "files" && manager && files.length > 0 && (
            <Button variant="primary" icon={<Upload />} loading={upload.isPending} onClick={() => upload.mutate()}>
              {T.common.save}
            </Button>
          )}
        </>
      }
    >
      <div className="stack" style={{ gap: 18 }}>
        <div className="stack-sm" style={{ gap: 4 }}>
          <div className="progress">
            <span style={{ width: `${pct}%` }} />
          </div>
          <span className="small muted">{T.projects.progress(p.progress.done, p.progress.total)}</span>
        </div>
        <Tabs<Tab>
          value={tab}
          onChange={setTab}
          tabs={[
            { key: "main", label: T.projects.tabMain },
            { key: "tasks", label: `${T.projects.tabTasks} (${p.progress.total})` },
            { key: "team", label: `${T.projects.tabTeam} (${p.members.length})` },
            { key: "files", label: `${T.projects.tabFiles} (${p.files.length})` },
            { key: "comments", label: T.common.comments },
            { key: "history", label: "Tarix" },
          ]}
        />

        {tab === "history" && (
          <div className="card card-pad stack">
            <h4 style={{ margin: 0 }}>Loyiha faolligi</h4>
            {history.isLoading && <Skeleton h={140} />}
            {history.error && <ErrorBox error={history.error} onRetry={() => history.refetch()} />}
            <div className="timeline" style={{ marginTop: 10 }}>
              {!history.isLoading && !history.data?.results.length && <p className="muted">{T.projects.noActivity}</p>}
              {history.data?.results.map((item) => (
                <div key={item.id} className="timeline-item">
                  {item.actor ? <Avatar user={item.actor} size="sm" /> : <span className="avatar sm" />}
                  <div className="grow">
                    <div style={{ fontWeight: 500 }}>{item.message}</div>
                    <div className="small muted">{fmtDate(item.created_at)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === "main" && (
          <div className="modal-split">
            <div className="stack">
              {p.order && <Callout tone="info">{T.projects.fromOrderLocked}</Callout>}
              {manager ? (
                <>
                  <Field label={T.projects.name} error={fe("name")}>
                    {(fid, bad) => <input id={fid} className="input" aria-invalid={bad} value={form.name} disabled={!p.actions.edit_info} onChange={(e) => setForm({ ...form, name: e.target.value })} />}
                  </Field>
                  <Field label={T.projects.description}>
                    {(fid) => <textarea id={fid} className="textarea" value={form.description} disabled={!p.actions.edit_info} onChange={(e) => setForm({ ...form, description: e.target.value })} />}
                  </Field>
                  <div className="grid-2">
                    <Field label={T.projects.startDate} error={fe("start_date")}>
                      {(fid, bad) => <input id={fid} type="date" className="input" aria-invalid={bad} value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />}
                    </Field>
                    <Field label={T.projects.endDate} error={fe("end_date")}>
                      {(fid, bad) => <input id={fid} type="date" className="input" aria-invalid={bad} min={form.start_date} value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />}
                    </Field>
                  </div>
                </>
              ) : (
                <p className="prose">{p.description || T.common.none}</p>
              )}
            </div>
            <aside className="card card-pad meta">
              {p.order && (
                <Meta icon={<FileText />} label={T.projects.order}>
                  <button className="btn btn-sm btn-ghost" style={{ padding: 0, color: "var(--primary)" }} onClick={() => open({ order: p.order!.id })}>
                    {p.order.title}
                  </button>
                  <div className="small muted">{p.order.department_name}</div>
                </Meta>
              )}
              <Meta icon={<CalendarDays />} label={T.projects.startDate}>
                {fmtDate(p.start_date)}
              </Meta>
              <Meta icon={<CalendarDays />} label={T.projects.endDate}>
                {fmtDate(p.end_date)}
              </Meta>
              <Meta icon={<User />} label={T.projects.createdBy}>
                {p.created_by.full_name}
              </Meta>
            </aside>
          </div>
        )}

        {tab === "tasks" && (
          <div className="card">
            <TaskTable tasks={tasks.data} loading={tasks.isLoading} emptyHint={p.actions.add_task ? T.tasks.emptyHint : undefined} />
          </div>
        )}

        {tab === "team" &&
          (manager ? (
            <div className="pick-list" style={{ maxHeight: "none" }}>
              {developers.isLoading && <Skeleton h={100} />}
              {developers.data?.map((d) => (
                <label key={d.id} className="pick">
                  <input type="checkbox" checked={members.includes(d.id)} onChange={(e) => setMembers((xs) => (e.target.checked ? [...xs, d.id] : xs.filter((x) => x !== d.id)))} />
                  <Avatar user={d} size="sm" />
                  <span className="grow">
                    <b style={{ fontWeight: 600 }}>{d.full_name}</b>
                    <span className="small muted"> · {d.specialty}</span>
                  </span>
                </label>
              ))}
            </div>
          ) : (
            <div className="stack-sm">
              {!p.members.length && <p className="muted">{T.projects.teamEmpty}</p>}
              {p.members.map((m) => (
                <span key={m.id} className="row">
                  <Avatar user={m} size="sm" /> {m.full_name}
                </span>
              ))}
            </div>
          ))}

        {tab === "files" && (
          <div className="stack">
            <FileList files={p.files} onOpen={setViewing} />
            {p.actions.files && <FilePicker files={files} onChange={setFiles} />}
          </div>
        )}

        {tab === "comments" && <Comments type="project" id={p.id} />}
      </div>
    </Modal>
  );
}

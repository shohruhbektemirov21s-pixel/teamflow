import { useMutation, useQuery } from "@tanstack/react-query";
import { CalendarDays, CheckCircle2, FileText, Pencil, Plus, Save, Search, Upload, User, UserPlus, X } from "lucide-react";
import { useEffect, useState } from "react";

import { useModal } from "@/app/modals";
import { useDevelopers, useRefresh } from "@/app/queries";
import { Comments } from "@/features/comments/Comments";
import { DocTitle, DocViewer } from "@/features/docs/DocViewer";
import { TaskTable } from "@/features/tasks/TaskTable";
import { Pagination } from "@/shared/ui/Pagination";
import { api, ApiError, formData, qs } from "@/shared/api";
import { fmtDate } from "@/shared/format";
import { useMeta } from "@/shared/meta";
import { T } from "@/shared/text";
import type { FileInfo, HistoryItem, ProjectDetail, ProjectStage, Task } from "@/shared/types";
import {
  Avatar,
  Button,
  Callout,
  CodeTag,
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

/** Modal: loyiha ko'rish/tahrirlash. Buyurtmadan yaratilgan loyihani "Yakunlash" tugmasi bosilsa, u darrov
 * Yakunlangan bo'lmaydi — avval boshqarma tasdiqlashi kerak ("Tasdiqlash kutilmoqda"). */
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
  const [historyPage, setHistoryPage] = useState(1);
  const [viewing, setViewing] = useState<FileInfo | null>(null);
  const [editingInfo, setEditingInfo] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", start_date: "", end_date: "" });
  const [members, setMembers] = useState<number[]>([]);
  const [teamQ, setTeamQ] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<ApiError | null>(null);

  const history = useQuery({
    queryKey: ["history", "project", id, historyPage],
    queryFn: () => api.get<{ results: HistoryItem[]; next: boolean; previous: boolean }>(
      `/history/${qs({ project: id, paginated: 1, page: historyPage === 1 ? undefined : historyPage })}`),
    enabled: tab === "history",
  });

  useEffect(() => {
    if (!p) return;
    setForm({ name: p.name, description: p.description, start_date: p.start_date, end_date: p.end_date });
    setMembers(p.members.map((m) => m.id));
    setEditingInfo(false);
  }, [p?.id]);

  const cancelEdit = () => {
    if (!p) return;
    setForm({ name: p.name, description: p.description, start_date: p.start_date, end_date: p.end_date });
    setEditingInfo(false);
  };

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
    mutationFn: () => api.patch(`/projects/${id}/`, form),
    onSuccess: () => (done(T.common.saved)(), setEditingInfo(false)),
    onError,
  });
  const setStage = useMutation({
    mutationFn: (stage: ProjectStage) => api.patch(`/projects/${id}/`, { stage }),
    onSuccess: (_d, stage) => done(stage === "done" && p?.order ? T.projects.requestCompletionToast : T.common.saved)(),
    onError,
  });
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
  // Jamoa: ro'yxatda faqat loyiha a'zolari; qolgan dasturchilar qidiruv orqali qo'shiladi.
  const savedIds = new Set(p.members.map((m) => m.id));
  const devById = new Map((developers.data ?? []).map((d) => [d.id, d]));
  const memberRows = members.map((mid) => {
    const saved = p.members.find((m) => m.id === mid);
    return devById.get(mid) ?? { id: mid, full_name: saved?.full_name ?? "", specialty: "" };
  });
  const needle = teamQ.trim().toLowerCase();
  const candidates = needle
    ? (developers.data ?? []).filter((d) => !members.includes(d.id) && `${d.full_name} ${d.specialty}`.toLowerCase().includes(needle))
    : [];
  const pct = p.progress.total ? Math.round((p.progress.done / p.progress.total) * 100) : 0;

  return (
    <Modal
      size="lg"
      title={
        <>
          <CodeTag code={p.code} /> {p.name}
        </>
      }
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
          <>
            {Boolean(p.order) && p.stage_targets.includes("done") && (
              <Button size="sm" variant="success" icon={<CheckCircle2 size={16} />} loading={setStage.isPending} onClick={() => setStage.mutate("done")}>
                {T.projects.requestCompletion}
              </Button>
            )}
            {editingInfo ? (
              <Button size="sm" variant="ghost" onClick={cancelEdit}>
                {T.common.cancel}
              </Button>
            ) : (
              <Button size="sm" variant="ghost" icon={<Pencil size={16} />} onClick={() => setEditingInfo(true)}>
                {T.common.edit}
              </Button>
            )}
            <select
              className="select"
              style={{ width: 180 }}
              value={p.stage}
              aria-label={T.projects.stage}
              disabled={!p.stage_targets.length}
              onChange={(e) => setStage.mutate(e.target.value as ProjectStage)}
            >
              {meta.project_stages
                .filter((s) => s.value === p.stage || (p.stage_targets.includes(s.value as ProjectStage) && !(p.order && s.value === "done")))
                .map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
            </select>
          </>
        )
      }
      onClose={close}
      dirty={(editingInfo && infoDirty) || teamDirty || files.length > 0}
      footer={
        <>
          {p.actions.add_task && (
            <Button icon={<Plus />} onClick={() => open({ new: "task", project: p.id })}>
              {T.projects.addTask}
            </Button>
          )}
          <span className="spacer" />
          {tab === "main" && manager && editingInfo && (
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
            { key: "history", label: T.projects.tabHistory },
          ]}
        />

        {tab === "history" && (
          <div className="card card-pad stack">
            <h4 style={{ margin: 0 }}>{T.projects.activityTitle}</h4>
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
            <Pagination data={history.data} page={historyPage} onPageChange={setHistoryPage} />
          </div>
        )}

        {tab === "main" && (
          <div className="modal-split">
            <div className="stack">
              {p.order && <Callout tone="info">{T.projects.fromOrderLocked}</Callout>}
              {p.stage === "pending_approval" && <Callout tone="info">{T.projects.pendingApproval}</Callout>}
              {manager && editingInfo ? (
                <>
                  <Field label={T.projects.name} error={fe("name")}>
                    {(fid, bad) => <input id={fid} className="input" aria-invalid={bad} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />}
                  </Field>
                  <Field label={T.projects.description}>
                    {(fid) => <textarea id={fid} className="textarea" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />}
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
            <div className="stack">
              <div className="search-field">
                <Search />
                <input className="input" placeholder={T.projects.teamSearchPh} aria-label={T.projects.teamSearchPh} value={teamQ} onChange={(e) => setTeamQ(e.target.value)} />
              </div>
              {needle && (
                <div className="pick-list">
                  {developers.isLoading && <Skeleton h={60} />}
                  {candidates.map((d) => (
                    <button
                      key={d.id}
                      type="button"
                      className="pick"
                      style={{ background: "var(--surface)", textAlign: "left", font: "inherit", color: "inherit" }}
                      onClick={() => {
                        setMembers((xs) => [...xs, d.id]);
                        setTeamQ("");
                      }}
                    >
                      <Avatar user={d} size="sm" />
                      <span className="grow">
                        <b style={{ fontWeight: 600 }}>{d.full_name}</b>
                        {d.specialty && <span className="small muted"> · {d.specialty}</span>}
                      </span>
                      <span className="row small" style={{ gap: 4, color: "var(--primary)" }}>
                        <UserPlus size={16} /> {T.projects.teamAdd}
                      </span>
                    </button>
                  ))}
                  {!developers.isLoading && !candidates.length && <p className="small muted">{T.projects.teamNoMatch}</p>}
                </div>
              )}
              {teamDirty && <Callout tone="info">{T.projects.teamSaveFirst}</Callout>}
              <div className="pick-list" style={{ maxHeight: "none" }}>
                {!memberRows.length && <p className="muted">{T.projects.teamEmpty}</p>}
                {memberRows.map((d) => (
                  <div key={d.id} className="pick" style={{ cursor: "default", flexWrap: "wrap" }}>
                    <Avatar user={d} size="sm" />
                    <span className="grow">
                      <b style={{ fontWeight: 600 }}>{d.full_name}</b>
                      {d.specialty && <span className="small muted"> · {d.specialty}</span>}
                    </span>
                    {savedIds.has(d.id) ? (
                      <Button size="sm" icon={<Plus />} disabled={teamDirty || d.is_on_business_trip} title={d.is_on_business_trip ? T.people.tripBlocked : undefined} onClick={() => open({ new: "task", project: p.id, assignee: d.id })}>
                        {T.projects.giveTask}
                      </Button>
                    ) : (
                      <span className="small muted">{T.projects.teamUnsaved}</span>
                    )}
                    <Button size="sm" variant="ghost" icon={<X />} onClick={() => setMembers((xs) => xs.filter((x) => x !== d.id))}>
                      {T.projects.teamRemove}
                    </Button>
                  </div>
                ))}
              </div>
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

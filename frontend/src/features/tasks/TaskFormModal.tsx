import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, UserPlus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { isManager, useMe } from "@/app/auth";
import { useModal } from "@/app/modals";
import { useProjects, useRefresh } from "@/app/queries";
import { DeveloperPicker } from "@/features/people/DeveloperPicker";
import { api, ApiError, formData } from "@/shared/api";
import { fromLocalInput, toLocalInput } from "@/shared/format";
import { useMeta } from "@/shared/meta";
import { T } from "@/shared/text";
import type { Priority, ProjectDetail, TaskDetail } from "@/shared/types";
import { Avatar, Button, Callout, Field, FilePicker, Modal, Segmented, Skeleton, useToast } from "@/shared/ui";

interface SubtaskDraft {
  id?: number;
  title: string;
  assignee_ids: number[];
  is_done?: boolean;
}

/**
 * Modal: vazifa yaratish / tahrirlash.
 * Menejer — loyiha jamoasidan bir nechta ijrochi tanlaydi. Dasturchi — faqat o'ziga ("Mening ishim").
 */
export default function TaskFormModal({ projectId, editId, assigneeId }: { projectId?: number; editId?: number; assigneeId?: number }) {
  const me = useMe();
  const manager = isManager(me);
  const { close, open } = useModal();
  const toast = useToast();
  const refresh = useRefresh();
  const queryClient = useQueryClient();
  const meta = useMeta();
  const projects = useProjects();
  const existing = useQuery({ queryKey: ["task", editId], queryFn: () => api.get<TaskDetail>(`/tasks/${editId}/`), enabled: Boolean(editId) });

  const [project, setProject] = useState<number | "">(projectId ?? "");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<Priority>("medium");
  const [startsAt, setStartsAt] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [assignees, setAssignees] = useState<number[]>(assigneeId ? [assigneeId] : []);
  const [subtasks, setSubtasks] = useState<SubtaskDraft[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<ApiError | null>(null);
  const [touched, setTouched] = useState(false);

  // Tahrirlash: mavjud qiymatlarni bir marta to'ldirish
  useEffect(() => {
    const t = existing.data;
    if (!t) return;
    setProject(t.project.id);
    setTitle(t.title);
    setDescription(t.description);
    setPriority(t.priority);
    setStartsAt(toLocalInput(t.starts_at));
    setDueAt(toLocalInput(t.due_at));
    setAssignees(t.assignees.map((a) => a.id));
    setSubtasks(t.subtasks.map((s) => ({ id: s.id, title: s.title, assignee_ids: s.assignees.map((u) => u.id), is_done: s.is_done })));
  }, [existing.data]);

  // Bitta loyiha bo'lsa — avtomatik tanlanadi
  useEffect(() => {
    if (!project && projects.data?.length === 1) setProject(projects.data[0]!.id);
  }, [projects.data, project]);

  const team = useQuery({
    queryKey: ["project", project],
    queryFn: () => api.get<ProjectDetail>(`/projects/${project}/`),
    enabled: Boolean(project),
    select: (p) => p.members,
  });

  const addMember = useMutation({
    mutationFn: async () => {
      if (!project || !assigneeId) return;
      const currentIds = (team.data ?? []).map((m) => m.id);
      if (!currentIds.includes(assigneeId)) {
        await api.put(`/projects/${project}/members/`, { member_ids: [...currentIds, assigneeId] });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project", project] });
      if (assigneeId) {
        setAssignees((xs) => (xs.includes(assigneeId) ? xs : [...xs, assigneeId]));
      }
      toast(T.tasks.addedToTeamToast);
    },
    onError: (e: Error) => toast(e.message, "error"),
  });

  // Loyiha almashsa — jamoada bo'lmagan ijrochilar olib tashlanadi
  useEffect(() => {
    if (!team.data) return;
    const ids = new Set(team.data.map((m) => m.id));
    if (assigneeId && ids.has(assigneeId)) {
      setAssignees((xs) => (xs.includes(assigneeId) ? xs : [...xs, assigneeId]));
    } else {
      setAssignees((xs) => xs.filter((x) => ids.has(x)));
    }
  }, [team.data, assigneeId]);

  const save = useMutation({
    mutationFn: () => {
      const body = {
        project: Number(project),
        title,
        description,
        priority,
        starts_at: fromLocalInput(startsAt),
        due_at: fromLocalInput(dueAt),
        assignee_ids: manager ? assignees : [me.id],
        subtasks: subtasks.filter((s) => s.title.trim()),
      };
      if (editId) {
        const { project: _p, ...patch } = body;
        void _p;
        return api.patch<TaskDetail>(`/tasks/${editId}/`, patch);
      }
      return api.post<TaskDetail>("/tasks/", formData(body, files));
    },
    onSuccess: (task) => {
      toast(editId ? T.common.saved : T.tasks.createdToast);
      refresh();
      open({ task: task.id }, true);
    },
    onError: (e: Error) => setError(e instanceof ApiError ? e : new ApiError(0, e.message)),
  });

  const fe = (k: string) => error?.field(k);
  const members = team.data ?? [];
  const dirty = touched;
  const existingAssignees = new Set(existing.data?.assignees.map((a) => a.id) ?? []);
  const tripSelected = members.some((m) => m.is_on_business_trip && assignees.includes(m.id) && !existingAssignees.has(m.id));
  const canSave = Boolean(project) && title.trim().length > 0 && (!manager || assignees.length > 0) && !tripSelected;
  const projectOptions = useMemo(() => projects.data ?? [], [projects.data]);

  if (editId && !existing.data)
    return (
      <Modal title={T.common.loading} onClose={close}>
        <Skeleton h={300} />
      </Modal>
    );

  return (
    <Modal
      title={editId ? T.common.edit : T.tasks.new}
      onClose={close}
      dirty={dirty}
      footer={
        <>
          <span className="spacer" />
          <Button variant="ghost" onClick={close}>
            {T.common.cancel}
          </Button>
          <Button variant="primary" loading={save.isPending} disabled={!canSave} onClick={() => save.mutate()}>
            {T.common.save}
          </Button>
        </>
      }
    >
      <form className="stack" style={{ gap: 16 }} onChange={() => setTouched(true)} onSubmit={(e) => (e.preventDefault(), canSave && save.mutate())}>
        {error && !Object.keys(error.fields).length && <Callout tone="danger">{error.message}</Callout>}
        <Field label={T.tasks.project} required error={fe("project")}>
          {(id, bad) => (
            <select id={id} className="select" aria-invalid={bad} value={project} disabled={Boolean(editId)} onChange={(e) => setProject(e.target.value ? Number(e.target.value) : "")}>
              <option value="">{T.tasks.pickProject}</option>
              {projectOptions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field label={T.tasks.name} required error={fe("title")}>
          {(id, bad) => <input id={id} className="input" aria-invalid={bad} placeholder={T.tasks.namePh} value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />}
        </Field>
        <Field label={T.tasks.description} error={fe("description")}>
          {(id) => <textarea id={id} className="textarea" placeholder={T.tasks.descriptionPh} value={description} onChange={(e) => setDescription(e.target.value)} />}
        </Field>
        <div className="field">
          <span className="field-label">{T.tasks.priority}</span>
          <Segmented<Priority> value={priority} onChange={(v) => (setPriority(v), setTouched(true))} options={meta.options<Priority>("priorities")} />
        </div>
        <div className="grid-2">
          <Field label={T.tasks.startsAt} error={fe("starts_at")}>
            {(id) => <input id={id} type="datetime-local" className="input" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />}
          </Field>
          <Field label={T.tasks.dueAt} error={fe("due_at")}>
            {(id, bad) => <input id={id} type="datetime-local" className="input" aria-invalid={bad} value={dueAt} onChange={(e) => setDueAt(e.target.value)} />}
          </Field>
        </div>

        {manager && (
          <div className="field">
            <span className="field-label">
              {T.tasks.assignees} <span className="req">*</span>
            </span>
            {!project ? (
              <span className="field-hint">{T.tasks.pickProject}</span>
            ) : team.isLoading ? (
              <Skeleton h={40} />
            ) : !members.length ? (
              <Callout tone="warning">{T.tasks.noTeam}</Callout>
            ) : (
              <div className="chips" role="group" aria-label={T.tasks.assignees}>
                {members.map((m) => {
                  const on = assignees.includes(m.id);
                  return (
                    <button
                      key={m.id}
                      type="button"
                      className="chip"
                      aria-pressed={on}
                      disabled={m.is_on_business_trip && !on}
                      title={m.is_on_business_trip ? T.people.tripBlocked : undefined}
                      onClick={() => (setAssignees((xs) => (on ? xs.filter((x) => x !== m.id) : [...xs, m.id])), setTouched(true))}
                    >
                      <Avatar user={m} size="sm" />
                      {m.full_name}
                      {m.is_on_business_trip && <span className="small muted">· {T.people.onBusinessTrip}</span>}
                    </button>
                  );
                })}
              </div>
            )}
            {tripSelected && <span className="field-error">{T.people.tripBlocked}</span>}
            {manager && Boolean(project) && Boolean(assigneeId) && team.data && !team.data.some((m) => m.id === assigneeId) && (
              <div style={{ marginTop: 8 }}>
                <Callout tone="info">
                  <div className="row" style={{ justifyContent: "space-between", width: "100%", gap: 8 }}>
                    <span>{T.tasks.notInTeam}</span>
                    <Button size="sm" variant="primary" icon={<UserPlus />} loading={addMember.isPending} onClick={() => addMember.mutate()}>
                      {T.tasks.addToTeam}
                    </Button>
                  </div>
                </Callout>
              </div>
            )}
            {fe("assignee_ids") ? <span className="field-error">{fe("assignee_ids")}</span> : <span className="field-hint">{T.tasks.assigneesHint}</span>}
          </div>
        )}

        <div className="field">
          <span className="field-label">{T.tasks.subtasks}</span>
          {subtasks.map((s, i) => (
            <div key={i} className="stack-sm">
              <div className="row">
                <input
                  className="input grow"
                  placeholder={T.tasks.subtaskPh}
                  value={s.title}
                  aria-label={T.tasks.subtaskPh}
                  onChange={(e) => setSubtasks((xs) => xs.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))}
                />
                <button type="button" className="icon-btn" aria-label={T.common.delete} onClick={() => setSubtasks((xs) => xs.filter((_, j) => j !== i))}>
                  <Trash2 />
                </button>
              </div>
              {manager && (
                <DeveloperPicker
                  label={`${T.tasks.subtaskPeople}: ${s.title || T.tasks.subtaskPh}`}
                  options={members}
                  value={s.assignee_ids}
                  onChange={(ids) => setSubtasks((xs) => xs.map((x, j) => (j === i ? { ...x, assignee_ids: ids } : x)))}
                />
              )}
            </div>
          ))}
          {fe("subtasks") && <span className="field-error">{fe("subtasks")}</span>}
          <div>
            <Button size="sm" icon={<Plus />} onClick={() => (setSubtasks((xs) => [...xs, { title: "", assignee_ids: [] }]), setTouched(true))}>
              {T.tasks.subtaskAdd}
            </Button>
          </div>
        </div>

        {!editId && (
          <div className="field">
            <span className="field-label">{T.common.files}</span>
            <FilePicker files={files} onChange={(f) => (setFiles(f), setTouched(true))} />
          </div>
        )}
      </form>
    </Modal>
  );
}

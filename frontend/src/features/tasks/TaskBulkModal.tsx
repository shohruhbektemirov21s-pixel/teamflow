import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { useModal } from "@/app/modals";
import { useProjects, useRefresh } from "@/app/queries";
import { api, ApiError } from "@/shared/api";
import { fromLocalInput } from "@/shared/format";
import { useMeta } from "@/shared/meta";
import { T } from "@/shared/text";
import type { Priority, ProjectDetail } from "@/shared/types";
import { Avatar, Button, Callout, Field, Modal, Segmented, Skeleton, useToast } from "@/shared/ui";

export default function TaskBulkModal({ projectId }: { projectId?: number }) {
  const { close } = useModal();
  const toast = useToast();
  const refresh = useRefresh();
  const meta = useMeta();
  const projects = useProjects();

  const [project, setProject] = useState<number | "">(projectId ?? "");
  const [titlesText, setTitlesText] = useState("");
  const [priority, setPriority] = useState<Priority>("medium");
  const [dueAt, setDueAt] = useState("");
  const [assignees, setAssignees] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);

  const team = useQuery({
    queryKey: ["project", project],
    queryFn: () => api.get<ProjectDetail>(`/projects/${project}/`),
    enabled: Boolean(project),
    select: (p) => p.members,
  });

  const titles = titlesText.split("\n").map(t => t.trim().replace(/^[-*]\s*/, "")).filter(Boolean);

  const save = useMutation({
    mutationFn: () => {
      return api.post("/tasks/bulk/", {
        project: Number(project),
        titles,
        priority,
        assignee_ids: assignees,
        due_at: fromLocalInput(dueAt),
      });
    },
    onSuccess: (res: any) => {
      toast(`${res.created} ta vazifa yaratildi`, "ok");
      refresh();
      close();
    },
    onError: (e: Error) => setError(e instanceof ApiError ? e.message : e.message),
  });

  const canSave = Boolean(project) && titles.length > 0 && assignees.length > 0;
  const projectOptions = projects.data ?? [];
  const members = team.data ?? [];

  return (
    <Modal
      title="Ko'plab vazifa yaratish"
      onClose={close}
      footer={
        <>
          <span className="spacer" />
          <Button variant="ghost" onClick={close}>
            {T.common.cancel}
          </Button>
          <Button variant="primary" loading={save.isPending} disabled={!canSave} onClick={() => save.mutate()}>
            Yaratish ({titles.length})
          </Button>
        </>
      }
    >
      <form className="stack" style={{ gap: 16 }} onSubmit={(e) => (e.preventDefault(), canSave && save.mutate())}>
        {error && <Callout tone="danger">{error}</Callout>}
        <Field label={T.tasks.project} required>
          {(id) => (
            <select id={id} className="select" value={project} onChange={(e) => setProject(e.target.value ? Number(e.target.value) : "")}>
              <option value="">{T.tasks.pickProject}</option>
              {projectOptions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          )}
        </Field>
        
        <Field label="Vazifalar ro'yxati (har qatorda bittadan)" required>
          {(id) => (
            <textarea 
              id={id} 
              className="textarea" 
              rows={8}
              placeholder="Login formasi&#10;API ulanishi&#10;Tugmalar dizayni" 
              value={titlesText} 
              onChange={(e) => setTitlesText(e.target.value)} 
            />
          )}
        </Field>

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
            <div className="chips" role="group">
              {members.map((m) => {
                const on = assignees.includes(m.id);
                return (
                  <button
                    key={m.id}
                    type="button"
                    className="chip"
                    aria-pressed={on}
                    onClick={() => setAssignees((xs) => (on ? xs.filter((x) => x !== m.id) : [...xs, m.id]))}
                  >
                    <Avatar user={m} size="sm" />
                    {m.full_name}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="field">
          <span className="field-label">{T.tasks.priority}</span>
          <Segmented<Priority> value={priority} onChange={(v) => setPriority(v)} options={meta.options<Priority>("priorities")} />
        </div>
        
        <Field label={T.tasks.dueAt}>
          {(id) => <input id={id} type="datetime-local" className="input" value={dueAt} onChange={(e) => setDueAt(e.target.value)} />}
        </Field>
      </form>
    </Modal>
  );
}

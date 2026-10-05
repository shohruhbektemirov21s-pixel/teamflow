import { useMutation, useQuery } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";

import { useModal } from "@/app/modals";
import { useProjects, useRefresh } from "@/app/queries";
import { api, ApiError } from "@/shared/api";
import { fromLocalInput } from "@/shared/format";
import { useMeta } from "@/shared/meta";
import { T } from "@/shared/text";
import type { Priority, ProjectDetail } from "@/shared/types";
import { Avatar, Button, Callout, Field, Modal, Skeleton, useToast } from "@/shared/ui";

type Draft = { title: string; assignee_ids: number[]; priority: Priority; due_at: string };
const emptyRow = (): Draft => ({ title: "", assignee_ids: [], priority: "medium", due_at: "" });

/** Bitta modalda har bir vazifani tegishli ijrochiga taqsimlash. */
export default function TaskBulkModal({ projectId }: { projectId?: number }) {
  const { close } = useModal();
  const toast = useToast();
  const refresh = useRefresh();
  const meta = useMeta();
  const projects = useProjects();
  const [project, setProject] = useState<number | "">(projectId ?? "");
  const [rows, setRows] = useState<Draft[]>([emptyRow()]);
  const [error, setError] = useState<string | null>(null);

  const team = useQuery({
    queryKey: ["project", project],
    queryFn: () => api.get<ProjectDetail>(`/projects/${project}/`),
    enabled: Boolean(project),
    select: (data) => data.members,
  });

  const save = useMutation({
    mutationFn: () => api.post<{ created: number }>("/tasks/bulk/", {
      project: Number(project),
      tasks: rows.map((row) => ({ ...row, due_at: fromLocalInput(row.due_at) })),
    }),
    onSuccess: (result) => {
      toast(`${result.created} ta vazifa yaratildi`);
      refresh();
      close();
    },
    onError: (reason: Error) => setError(reason instanceof ApiError ? reason.message : T.common.errorGeneric),
  });

  const members = team.data ?? [];
  const canSave = Boolean(project) && rows.every((row) => row.title.trim() && row.assignee_ids.length > 0 && !members.some((member) => member.is_on_business_trip && row.assignee_ids.includes(member.id)));
  const update = (index: number, patch: Partial<Draft>) => setRows((items) => items.map((item, i) => i === index ? { ...item, ...patch } : item));

  return (
    <Modal
      size="lg"
      title={T.tasks.bulkTitle}
      subtitle={T.tasks.bulkSubtitle}
      onClose={close}
      dirty={rows.some((row) => row.title || row.assignee_ids.length || row.due_at)}
      footer={<><span className="spacer" /><Button variant="ghost" onClick={close}>{T.common.cancel}</Button><Button variant="primary" loading={save.isPending} disabled={!canSave} onClick={() => save.mutate()}>Yaratish ({rows.length})</Button></>}
    >
      <form className="stack" onSubmit={(event) => { event.preventDefault(); if (canSave) save.mutate(); }}>
        {error && <Callout tone="danger">{error}</Callout>}
        <Field label={T.tasks.project} required>
          {(id) => <select id={id} className="select" value={project} onChange={(event) => { setProject(event.target.value ? Number(event.target.value) : ""); setRows([emptyRow()]); }}><option value="">{T.tasks.pickProject}</option>{projects.data?.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>}
        </Field>
        {!project ? <Callout tone="info">Avval loyiha tanlang, keyin vazifalarni xodimlarga taqsimlang.</Callout> : team.isLoading ? <Skeleton h={160} /> : !members.length ? <Callout tone="warning">{T.tasks.noTeam}</Callout> : (
          <div className="stack">
            {rows.map((row, index) => (
              <section key={index} className="card card-pad stack-sm" aria-label={`${index + 1}-vazifa`}>
                <div className="row-wrap">
                  <input className="input grow" placeholder={T.tasks.namePh} value={row.title} onChange={(event) => update(index, { title: event.target.value })} />
                  <select className="select" value={row.priority} aria-label={T.tasks.priority} onChange={(event) => update(index, { priority: event.target.value as Priority })}>
                    {meta.options<Priority>("priorities").map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                  <input type="datetime-local" className="input" value={row.due_at} aria-label={T.tasks.dueAt} onChange={(event) => update(index, { due_at: event.target.value })} />
                  {rows.length > 1 && <Button size="sm" variant="ghost" icon={<Trash2 />} aria-label={T.common.delete} onClick={() => setRows((items) => items.filter((_, i) => i !== index))} />}
                </div>
                <div className="chips" role="group" aria-label={T.tasks.assignees}>
                  {members.map((member) => {
                    const selected = row.assignee_ids.includes(member.id);
                    return <button key={member.id} type="button" className="chip" aria-pressed={selected} disabled={member.is_on_business_trip && !selected} title={member.is_on_business_trip ? T.people.tripBlocked : undefined} onClick={() => update(index, { assignee_ids: selected ? row.assignee_ids.filter((id) => id !== member.id) : [...row.assignee_ids, member.id] })}><Avatar user={member} size="sm" /> {member.full_name} {member.is_on_business_trip && `· ${T.people.onBusinessTrip}`}</button>;
                  })}
                </div>
              </section>
            ))}
            <div><Button size="sm" icon={<Plus />} onClick={() => setRows((items) => [...items, emptyRow()])}>{T.tasks.bulkMore}</Button></div>
          </div>
        )}
      </form>
    </Modal>
  );
}

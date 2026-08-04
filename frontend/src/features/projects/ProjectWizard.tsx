import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, Check, Plus, Search, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";

import { useModal } from "@/app/modals";
import { useDevelopers, useRefresh } from "@/app/queries";
import { api, ApiError, formData } from "@/shared/api";
import { fmtDate } from "@/shared/format";
import { useMeta } from "@/shared/meta";
import { T } from "@/shared/text";
import type { OrderDetail, ProjectDetail, ProjectStage } from "@/shared/types";
import { Avatar, Button, Callout, Field, FilePicker, Modal, Segmented, Skeleton, Stepper, useToast } from "@/shared/ui";

interface QuickTask {
  title: string;
  assignee_ids: number[];
  due: string;
}

/**
 * Modal: loyiha yaratish — 3 qadam: Asosiy → Jamoa → Vazifa va fayllar.
 * Buyurtmadan ochilsa: nom, izoh, TZ fayli buyurtmadan; sanalar — PM tasdiqlaganda kiritganlari.
 */
export default function ProjectWizard({ orderId }: { orderId?: number }) {
  const { close, open } = useModal();
  const toast = useToast();
  const refresh = useRefresh();
  const developers = useDevelopers();
  const meta = useMeta();
  const order = useQuery({ queryKey: ["order", orderId], queryFn: () => api.get<OrderDetail>(`/orders/${orderId}/`), enabled: Boolean(orderId) });

  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [stage, setStage] = useState<ProjectStage>("planned");
  const [members, setMembers] = useState<number[]>([]);
  const [devSearch, setDevSearch] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [tasks, setTasks] = useState<QuickTask[]>([]);
  const [error, setError] = useState<ApiError | null>(null);

  useEffect(() => {
    const o = order.data;
    if (!o) return;
    setName(o.title);
    setDescription(o.description);
    setStart(o.start_date ?? "");
    setEnd(o.end_date ?? "");
  }, [order.data]);

  const create = useMutation({
    mutationFn: async () => {
      const project = await api.post<ProjectDetail>(
        "/projects/",
        formData(
          orderId
            ? { order: orderId, start_date: start, end_date: end, stage, member_ids: members }
            : { name, description, start_date: start, end_date: end, stage, member_ids: members },
          files,
        ),
      );
      // Birinchi vazifalar — loyiha yaratilgach ketma-ket
      for (const t of tasks.filter((x) => x.title.trim() && x.assignee_ids.length)) {
        await api.post("/tasks/", {
          project: project.id,
          title: t.title,
          assignee_ids: t.assignee_ids,
          due_at: t.due ? new Date(`${t.due}T18:00`).toISOString() : null,
        });
      }
      return project;
    },
    onSuccess: (p) => {
      toast(T.projects.createdToast);
      refresh();
      open({ project: p.id }, true);
    },
    onError: (e: Error) => {
      const err = e instanceof ApiError ? e : new ApiError(0, e.message);
      setError(err);
      if (err.field("name") || err.field("start_date") || err.field("end_date")) setStep(0);
    },
  });

  const fromOrder = Boolean(orderId);
  const step0ok = name.trim() && start && end && end >= start;
  const devs = (developers.data ?? []).filter((d) => d.full_name.toLowerCase().includes(devSearch.toLowerCase()));
  const chosen = (developers.data ?? []).filter((d) => members.includes(d.id));
  const fe = (k: string) => error?.field(k);

  if (orderId && !order.data)
    return (
      <Modal title={T.projects.new} onClose={close}>
        <Skeleton h={260} />
      </Modal>
    );

  return (
    <Modal
      size="md"
      title={T.projects.new}
      subtitle={<Stepper steps={T.projects.steps} current={step} />}
      onClose={close}
      dirty={Boolean(name || members.length || files.length) && !fromOrder}
      footer={
        <>
          {step > 0 && (
            <Button variant="ghost" icon={<ArrowLeft />} onClick={() => setStep((s) => s - 1)}>
              {T.common.back}
            </Button>
          )}
          <span className="spacer" />
          {step < 2 ? (
            <Button variant="primary" onClick={() => setStep((s) => s + 1)} disabled={step === 0 && !step0ok}>
              {T.common.next} <ArrowRight />
            </Button>
          ) : (
            <Button variant="primary" icon={<Check />} loading={create.isPending} disabled={!step0ok} onClick={() => create.mutate()}>
              {T.projects.create}
            </Button>
          )}
        </>
      }
    >
      <div className="stack" style={{ gap: 16 }}>
        {error && !Object.keys(error.fields).length && <Callout tone="danger">{error.message}</Callout>}

        {step === 0 && (
          <>
            {fromOrder && <Callout tone="info">{T.projects.fromOrderLocked}</Callout>}
            <Field label={T.projects.name} required error={fe("name")}>
              {(id, bad) => <input id={id} className="input" aria-invalid={bad} placeholder={T.projects.namePh} value={name} disabled={fromOrder} onChange={(e) => setName(e.target.value)} autoFocus />}
            </Field>
            <Field label={T.projects.description}>
              {(id) => <textarea id={id} className="textarea" value={description} disabled={fromOrder} onChange={(e) => setDescription(e.target.value)} />}
            </Field>
            <div className="grid-2">
              <Field label={T.projects.startDate} required error={fe("start_date")}>
                {(id, bad) => <input id={id} type="date" className="input" aria-invalid={bad} value={start} onChange={(e) => setStart(e.target.value)} />}
              </Field>
              <Field
                label={T.projects.endDate}
                required
                error={fe("end_date") ?? (start && end && end < start ? T.projects.endBeforeStart : undefined)}
                hint={order.data ? `${T.orders.requestedDue}: ${fmtDate(order.data.requested_due_date)}` : undefined}
              >
                {(id, bad) => <input id={id} type="date" className="input" aria-invalid={bad} min={start} value={end} onChange={(e) => setEnd(e.target.value)} />}
              </Field>
            </div>
            <div className="field">
              <span className="field-label">{T.projects.stage}</span>
              <Segmented<ProjectStage> value={stage} onChange={setStage} options={meta.options<ProjectStage>("project_stages")} />
            </div>
          </>
        )}

        {step === 1 && (
          <>
            <p className="muted">{T.projects.teamHint}</p>
            <label className="row input" style={{ gap: 8 }}>
              <Search size={16} className="muted" />
              <input style={{ border: 0, outline: 0, background: "transparent", flex: 1, font: "inherit", color: "inherit" }} placeholder={T.common.search} value={devSearch} onChange={(e) => setDevSearch(e.target.value)} />
            </label>
            {developers.isLoading && <Skeleton h={120} />}
            <div className="pick-list">
              {devs.map((d) => (
                <label key={d.id} className="pick">
                  <input
                    type="checkbox"
                    checked={members.includes(d.id)}
                    onChange={(e) => setMembers((xs) => (e.target.checked ? [...xs, d.id] : xs.filter((x) => x !== d.id)))}
                  />
                  <Avatar user={d} size="sm" />
                  <span className="grow">
                    <b style={{ fontWeight: 600 }}>{d.full_name}</b>
                    <span className="small muted"> · {d.specialty}</span>
                  </span>
                </label>
              ))}
            </div>
            <span className="small muted">
              {T.projects.team}: {T.common.count(members.length)}
            </span>
          </>
        )}

        {step === 2 && (
          <>
            <div className="field">
              <span className="field-label">{T.common.files}</span>
              {fromOrder && <Callout tone="success">{T.projects.tzIncluded(order.data?.versions.at(-1)?.file.name ?? "")}</Callout>}
              <FilePicker files={files} onChange={setFiles} />
            </div>
            <div className="field">
              <span className="field-label">{T.projects.quickTasks}</span>
              {!chosen.length ? (
                <Callout tone="warning">{T.tasks.noTeam}</Callout>
              ) : (
                <>
                  {tasks.map((t, i) => (
                    <div key={i} className="card card-pad stack-sm">
                      <div className="row">
                        <input
                          className="input grow"
                          placeholder={T.projects.quickTaskPh}
                          aria-label={T.projects.quickTaskPh}
                          value={t.title}
                          onChange={(e) => setTasks((xs) => xs.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))}
                        />
                        <input
                          type="date"
                          className="input"
                          style={{ width: 160 }}
                          aria-label={T.tasks.dueAt}
                          value={t.due}
                          onChange={(e) => setTasks((xs) => xs.map((x, j) => (j === i ? { ...x, due: e.target.value } : x)))}
                        />
                        <button className="icon-btn" aria-label={T.common.delete} onClick={() => setTasks((xs) => xs.filter((_, j) => j !== i))}>
                          <Trash2 />
                        </button>
                      </div>
                      <div className="chips">
                        {chosen.map((d) => {
                          const on = t.assignee_ids.includes(d.id);
                          return (
                            <button
                              key={d.id}
                              type="button"
                              className="chip"
                              aria-pressed={on}
                              onClick={() =>
                                setTasks((xs) =>
                                  xs.map((x, j) =>
                                    j === i ? { ...x, assignee_ids: on ? x.assignee_ids.filter((a) => a !== d.id) : [...x.assignee_ids, d.id] } : x,
                                  ),
                                )
                              }
                            >
                              {d.full_name}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                  <div>
                    <Button size="sm" icon={<Plus />} onClick={() => setTasks((xs) => [...xs, { title: "", assignee_ids: [], due: "" }])}>
                      {T.projects.quickTaskAdd}
                    </Button>
                  </div>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

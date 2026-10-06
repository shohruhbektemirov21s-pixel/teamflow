import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, Check, Plus, Search, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { useModal } from "@/app/modals";
import { useDevelopers, useRefresh } from "@/app/queries";
import { api, ApiError, formData } from "@/shared/api";
import { fmtDate, fromLocalInput } from "@/shared/format";
import { useMeta } from "@/shared/meta";
import { T } from "@/shared/text";
import type { OrderDetail, ProjectDetail, ProjectStage } from "@/shared/types";
import { Avatar, Button, Callout, Field, FilePicker, Modal, Segmented, Skeleton, Stepper, useToast } from "@/shared/ui";

/** Bitta xodimga beriladigan vazifa (loyiha bilan birga, bitta so'rovda yaratiladi). */
interface MemberTask {
  key: number;
  assignee: number;
  title: string;
  starts: string; // datetime-local
  due: string; // datetime-local
  files: File[];
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
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [stage, setStage] = useState<ProjectStage>("planned");
  const [members, setMembers] = useState<number[]>([]);
  const [devSearch, setDevSearch] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [tasks, setTasks] = useState<MemberTask[]>([]);
  const nextKey = useRef(0);
  const [error, setError] = useState<ApiError | null>(null);

  useEffect(() => {
    const o = order.data;
    if (!o) return;
    setName(o.title);
    setDescription(o.description);
    setStart(o.start_date ?? "");
    setEnd(o.end_date ?? "");
  }, [order.data]);

  // Jamoadan chiqarilgan xodimning vazifalari yuborilmaydi; nomsiz vazifalar e'tiborga olinmaydi
  const readyTasks = tasks.filter((t) => members.includes(t.assignee) && t.title.trim());
  const badDates = (t: MemberTask) => Boolean(t.starts && t.due && t.due < t.starts);

  const updateTask = (key: number, patch: Partial<MemberTask>) => setTasks((xs) => xs.map((x) => (x.key === key ? { ...x, ...patch } : x)));
  const addTask = (assignee: number) => setTasks((xs) => [...xs, { key: nextKey.current++, assignee, title: "", starts: "", due: "", files: [] }]);

  const create = useMutation({
    // Loyiha, jamoa va vazifalar bitta so'rovda — server bitta tranzaksiyada yaratadi (chala loyiha qolmaydi)
    mutationFn: () => {
      const fd = formData(
        {
          code: code.trim(),
          ...(orderId ? { order: orderId } : { name, description }),
          start_date: start,
          end_date: end,
          stage,
          member_ids: members,
          tasks: readyTasks.map((t) => ({ title: t.title.trim(), assignee_id: t.assignee, starts_at: fromLocalInput(t.starts), due_at: fromLocalInput(t.due) })),
        },
        files,
      );
      readyTasks.forEach((t, i) => t.files.forEach((f) => fd.append(`task_files_${i}`, f)));
      return api.post<Pick<ProjectDetail, "id" | "code">>("/projects/setup/", fd);
    },
    onSuccess: (p) => {
      toast(T.projects.createdToast);
      refresh();
      open({ project: p.id }, true);
    },
    onError: (e: Error) => {
      const err = e instanceof ApiError ? e : new ApiError(0, e.message);
      setError(err);
      if (err.field("code") || err.field("name") || err.field("start_date") || err.field("end_date")) setStep(0);
      else if (err.field("member_ids")) setStep(1);
    },
  });

  const fromOrder = Boolean(orderId);
  const step0ok = code.trim() && name.trim() && start && end && end >= start;
  const tasksOk = !readyTasks.some(badDates);
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
      dirty={Boolean(code || members.length || files.length || tasks.length || (name && !fromOrder))}
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
            <Button variant="primary" icon={<Check />} loading={create.isPending} disabled={!step0ok || !tasksOk} onClick={() => create.mutate()}>
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
            <Field label={T.projects.code} required error={fe("code")} hint={T.projects.codeHint}>
              {(id, bad) => <input id={id} className="input" aria-invalid={bad} placeholder={T.projects.codePh} value={code} onChange={(e) => setCode(e.target.value)} autoFocus />}
            </Field>
            <Field label={T.projects.name} required error={fe("name")}>
              {(id, bad) => <input id={id} className="input" aria-invalid={bad} placeholder={T.projects.namePh} value={name} disabled={fromOrder} onChange={(e) => setName(e.target.value)} />}
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
              <Segmented<ProjectStage>
                value={stage}
                onChange={setStage}
                options={meta.options<ProjectStage>("project_stages").filter((option) => option.value !== "pending_approval" && option.value !== "rejected")}
              />
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
              <span className="field-label">{T.projects.projectFiles}</span>
              {fromOrder && <Callout tone="success">{T.projects.tzIncluded(order.data?.versions.at(-1)?.file.name ?? "")}</Callout>}
              <FilePicker files={files} onChange={setFiles} />
            </div>
            <div className="field">
              <span className="field-label">{T.projects.memberTasks}</span>
              {!chosen.length ? (
                <Callout tone="warning">{T.tasks.noTeam}</Callout>
              ) : (
                <>
                  <span className="field-hint">{T.projects.memberTasksHint}</span>
                  {fe("tasks") && (
                    <span className="field-error" role="alert">
                      {fe("tasks")}
                    </span>
                  )}
                  {chosen.map((d) => {
                    const own = tasks.filter((t) => t.assignee === d.id);
                    return (
                      <section key={d.id} className="card card-pad stack-sm" aria-label={d.full_name}>
                        <div className="row">
                          <Avatar user={d} size="sm" />
                          <span className="grow">
                            <b style={{ fontWeight: 600 }}>{d.full_name}</b>
                            {d.specialty && <span className="small muted"> · {d.specialty}</span>}
                          </span>
                          <Button size="sm" icon={<Plus />} disabled={d.is_on_business_trip} title={d.is_on_business_trip ? T.people.tripBlocked : undefined} onClick={() => addTask(d.id)}>
                            {T.projects.quickTaskAdd}
                          </Button>
                          {d.is_on_business_trip && <span className="small muted">{T.people.onBusinessTrip}</span>}
                        </div>
                        {!own.length && <span className="small muted">{T.projects.memberNoTasks}</span>}
                        {own.map((t) => (
                          <div key={t.key} className="stack-sm" style={{ borderTop: "1px solid var(--border)", paddingTop: 12 }}>
                            <div className="row">
                              <input
                                className="input grow"
                                placeholder={T.projects.quickTaskPh}
                                aria-label={T.projects.quickTaskPh}
                                value={t.title}
                                onChange={(e) => updateTask(t.key, { title: e.target.value })}
                              />
                              <button className="icon-btn" aria-label={T.common.delete} onClick={() => setTasks((xs) => xs.filter((x) => x.key !== t.key))}>
                                <Trash2 />
                              </button>
                            </div>
                            <div className="grid-2">
                              <Field label={T.tasks.startsAt}>
                                {(id) => <input id={id} type="datetime-local" className="input" value={t.starts} onChange={(e) => updateTask(t.key, { starts: e.target.value })} />}
                              </Field>
                              <Field label={T.tasks.dueAt} error={badDates(t) ? T.projects.taskEndBeforeStart : undefined}>
                                {(id, bad) => (
                                  <input
                                    id={id}
                                    type="datetime-local"
                                    className="input"
                                    aria-invalid={bad}
                                    min={t.starts || undefined}
                                    value={t.due}
                                    onChange={(e) => updateTask(t.key, { due: e.target.value })}
                                  />
                                )}
                              </Field>
                            </div>
                            <FilePicker files={t.files} onChange={(f) => updateTask(t.key, { files: f })} label={T.projects.taskFiles} />
                          </div>
                        ))}
                      </section>
                    );
                  })}
                </>
              )}
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

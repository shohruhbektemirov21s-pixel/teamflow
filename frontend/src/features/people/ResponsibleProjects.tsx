import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FolderKanban, MessageSquarePlus, Pencil, Plus, Save, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { usePagedList } from "@/app/queries";
import { api, ApiError } from "@/shared/api";
import { fmtDate, fmtDateTime } from "@/shared/format";
import { T } from "@/shared/text";
import type { ResponsibleNews, ResponsibleProject, ResponsibleProjects as Data } from "@/shared/types";
import { Avatar, Button, ConfirmButton, Empty, ErrorBox, Field, SkeletonRows, useToast } from "@/shared/ui";
import { Pagination } from "@/shared/ui/Pagination";

const R = T.people.responsible;
const NEWS_MAX = 2000;
const DESCRIPTION_MAX = 1000;

const listKey = (employeeId: number) => ["responsible", employeeId] as const;

/**
 * Xodimning mas'ul loyihalari va ular bo'yicha yangiliklar. Boshliq/PM loyiha qo'shadi, tahrirlaydi, o'chiradi;
 * mas'ul xodimning o'zi va Boshliq/PM yangilik yozadi. Ruxsatni server beradi (`can_manage`, `can_post`).
 * Xodim oynasida ham, o'z profilida ham shu bitta komponent ishlatiladi — yangi modal yo'q.
 */
export function ResponsibleProjects({ employeeId, own = false, onDirtyChange }: { employeeId: number; own?: boolean; onDirtyChange?: (dirty: boolean) => void }) {
  const q = useQuery({ queryKey: listKey(employeeId), queryFn: () => api.get<Data>(`/people/${employeeId}/responsible-projects/`) });
  const [adding, setAdding] = useState(false);
  const [dirtyForms, setDirtyForms] = useState<ReadonlySet<string>>(new Set());
  const markDirty = useCallback((key: string, dirty: boolean) => {
    setDirtyForms((current) => {
      if (current.has(key) === dirty) return current;
      const next = new Set(current);
      if (dirty) next.add(key);
      else next.delete(key);
      return next;
    });
  }, []);
  useEffect(() => { onDirtyChange?.(dirtyForms.size > 0); }, [dirtyForms, onDirtyChange]);

  const data = q.data;
  const projects = data?.projects ?? [];
  return (
    <section className="card card-pad stack-sm" aria-label={R.title}>
      <div className="row-wrap" style={{ justifyContent: "space-between" }}>
        <h3 className="person-section-title">
          {R.title} {data && projects.length > 0 && <span className="count-pill soft">{projects.length}</span>}
        </h3>
        {data?.can_manage && !adding && <Button size="sm" variant="primary" icon={<Plus size={15} />} onClick={() => setAdding(true)}>{R.add}</Button>}
      </div>
      {q.isLoading && <SkeletonRows rows={2} />}
      {q.error && <ErrorBox error={q.error} onRetry={() => q.refetch()} />}
      {adding && <ProjectForm employeeId={employeeId} formKey="new" markDirty={markDirty} onDone={() => setAdding(false)} />}
      {data && !projects.length && !adding && (
        <Empty icon={<FolderKanban />} title={own ? (data.can_manage ? R.emptyOwnManage : R.emptyOwn) : R.empty} hint={!own && data.can_manage ? R.emptyManagerHint : undefined} />
      )}
      {projects.length > 0 && (
        <ul className="responsible-list">
          {projects.map((project) => (
            <li key={project.id}>
              <ProjectRow project={project} employeeId={employeeId} canManage={data!.can_manage} canPost={data!.can_post} markDirty={markDirty} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

type MarkDirty = (key: string, dirty: boolean) => void;

function useRefreshPerson(employeeId: number) {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: listKey(employeeId) });
    // Xodimlar ro'yxati va xodim oynasida mas'ul loyiha nomlari ko'rinadi
    void qc.invalidateQueries({ queryKey: ["people"] });
    void qc.invalidateQueries({ queryKey: ["person", employeeId] });
  };
}

function ProjectRow({ project, employeeId, canManage, canPost, markDirty }: { project: ResponsibleProject; employeeId: number; canManage: boolean; canPost: boolean; markDirty: MarkDirty }) {
  const toast = useToast();
  const refresh = useRefreshPerson(employeeId);
  const [editing, setEditing] = useState(false);
  const [newsOpen, setNewsOpen] = useState(false);
  const remove = useMutation({
    mutationFn: () => api.del(`/responsible-projects/${project.id}/`),
    onSuccess: () => { markDirty(`edit-${project.id}`, false); markDirty(`news-${project.id}`, false); toast(R.deleted); refresh(); },
    onError: (err) => toast(err instanceof ApiError ? err.message : T.common.errorGeneric, "error"),
  });

  if (editing)
    return <ProjectForm employeeId={employeeId} project={project} formKey={`edit-${project.id}`} markDirty={markDirty} onDone={() => setEditing(false)} />;

  const newsId = `responsible-news-${project.id}`;
  return (
    <article className="responsible-item stack-sm">
      <div className="responsible-head">
        <span className="responsible-icon" aria-hidden><FolderKanban size={18} /></span>
        <div className="grow stack-sm" style={{ gap: 4, minWidth: 0 }}>
          <strong className="responsible-name">{project.name}</strong>
          {project.description && <p className="responsible-description muted">{project.description}</p>}
          <span className="small muted">{project.last_news_at ? R.lastNews(fmtDate(project.last_news_at)) : R.noNews}</span>
        </div>
      </div>
      <div className="row-wrap responsible-actions">
        {canManage && (
          <ConfirmButton onConfirm={() => remove.mutate()} loading={remove.isPending} confirmText={R.deleteConfirm}>
            <Trash2 size={15} /> {T.common.delete}
          </ConfirmButton>
        )}
        {canManage && <Button size="sm" variant="ghost" icon={<Pencil size={15} />} onClick={() => setEditing(true)}>{T.common.edit}</Button>}
        <Button size="sm" icon={<MessageSquarePlus size={15} />} aria-expanded={newsOpen} aria-controls={newsId} onClick={() => setNewsOpen((v) => !v)}>
          {newsOpen ? R.newsHide : R.newsN(project.news_count)}
        </Button>
      </div>
      {newsOpen && <div id={newsId}><NewsPanel project={project} employeeId={employeeId} canPost={canPost} markDirty={markDirty} /></div>}
    </article>
  );
}

function ProjectForm({ employeeId, project, formKey, markDirty, onDone }: { employeeId: number; project?: ResponsibleProject; formKey: string; markDirty: MarkDirty; onDone: () => void }) {
  const toast = useToast();
  const refresh = useRefreshPerson(employeeId);
  const [name, setName] = useState(project?.name ?? "");
  const [description, setDescription] = useState(project?.description ?? "");
  const changed = name !== (project?.name ?? "") || description !== (project?.description ?? "");
  useEffect(() => { markDirty(formKey, changed); }, [changed, formKey, markDirty]);
  useEffect(() => () => markDirty(formKey, false), [formKey, markDirty]);
  const save = useMutation({
    mutationFn: () => {
      const body = { name, description };
      return project ? api.patch(`/responsible-projects/${project.id}/`, body) : api.post(`/people/${employeeId}/responsible-projects/`, body);
    },
    onSuccess: () => { markDirty(formKey, false); toast(R.saved); refresh(); onDone(); },
  });
  const err = save.error instanceof ApiError ? save.error : null;
  const general = save.error && !err?.field("name") && !err?.field("description");
  return (
    <form className="responsible-form stack-sm" onSubmit={(e) => { e.preventDefault(); if (name.trim()) save.mutate(); }}>
      <Field label={R.name} error={err?.field("name")}>
        {(id, bad) => <input id={id} className="input" maxLength={255} autoFocus aria-invalid={bad} value={name} placeholder={R.namePh} disabled={save.isPending} onChange={(e) => { setName(e.target.value); save.reset(); }} />}
      </Field>
      <Field label={R.description} error={err?.field("description")}>
        {(id, bad) => <textarea id={id} className="textarea" rows={3} maxLength={DESCRIPTION_MAX} aria-invalid={bad} value={description} placeholder={R.descriptionPh} disabled={save.isPending} onChange={(e) => { setDescription(e.target.value); save.reset(); }} />}
      </Field>
      {general && <ErrorBox error={save.error} />}
      <div className="row-wrap" style={{ justifyContent: "flex-end" }}>
        <Button size="sm" disabled={save.isPending} onClick={() => { markDirty(formKey, false); onDone(); }}>{T.common.cancel}</Button>
        <Button size="sm" type="submit" variant="primary" icon={<Save size={15} />} loading={save.isPending} disabled={!name.trim() || (project && !changed)}>{T.common.save}</Button>
      </div>
    </form>
  );
}

function NewsPanel({ project, employeeId, canPost, markDirty }: { project: ResponsibleProject; employeeId: number; canPost: boolean; markDirty: MarkDirty }) {
  const toast = useToast();
  const refresh = useRefreshPerson(employeeId);
  const qc = useQueryClient();
  const baseKey = ["responsible", employeeId, "news", project.id] as const;
  const news = usePagedList<ResponsibleNews>(baseKey, `/responsible-projects/${project.id}/news/`, {});
  const [text, setText] = useState("");
  const formKey = `news-${project.id}`;
  useEffect(() => { markDirty(formKey, text.trim().length > 0); }, [text, formKey, markDirty]);
  useEffect(() => () => markDirty(formKey, false), [formKey, markDirty]);
  const add = useMutation({
    mutationFn: () => api.post<ResponsibleNews>(`/responsible-projects/${project.id}/news/`, { text }),
    onSuccess: () => {
      setText("");
      toast(R.newsAdded);
      news.onPageChange(1);
      void qc.invalidateQueries({ queryKey: baseKey });
      refresh();
    },
  });
  const fieldError = add.error instanceof ApiError ? add.error.field("text") : undefined;
  return (
    <div className="responsible-news stack-sm">
      {canPost && (
        <form className="stack-sm" onSubmit={(e) => { e.preventDefault(); if (text.trim()) add.mutate(); }}>
          <Field label={R.newsLabel} error={fieldError}>
            {(id, bad) => <textarea id={id} className="textarea" rows={3} maxLength={NEWS_MAX} aria-invalid={bad} value={text} placeholder={R.newsPh} disabled={add.isPending} onChange={(e) => { setText(e.target.value); add.reset(); }} />}
          </Field>
          {add.error && !fieldError && <ErrorBox error={add.error} />}
          <div className="row-wrap" style={{ justifyContent: "space-between" }}>
            <span className="small muted" aria-live="polite">{text.length}/{NEWS_MAX}</span>
            <Button size="sm" type="submit" variant="primary" icon={<Plus size={15} />} loading={add.isPending} disabled={!text.trim()}>{R.newsAdd}</Button>
          </div>
        </form>
      )}
      {news.isLoading && <SkeletonRows rows={2} />}
      {news.error && <ErrorBox error={news.error} onRetry={() => news.refetch()} />}
      {news.data && !news.data.length && <p className="small muted" style={{ margin: 0 }}>{R.newsEmpty}</p>}
      {news.data && news.data.length > 0 && (
        <ol className="responsible-news-list" aria-label={R.newsN(news.pagination?.count ?? news.data.length)}>
          {news.data.map((item) => (
            <li key={item.id} className="responsible-news-item">
              <Avatar user={item.author} size="sm" />
              <div className="grow" style={{ minWidth: 0 }}>
                <div className="row-wrap" style={{ gap: 8 }}>
                  <strong className="small">{item.author.full_name}</strong>
                  <time className="small muted" dateTime={item.created_at}>{fmtDateTime(item.created_at)}</time>
                </div>
                <p className="responsible-news-text">{item.text}</p>
              </div>
            </li>
          ))}
        </ol>
      )}
      <Pagination data={news.pagination} page={news.page} onPageChange={news.onPageChange} />
    </div>
  );
}

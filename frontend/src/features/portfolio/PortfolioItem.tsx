import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowLeft, ExternalLink, ImagePlus, MessageSquare, Pencil, Save, Trash2, Upload, Video } from "lucide-react";
import { type ReactNode, useState } from "react";

import { useModal } from "@/app/modals";
import { usePagedList, useRefresh } from "@/app/queries";
import { api, ApiError } from "@/shared/api";
import { fileSize, fmtDate, timeAgo } from "@/shared/format";
import { useMeta } from "@/shared/meta";
import { T } from "@/shared/text";
import type { PortfolioItemDetail, PortfolioReview, ProjectType } from "@/shared/types";
import { Avatar, Badge, Button, Callout, CodeTag, ConfirmButton, Empty, ErrorBox, Field, FilePicker, Modal, Skeleton, SkeletonRows, useToast } from "@/shared/ui";
import { Pagination } from "@/shared/ui/Pagination";

import { periodText } from "./period";
import { StarInput, Stars } from "./Stars";

const REVIEW_MAX = 1000;
const DESCRIPTION_MAX = 2000;

interface Draft {
  title: string;
  description: string;
  link: string;
  start_date: string;
  end_date: string;
  project_type: ProjectType;
}

const EMPTY: Draft = { title: "", description: "", link: "", start_date: "", end_date: "", project_type: "" };

function payload(draft: Draft, auto: boolean) {
  const base = { description: draft.description.trim(), link: draft.link.trim(), project_type: draft.project_type };
  if (auto) return base;
  return { ...base, title: draft.title.trim(), start_date: draft.start_date || null, end_date: draft.end_date || null };
}

/** Loyiha maydonlari: qo'shish va tahrirlashda bir xil. TeamFlow loyihasida nomi va sanalari o'zgarmaydi. */
function ItemFields({ draft, onChange, error, auto }: { draft: Draft; onChange: (d: Draft) => void; error: unknown; auto: boolean }) {
  const meta = useMeta();
  const err = (name: string) => (error instanceof ApiError ? error.field(name) : undefined);
  const set = (k: keyof Draft) => (e: { target: { value: string } }) => onChange({ ...draft, [k]: e.target.value });
  return (
    <div className="stack">
      <Field label={T.portfolio.projectType} error={err("project_type")}>
        {(id, bad) => (
          <select id={id} className="select" aria-invalid={bad} value={draft.project_type} onChange={set("project_type")}>
            <option value="">{T.portfolio.projectTypePick}</option>
            {meta.options<ProjectType>("portfolio_project_types").map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        )}
      </Field>
      {auto ? (
        <Callout>{T.portfolio.fields.autoNote}</Callout>
      ) : (
        <>
          <Field label={T.portfolio.fields.title} required error={err("title")}>
            {(id, invalid) => <input id={id} className="input" maxLength={255} autoFocus aria-invalid={invalid} placeholder={T.portfolio.fields.titlePh} value={draft.title} onChange={set("title")} />}
          </Field>
          <div className="grid-2">
            <Field label={T.portfolio.fields.start} error={err("start_date")}>
              {(id, invalid) => <input id={id} type="date" className="input" aria-invalid={invalid} value={draft.start_date} onChange={set("start_date")} />}
            </Field>
            <Field label={T.portfolio.fields.end} error={err("end_date")}>
              {(id, invalid) => <input id={id} type="date" className="input" aria-invalid={invalid} value={draft.end_date} min={draft.start_date || undefined} onChange={set("end_date")} />}
            </Field>
          </div>
        </>
      )}
      <Field label={T.portfolio.fields.description} hint={T.portfolio.chars(draft.description.length, DESCRIPTION_MAX)} error={err("description")}>
        {(id, invalid) => <textarea id={id} className="textarea" rows={4} maxLength={DESCRIPTION_MAX} aria-invalid={invalid} placeholder={T.portfolio.fields.descriptionPh} value={draft.description} onChange={set("description")} />}
      </Field>
      <Field label={T.portfolio.fields.link} hint={T.portfolio.fields.linkHint} error={err("link")}>
        {(id, invalid) => <input id={id} type="url" inputMode="url" className="input" maxLength={500} aria-invalid={invalid} placeholder={T.portfolio.fields.linkPh} value={draft.link} onChange={set("link")} />}
      </Field>
      {error instanceof ApiError && !Object.keys(error.fields).length ? <ErrorBox error={error} /> : null}
      {error && !(error instanceof ApiError) ? <ErrorBox error={error} /> : null}
    </div>
  );
}

/** Yangi loyiha (faqat portfolio egasi). Saqlangach shu modal ichida loyiha ochiladi. */
export function PortfolioItemForm({ ownerId }: { ownerId: number }) {
  const { open, close } = useModal();
  const toast = useToast();
  const refresh = useRefresh(["portfolio"]);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const save = useMutation({
    mutationFn: () => api.post<PortfolioItemDetail>("/portfolio/items/", payload(draft, false)),
    onSuccess: (item) => {
      toast(T.portfolio.savedToast);
      void refresh();
      open({ portfolio: ownerId, item: item.id }, true);
    },
  });
  const dirty = JSON.stringify(draft) !== JSON.stringify(EMPTY);
  return (
    <Modal
      title={T.portfolio.addTitle}
      onClose={close}
      dirty={dirty && !save.isSuccess}
      footer={
        <>
          <span className="spacer" />
          <Button onClick={close}>{T.common.cancel}</Button>
          <Button variant="primary" icon={<Save size={16} />} loading={save.isPending} disabled={!draft.title.trim()} onClick={() => save.mutate()}>
            {T.common.save}
          </Button>
        </>
      }
    >
      <ItemFields draft={draft} onChange={(d) => (setDraft(d), save.reset())} error={save.error} auto={false} />
    </Modal>
  );
}

/** Loyiha: tavsif, havola, videolar, baholar va sharhlar. Egasi tahrirlaydi va video yuklaydi, boshqalar baholaydi. */
export function PortfolioItemView({ id }: { id: number }) {
  const { close } = useModal();
  const query = useQuery({ queryKey: ["portfolio", "item", id], queryFn: () => api.get<PortfolioItemDetail>(`/portfolio/items/${id}/`) });
  const item = query.data;
  const [editing, setEditing] = useState<Draft | null>(null);
  const [reviewDirty, setReviewDirty] = useState(false);

  if (!item)
    return (
      <Modal title={T.common.loading} onClose={close}>
        {query.isLoading && <Skeleton h={240} />}
        {query.error && <ErrorBox error={query.error} onRetry={() => query.refetch()} />}
      </Modal>
    );

  const period = periodText(item.start_date, item.end_date);
  const subtitle = (
    <>
      <Badge tone={item.is_auto ? "violet" : "info"} dot={false}>{item.is_auto ? T.portfolio.auto : T.portfolio.manual}</Badge>
      {item.project && <CodeTag code={item.project.code} />}
      {period && <span className="small muted">{period}</span>}
    </>
  );

  if (editing)
    return <ItemEdit item={item} draft={editing} onDraft={setEditing} onDone={() => setEditing(null)} subtitle={subtitle} />;

  return (
    <ItemDetails
      item={item}
      subtitle={subtitle}
      dirty={reviewDirty}
      onDirty={setReviewDirty}
      onEdit={() => setEditing({ title: item.manual.title, description: item.description, link: item.link,
        start_date: item.manual.start_date ?? "", end_date: item.manual.end_date ?? "", project_type: item.project_type })}
    />
  );
}

function ItemEdit({ item, draft, onDraft, onDone, subtitle }: { item: PortfolioItemDetail; draft: Draft; onDraft: (d: Draft) => void; onDone: () => void; subtitle: ReactNode }) {
  const toast = useToast();
  const refresh = useRefresh(["portfolio"]);
  const save = useMutation({
    mutationFn: () => api.patch<PortfolioItemDetail>(`/portfolio/items/${item.id}/`, payload(draft, item.is_auto)),
    onSuccess: () => {
      toast(T.portfolio.savedToast);
      void refresh();
      onDone();
    },
  });
  return (
    <Modal
      title={T.portfolio.editTitle}
      subtitle={subtitle}
      onClose={onDone}
      dirty
      footer={
        <>
          <span className="spacer" />
          <Button onClick={onDone}>{T.common.cancel}</Button>
          <Button variant="primary" icon={<Save size={16} />} loading={save.isPending} disabled={!item.is_auto && !draft.title.trim()} onClick={() => save.mutate()}>
            {T.common.save}
          </Button>
        </>
      }
    >
      <ItemFields draft={draft} onChange={(d) => (onDraft(d), save.reset())} error={save.error} auto={item.is_auto} />
    </Modal>
  );
}

function ItemDetails({ item, subtitle, dirty, onDirty, onEdit }: {
  item: PortfolioItemDetail; subtitle: ReactNode; dirty: boolean; onDirty: (d: boolean) => void; onEdit: () => void;
}) {
  const { close } = useModal();
  const toast = useToast();
  const refresh = useRefresh(["portfolio"]);
  const [stars, setStars] = useState(item.my_review?.stars ?? 0);
  const [text, setText] = useState(item.my_review?.text ?? "");
  const [starsError, setStarsError] = useState(false);
  const reviews = usePagedList<PortfolioReview>(["portfolio", "reviews", item.id], `/portfolio/items/${item.id}/reviews/`, {});

  const changed = stars !== (item.my_review?.stars ?? 0) || text !== (item.my_review?.text ?? "");
  const saveReview = useMutation({
    mutationFn: () => api.post<PortfolioItemDetail>(`/portfolio/items/${item.id}/reviews/`, { stars, text: text.trim() }),
    onSuccess: () => {
      toast(T.portfolio.reviewSavedToast);
      onDirty(false);
      void refresh();
    },
  });
  const deleteReview = useMutation({
    mutationFn: () => api.del<PortfolioItemDetail>(`/portfolio/items/${item.id}/reviews/`),
    onSuccess: () => {
      toast(T.portfolio.reviewDeletedToast);
      setStars(0);
      setText("");
      onDirty(false);
      void refresh();
    },
  });
  const deleteItem = useMutation({
    mutationFn: () => api.del(`/portfolio/items/${item.id}/`),
    onSuccess: () => {
      toast(T.portfolio.deletedToast);
      void refresh();
      close();
    },
    onError: (e) => toast(e.message, "error"),
  });

  const submitReview = () => {
    if (!stars) {
      setStarsError(true);
      return;
    }
    saveReview.mutate();
  };
  const updateReview = (s: number, t: string) => {
    setStars(s);
    setText(t);
    setStarsError(false);
    saveReview.reset();
    onDirty(s !== (item.my_review?.stars ?? 0) || t !== (item.my_review?.text ?? ""));
  };

  const footer = (
    <>
      {item.actions.delete && (
        <ConfirmButton onConfirm={() => deleteItem.mutate()} loading={deleteItem.isPending}>
          <Trash2 size={16} /> {T.portfolio.deleteItem}
        </ConfirmButton>
      )}
      <span className="spacer" />
      {item.actions.edit && (
        <Button variant="primary" icon={<Pencil size={16} />} onClick={onEdit}>{T.common.edit}</Button>
      )}
      {item.actions.review && (
        <Button variant="primary" icon={<Save size={16} />} loading={saveReview.isPending} disabled={!changed} onClick={submitReview}>
          {item.my_review ? T.portfolio.reviewUpdate : T.portfolio.reviewSave}
        </Button>
      )}
    </>
  );

  return (
    <Modal title={item.title} subtitle={subtitle} size="lg" onClose={close} dirty={dirty} footer={footer}>
      <div className="stack" style={{ gap: 24 }}>
        <div className="row-wrap" style={{ justifyContent: "space-between" }}>
          <Button variant="ghost" size="sm" icon={<ArrowLeft size={16} />} onClick={close} aria-label={T.portfolio.backToPortfolio}>
            {T.common.back}
          </Button>
          <span className="row" style={{ gap: 8 }}>
            <Avatar user={item.owner} size="sm" />
            <span className="small" style={{ fontWeight: 600 }}>{item.owner.full_name}</span>
          </span>
        </div>

        <div className="row-wrap" style={{ justifyContent: "space-between", gap: 12 }}>
          <Stars value={item.rating} count={item.reviews_count} size={20} />
          {item.link && (
            <a className="btn" href={item.link} target="_blank" rel="noopener noreferrer nofollow">
              <ExternalLink size={16} /> {T.portfolio.openLink}
            </a>
          )}
        </div>

        {item.description && (
          <section>
            <h3 className="section-title">{T.portfolio.description}</h3>
            <p className="portfolio-description">{item.description}</p>
          </section>
        )}

        <PreviewImageSection item={item} />

        <section>
          <h3 className="section-title">{T.portfolio.videos}</h3>
          <VideoSection item={item} />
        </section>

        <section className="stack">
          <h3 className="section-title" style={{ marginBottom: 0 }}>{T.portfolio.reviews}</h3>
          {item.actions.review ? (
            <div className="card card-pad stack-sm">
              <b>{item.my_review ? T.portfolio.myReview : T.portfolio.yourStars}</b>
              <StarInput value={stars} onChange={(s) => updateReview(s, text)} invalid={starsError} />
              {starsError && <span className="field-error" role="alert">{T.portfolio.starsRequired}</span>}
              <Field label={T.portfolio.reviewText} hint={T.portfolio.chars(text.length, REVIEW_MAX)}>
                {(id) => <textarea id={id} className="textarea" rows={3} maxLength={REVIEW_MAX} placeholder={T.portfolio.reviewPh} value={text} onChange={(e) => updateReview(stars, e.target.value)} />}
              </Field>
              {saveReview.error && <ErrorBox error={saveReview.error} />}
              {item.my_review && (
                <div>
                  <Button variant="ghost" size="sm" icon={<Trash2 size={15} />} loading={deleteReview.isPending} onClick={() => deleteReview.mutate()}>
                    {T.portfolio.reviewDelete}
                  </Button>
                </div>
              )}
            </div>
          ) : (
            item.actions.edit && <Callout>{T.portfolio.ownHint}</Callout>
          )}
          {reviews.error && <ErrorBox error={reviews.error} onRetry={() => reviews.refetch()} />}
          {reviews.isLoading && <div className="card"><SkeletonRows rows={2} /></div>}
          {reviews.data && !reviews.data.length && (
            <div className="card"><Empty icon={<MessageSquare />} title={T.portfolio.reviewsEmpty} hint={item.actions.review ? T.portfolio.reviewsEmptyHint : undefined} /></div>
          )}
          {reviews.data && reviews.data.length > 0 && (
            <div className="card">
              {reviews.data.map((r) => (
                <div key={r.id} className="list-row portfolio-review">
                  <Avatar user={r.author} />
                  <div className="grow stack-sm" style={{ gap: 4, minWidth: 0 }}>
                    <div className="row-wrap" style={{ gap: 8 }}>
                      <b>{r.author.full_name}</b>
                      <Stars value={r.stars} size={14} />
                      <span className="small muted" title={fmtDate(r.updated_at)}>{timeAgo(r.updated_at)}</span>
                    </div>
                    {r.text && <p className="portfolio-description">{r.text}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
          <Pagination data={reviews.pagination} page={reviews.page} onPageChange={reviews.onPageChange} />
        </section>
      </div>
    </Modal>
  );
}

function PreviewImageSection({ item }: { item: PortfolioItemDetail }) {
  const toast = useToast();
  const refresh = useRefresh(["portfolio"]);
  const [files, setFiles] = useState<File[]>([]);
  const upload = useMutation({
    mutationFn: (file: File) => {
      const fd = new FormData();
      fd.append("image", file);
      return api.post(`/portfolio/items/${item.id}/image/`, fd);
    },
    onSuccess: () => {
      toast(T.portfolio.previewImageUploaded);
      setFiles([]);
      void refresh();
    },
  });
  const remove = useMutation({
    mutationFn: () => api.del(`/portfolio/items/${item.id}/image/`),
    onSuccess: () => {
      toast(T.portfolio.previewImageDeleted);
      void refresh();
    },
    onError: (e) => toast(e.message, "error"),
  });

  if (!item.actions.edit && !item.preview_image) return null;
  return (
    <section className="stack-sm">
      <h3 className="section-title">{T.portfolio.previewImage}</h3>
      {item.preview_image && (
        <div className="portfolio-preview-pick">
          <img src={item.preview_image} alt="" />
        </div>
      )}
      {item.actions.edit && (
        <div className="stack-sm">
          <FilePicker files={files} onChange={(f) => (setFiles(f), upload.reset())} multiple={false} accept=".jpg,.jpeg,.png,.webp"
            label={T.portfolio.previewImagePick} hint={T.portfolio.previewImageHint} maxMb={8} />
          {upload.error && <ErrorBox error={upload.error} />}
          <div className="row" style={{ gap: 8 }}>
            {files[0] && (
              <Button variant="primary" size="sm" icon={<ImagePlus size={14} />} loading={upload.isPending} onClick={() => upload.mutate(files[0]!)}>
                {T.portfolio.previewImagePick}
              </Button>
            )}
            {item.preview_image && (
              <ConfirmButton onConfirm={() => remove.mutate()} loading={remove.isPending}>
                <Trash2 size={14} /> {T.common.delete}
              </ConfirmButton>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function VideoSection({ item }: { item: PortfolioItemDetail }) {
  const toast = useToast();
  const refresh = useRefresh(["portfolio"]);
  const [files, setFiles] = useState<File[]>([]);
  const upload = useMutation({
    mutationFn: (file: File) => {
      const fd = new FormData();
      fd.append("video", file);
      return api.post(`/portfolio/items/${item.id}/videos/`, fd);
    },
    onSuccess: () => {
      toast(T.portfolio.videoUploadedToast);
      setFiles([]);
      void refresh();
    },
  });
  const remove = useMutation({
    mutationFn: (videoId: number) => api.del(`/portfolio/items/${item.id}/videos/${videoId}/`),
    onSuccess: () => {
      toast(T.portfolio.videoDeletedToast);
      void refresh();
    },
    onError: (e) => toast(e.message, "error"),
  });

  return (
    <div className="stack">
      {item.videos.length === 0 && !item.actions.upload && <p className="small muted">{T.portfolio.videosEmpty}</p>}
      {item.videos.map((v) => (
        <figure key={v.id} className="portfolio-video-wrap">
          <video className="portfolio-video" controls preload="metadata" src={v.url}>
            {T.portfolio.videoUnsupported}
          </video>
          <figcaption className="row-wrap" style={{ justifyContent: "space-between" }}>
            <span className="row small muted" style={{ gap: 6, minWidth: 0 }}>
              <Video size={14} /> <span className="ellipsis">{v.name}</span> {v.size !== null && `· ${fileSize(v.size)}`}
            </span>
            {item.actions.upload && (
              <ConfirmButton onConfirm={() => remove.mutate(v.id)} loading={remove.isPending}>
                <Trash2 size={15} /> {T.portfolio.videoDelete}
              </ConfirmButton>
            )}
          </figcaption>
        </figure>
      ))}
      {item.actions.upload && (
        <div className="stack-sm">
          <FilePicker files={files} onChange={(f) => (setFiles(f), upload.reset())} multiple={false} accept=".mp4,.webm,.mov"
            label={T.portfolio.videoPick} hint={T.portfolio.videoHint} maxMb={100} />
          {upload.error && <ErrorBox error={upload.error} />}
          {files[0] && (
            <div>
              <Button variant="primary" icon={<Upload size={16} />} loading={upload.isPending} onClick={() => upload.mutate(files[0]!)}>
                {T.portfolio.videoUpload}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

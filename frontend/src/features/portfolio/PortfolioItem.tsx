import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowLeft, ExternalLink, Image, MessageSquare, Pencil, Save, Trash2, Upload, Video } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";

import { useModal } from "@/app/modals";
import { usePagedList, useRefresh } from "@/app/queries";
import { api, ApiError, formData } from "@/shared/api";
import { fileSize, fmtDate, minDate, timeAgo } from "@/shared/format";
import { T } from "@/shared/text";
import type { PortfolioItemDetail, PortfolioReview } from "@/shared/types";
import { Avatar, Badge, Button, Callout, CodeTag, ConfirmButton, Empty, ErrorBox, Field, FilePicker, Modal, Skeleton, SkeletonRows, useToast } from "@/shared/ui";
import { Pagination } from "@/shared/ui/Pagination";

import { periodText } from "./period";
import { StarInput, Stars } from "./Stars";

const REVIEW_MAX = 1000;
const DESCRIPTION_MAX = 2000;
const COVER_MAX_BYTES = 5 * 1024 * 1024;
const COVER_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

interface Draft {
  title: string;
  description: string;
  link: string;
  start_date: string;
  end_date: string;
  technologies: string;
}

const EMPTY: Draft = { title: "", description: "", link: "", start_date: "", end_date: "", technologies: "" };

const technologyValues = (value: string) => [...new Set(value.split(",").map((item) => item.trim()).filter(Boolean))];

function payload(draft: Draft, auto: boolean) {
  const base = { description: draft.description.trim(), link: draft.link.trim(), technologies: technologyValues(draft.technologies) };
  if (auto) return base;
  return { ...base, title: draft.title.trim(), start_date: draft.start_date || null, end_date: draft.end_date || null };
}

/** Loyiha maydonlari: qo'shish va tahrirlashda bir xil. TeamFlow loyihasida nomi va sanalari o'zgarmaydi. */
function ItemFields({ draft, onChange, error, auto, cover, onCover, currentCover, saved }: {
  draft: Draft; onChange: (d: Draft) => void; error: unknown; auto: boolean;
  cover: File | null; onCover: (file: File | null) => void; currentCover?: string | null;
  /** Tahrirda: saqlangan sanalar (o'tib ketgan bo'lsa ham o'zgartirmasdan qoldirish mumkin). */
  saved?: { start_date: string; end_date: string };
}) {
  const err = (name: string) => (error instanceof ApiError ? error.field(name) : undefined);
  const set = (k: keyof Draft) => (e: { target: { value: string } }) => onChange({ ...draft, [k]: e.target.value });
  const technologiesError = technologyValues(draft.technologies).length > 10 ? T.portfolio.fields.technologiesHint : err("technologies");
  return (
    <div className="stack">
      {auto ? (
        <Callout>{T.portfolio.fields.autoNote}</Callout>
      ) : (
        <>
          <Field label={T.portfolio.fields.title} required error={err("title")}>
            {(id, invalid) => <input id={id} className="input" maxLength={255} autoFocus aria-invalid={invalid} placeholder={T.portfolio.fields.titlePh} value={draft.title} onChange={set("title")} />}
          </Field>
          <div className="grid-2">
            <Field label={T.portfolio.fields.start} error={err("start_date")}>
              {(id, invalid) => <input id={id} type="date" className="input" aria-invalid={invalid} min={minDate(saved?.start_date)} value={draft.start_date} onChange={set("start_date")} />}
            </Field>
            <Field label={T.portfolio.fields.end} error={err("end_date")}>
              {(id, invalid) => <input id={id} type="date" className="input" aria-invalid={invalid} value={draft.end_date} min={minDate(saved?.end_date, draft.start_date)} onChange={set("end_date")} />}
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
      <Field label={T.portfolio.fields.technologies} hint={T.portfolio.fields.technologiesHint} error={technologiesError}>
        {(id, invalid) => <input id={id} className="input" aria-invalid={invalid} placeholder={T.portfolio.fields.technologiesPh} value={draft.technologies} onChange={set("technologies")} />}
      </Field>
      <CoverField file={cover} onChange={onCover} current={currentCover} serverError={err("cover")} />
      {error instanceof ApiError && !Object.keys(error.fields).length ? <ErrorBox error={error} /> : null}
      {error && !(error instanceof ApiError) ? <ErrorBox error={error} /> : null}
    </div>
  );
}

function CoverField({ file, onChange, current, serverError }: { file: File | null; onChange: (file: File | null) => void; current?: string | null; serverError?: string }) {
  const [preview, setPreview] = useState<string | null>(current ?? null);
  const [error, setError] = useState<string>();
  useEffect(() => {
    if (!file) {
      setPreview(current ?? null);
      return;
    }
    if (typeof URL.createObjectURL !== "function") return;
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file, current]);

  return (
    <Field label={T.portfolio.fields.cover} hint={T.portfolio.fields.coverHint} error={error || serverError}>
      {(id, invalid) => (
        <div className="stack-sm">
          {preview ? (
            <img src={preview} alt={T.portfolio.fields.cover} style={{ width: "100%", height: 180, objectFit: "cover", borderRadius: 12 }} />
          ) : (
            <div style={{ height: 120, display: "grid", placeItems: "center", border: "1px dashed var(--border)", borderRadius: 12, background: "var(--surface-2)" }}>
              <Image size={28} className="muted" aria-hidden />
            </div>
          )}
          <input
            id={id}
            className="input"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            aria-invalid={invalid}
            onChange={(event) => {
              const next = event.target.files?.[0] ?? null;
              event.target.value = "";
              if (next && (!COVER_TYPES.has(next.type) || next.size > COVER_MAX_BYTES)) {
                setError(T.portfolio.fields.coverInvalid);
                onChange(null);
                return;
              }
              setError(undefined);
              onChange(next);
            }}
          />
          {file && <span className="small muted">{file.name}</span>}
        </div>
      )}
    </Field>
  );
}

/** Yangi loyiha (faqat portfolio egasi). Saqlangach shu modal ichida loyiha ochiladi. */
export function PortfolioItemForm({ ownerId }: { ownerId: number }) {
  const { open, close } = useModal();
  const toast = useToast();
  const refresh = useRefresh(["portfolio"]);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [cover, setCover] = useState<File | null>(null);
  const save = useMutation({
    mutationFn: async () => {
      const item = await api.post<PortfolioItemDetail>("/portfolio/items/", payload(draft, false));
      if (!cover) return { item, coverFailed: false };
      try {
        await api.post<PortfolioItemDetail>(`/portfolio/items/${item.id}/cover/`, formData({}, [cover], "cover"));
        return { item, coverFailed: false };
      } catch {
        return { item, coverFailed: true };
      }
    },
    onSuccess: ({ item, coverFailed }) => {
      toast(T.portfolio.savedToast);
      if (coverFailed) toast(T.portfolio.fields.coverUploadFailed, "error");
      void refresh();
      open({ portfolio: ownerId, item: item.id }, true);
    },
  });
  const dirty = JSON.stringify(draft) !== JSON.stringify(EMPTY) || cover !== null;
  const tooManyTechnologies = technologyValues(draft.technologies).length > 10;
  return (
    <Modal
      title={T.portfolio.addTitle}
      onClose={close}
      dirty={dirty && !save.isSuccess}
      footer={
        <>
          <span className="spacer" />
          <Button onClick={close}>{T.common.cancel}</Button>
          <Button variant="primary" icon={<Save size={16} />} loading={save.isPending} disabled={!draft.title.trim() || tooManyTechnologies} onClick={() => save.mutate()}>
            {T.portfolio.addSubmit}
          </Button>
        </>
      }
    >
      <ItemFields draft={draft} onChange={(d) => (setDraft(d), save.reset())} error={save.error} auto={false}
        cover={cover} onCover={(file) => { setCover(file); save.reset(); }} />
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
        start_date: item.manual.start_date ?? "", end_date: item.manual.end_date ?? "", technologies: (item.technologies ?? []).join(", ") })}
    />
  );
}

function ItemEdit({ item, draft, onDraft, onDone, subtitle }: { item: PortfolioItemDetail; draft: Draft; onDraft: (d: Draft) => void; onDone: () => void; subtitle: ReactNode }) {
  const toast = useToast();
  const refresh = useRefresh(["portfolio"]);
  const [cover, setCover] = useState<File | null>(null);
  const save = useMutation({
    mutationFn: async () => {
      const updated = await api.patch<PortfolioItemDetail>(`/portfolio/items/${item.id}/`, payload(draft, item.is_auto));
      if (!cover) return { updated, coverFailed: false };
      try {
        await api.post<PortfolioItemDetail>(`/portfolio/items/${item.id}/cover/`, formData({}, [cover], "cover"));
        return { updated, coverFailed: false };
      } catch {
        return { updated, coverFailed: true };
      }
    },
    onSuccess: ({ coverFailed }) => {
      toast(T.portfolio.savedToast);
      if (coverFailed) toast(T.portfolio.fields.coverUploadFailed, "error");
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
          <Button variant="primary" icon={<Save size={16} />} loading={save.isPending}
            disabled={(!item.is_auto && !draft.title.trim()) || technologyValues(draft.technologies).length > 10} onClick={() => save.mutate()}>
            {T.common.save}
          </Button>
        </>
      }
    >
      <ItemFields draft={draft} onChange={(d) => (onDraft(d), save.reset())} error={save.error} auto={item.is_auto}
        cover={cover} onCover={(file) => { setCover(file); save.reset(); }} currentCover={item.cover}
        saved={{ start_date: item.manual.start_date ?? "", end_date: item.manual.end_date ?? "" }} />
    </Modal>
  );
}

function ItemDetails({ item, subtitle, dirty, onDirty, onEdit }: {
  item: PortfolioItemDetail; subtitle: ReactNode; dirty: boolean; onDirty: (d: boolean) => void; onEdit: () => void;
}) {
  const { close } = useModal();
  const toast = useToast();
  const refresh = useRefresh(["portfolio", "profile"]);
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

        {item.cover ? (
          <img src={item.cover} alt={T.portfolio.coverAlt(item.title)} style={{ width: "100%", maxHeight: 360, objectFit: "cover", borderRadius: 16 }} />
        ) : (
          <div role="img" aria-label={T.portfolio.coverEmpty(item.title)} style={{ height: 180, display: "grid", placeItems: "center", borderRadius: 16, background: "var(--surface-2)" }}>
            <Image size={32} className="muted" aria-hidden />
          </div>
        )}

        <div className="row-wrap" style={{ justifyContent: "space-between", gap: 12 }}>
          <Stars value={item.rating} count={item.reviews_count} size={20} />
          {item.link && (
            <a className="btn" href={item.link} target="_blank" rel="noopener noreferrer nofollow">
              <ExternalLink size={16} /> {T.portfolio.openLink}
            </a>
          )}
        </div>

        {!!item.technologies?.length && (
          <section>
            <h3 className="section-title">{T.portfolio.technologies}</h3>
            <div className="row-wrap">{item.technologies.map((technology) => <Badge key={technology} dot={false}>{technology}</Badge>)}</div>
          </section>
        )}

        {item.description && (
          <section>
            <h3 className="section-title">{T.portfolio.description}</h3>
            <p className="portfolio-description">{item.description}</p>
          </section>
        )}

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

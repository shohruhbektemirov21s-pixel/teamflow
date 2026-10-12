import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ImagePlus, Pencil, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";

import { useAuth, useMe } from "@/app/auth";
import { useModal } from "@/app/modals";
import { usePagedList } from "@/app/queries";
import { Stars } from "@/features/portfolio/Stars";
import { TaskTable } from "@/features/tasks/TaskTable";
import { api, ApiError, formData } from "@/shared/api";
import { fmtDate } from "@/shared/format";
import { useMeta } from "@/shared/meta";
import { T } from "@/shared/text";
import type { Profile, Project, ProjectStatus, Rating, Task } from "@/shared/types";
import { Badge, Button, Empty, ErrorBox, Field, SkeletonRows, useToast } from "@/shared/ui";
import type { Tone } from "@/shared/status";
import { Pagination } from "@/shared/ui/Pagination";

import { ProfileHeader } from "./ProfileHeader";
import { BusinessTripPanel } from "./BusinessTripPanel";

const fieldError = (err: unknown, name: string) => (err instanceof ApiError ? err.field(name) : undefined);
/** Maydonga bog'lanmagan xato bo'lsa — toast bilan ko'rsatiladi (maydon xatolari maydon yonida). */
const generalError = (err: unknown) =>
  err instanceof ApiError ? (Object.keys(err.fields).length ? null : err.message) : T.common.errorGeneric;

const STATUS_TONE: Record<ProjectStatus, Tone> = { done: "success", active: "info", overdue: "danger" };
const RATINGS_PREVIEW = 5;

/** Mening profilim: tepada sarlavha (rasm, ism, lavozim, bio, "Tahrirlash"), ostida bo'limlar.
 * Har bir ma'lumot bir joyda: ism va bio — sarlavhada, login/Telegram/sana — "Shaxsiy ma'lumotlar"da.
 * Tahrirlash modalsiz: shu bo'lim formaga aylanadi. Loyiha/vazifa/reyting bo'limlari rolga qarab chiqadi. */
export default function ProfilePage() {
  const me = useMe();
  const bot = useMeta().telegram_bot;
  const { refresh } = useAuth();
  const { open } = useModal();
  const toast = useToast();
  const qc = useQueryClient();

  const [editing, setEditing] = useState(false);
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [bio, setBio] = useState("");
  const [telegram, setTelegram] = useState("");
  const [oldPass, setOldPass] = useState("");
  const [newPass, setNewPass] = useState("");

  const q = useQuery({ queryKey: ["profile"], queryFn: () => api.get<Profile>("/auth/profile/") });
  const p = q.data;
  const developer = me.role === "developer";
  const ordinary = me.role === "user";
  const myTasks = usePagedList<Task>(["tasks", "mine", "profile"], "/tasks/", { mine: 1 }, developer);
  const myProjects = usePagedList<Project>(["projects", "mine", "profile"], "/projects/", {}, developer);
  const myRatings = usePagedList<Rating>(["portfolio", "ratings", "profile"], "/portfolio/ratings/", { mine: 1 }, ordinary);

  const resetForm = (profile: Profile) => {
    setFirst(profile.first_name);
    setLast(profile.last_name);
    setBio(profile.bio || "");
    setTelegram(profile.telegram_username || "");
  };
  useEffect(() => {
    if (p && !editing) resetForm(p);
  }, [p, editing]);

  const infoMut = useMutation({
    mutationFn: () => api.patch<Profile>("/auth/profile/", { first_name: first, last_name: last, bio, telegram_username: telegram }),
    onSuccess: () => {
      toast(T.profile.savedToast);
      setEditing(false);
      qc.invalidateQueries({ queryKey: ["profile"] });
      void refresh();
    },
    onError: (err) => {
      const msg = generalError(err);
      if (msg) toast(msg, "error");
    },
  });

  const photoInput = useRef<HTMLInputElement>(null);
  const photoMut = useMutation({
    mutationFn: (file: File | null) =>
      file ? api.post<Profile>("/auth/avatar/", formData({}, [file], "avatar")) : api.del<Profile>("/auth/avatar/"),
    onSuccess: (_d, file) => {
      toast(file ? T.profile.photoSavedToast : T.profile.photoRemovedToast);
      void qc.invalidateQueries(); // rasm ro'yxatlar, jadval va chatda ham yangilansin
      void refresh();
    },
    onError: (err) => toast(err instanceof ApiError ? err.field("avatar") || err.message : T.common.errorGeneric, "error"),
  });

  const passMut = useMutation({
    mutationFn: () => api.post("/auth/password/", { current_password: oldPass, new_password: newPass }),
    onSuccess: () => {
      toast(T.profile.passwordChangedToast);
      setOldPass("");
      setNewPass("");
    },
    onError: (err) => {
      const msg = generalError(err);
      if (msg) toast(msg, "error");
    },
  });

  const telegramHint = bot ? (
    <>
      {T.profile.telegramHintBefore}{" "}
      <a href={`https://t.me/${bot}`} target="_blank" rel="noopener noreferrer" style={{ fontWeight: 600 }}>
        @{bot}
      </a>{" "}
      {T.profile.telegramHintAfter}
    </>
  ) : (
    T.profile.telegramHint
  );

  return (
    <div className="stack" style={{ maxWidth: 800, width: "100%", margin: "0 auto" }}>
      <div className="card card-pad">
        <ProfileHeader
          user={me}
          subtitle={me.department_name || (ordinary ? me.role_label : me.specialty || me.role_label)}
          bio={p?.bio}
          stats={p?.stats && { active: p.stats.active, overdue: p.stats.overdue, review: p.stats.in_review, done: p.stats.done }}
          actions={
            !editing && (
              <Button size="sm" icon={<Pencil />} disabled={!p} onClick={() => p && (resetForm(p), setEditing(true))}>
                {T.profile.edit}
              </Button>
            )
          }
        />
      </div>

      <section className="card card-pad stack" aria-label={T.profile.personalTitle}>
        <h3>{T.profile.personalTitle}</h3>
        {q.isLoading && <SkeletonRows rows={2} />}
        {q.error && <ErrorBox error={q.error} onRetry={() => q.refetch()} />}
        {p && !editing && (
          <dl className="kv">
            <div><dt>{T.profile.login}</dt><dd>{me.username}</dd></div>
            <div><dt>{T.profile.telegram}</dt><dd>{p.telegram_username || "—"}</dd></div>
            <div><dt>{T.profile.dateJoined}</dt><dd>{fmtDate(p.date_joined)}</dd></div>
          </dl>
        )}
        {p && editing && (
          <form
            className="stack"
            onSubmit={(e) => {
              e.preventDefault();
              infoMut.mutate();
            }}
          >
            <div className="row-wrap">
              <input
                ref={photoInput}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                hidden
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (file) photoMut.mutate(file);
                }}
              />
              <Button size="sm" icon={<ImagePlus />} loading={photoMut.isPending} onClick={() => photoInput.current?.click()}>
                {me.avatar ? T.profile.photoChange : T.profile.photoUpload}
              </Button>
              {me.avatar && (
                <Button size="sm" variant="ghost" icon={<Trash2 />} disabled={photoMut.isPending} onClick={() => photoMut.mutate(null)}>
                  {T.profile.photoRemove}
                </Button>
              )}
              <span className="small muted">{T.profile.photoHint}</span>
            </div>
            <div className="grid-2">
              <Field label={T.profile.firstName} required error={fieldError(infoMut.error, "first_name")}>
                {(id, bad) => <input id={id} className="input" aria-invalid={bad} value={first} onChange={(e) => setFirst(e.target.value)} />}
              </Field>
              <Field label={T.profile.lastName} required error={fieldError(infoMut.error, "last_name")}>
                {(id, bad) => <input id={id} className="input" aria-invalid={bad} value={last} onChange={(e) => setLast(e.target.value)} />}
              </Field>
            </div>
            <Field label={T.profile.bio} hint={T.profile.bioCount(bio.length, T.profile.bioMax)} error={fieldError(infoMut.error, "bio")}>
              {(id, bad) => (
                <textarea
                  id={id}
                  className="input"
                  rows={3}
                  maxLength={T.profile.bioMax}
                  aria-invalid={bad}
                  placeholder={T.profile.bioPh}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                />
              )}
            </Field>
            <Field label={T.profile.telegram} hint={telegramHint} error={fieldError(infoMut.error, "telegram_username")}>
              {(id, bad) => (
                <input id={id} className="input" aria-invalid={bad} value={telegram} placeholder={T.profile.telegramPh} onChange={(e) => setTelegram(e.target.value)} />
              )}
            </Field>
            <div className="form-actions">
              <Button onClick={() => { infoMut.reset(); setEditing(false); }}>{T.profile.cancel}</Button>
              <Button type="submit" variant="primary" loading={infoMut.isPending} disabled={!first.trim() || !last.trim()}>
                {T.common.save}
              </Button>
            </div>
          </form>
        )}
      </section>

      {me.role === "boss" && <BusinessTripPanel />}

      {developer && (
        <section className="card" aria-label={T.profile.myProjects}>
          <div className="card-head">
            <h3 className="grow">
              {T.profile.myProjects} {myProjects.pagination && <span className="count-pill soft">{myProjects.pagination.count}</span>}
            </h3>
          </div>
          {myProjects.error && <div className="card-pad"><ErrorBox error={myProjects.error} onRetry={() => myProjects.refetch()} /></div>}
          {myProjects.isLoading && <div className="card-pad"><SkeletonRows rows={2} /></div>}
          {myProjects.data && !myProjects.data.length && <Empty title={T.profile.myProjectsEmpty} />}
          {myProjects.data?.map((project) => (
            <button key={project.id} type="button" className="list-row clickable" onClick={() => open({ project: project.id })}>
              <span className="grow stack-sm" style={{ gap: 4, minWidth: 0, textAlign: "left" }}>
                <b className="ellipsis">{project.name}</b>
                <span className="small muted">{project.code} · {fmtDate(project.end_date)}</span>
              </span>
              <Badge tone={STATUS_TONE[project.status]}>{T.projects.status[project.status]}</Badge>
            </button>
          ))}
          <Pagination data={myProjects.pagination} page={myProjects.page} onPageChange={myProjects.onPageChange} />
        </section>
      )}

      {developer && (
        <section className="card" aria-label={T.profile.myTasks}>
          <div className="card-head">
            <h3 className="grow">
              {T.profile.myTasks} {myTasks.data && <span className="count-pill soft">{myTasks.pagination?.count}</span>}
            </h3>
          </div>
          {myTasks.error ? (
            <div className="card-pad">
              <ErrorBox error={myTasks.error} onRetry={() => myTasks.refetch()} />
            </div>
          ) : (
            <TaskTable tasks={myTasks.data} loading={myTasks.isLoading} emptyHint={T.profile.myTasksEmpty} />
          )}
          <Pagination data={myTasks.pagination} page={myTasks.page} onPageChange={myTasks.onPageChange} />
        </section>
      )}

      {developer && p?.portfolio && (
        <section className="card card-pad stack" aria-label={T.profile.myRatings}>
          <div className="row" style={{ gap: 12 }}>
            <h3 className="grow">{T.profile.myRatings}</h3>
            <Button size="sm" onClick={() => open({ portfolio: me.id })}>{T.profile.openPortfolio}</Button>
          </div>
          <div className="row-wrap">
            <Stars value={p.portfolio.rating} count={p.portfolio.rating === null ? undefined : p.portfolio.reviews_count} size={20} />
            <span className="small muted">{T.profile.projectsN(p.portfolio.projects_count)}</span>
          </div>
          {p.portfolio.rating === null && <p className="small muted">{T.profile.developerRatingEmpty}</p>}
          <div>
            <div className="field-label">{T.profile.technologies}</div>
            {p.portfolio.technologies.length ? (
              <div className="chips">
                {p.portfolio.technologies.map((name) => <Badge key={name} dot={false}>{name}</Badge>)}
              </div>
            ) : (
              <p className="small muted">{T.profile.technologiesEmpty}</p>
            )}
          </div>
        </section>
      )}

      {ordinary && (
        <section className="card" aria-label={T.profile.myRatings}>
          <div className="card-head">
            <h3 className="grow">
              {T.profile.myRatings} {myRatings.pagination && <span className="count-pill soft">{myRatings.pagination.count}</span>}
            </h3>
            {(myRatings.pagination?.count ?? 0) > RATINGS_PREVIEW && (
              <Link className="small" to="/baholarim">{T.profile.allRatings}</Link>
            )}
          </div>
          {myRatings.error && <div className="card-pad"><ErrorBox error={myRatings.error} onRetry={() => myRatings.refetch()} /></div>}
          {myRatings.isLoading && <div className="card-pad"><SkeletonRows rows={2} /></div>}
          {myRatings.data && !myRatings.data.length && (
            <Empty
              title={T.profile.myRatingsEmpty}
              hint={T.profile.myRatingsEmptyHint}
              action={<Link className="btn btn-primary" to="/">{T.profile.myRatingsCta}</Link>}
            />
          )}
          {myRatings.data?.slice(0, RATINGS_PREVIEW).map((r) => (
            <button key={r.id} type="button" className="list-row clickable" onClick={() => open({ portfolio: r.developer.id, item: r.item_id })}>
              <span className="grow stack-sm" style={{ gap: 4, minWidth: 0, textAlign: "left" }}>
                <b className="ellipsis">{r.item_title}</b>
                <span className="small muted ellipsis">{T.ratings.developer(r.developer.full_name)} · {fmtDate(r.updated_at)}</span>
                {r.text && <span className="small">{r.text}</span>}
              </span>
              <Stars value={r.stars} />
            </button>
          ))}
        </section>
      )}

      <form
        className="card card-pad stack"
        onSubmit={(e) => {
          e.preventDefault();
          if (oldPass && newPass) passMut.mutate();
        }}
      >
        <h3>{T.profile.passwordTitle}</h3>
        <div className="grid-2">
          <Field label={T.profile.currentPassword} error={fieldError(passMut.error, "current_password")}>
            {(id, bad) => (
              <input id={id} className="input" type="password" autoComplete="current-password" aria-invalid={bad} value={oldPass} onChange={(e) => setOldPass(e.target.value)} />
            )}
          </Field>
          <Field label={T.profile.newPassword} hint={T.auth.passwordHint} error={fieldError(passMut.error, "new_password")}>
            {(id, bad) => (
              <input id={id} className="input" type="password" autoComplete="new-password" aria-invalid={bad} value={newPass} onChange={(e) => setNewPass(e.target.value)} />
            )}
          </Field>
        </div>
        <div className="form-actions">
          <Button type="submit" variant="primary" loading={passMut.isPending} disabled={!oldPass || !newPass}>
            {T.profile.changePassword}
          </Button>
        </div>
      </form>
    </div>
  );
}

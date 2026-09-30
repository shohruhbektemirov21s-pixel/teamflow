import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ImagePlus, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { useAuth, useMe } from "@/app/auth";
import { TaskTable } from "@/features/tasks/TaskTable";
import { api, ApiError, formData, qs } from "@/shared/api";
import { fmtDate } from "@/shared/format";
import { useMeta } from "@/shared/meta";
import { T } from "@/shared/text";
import type { Profile, Task } from "@/shared/types";
import { Button, ErrorBox, Field, SkeletonRows, useToast } from "@/shared/ui";

import { ProfileHeader } from "./ProfileHeader";

const fieldError = (err: unknown, name: string) => (err instanceof ApiError ? err.field(name) : undefined);
/** Maydonga bog'lanmagan xato bo'lsa — toast bilan ko'rsatiladi (maydon xatolari maydon yonida). */
const generalError = (err: unknown) =>
  err instanceof ApiError ? (Object.keys(err.fields).length ? null : err.message) : T.common.errorGeneric;

export default function ProfilePage() {
  const me = useMe();
  const bot = useMeta().telegram_bot;
  const { refresh } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();

  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [telegram, setTelegram] = useState("");
  const [oldPass, setOldPass] = useState("");
  const [newPass, setNewPass] = useState("");

  const q = useQuery({ queryKey: ["profile"], queryFn: () => api.get<Profile>("/auth/profile/") });
  const p = q.data;
  // Dasturchi profilida — faqat o'ziga biriktirilgan vazifalar (server `mine=1` bo'yicha filtrlaydi)
  const developer = me.role === "developer";
  const myTasks = useQuery({
    queryKey: ["tasks", "mine", "profile"],
    queryFn: () => api.get<Task[]>(`/tasks/${qs({ mine: 1, all: 1 })}`),
    enabled: developer,
  });

  useEffect(() => {
    if (p) {
      setFirst(p.first_name);
      setLast(p.last_name);
      setTelegram(p.telegram_username || "");
    }
  }, [p]);

  const infoMut = useMutation({
    mutationFn: () => api.patch<Profile>("/auth/profile/", { first_name: first, last_name: last, telegram_username: telegram }),
    onSuccess: () => {
      toast(T.profile.savedToast);
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

  return (
    <div className="stack" style={{ maxWidth: 800, width: "100%", margin: "0 auto" }}>
      <h1>{T.profile.title}</h1>

      <div className="card card-pad stack">
        <ProfileHeader
          user={me}
          subtitle={me.department_name || me.specialty || me.role_label}
          stats={p?.stats && { active: p.stats.active, overdue: p.stats.overdue, review: p.stats.in_review, done: p.stats.done }}
          actions={
            <>
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
            </>
          }
        />

        <h3>{T.profile.editInfoTitle}</h3>
        {q.isLoading ? (
          <SkeletonRows rows={2} />
        ) : (
          <form
            className="grid-2"
            onSubmit={(e) => {
              e.preventDefault();
              infoMut.mutate();
            }}
          >
            <Field label={T.profile.firstName} error={fieldError(infoMut.error, "first_name")}>
              {(id, bad) => <input id={id} className="input" aria-invalid={bad} value={first} onChange={(e) => setFirst(e.target.value)} />}
            </Field>
            <Field label={T.profile.lastName} error={fieldError(infoMut.error, "last_name")}>
              {(id, bad) => <input id={id} className="input" aria-invalid={bad} value={last} onChange={(e) => setLast(e.target.value)} />}
            </Field>
            <Field
              label={T.profile.telegram}
              hint={
                bot ? (
                  <>
                    {T.profile.telegramHintBefore}{" "}
                    <a href={`https://t.me/${bot}`} target="_blank" rel="noopener noreferrer" style={{ fontWeight: 600 }}>
                      @{bot}
                    </a>{" "}
                    {T.profile.telegramHintAfter}
                  </>
                ) : (
                  T.profile.telegramHint
                )
              }
              error={fieldError(infoMut.error, "telegram_username")}>
              {(id, bad) => (
                <input id={id} className="input" aria-invalid={bad} value={telegram} placeholder={T.profile.telegramPh} onChange={(e) => setTelegram(e.target.value)} />
              )}
            </Field>
            <Field label={T.profile.login}>{(id) => <input id={id} className="input" value={me.username} disabled />}</Field>
            <Field label={T.profile.dateJoined}>
              {(id) => <input id={id} className="input" value={p?.date_joined ? fmtDate(p.date_joined) : ""} disabled />}
            </Field>
            <div style={{ gridColumn: "1 / -1" }}>
              <Button type="submit" variant="primary" loading={infoMut.isPending}>
                {T.common.save}
              </Button>
            </div>
          </form>
        )}
      </div>

      {developer && (
        <section className="card" aria-label={T.profile.myTasks}>
          <div className="card-head">
            <h3 className="grow">
              {T.profile.myTasks} {myTasks.data && <span className="count-pill soft">{myTasks.data.length}</span>}
            </h3>
          </div>
          {myTasks.error ? (
            <div className="card-pad">
              <ErrorBox error={myTasks.error} onRetry={() => myTasks.refetch()} />
            </div>
          ) : (
            <TaskTable tasks={myTasks.data} loading={myTasks.isLoading} emptyHint={T.profile.myTasksEmpty} />
          )}
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
        <div>
          <Button type="submit" variant="primary" loading={passMut.isPending} disabled={!oldPass || !newPass}>
            {T.profile.changePassword}
          </Button>
        </div>
      </form>
    </div>
  );
}

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { useAuth, useMe } from "@/app/auth";
import { api, ApiError } from "@/shared/api";
import { fmtDate } from "@/shared/format";
import { T } from "@/shared/text";
import type { Profile } from "@/shared/types";
import { Avatar, Badge, Button, Field, SkeletonRows, useToast } from "@/shared/ui";

const fieldError = (err: unknown, name: string) => (err instanceof ApiError ? err.field(name) : undefined);
/** Maydonga bog'lanmagan xato bo'lsa — toast bilan ko'rsatiladi (maydon xatolari maydon yonida). */
const generalError = (err: unknown) =>
  err instanceof ApiError ? (Object.keys(err.fields).length ? null : err.message) : T.common.errorGeneric;

export default function ProfilePage() {
  const me = useMe();
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
        <div className="row">
          <Avatar user={me} size="lg" />
          <div>
            <h2 style={{ margin: 0 }}>{me.full_name}</h2>
            <div className="small muted">{me.department_name || me.specialty || me.role_label}</div>
          </div>
        </div>

        {p?.stats && (
          <div className="row-wrap" aria-label={T.profile.stats}>
            <Badge tone="info">{T.people.activeN(p.stats.active)}</Badge>
            <Badge tone="danger">{T.people.overdueN(p.stats.overdue)}</Badge>
            <Badge tone="violet">{T.people.reviewN(p.stats.in_review)}</Badge>
            <Badge tone="success">{T.people.doneN(p.stats.done)}</Badge>
          </div>
        )}

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
            <Field label={T.profile.telegram} hint={T.profile.telegramHint} error={fieldError(infoMut.error, "telegram_username")}>
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

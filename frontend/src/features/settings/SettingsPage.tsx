import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, ImagePlus, Lock, Moon, Sun, Trash2, User } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";

import { useAuth, useMe } from "@/app/auth";
import { api, ApiError, formData } from "@/shared/api";
import { fmtDateTime } from "@/shared/format";
import { useMeta } from "@/shared/meta";
import { T } from "@/shared/text";
import { setTheme, useTheme, type Theme } from "@/shared/theme";
import type { Profile } from "@/shared/types";
import { Avatar, Badge, Button, ErrorBox, Field, SkeletonRows, useToast } from "@/shared/ui";

type Section = "profile" | "security" | "notifications" | "appearance";

const SECTIONS: { key: Section; icon: ReactNode }[] = [
  { key: "profile", icon: <User /> },
  { key: "security", icon: <Lock /> },
  { key: "notifications", icon: <Bell /> },
  { key: "appearance", icon: <Sun /> },
];

const fieldError = (err: unknown, name: string) => (err instanceof ApiError ? err.field(name) : undefined);
/** Maydonga bog'lanmagan xato bo'lsa — toast bilan ko'rsatiladi (maydon xatolari maydon yonida). */
const generalError = (err: unknown) =>
  err instanceof ApiError ? (Object.keys(err.fields).length ? null : err.message) : T.common.errorGeneric;

/** Sozlamalar: chapda bo'limlar, o'ngda tanlangani. Faqat o'zgartirsa bo'ladigan narsalar ko'rsatiladi.
 * Parol va xavfsizlik ma'lumotlari brauzerda saqlanmaydi — formadan faqat serverga yuboriladi. */
export default function SettingsPage() {
  const [section, setSection] = useState<Section>("profile");
  const q = useQuery({ queryKey: ["profile"], queryFn: () => api.get<Profile>("/auth/profile/") });

  return (
    <div className="settings">
      <nav className="settings-nav" aria-label={T.settings.title}>
        {SECTIONS.map(({ key, icon }) => (
          <button key={key} type="button" className="settings-tab" aria-current={section === key} onClick={() => setSection(key)}>
            {icon}
            <span>{T.settings.sections[key]}</span>
          </button>
        ))}
      </nav>
      <section className="card card-pad stack settings-body" aria-label={T.settings.sections[section]}>
        <h3>{T.settings.sections[section]}</h3>
        {section === "appearance" ? (
          <AppearanceSection />
        ) : q.error ? (
          <ErrorBox error={q.error} onRetry={() => q.refetch()} />
        ) : !q.data ? (
          <SkeletonRows rows={3} />
        ) : section === "profile" ? (
          <ProfileSection profile={q.data} />
        ) : section === "security" ? (
          <SecuritySection profile={q.data} />
        ) : (
          <NotificationsSection profile={q.data} />
        )}
      </section>
    </div>
  );
}

function useProfileSave(onSaved: string) {
  const { refresh } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, string>) => api.patch<Profile>("/auth/profile/", body),
    onSuccess: () => {
      toast(onSaved);
      qc.invalidateQueries({ queryKey: ["profile"] });
      void refresh();
    },
    onError: (err) => {
      const msg = generalError(err);
      if (msg) toast(msg, "error");
    },
  });
}

function ProfileSection({ profile }: { profile: Profile }) {
  const me = useMe();
  const { refresh } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();
  const [first, setFirst] = useState(profile.first_name);
  const [last, setLast] = useState(profile.last_name);
  const [email, setEmail] = useState(profile.email || "");
  const [bio, setBio] = useState(profile.bio || "");
  const save = useProfileSave(T.settings.profileSaved);

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

  return (
    <form
      className="stack"
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate({ first_name: first, last_name: last, email, bio });
      }}
    >
      <div className="row" style={{ gap: 16 }}>
        <Avatar user={me} size="lg" card={false} />
        <div className="stack-sm" style={{ gap: 8 }}>
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
          <div className="row-wrap">
            <Button size="sm" icon={<ImagePlus />} loading={photoMut.isPending} onClick={() => photoInput.current?.click()}>
              {me.avatar ? T.profile.photoChange : T.profile.photoUpload}
            </Button>
            {me.avatar && (
              <Button size="sm" variant="ghost" icon={<Trash2 />} disabled={photoMut.isPending} onClick={() => photoMut.mutate(null)}>
                {T.profile.photoRemove}
              </Button>
            )}
          </div>
          <span className="small muted">{T.profile.photoHint}</span>
        </div>
      </div>
      <div className="grid-2">
        <Field label={T.profile.firstName} required error={fieldError(save.error, "first_name")}>
          {(id, bad) => <input id={id} className="input" aria-invalid={bad} value={first} onChange={(e) => setFirst(e.target.value)} />}
        </Field>
        <Field label={T.profile.lastName} required error={fieldError(save.error, "last_name")}>
          {(id, bad) => <input id={id} className="input" aria-invalid={bad} value={last} onChange={(e) => setLast(e.target.value)} />}
        </Field>
      </div>
      <Field label={T.settings.email} error={fieldError(save.error, "email")}>
        {(id, bad) => (
          <input id={id} className="input" type="email" autoComplete="email" aria-invalid={bad} placeholder={T.settings.emailPh} value={email} onChange={(e) => setEmail(e.target.value)} />
        )}
      </Field>
      <Field label={T.profile.bio} hint={T.profile.bioCount(bio.length, T.profile.bioMax)} error={fieldError(save.error, "bio")}>
        {(id, bad) => (
          <textarea id={id} className="input" rows={3} maxLength={T.profile.bioMax} aria-invalid={bad} placeholder={T.profile.bioPh} value={bio} onChange={(e) => setBio(e.target.value)} />
        )}
      </Field>
      <div className="form-actions">
        <Button type="submit" variant="primary" loading={save.isPending} disabled={!first.trim() || !last.trim()}>
          {T.common.save}
        </Button>
      </div>
    </form>
  );
}

function SecuritySection({ profile }: { profile: Profile }) {
  const toast = useToast();
  const [oldPass, setOldPass] = useState("");
  const [newPass, setNewPass] = useState("");
  const [repeat, setRepeat] = useState("");
  const mismatch = Boolean(repeat) && repeat !== newPass;

  const passMut = useMutation({
    mutationFn: () => api.post("/auth/password/", { current_password: oldPass, new_password: newPass }),
    onSuccess: () => {
      toast(T.profile.passwordChangedToast);
      setOldPass("");
      setNewPass("");
      setRepeat("");
    },
    onError: (err) => {
      const msg = generalError(err);
      if (msg) toast(msg, "error");
    },
  });

  return (
    <div className="stack">
      <dl className="kv">
        <div><dt>{T.profile.login}</dt><dd>{profile.username}</dd></div>
        <div><dt>{T.settings.lastLogin}</dt><dd>{profile.last_login ? fmtDateTime(profile.last_login) : "—"}</dd></div>
      </dl>
      <p className="small muted">{T.settings.securityNote}</p>
      <form
        className="stack"
        onSubmit={(e) => {
          e.preventDefault();
          if (oldPass && newPass && !mismatch) passMut.mutate();
        }}
      >
        <Field label={T.profile.currentPassword} error={fieldError(passMut.error, "current_password")}>
          {(id, bad) => (
            <input id={id} className="input" type="password" autoComplete="current-password" aria-invalid={bad} value={oldPass} onChange={(e) => setOldPass(e.target.value)} />
          )}
        </Field>
        <div className="grid-2">
          <Field label={T.profile.newPassword} hint={T.auth.passwordHint} error={fieldError(passMut.error, "new_password")}>
            {(id, bad) => (
              <input id={id} className="input" type="password" autoComplete="new-password" aria-invalid={bad} value={newPass} onChange={(e) => setNewPass(e.target.value)} />
            )}
          </Field>
          <Field label={T.settings.passwordRepeat} error={mismatch ? T.settings.passwordMismatch : undefined}>
            {(id, bad) => (
              <input id={id} className="input" type="password" autoComplete="new-password" aria-invalid={bad} value={repeat} onChange={(e) => setRepeat(e.target.value)} />
            )}
          </Field>
        </div>
        <div className="form-actions">
          <Button type="submit" variant="primary" loading={passMut.isPending} disabled={!oldPass || !newPass || !repeat || mismatch}>
            {T.profile.changePassword}
          </Button>
        </div>
      </form>
    </div>
  );
}

function NotificationsSection({ profile }: { profile: Profile }) {
  const bot = useMeta().telegram_bot;
  const [telegram, setTelegram] = useState(profile.telegram_username || "");
  const save = useProfileSave(T.settings.notificationsSaved);
  useEffect(() => setTelegram(profile.telegram_username || ""), [profile.telegram_username]);

  const hint = bot ? (
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
    <form
      className="stack"
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate({ telegram_username: telegram });
      }}
    >
      <p className="small muted">{T.settings.telegramIntro}</p>
      <div className="row-wrap">
        <b>{T.settings.telegramTitle}</b>
        <Badge tone={profile.telegram_connected ? "success" : "slate"}>
          {profile.telegram_connected ? T.settings.telegramConnected : T.settings.telegramNotConnected}
        </Badge>
      </div>
      <Field label={T.profile.telegram} hint={hint} error={fieldError(save.error, "telegram_username")}>
        {(id, bad) => (
          <input id={id} className="input" aria-invalid={bad} value={telegram} placeholder={T.profile.telegramPh} onChange={(e) => setTelegram(e.target.value)} />
        )}
      </Field>
      <div className="form-actions">
        <Button type="submit" variant="primary" loading={save.isPending}>
          {T.common.save}
        </Button>
      </div>
    </form>
  );
}

function AppearanceSection() {
  const [theme] = useTheme();
  const options: { value: Theme; label: string; icon: ReactNode }[] = [
    { value: "light", label: T.settings.themeLight, icon: <Sun /> },
    { value: "dark", label: T.settings.themeDark, icon: <Moon /> },
  ];
  return (
    <div className="stack">
      <div className="field-label" id="theme-label">{T.settings.themeTitle}</div>
      <div className="theme-options" role="radiogroup" aria-labelledby="theme-label">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={theme === option.value}
            className="theme-option"
            onClick={() => setTheme(option.value)}
          >
            {option.icon}
            <span>{option.label}</span>
          </button>
        ))}
      </div>
      <p className="small muted">{T.settings.themeHint}</p>
    </div>
  );
}

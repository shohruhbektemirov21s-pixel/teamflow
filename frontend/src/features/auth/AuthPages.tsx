import { useQuery } from "@tanstack/react-query";
import { Building2, CheckCircle2, ClipboardCheck, Code2, FolderKanban, KanbanSquare, Sparkles } from "lucide-react";
import { type FormEvent, type ReactNode, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { useAuth } from "@/app/auth";
import { api, ApiError } from "@/shared/api";
import { useMeta } from "@/shared/meta";
import { T } from "@/shared/text";
import { Button, Callout, Field } from "@/shared/ui";

function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="auth">
      <div className="auth-side">
        <div className="brand" style={{ padding: 0, color: "#fff" }}>
          <span className="brand-mark" style={{ background: "rgba(255,255,255,.2)" }}>
            <Sparkles />
          </span>
          {T.app}
        </div>
        <div>
          <h1 style={{ fontSize: 30, lineHeight: 1.2 }}>{T.auth.loginSubtitle}</h1>
          <ul>
            <li><FolderKanban /> {T.auth.roleHints.pm}</li>
            <li><KanbanSquare /> {T.auth.roleHints.developer}</li>
            <li><Building2 /> {T.auth.roleHints.department}</li>
          </ul>
        </div>
        <span style={{ opacity: 0.7 }}>© {new Date().getFullYear()} {T.app}</span>
      </div>
      <div className="auth-main">
        <div className="auth-card">{children}</div>
      </div>
    </div>
  );
}

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const me = await login(username.trim(), password);
      navigate(me.role === "department" ? "/buyurtmalar" : "/", { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err : new ApiError(0, T.common.errorGeneric));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell>
      <div>
        <h1 style={{ fontSize: 26 }}>{T.auth.loginTitle}</h1>
        <p className="muted" style={{ marginTop: 4 }}>{T.auth.loginSubtitle}</p>
      </div>
      {error && <Callout tone={error.code === "not_approved" ? "warning" : "danger"}>{error.message}</Callout>}
      <form className="stack" onSubmit={submit}>
        <Field label={T.auth.username} required>
          {(id) => <input id={id} className="input" autoComplete="username" autoFocus value={username} onChange={(e) => setUsername(e.target.value)} required />}
        </Field>
        <Field label={T.auth.password} required>
          {(id) => <input id={id} className="input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />}
        </Field>
        <Button type="submit" variant="primary" size="lg" loading={busy} className="btn-block">
          {T.auth.login}
        </Button>
      </form>
      <p className="muted" style={{ textAlign: "center" }}>
        {T.auth.noAccount} <Link to="/royxatdan-otish">{T.auth.register}</Link>
      </p>
    </AuthShell>
  );
}

// Rollar ro'yxati serverdan; bu yerda faqat ikonka tanlanadi
const ROLE_ICON: Record<string, typeof Code2> = { developer: Code2, pm: ClipboardCheck, department: Building2 };

export function RegisterPage() {
  const meta = useMeta();
  const specialties = useQuery({ queryKey: ["specialties"], queryFn: () => api.get<{ id: number; name: string }[]>("/specialties/") });
  const [form, setForm] = useState({ first_name: "", last_name: "", specialty: "", role: "developer", department_name: "", telegram_username: "", username: "", password: "" });
  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.post("/auth/register/", { ...form, specialty: form.specialty ? Number(form.specialty) : null });
      setDone(true);
    } catch (err) {
      setError(err instanceof ApiError ? err : new ApiError(0, T.common.errorGeneric));
    } finally {
      setBusy(false);
    }
  };

  if (done)
    return (
      <AuthShell>
        <div className="empty" style={{ padding: 0 }}>
          <div className="empty-icon" style={{ background: "var(--success-soft)", color: "var(--success)" }}>
            <CheckCircle2 />
          </div>
          <h1 style={{ fontSize: 24 }}>{T.auth.registered}</h1>
          <p>{T.auth.registeredText}</p>
          <Link to="/kirish" className="btn btn-primary btn-lg" style={{ marginTop: 12 }}>
            {T.auth.toLogin}
          </Link>
        </div>
      </AuthShell>
    );

  const fe = (k: string) => error?.field(k);
  return (
    <AuthShell>
      <div>
        <h1 style={{ fontSize: 26 }}>{T.auth.registerTitle}</h1>
        <p className="muted" style={{ marginTop: 4 }}>{T.auth.registerSubtitle}</p>
      </div>
      {error && !Object.keys(error.fields).length && <Callout tone="danger">{error.message}</Callout>}
      <form className="stack" onSubmit={submit} noValidate>
        <div className="grid-2">
          <Field label={T.auth.firstName} required error={fe("first_name")}>
            {(id, bad) => <input id={id} className="input" aria-invalid={bad} value={form.first_name} onChange={set("first_name")} autoComplete="given-name" />}
          </Field>
          <Field label={T.auth.lastName} required error={fe("last_name")}>
            {(id, bad) => <input id={id} className="input" aria-invalid={bad} value={form.last_name} onChange={set("last_name")} autoComplete="family-name" />}
          </Field>
        </div>
        <Field label={T.auth.specialty} required error={fe("specialty")}>
          {(id, bad) => (
            <select id={id} className="select" aria-invalid={bad} value={form.specialty} onChange={set("specialty")}>
              <option value="">{T.auth.specialtyPick}</option>
              {specialties.data?.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          )}
        </Field>
        <div className="field">
          <span className="field-label">{T.auth.role} <span className="req">*</span></span>
          <div className="role-cards" role="group" aria-label={T.auth.role}>
            {meta.register_roles.map((r) => {
              const Icon = ROLE_ICON[r.value] ?? Code2;
              return (
                <button type="button" key={r.value} className="role-card" aria-pressed={form.role === r.value} onClick={() => setForm((f) => ({ ...f, role: r.value }))}>
                  <Icon />
                  <b>{r.label}</b>
                  <span>{T.auth.roleHints[r.value]}</span>
                </button>
              );
            })}
          </div>
        </div>
        {form.role === "department" && (
          <Field label={T.auth.departmentName} required hint={T.auth.departmentHint} error={fe("department_name")}>
            {(id, bad) => <input id={id} className="input" aria-invalid={bad} value={form.department_name} onChange={set("department_name")} autoFocus />}
          </Field>
        )}
        <Field label={T.auth.telegram} hint={T.auth.telegramHint} error={fe("telegram_username")}>
          {(id, bad) => <input id={id} className="input" aria-invalid={bad} value={form.telegram_username} onChange={set("telegram_username")} placeholder={T.auth.telegramPh} />}
        </Field>
        <Field label={T.auth.username} required error={fe("username")}>
          {(id, bad) => <input id={id} className="input" aria-invalid={bad} value={form.username} onChange={set("username")} autoComplete="username" />}
        </Field>
        <Field label={T.auth.password} required hint={T.auth.passwordHint} error={fe("password")}>
          {(id, bad) => <input id={id} type="password" className="input" aria-invalid={bad} value={form.password} onChange={set("password")} autoComplete="new-password" />}
        </Field>
        <Button type="submit" variant="primary" size="lg" loading={busy} className="btn-block">
          {T.auth.register}
        </Button>
      </form>
      <p className="muted" style={{ textAlign: "center" }}>
        {T.auth.haveAccount} <Link to="/kirish">{T.auth.login}</Link>
      </p>
    </AuthShell>
  );
}

import { useQuery } from "@tanstack/react-query";
import { UserPlus } from "lucide-react";
import { useState } from "react";

import { useMe } from "@/app/auth";
import { api } from "@/shared/api";
import { useMeta } from "@/shared/meta";
import { T } from "@/shared/text";
import { Button, ErrorBox, Modal } from "@/shared/ui";

interface Props {
  onClose: () => void;
  onSuccess: () => void;
}

export default function NewEmployeeModal({ onClose, onSuccess }: Props) {
  const me = useMe();
  const meta = useMeta();
  const isBoss = me.role === "boss";

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState(isBoss ? "developer" : "developer");
  const [specialtyId, setSpecialtyId] = useState<string>("");
  const [departmentName, setDepartmentName] = useState("");
  const [telegram, setTelegram] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const specialtiesQuery = useQuery({
    queryKey: ["specialties"],
    queryFn: () => api.get<{ id: number; name: string }[]>("/specialties/"),
  });

  const dirty = Boolean(firstName || lastName || username || password);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim() || !username.trim() || !password) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await api.post("/people/create/", {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        username: username.trim().toLowerCase(),
        password,
        role,
        specialty_id: specialtyId ? Number(specialtyId) : null,
        department_name: departmentName.trim(),
        telegram_username: telegram.trim(),
      });
      onSuccess();
      onClose();
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal title="Yangi xodim qo'shish" onClose={onClose} dirty={dirty}>
      <form onSubmit={handleSubmit} className="stack">
        {error ? <ErrorBox error={error} /> : null}
        <div className="grid-2">
          <div className="field">
            <label className="field-label">Ism <span className="req">*</span></label>
            <input
              type="text"
              required
              className="input"
              placeholder="Ism"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
            />
          </div>
          <div className="field">
            <label className="field-label">Familiya <span className="req">*</span></label>
            <input
              type="text"
              required
              className="input"
              placeholder="Familiya"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
            />
          </div>
        </div>

        <div className="grid-2">
          <div className="field">
            <label className="field-label">Login (username) <span className="req">*</span></label>
            <input
              type="text"
              required
              autoCapitalize="none"
              className="input"
              placeholder="masalan: aziz_dev"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>
          <div className="field">
            <label className="field-label">Parol <span className="req">*</span></label>
            <input
              type="password"
              required
              minLength={6}
              className="input"
              placeholder="Kamida 6 belgi"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
        </div>

        <div className="grid-2">
          {isBoss && (
            <div className="field">
              <label className="field-label">Rol</label>
              <select className="select" value={role} onChange={(e) => setRole(e.target.value)}>
                {meta.roles
                  .filter((r) => r.value !== "boss")
                  .map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
              </select>
            </div>
          )}

          <div className="field">
            <label className="field-label">Lavozim / Mutaxassislik</label>
            <select
              className="select"
              value={specialtyId}
              onChange={(e) => setSpecialtyId(e.target.value)}
            >
              <option value="">Tanlanmagan</option>
              {specialtiesQuery.data?.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label className="field-label">Bo'lim yoki jamoa</label>
            <input
              type="text"
              className="input"
              placeholder="Masalan: Frontend jamoasi"
              value={departmentName}
              onChange={(e) => setDepartmentName(e.target.value)}
            />
          </div>

          <div className="field">
            <label className="field-label">Telegram username</label>
            <input
              type="text"
              className="input"
              placeholder="@username"
              value={telegram}
              onChange={(e) => setTelegram(e.target.value)}
            />
          </div>
        </div>

        <div className="modal-actions" style={{ marginTop: 12, justifyContent: "flex-end" }}>
          <Button variant="ghost" type="button" onClick={onClose} disabled={loading}>
            {T.common.cancel}
          </Button>
          <Button
            variant="primary"
            type="submit"
            icon={<UserPlus size={16} />}
            loading={loading}
          >
            Qo'shish
          </Button>
        </div>
      </form>
    </Modal>
  );
}

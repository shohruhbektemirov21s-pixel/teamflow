import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { useMe } from "@/app/auth";
import { api } from "@/shared/api";
import { fmtDate } from "@/shared/format";
import { T } from "@/shared/text";
import { Avatar, Button, SkeletonRows, useToast } from "@/shared/ui";

export default function ProfilePage() {
  const me = useMe();
  const toast = useToast();
  const qc = useQueryClient();

  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [oldPass, setOldPass] = useState("");
  const [newPass, setNewPass] = useState("");

  const q = useQuery({
    queryKey: ["profile"],
    queryFn: () => api.get<any>("/auth/profile/"),
  });

  const p = q.data;

  useEffect(() => {
    if (p) {
      setFirst(p.first_name);
      setLast(p.last_name);
    }
  }, [p]);

  const infoMut = useMutation({
    mutationFn: () => api.patch("/auth/profile/", { first_name: first, last_name: last }),
    onSuccess: () => {
      toast("Saqlandi", "ok");
      qc.invalidateQueries({ queryKey: ["profile"] });
      api.get("/auth/me/").then(() => {
        // Force auth context update
      });
    },
  });

  const passMut = useMutation({
    mutationFn: () => api.post("/auth/password/", { current_password: oldPass, new_password: newPass }),
    onSuccess: () => {
      toast(T.profile.passwordChangedToast, "ok");
      setOldPass("");
      setNewPass("");
    },
    onError: (err: any) => {
      toast(err.detail || err.field("current_password") || err.field("new_password") || T.common.errorGeneric, "error");
    }
  });

  return (
    <div className="stack" style={{ maxWidth: 800, margin: "0 auto", padding: 20 }}>
      <h1>{T.profile.title}</h1>

      <div className="card card-pad">
        <div className="row mb-4">
          <Avatar user={{id: me.id, full_name: me.full_name}} size="lg" />
          <div>
            <h2 style={{margin:0}}>{me.full_name}</h2>
            <div className="small muted">{me.department_name || me.specialty || me.role_label}</div>
          </div>
        </div>

        <h3 className="mb-4">{T.profile.editInfoTitle}</h3>
        {q.isLoading ? (
          <SkeletonRows rows={2} />
        ) : (
          <div className="grid-2">
            <div className="field">
              <label className="label">{T.profile.firstName}</label>
              <input className="input" value={first} onChange={(e: any) => setFirst(e.target.value)} />
            </div>
            <div className="field">
              <label className="label">{T.profile.lastName}</label>
              <input className="input" value={last} onChange={(e: any) => setLast(e.target.value)} />
            </div>
            <div className="field">
              <label className="label">Login</label>
              <input className="input" value={me.username} disabled />
            </div>
            <div className="field">
              <label className="label">{T.profile.dateJoined}</label>
              <input className="input" value={p?.date_joined ? fmtDate(p.date_joined) : ""} disabled />
            </div>
            
            {p?.stats && (
              <div style={{ gridColumn: "1 / -1" }} className="row mt-2">
                <span className="badge tone-info">{p.stats.active} faol</span>
                <span className="badge tone-danger">{p.stats.overdue} kechikkan</span>
                <span className="badge tone-violet">{p.stats.in_review} tekshiruvda</span>
                <span className="badge tone-success">{p.stats.done} bajarilgan</span>
              </div>
            )}

            <div style={{ gridColumn: "1 / -1", textAlign: "right", marginTop: 10 }}>
              <Button variant="primary" loading={infoMut.isPending} onClick={() => infoMut.mutate()}>
                {T.common.save}
              </Button>
            </div>
          </div>
        )}
      </div>

      <div className="card card-pad mt-4">
        <h3 className="mb-4">{T.profile.passwordTitle}</h3>
        <div className="grid-2">
          <div className="field">
            <label className="label">{T.profile.currentPassword}</label>
            <input className="input" type="password" value={oldPass} onChange={(e: any) => setOldPass(e.target.value)} />
          </div>
          <div className="field">
            <label className="label">{T.profile.newPassword}</label>
            <input className="input" type="password" value={newPass} onChange={(e: any) => setNewPass(e.target.value)} />
          </div>
          <div style={{ gridColumn: "1 / -1", textAlign: "right" }}>
            <Button variant="primary" loading={passMut.isPending} disabled={!oldPass || !newPass} onClick={() => passMut.mutate()}>
              {T.profile.changePassword}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

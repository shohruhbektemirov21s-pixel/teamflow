import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Save } from "lucide-react";
import { useState } from "react";

import { api, ApiError } from "@/shared/api";
import { T } from "@/shared/text";
import type { Person } from "@/shared/types";
import { Button, ErrorBox, Field, useToast } from "@/shared/ui";

export function PersonResponsibilities({ person, editable, onDirtyChange }: { person: Person; editable: boolean; onDirtyChange: (dirty: boolean) => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [draft, setDraft] = useState<string | null>(null);
  const saved = person.responsibilities ?? "";
  const save = useMutation({
    mutationFn: (text: string) => api.patch<{ id: number; responsibilities: string }>(`/people/${person.id}/responsibilities/`, { responsibilities: text }),
    onSuccess: (data) => {
      qc.setQueryData<Person>(["person", person.id], (current) => current ? { ...current, responsibilities: data.responsibilities } : current);
      void qc.invalidateQueries({ queryKey: ["people"] });
      setDraft(null);
      onDirtyChange(false);
      toast(T.people.responsibilitiesSaved);
    },
  });
  const fieldError = save.error instanceof ApiError ? save.error.field("responsibilities") : undefined;
  return <section className="card card-pad stack-sm" aria-label={T.people.responsibilities}>
    <div className="row-wrap" style={{ justifyContent: "space-between" }}>
      <h3 className="person-section-title">{T.people.responsibilities}</h3>
      {editable && draft === null && <Button size="sm" variant="ghost" icon={saved ? <Pencil size={15} /> : <Plus size={15} />} onClick={() => { save.reset(); setDraft(saved); }}>{saved ? T.people.responsibilitiesEdit : T.people.responsibilitiesAdd}</Button>}
    </div>
    {draft === null ? <p className={`person-responsibilities-text ${saved ? "" : "muted small"}`}>{saved || T.people.responsibilitiesEmpty}</p> : <form className="stack-sm" onSubmit={(event) => { event.preventDefault(); onDirtyChange(true); save.mutate(draft); }}>
      <Field label={T.people.responsibilities} hint={T.people.responsibilitiesHint} error={fieldError}>
        {(id) => <textarea id={id} className="textarea" rows={5} maxLength={2000} autoFocus value={draft} disabled={save.isPending} placeholder={T.people.responsibilitiesPlaceholder} onChange={(event) => { setDraft(event.target.value); onDirtyChange(event.target.value !== saved); save.reset(); }} />}
      </Field>
      <div className="small muted" aria-live="polite">{draft.length}/2000</div>
      {save.error && !fieldError && <ErrorBox error={save.error} />}
      <div className="row-wrap" style={{ justifyContent: "flex-end" }}>
        <Button disabled={save.isPending} onClick={() => { setDraft(null); onDirtyChange(false); save.reset(); }}>{T.common.cancel}</Button>
        <Button type="submit" variant="primary" icon={<Save size={15} />} loading={save.isPending} disabled={draft === saved}>{T.common.save}</Button>
      </div>
    </form>}
  </section>;
}

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Send } from "lucide-react";
import { useState } from "react";

import { useModal } from "@/app/modals";
import { api, ApiError } from "@/shared/api";
import { T } from "@/shared/text";
import { Button, ErrorBox, Field, Modal, useToast } from "@/shared/ui";

export default function SuggestionCreateModal() {
  const { close } = useModal();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const toast = useToast();
  const qc = useQueryClient();

  const m = useMutation({
    mutationFn: () => api.post("/suggestions/", { title, body, is_anonymous: isAnonymous }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["suggestions"] });
      toast(T.suggestions.sentToast);
      close();
    },
  });
  const fe = (name: string) => (m.error instanceof ApiError ? m.error.field(name) : undefined);
  const ready = Boolean(title.trim() && body.trim());

  return (
    <Modal
      title={T.suggestions.new}
      onClose={close}
      dirty={Boolean(title || body)}
      footer={
        <>
          <div className="spacer" />
          <Button variant="ghost" onClick={close}>
            {T.common.cancel}
          </Button>
          <Button type="submit" form="suggestion-form" variant="primary" icon={<Send />} loading={m.isPending} disabled={!ready}>
            {T.suggestions.send}
          </Button>
        </>
      }
    >
      <form
        id="suggestion-form"
        className="stack"
        onSubmit={(e) => {
          e.preventDefault();
          if (ready) m.mutate();
        }}
      >
        {m.error && !(m.error instanceof ApiError && Object.keys(m.error.fields).length) && <ErrorBox error={m.error} />}
        <Field label={T.suggestions.name} required error={fe("title")}>
          {(id, bad) => (
            <input id={id} className="input" autoFocus aria-invalid={bad} value={title} placeholder={T.suggestions.namePh} onChange={(e) => setTitle(e.target.value)} />
          )}
        </Field>
        <Field label={T.suggestions.body} required error={fe("body")}>
          {(id, bad) => (
            <textarea id={id} className="textarea" rows={5} aria-invalid={bad} value={body} placeholder={T.suggestions.bodyPh} onChange={(e) => setBody(e.target.value)} />
          )}
        </Field>
        <label className="check">
          <input type="checkbox" checked={isAnonymous} onChange={(e) => setIsAnonymous(e.target.checked)} />
          {T.suggestions.anonymous}
        </label>
      </form>
    </Modal>
  );
}

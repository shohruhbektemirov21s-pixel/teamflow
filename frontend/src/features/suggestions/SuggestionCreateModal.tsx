import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { useModal } from "@/app/modals";
import { api } from "@/shared/api";
import { T } from "@/shared/text";
import { Button, Modal, useToast } from "@/shared/ui";

export default function SuggestionCreateModal() {
  const { close } = useModal();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const toast = useToast();
  const qc = useQueryClient();

  const m = useMutation({
    mutationFn: async () => {
      await api.post("/api/suggestions/", { title, body, is_anonymous: isAnonymous });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["suggestions"] });
      toast(T.suggestions.sentToast, "ok");
      close();
    },
  });

  return (
    <Modal title={T.suggestions.new} onClose={close}>
      <div className="stack">
        <div className="field">
          <label>{T.suggestions.name}</label>
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={T.suggestions.namePh}
            className="input"
          />
        </div>
        <div className="field">
          <label>{T.suggestions.body}</label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={T.suggestions.bodyPh}
            className="input"
            rows={5}
          />
        </div>
        <label className="row">
          <input
            type="checkbox"
            checked={isAnonymous}
            onChange={(e) => setIsAnonymous(e.target.checked)}
          />
          {T.suggestions.anonymous}
        </label>
        <div className="row end mt-2">
          <Button variant="ghost" onClick={close}>
            {T.common.cancel}
          </Button>
          <Button variant="primary" onClick={() => m.mutate()} disabled={!title.trim() || !body.trim() || m.isPending}>
            {m.isPending ? T.common.loading : T.common.save}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

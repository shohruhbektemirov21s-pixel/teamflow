import { useMutation } from "@tanstack/react-query";
import { Send } from "lucide-react";
import { useState } from "react";

import { useModal } from "@/app/modals";
import { useRefresh } from "@/app/queries";
import { api, ApiError, formData } from "@/shared/api";
import { isoDate } from "@/shared/format";
import { useMeta } from "@/shared/meta";
import { T } from "@/shared/text";
import type { OrderDetail, Priority } from "@/shared/types";
import { Button, Callout, Field, FilePicker, Modal, Segmented, useToast } from "@/shared/ui";

/** Modal: buyurtma yaratish (Boshqarma). Yuborilgach tahrirlab/o'chirib bo'lmaydi. */
export default function OrderCreateModal() {
  const { close, open } = useModal();
  const toast = useToast();
  const refresh = useRefresh();
  const meta = useMeta();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<Priority>("medium");
  const [due, setDue] = useState("");
  const [file, setFile] = useState<File[]>([]);
  const [error, setError] = useState<ApiError | null>(null);

  const send = useMutation({
    mutationFn: () =>
      api.post<OrderDetail>("/orders/", formData({ title, description, priority, requested_due_date: due }, file, "file")),
    onSuccess: (o) => {
      toast(T.orders.sentToast);
      refresh();
      open({ order: o.id }, true);
    },
    onError: (e: Error) => setError(e instanceof ApiError ? e : new ApiError(0, e.message)),
  });

  const fe = (k: string) => error?.field(k);
  const ready = title.trim() && due && file.length === 1;
  const dirty = Boolean(title || description || due || file.length);

  return (
    <Modal
      title={T.orders.new}
      onClose={close}
      dirty={dirty}
      footer={
        <>
          <span className="spacer" />
          <Button variant="ghost" onClick={close}>
            {T.common.cancel}
          </Button>
          <Button variant="primary" icon={<Send />} loading={send.isPending} disabled={!ready} onClick={() => send.mutate()}>
            {T.orders.send}
          </Button>
        </>
      }
    >
      <form className="stack" style={{ gap: 16 }} onSubmit={(e) => (e.preventDefault(), ready && send.mutate())}>
        {error && !Object.keys(error.fields).length && <Callout tone="danger">{error.message}</Callout>}
        <Field label={T.orders.name} required error={fe("title")}>
          {(id, bad) => <input id={id} className="input" aria-invalid={bad} placeholder={T.orders.namePh} value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />}
        </Field>
        <Field label={T.orders.description} error={fe("description")}>
          {(id) => <textarea id={id} className="textarea" placeholder={T.orders.descriptionPh} value={description} onChange={(e) => setDescription(e.target.value)} />}
        </Field>
        <div className="grid-2">
          <Field label={T.orders.dueDate} required error={fe("requested_due_date")}>
            {(id, bad) => <input id={id} type="date" className="input" aria-invalid={bad} min={isoDate(new Date())} value={due} onChange={(e) => setDue(e.target.value)} />}
          </Field>
          <div className="field">
            <span className="field-label">{T.orders.priority}</span>
            <Segmented<Priority> value={priority} onChange={setPriority} options={meta.options<Priority>("priorities")} />
          </div>
        </div>
        <div className="field">
          <span className="field-label">
            {T.orders.tzFile} <span className="req">*</span>
          </span>
          <FilePicker files={file} onChange={setFile} multiple={false} accept=".docx,.pdf" label={T.orders.tzFile} hint={T.orders.tzHint} invalid={Boolean(fe("file"))} />
          {fe("file") && <span className="field-error">{fe("file")}</span>}
        </div>
      </form>
    </Modal>
  );
}

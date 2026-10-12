import { useMutation } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { useState } from "react";

import { api, ApiError, formData } from "../api";
import { T } from "../text";
import { Button, Field, useToast } from "./index";

/**
 * Muqova rasmi (loyiha va portfolio loyihasi): tanlansa darrov yuklanadi, "olib tashlash" — o'chiradi.
 * `path` — rasm manzili (masalan `/projects/3/cover/`); `onChanged` — yuklangach ro'yxatlarni yangilash.
 */
export function CoverEditor({ path, cover, onChanged }: { path: string; cover: string | null; onChanged: () => void }) {
  const toast = useToast();
  const [error, setError] = useState<string | null>(null);
  const done = () => {
    setError(null);
    onChanged();
  };
  const upload = useMutation({
    mutationFn: (file: File) => api.post(path, formData({}, [file], "cover")),
    onSuccess: () => {
      toast(T.cover.savedToast);
      done();
    },
    onError: (err) => setError(err instanceof ApiError ? err.field("cover") || err.message : T.common.errorGeneric),
  });
  const remove = useMutation({
    mutationFn: () => api.del(path),
    onSuccess: done,
    onError: (err) => setError(err.message),
  });
  return (
    <Field label={T.cover.label} hint={T.cover.hint} error={error ?? undefined}>
      {(id) => (
        <div className="row-wrap" style={{ gap: 12 }}>
          {cover && <img className="cover-preview" src={cover} alt="" />}
          <label className="btn" htmlFor={id}>
            {cover ? T.cover.change : T.cover.pick}
            <input id={id} type="file" accept="image/jpeg,image/png,image/webp" hidden disabled={upload.isPending}
              onChange={(e) => { const file = e.target.files?.[0]; e.target.value = ""; if (file) upload.mutate(file); }} />
          </label>
          {cover && (
            <Button variant="ghost" size="sm" icon={<Trash2 size={15} />} loading={remove.isPending} onClick={() => remove.mutate()}>
              {T.cover.remove}
            </Button>
          )}
        </div>
      )}
    </Field>
  );
}

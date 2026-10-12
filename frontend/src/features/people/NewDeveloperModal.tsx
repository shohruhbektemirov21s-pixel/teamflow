import { useMutation, useQuery } from "@tanstack/react-query";
import { ImagePlus, UserPlus } from "lucide-react";
import { useEffect, useState } from "react";

import { useModal } from "@/app/modals";
import { useRefresh } from "@/app/queries";
import { api, ApiError, formData } from "@/shared/api";
import { splitTechnologies } from "@/shared/format";
import { T } from "@/shared/text";
import { Button, Callout, Field, Modal, useToast } from "@/shared/ui";

const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];
const PHOTO_MAX = 5 * 1024 * 1024;

/** Modal: Boshliq yangi dasturchi qo'shadi. Hisob nofaol yaratiladi — Django adminda tasdiqlanadi. */
export default function NewDeveloperModal() {
  const { close } = useModal();
  const toast = useToast();
  const refresh = useRefresh();
  const N = T.people.newDeveloper;
  const specialties = useQuery({ queryKey: ["specialties"], queryFn: () => api.get<{ id: number; name: string }[]>("/specialties/") });
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [bio, setBio] = useState("");
  const [technologies, setTechnologies] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoError, setPhotoError] = useState("");
  const [preview, setPreview] = useState("");
  const [error, setError] = useState<ApiError | null>(null);

  useEffect(() => {
    if (!photo) {
      setPreview("");
      return;
    }
    const url = URL.createObjectURL(photo);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);

  const pick = (file: File | undefined) => {
    if (!file) return;
    if (!PHOTO_TYPES.includes(file.type)) return setPhotoError(N.photoType);
    if (file.size > PHOTO_MAX) return setPhotoError(N.photoTooBig);
    setPhotoError("");
    setPhoto(file);
  };

  const send = useMutation({
    mutationFn: () =>
      api.post("/people/new-developer/", formData(
        { first_name: firstName.trim(), last_name: lastName.trim(), specialty, bio: bio.trim(), technologies: splitTechnologies(technologies), username: username.trim(), password },
        photo ? [photo] : [], "avatar",
      )),
    onSuccess: () => { toast(N.done); refresh(); close(); },
    onError: (e: Error) => setError(e instanceof ApiError ? e : new ApiError(0, e.message)),
  });

  const fe = (k: string) => error?.field(k);
  const ready = firstName.trim() && lastName.trim() && specialty && username.trim() && password;
  const dirty = Boolean(firstName || lastName || specialty || bio || technologies || username || password || photo);

  return (
    <Modal
      title={N.title}
      onClose={close}
      dirty={dirty}
      footer={<>
        <span className="spacer" />
        <Button variant="ghost" onClick={close}>{T.common.cancel}</Button>
        <Button variant="primary" icon={<UserPlus />} loading={send.isPending} disabled={!ready} onClick={() => send.mutate()}>{N.submit}</Button>
      </>}
    >
      <form className="stack" style={{ gap: 16 }} onSubmit={(e) => (e.preventDefault(), ready && send.mutate())}>
        <p className="small muted">{N.intro}</p>
        {error && !Object.keys(error.fields).length && <Callout tone="danger">{error.message}</Callout>}
        <div className="field">
          <span className="field-label">{N.photo}</span>
          <div className="row" style={{ gap: 12, alignItems: "center" }}>
            {preview && <img src={preview} alt="" width={64} height={64} style={{ borderRadius: "50%", objectFit: "cover" }} />}
            <label className="btn btn-ghost">
              <ImagePlus size={16} />{photo ? N.photoChange : N.photoPick}
              <input type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => pick(e.target.files?.[0])} />
            </label>
          </div>
          <span className="small muted">{N.photoHint}</span>
          {(photoError || fe("avatar")) && <span className="field-error" role="alert">{photoError || fe("avatar")}</span>}
        </div>
        <div className="grid-2">
          <Field label={N.firstName} required error={fe("first_name")}>
            {(id, bad) => <input id={id} className="input" aria-invalid={bad} value={firstName} onChange={(e) => setFirstName(e.target.value)} autoFocus />}
          </Field>
          <Field label={N.lastName} required error={fe("last_name")}>
            {(id, bad) => <input id={id} className="input" aria-invalid={bad} value={lastName} onChange={(e) => setLastName(e.target.value)} />}
          </Field>
        </div>
        <Field label={N.specialty} required error={fe("specialty")}>
          {(id, bad) => (
            <select id={id} className="select" aria-invalid={bad} value={specialty} onChange={(e) => setSpecialty(e.target.value)}>
              <option value="">{N.specialtyPick}</option>
              {specialties.data?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          )}
        </Field>
        <Field label={N.bio} error={fe("bio")}>
          {(id, bad) => <textarea id={id} className="textarea" aria-invalid={bad} maxLength={300} placeholder={N.bioPh} value={bio} onChange={(e) => setBio(e.target.value)} />}
        </Field>
        <Field label={T.techField.label} hint={T.techField.hint} error={fe("technologies")}>
          {(id, bad) => <input id={id} className="input" aria-invalid={bad} placeholder={T.techField.placeholder} value={technologies} onChange={(e) => setTechnologies(e.target.value)} />}
        </Field>
        <div className="grid-2">
          <Field label={N.username} required error={fe("username")}>
            {(id, bad) => <input id={id} className="input" aria-invalid={bad} autoComplete="off" value={username} onChange={(e) => setUsername(e.target.value)} />}
          </Field>
          <Field label={N.password} required error={fe("password")}>
            {(id, bad) => <input id={id} type="password" className="input" aria-invalid={bad} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />}
          </Field>
        </div>
      </form>
    </Modal>
  );
}

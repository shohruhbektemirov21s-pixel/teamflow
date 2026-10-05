import { Search, UserPlus, X } from "lucide-react";
import { useId, useState } from "react";

import { useDevelopers } from "@/app/queries";
import { T } from "@/shared/text";
import { Avatar, Skeleton } from "@/shared/ui";

export interface PickerPerson {
  id: number;
  full_name: string;
  specialty?: string;
  is_on_business_trip?: boolean;
}

/**
 * Bir nechta dasturchini tanlash: tanlanganlar chip ko'rinishida (✕ bilan), pastda qidiruv.
 * `options` berilmasa — barcha faol dasturchilar (`/developers/`). `known` — ro'yxatda bo'lmasa ham nomi ma'lum odamlar.
 * `locked` — olib tashlab bo'lmaydiganlar (masalan, dasturchining o'zi).
 */
export function DeveloperPicker({
  value,
  onChange,
  options,
  known = [],
  locked = [],
  label,
}: {
  value: number[];
  onChange: (ids: number[]) => void;
  options?: PickerPerson[];
  known?: PickerPerson[];
  locked?: number[];
  label: string;
}) {
  const all = useDevelopers(!options);
  const list = options ?? all.data ?? [];
  const [q, setQ] = useState("");
  const listId = useId();

  const byId = new Map([...known, ...list].map((p) => [p.id, p]));
  const needle = q.trim().toLowerCase();
  const candidates = needle
    ? list.filter((p) => !value.includes(p.id) && `${p.full_name} ${p.specialty ?? ""}`.toLowerCase().includes(needle)).slice(0, 6)
    : [];

  return (
    <div className="stack-sm" role="group" aria-label={label}>
      {value.length > 0 && (
        <div className="chips">
          {value.map((id) => {
            const person = byId.get(id) ?? { id, full_name: `#${id}` };
            return (
              <span key={id} className="chip person-chip">
                <Avatar user={person} size="sm" />
                {person.full_name}
                {!locked.includes(id) && (
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label={T.tasks.picker.remove(person.full_name)}
                    onClick={() => onChange(value.filter((x) => x !== id))}
                  >
                    <X size={14} />
                  </button>
                )}
              </span>
            );
          })}
        </div>
      )}
      <div className="search-field">
        <Search />
        <input
          className="input"
          placeholder={T.tasks.picker.searchPh}
          aria-label={`${label}: ${T.tasks.picker.searchPh}`}
          aria-controls={listId}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            // Enter tashqi formani yubormaydi — birinchi mos dasturchi qo'shiladi
            if (e.key !== "Enter") return;
            e.preventDefault();
            const first = candidates.find((p) => !p.is_on_business_trip);
            if (first) {
              onChange([...value, first.id]);
              setQ("");
            }
          }}
        />
      </div>
      {needle && (
        <div className="pick-list" id={listId}>
          {!options && all.isLoading && <Skeleton h={40} />}
          {candidates.map((p) => (
            <button
              key={p.id}
              type="button"
              disabled={p.is_on_business_trip}
              title={p.is_on_business_trip ? T.people.tripBlocked : undefined}
              className="pick"
              style={{ background: "var(--surface)", textAlign: "left", font: "inherit", color: "inherit" }}
              onClick={() => {
                onChange([...value, p.id]);
                setQ("");
              }}
            >
              <Avatar user={p} size="sm" />
              <span className="grow">
                <b style={{ fontWeight: 600 }}>{p.full_name}</b>
                {p.specialty && <span className="small muted"> · {p.specialty}</span>}
                {p.is_on_business_trip && <span className="small muted"> · {T.people.onBusinessTrip}</span>}
              </span>
              <span className="row small" style={{ gap: 4, color: "var(--primary)" }}>
                {!p.is_on_business_trip && <><UserPlus size={16} /> {T.tasks.picker.add}</>}
              </span>
            </button>
          ))}
          {!(all.isLoading && !options) && !candidates.length && <p className="small muted">{T.tasks.picker.noMatch}</p>}
        </div>
      )}
    </div>
  );
}

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { api, ApiError } from "@/shared/api";
import { fmtDate } from "@/shared/format";
import { T } from "@/shared/text";
import type { Person } from "@/shared/types";
import { Badge, Button, ErrorBox, Field, SkeletonRows, useToast } from "@/shared/ui";

const tomorrow = () => {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

export function BusinessTripPanel() {
  const qc = useQueryClient();
  const toast = useToast();
  const [employeeId, setEmployeeId] = useState("");
  const [returnDate, setReturnDate] = useState("");
  const people = useQuery({ queryKey: ["people", ""], queryFn: () => api.get<Person[]>("/people/") });
  const employees = (people.data ?? []).filter((person) => person.role === "developer" || person.role === "pm");
  const selected = employees.find((person) => person.id === Number(employeeId));
  const refresh = () => void qc.invalidateQueries();
  const setTrip = useMutation({
    mutationFn: () => api.put(`/people/${employeeId}/business-trip/`, { return_date: returnDate }),
    onSuccess: () => { toast(T.profile.tripSaved); refresh(); },
  });
  const endTrip = useMutation({
    mutationFn: () => api.del(`/people/${employeeId}/business-trip/`),
    onSuccess: () => { toast(T.profile.tripEnded); setReturnDate(""); refresh(); },
  });
  const error = setTrip.error ?? endTrip.error;

  return (
    <section className="card card-pad stack" aria-label={T.profile.businessTrips}>
      <h3>{T.profile.businessTrips}</h3>
      <p className="small muted">{T.profile.businessTripHint}</p>
      {people.isLoading ? <SkeletonRows rows={2} /> : people.error ? <ErrorBox error={people.error} onRetry={() => people.refetch()} /> : (
        <>
          <div className="grid-2">
            <Field label={T.profile.tripEmployee}>
              {(id) => <select id={id} className="select" value={employeeId} onChange={(event) => { setEmployeeId(event.target.value); setReturnDate(""); }}>
                <option value="">{T.profile.tripEmployee}</option>
                {employees.map((person) => <option key={person.id} value={person.id}>{person.full_name} ({person.role_label})</option>)}
              </select>}
            </Field>
            <Field label={T.profile.tripReturnDate} error={error instanceof ApiError ? error.field("return_date") : undefined}>
              {(id, bad) => <input id={id} type="date" className="input" min={tomorrow()} value={returnDate} aria-invalid={bad} onChange={(event) => setReturnDate(event.target.value)} />}
            </Field>
          </div>
          {selected?.is_on_business_trip && <div className="row-wrap"><Badge tone="warning">{T.people.onBusinessTrip}</Badge><span className="small muted">{T.people.tripUntil(fmtDate(selected.business_trip_return_date!))}</span></div>}
          {error && !(error instanceof ApiError && error.field("return_date")) && <ErrorBox error={error} />}
          <div className="row-wrap">
            <Button variant="primary" disabled={!employeeId || !returnDate || returnDate < tomorrow()} loading={setTrip.isPending} onClick={() => setTrip.mutate()}>{T.profile.tripSet}</Button>
            {selected?.is_on_business_trip && <Button variant="ghost" loading={endTrip.isPending} onClick={() => endTrip.mutate()}>{T.profile.tripEnd}</Button>}
          </div>
        </>
      )}
    </section>
  );
}

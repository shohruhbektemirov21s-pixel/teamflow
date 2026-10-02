import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Plus, X } from "lucide-react";
import { useState } from "react";
import { useSearchParams } from "react-router-dom";

import { isManager, useMe } from "@/app/auth";
import { useModal } from "@/app/modals";
import { api, qs } from "@/shared/api";
import { useDebounced } from "@/shared/hooks";
import { T } from "@/shared/text";
import type { Paged, Task } from "@/shared/types";
import { Button, ErrorBox } from "@/shared/ui";
import { Pagination } from "@/shared/ui/Pagination";

import { EMPTY_FILTERS, filterParams, TaskFilters, type TaskFilterState, TaskTable } from "./TaskTable";

export default function TasksPage() {
  const me = useMe();
  const { open } = useModal();
  const [params, setParams] = useSearchParams();
  const [filters, setFilters] = useState<TaskFilterState>(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const debounced = useDebounced(filters);
  const assignee = params.get("assignee");
  const assigneeLabel = params.get("assignee_label");

  // Dasturchiga — faqat o'ziga biriktirilgan vazifalar (sub-vazifasi bor boshqa vazifalar ro'yxatda chiqmaydi)
  const mine = isManager(me) ? undefined : 1;
  const query = useQuery({
    queryKey: ["tasks", "list", debounced, assignee, mine, page],
    queryFn: () => api.get<Paged<Task>>(`/tasks/${qs({ ...filterParams(debounced), assignee, mine, page: page === 1 ? undefined : page })}`),
    placeholderData: keepPreviousData,
  });

  const clearAssignee = () => {
    const next = new URLSearchParams(params);
    next.delete("assignee");
    next.delete("assignee_label");
    setParams(next);
    setPage(1);
  };

  return (
    <>
      <div className="page-head">
        <div className="grow">
          <h1>{T.tasks.title}</h1>
          {query.data && <p>{T.common.count(query.data.count)}</p>}
        </div>
        {assignee && (
          <span className="chip" aria-pressed="true">
            {assigneeLabel}
            <button className="icon-btn" style={{ width: 20, height: 20, color: "inherit" }} onClick={clearAssignee} aria-label={T.common.clear}>
              <X size={14} />
            </button>
          </span>
        )}
        <Button variant="primary" icon={<Plus />} onClick={() => open({ new: "task" })}>
          {T.tasks.new}
        </Button>
      </div>
      <div className="card">
        <TaskFilters value={filters} onChange={(value) => { setFilters(value); setPage(1); }} showPerson={isManager(me)} />
        {query.error ? (
          <div className="card-pad">
            <ErrorBox error={query.error} onRetry={() => query.refetch()} />
          </div>
        ) : (
          <TaskTable tasks={query.data?.results} loading={query.isLoading} />
        )}
        <Pagination data={query.isPlaceholderData ? undefined : query.data} page={page} onPageChange={setPage} />
      </div>
    </>
  );
}

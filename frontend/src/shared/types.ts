export type Role = "boss" | "pm" | "developer" | "department";
export type TaskStatus = "control" | "in_progress" | "in_review" | "done";
export type OrderStatus = "submitted" | "approved" | "rejected" | "project_created";
export type ProjectStage = "planned" | "started" | "needs_fix" | "done";
export type Priority = "low" | "medium" | "high" | "urgent";

export interface Me {
  id: number;
  username: string;
  first_name: string;
  last_name: string;
  full_name: string;
  role: Role;
  role_label: string;
  specialty: string | null;
  department_name: string;
}

export interface UserBrief {
  id: number;
  full_name: string;
  role: Role;
  department_name: string;
}

export interface FileInfo {
  id: number;
  name: string;
  size: number | null;
  url: string;
}

export interface Paged<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface Task {
  id: number;
  title: string;
  description: string;
  project: { id: number; name: string };
  status: TaskStatus;
  priority: Priority;
  starts_at: string | null;
  due_at: string | null;
  completed_at: string | null;
  is_overdue: boolean;
  finished_late: boolean;
  assignees: UserBrief[];
  subtasks_progress: { done: number; total: number };
  created_at: string;
}

export interface Submission {
  id: number;
  round: number;
  note: string;
  submitted_by: UserBrief;
  submitted_at: string;
  decision: "pending" | "accepted" | "returned";
  decision_label: string;
  reviewed_by: UserBrief | null;
  review_note: string;
  reviewed_at: string | null;
  files: FileInfo[];
}

export interface TaskDetail extends Task {
  created_by: UserBrief;
  subtasks: { id: number; title: string; is_done: boolean; assignee: UserBrief | null; can_toggle: boolean }[];
  files: FileInfo[];
  submissions: Submission[];
  actions: { start: boolean; submit: boolean; review: boolean; edit: boolean; delete: boolean; add_files: boolean };
}

export interface OrderVersion {
  id: number;
  number: number;
  file: FileInfo;
  note: string;
  decision: "pending" | "approved" | "rejected";
  decision_label: string;
  reject_reason: string;
  decided_by: UserBrief | null;
  decided_at: string | null;
  created_at: string;
}

export interface Order {
  id: number;
  title: string;
  description: string;
  priority: Priority;
  status: OrderStatus;
  requested_due_date: string;
  start_date: string | null;
  end_date: string | null;
  submitted_by: UserBrief;
  version: number | null;
  created_at: string;
}

export interface OrderDetail extends Order {
  approved_by: UserBrief | null;
  pm_note: string;
  decided_at: string | null;
  versions: OrderVersion[];
  project_id: number | null;
  actions: { approve: boolean; reject: boolean; new_version: boolean; create_project: boolean; edit_dates: boolean };
}

export interface Project {
  id: number;
  name: string;
  description: string;
  stage: ProjectStage;
  start_date: string;
  end_date: string;
  order_id: number | null;
  members: UserBrief[];
  progress: { total: number; done: number };
  created_at: string;
}

export interface ProjectDetail extends Project {
  created_by: UserBrief;
  files: FileInfo[];
  order: { id: number; title: string; department_name: string; requested_due_date: string } | null;
  actions: { edit: boolean; edit_info: boolean; members: boolean; files: boolean; add_task: boolean };
}

export interface Person {
  id: number;
  full_name: string;
  role: Role;
  role_label: string;
  specialty: string;
  department_name: string;
  active_tasks: number;
  overdue_tasks: number;
  review_tasks: number;
  done_tasks: number;
  doing: { id: number; title: string }[];
}

export interface Developer {
  id: number;
  full_name: string;
  specialty: string;
}

export type Bucket = "active" | "overdue" | "done" | "late" | "review";
export type PeriodKey = "year" | "month" | "week";

export interface Dashboard {
  periods: { key: PeriodKey; label: string; since: string; counts: Record<"active" | "overdue" | "done", number> }[];
  totals: Record<"late" | "overdue" | "review" | "active", number>;
  orders_pending?: number;
}

export interface DepartmentDashboard {
  orders: { submitted: number; rejected: number; approved: number };
}

export interface Notice {
  id: number;
  kind: string;
  kind_label: string;
  message: string;
  is_read: boolean;
  created_at: string;
  target: { type: "order" | "project" | "task"; id: number } | null;
}

export interface CommentItem {
  id: number;
  author: UserBrief;
  text: string;
  created_at: string;
}

export interface HistoryItem {
  id: number;
  actor: UserBrief | null;
  verb: string;
  message: string;
  created_at: string;
  target: { type: "order" | "project" | "task"; id: number } | null;
}

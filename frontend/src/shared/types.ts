export type Role = "boss" | "pm" | "developer" | "department" | "user";
export type TaskStatus = "control" | "in_progress" | "in_review" | "done";
export type OrderStatus = "submitted" | "approved" | "rejected" | "project_created";
export type ProjectStage = "planned" | "started" | "needs_fix" | "rejected" | "pending_approval" | "done";
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
  telegram_username: string;
  avatar?: string | null;
}

export interface Profile extends Me {
  date_joined: string;
  stats?: { active: number; in_review: number; done: number; overdue: number };
  /** Faqat oddiy foydalanuvchida: nechta baho qo'ygan va nechta dasturchini kuzatadi. */
  activity?: { reviews: number; following: number } | null;
}

export interface PortfolioSummary {
  developers: number;
  /** So'nggi 30 kunda qo'shilganlar foizi (bo'lmasa null). */
  developers_growth: number | null;
  average_rating: number | null;
  rated_projects: number;
  active_projects: number;
  /** Men kuzatayotgan dasturchilar soni. */
  following: number;
  specialties: { id: number; name: string; count: number }[];
}

export interface MyReview {
  id: number;
  item_id: number;
  item_title: string;
  developer: { id: number; full_name: string };
  stars: number;
  text: string;
  updated_at: string;
}

export interface UserBrief {
  id: number;
  full_name: string;
  role: Role;
  department_name: string;
  avatar?: string | null;
  business_trip_return_date?: string | null;
  is_on_business_trip?: boolean;
}

export interface ChatMessage {
  id: number;
  text: string;
  created_at: string;
  author_id: number;
}

export interface ChatConversation {
  partner: UserBrief;
  last_message: string;
  last_at: string;
  outgoing: boolean;
  unread_count: number;
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
  code: string;
  title: string;
  description: string;
  project: { id: number; name: string; code: string };
  status: TaskStatus;
  priority: Priority;
  starts_at: string | null;
  due_at: string | null;
  completed_at: string | null;
  archived_at?: string | null;
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
  code: string;
  created_by: UserBrief;
  subtasks: { id: number; title: string; is_done: boolean; assignees: UserBrief[]; can_toggle: boolean; can_delete?: boolean }[];
  files: FileInfo[];
  submissions: Submission[];
  worklogs: WorkLog[];
  worklog_hours: string;
  actions: { start: boolean; submit: boolean; review: boolean; edit: boolean; delete: boolean; add_files: boolean; manage_subtasks?: boolean; manage_assignees?: boolean; log_work?: boolean };
}

export interface WorkLog {
  id: number;
  author: UserBrief;
  work_date: string;
  hours: string;
  note: string;
  can_delete: boolean;
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
  project: { id: number; stage: ProjectStage; stage_label: string } | null;
  created_at: string;
}

export interface OrderDetail extends Order {
  completion_report?: { note: string; files: FileInfo[] } | null;
  approved_by: UserBrief | null;
  pm_note: string;
  decided_at: string | null;
  versions: OrderVersion[];
  actions: {
    approve: boolean; reject: boolean; new_version: boolean; create_project: boolean; edit_dates: boolean;
    view_project: boolean; decide_completion: boolean;
  };
}

export interface Project {
  id: number;
  code: string;
  name: string;
  description: string;
  stage: ProjectStage;
  start_date: string;
  end_date: string;
  order_id: number | null;
  members: UserBrief[];
  progress: { total: number; done: number };
  created_at: string;
  /** Server hisoblaydi: yakunlangan · tugash sanasi o'tgan · qolgani. */
  status: ProjectStatus;
  technologies: string[];
  cover: string | null;
}

export type ProjectStatus = "done" | "active" | "overdue";

export interface ProjectDetail extends Project {
  completion_note?: string;
  code: string;
  created_by: UserBrief;
  files: FileInfo[];
  order: { id: number; title: string; department_name: string; requested_due_date: string } | null;
  actions: { edit: boolean; edit_info: boolean; members: boolean; files: boolean; add_task: boolean };
  stage_targets: ProjectStage[];
  completion: { requested_at: string; pending: UserBrief[]; confirmed: UserBrief[] } | null;
}

export interface Person {
  report?: { total: number; done: number; late: number };
  responsibilities?: string;
  id: number;
  full_name: string;
  role: Role;
  role_label: string;
  specialty: string;
  department_name: string;
  avatar?: string | null;
  business_trip_return_date?: string | null;
  is_on_business_trip?: boolean;
  active_tasks: number;
  overdue_tasks: number;
  review_tasks: number;
  done_tasks: number;
  /** Muddat oralig'i filtri tanlanganda — shu oraliqdagi vazifalar soni (aks holda null). */
  range_tasks?: number | null;
  doing: { id: number; title: string }[];
  work?: { id: number; title: string; status: TaskStatus; due_at: string | null; is_overdue: boolean; project: { id: number; name: string; code: string } }[];
  projects?: { id: number; name: string; code: string; stage: ProjectStage; end_date: string }[];
}

export interface Developer {
  id: number;
  full_name: string;
  specialty: string;
  avatar?: string | null;
  business_trip_return_date?: string | null;
  is_on_business_trip?: boolean;
}

export type Bucket = "active" | "overdue" | "done" | "late" | "review";
export type PeriodKey = "year" | "month" | "week";

export interface Dashboard {
  periods: { key: PeriodKey; label: string; since: string; counts: Record<"active" | "overdue" | "done", number> }[];
  totals: Record<"late" | "overdue" | "review" | "active", number>;
  orders_pending?: number;
}

export type OrderBucket = "sent" | "rejected" | "approved";

export interface DepartmentDashboard {
  orders: { submitted: number; rejected: number; approved: number };
  periods: { key: PeriodKey; label: string; since: string; counts: Record<OrderBucket, number> }[];
}

export interface Notice {
  id: number;
  kind: string;
  kind_label: string;
  message: string;
  is_read: boolean;
  created_at: string;
  target: { type: "order" | "project" | "task"; id: number } | null;
  needs_ack: boolean;
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

export interface Suggestion {
  id: number;
  title: string;
  body: string;
  is_anonymous: boolean;
  author: UserBrief | null;
  status: "pending" | "accepted" | "rejected";
  votes_for: number;
  votes_against: number;
  my_vote: "for" | "against" | null;
  created_at: string;
}

export interface SuggestionDetail extends Suggestion {
  boss_note: string;
  decided_by: UserBrief | null;
  decided_at: string | null;
  actions: { decide: boolean; vote: boolean; delete: boolean };
}

// ─── Portfolio ───────────────────────────────────────────────────────────────
export interface PortfolioDeveloper extends UserBrief {
  specialty: string;
  rating: number | null;
  reviews_count: number;
  followers_count: number;
  projects_count: number;
  tasks_done: number;
  is_following: boolean;
  /** Reyting o'rni (qidiruvsiz ro'yxatda). */
  rank: number | null;
  /** Kartada: oxirgi loyihalar nomi, qolganlari soni va tajriba (oy) — ro'yxat javobida. */
  projects?: string[];
  projects_extra?: number;
  experience_months?: number | null;
}

export type PortfolioStatus = "done" | "active" | "planned";

export interface PortfolioItem {
  id: number;
  /** TeamFlow loyihasi (avtomatik) yoki dasturchi o'zi qo'shgan. */
  is_auto: boolean;
  title: string;
  link: string;
  start_date: string | null;
  end_date: string | null;
  /** "done" · "active" · "planned" — loyiha bosqichi yoki sanalaridan hisoblanadi; sana ham, loyiha ham bo'lmasa null. */
  status: PortfolioStatus | null;
  /** Kartada ko'rinadigan qisqa tavsif (to'liq matn — loyiha oynasida). */
  summary: string;
  technologies: string[];
  cover: string | null;
  project: { code: string; stage: ProjectStage } | null;
  tasks_done: number | null;
  rating: number | null;
  reviews_count: number;
  videos_count: number;
}

export interface PortfolioDetail extends PortfolioDeveloper {
  experience: { since: string; months: number };
  /** Loyihalaridagi texnologiyalar yig'indisi (ko'p uchraganlari avval). */
  technologies: { name: string; projects: number }[];
  years: { year: number; projects: number; tasks: number }[];
  items: PortfolioItem[];
  recent_tasks: { id: number; code: string; title: string; project: string; completed_at: string | null }[];
  actions: { follow: boolean; add: boolean };
}

export interface PortfolioReview {
  id: number;
  author: UserBrief;
  stars: number;
  text: string;
  created_at: string;
  updated_at: string;
}

/** Dasturchining barcha loyihalaridagi sharh: qaysi loyiha uchunligi bilan. */
export interface DeveloperReview extends PortfolioReview {
  item_id: number;
  item_title: string;
}

export interface PortfolioItemDetail extends PortfolioItem {
  description: string;
  manual: { title: string; start_date: string | null; end_date: string | null };
  owner: UserBrief;
  videos: FileInfo[];
  /** Galereya (screenshotlar). */
  images: { id: number; url: string }[];
  /** TeamFlow loyihasi uchun (o'zi qo'shgan loyihada null): mas'ul, umumiy jarayon, egasi bajargan ishlar, jamoa. */
  work: {
    lead: UserBrief | null;
    progress: { total: number; done: number };
    completed_tasks: { id: number; title: string; completed_at: string | null }[];
    team: UserBrief[];
  } | null;
  my_review: PortfolioReview | null;
  actions: { edit: boolean; delete: boolean; upload: boolean; review: boolean };
}

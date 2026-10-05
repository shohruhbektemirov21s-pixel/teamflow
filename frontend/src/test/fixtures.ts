/** Frontend testlari uchun umumiy ma'lumotlar (backend javoblari shaklida). */
import type { MetaData } from "@/shared/meta";
import type { Me, TaskDetail, UserBrief } from "@/shared/types";

export const PM: Me = {
  id: 2,
  username: "pm",
  first_name: "Sardor",
  last_name: "Rustamov",
  full_name: "Sardor Rustamov",
  role: "pm",
  role_label: "Loyiha menejeri",
  specialty: null,
  department_name: "",
  telegram_username: "",
};

/** `useMe()` qaytaradigan foydalanuvchi — test ichida almashtirish mumkin. */
export const testUser: { current: Me } = { current: PM };

export const JASUR: UserBrief = { id: 3, full_name: "Jasur Alimov", role: "developer", department_name: "" };
export const MALIKA: UserBrief = { id: 4, full_name: "Malika Karimova", role: "developer", department_name: "" };

export const META: MetaData = {
  roles: [
    { value: "boss", label: "Boshliq" },
    { value: "pm", label: "Loyiha menejeri" },
    { value: "developer", label: "Dasturchi" },
    { value: "department", label: "Boshqarma" },
  ],
  register_roles: [],
  priorities: [
    { value: "low", label: "Past" },
    { value: "medium", label: "O'rtacha" },
    { value: "high", label: "Yuqori" },
    { value: "urgent", label: "Shoshilinch" },
  ],
  task_statuses: [
    { value: "control", label: "Nazoratda" },
    { value: "in_progress", label: "Jarayonda" },
    { value: "in_review", label: "Tekshiruvda" },
    { value: "done", label: "Bajarildi" },
  ],
  order_statuses: [],
  project_stages: [],
  task_moves: [],
  telegram_bot: "teamflow_test_bot",
};

export function taskDetail(overrides: Partial<TaskDetail> = {}): TaskDetail {
  return {
    id: 1,
    code: "100000001",
    title: "Kirish sahifasini yaratish",
    description: "",
    project: { id: 1, name: "Portal", code: "200000001" },
    status: "in_progress",
    priority: "medium",
    starts_at: null,
    due_at: null,
    completed_at: null,
    is_overdue: false,
    finished_late: false,
    assignees: [JASUR],
    subtasks_progress: { done: 0, total: 0 },
    created_at: "2026-09-28T10:00:00Z",
    created_by: { id: PM.id, full_name: PM.full_name, role: "pm", department_name: "" },
    subtasks: [],
    files: [],
    submissions: [],
    worklogs: [],
    worklog_hours: "0.00",
    actions: { start: false, submit: false, review: false, edit: false, delete: false, add_files: false, log_work: false },
    submit_ack: null,
    ...overrides,
  };
}

import {
  Bell,
  CalendarDays,
  ClipboardCheck,
  FileText,
  FolderKanban,
  KanbanSquare,
  LayoutDashboard,
  ListChecks,
  type LucideIcon,
  Users,
  Lightbulb,
  CheckSquare,
  MessageCircle,
} from "lucide-react";

import { T } from "@/shared/text";
import type { Role } from "@/shared/types";

export type Counter = "myWork" | "orders" | "review" | "notifications";

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  counter?: Counter;
}

export interface NavGroup {
  title: string;
  items: NavItem[];
}

const dashboard: NavItem = { to: "/", label: T.nav.dashboard, icon: LayoutDashboard };
const tasks: NavItem = { to: "/vazifalar", label: T.nav.tasks, icon: ListChecks };
const calendar: NavItem = { to: "/taqvim", label: T.nav.calendar, icon: CalendarDays };
const people: NavItem = { to: "/xodimlar", label: T.nav.people, icon: Users };
const notifications: NavItem = { to: "/bildirishnomalar", label: T.nav.notifications, icon: Bell, counter: "notifications" };
const suggestions: NavItem = { to: "/takliflar", label: T.nav.suggestions, icon: Lightbulb };
const messages: NavItem = { to: "/xabarlar", label: T.nav.messages, icon: MessageCircle };
const workDone: NavItem = { to: "/qilingan-ishlar", label: T.nav.workDone, icon: CheckSquare };

/**
 * Yon panel rolga qarab (README, 7-bo'lim).
 */
export function navFor(role: Role): NavGroup[] {
  switch (role) {
    case "developer":
      return [
        {
          title: T.nav.groupMain,
          items: [dashboard, tasks, { to: "/mening-ishim", label: T.nav.myWork, icon: KanbanSquare, counter: "myWork" }, calendar],
        },
        { title: T.nav.groupTeam, items: [messages, notifications, suggestions] },
      ];
    case "department":
      return [
        { title: T.nav.groupMain, items: [dashboard, { to: "/buyurtmalar", label: T.nav.myOrders, icon: FileText }] },
        { title: T.nav.groupTeam, items: [messages, notifications, suggestions] },
      ];
    default: // pm, boss
      return [
        {
          title: T.nav.groupMain,
          items: [
            dashboard,
            { to: "/loyihalar", label: T.nav.projects, icon: FolderKanban },
            { to: "/buyurtmalar", label: T.nav.orders, icon: FileText, counter: "orders" },
            tasks,
            calendar,
          ],
        },
        {
          title: T.nav.groupTeam,
          items: [people, messages, notifications, { to: "/tekshiruv", label: T.nav.review, icon: ClipboardCheck, counter: "review" }, suggestions],
        },
        { title: T.nav.groupControl, items: [workDone] },
      ];
  }
}

/** Menyuda yo'q, lekin sarlavhasi bor sahifalar (profil foydalanuvchi kartasi orqali ochiladi). */
const EXTRA_TITLES: Record<string, string> = { "/profil": T.nav.profile };

export function pageTitle(pathname: string, role: Role): string {
  for (const g of navFor(role)) for (const i of g.items) if (i.to === pathname) return i.label;
  return EXTRA_TITLES[pathname] ?? T.app;
}

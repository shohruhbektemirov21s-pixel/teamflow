import {
  Bell,
  CalendarDays,
  ClipboardCheck,
  FileText,
  FolderKanban,
  History,
  KanbanSquare,
  LayoutDashboard,
  ListChecks,
  type LucideIcon,
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
const notifications: NavItem = { to: "/bildirishnomalar", label: T.nav.notifications, icon: Bell, counter: "notifications" };
const history: NavItem = { to: "/tarix", label: T.nav.history, icon: History };

/**
 * Yon panel rolga qarab (README, 7-bo'lim). "Takliflar" va "Xabarlar" talab aniqlanguncha qo'shilmagan
 * (docs/ARCHITECTURE.md, 11-bo'lim).
 */
export function navFor(role: Role): NavGroup[] {
  switch (role) {
    case "developer":
      return [
        {
          title: T.nav.groupMain,
          items: [dashboard, tasks, { to: "/mening-ishim", label: T.nav.myWork, icon: KanbanSquare, counter: "myWork" }, calendar],
        },
        { title: T.nav.groupTeam, items: [notifications] },
        { title: T.nav.groupControl, items: [history] },
      ];
    case "department":
      return [
        { title: T.nav.groupMain, items: [{ to: "/buyurtmalar", label: T.nav.myOrders, icon: FileText }] },
        { title: T.nav.groupTeam, items: [notifications] },
        { title: T.nav.groupControl, items: [history] },
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
          items: [notifications, { to: "/tekshiruv", label: T.nav.review, icon: ClipboardCheck, counter: "review" }],
        },
        { title: T.nav.groupControl, items: [history] },
      ];
  }
}

export function pageTitle(pathname: string, role: Role): string {
  for (const g of navFor(role)) for (const i of g.items) if (i.to === pathname) return i.label;
  return T.app;
}

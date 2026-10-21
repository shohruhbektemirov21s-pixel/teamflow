import { ArrowUpDown, Calendar, RefreshCw } from "lucide-react";
import type { ReactNode } from "react";

import type { Tone } from "@/shared/status";
import { T } from "@/shared/text";

import { AnimatedNumber, Button, Field, Skeleton } from "./index";

/**
 * Ro'yxat sahifalari uchun umumiy bo'laklar (Buyurtmalar, Vazifalar, Loyihalar): tepada ko'rsatkich kartalari,
 * holat tugmalari (soni bilan), filtr kartasi. Sonlar va grafiklar serverdan (`/stats/`) keladi.
 */

/** Kichik chiziqli grafik (so'nggi haftalar). Hammasi nol bo'lsa — tekis chiziq. Rang — `currentColor`. */
export function Sparkline({ values, label }: { values: number[]; label?: string }) {
  const max = Math.max(...values, 1);
  const step = values.length > 1 ? 100 / (values.length - 1) : 100;
  const points = values.map((v, i) => `${(i * step).toFixed(1)},${(30 - (v / max) * 26).toFixed(1)}`);
  const line = `M${points.join(" L")}`;
  return (
    <svg className="spark" viewBox="0 0 100 32" preserveAspectRatio="none" role="img" aria-label={label} focusable="false">
      <path d={`${line} L100,32 L0,32 Z`} className="spark-area" />
      <path d={line} className="spark-line" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export interface StatItem {
  key: string;
  label: string;
  caption: string;
  icon: ReactNode;
  tone: Tone;
  value: number;
  series?: number[];
}

/** Ko'rsatkich kartalari qatori. `items` yo'q (yuklanmoqda) bo'lsa — skeleton. `count` — skeletonlar soni. */
export function StatRow({ items, count = 5 }: { items: StatItem[] | undefined; count?: number }) {
  if (!items) {
    return (
      <div className="kpi-row" aria-busy="true">
        {Array.from({ length: count }, (_, i) => <Skeleton key={i} h={112} style={{ borderRadius: "var(--radius)" }} />)}
      </div>
    );
  }
  return (
    <div className="kpi-row">
      {items.map((s) => (
        <div key={s.key} className="kpi" style={{ ["--kpi-color" as string]: `var(--${s.tone})` }}>
          <span className={`kpi-icon tone-${s.tone}`}>{s.icon}</span>
          <div className="kpi-body">
            <span className="kpi-label">{s.label}</span>
            <span className="kpi-num"><AnimatedNumber value={s.value} /></span>
            <span className="kpi-caption">{s.caption}</span>
          </div>
          {s.series && <Sparkline values={s.series} label={T.list.trend(s.label)} />}
        </div>
      ))}
    </div>
  );
}

export interface TabItem {
  key: string;
  label: string;
  icon: ReactNode;
  count: number | undefined;
}

/** Holat tugmalari: ikonka + nom + soni. Tanlangani to'ldirilgan rangda. */
export function TabChips({ tabs, value, onChange, label }: { tabs: TabItem[]; value: string; onChange: (key: string) => void; label: string }) {
  return (
    <div className="tab-chips" role="group" aria-label={label}>
      {tabs.map((t) => (
        <button key={t.key || "all"} type="button" className="tab-chip" aria-pressed={value === t.key} onClick={() => onChange(t.key)}>
          {t.icon}
          <span>{t.label}</span>
          {t.count !== undefined && <span className="tab-count">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

/** Filtr kartasi ichidagi maydon: tepada nom, ichida ikonka bilan tanlagich. */
export function FilterSelect({ label, icon, value, onChange, children }: {
  label: string; icon: ReactNode; value: string; onChange: (value: string) => void; children: ReactNode;
}) {
  return (
    <Field label={label}>
      {(id) => (
        <div className="select-icon">
          {icon}
          <select id={id} className="select" value={value} onChange={(e) => onChange(e.target.value)}>
            {children}
          </select>
        </div>
      )}
    </Field>
  );
}

/** Sana oralig'i: Boshlanish → Tugash (bitta maydon ichida ikkita sana). */
export function DateRange({ label, from, to, onFrom, onTo }: { label: string; from: string; to: string; onFrom: (v: string) => void; onTo: (v: string) => void }) {
  return (
    <div className="field date-field">
      <label className="field-label">{label}</label>
      <div className="input date-range">
        <Calendar size={16} aria-hidden />
        <input type="date" aria-label={T.filters.dateFrom} value={from} max={to || undefined} onChange={(e) => onFrom(e.target.value)} />
        <span className="muted" aria-hidden>→</span>
        <input type="date" aria-label={T.filters.dateTo} value={to} min={from || undefined} onChange={(e) => onTo(e.target.value)} />
      </div>
    </div>
  );
}

/** Ixcham saralash tanlagichi (amallar qatorida): "Saralash: …". */
export function SortSelect({ value, onChange, options }: { value: string; onChange: (value: string) => void; options: readonly { value: string; label: string }[] }) {
  return (
    <div className="select-icon sort-inline">
      <ArrowUpDown aria-hidden />
      <select className="select" value={value} onChange={(e) => onChange(e.target.value)} aria-label={T.filters.sort}>
        <option value="">{T.filters.sortDefault}</option>
        {options.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
      </select>
    </div>
  );
}

/** "Filtrlarni tozalash" — faqat filtr berilganda bosiladi. */
export function ClearFilters({ active, onClick }: { active: boolean; onClick: () => void }) {
  return (
    <div className="filters-clear">
      <Button variant="default" icon={<RefreshCw />} disabled={!active} onClick={onClick}>
        {T.filters.clear}
      </Button>
    </div>
  );
}

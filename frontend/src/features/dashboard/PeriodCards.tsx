import { fmtDate } from "@/shared/format";
import { T } from "@/shared/text";
import type { PeriodKey } from "@/shared/types";
import { Skeleton } from "@/shared/ui";

export interface PeriodData<B extends string> {
  key: PeriodKey;
  label: string;
  since: string;
  counts: Record<B, number>;
}

/**
 * "Yil boshidan / Oy boshidan / Hafta boshidan" kartalari — barcha bosh panellarda bir xil ko'rinish
 * (vazifalar: Faol · Muddati o'tgan · Bajarilgan; Boshqarma: Yuborilgan · Rad etilgan · Tasdiqlangan).
 * `alert` — son noldan katta bo'lsa qizil (masalan, muddati o'tgan, rad etilgan).
 */
export function PeriodCards<B extends string>({
  periods,
  buckets,
  isOn,
  onPick,
}: {
  periods: PeriodData<B>[] | undefined;
  buckets: { key: B; label: string; alert?: boolean }[];
  isOn: (bucket: B, period: PeriodKey) => boolean;
  onPick: (bucket: B, period: PeriodKey, title: string) => void;
}) {
  return (
    <div className="grid-3" style={{ marginBottom: 24 }}>
      {periods
        ? periods.map((p) => (
            <div key={p.key} className="card period" style={{ padding: "20px" }}>
              <div style={{ marginBottom: 16 }}>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>{p.label}</h3>
                <span className="small muted">{T.dashboard.since(fmtDate(p.since))}</span>
              </div>
              <div className="period-nums" style={{ display: "flex", gap: 12 }}>
                {buckets.map((b) => {
                  const n = p.counts[b.key];
                  const on = isOn(b.key, p.key);
                  return (
                    <button
                      key={b.key}
                      className="stat"
                      aria-pressed={on}
                      onClick={() => onPick(b.key, p.key, T.dashboard.tableTitle(p.label, b.label))}
                      style={{ flex: 1, padding: "12px 8px", background: on ? "var(--bg)" : "transparent" }}
                    >
                      <span className={`stat-num ${n ? "" : "zero"}`} style={{ fontSize: 24, marginBottom: 4, color: b.alert && n ? "var(--danger)" : "var(--text)" }}>
                        {n}
                      </span>
                      <span className="stat-label" style={{ fontSize: 12, opacity: 0.8 }}>
                        {b.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))
        : [0, 1, 2].map((i) => <Skeleton key={i} h={140} />)}
    </div>
  );
}

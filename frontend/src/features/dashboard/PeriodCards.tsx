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
    <div className="grid-3">
      {periods
        ? periods.map((p) => (
            <div key={p.key} className="card period">
              <div className="period-head">
                <h3>{p.label}</h3>
                <span className="small muted">{T.dashboard.since(fmtDate(p.since))}</span>
              </div>
              <div className="period-nums">
                {buckets.map((b) => {
                  const n = p.counts[b.key];
                  const on = isOn(b.key, p.key);
                  return (
                    <button
                      key={b.key}
                      className="stat"
                      aria-pressed={on}
                      onClick={() => onPick(b.key, p.key, T.dashboard.tableTitle(p.label, b.label))}
                    >
                      <span className={`stat-num ${n ? (b.alert ? "alert" : "") : "zero"}`}>
                        {n}
                      </span>
                      <span className="stat-label">
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

"""Verify load evidence independently of the load generator's exit code."""
import argparse
import csv
import json
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument("prefix", type=Path)
parser.add_argument("--users", type=int, default=10000)
parser.add_argument("--peak-seconds", type=int, default=120)
parser.add_argument("--output", type=Path, required=True)
args = parser.parse_args()
with Path(str(args.prefix) + "_stats.csv").open(encoding="utf-8-sig") as stream:
    stats = list(csv.DictReader(stream))
with Path(str(args.prefix) + "_stats_history.csv").open(encoding="utf-8-sig") as stream:
    history = [row for row in csv.DictReader(stream) if row["Name"] == "Aggregated"]
total = next(row for row in stats if row["Name"] == "Aggregated")
windows, current = [], []
for row in history:
    if int(row["User Count"]) >= args.users:
        current.append(row)
    elif current:
        windows.append(current)
        current = []
if current:
    windows.append(current)
peak = max(windows, key=lambda rows: int(rows[-1]["Timestamp"]) - int(rows[0]["Timestamp"]), default=[])
duration = int(peak[-1]["Timestamp"]) - int(peak[0]["Timestamp"]) if peak else 0
requests = int(total["Request Count"])
failures = int(total["Failure Count"])
peak_rps = (int(peak[-1]["Total Request Count"]) - int(peak[0]["Total Request Count"])) / duration if duration else 0
result = {
    "users_peak": max(int(row["User Count"]) for row in history),
    "peak_seconds": duration, "peak_requests_per_second": round(peak_rps, 2),
    "requests": requests, "failures": failures,
    "failure_percent": round(100 * failures / max(1, requests), 4),
    "p95_ms": float(total["95%"]), "p99_ms": float(total["99%"]),
    "peak_rolling_p95_max_ms": max((float(row["95%"]) for row in peak if row["95%"] != "N/A"), default=0),
    "endpoints": [{"method": row["Type"], "name": row["Name"],
                   "requests": int(row["Request Count"]), "failures": int(row["Failure Count"]),
                   "p95_ms": float(row["95%"]), "p99_ms": float(row["99%"])}
                  for row in stats if row["Name"] != "Aggregated"],
}
result["passed"] = bool(requests and duration >= args.peak_seconds and failures / requests < 0.01 and result["p95_ms"] <= 500)
args.output.parent.mkdir(parents=True, exist_ok=True)
args.output.write_text(json.dumps(result, indent=2), encoding="utf-8")
print(json.dumps({key: value for key, value in result.items() if key != "endpoints"}))
raise SystemExit(0 if result["passed"] else 1)

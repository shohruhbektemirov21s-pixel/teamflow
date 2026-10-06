"""Keep aggregate evidence only; never copy credentials or session fixtures."""
import csv
import json
import shutil
from pathlib import Path

source = Path(__file__).resolve().parent / "artifacts"
target = Path(__file__).resolve().parents[2] / "docs/performance/2026-10-06"
target.mkdir(parents=True, exist_ok=True)
summary = json.loads((source / "summary-distributed.json").read_text())
if not summary["passed"]:
    raise RuntimeError("The final workload must pass before preserving qualified evidence.")
shutil.copyfile(source / "10000-distributed_stats.csv", target / "10k_stats.csv")
shutil.copyfile(source / "summary-distributed.json", target / "summary.json")
with (source / "10000-distributed_stats_history.csv").open(encoding="utf-8-sig") as stream:
    rows = [row for row in csv.DictReader(stream) if row["Name"] == "Aggregated"]
with (target / "10k_stats_history.csv").open("w", newline="", encoding="utf-8") as stream:
    writer = csv.DictWriter(stream, fieldnames=rows[0])
    writer.writeheader()
    writer.writerows(rows)
samples = json.loads((source / "resources-distributed.json").read_text())
services = {}
for sample in samples:
    for item in sample["containers"]:
        name = item["Name"].removeprefix("teamflow-scale-test-")
        name = "load-generator" if name.startswith("load-run-") else name.removesuffix("-1")
        memory = item["MemUsage"].split(" /")[0]
        unit = next(unit for unit in ("GiB", "MiB", "KiB", "B") if memory.endswith(unit))
        mib = float(memory.removesuffix(unit)) * {"GiB": 1024, "MiB": 1, "KiB": 1/1024, "B": 1/(1024*1024)}[unit]
        services.setdefault(name, []).append((float(item["CPUPerc"].removesuffix("%")), mib))
resources = {name: {"sample_count": len(values), "max_cpu_percent": round(max(cpu for cpu, _ in values), 2),
                    "max_memory_mib": round(max(memory for _, memory in values), 2)} for name, values in services.items()}
(target / "resources.json").write_text(json.dumps(resources, indent=2))
for file in ("browser.json", "browser-auth.json"):
    shutil.copyfile(source / file, target / file)
print(json.dumps(resources))

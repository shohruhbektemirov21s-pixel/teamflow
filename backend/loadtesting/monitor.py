"""Sample only the isolated Compose project; aggregate evidence contains no sessions."""
import argparse
import json
import subprocess
import time
from datetime import datetime, timezone
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument("--duration", type=int, default=300)
parser.add_argument("--output", type=Path, required=True)
args = parser.parse_args()
samples = []
deadline = time.monotonic() + args.duration
while time.monotonic() < deadline:
    ids = subprocess.check_output([
        "docker", "ps", "--filter", "label=com.docker.compose.project=teamflow-scale-test", "--format", "{{.ID}}"
    ], text=True).split()
    if ids:
        output = subprocess.check_output(["docker", "stats", "--no-stream", "--format", "{{json .}}", *ids], text=True)
        samples.append({"time": datetime.now(timezone.utc).isoformat(), "containers": [json.loads(line) for line in output.splitlines()]})
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(json.dumps(samples, indent=2), encoding="utf-8")
    time.sleep(8)
print(f"Saved {len(samples)} resource samples.")

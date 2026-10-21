import csv
import json
import subprocess
import sys
from pathlib import Path
from tempfile import TemporaryDirectory

from django.conf import settings
from django.test import SimpleTestCase


class LoadEvidenceTests(SimpleTestCase):
    def analyze(self, points, failures=0):
        with TemporaryDirectory() as folder:
            prefix = Path(folder) / "load"
            stats = {"Type": "", "Name": "Aggregated", "Request Count": 100,
                     "Failure Count": failures, "95%": 100, "99%": 200}
            with Path(str(prefix) + "_stats.csv").open("w", newline="") as stream:
                writer = csv.DictWriter(stream, fieldnames=stats)
                writer.writeheader()
                writer.writerow(stats)
            rows = [{"Timestamp": stamp, "User Count": users, "Name": "Aggregated", "95%": 100,
                     "Total Request Count": i * 30} for i, (stamp, users) in enumerate(points)]
            with Path(str(prefix) + "_stats_history.csv").open("w", newline="") as stream:
                writer = csv.DictWriter(stream, fieldnames=rows[0])
                writer.writeheader()
                writer.writerows(rows)
            output = Path(folder) / "result.json"
            run = subprocess.run([sys.executable, str(settings.BASE_DIR / "loadtesting/analyze.py"),
                                  str(prefix), "--output", str(output)], capture_output=True)
            return run.returncode, json.loads(output.read_text())

    def test_sustained_peak_passes_and_one_percent_failures_do_not(self):
        points = [(0, 0), (10, 10000), (140, 10000), (150, 0)]
        code, result = self.analyze(points)
        self.assertEqual(code, 0)
        self.assertTrue(result["passed"])
        self.assertEqual(result["peak_seconds"], 130)
        self.assertEqual(self.analyze(points, failures=1)[0], 1)

    def test_separate_brief_peaks_cannot_fake_a_sustained_peak(self):
        code, result = self.analyze([(0, 10000), (10, 10000), (20, 5000), (130, 10000), (140, 10000)])
        self.assertEqual(code, 1)
        self.assertEqual(result["peak_seconds"], 10)

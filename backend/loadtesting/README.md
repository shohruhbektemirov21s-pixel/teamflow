# Isolated capacity test

This harness uses synthetic sessions and refuses external hosts. `seed_scale` refuses every database except PostgreSQL `teamflow_scale`, refuses non-empty databases, and requires `SCALE_TEST_MODE=1`. It never uses the live SQLite database.

Seed: 10000 unique users (1 boss, 499 PMs, 1000 departments, 8500 developers), 2000 projects, 50000 tasks, 50000 subtasks, 50000 notifications, 8500 messages, 10000 sessions. Fixtures are shuffled with a fixed seed. No Telegram/TinyFish requests run. Login load and uploaded file traffic are separate concerns; the load test exercises existing authenticated sessions.

Each virtual user makes an action every 10-30 seconds: 40% unread counts, 20% role-specific dashboard, 15% lists, 10% details/people, 10% chat, 5% worklogs (other roles read instead). All requests pass through Nginx, Gunicorn, Django session authentication, Redis and PostgreSQL. No mocked responses.

Acceptance for this workload: all 10000 virtual users reached, at least 120 seconds at peak, error rate <1%, aggregate p95 <=500ms, no database integrity errors. Record per-endpoint results too: an aggregate percentile alone can hide a slow endpoint. This is not a universal guarantee for all possible user actions or a substitute for running the same test on the chosen production server.

Use the deployment Compose file with a separate project name `teamflow-scale-test` and a private env file; PostgreSQL database must be `teamflow_scale`. Disable HTTPS redirect/secure cookies only for this loopback-only test, set PROXY_SCHEME=http, bind HTTP_PORT=18088 to 127.0.0.1. Run migrations and collectstatic before starting the app. Mount `artifacts` when seeding sessions:

```powershell
docker compose --env-file backend/deploy/.scale.env -p teamflow-scale-test -f backend/deploy/compose.yml run --rm --no-deps -v "${PWD}/backend/loadtesting/artifacts:/artifacts" app python manage.py seed_scale --output /artifacts/users.json
docker compose --env-file backend/deploy/.scale.env -p teamflow-scale-test -f backend/deploy/compose.yml run --rm -e LOAD_WORKERS=4 load --processes 4 --host http://proxy --headless -u 10000 -r 200 -t 5m --csv /artifacts/10000 --csv-full-history --stop-timeout 25
backend/.venv/Scripts/python.exe backend/loadtesting/analyze.py backend/loadtesting/artifacts/10000 --output backend/loadtesting/artifacts/summary.json
```

Afterward retain only aggregate CSV/report files. Remove synthetic session fixtures and the private test env file. Confirm the Compose project label is `teamflow-scale-test`, then remove only that project's containers and named volumes with `docker compose ... down --volumes`. Do not remove unrelated Docker projects or the live application database. Keep external provider tokens blank.

`LOAD_WORKERS` must match `--processes` so each generator worker uses its own disjoint session partition. Do not enable worker rebalancing/replacement with these fixed partitions. The analyzer independently checks user count, peak duration, failures and latency from CSV evidence. Run resource monitoring alongside the capacity test, but complete builds, regression tests and browser QA before measuring capacity. See [Locust distributed load generation](https://docs.locust.io/en/stable/running-distributed.html).

Browser QA uses Edge and Playwright without changing the application's dependency lockfile:

```powershell
npm install --prefix backend/loadtesting/artifacts/browser-tools --no-save --package-lock=false playwright
node backend/loadtesting/browser-smoke.mjs
```

The browser smoke script checks four roles, 375/768/1440 widths, authenticated pages, API/runtime errors, page overflow and people pagination. It does not claim visual regression coverage without baseline screenshots or a complete accessibility audit. For login/logout, mount `browser_user.py` and the artifact directory into the isolated app and execute it via `manage.py shell`; it refuses other databases and creates one additional synthetic account with private random credentials. Then run `node backend/loadtesting/browser-auth.mjs`. Delete `browser-login.json` with session fixtures after QA.

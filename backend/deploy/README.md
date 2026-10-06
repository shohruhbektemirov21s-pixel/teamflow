# Production deployment

Local development continues to use SQLite. Production requires PostgreSQL and Redis; missing configuration fails startup instead of silently falling back to SQLite. The Compose stack supplies PostgreSQL 16, Redis 7, Gunicorn and Nginx, with memory limits and private database/cache ports. Container health endpoints are `/healthz/live/` and `/healthz/ready/`; readiness checks the database and cache.

The HTTP listener binds **127.0.0.1:8088** by default. Put a HTTPS gateway with a valid certificate on the same host in front of this listener, forwarding the original Host. Nginx stamps `X-Forwarded-Proto=https`; only that trusted gateway may access the listener. Do not expose this plain HTTP listener publicly with this setting. Production retains SSL redirect, secure session/CSRF cookies and HSTS. Use the actual domain in allowed hosts and trusted origins. If moving the gateway to another host, secure the private hop and firewall before changing the binding. The deployment does not issue TLS certificates automatically.

Copy `.env.example` to a private `.env`, replace both secrets, and keep it out of Git. Use a URL-safe random PostgreSQL password or URL-encode it in DATABASE_URL when configuring a different service. From the repository root:

```sh
docker compose --env-file backend/deploy/.env -p teamflow-prod -f backend/deploy/compose.yml build app
docker compose --env-file backend/deploy/.env -p teamflow-prod -f backend/deploy/compose.yml up -d db redis
docker compose --env-file backend/deploy/.env -p teamflow-prod -f backend/deploy/compose.yml run --rm --no-deps app python manage.py migrate --noinput
docker compose --env-file backend/deploy/.env -p teamflow-prod -f backend/deploy/compose.yml run --rm --no-deps app python manage.py collectstatic --noinput
docker compose --env-file backend/deploy/.env -p teamflow-prod -f backend/deploy/compose.yml run --rm --no-deps app python manage.py check --deploy
docker compose --env-file backend/deploy/.env -p teamflow-prod -f backend/deploy/compose.yml up -d app proxy
```

Enable optional Telegram services with `--profile telegram up -d telegram bot` after configuring the token. Notifications commit atomically with their Telegram outbox records. A single worker claims short database leases, sends outside the transaction, retries up to six attempts, and records final failures. Monitor unsent/failed `TelegramDelivery` rows. Delivery is at least once: a crash after Telegram accepts a message and before saving `sent_at` can cause a duplicate. Redis caches sessions; `cached_db` persists sessions in PostgreSQL so eviction does not log everyone out. Pending Telegram delivery is not stored in the evictable cache.

The example uses 12 workers and 2 threads, with at least 24 web database connections plus bot, worker, migrations, health checks and operations. Increase replicas only after increasing the database connection budget or adding a tested connection pool. Thread count is not user capacity. Automatic Gunicorn recycling is disabled: the tested gthread recycling configuration interrupted concurrent requests. Enable WEB_MAX_REQUESTS only after verifying graceful draining under the deployment's workload. Watch RSS, p95/p99, per-route errors, connection counts, database waits, queue lag and disk growth. Docker CPU percentage uses 100% per CPU core.

The Compose stack is one application instance and one database, not automatic high availability. For horizontal scaling, share Redis/PostgreSQL, use the same secrets, put a balancer in front of replicas, and provide shared persistent upload storage. Local named volumes only share files on this host. Set resource reservations and connection limits from measurements on the selected server; the local 10,000-user test is not a guarantee for another server or workload. Repeat the isolated capacity harness there before launch, including login bursts and representative file uploads.

Before changing the existing database, take and verify a backup. Existing SQLite users/business records have not been migrated to this isolated test database. A real cutover needs a maintenance window, an export excluding contenttypes/permissions/session cache, import into a fresh migrated PostgreSQL database, sequence reset, row-count and permission checks, and retention of the untouched SQLite backup for rollback. Do not run the scale seeder against production. Plan and verify that data migration separately against a copy of the actual database.

Back up PostgreSQL with `pg_dump -Fc` to protected off-host storage and back up the uploads volume at the same application-consistent point. Verify restore with `pg_restore --no-owner` into a separate database plus a restored uploads copy; check row counts, login, permissions and file downloads. Keep PostgreSQL and upload backups together, encrypt sensitive backups and define retention. Never use `down --volumes` for production maintenance. Apply schema migrations once, before rolling out workers; back up before every migration. The added indexes may lock large live tables during migration, so schedule that migration appropriately.

Authenticated API responses remain private; Nginx does not cache user data. Hashed assets get immutable caching, gzip reduces transfer size. Existing uploaded files continue through permission-checked Django downloads.

`check --deploy` reports W021 because HSTS preload is deliberately disabled until the final domain and its subdomains are verified for permanent HTTPS. This is a deployment decision, not an automatic setting to enable on an unspecified domain.

Reference: [Django deployment checklist](https://docs.djangoproject.com/en/5.2/howto/deployment/checklist/), [Django PostgreSQL connections](https://docs.djangoproject.com/en/5.2/ref/databases/#persistent-connections), [Django Redis cache](https://docs.djangoproject.com/en/5.2/topics/cache/#redis).

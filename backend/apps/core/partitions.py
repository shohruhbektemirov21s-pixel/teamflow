"""Tez o'sadigan jadvallarni oylarga bo'lish (PostgreSQL declarative partitioning, `created_at` bo'yicha).

Nima uchun: bildirishnoma, chat va tarix har kuni o'sadi, lekin deyarli har doim oxirgi oylar o'qiladi.
Har oy alohida jadval (`<jadval>_p2026_10`) — indekslar kichik qoladi, sanaga oid so'rov faqat kerakli oyni
o'qiydi, eski oyni arxivlash/o'chirish bitta tezkor `DETACH`/`DROP` (millionlab `DELETE` emas).

Vazifa, loyiha, buyurtma bo'linmaydi: ularga boshqa jadvallar bog'langan (FK), partitsiyali jadvalga FK
qo'yish uchun kalit (id, created_at) bo'lishi kerak — bog'lanishlar buziladi, tezlik esa oshmaydi.

Django jadval partitsiyali ekanini bilmaydi va bilishi shart emas: so'rovlar avvalgidek ishlaydi.
SQLite'da (dev) hech narsa qilinmaydi.
"""
import datetime

from django.apps import apps
from django.db import connection, transaction
from django.utils import timezone

MONTHS_AHEAD = 3  # oldindan tayyorlanadigan oylar (kunlik `ensure_partitions` ishlamay qolsa ham zaxira)
PARTITIONED_MODELS = ("notifications.Notification", "chat.ChatMessage", "core.ActivityLog")


def partitioned_tables():
    return [apps.get_model(label)._meta.db_table for label in PARTITIONED_MODELS]


def month_start(value):
    return datetime.date(value.year, value.month, 1)


def add_months(month, count):
    years, index = divmod(month.month - 1 + count, 12)
    return datetime.date(month.year + years, index + 1, 1)


def partition_name(table, month):
    return f"{table}_p{month:%Y_%m}"


def _bound(month):
    return f"'{month.isoformat()} 00:00:00+00'"  # sana kodda hisoblanadi — tashqi qiymat emas


def _is_partitioned(cursor, table):
    cursor.execute("SELECT relkind FROM pg_class WHERE oid = to_regclass(%s)", [table])
    row = cursor.fetchone()
    return bool(row) and row[0] == "p"


def ensure_month(cursor, table, month):
    """`month` uchun partitsiya bo'lmasa yaratadi. DEFAULT partitsiyaga tushib qolgan shu oy qatorlari
    yangi partitsiyaga ko'chiriladi (aks holda PostgreSQL uni ulashga ruxsat bermaydi). Yaratilsa — True."""
    name = partition_name(table, month)
    cursor.execute("SELECT to_regclass(%s)", [name])
    if cursor.fetchone()[0]:
        return False
    start, end = _bound(month), _bound(add_months(month, 1))
    with transaction.atomic():
        cursor.execute(f'CREATE TABLE "{name}" (LIKE "{table}" INCLUDING DEFAULTS INCLUDING CONSTRAINTS)')
        cursor.execute(
            f'WITH moved AS (DELETE FROM "{table}_default" WHERE created_at >= {start} AND created_at < {end} '
            f'RETURNING *) INSERT INTO "{name}" SELECT * FROM moved'
        )
        # Ota jadvaldagi indekslar va asosiy kalit partitsiyada avtomatik yaratiladi
        cursor.execute(f'ALTER TABLE "{table}" ATTACH PARTITION "{name}" FOR VALUES FROM ({start}) TO ({end})')
    return True


def ensure_partitions(today=None):
    """Joriy oy va keyingi `MONTHS_AHEAD` oy uchun partitsiyalar. Kunlik ishga tushiriladi. Yaratilganlar ro'yxati.

    DEFAULT partitsiyada eski oylar qatorlari bo'lsa (masalan, SQLite'dan ko'chirilgan tarix), o'sha oylar
    uchun ham partitsiya yaratilib, qatorlar ko'chiriladi — hech bir oy DEFAULT'da qolib ketmaydi.
    """
    if connection.vendor != "postgresql":
        return []
    current = month_start(today or timezone.now())
    created = []
    with connection.cursor() as cursor:
        for table in partitioned_tables():
            if not _is_partitioned(cursor, table):
                continue
            cursor.execute(f'SELECT min(created_at) FROM "{table}_default"')
            oldest = cursor.fetchone()[0]
            month = min(month_start(oldest), current) if oldest else current
            while month <= add_months(current, MONTHS_AHEAD):
                if ensure_month(cursor, table, month):
                    created.append(partition_name(table, month))
                month = add_months(month, 1)
    return created


def convert_to_monthly(schema_editor, table):
    """Oddiy jadvalni oylik partitsiyali jadvalga aylantiradi (migratsiyadan chaqiriladi). Ma'lumot, indekslar,
    FK va CHECK cheklovlari, id ketma-ketligi saqlanadi. Asosiy kalit (id, created_at) bo'ladi —
    PostgreSQL talabi; id baribir ketma-ketlikdan keladi va takrorlanmaydi."""
    conn = schema_editor.connection
    if conn.vendor != "postgresql":
        return
    if conn.pg_version < 170000:
        raise RuntimeError("Oylik partitsiyalar uchun PostgreSQL 17 yoki yangisi kerak.")
    with conn.cursor() as cursor:
        if _is_partitioned(cursor, table):
            return
        cursor.execute(
            "SELECT pg_get_indexdef(indexrelid) FROM pg_index WHERE indrelid = %s::regclass AND NOT indisprimary",
            [table],
        )
        index_defs = [row[0] for row in cursor.fetchall()]
        cursor.execute(
            "SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid = %s::regclass AND contype = 'f'",
            [table],
        )
        foreign_keys = cursor.fetchall()
        cursor.execute(f'SELECT min(created_at) FROM "{table}"')
        oldest = cursor.fetchone()[0]

        old = f"{table}_old"
        cursor.execute(f'ALTER TABLE "{table}" RENAME TO "{old}"')
        cursor.execute(
            f'CREATE TABLE "{table}" (LIKE "{old}" INCLUDING DEFAULTS INCLUDING CONSTRAINTS INCLUDING IDENTITY) '
            "PARTITION BY RANGE (created_at)"
        )
        cursor.execute(f'CREATE TABLE "{table}_default" PARTITION OF "{table}" DEFAULT')
        now = month_start(timezone.now())
        month = month_start(oldest) if oldest else now
        while month <= add_months(now, MONTHS_AHEAD):
            ensure_month(cursor, table, month)
            month = add_months(month, 1)

        cursor.execute(f'INSERT INTO "{table}" OVERRIDING SYSTEM VALUE SELECT * FROM "{old}"')
        cursor.execute(
            f"SELECT setval(pg_get_serial_sequence('\"{table}\"', 'id'), coalesce(max(id), 0) + 1, false) FROM \"{table}\""
        )
        cursor.execute(f'DROP TABLE "{old}"')
        cursor.execute(f'ALTER TABLE "{table}" ADD CONSTRAINT "{table}_pkey" PRIMARY KEY (id, created_at)')
        for definition in index_defs:  # nomlar o'zgarmaydi — keyingi Django migratsiyalari ularni topadi
            cursor.execute(definition)
        for name, definition in foreign_keys:
            cursor.execute(f'ALTER TABLE "{table}" ADD CONSTRAINT "{name}" {definition}')


def monthly_partitioning(model_label):
    """Migratsiya uchun: `migrations.RunPython(monthly_partitioning("chat.ChatMessage"), migrations.RunPython.noop)`."""

    def forwards(migration_apps, schema_editor):
        table = migration_apps.get_model(model_label)._meta.db_table
        convert_to_monthly(schema_editor, table)

    return forwards

"""
Export every row of all seven SQLite service databases to a single JSON file.

Part of the SQLite -> SQL Server migration. Run this BEFORE the services are
rebuilt against the SqlServer provider; the resulting JSON is the only copy of
the demo data once the new (empty) SQL Server schemas are created.

Values are preserved as SQLite returned them rather than being coerced:

  * Guid    - EF Core stores these as TEXT in SQLite, and SQL Server accepts the
              same canonical 8-4-4-4-12 string for uniqueidentifier, so the text
              round-trips exactly.
  * decimal - EF Core also stores these as TEXT in SQLite specifically to avoid
              float rounding. Keeping the string (never float()) is what stops
              a bill's 113000.00 turning into 112999.99999999999.
  * BLOB    - base64-encoded and tagged, since raw bytes are not JSON-safe.

__EFMigrationsHistory is deliberately skipped: the SQL Server migrations are
regenerated from scratch and will write their own history rows.
"""

import base64
import json
import os
import sqlite3
import sys
from datetime import datetime

BACKEND = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
    "src", "Backend", "Services",
)

DATABASES = {
    "IdentityService":   "IdentityDb.sqlite",
    "VendorService":     "VendorDb.sqlite",
    "TenderService":     "TenderServiceDb.sqlite",
    "ExecutionService":  "ExecutionServiceDb.sqlite",
    "InspectionService": "InspectionServiceDb.sqlite",
    "FinancialService":  "FinancialServiceDb.sqlite",
    "CommonService":     "CommonServiceDb.sqlite",
}

SKIP_TABLES = {"__EFMigrationsHistory", "sqlite_sequence"}


def encode(value):
    """JSON-safe representation that keeps enough type information to restore."""
    if isinstance(value, bytes):
        return {"__blob__": base64.b64encode(value).decode("ascii")}
    return value


def export_database(service, path):
    if not os.path.exists(path):
        raise FileNotFoundError(path)

    # read-only URI so a running service can never be disturbed by this export
    conn = sqlite3.connect(f"file:{path}?mode=ro", uri=True)
    conn.row_factory = sqlite3.Row
    try:
        tables = [
            r[0] for r in conn.execute(
                "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
            )
            if r[0] not in SKIP_TABLES and not r[0].startswith("sqlite_")
        ]

        out = {}
        for table in tables:
            cols = [
                {"name": c["name"], "type": c["type"], "pk": bool(c["pk"])}
                for c in conn.execute(f'PRAGMA table_info("{table}")')
            ]
            rows = [
                {k: encode(r[k]) for k in r.keys()}
                for r in conn.execute(f'SELECT * FROM "{table}"')
            ]
            out[table] = {"columns": cols, "rows": rows}
        return out
    finally:
        conn.close()


def main():
    dest = os.path.join(os.path.dirname(os.path.abspath(__file__)), "sqlite-export.json")

    bundle = {
        "exportedAt": datetime.now().isoformat(timespec="seconds"),
        "source": "sqlite",
        "databases": {},
    }

    total_rows = 0
    for service, filename in DATABASES.items():
        path = os.path.join(BACKEND, service, filename)
        data = export_database(service, path)
        bundle["databases"][service] = data

        rows = sum(len(t["rows"]) for t in data.values())
        total_rows += rows
        populated = [f'{n}={len(t["rows"])}' for n, t in sorted(data.items()) if t["rows"]]
        print(f"{service:<20} {len(data):>2} tables, {rows:>4} rows")
        for chunk in populated:
            print(f"                       {chunk}")

    with open(dest, "w", encoding="utf-8") as fh:
        json.dump(bundle, fh, indent=1, ensure_ascii=False)

    size_kb = os.path.getsize(dest) / 1024
    print(f"\n{total_rows} rows across {len(DATABASES)} databases")
    print(f"written to {dest} ({size_kb:.1f} KB)")


if __name__ == "__main__":
    sys.exit(main())

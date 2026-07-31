"""
Strip test residue out of sqlite-export.json before it is loaded into SQL Server.

Roughly a quarter of the exported rows came from E2E harnesses and manual
validation runs rather than the demo seed - including a bill for
Rs 99,999,999,999 that only existed to prove the amount validator rejects it.

Two rules govern what goes:

  * a row is dropped if it carries an explicit test marker (see JUNK), and
  * a row is dropped if a row it points at was dropped by the rule above.

The second rule is applied to a fixed point so nothing dangles, and it fires
only when the parent was *deliberately* dropped. A foreign key that was already
pointing at nothing in the source data is left exactly as it was: that is
pre-existing state to look at separately, not something this script should
quietly delete.

The reference graph comes from TWO sources, and the distinction matters:

  1. REAL foreign keys, parsed out of sql-raw/<Service>.schema.sql - the actual
     DDL EF generates. These are enforced by SQL Server, so violating one makes
     the INSERT fail outright. This half of the graph is *derived*, never typed
     by hand: an earlier version of this script used a hand-written list and it
     was wrong in three separate ways (a missed TenderAllotments -> Tenders edge
     that failed on import, and a Projects.TenderId edge that silently did
     nothing because Projects has no such column).

  2. LOGICAL cross-service references, listed below. Each service owns its own
     database, so these cannot be FKs and SQL Server will never complain about
     them - but a bill pointing at a work order that no longer exists is still
     broken data, so they are cascaded and checked the same way.

Duplicate demo data (seed:demo having been run three times) is deliberately NOT
touched - picking which of three identical copies survives is a judgement call
that belongs to a human.
"""

import json
import os
import re

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, "sqlite-export.json")
DST = os.path.join(HERE, "sqlite-export.filtered.json")
RAW = os.path.join(HERE, "sql-raw")

SERVICES = [
    "IdentityService", "VendorService", "TenderService", "ExecutionService",
    "InspectionService", "FinancialService", "CommonService",
]


def s(v):
    return v if isinstance(v, str) else ""


# --- rule 1: explicit test markers -------------------------------------------------
JUNK = {
    ("TenderService", "Tenders"):
        lambda r: s(r.get("TenderNo")).startswith("E2E-"),
    ("TenderService", "WorkOrders"):
        lambda r: s(r.get("WorkOrderNo")).startswith(("E2E-", "VAL-TEST", "WO-CANCEL-TEST")),
    ("TenderService", "Projects"):
        lambda r: s(r.get("Name")).startswith("Project for WO E2E-"),
    ("FinancialService", "Bills"):
        lambda r: (s(r.get("BillNo")).startswith("VAL-TEST")
                   or s(r.get("RejectionReason")) == "Invalid test record - validation audit"),
    ("IdentityService", "Users"):
        lambda r: s(r.get("Name")).startswith("ZZ TEST USER"),
    ("CommonService", "ContractDocuments"):
        lambda r: s(r.get("Name")) == "browser-test.txt",
    ("CommonService", "AuditLogs"):
        lambda r: any(m in s(r.get("ChangesInfo"))
                      for m in ("E2E", "VAL-TEST", "WO-CANCEL-TEST", "Invalid test record")),
}

# --- rule 2b: cross-service references (real, but not DB-enforceable) --------------
# (child_service, child_table, fk_column, parent_service, parent_table)
LOGICAL_REFS = [
    ("ExecutionService",  "Milestones",           "WorkOrderId", "TenderService",    "WorkOrders"),
    ("ExecutionService",  "Milestones",           "ProjectId",   "TenderService",    "Projects"),
    ("ExecutionService",  "MilestoneSubmissions", "ProjectId",   "TenderService",    "Projects"),
    ("ExecutionService",  "ProgressReports",      "ProjectId",   "TenderService",    "Projects"),
    ("FinancialService",  "Bills",                "WorkOrderId", "TenderService",    "WorkOrders"),
    ("InspectionService", "InspectionVisits",     "WorkOrderId", "TenderService",    "WorkOrders"),
    ("InspectionService", "Inspections",          "ProjectId",   "TenderService",    "Projects"),
]

CREATE_TABLE_RE = re.compile(r'CREATE TABLE \[(\w+)\] \(\s*(.*?)\n\s*\);', re.DOTALL)
FK_RE = re.compile(
    r'CONSTRAINT \[\w+\] FOREIGN KEY \(\[(?P<col>\w+)\]\)\s*REFERENCES \[(?P<parent>\w+)\]')


def schema_fks():
    """The real, SQL-Server-enforced FK edges, parsed from the generated DDL."""
    edges = []
    for svc in SERVICES:
        path = os.path.join(RAW, f"{svc}.schema.sql")
        if not os.path.exists(path):
            raise SystemExit(
                f"missing {path}\n"
                "Run the schema generation step first (see README.md) - this script "
                "derives the FK graph from it rather than hard-coding one.")
        text = open(path, encoding="utf-8-sig").read()
        for m in CREATE_TABLE_RE.finditer(text):
            table, body = m.group(1), m.group(2)
            for fk in FK_RE.finditer(body):
                edges.append((svc, table, fk.group("col"), svc, fk.group("parent")))
    return edges


def gid(v):
    """GUIDs come out of SQLite upper-cased; compare case-insensitively."""
    return s(v).upper()


def main():
    bundle = json.load(open(SRC, encoding="utf-8"))
    dbs = bundle["databases"]

    hard = schema_fks()
    refs = hard + LOGICAL_REFS
    print(f"reference graph: {len(hard)} real FK edge(s) parsed from schema "
          f"+ {len(LOGICAL_REFS)} cross-service logical edge(s)\n")

    dropped = {}
    reasons = {}

    for (svc, table), pred in JUNK.items():
        rows = dbs.get(svc, {}).get(table, {}).get("rows", [])
        hits = [r for r in rows if pred(r)]
        if hits:
            dropped[(svc, table)] = {gid(r.get("Id")) for r in hits}
            reasons[(svc, table)] = ("test marker", len(hits))

    # fixed point over the reference graph
    while True:
        grew = False
        for csvc, ctable, fk, psvc, ptable in refs:
            parent_dropped = dropped.get((psvc, ptable))
            if not parent_dropped:
                continue
            rows = dbs.get(csvc, {}).get(ctable, {}).get("rows", [])
            already = dropped.setdefault((csvc, ctable), set())
            new = {gid(r.get("Id")) for r in rows
                   if gid(r.get(fk)) in parent_dropped and gid(r.get("Id")) not in already}
            if new:
                already |= new
                prev = reasons.get((csvc, ctable), ("", 0))
                label = prev[0] if prev[0] == "test marker" else f"orphan via {fk}"
                reasons[(csvc, ctable)] = (label, prev[1] + len(new))
                grew = True
        if not grew:
            break

    print("=== dropped ===")
    total_before = total_after = 0
    for svc, tables in dbs.items():
        for table, t in tables.items():
            before = len(t["rows"])
            total_before += before
            drop_ids = dropped.get((svc, table), set())
            if drop_ids:
                t["rows"] = [r for r in t["rows"] if gid(r.get("Id")) not in drop_ids]
                why = reasons.get((svc, table), ("", 0))[0]
                print(f"  {svc}.{table:<22} -{before - len(t['rows']):<3} ({why})")
            total_after += len(t["rows"])

    # The one department is genuinely "Public Works (PWD)"; only its description
    # was scribbled on by a test run. Keep the row, clear the marker.
    for r in dbs["IdentityService"]["Departments"]["rows"]:
        if s(r.get("Description")) == "E2E":
            r["Description"] = ""
            print("  IdentityService.Departments  kept 'Public Works (PWD)', cleared E2E description")

    bundle["filtered"] = True
    with open(DST, "w", encoding="utf-8") as fh:
        json.dump(bundle, fh, indent=1, ensure_ascii=False)

    print(f"\n{total_before} rows -> {total_after} kept ({total_before - total_after} dropped)")
    print(f"written to {DST}")

    # --- integrity check on what survived -----------------------------------------
    print("\n=== dangling references among kept rows ===")
    blocking = pre_existing = 0
    for csvc, ctable, fk, psvc, ptable in refs:
        enforced = (csvc, ctable) in {(e[0], e[1]) for e in hard} and \
                   any(e[2] == fk and e[4] == ptable for e in hard if e[1] == ctable)
        kept_parent = {gid(r.get("Id")) for r in dbs.get(psvc, {}).get(ptable, {}).get("rows", [])}
        for r in dbs.get(csvc, {}).get(ctable, {}).get("rows", []):
            v = gid(r.get(fk))
            if v and v not in kept_parent:
                kind = "WILL FAIL IMPORT (real FK)" if enforced else "cross-service, not DB-enforced"
                print(f"  {csvc}.{ctable}.{fk} -> missing {ptable} {v}  [{kind}]")
                if enforced:
                    blocking += 1
                else:
                    pre_existing += 1

    if blocking:
        raise SystemExit(
            f"\n{blocking} dangling reference(s) on REAL foreign keys - the import would fail. "
            "Fix the filter rules before generating the SQL script.")
    print(f"  {blocking} blocking, {pre_existing} non-blocking"
          + ("  <- safe to import" if not blocking else ""))


if __name__ == "__main__":
    main()

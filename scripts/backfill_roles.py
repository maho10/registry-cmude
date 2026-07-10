"""
One-off backfill: set `role` on already-imported participants by matching
name against the roster xlsx (role column wasn't captured in the original
import). Safe to re-run.

Usage:
    python scripts/backfill_roles.py path/to/roster.xlsx [--sheet "Base de datos"] [--dry-run]
"""

import argparse
import os
from pathlib import Path

import httpx
import openpyxl
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent / "backend" / ".env")

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_SERVICE_KEY = os.environ["SUPABASE_SERVICE_KEY"]


def load_roles(path: str, sheet: str) -> dict[str, str]:
    wb = openpyxl.load_workbook(path, data_only=True)
    ws = wb[sheet]
    roles = {}
    for row in ws.iter_rows(min_row=2, values_only=True):
        name, role_raw = (list(row) + [None] * 2)[:2]
        if not name or not str(name).strip() or not role_raw:
            continue
        roles[str(name).strip()] = str(role_raw).strip()
    return roles


def main():
    parser = argparse.ArgumentParser(description="Backfill participants.role from the roster")
    parser.add_argument("xlsx_path")
    parser.add_argument("--sheet", default="Base de datos")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    roles = load_roles(args.xlsx_path, args.sheet)
    print(f"Parsed {len(roles)} name->role pairs from roster")

    headers = {
        "apikey": SUPABASE_SERVICE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=minimal",
    }

    with httpx.Client(timeout=30) as client:
        resp = client.get(f"{SUPABASE_URL}/rest/v1/participants?select=id,name,role", headers=headers)
        resp.raise_for_status()
        db_participants = resp.json()

        matched, unmatched, updated = 0, [], 0
        for p in db_participants:
            role = roles.get(p["name"])
            if role is None:
                unmatched.append(p["name"])
                continue
            matched += 1
            if p["role"] == role:
                continue
            if not args.dry_run:
                r = client.patch(
                    f"{SUPABASE_URL}/rest/v1/participants?id=eq.{p['id']}",
                    headers=headers,
                    json={"role": role},
                )
                r.raise_for_status()
            updated += 1

    print(f"Matched {matched}/{len(db_participants)} DB participants to a roster role")
    if unmatched:
        print(f"Unmatched ({len(unmatched)}): {unmatched}")
    print(f"{'Would update' if args.dry_run else 'Updated'} {updated} rows")


if __name__ == "__main__":
    main()

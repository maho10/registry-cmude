"""
Import CMUDE participants from the organizers' Excel roster into Supabase.

Usage:
    pip install -r scripts/requirements.txt
    python scripts/import_participants.py path/to/roster.xlsx [--sheet "Base de datos"] [--dry-run] [--force]

Environment variables (or backend/.env):
    SUPABASE_URL
    SUPABASE_SERVICE_KEY
"""

import argparse
import os
import sys
from pathlib import Path

import httpx
import openpyxl
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent / "backend" / ".env")

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_SERVICE_KEY = os.environ["SUPABASE_SERVICE_KEY"]

BATCH_SIZE = 100

# Roster uses tournament-role package labels; all map onto the two
# lunch-tracking package types.
PACKAGE_MAP = {
    "completa": "full",
    "parcial": "partial",
    "org": "full",
    "ea": "full",
    "ias": "full",
}

# V=Vegetariano, VEG=Vegano, Alr=Alergia, L=Intolerancia a lactosa
DIET_MAP = {
    "v": "vegetarian",
    "veg": "vegan",
    "alr": "allergy",
    "l": "lactose-intolerant",
}


def load_rows(path: str, sheet: str) -> tuple[list[dict], list[str]]:
    wb = openpyxl.load_workbook(path, data_only=True)
    ws = wb[sheet]
    rows = []
    errors = []

    for i, row in enumerate(ws.iter_rows(min_row=2, values_only=True), start=2):
        name, role_raw, package_type_raw, diet_raw, room_raw, minor_raw = (list(row) + [None] * 6)[:6]
        if not name or not str(name).strip():
            continue  # blank rows / stray notes (e.g. a legend left in the diet column)

        name = str(name).strip()

        pkg_key = str(package_type_raw).strip().lower() if package_type_raw else ""
        package_type = PACKAGE_MAP.get(pkg_key)
        if package_type is None:
            errors.append(f"row {i} ({name}): unrecognized package_type '{package_type_raw}', skipped")
            continue

        diet_key = str(diet_raw).strip().lower() if diet_raw else ""
        if diet_key and diet_key not in DIET_MAP:
            errors.append(f"row {i} ({name}): unrecognized diet code '{diet_raw}', imported with no diet_type")
        diet_type = DIET_MAP.get(diet_key)

        room = str(room_raw).strip() if room_raw else None
        role = str(role_raw).strip() if role_raw else None

        rows.append({
            "name": name,
            "package_type": package_type,
            "diet_type": diet_type,
            "food_restrictions": None,
            "is_minor": bool(minor_raw),
            "room": room,
            "role": role,
        })

    return rows, errors


def existing_count() -> int:
    headers = {
        "apikey": SUPABASE_SERVICE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
        "Prefer": "count=exact",
    }
    resp = httpx.get(f"{SUPABASE_URL}/rest/v1/participants?select=id&limit=1", headers=headers, timeout=15)
    resp.raise_for_status()
    return int(resp.headers.get("content-range", "*/0").split("/")[-1])


def insert_batches(rows: list[dict]):
    headers = {
        "apikey": SUPABASE_SERVICE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=minimal",
    }
    with httpx.Client(timeout=30) as client:
        for i in range(0, len(rows), BATCH_SIZE):
            batch = rows[i:i + BATCH_SIZE]
            resp = client.post(f"{SUPABASE_URL}/rest/v1/participants", headers=headers, json=batch)
            if resp.status_code not in (200, 201):
                raise RuntimeError(f"Batch {i + 1}-{i + len(batch)} failed: {resp.status_code} {resp.text}")
            print(f"Inserted rows {i + 1}-{i + len(batch)}")


def main():
    parser = argparse.ArgumentParser(description="Import CMUDE participants from Excel roster")
    parser.add_argument("xlsx_path", help="Path to the roster .xlsx file")
    parser.add_argument("--sheet", default="Base de datos", help="Worksheet name")
    parser.add_argument("--dry-run", action="store_true", help="Parse and validate only, don't insert")
    parser.add_argument("--force", action="store_true", help="Insert even if participants already exist in the DB")
    args = parser.parse_args()

    rows, errors = load_rows(args.xlsx_path, args.sheet)

    print(f"Parsed {len(rows)} participants, {len(errors)} warnings")
    for e in errors:
        print(f"  ! {e}")

    if not rows:
        print("Nothing to import.")
        sys.exit(1)

    if args.dry_run:
        print("Dry run — not inserting.")
        return

    existing = existing_count()
    if existing and not args.force:
        print(f"Refusing to import: {existing} participants already exist in the DB. "
              f"Pass --force to insert anyway (this will NOT dedupe).")
        sys.exit(1)

    insert_batches(rows)
    print(f"Done. Imported {len(rows)} participants.")


if __name__ == "__main__":
    main()

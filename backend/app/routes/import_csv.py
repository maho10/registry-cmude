import csv
import io
import os
import httpx
from fastapi import APIRouter, File, UploadFile, HTTPException, Header
from typing import Annotated

router = APIRouter()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

VALID_PACKAGE_TYPES = {"full", "partial"}
REQUIRED_COLUMNS = {"name", "package_type"}


def supabase_headers() -> dict:
    return {
        "apikey": SUPABASE_SERVICE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates",
    }


@router.post("/import")
async def import_participants(
    file: Annotated[UploadFile, File()],
    authorization: Annotated[str | None, Header()] = None,
):
    # Verify caller is an authenticated admin via their Supabase JWT
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing authorization token")

    token = authorization.removeprefix("Bearer ")
    async with httpx.AsyncClient() as client:
        verify = await client.get(
            f"{SUPABASE_URL}/auth/v1/user",
            headers={"apikey": SUPABASE_SERVICE_KEY, "Authorization": f"Bearer {token}"},
        )
    if verify.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    content = await file.read()
    text = content.decode("utf-8-sig")  # strip BOM if present
    reader = csv.DictReader(io.StringIO(text))

    if reader.fieldnames is None:
        raise HTTPException(status_code=400, detail="Empty or invalid CSV")

    columns = {c.strip().lower() for c in reader.fieldnames}
    missing = REQUIRED_COLUMNS - columns
    if missing:
        raise HTTPException(status_code=400, detail=f"CSV missing columns: {missing}")

    rows = []
    errors = []

    for i, row in enumerate(reader, start=2):  # row 1 is header
        name = row.get("name", "").strip()
        package_type = row.get("package_type", "").strip().lower()
        diet_type = row.get("diet_type", "").strip() or None
        food_restrictions = row.get("food_restrictions", "").strip() or None

        if not name:
            errors.append({"row": i, "reason": "name is empty"})
            continue
        if package_type not in VALID_PACKAGE_TYPES:
            errors.append({"row": i, "reason": f"package_type must be 'full' or 'partial', got '{package_type}'"})
            continue

        rows.append({
            "name": name,
            "package_type": package_type,
            "diet_type": diet_type,
            "food_restrictions": food_restrictions,
        })

    if not rows:
        return {"imported": 0, "skipped": len(errors), "errors": errors}

    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"{SUPABASE_URL}/rest/v1/participants",
            headers=supabase_headers(),
            json=rows,
        )

    if resp.status_code not in (200, 201):
        raise HTTPException(status_code=500, detail=f"Supabase insert failed: {resp.text}")

    return {"imported": len(rows), "skipped": len(errors), "errors": errors}

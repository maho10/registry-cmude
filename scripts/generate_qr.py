"""
Generate a printable PDF of QR codes for all CMUDE participants.

Usage:
    pip install qrcode[pil] pillow reportlab httpx python-dotenv
    python scripts/generate_qr.py --output qr_codes.pdf

Environment variables (or backend/.env):
    SUPABASE_URL
    SUPABASE_SERVICE_KEY
    FRONTEND_URL   (optional, defaults to http://localhost:3000)
"""

import argparse
import os
import io
import sys
from pathlib import Path

import httpx
import qrcode
from PIL import Image, ImageDraw, ImageFont
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent / "backend" / ".env")

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_SERVICE_KEY = os.environ["SUPABASE_SERVICE_KEY"]
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")

# ── Diet → QR border color map ────────────────────────────────────────────────
# Fill in once the organizers finalize dietary restriction categories.
# Keys must match the diet_type values in the database (lowercase).
DIET_COLORS: dict[str, tuple[int, int, int]] = {
    "none":               (100, 100, 100),   # grey
    "vegetarian":         (34,  139, 34),    # green
    "vegan":              (0,   100, 0),     # dark green
    "allergy":            (200, 50,  50),    # red
    "lactose-intolerant": (218, 165, 32),    # goldenrod
}
DEFAULT_COLOR = (130, 0, 200)  # purple for unknown types

# ── Layout constants (pixels at 150 dpi) ─────────────────────────────────────
QR_SIZE = 300       # QR module size
BORDER = 20         # colored border width
LABEL_H = 60        # height of name + diet label below QR
CARD_W = QR_SIZE + BORDER * 2
CARD_H = QR_SIZE + BORDER * 2 + LABEL_H
CARDS_PER_ROW = 2
CARDS_PER_COL = 3
CARDS_PER_PAGE = CARDS_PER_ROW * CARDS_PER_COL


def fetch_participants() -> list[dict]:
    headers = {
        "apikey": SUPABASE_SERVICE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
    }
    resp = httpx.get(
        f"{SUPABASE_URL}/rest/v1/participants?select=id,name,diet_type,package_type&order=name",
        headers=headers,
        timeout=30,
    )
    resp.raise_for_status()
    return resp.json()


def make_qr_image(participant: dict) -> Image.Image:
    url = f"{FRONTEND_URL}/p/{participant['id']}"
    diet = (participant.get("diet_type") or "none").lower()
    color = DIET_COLORS.get(diet, DEFAULT_COLOR)

    qr = qrcode.QRCode(
        version=None,
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=8,
        border=2,
    )
    qr.add_data(url)
    qr.make(fit=True)
    qr_img = qr.make_image(fill_color="black", back_color="white").convert("RGB")
    qr_img = qr_img.resize((QR_SIZE, QR_SIZE), Image.LANCZOS)

    # Colored border card
    card = Image.new("RGB", (CARD_W, CARD_H), color)
    card.paste(qr_img, (BORDER, BORDER))

    # White label area
    label_area = Image.new("RGB", (CARD_W, LABEL_H), (255, 255, 255))
    draw = ImageDraw.Draw(label_area)

    name = participant["name"]
    pkg = "Completo" if participant.get("package_type") == "full" else "Parcial"
    diet_label = diet.capitalize()

    try:
        font_name = ImageFont.truetype("arial.ttf", 16)
        font_meta = ImageFont.truetype("arial.ttf", 12)
    except OSError:
        font_name = ImageFont.load_default()
        font_meta = font_name

    draw.text((10, 8), name[:30], font=font_name, fill=(0, 0, 0))
    draw.text((10, 32), f"{pkg} · {diet_label}", font=font_meta, fill=(80, 80, 80))

    card.paste(label_area, (0, BORDER * 2 + QR_SIZE))
    return card


def generate_pdf(participants: list[dict], output_path: str):
    page_w, page_h = A4
    margin = 30
    spacing = 10
    cell_w = (page_w - 2 * margin - spacing) / CARDS_PER_ROW
    cell_h = (page_h - 2 * margin - spacing * (CARDS_PER_COL - 1)) / CARDS_PER_COL

    c = canvas.Canvas(output_path, pagesize=A4)

    for page_start in range(0, len(participants), CARDS_PER_PAGE):
        page_batch = participants[page_start: page_start + CARDS_PER_PAGE]

        for idx, participant in enumerate(page_batch):
            row = idx // CARDS_PER_ROW
            col = idx % CARDS_PER_ROW

            x = margin + col * (cell_w + spacing)
            y = page_h - margin - (row + 1) * cell_h - row * spacing

            img = make_qr_image(participant)

            # Convert PIL image to reportlab-compatible bytes
            buf = io.BytesIO()
            img.save(buf, format="PNG")
            buf.seek(0)

            draw_w = min(cell_w - 5, CARD_W)
            draw_h = draw_w * (CARD_H / CARD_W)
            c.drawImage(
                buf,  # type: ignore[arg-type]
                x, y,
                width=draw_w,
                height=draw_h,
                preserveAspectRatio=True,
            )

        c.showPage()

    c.save()
    print(f"Saved {len(participants)} QR codes to {output_path}")


def main():
    parser = argparse.ArgumentParser(description="Generate CMUDE QR code PDF")
    parser.add_argument("--output", default="qr_codes.pdf", help="Output PDF path")
    args = parser.parse_args()

    print("Fetching participants from Supabase…")
    participants = fetch_participants()
    print(f"Found {len(participants)} participants")

    if not participants:
        print("No participants found. Import your CSV first.")
        sys.exit(1)

    generate_pdf(participants, args.output)


if __name__ == "__main__":
    main()

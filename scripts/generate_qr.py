"""
Generate a printable PDF of QR codes for all CMUDE participants.

Usage:
    pip install qrcode[pil] pillow reportlab svglib httpx python-dotenv
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
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas
from svglib.svglib import svg2rlg
from reportlab.graphics import renderPM
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent / "backend" / ".env")

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_SERVICE_KEY = os.environ["SUPABASE_SERVICE_KEY"]
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")

LOGO_SVG_PATH = Path(__file__).parent.parent / "frontend" / "src" / "assets" / "cmude-logo.svg"

# ── Diet → color map ──────────────────────────────────────────────────────────
# Mirrors DIET_HEX_COLORS in frontend/src/lib/supabase.ts — keep both in sync.
# Keys must match the diet_type values in the database (lowercase).
DIET_COLORS: dict[str, tuple[int, int, int]] = {
    "none":               (124, 58, 237),   # purple-600
    "vegetarian":         (22,  163, 74),    # green-600
    "vegan":              (5,   150, 105),   # emerald-600
    "lactose-intolerant": (202, 138, 4),     # yellow-600
    "allergy":            (220, 38,  38),    # red-600
}
DEFAULT_COLOR = (107, 114, 128)  # gray-500, unknown diet types

# ── Layout constants (pixels at 150 dpi) ─────────────────────────────────────
QR_SIZE = 300       # QR module size
BORDER = 20         # colored border width
LABEL_H = 60        # height of name + diet label below QR
LOGO_SIZE = 64       # tinted logo embedded at the QR's center
LOGO_HALO = LOGO_SIZE + 16  # white backing square so the logo stays legible over QR modules
CARD_W = QR_SIZE + BORDER * 2
CARD_H = QR_SIZE + BORDER * 2 + LABEL_H
CARDS_PER_ROW = 2
CARDS_PER_COL = 3
CARDS_PER_PAGE = CARDS_PER_ROW * CARDS_PER_COL

_logo_cache: dict[tuple[int, int, int], Image.Image] = {}


def tinted_logo(color: tuple[int, int, int], size: int = LOGO_SIZE) -> Image.Image:
    """Rasterizes the CMUDE logo and recolors it to `color`, ignoring its own fill.

    Uses the logo's shape (via luminance) as an alpha mask, so any solid-fill
    source SVG can be tinted to match the QR's diet color — same technique as
    the CSS mask-image used for this logo in the admin frontend.
    """
    cache_key = (*color, size)
    if cache_key in _logo_cache:
        return _logo_cache[cache_key]

    drawing = svg2rlg(str(LOGO_SVG_PATH))
    scale = size / max(drawing.width, drawing.height)
    drawing.width *= scale
    drawing.height *= scale
    drawing.scale(scale, scale)

    buf = io.BytesIO()
    renderPM.drawToFile(drawing, buf, fmt="PNG", bg=0xFFFFFF)
    buf.seek(0)
    raster = Image.open(buf).convert("L")
    alpha = raster.point(lambda p: 255 - p)  # dark shape -> opaque

    tinted = Image.new("RGBA", raster.size, color + (0,))
    tinted.putalpha(alpha)
    _logo_cache[cache_key] = tinted
    return tinted


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
        error_correction=qrcode.constants.ERROR_CORRECT_H,  # high redundancy — needed since the logo covers the center
        box_size=8,
        border=2,
    )
    qr.add_data(url)
    qr.make(fit=True)
    qr_img = qr.make_image(fill_color="black", back_color="white").convert("RGB")
    qr_img = qr_img.resize((QR_SIZE, QR_SIZE), Image.LANCZOS)

    # Embed the tinted logo at the QR's center, over a white halo so it stays
    # legible against the modules behind it (mirrors the frontend's excavate behavior).
    halo = Image.new("RGB", (LOGO_HALO, LOGO_HALO), (255, 255, 255))
    halo_pos = ((QR_SIZE - LOGO_HALO) // 2, (QR_SIZE - LOGO_HALO) // 2)
    qr_img.paste(halo, halo_pos)
    logo = tinted_logo(color)
    logo_pos = ((QR_SIZE - LOGO_SIZE) // 2, (QR_SIZE - LOGO_SIZE) // 2)
    qr_img.paste(logo, logo_pos, logo)

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

            # Scale to fit within the cell on both axes, keeping the card's aspect ratio
            scale = min((cell_w - 5) / CARD_W, (cell_h - 5) / CARD_H)
            draw_w = CARD_W * scale
            draw_h = CARD_H * scale
            c.drawImage(
                ImageReader(buf),
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

# /// script
# requires-python = ">=3.10"
# dependencies = ["qrcode[pil]==8.2"]
# ///
"""Regenerate the QR and UTF-8 vCard: uv run scripts/build/business-card.py."""
from pathlib import Path

import qrcode
import qrcode.image.svg

TARGET = "https://metahumotonic.com/card/ra/"
DEST = Path(__file__).resolve().parents[2] / "public/card/ra"
DEST.mkdir(parents=True, exist_ok=True)
qr = qrcode.QRCode(error_correction=qrcode.constants.ERROR_CORRECT_M, box_size=20, border=4)
qr.add_data(TARGET)
qr.make(fit=True)
qr.make_image(fill_color="black", back_color="white").save(DEST / "qr.png")
qr.make_image(image_factory=qrcode.image.svg.SvgPathFillImage).save(DEST / "qr.svg")
lines = [
    "BEGIN:VCARD", "VERSION:3.0", "N:라;경준;;;", "FN:라경준",
    "ORG:메타휴모토닉", "TITLE:대표이사", "URL:https://metahumotonic.com/",
    f"NOTE:디지털 명함 {TARGET}", "END:VCARD", "",
]
(DEST / "contact.vcf").write_bytes("\r\n".join(lines).encode("utf-8"))
for name in ("qr.png", "qr.svg", "contact.vcf"):
    (DEST / name).chmod(0o644)
print(f"Generated QR ({len(qr.get_matrix())} modules) and vCard for {TARGET}")

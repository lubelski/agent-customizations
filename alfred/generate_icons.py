# /// script
# requires-python = ">=3.10"
# dependencies = ["pillow==12.3.0"]
# ///
"""Regenerate committed Alfred icons: uv run --no-project alfred/generate_icons.py."""
from pathlib import Path
import argparse
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent


def generate(font_path):
    destination = ROOT / "icons"
    destination.mkdir(exist_ok=True)
    scale = 3
    for agent, label, accent in (
        ("pi", "Pi", "#40D9CE"),
        ("claude", "C", "#D97757"),
        ("opus", "O", "#D97757"),
        ("fable", "F", "#D97757"),
    ):
        image = Image.new("RGBA", (512 * scale, 512 * scale))
        draw = ImageDraw.Draw(image)
        def box(coords):
            return tuple(value * scale for value in coords)
        draw.rounded_rectangle(box((16, 16, 496, 496)), radius=104 * scale,
                               fill="#111315", outline=accent, width=9 * scale)
        font = ImageFont.truetype(str(font_path), 272 * scale)
        bounds = draw.textbbox((0, 0), label, font=font)
        x = (512 * scale - (bounds[2] - bounds[0])) / 2 - bounds[0]
        y = (478 * scale - (bounds[3] - bounds[1])) / 2 - bounds[1]
        draw.text((x, y), label, font=font, fill="#FAF8F5")
        draw.rounded_rectangle(box((180, 413, 332, 431)), radius=9 * scale, fill=accent)
        image.resize((512, 512), Image.Resampling.LANCZOS).save(destination / f"{agent}-keyword.png")
    # Alfred's workflow-level fallback icon.
    (destination / "icon.png").write_bytes((destination / "pi-keyword.png").read_bytes())


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--font", type=Path,
                        default=Path("/System/Library/Fonts/Supplemental/Arial Bold.ttf"))
    generate(parser.parse_args().font)

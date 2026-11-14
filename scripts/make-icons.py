#!/usr/bin/env python3
"""Rasterize brand/draw-buddy-icon.svg into the PWA and favicon PNGs.

Run from the repo root:

    python3 scripts/make-icons.py

Requires Google Chrome or Chromium. The script opens the icon SVG in a
borderless page at each target size and saves a screenshot. The coin artwork
already sits inside the maskable safe zone, so icon-512.png and
icon-maskable-512.png are the same drawing. There is no Capacitor resources
directory in this repo, so a 1024 source is not written.
"""

import shutil
import subprocess
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ICON = ROOT / "brand" / "draw-buddy-icon.svg"
OUT = ROOT / "icons"
SIZES = {
    "favicon-32.png": 32,
    "apple-touch-icon.png": 180,
    "icon-192.png": 192,
    "icon-512.png": 512,
    "icon-maskable-512.png": 512,
}


def chrome_bin():
    candidates = [
        "/usr/bin/google-chrome",
        "/usr/bin/chromium",
        "/usr/bin/chromium-browser",
    ]
    for name in ("google-chrome-stable", "google-chrome", "chromium", "chromium-browser"):
        found = shutil.which(name)
        if found:
            candidates.append(found)
    seen = []
    for found in candidates:
        if not found or found in seen or not Path(found).exists():
            continue
        if Path(found).resolve() == Path("/usr/local/bin/google-chrome"):
            continue
        seen.append(found)
        probe = subprocess.run([found, "--version"], capture_output=True)
        if probe.returncode == 0:
            return found
    raise SystemExit("Google Chrome or Chromium is required to render the icon SVG.")


def render(chrome, svg, png, size):
    with tempfile.TemporaryDirectory() as tmp:
        folder = Path(tmp)
        html = folder / "icon.html"
        html.write_text(
            f"""<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
html, body {{ margin: 0; width: {size}px; height: {size}px; background: #0A0A12; overflow: hidden; }}
img {{ width: {size}px; height: {size}px; display: block; }}
</style></head>
<body><img src="{svg.as_uri()}" alt=""></body></html>
""",
            encoding="utf-8",
        )
        subprocess.run(
            [
                chrome,
                "--headless=new",
                "--disable-gpu",
                "--no-sandbox",
                "--hide-scrollbars",
                "--force-device-scale-factor=1",
                f"--window-size={size},{size}",
                f"--screenshot={png}",
                html.as_uri(),
            ],
            check=True,
            cwd=folder,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        # Headless Chrome writes the screenshot into the working directory
        # when the absolute path is ignored.
        fallback = folder / "screenshot.png"
        if not png.exists() and fallback.exists():
            fallback.replace(png)
        if not png.exists():
            raise SystemExit(f"Chrome did not write {png}")


def main():
    if not ICON.exists():
        raise SystemExit(f"Missing {ICON}")
    OUT.mkdir(parents=True, exist_ok=True)
    chrome = chrome_bin()
    for name, size in SIZES.items():
        render(chrome, ICON, OUT / name, size)
        print(f"Wrote {OUT / name} ({size}x{size})")


if __name__ == "__main__":
    main()

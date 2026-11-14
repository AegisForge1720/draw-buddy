#!/usr/bin/env python3
"""Placeholder launcher icons. Replace these before store submission."""

import struct
import zlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "icons"


def chunk(tag, data):
    return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)


def write_png(path, width, height, pixel_fn):
    raw = bytearray()
    for y in range(height):
        raw.append(0)
        for x in range(width):
            raw.extend(pixel_fn(x, y, width, height))
    png = b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0))
    png += chunk(b"IDAT", zlib.compress(bytes(raw), 9)) + chunk(b"IEND", b"")
    path.write_bytes(png)


def icon(padding):
    def pixel(x, y, width, height):
        nx = x / (width - 1)
        ny = y / (height - 1)
        bg = (11, 19, 43, 255)
        left, top, right, bottom = padding, 0.32, 1 - padding, 0.74
        if left <= nx <= right and top <= ny <= bottom:
            radius = 0.06
            dx = min(nx - left, right - nx)
            dy = min(ny - top, bottom - ny)
            if dx < radius and dy < radius:
                if (radius - dx) ** 2 + (radius - dy) ** 2 > radius ** 2:
                    return bg
            return (56, 189, 248, 255)
        return bg

    return pixel


def main():
    ROOT.mkdir(parents=True, exist_ok=True)
    write_png(ROOT / "icon-192.png", 192, 192, icon(0.22))
    write_png(ROOT / "icon-512.png", 512, 512, icon(0.22))
    write_png(ROOT / "icon-maskable-512.png", 512, 512, icon(0.30))
    print(f"Wrote placeholder icons in {ROOT}")


if __name__ == "__main__":
    main()

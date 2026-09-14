#!/usr/bin/env python3
"""Generate OG, poster, and compressed logo assets for the public site."""

from __future__ import annotations

import subprocess
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "public"
LOGO = PUBLIC / "logo.png"
ICON = PUBLIC / "logo-icon-with-effects.png"
HERO = ROOT / "assets" / "hero-source.mp4"
if not HERO.exists():
    HERO = PUBLIC / "hero.mp4"


def fit(img: Image.Image, box: tuple[int, int]) -> Image.Image:
    copy = img.convert("RGBA")
    copy.thumbnail(box, Image.Resampling.LANCZOS)
    return copy


def canvas(size: tuple[int, int], color: tuple[int, int, int]) -> Image.Image:
    return Image.new("RGB", size, color)


def save_jpeg(img: Image.Image, dest: Path, quality: int = 82) -> None:
    rgb = img.convert("RGB")
    rgb.save(dest, "JPEG", quality=quality, optimize=True, progressive=True)
    print(f"wrote {dest.name} ({dest.stat().st_size / 1024:.0f} KB)")


def save_png(img: Image.Image, dest: Path) -> None:
    img.save(dest, "PNG", optimize=True)
    print(f"wrote {dest.name} ({dest.stat().st_size / 1024:.0f} KB)")


def try_font(size: int) -> ImageFont.ImageFont:
    for path in (
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
        "/System/Library/Fonts/Supplemental/Arial.ttf",
        "/Library/Fonts/Arial.ttf",
    ):
        try:
            return ImageFont.truetype(path, size)
        except OSError:
            continue
    return ImageFont.load_default()


def make_og() -> None:
    img = canvas((1200, 630), (5, 5, 5))
    draw = ImageDraw.Draw(img)
    draw.rectangle((0, 560, 1200, 630), fill=(18, 18, 18))
    logo = fit(Image.open(LOGO), (520, 280))
    img.paste(logo, (72, 96), logo)
    title = try_font(36)
    sub = try_font(22)
    draw.text((72, 400), "Namão Criativa", fill=(242, 242, 242), font=title)
    draw.text(
        (72, 452),
        "Agência digital em Leme e região",
        fill=(140, 140, 140),
        font=sub,
    )
    draw.text(
        (72, 580),
        "marketing · software · chatbots · IA",
        fill=(180, 180, 180),
        font=try_font(18),
    )
    save_jpeg(img, PUBLIC / "og.jpg", quality=84)


def make_poster_fallback() -> None:
    img = canvas((1600, 900), (5, 5, 5))
    glow = Image.new("RGB", img.size, (5, 5, 5))
    gdraw = ImageDraw.Draw(glow)
    gdraw.ellipse((200, -80, 1400, 700), fill=(32, 32, 32))
    img = Image.blend(img, glow.filter(ImageFilter.GaussianBlur(80)), 0.65)
    logo = fit(Image.open(LOGO), (720, 400))
    x = (img.width - logo.width) // 2
    y = (img.height - logo.height) // 2 - 20
    img.paste(logo, (x, y), logo)
    save_jpeg(img, PUBLIC / "hero-poster.jpg", quality=78)


def extract_poster() -> None:
    dest = PUBLIC / "hero-poster.jpg"
    if not HERO.exists():
        make_poster_fallback()
        return
    try:
        subprocess.run(
            [
                "ffmpeg",
                "-y",
                "-ss",
                "2.4",
                "-i",
                str(HERO),
                "-frames:v",
                "1",
                "-vf",
                "scale=1600:-2",
                "-q:v",
                "4",
                str(dest),
            ],
            check=True,
            capture_output=True,
        )
        print(f"wrote {dest.name} ({dest.stat().st_size / 1024:.0f} KB)")
    except (subprocess.CalledProcessError, FileNotFoundError):
        make_poster_fallback()


def compress_hero() -> None:
    if not HERO.exists():
        return
    mp4 = PUBLIC / "hero-loop.mp4"
    webm = PUBLIC / "hero-loop.webm"
    vf = "scale='min(1280,iw)':-2"
    try:
        subprocess.run(
            [
                "ffmpeg",
                "-y",
                "-i",
                str(HERO),
                "-t",
                "8",
                "-an",
                "-vf",
                vf,
                "-c:v",
                "libx264",
                "-pix_fmt",
                "yuv420p",
                "-crf",
                "30",
                "-preset",
                "slow",
                "-movflags",
                "+faststart",
                str(mp4),
            ],
            check=True,
            capture_output=True,
        )
        print(f"wrote {mp4.name} ({mp4.stat().st_size / 1024:.0f} KB)")
        subprocess.run(
            [
                "ffmpeg",
                "-y",
                "-i",
                str(HERO),
                "-t",
                "8",
                "-an",
                "-vf",
                vf,
                "-c:v",
                "libvpx-vp9",
                "-b:v",
                "0",
                "-crf",
                "36",
                "-deadline",
                "good",
                str(webm),
            ],
            check=True,
            capture_output=True,
        )
        print(f"wrote {webm.name} ({webm.stat().st_size / 1024:.0f} KB)")
    except (subprocess.CalledProcessError, FileNotFoundError) as err:
        print(f"skip compressed hero: {err}")


def make_marks() -> None:
    icon = Image.open(ICON).convert("RGBA")
    footer = fit(icon, (220, 160))
    save_png(footer, PUBLIC / "logo-footer.png")
    mark = fit(Image.open(PUBLIC / "logo-icon.png").convert("RGBA"), (96, 96))
    save_png(mark, PUBLIC / "logo-mark.png")


def main() -> None:
    make_og()
    extract_poster()
    make_marks()
    compress_hero()


if __name__ == "__main__":
    main()

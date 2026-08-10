"""One-off icon generator for xcrop's installer/taskbar icon - not part of the app
runtime, just a build-time asset producer. Draws a simple leaf mark (the same green as
the suitability engine's own S1 "highly suitable" class color, see
orchestrator/app/suitability.py's _CLASS_THRESHOLDS / desktop/src/app.css's .class-S1) on
a dark rounded-square background matching the app's own sidebar color, so the icon reads
as "this app" rather than a generic placeholder.

Run once (`python build/generate_icon.py`) to (re)produce icon.ico / icon.png. Not
executed automatically by any build step - regenerate by hand if the mark ever changes.
"""

from pathlib import Path

from PIL import Image, ImageChops, ImageDraw

OUT_DIR = Path(__file__).parent
SIZE = 256
BG = (20, 24, 31, 255)  # matches desktop/src/app.css's .sidebar background
LEAF = (26, 152, 80, 255)  # matches .class-S1's green
LEAF_LIGHT = (145, 207, 96, 255)  # matches .class-S2's green, for a subtle vein highlight


def draw_leaf(size: int) -> Image.Image:
    # Supersample at 4x and downscale at the end - crisper edges on the rotated ellipses
    # than drawing straight at the target size.
    ss = 4
    s = size * ss
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    draw.rounded_rectangle([0, 0, s - 1, s - 1], radius=s * 0.22, fill=BG)

    # Vesica piscis: the *intersection* (not union) of two equal circles, each centered on
    # the other's edge, gives the classic pointed lens/leaf silhouette - built as two 1-bit
    # masks ANDed together, then that mask fills the leaf color.
    cx, cy = s * 0.5, s * 0.52
    r = s * 0.34
    # Circles offset along X give a lens pointed along Y (top/bottom) - the offset axis
    # becomes the lens's *wide* direction, tips form perpendicular to it.
    sep = r * 0.95
    mask_a = Image.new("L", (s, s), 0)
    ImageDraw.Draw(mask_a).ellipse([cx - sep / 2 - r, cy - r, cx - sep / 2 + r, cy + r], fill=255)
    mask_b = Image.new("L", (s, s), 0)
    ImageDraw.Draw(mask_b).ellipse([cx + sep / 2 - r, cy - r, cx + sep / 2 + r, cy + r], fill=255)
    lens_mask = ImageChops.darker(mask_a, mask_b)  # pixel-wise min - AND for binary 0/255 masks

    leaf_layer = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    ImageDraw.Draw(leaf_layer).rectangle([0, 0, s, s], fill=LEAF)
    leaf_layer.putalpha(lens_mask)
    img.alpha_composite(leaf_layer)

    # A single vein line down the leaf's spine.
    draw = ImageDraw.Draw(img)
    draw.line(
        [(cx, cy - r * 0.82), (cx, cy + r * 0.82)],
        fill=LEAF_LIGHT,
        width=max(2, int(s * 0.014)),
    )

    return img.resize((size, size), Image.LANCZOS)


def main() -> None:
    base = draw_leaf(SIZE)
    base.save(OUT_DIR / "icon.png")

    ico_sizes = [16, 24, 32, 48, 64, 128, 256]
    base.save(OUT_DIR / "icon.ico", sizes=[(s, s) for s in ico_sizes])
    print(f"Wrote {OUT_DIR / 'icon.png'} and {OUT_DIR / 'icon.ico'}")


if __name__ == "__main__":
    main()

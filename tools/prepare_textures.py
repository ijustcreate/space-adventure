from pathlib import Path

import numpy as np
from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
TEXTURES = ROOT / "public" / "textures"


def load_rgb(path: Path) -> np.ndarray:
    image = Image.open(path).convert("RGB")
    return np.asarray(image, dtype=np.float32) / 255.0


def save_gray(array: np.ndarray, path: Path) -> None:
    clipped = np.clip(array * 255.0, 0, 255).astype(np.uint8)
    Image.fromarray(clipped, mode="L").save(path)


def save_rgb(array: np.ndarray, path: Path) -> None:
    clipped = np.clip(array * 255.0, 0, 255).astype(np.uint8)
    Image.fromarray(clipped, mode="RGB").save(path)


def make_normal_map(height: np.ndarray, strength: float) -> np.ndarray:
    left = np.roll(height, 1, axis=1)
    right = np.roll(height, -1, axis=1)
    up = np.roll(height, 1, axis=0)
    down = np.roll(height, -1, axis=0)

    dx = (right - left) * strength
    dy = (down - up) * strength
    normal = np.dstack((-dx, -dy, np.ones_like(height)))
    normal /= np.linalg.norm(normal, axis=2, keepdims=True) + 1e-8
    return normal * 0.5 + 0.5


def prepare_earth() -> None:
    earth_rgb = load_rgb(TEXTURES / "earth_color_nasa.jpg")
    r = earth_rgb[:, :, 0]
    g = earth_rgb[:, :, 1]
    b = earth_rgb[:, :, 2]
    luminance = earth_rgb @ np.array([0.2126, 0.7152, 0.0722], dtype=np.float32)

    ocean_mask = (
        (b > g * 1.02)
        & (b > r * 1.05)
        & (b > 0.16)
    ).astype(np.float32)
    ocean_mask = np.clip(ocean_mask + np.maximum(0, (b - r) * 1.2), 0, 1)
    land_mask = 1.0 - ocean_mask

    mountains = np.clip((g - r) * 1.6 + luminance * 0.65, 0, 1)
    ocean_depth = np.clip(0.28 + (0.45 - luminance) * 0.55, 0, 1)

    height = 0.5 + land_mask * (mountains - 0.45) * 0.16 - ocean_mask * ocean_depth * 0.08
    height = np.clip(height, 0, 1)

    ocean_alpha = np.clip(ocean_mask * 0.95 + np.maximum(0, (b - g) * 1.8), 0, 1)
    normal = make_normal_map(height, strength=9.0)

    save_gray(height, TEXTURES / "earth_height_nasa.png")
    save_gray(ocean_alpha, TEXTURES / "earth_ocean_mask_nasa.png")
    save_rgb(normal, TEXTURES / "earth_normal_nasa.png")


def prepare_moon() -> None:
    moon_height_raw = np.asarray(Image.open(TEXTURES / "moon_height_nasa.tif"), dtype=np.float32)
    if moon_height_raw.ndim == 3:
        moon_height_raw = moon_height_raw[:, :, 0]

    moon_height_raw -= moon_height_raw.min()
    moon_height = moon_height_raw / max(moon_height_raw.max(), 1.0)
    moon_height = np.power(np.clip(moon_height, 0, 1), 1.08)
    moon_normal = make_normal_map(moon_height, strength=11.0)

    save_gray(moon_height, TEXTURES / "moon_height_nasa.png")
    save_rgb(moon_normal, TEXTURES / "moon_normal_nasa.png")


if __name__ == "__main__":
    prepare_earth()
    prepare_moon()

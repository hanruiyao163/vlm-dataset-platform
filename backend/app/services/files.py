from __future__ import annotations

import hashlib
from pathlib import Path

from PIL import Image as PILImage

from ..config import BASE_DIR


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def sha256_file(file_path: Path) -> str:
    hasher = hashlib.sha256()
    with file_path.open("rb") as file:
        for chunk in iter(lambda: file.read(1024 * 1024), b""):
            hasher.update(chunk)
    return hasher.hexdigest()


def get_image_dimensions(file_path: Path) -> tuple[int, int]:
    with PILImage.open(file_path) as image:
        return image.size


def resolve_image_path(stored_path: str) -> Path:
    candidate = Path(stored_path)
    if candidate.is_absolute():
        return candidate
    return BASE_DIR / candidate

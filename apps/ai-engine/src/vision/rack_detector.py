from __future__ import annotations

import io
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Any

try:
    from PIL import Image
except ImportError:  # pragma: no cover
    Image = None

try:
    from ultralytics import YOLO
except ImportError:  # pragma: no cover - optional vision extra
    YOLO = None


@dataclass
class RackDetection:
    box: tuple[int, int, int, int]
    confidence: float
    color_hex: str


@dataclass
class RackDetectionResult:
    detections: list[RackDetection]
    model_path: str
    confidence_threshold: float

    @property
    def spool_count(self) -> int:
        return len(self.detections)

    @property
    def confidence(self) -> float:
        if not self.detections:
            return 0
        return sum(detection.confidence for detection in self.detections) / len(self.detections)


_MODEL_CACHE: dict[str, Any] = {}


def default_model_path() -> Path:
    configured = os.getenv("RACK_VISION_MODEL_PATH")
    if configured:
        return Path(configured)
    return Path(__file__).resolve().parents[3] / "models" / "rack-spool-detector.pt"


def is_local_detector_available(model_path: Path | None = None) -> bool:
    path = model_path or default_model_path()
    return YOLO is not None and path.exists()


def _load_model(model_path: Path) -> Any:
    cache_key = str(model_path.resolve())
    if cache_key not in _MODEL_CACHE:
        if YOLO is None:
            raise RuntimeError("ultralytics non installe. Lance: pip install -e .[vision]")
        if not model_path.exists():
            raise RuntimeError(f"Modele rack introuvable: {model_path}")
        _MODEL_CACHE[cache_key] = YOLO(str(model_path))
    return _MODEL_CACHE[cache_key]


def _rgb_to_hex(rgb: tuple[int, int, int]) -> str:
    return f"#{rgb[0]:02x}{rgb[1]:02x}{rgb[2]:02x}"


def _is_filament_pixel(rgb: tuple[int, int, int]) -> bool:
    brightness = sum(rgb) / 3
    saturation = max(rgb) - min(rgb)
    if brightness < 24 or brightness > 248:
        return False
    if saturation > 24:
        return True
    return 86 <= brightness <= 235


def _dominant_box_color(image: Image.Image, box: tuple[int, int, int, int]) -> str:
    x1, y1, x2, y2 = box
    width = max(1, x2 - x1)
    height = max(1, y2 - y1)
    sample_x1 = x1 + int(width * 0.18)
    sample_x2 = x2 - int(width * 0.18)
    sample_y1 = y1 + int(height * 0.22)
    sample_y2 = y2 - int(height * 0.18)

    buckets: dict[tuple[int, int, int], int] = {}
    for y in range(max(y1, sample_y1), max(sample_y1 + 1, sample_y2), 3):
        for x in range(max(x1, sample_x1), max(sample_x1 + 1, sample_x2), 3):
            rgb = image.getpixel((x, y))
            if not _is_filament_pixel(rgb):
                continue
            bucket = tuple((channel // 16) * 16 for channel in rgb)
            buckets[bucket] = buckets.get(bucket, 0) + 1

    if not buckets:
        return "#cccccc"

    rgb = max(buckets.items(), key=lambda item: item[1])[0]
    return _rgb_to_hex((min(rgb[0] + 8, 255), min(rgb[1] + 8, 255), min(rgb[2] + 8, 255)))


def detect_rack_spools(
    image_bytes: bytes,
    *,
    model_path: Path | None = None,
    confidence_threshold: float | None = None,
) -> RackDetectionResult | None:
    if Image is None:
        raise RuntimeError("Pillow non installe.")

    path = model_path or default_model_path()
    if not is_local_detector_available(path):
        return None

    threshold = confidence_threshold
    if threshold is None:
        threshold = float(os.getenv("RACK_VISION_CONFIDENCE", "0.35"))

    image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    model = _load_model(path)
    results = model.predict(image, conf=threshold, verbose=False)
    if not results:
        return RackDetectionResult([], str(path), threshold)

    detections: list[RackDetection] = []
    boxes = getattr(results[0], "boxes", None)
    if boxes is None:
        return RackDetectionResult([], str(path), threshold)

    for box in boxes:
        confidence = float(box.conf[0]) if getattr(box, "conf", None) is not None else 0
        if confidence < threshold:
            continue
        xyxy = box.xyxy[0].tolist()
        x1, y1, x2, y2 = [int(round(value)) for value in xyxy]
        x1 = max(0, min(image.width - 1, x1))
        y1 = max(0, min(image.height - 1, y1))
        x2 = max(x1 + 1, min(image.width, x2))
        y2 = max(y1 + 1, min(image.height, y2))
        bounds = (x1, y1, x2, y2)
        detections.append(
            RackDetection(
                box=bounds,
                confidence=confidence,
                color_hex=_dominant_box_color(image, bounds),
            )
        )

    detections.sort(key=lambda detection: (detection.box[1], detection.box[0]))
    return RackDetectionResult(detections, str(path), threshold)

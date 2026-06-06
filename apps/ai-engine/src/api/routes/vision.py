from __future__ import annotations

import base64
import io
import json
import logging
import os
from collections import Counter
from typing import Literal

import httpx
from fastapi import APIRouter, File, Form, UploadFile
from pydantic import BaseModel, Field
try:
    from PIL import Image
except ImportError:  # pragma: no cover - optional local color fallback
    Image = None

from src.core.config import get_settings
from src.vision.rack_detector import detect_rack_spools


router = APIRouter(prefix="/vision", tags=["vision"])
logger = logging.getLogger("spooly_ai_engine.vision")


class RackColor(BaseModel):
    hex: str
    count: int | None = None
    confidence: float | None = None


class RackOcrResponse(BaseModel):
    status: Literal["needs_vision_model", "processed"]
    spoolCount: int | None = None
    colors: list[RackColor] = Field(default_factory=list)
    confidence: float = 0
    notes: str = ""
    image: dict
    debug: dict | None = None


def _rgb_to_hex(rgb: tuple[int, int, int]) -> str:
    return f"#{rgb[0]:02x}{rgb[1]:02x}{rgb[2]:02x}"


def _local_model_rack_ocr(image_bytes: bytes) -> dict | None:
    result = detect_rack_spools(image_bytes)
    if result is None:
        return None

    colors = [
        RackColor(hex=detection.color_hex, count=1, confidence=round(detection.confidence, 2))
        for detection in result.detections
    ]
    logger.info(
        "rack_ocr_local_model model=%s spool_count=%s confidence=%s boxes=%s colors=%s",
        result.model_path,
        result.spool_count,
        result.confidence,
        [detection.box for detection in result.detections],
        [color.hex for color in colors],
    )
    return {
        "status": "processed",
        "spoolCount": result.spool_count,
        "colors": colors,
        "confidence": round(result.confidence, 2),
        "notes": "Analyse par modele local entraine.",
        "debug": {
            "engine": "local_yolo",
            "modelPath": result.model_path,
            "confidenceThreshold": result.confidence_threshold,
            "boxes": [
                {
                    "box": detection.box,
                    "confidence": round(detection.confidence, 3),
                    "color": detection.color_hex,
                }
                for detection in result.detections
            ],
        },
    }


def _dominant_colors(image_bytes: bytes, max_colors: int = 8) -> list[RackColor]:
    if Image is None:
        return []

    image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    image.thumbnail((256, 256))

    pixels = list(image.getdata())
    quantized = [((r // 32) * 32, (g // 32) * 32, (b // 32) * 32) for r, g, b in pixels]
    total = max(1, len(quantized))

    colors: list[RackColor] = []
    for rgb, count in Counter(quantized).most_common(max_colors * 2):
        r, g, b = rgb
        brightness = (r + g + b) / 3
        saturation = max(rgb) - min(rgb)
        if brightness < 32 or brightness > 235 or saturation < 18:
            continue
        colors.append(
            RackColor(
                hex=_rgb_to_hex((min(r + 16, 255), min(g + 16, 255), min(b + 16, 255))),
                count=None,
                confidence=round(min(0.9, count / total * 6), 2),
            )
        )
        if len(colors) >= max_colors:
            break

    return colors


def _smooth(values: list[float], radius: int = 4) -> list[float]:
    if radius <= 0 or len(values) <= radius * 2:
        return values
    smoothed: list[float] = []
    for index in range(len(values)):
        start = max(0, index - radius)
        end = min(len(values), index + radius + 1)
        smoothed.append(sum(values[start:end]) / (end - start))
    return smoothed


def _segments_from_projection(
    projection: list[float],
    threshold: float,
    min_size: int,
    merge_gap: int = 8,
) -> list[tuple[int, int]]:
    segments: list[tuple[int, int]] = []
    start: int | None = None

    for index, value in enumerate(projection):
        if value >= threshold and start is None:
            start = index
        elif value < threshold and start is not None:
            if index - start >= min_size:
                segments.append((start, index))
            start = None

    if start is not None and len(projection) - start >= min_size:
        segments.append((start, len(projection)))

    merged: list[tuple[int, int]] = []
    for segment in segments:
        if merged and segment[0] - merged[-1][1] <= merge_gap:
            merged[-1] = (merged[-1][0], segment[1])
        else:
            merged.append(segment)
    return merged


def _split_large_row_if_needed(
    projection: list[float],
    row: tuple[int, int],
    image_height: int,
) -> list[tuple[int, int]]:
    y1, y2 = row
    row_height = y2 - y1
    if row_height < image_height * 0.55:
        return [row]

    inner_start = y1 + int(row_height * 0.25)
    inner_end = y2 - int(row_height * 0.25)
    if inner_end <= inner_start:
        return [row]

    valley_y = min(range(inner_start, inner_end), key=lambda y: projection[y])
    valley_value = projection[valley_y]
    peak_value = max(projection[y1:y2]) if y2 > y1 else 0

    if peak_value <= 0 or valley_value > peak_value * 0.45:
        return [row]

    top = (y1, max(y1, valley_y - 8))
    bottom = (min(y2, valley_y + 8), y2)
    return [segment for segment in (top, bottom) if segment[1] - segment[0] >= image_height // 12]


def _is_rack_content(rgb: tuple[int, int, int]) -> bool:
    r, g, b = rgb
    brightness = (r + g + b) / 3
    saturation = max(rgb) - min(rgb)
    return saturation > 28 or brightness < 210


def _is_dark(rgb: tuple[int, int, int]) -> bool:
    r, g, b = rgb
    return (r + g + b) / 3 < 85


def _is_spool_pixel(rgb: tuple[int, int, int]) -> bool:
    r, g, b = rgb
    brightness = (r + g + b) / 3
    saturation = max(rgb) - min(rgb)
    if brightness < 18 or brightness > 248:
        return False
    if saturation > 18:
        return True
    return brightness < 238


def _is_separator_pixel(rgb: tuple[int, int, int]) -> bool:
    r, g, b = rgb
    brightness = (r + g + b) / 3
    saturation = max(rgb) - min(rgb)
    return brightness < 80 and saturation < 55


def _is_visible_filament_color(rgb: tuple[int, int, int]) -> bool:
    r, g, b = rgb
    brightness = (r + g + b) / 3
    saturation = max(rgb) - min(rgb)
    if brightness < 28 or brightness > 248:
        return False
    if saturation >= 30:
        return True
    # Keep grayscale filament, but reject most shadows/black rack bars.
    return 88 <= brightness <= 232


def _color_family(rgb: tuple[int, int, int]) -> str:
    r, g, b = rgb
    brightness = (r + g + b) / 3
    saturation = max(rgb) - min(rgb)
    if saturation < 24:
        if brightness < 75:
            return "black"
        if brightness > 210:
            return "white"
        return "gray"

    dominant = max(range(3), key=lambda index: rgb[index])
    if dominant == 0 and g > 135 and b < 120:
        return "orange" if g > r * 0.45 else "red"
    if dominant == 0 and b > 125:
        return "pink"
    if dominant == 1 and r > 150 and b < 120:
        return "yellow"
    if dominant == 1:
        return "green"
    if dominant == 2 and r > 95:
        return "purple"
    return "blue"


def _visible_filament_colors(image: Image.Image, max_colors: int = 18) -> list[RackColor]:
    width, height = image.size
    buckets: dict[str, list[tuple[int, int, int]]] = {}

    for y in range(0, height, 3):
        for x in range(0, width, 3):
            rgb = image.getpixel((x, y))
            if not _is_visible_filament_color(rgb):
                continue
            family = _color_family(rgb)
            buckets.setdefault(family, []).append(rgb)

    colors: list[RackColor] = []
    min_bucket_size = max(8, (width * height) // 25000)
    for _family, pixels in sorted(buckets.items(), key=lambda item: len(item[1]), reverse=True):
        if len(pixels) < min_bucket_size:
            continue
        saturated = [rgb for rgb in pixels if max(rgb) - min(rgb) >= 30]
        source = saturated if len(saturated) > len(pixels) * 0.18 else pixels
        quantized = Counter(
            ((r // 16) * 16, (g // 16) * 16, (b // 16) * 16)
            for r, g, b in source
        )
        rgb, _count = quantized.most_common(1)[0]
        colors.append(
            RackColor(
                hex=_rgb_to_hex((min(rgb[0] + 8, 255), min(rgb[1] + 8, 255), min(rgb[2] + 8, 255))),
                count=1,
                confidence=0.6,
            )
        )
        if len(colors) >= max_colors:
            break

    return colors


def _trim_row_vertical(
    image: Image.Image,
    row: tuple[int, int],
    x_bounds: tuple[int, int],
) -> tuple[int, int]:
    y1, y2 = row
    x1, x2 = x_bounds
    projection: list[float] = []
    for y in range(y1, y2):
        projection.append(
            sum(1 for x in range(x1, x2, 5) if _is_spool_pixel(image.getpixel((x, y))))
        )
    projection = _smooth(projection, radius=4)
    if not projection:
        return row

    threshold = max(6, max(projection) * 0.22)
    segments = _segments_from_projection(
        projection,
        threshold=threshold,
        min_size=max(20, (y2 - y1) // 4),
        merge_gap=10,
    )
    if not segments:
        return row

    start, end = max(segments, key=lambda segment: segment[1] - segment[0])
    return y1 + start, y1 + end


def _row_x_bounds(
    image: Image.Image,
    row: tuple[int, int],
) -> tuple[int, int] | None:
    y1, y2 = row
    width, _height = image.size
    projection: list[float] = []
    for x in range(width):
        projection.append(
            sum(1 for y in range(y1, y2, 4) if _is_spool_pixel(image.getpixel((x, y))))
        )
    projection = _smooth(projection, radius=5)
    if not projection:
        return None

    max_projection = max(projection)
    segments = _segments_from_projection(
        projection,
        threshold=max(5, max_projection * 0.14),
        min_size=max(50, width // 16),
        merge_gap=35,
    )
    if not segments:
        return None

    x1 = min(segment[0] for segment in segments)
    x2 = max(segment[1] for segment in segments)
    pad = max(2, width // 140)
    return max(0, x1 - pad), min(width, x2 + pad)


def _spool_segments_for_row(
    image: Image.Image,
    row: tuple[int, int],
    x_bounds: tuple[int, int],
) -> tuple[list[tuple[int, int]], dict]:
    y1, y2 = _trim_row_vertical(image, row, x_bounds)
    x1, x2 = x_bounds
    row_height = max(1, y2 - y1)
    color_projection: list[float] = []
    separator_projection: list[float] = []

    for x in range(x1, x2):
        color_score = 0
        separator_score = 0
        for y in range(y1, y2, 3):
            rgb = image.getpixel((x, y))
            if _is_spool_pixel(rgb):
                color_score += 1
            if _is_separator_pixel(rgb):
                separator_score += 1
        color_projection.append(color_score)
        separator_projection.append(separator_score)

    color_projection = _smooth(color_projection, radius=3)
    separator_projection = _smooth(separator_projection, radius=2)
    max_color = max(color_projection) if color_projection else 0
    if max_color <= 0:
        return [], {"trimmed_row": [y1, y2], "method": "no_color_projection"}

    content_segments = _segments_from_projection(
        color_projection,
        threshold=max(5, max_color * 0.24),
        min_size=max(24, (x2 - x1) // 28),
        merge_gap=4,
    )

    split_segments: list[tuple[int, int]] = []
    for start, end in content_segments:
        width = end - start
        if width <= max(120, row_height * 0.75):
            split_segments.append((start, end))
            continue

        local_separator_max = max(separator_projection[start:end]) if end > start else 0
        if local_separator_max <= 0:
            split_segments.append((start, end))
            continue

        separator_segments = _segments_from_projection(
            separator_projection[start:end],
            threshold=max(4, local_separator_max * 0.42),
            min_size=2,
            merge_gap=5,
        )
        cuts = [
            start + int((sep_start + sep_end) / 2)
            for sep_start, sep_end in separator_segments
            if 18 < sep_start < width - 18
        ]
        cursor = start
        for cut in cuts:
            if cut - cursor >= 24:
                split_segments.append((cursor, cut))
            cursor = cut
        if end - cursor >= 24:
            split_segments.append((cursor, end))

    cleaned: list[tuple[int, int]] = []
    min_width = max(28, (x2 - x1) // 32)
    for start, end in split_segments:
        if end - start < min_width:
            continue
        absolute = (x1 + start, x1 + end)
        if cleaned and absolute[0] - cleaned[-1][1] < 10:
            cleaned[-1] = (cleaned[-1][0], absolute[1])
        else:
            cleaned.append(absolute)

    debug = {
        "trimmed_row": [y1, y2],
        "color_max": round(max_color, 2),
        "raw_segments": [[x1 + start, x1 + end] for start, end in content_segments],
        "segments": [[start, end] for start, end in cleaned],
    }
    return cleaned, debug


def _analyze_candidate_rows(
    image: Image.Image,
    rows: list[tuple[int, int]],
) -> tuple[int, list[RackColor], list[dict]]:
    spool_colors: list[RackColor] = []
    spool_count = 0
    row_debug: list[dict] = []

    for y1, y2 in rows:
        x_bounds = _row_x_bounds(image, (y1, y2))
        if not x_bounds:
            continue

        x1, x2 = x_bounds
        spool_bounds, segment_debug = _spool_segments_for_row(image, (y1, y2), (x1, x2))
        separator_bounds, separator_debug = _spool_bounds_from_separators(image, (y1, y2), (x1, x2))
        color_edge_bounds, color_edge_debug = _spool_bounds_from_color_edges(image, (y1, y2), (x1, x2))

        # Separator/rim detection is usually more reliable on storage racks because every spool
        # has visible black flanges. Segment detection remains useful when the rack is not regular.
        if len(separator_bounds) >= len(spool_bounds) and len(separator_bounds) >= len(color_edge_bounds):
            spool_bounds = separator_bounds
            segment_debug = {**segment_debug, **separator_debug, **color_edge_debug, "method": "separators"}
        elif len(color_edge_bounds) >= len(spool_bounds):
            spool_bounds = color_edge_bounds
            segment_debug = {**segment_debug, **separator_debug, **color_edge_debug, "method": "color_edges"}
        else:
            segment_debug = {**segment_debug, **separator_debug, **color_edge_debug, "method": "segments"}

        if not spool_bounds:
            estimated_count = _estimate_spool_count_for_row(image, (y1, y2), (x1, x2))
            step = (x2 - x1) / estimated_count
            spool_bounds = [
                (int(x1 + index * step), int(x1 + (index + 1) * step))
                for index in range(estimated_count)
            ]
            segment_debug = {**segment_debug, "method": "estimated"}

        count = len(spool_bounds)
        row_debug.append(
            {
                "row": [y1, y2],
                "x": [x1, x2],
                "count": count,
                **segment_debug,
            }
        )
        spool_count += count

        for sx1, sx2 in spool_bounds:
            rgb = _average_spool_color(image, (sx1, y1, sx2, y2))
            if rgb:
                spool_colors.append(RackColor(hex=_rgb_to_hex(rgb), count=1, confidence=0.58))

    return spool_count, spool_colors, row_debug


def _spool_bounds_from_separators(
    image: Image.Image,
    row: tuple[int, int],
    x_bounds: tuple[int, int],
) -> tuple[list[tuple[int, int]], dict]:
    y1, y2 = _trim_row_vertical(image, row, x_bounds)
    x1, x2 = x_bounds
    row_height = max(1, y2 - y1)
    dark_projection: list[float] = []

    for x in range(x1, x2):
        dark_projection.append(
            sum(1 for y in range(y1, y2, 3) if _is_separator_pixel(image.getpixel((x, y))))
        )

    dark_projection = _smooth(dark_projection, radius=2)
    if not dark_projection:
        return [], {"separator_centers": []}

    max_dark = max(dark_projection)
    dark_groups = _segments_from_projection(
        dark_projection,
        threshold=max(4, max_dark * 0.34, row_height / 18),
        min_size=2,
        merge_gap=5,
    )
    centers = [x1 + int((start + end) / 2) for start, end in dark_groups]
    centers = [center for center in centers if x1 + 8 < center < x2 - 8]

    cleaned_centers: list[int] = []
    for center in centers:
        if cleaned_centers and center - cleaned_centers[-1] < 24:
            cleaned_centers[-1] = int((cleaned_centers[-1] + center) / 2)
        else:
            cleaned_centers.append(center)

    boundaries = [x1, *cleaned_centers, x2]
    bounds: list[tuple[int, int]] = []
    for left, right in zip(boundaries, boundaries[1:]):
        if right - left >= max(32, (x2 - x1) // 24):
            bounds.append((left, right))

    return bounds, {
        "separator_centers": cleaned_centers,
        "separator_bounds": [[left, right] for left, right in bounds],
    }


def _column_average_color(
    image: Image.Image,
    x: int,
    y1: int,
    y2: int,
) -> tuple[float, float, float] | None:
    pixels: list[tuple[int, int, int]] = []
    for y in range(y1, y2, 4):
        rgb = image.getpixel((x, y))
        if _is_spool_pixel(rgb):
            pixels.append(rgb)
    if not pixels:
        return None
    return tuple(sum(channel) / len(pixels) for channel in zip(*pixels))


def _spool_bounds_from_color_edges(
    image: Image.Image,
    row: tuple[int, int],
    x_bounds: tuple[int, int],
) -> tuple[list[tuple[int, int]], dict]:
    y1, y2 = _trim_row_vertical(image, row, x_bounds)
    x1, x2 = x_bounds
    width = max(1, x2 - x1)
    sample_step = max(2, width // 360)
    columns: list[tuple[int, tuple[float, float, float] | None]] = []

    for x in range(x1, x2, sample_step):
        columns.append((x, _column_average_color(image, x, y1, y2)))

    edge_scores: list[tuple[int, float]] = []
    for index in range(2, len(columns) - 2):
        left_colors = [color for _x, color in columns[index - 2:index] if color]
        right_colors = [color for _x, color in columns[index + 1:index + 3] if color]
        if not left_colors or not right_colors:
            continue
        left = tuple(sum(channel) / len(left_colors) for channel in zip(*left_colors))
        right = tuple(sum(channel) / len(right_colors) for channel in zip(*right_colors))
        distance = sum((left[channel] - right[channel]) ** 2 for channel in range(3)) ** 0.5
        if distance > 42:
            edge_scores.append((columns[index][0], distance))

    candidates = sorted(edge_scores, key=lambda item: item[1], reverse=True)
    cuts: list[int] = []
    min_spool_width = max(18, width // 80)
    for x, _score in candidates:
        if x <= x1 + min_spool_width or x >= x2 - min_spool_width:
            continue
        if any(abs(x - existing) < min_spool_width for existing in cuts):
            continue
        cuts.append(x)

    cuts.sort()
    boundaries = [x1, *cuts, x2]
    bounds = [
        (left, right)
        for left, right in zip(boundaries, boundaries[1:])
        if right - left >= min_spool_width
    ]

    return bounds, {
        "color_edge_cuts": cuts,
        "color_edge_bounds": [[left, right] for left, right in bounds],
    }


def _filter_candidate_rows(rows: list[tuple[int, int]], image_height: int) -> list[tuple[int, int]]:
    min_height = max(28, image_height // 22)
    filtered: list[tuple[int, int]] = []
    for y1, y2 in rows:
        if y2 - y1 < min_height:
            continue
        if filtered and y1 - filtered[-1][1] < max(8, image_height // 90):
            filtered[-1] = (filtered[-1][0], y2)
        else:
            filtered.append((y1, y2))
    return filtered


def _average_spool_color(
    image: Image.Image,
    bounds: tuple[int, int, int, int],
) -> tuple[int, int, int] | None:
    x1, y1, x2, y2 = bounds
    width = max(1, x2 - x1)
    height = max(1, y2 - y1)
    sx1 = x1 + int(width * 0.30)
    sx2 = x2 - int(width * 0.30)
    sy1 = y1 + int(height * 0.30)
    sy2 = y2 - int(height * 0.25)

    pixels: list[tuple[int, int, int]] = []
    for y in range(max(y1, sy1), max(sy1 + 1, sy2), 3):
        for x in range(max(x1, sx1), max(sx1 + 1, sx2), 3):
            rgb = image.getpixel((x, y))
            brightness = sum(rgb) / 3
            saturation = max(rgb) - min(rgb)
            if brightness > 248:
                continue
            if brightness < 22:
                continue
            if saturation < 10 and 70 < brightness < 225:
                continue
            pixels.append(rgb)

    if not pixels:
        return None

    saturated = [rgb for rgb in pixels if max(rgb) - min(rgb) > 24]
    dark = [rgb for rgb in pixels if sum(rgb) / 3 < 95]
    light = [rgb for rgb in pixels if sum(rgb) / 3 > 215 and max(rgb) - min(rgb) <= 24]
    source = saturated or (dark if len(dark) > len(pixels) * 0.35 else None) or light or pixels

    quantized = Counter(((r // 16) * 16, (g // 16) * 16, (b // 16) * 16) for r, g, b in source)
    rgb, count = quantized.most_common(1)[0]
    if count < len(source) * 0.08:
        rgb = tuple(int(sum(channel) / len(source)) for channel in zip(*source))
    return (min(rgb[0] + 8, 255), min(rgb[1] + 8, 255), min(rgb[2] + 8, 255))


def _estimate_spool_count_for_row(
    image: Image.Image,
    row: tuple[int, int],
    x_bounds: tuple[int, int],
) -> int:
    y1, y2 = row
    x1, x2 = x_bounds
    row_height = max(1, y2 - y1)
    span = max(1, x2 - x1)
    dark_projection: list[float] = []

    for x in range(x1, x2):
        dark_projection.append(
            sum(1 for y in range(y1, y2, 3) if _is_dark(image.getpixel((x, y))))
        )

    dark_projection = _smooth(dark_projection, radius=3)
    min_count = max(1, span // 145)
    max_count = max(min_count, min(16, span // 42))
    best_count = max(1, round(span / 105))
    best_score = -1.0

    for count in range(min_count, max_count + 1):
        if count <= 1:
            continue
        step = span / count
        boundary_scores = []
        for boundary_index in range(1, count):
            center = int(boundary_index * step)
            start = max(0, center - 4)
            end = min(len(dark_projection), center + 5)
            boundary_scores.append(sum(dark_projection[start:end]) / max(1, end - start))

        if not boundary_scores:
            continue
        score = sum(boundary_scores) / len(boundary_scores)
        slot_width = span / count
        if 55 <= slot_width <= 130:
            score *= 1.15
        if score > best_score:
            best_score = score
            best_count = count

    return max(1, best_count)


def _separator_boundaries(
    image: Image.Image,
    row: tuple[int, int],
    x_bounds: tuple[int, int],
) -> list[int]:
    y1, y2 = row
    x1, x2 = x_bounds
    row_height = max(1, y2 - y1)
    dark_projection: list[float] = []

    for x in range(x1, x2):
        dark_projection.append(
            sum(1 for y in range(y1, y2, 3) if _is_dark(image.getpixel((x, y))))
        )

    dark_projection = _smooth(dark_projection, radius=2)
    dark_groups = _segments_from_projection(
        dark_projection,
        threshold=max(5, row_height / 3 * 0.24),
        min_size=2,
        merge_gap=6,
    )

    centers = [x1 + int((start + end) / 2) for start, end in dark_groups]
    centers = [center for center in centers if x1 + 10 < center < x2 - 10]
    boundaries = [x1, *centers, x2]

    cleaned = [boundaries[0]]
    for boundary in boundaries[1:]:
        if boundary - cleaned[-1] >= 38:
            cleaned.append(boundary)
    if cleaned[-1] != x2:
        cleaned.append(x2)

    return cleaned


def _local_rack_ocr(image_bytes: bytes) -> tuple[int | None, list[RackColor], float, str]:
    if Image is None:
        return None, [], 0, "Pillow non installé: fallback local indisponible."

    image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    image.thumbnail((900, 900))
    width, height = image.size

    y_projection: list[float] = []
    x_margin = int(width * 0.05)
    for y in range(height):
        y_projection.append(
            sum(1 for x in range(x_margin, width - x_margin, 4) if _is_rack_content(image.getpixel((x, y))))
        )

    y_projection = _smooth(y_projection, radius=6)
    max_projection = max(y_projection) if y_projection else 0
    row_threshold = max(12, max_projection * 0.34)
    rows = _segments_from_projection(
        y_projection,
        threshold=row_threshold,
        min_size=max(35, height // 12),
        merge_gap=10,
    )
    rows = [
        split_row
        for row in rows
        for split_row in _split_large_row_if_needed(y_projection, row, height)
    ]
    rows = _filter_candidate_rows(rows, height)

    spool_count, spool_colors, row_debug = _analyze_candidate_rows(image, rows)
    visible_colors = _visible_filament_colors(image)
    color_families = {_color_family(tuple(int(spool_color.hex[index:index + 2], 16) for index in (1, 3, 5))) for spool_color in spool_colors}
    if visible_colors and (len(spool_colors) < max(4, spool_count // 2) or len(color_families) <= 3):
        spool_colors = visible_colors

    if spool_count == 0:
        return None, _dominant_colors(image_bytes), 0.2, "Analyse locale: aucune rangée détectée."

    result = (
        spool_count,
        spool_colors,
        0.48,
        "Analyse locale heuristique: rangées, séparateurs et couleurs estimés sans modèle vision.",
    )
    logger.info(
        "rack_ocr_local rows=%s row_debug=%s spool_count=%s colors=%s visible_colors=%s image_size=%sx%s",
        rows,
        row_debug,
        result[0],
        [color.hex for color in result[1]],
        [color.hex for color in visible_colors],
        width,
        height,
    )
    return result


async def _openai_rack_ocr(image_bytes: bytes, mime_type: str) -> dict | None:
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        return None

    model = os.getenv("OPENAI_VISION_MODEL", "gpt-4.1-mini")
    encoded = base64.b64encode(image_bytes).decode("ascii")
    data_url = f"data:{mime_type};base64,{encoded}"

    prompt = (
        "Analyse cette photo de rack de stockage de bobines de filament 3D. "
        "Compte uniquement les bobines visibles, ignore les supports/cases vides/reflets, "
        "déduis les couleurs dominantes en hex approximatif, et indique l'incertitude. "
        "Retourne uniquement un JSON avec: status, spoolCount, colors, confidence, notes. "
        "colors doit être une liste d'objets {hex,count,confidence}."
    )

    payload = {
        "model": model,
        "input": [
            {
                "role": "user",
                "content": [
                    {"type": "input_text", "text": prompt},
                    {"type": "input_image", "image_url": data_url, "detail": "high"},
                ],
            }
        ],
        "text": {
            "format": {
                "type": "json_schema",
                "name": "rack_ocr_result",
                "schema": {
                    "type": "object",
                    "additionalProperties": False,
                    "properties": {
                        "status": {"type": "string", "enum": ["processed"]},
                        "spoolCount": {"type": ["integer", "null"]},
                        "colors": {
                            "type": "array",
                            "items": {
                                "type": "object",
                                "additionalProperties": False,
                                "properties": {
                                    "hex": {"type": "string"},
                                    "count": {"type": ["integer", "null"]},
                                    "confidence": {"type": ["number", "null"]},
                                },
                                "required": ["hex", "count", "confidence"],
                            },
                        },
                        "confidence": {"type": "number"},
                        "notes": {"type": "string"},
                    },
                    "required": ["status", "spoolCount", "colors", "confidence", "notes"],
                },
            }
        },
    }

    async with httpx.AsyncClient(timeout=45) as client:
        response = await client.post(
            "https://api.openai.com/v1/responses",
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            json=payload,
        )
        response.raise_for_status()
        data = response.json()

    output_text = data.get("output_text")
    if not output_text:
        for item in data.get("output", []):
            for content in item.get("content", []):
                if content.get("type") in {"output_text", "text"} and content.get("text"):
                    output_text = content["text"]
                    break
            if output_text:
                break

    if not output_text:
        return None

    return json.loads(output_text)


@router.post("/rack-ocr", response_model=RackOcrResponse)
async def rack_ocr(
    image: UploadFile = File(...),
    organization_id: str | None = Form(default=None),
) -> RackOcrResponse:
    image_bytes = await image.read()
    mime_type = image.content_type or "image/jpeg"
    image_meta = {
        "filename": image.filename or "rack.jpg",
        "mimeType": mime_type,
        "size": len(image_bytes),
        "organizationId": organization_id,
    }

    try:
        local_model_result = _local_model_rack_ocr(image_bytes)
        if local_model_result:
            return RackOcrResponse(**local_model_result, image=image_meta)
    except Exception as exc:
        logger.warning("rack_ocr_local_model_failed error=%s", exc)

    try:
        openai_result = await _openai_rack_ocr(image_bytes, mime_type)
        if openai_result:
            logger.info(
                "rack_ocr_openai spool_count=%s colors=%s confidence=%s",
                openai_result.get("spoolCount"),
                [color.get("hex") for color in openai_result.get("colors", [])],
                openai_result.get("confidence"),
            )
            return RackOcrResponse(**openai_result, image=image_meta)
    except Exception as exc:
        fallback_note = f"Analyse vision distante indisponible: {exc}"
    else:
        fallback_note = "OPENAI_API_KEY non configurée: analyse locale couleurs uniquement."

    spool_count, colors, confidence, local_note = _local_rack_ocr(image_bytes)
    logger.info(
        "rack_ocr_response status=needs_vision_model spool_count=%s colors=%s confidence=%s note=%s",
        spool_count,
        [color.hex for color in colors],
        confidence,
        local_note,
    )
    return RackOcrResponse(
        status="needs_vision_model",
        spoolCount=spool_count,
        colors=colors,
        confidence=confidence,
        notes=f"{fallback_note} {local_note}",
        image=image_meta,
    )

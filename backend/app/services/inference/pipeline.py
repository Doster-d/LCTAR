from typing import Any

_models_loaded: bool = False

# Placeholders for actual models
YOLO_MODEL = None
DEPTH_MODEL = None


def load_models_global():
    global _models_loaded, YOLO_MODEL, DEPTH_MODEL
    if _models_loaded:
        return
    # Lazy import (avoid heavy deps if disabled)
    try:
        # from ultralytics import YOLO  # Example
        # YOLO_MODEL = YOLO('yolov11n.pt')  # placeholder path
        YOLO_MODEL = 'YOLO_STUB'
    except Exception:
        YOLO_MODEL = None
    try:
        # DEPTH_MODEL = load_depth_anything_v2()
        DEPTH_MODEL = 'DEPTH_STUB'
    except Exception:
        DEPTH_MODEL = None
    _models_loaded = True


def run_inference(image_bytes: bytes, focal_length: float) -> dict[str, Any]:
    # Stub logic: return fake person bbox + depth
    # In real implementation, do model inference; pick largest bbox etc.
    bbox_height_px = 400  # pretend
    depth_m = 2.0  # pretend
    height_m = (
        bbox_height_px * depth_m / focal_length if focal_length else None
    )
    return {
        'detected': True,
        'bbox': {'x1': 100, 'y1': 50, 'x2': 250, 'y2': 450},
        'depth_m': depth_m,
        'height_m': height_m,
        'models': {
            'yolo': YOLO_MODEL is not None,
            'depth': DEPTH_MODEL is not None,
        },
    }

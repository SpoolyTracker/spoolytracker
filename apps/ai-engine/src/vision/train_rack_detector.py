from __future__ import annotations

import argparse
import shutil
from pathlib import Path

try:
    from ultralytics import YOLO
except ImportError as exc:  # pragma: no cover
    raise SystemExit("ultralytics manquant. Lance: pip install -e .[vision]") from exc


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Train the local rack spool detector.")
    parser.add_argument(
        "--data",
        required=True,
        help="Path to a YOLO data.yaml file. It must declare a single class: spool.",
    )
    parser.add_argument("--base", default="yolov8n.pt", help="Base YOLO weights.")
    parser.add_argument("--epochs", type=int, default=80)
    parser.add_argument("--imgsz", type=int, default=960)
    parser.add_argument("--batch", type=int, default=8)
    parser.add_argument("--project", default="runs/rack-spool-detector")
    parser.add_argument("--name", default="train")
    parser.add_argument(
        "--output",
        default="models/rack-spool-detector.pt",
        help="Where to copy the trained best.pt file.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    model = YOLO(args.base)
    result = model.train(
        data=args.data,
        epochs=args.epochs,
        imgsz=args.imgsz,
        batch=args.batch,
        project=args.project,
        name=args.name,
        exist_ok=True,
    )

    save_dir = Path(result.save_dir)
    best_weights = save_dir / "weights" / "best.pt"
    if not best_weights.exists():
        raise SystemExit(f"Training finished but best.pt was not found at {best_weights}")

    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(best_weights, output)
    print(f"Saved rack detector to {output}")


if __name__ == "__main__":
    main()

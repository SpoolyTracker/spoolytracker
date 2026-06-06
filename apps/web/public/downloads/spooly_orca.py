#!/usr/bin/env python3
"""
Lightweight OrcaSlicer post-processing hook for SpoolyTracker.

Usage example in OrcaSlicer:
  python C:\\path\\to\\spooly_orca.py --api-url https://api.spoolytracker.com C:\\path\\to\\output.gcode

Set SPOOLYTRACKER_API_KEY in your environment, or pass --api-key.
By default this only analyzes and writes a .spooly.json sidecar file.
Use --commit to decrement the best high/medium confidence spool matches.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import mimetypes
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
from pathlib import Path


def main() -> int:
    parser = argparse.ArgumentParser(description="Send OrcaSlicer G-code usage to SpoolyTracker.")
    parser.add_argument("gcode", help="Path to the generated .gcode/.gc/.3mf file")
    parser.add_argument("--api-url", default=os.getenv("SPOOLYTRACKER_API_URL", "http://localhost:3000"))
    parser.add_argument("--api-key", default=os.getenv("SPOOLYTRACKER_API_KEY"))
    parser.add_argument("--commit", action="store_true", help="Record consumption for best matched spools")
    parser.add_argument("--min-confidence", choices=["high", "medium", "low"], default="medium")
    parser.add_argument("--timeout", type=int, default=180)
    args = parser.parse_args()

    if not args.api_key:
        print("SpoolyTracker: missing API key. Set SPOOLYTRACKER_API_KEY or pass --api-key.", file=sys.stderr)
        return 2

    gcode_path = Path(args.gcode)
    if not gcode_path.exists():
        print(f"SpoolyTracker: file not found: {gcode_path}", file=sys.stderr)
        return 2

    api_url = args.api_url.rstrip("/")
    job = post_file(
        f"{api_url}/integrations/orca/gcode/inspect",
        args.api_key,
        gcode_path,
    )
    job_id = job["jobId"]
    result = wait_for_job(api_url, args.api_key, job_id, args.timeout)

    sidecar = gcode_path.with_suffix(gcode_path.suffix + ".spooly.json")
    sidecar.write_text(json.dumps(result, indent=2), encoding="utf-8")

    if args.commit:
        committed = commit_best_matches(api_url, args.api_key, result, args.min_confidence, gcode_path)
        print(f"SpoolyTracker: committed {committed} consumption record(s).")
    else:
        print(f"SpoolyTracker: analysis written to {sidecar}.")

    return 0


def post_file(url: str, api_key: str, path: Path) -> dict:
    boundary = f"----spooly-{uuid.uuid4().hex}"
    content_type = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
    file_bytes = path.read_bytes()
    body = b"".join(
        [
            f"--{boundary}\r\n".encode(),
            (
                f'Content-Disposition: form-data; name="file"; filename="{path.name}"\r\n'
                f"Content-Type: {content_type}\r\n\r\n"
            ).encode(),
            file_bytes,
            b"\r\n",
            f"--{boundary}--\r\n".encode(),
        ]
    )
    request = urllib.request.Request(
        url,
        data=body,
        headers={
            "x-api-key": api_key,
            "Content-Type": f"multipart/form-data; boundary={boundary}",
        },
        method="POST",
    )
    return read_json(request)


def wait_for_job(api_url: str, api_key: str, job_id: str, timeout_seconds: int) -> dict:
    deadline = time.time() + timeout_seconds
    url = f"{api_url}/integrations/orca/gcode/job/{urllib.parse.quote(str(job_id))}"

    while time.time() < deadline:
        request = urllib.request.Request(url, headers={"x-api-key": api_key})
        payload = read_json(request)
        if payload.get("status") == "completed":
            return payload["result"]
        if payload.get("status") == "failed":
            raise RuntimeError(payload.get("error") or "G-code analysis failed")
        time.sleep(2)

    raise TimeoutError(f"Timed out waiting for SpoolyTracker job {job_id}")


def commit_best_matches(api_url: str, api_key: str, result: dict, min_confidence: str, gcode_path: Path) -> int:
    allowed = {
        "high": {"high"},
        "medium": {"high", "medium"},
        "low": {"high", "medium", "low"},
    }[min_confidence]
    committed = 0
    tool_suggestions = result.get("matching", {}).get("toolSuggestions", [])

    for suggestion in tool_suggestions:
        candidates = suggestion.get("candidates") or []
        if not candidates:
            continue

        best = candidates[0]
        if best.get("confidence") not in allowed:
            continue

        filament_id = best.get("filamentId")
        amount = float(suggestion.get("requiredWeightG") or 0)
        if not filament_id or amount <= 0:
            continue

        external_job_id = f"orca:{gcode_path.name}:{result_hash(result)}:{suggestion.get('tool')}"
        try:
            post_json(
                f"{api_url}/integrations/orca/consumption",
                api_key,
                {
                    "filamentId": filament_id,
                    "amount": round(amount, 2),
                    "externalJobId": external_job_id,
                    "notes": f"OrcaSlicer {gcode_path.name} {suggestion.get('tool')}",
                    "printStatus": "SUCCESS",
                },
            )
            committed += 1
        except RuntimeError as exc:
            if "Duplicate consumption" in str(exc):
                print(f"SpoolyTracker: consumption already recorded for {suggestion.get('tool')}.")
                continue
            raise

    return committed


def post_json(url: str, api_key: str, payload: dict) -> dict:
    request = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"x-api-key": api_key, "Content-Type": "application/json"},
        method="POST",
    )
    return read_json(request)


def read_json(request: urllib.request.Request) -> dict:
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as error:
        body = error.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"HTTP {error.code}: {body}") from error


def result_hash(result: dict) -> str:
    compact = json.dumps(
        {
            "tools": result.get("tools"),
            "perTool": result.get("perTool"),
            "totals": result.get("totals", {}).get("computed"),
        },
        sort_keys=True,
    )
    return hashlib.sha256(compact.encode("utf-8")).hexdigest()[:16]


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"SpoolyTracker: {exc}", file=sys.stderr)
        raise SystemExit(1)

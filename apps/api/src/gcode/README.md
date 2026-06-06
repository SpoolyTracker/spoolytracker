# G-code / 3MF Analysis

This module turns uploaded `.gcode`, `.gc`, and `.3mf` files into actionable SpoolyTracker data.

It has three responsibilities:

1. Extract print usage per tool (`T0`, `T1`, etc.).
2. Extract slicer filament hints when they exist.
3. Suggest matching inventory spools and broad material families.

## Main Flow

`GcodeController` receives uploads and enqueues BullMQ jobs.

`GcodeProcessor` runs the heavy work in the background:

- extracts embedded plate G-code from `.3mf` files;
- detects extrusion mode/unit;
- computes volume, length, and default grams per tool;
- extracts filament hints from slicer comments;
- calls `FilamentMatchingService` to rank inventory candidates.

The web app consumes the completed job result and shows the suggestions in the G-code wizard.

## Filament Hints

`GcodeAnalyzerService.extractFilamentHintsFromFile()` reads slicer comment metadata such as:

- `filament_type`
- `filament_colour` / `filament_color`
- `filament_settings_id`
- `filament_vendor`
- `nozzle_temperature`
- `bed_temperature`

These fields are best-effort. Different slicers and export settings may omit or rename data. Missing hints should never block analysis.

## Matching Engine

`FilamentMatchingService` is intentionally deterministic. It does not use a machine-learning model.

Each spool gets a score based on:

- material compatibility;
- color distance;
- stock sufficiency;
- brand/preset similarity;
- nozzle temperature compatibility;
- locked or empty spool penalties.

The service returns candidates with `reasons` and `warnings` so the UI can explain the recommendation.

This explainability is important: users should trust suggestions because they can see why Spooly made them.

## Print Intent

The service also provides a lightweight `printIntent` suggestion:

- `decorative`
- `technical`
- `heat_resistant`
- `flexible`
- `unknown`

This is inferred from filename keywords and slicer material hints, not geometry analysis.

Examples:

- `vase`, `figurine`, `decor` -> decorative -> PLA family.
- `bracket`, `mount`, `gear`, `fixture` -> technical -> PETG, PETG-CF, ABS, ASA, PA-CF.
- `heat`, `engine`, `automotive` -> heat resistant -> ASA, ABS, PC, PA.
- `flex`, `seal`, `gasket` -> flexible -> TPU/TPE.

Treat this as a nudge, not a hard validation rule.

## Current Limitations

- No memory table yet: user confirmations are not learned across analyses.
- No AMS/printer live state is used.
- 3MF metadata varies by slicer.
- Filename intent detection is heuristic.
- RGB color distance is simple and may not match human color perception perfectly.

## Recommended Next Step

Add a `filament_mapping_memory` table.

Suggested fields:

- `id`
- `organizationId`
- `sourceMaterial`
- `sourceColor`
- `sourceBrand`
- `sourcePresetName`
- `filamentId`
- `usageCount`
- `lastUsedAt`
- `createdAt`
- `updatedAt`

When a user confirms a suggested spool, store or update the mapping. Future suggestions can then add a strong `previously_confirmed` score bonus.

# Print Intelligence Graph — Phase 24 (Refined)

The Print Intelligence Graph transforms isolated prepress data into a global knowledge base for predictive optimization.

## Core Entities

### 1. Print Features (`print_features`)
Structural technical signature extracted from ہر PDF:
- `max_tac`, `min_dpi`, `has_bleed`, `color_profile`, `fonts_json`.

### 2. Policy Constraints (`policy_constraints`)
Business rules and strict quality requirements:
- `tac_limit`, `min_dpi`, `bleed_required`.
- decouples "what the client wants" from "what the machine can do".

### 3. Machine Profiles (`machine_profiles`)
Physical reality of the production floor:
- `max_tac` capacity, `min_res_dpi` capability, `requires_bleed`.

### 4. Paper Profiles (`paper_profiles`)
Substrate behavior:
- `absorption_coefficient`, `weight`, `icc_profile` (ideal profile for the paper).

## Compatibility & Scoring logic
`compatibility_score = 100`

| Penalty Factor | Deduction | Criterion |
| --- | --- | --- |
| TAC Violation | -30 | if `File.tac > min(Machine.tac, Policy.tac)`|
| Resolution Mismatch | -25 | if `File.dpi < max(Machine.dpi, Policy.dpi)` |
| Bleed Deficiency | -40 | if `(Machine.bleed || Policy.bleed) && !File.bleed` |
| Profile Mismatch | -20 | if `File.profile != Paper.profile` |

---
*PrintPrice Intelligence converts bits into predictable atoms.*

# Phase 5 Simplify — Demo Script

## Simplification Pass
- Kept the script loader synchronous and file-based so later server components can use it directly without async wiring.
- Used one explicit JSON file instead of derived helper-generated content, which keeps the narrative data inspectable and editable.
- Kept placeholder portraits as committed static assets rather than introducing a build-time generator or runtime fallback layer in this phase.

## Outcome
- The phase stays small and composable.
- Later phases can depend on one validated `ScriptDefinition` shape without carrying parsing logic into UI code.

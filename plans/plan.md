# Scoped reliability hardening plan (implemented)

## Summary

Five PR-sized units covering findings 1, 2, 3, 4, 11, 12, and 13 from the 2026-09-02 architecture review. This replaces the earlier seven-PR proposal: PR 5 and PR 6 were merged into one canvas-gesture unit, the PDF endpoint transport was kept as base64 JSON with a 3 MiB binary ceiling, and the PDF viewer work was reduced to lazy tab extraction with load-generation guards instead of AbortSignal threading and proxy lifecycle management.

Targets commit 147232e. Existing plans 001 through 005 remain unchanged.

## Changes

### 1. Bound PDF extraction (finding 1)

`api/extract-images.ts`

- Reject payloads above 3 MiB binary (fits Vercel's 4.5 MB request ceiling after base64 expansion) with HTTP 413 before parsing.
- Reject documents above 50 pages with HTTP 413.
- Skip images above 16,000,000 pixels; stop traversal at 100 extracted images.
- Import `@napi-rs/canvas` once instead of per image.
- Remove wildcard CORS headers.
- Return a generic 500 without internal exception text.

### 2. Sanitize project imports (finding 2)

`components/editor/EditorHeader.tsx`

- Drop-invalid-elements policy instead of reject-whole-file: elements missing a non-empty `id`, a known `type`, or finite positive `x/y/w/h` are dropped with a console warning; malformed pages are dropped the same way.
- Imports are atomic by construction: sanitized pages and config are computed fully before `setPages` / `setCanvasConfig` / `setCurrentPage` run.
- `canvasConfig` goes through the existing `parseCanvasConfig` guard.
- Default `name`, `color`, and `zIndex` are filled for elements missing them.
- Empty pages array or no usable pages leaves state untouched with an alert.

### 3. Merge AI layouts without deleting content (finding 3)

`components/DesignEditor.tsx`

- Approval no longer replaces the canvas. Planned elements are matched by id against current elements: matched elements keep all properties except geometry (`x/y/w/h`); current elements omitted by the plan are preserved; plan-only elements are appended.
- The existing revision check (`pendingPlan.baseRevision` vs canvas revision) still gates the merge.

### 4. Report objects outside every board (finding 4)

`services/canvasToolEngine.ts`, `services/canvasToolEngine.test.ts`

- `getBoardState` returns `unownedObjects` alongside `boards` / `objectsByBoard`. Center-point ownership, secondary-board precedence, and container exclusion are unchanged.
- `analyze_current_layout` (focus `balance` / `all`) appends one `Unassigned: <name>: Not inside any board` issue per unowned object; counted in `issueCount`, affects `isValid`, and feeds `suggest_improvements`.
- Overlaps / spacing / readability focus areas do not emit the unowned warning.
- New test covers balance-vs-overlaps behavior for an off-board element.

### 5. Correct polygon vertex editing and resize anchors (findings 11, 12)

`components/CanvasElementRender.tsx`, `components/canvas/CanvasStage.tsx`, `hooks/useCanvasInteraction.ts`

- `CanvasElementRender` accepts a `scale` prop (passed from `CanvasStage`); vertex deltas divide by the real canvas zoom instead of hard-coded 1.
- Vertex drags accumulate in local draft state and commit once on mouseup, producing a single undo entry. A click without movement performs no update. Listeners are cleaned up on mouseup and unmount.
- West resize anchors via `newX = original.x + original.w - newW`; north via `newY = original.y + original.h - newH` — clamped width/height derive the position, so the opposite edge stays fixed below the 10-unit minimum. Image aspect handling keeps width as the driver and anchors north corners against the original bottom.

### 6. Lazy, stale-safe PDF viewer (finding 13)

`components/PDFViewer.tsx`

- Initial selection renders pages and metadata only; text, links, and images extract on first tab activation and are reused afterwards.
- A monotonically increasing load id invalidates in-flight work when the user selects, replaces, resets, or unloads a file; stale results never publish.
- A per-effect `cancelled` flag prevents setState after cancellation.
- Client-side 3 MB file guard matches the endpoint limit.

## Verification

- `npx tsc --noEmit`: zero errors in changed files. Six pre-existing errors remain in untouched files (`CanvasPrototype.tsx`, `chatai.ts`, `nanobanna.ts`, `OPenrouter.ts`) and are out of scope.
- `npm run build`: passes.
- `services/canvasToolEngine.test.ts`: 3/3 pass, including the new off-board test. Note: plain `node --test` cannot run this suite because the engine's import chain uses extensionless relative imports (pre-existing); verification used a tsc-compiled copy (`--rewriteRelativeImportExtensions`) outside the repo tree. Fixing the import chain touches files outside this plan's scope.
- `services/layoutTemplates.test.ts`: 2/2 pass (same compiled approach).
- Manual checks still recommended before merge: oversized/malformed PDF against the endpoint, invalid project import preserves the canvas, AI plan approval preserves omitted elements, polygon vertex drag at zoom with one-step undo, resize below minimum from every corner, PDF tab laziness.

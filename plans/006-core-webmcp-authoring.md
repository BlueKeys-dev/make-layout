# Plan 006: Core WebMCP authoring expansion

## Summary

Add page creation, shared canvas configuration, text typography, complete multi-tool discovery, board-aware diagram placement, and template compatibility reporting through the existing WebMCP engine and React state bridge.

## Changes

- Add revision-guarded `add_page` and `configure_canvas` tools. Both require the UI lock and commit through existing page/configuration setters.
- Merge configuration updates onto the current `CanvasConfig`, stamp `_v: CANVAS_CONFIG_STORAGE_VERSION`, then call `parseCanvasConfig`.
- Add text-only `textStyle` support to `add_element`. Labeled shapes remain a composition of one shape and one separate text element.
- Change `describe_tools` to accept `names: string | string[]`, cap requests at 10, and return complete schemas and annotations in one `tools` array.
- Place generated diagrams through `placeElementInCanvas` using the active board.
- Calculate layout-template compatibility in `layoutTemplates.ts` and expose target, compatibility, orientation, and incompatibility reason during discovery.
- Keep registration stable and backed by live refs. Stale revisions remain rejected; no tool-refresh ceremony is part of the app workflow.

## Non-goals

- Shape-content rendering or a second text-styling surface.
- Zoom, recenter, screenshots, per-page canvas settings, dynamic registration, or toolbar CSS.
- New dependencies or an alternate canvas mutation path.

## Verification

```bash
npx tsc --noEmit
npm run build
./node_modules/.bin/esbuild services/canvasToolEngine.test.ts --bundle --platform=node --format=cjs --outfile=/tmp/make-layout-canvas-tools.test.cjs
node --test /tmp/make-layout-canvas-tools.test.cjs
./node_modules/.bin/esbuild services/layoutTemplates.test.ts --bundle --platform=node --format=cjs --outfile=/tmp/make-layout-layout-templates.test.cjs
node --test /tmp/make-layout-layout-templates.test.cjs
./node_modules/.bin/esbuild utils/canvasPlacement.test.ts --bundle --platform=node --format=cjs --outfile=/tmp/make-layout-canvas-placement.test.cjs
node --test /tmp/make-layout-canvas-placement.test.cjs
git diff --check
```

The esbuild steps intentionally bundle extensionless imports before Node executes the tests, avoiding the repository's existing `ERR_UNSUPPORTED_DIR_IMPORT`.

## Acceptance

- Page and canvas writes are locked, revision-safe, undoable where the existing state owner supports history, and return the committed revision.
- Styled text renders through the existing `TextElement`; shapes remain unchanged.
- Discovery returns complete schemas for one or more requested tools.
- Diagrams and layout compatibility resolve against the active board.
- Existing board-analysis behavior remains green.

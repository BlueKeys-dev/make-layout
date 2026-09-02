# Plan 003: Decompose DesignEditor into focused modules

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step. If anything in the "STOP conditions" section occurs, stop and report — do not improvise. When done, update the status row for this plan in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 17cbc50..HEAD -- components/DesignEditor.tsx`

## Status

- **Priority**: P1
- **Effort**: L
- **Risk**: MED
- **Depends on**: plans/002-dedupe-board-and-layout-target.md
- **Category**: tech-debt
- **Planned at**: commit `17cbc50`, 2026-09-01

## Why this matters

`DesignEditor.tsx` is ~1942 lines. This branch added layout-library orchestration, canvas persistence, WebMCP tool wiring, PDF import board creation, and slot-layout UI without extracting modules. Thermo-nuclear review treats a file this size as a presumptive blocker — new features will keep landing as inline handlers and conditionals.

## Current state

- `components/DesignEditor.tsx` (~1942 lines) — owns: pages state, canvas interaction, layout library, WebMCP registration, modals, keyboard shortcuts wiring, board selection, tool outcomes.
- Existing decomposition pattern in repo: `components/canvas/CanvasStage.tsx`, `components/editor/EditorHeader.tsx`, `hooks/useCanvasInteraction.ts`, `services/canvasToolEngine.ts`.

Target: `DesignEditor.tsx` under **800 lines** — orchestration and JSX composition only.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Typecheck | `npx tsc --noEmit` | exit 0 |
| Tests | `npx tsx --test services/layoutTemplates.test.ts` | pass |
| Build | `npm run build` | exit 0 |
| Line count | `wc -l components/DesignEditor.tsx` | &lt; 800 |

## Scope

**In scope** (create/modify):
- `components/DesignEditor.tsx` (shrink)
- `hooks/useLayoutLibrary.ts` (new)
- `hooks/useCanvasPages.ts` (new) — pages, `setElements`, `normalizePages`, persistence effect
- `hooks/useDesignEditorWebMcp.ts` (new) — tool registration + outcome application (or extend `services/webmcp.ts` if already the canonical layer)
- `components/editor/DesignEditorModals.tsx` (new) — docs, confirm delete, AnimationHome shell, generators

**Out of scope**:
- Rewriting `canvasToolEngine.ts`
- `animationhome.tsx` decomposition
- Behavior changes to layout slots or export

## Steps

### Step 1: Extract `useCanvasPages`

Move: `getInitialPages`, `normalizePages`, `normalizeContainerBoard`, `pages`/`currentPage`/`setElements`, localStorage persistence for `ai-layout-pages`, page-index clamp from plan 001.

Export interface:

```typescript
export function useCanvasPages() {
  return { pages, setPages, currentPage, setCurrentPage, elements, setElements, undo, redo, canUndo, canRedo };
}
```

Keep `useHistory` usage inside the hook.

**Verify**: `npx tsc --noEmit` → exit 0; DesignEditor imports hook.

### Step 2: Extract `useLayoutLibrary`

Move: `layoutLibrary` state, `refreshLayoutLibrary`, `handleLoadLayoutTemplate`, `handleSaveLayoutTemplate`, `handleDeleteLayoutTemplate`. Depend on `elementsRef`, `activeBoardIdRef`, `logicalWidth`/`logicalHeight`, `setElements`, `setActiveTool`.

Use helpers from plan 002 (`resolveLayoutTargetRect`, `createContainerBoard` only if still inlined).

**Verify**: `grep "handleSaveLayoutTemplate" components/DesignEditor.tsx` → no definition (only hook usage).

### Step 3: Extract WebMCP registration block

Move the `useEffect` that calls `registerDesignTools` and the `applyCanvasToolOutcome` callback into `hooks/useDesignEditorWebMcp.ts`. Pass refs and setters as a typed options object — avoid `any`.

**Verify**: `npx tsc --noEmit` → exit 0.

### Step 4: Extract modal JSX

Move confirm-delete overlay, docs modal, AnimationHome conditional, MindMap/P5 generator mounts into `DesignEditorModals.tsx`. Props: boolean open flags + callbacks only.

**Verify**: `wc -l components/DesignEditor.tsx` → under 800 lines.

### Step 5: Final pass

Remove dead imports from `DesignEditor.tsx`. Ensure no circular imports (hooks must not import DesignEditor).

**Verify**: `npm run build` → exit 0.

## Test plan

- Rely on existing `layoutTemplates.test.ts` + any tests from plan 002.
- No E2E required; manual smoke checklist in PR description: select board, save/load layout, undo, export menu still renders.

## Done criteria

- [ ] `wc -l components/DesignEditor.tsx` &lt; 800
- [ ] Three new modules/hooks exist with single responsibility
- [ ] `npx tsc --noEmit` exits 0
- [ ] `npm run build` exits 0
- [ ] No new `any` in extracted hooks (use existing types from `types.ts`)
- [ ] `plans/README.md` row 003 → DONE

## STOP conditions

- Circular dependency between hooks and DesignEditor cannot be resolved without behavior change — report before large refactor.
- WebMCP effect tightly couples to 10+ refs — stop if extraction requires rewriting tool engine.
- Line count still &gt; 1000 after steps 1–4 — report what remains and propose step 6 scope.

## Maintenance notes

- New editor features should land in hooks/services, not back into DesignEditor.tsx.
- Reviewers should reject PRs that grow DesignEditor past ~900 lines without decomposition.

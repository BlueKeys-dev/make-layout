# Plan 002: Deduplicate container-board creation and layout target rect

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step. If anything in the "STOP conditions" section occurs, stop and report — do not improvise. When done, update the status row for this plan in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 17cbc50..HEAD -- utils/elementRegistry.ts components/DesignEditor.tsx`

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none
- **Category**: tech-debt
- **Planned at**: commit `17cbc50`, 2026-09-01

## Why this matters

`DesignEditor.tsx` constructs `type: 'container'` boards in three places (add page, PDF single import, PDF batch import) with nearly identical `boardConfig` shapes. `handleLoadLayoutTemplate` and `handleSaveLayoutTemplate` duplicate the same “resolve target board rect” logic. This is classic spaghetti growth — every new board default requires three edits.

## Current state

- `utils/elementRegistry.ts` — `createElementFactory('container', ...)` already returns a container with defaults (`locked: false`, `boardConfig` with grid).
- `components/DesignEditor.tsx` — inline board objects at ~1516–1536, ~1651–1671, ~1731–1749.
- `components/DesignEditor.tsx` — duplicated target rect in `handleLoadLayoutTemplate` and `handleSaveLayoutTemplate` (~239–268).

Exemplar factory pattern (match this style):

```typescript
// utils/elementRegistry.ts ~135-148
case 'container':
  return { ...base, w: 500, h: 500, locked: false, boardConfig: { ... } };
```

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Typecheck | `npx tsc --noEmit` | exit 0 |
| Tests | `npx tsx --test services/layoutTemplates.test.ts` | pass |
| Build | `npm run build` | exit 0 |

## Scope

**In scope**:
- `utils/elementRegistry.ts` (or new `utils/boardFactory.ts` if registry is already crowded)
- `components/DesignEditor.tsx`

**Out of scope**:
- Full DesignEditor split (plan 003)
- Changing container default dimensions for placement tool

## Steps

### Step 1: Add `createContainerBoard` helper

In `utils/elementRegistry.ts` (preferred — canonical element home), add:

```typescript
export type ContainerBoardOptions = {
  x: number;
  y: number;
  w: number;
  h: number;
  name: string;
  color?: string;
  locked?: boolean;
  boardConfig?: Partial<CanvasConfig>; // or a narrower BoardConfig type if one exists
};

export const createContainerBoard = (options: ContainerBoardOptions): CanvasElement => { ... }
```

Merge `options.boardConfig` over `DEFAULT_CANVAS_CONFIG` fields needed for boards (`showGrid`, `gridRows`, `gridCols`, `showGuides`, `bleed`, `backgroundColor`, `borderRadius`). Use `crypto.randomUUID()` for `id`, `zIndex: 0`, `type: 'container'`.

**Verify**: `npx tsc --noEmit` → exit 0.

### Step 2: Add `resolveLayoutTargetRect` helper

Create `utils/layoutTarget.ts` (or add to `services/layoutTemplates.ts` if that module already owns layout geometry):

```typescript
export const resolveLayoutTargetRect = (
  elements: CanvasElement[],
  activeBoardId: string | null,
  fallback: { width: number; height: number },
): { x: number; y: number; width: number; height: number } => { ... }
```

Behavior: if `activeBoardId` set, find matching `container` element; if missing, throw `Error('The selected board no longer exists...')` (same message as today). Else return `{ x: 0, y: 0, width: fallback.width, height: fallback.height }`.

**Verify**: `npx tsc --noEmit` → exit 0.

### Step 3: Replace three inline board constructions in DesignEditor

Replace add-page, PDF single, and PDF batch board literals with `createContainerBoard({ ... })`. Delete duplicated `boardConfig` blocks.

**Verify**: `grep -c "type: 'container'" components/DesignEditor.tsx` — should drop from 3 object literals to 0 (only helper calls remain).

### Step 4: Use `resolveLayoutTargetRect` in load/save handlers

Replace duplicated `targetBoard` / `target` blocks in `handleLoadLayoutTemplate` and `handleSaveLayoutTemplate`.

**Verify**: `npm run build` → exit 0.

## Test plan

- Add `utils/layoutTarget.test.ts` (node:test) with cases: primary fallback, active board found, active board missing throws.
- Optional: one test for `createContainerBoard` defaults (`locked: false`, guides/bleed from defaults).
- Run: `npx tsx --test services/layoutTemplates.test.ts utils/layoutTarget.test.ts` (adjust path if single test runner invocation needed).

## Done criteria

- [ ] Single `createContainerBoard` used for all new boards in DesignEditor
- [ ] Single `resolveLayoutTargetRect` used for layout save/load
- [ ] `npx tsc --noEmit` exits 0
- [ ] `npm run build` exits 0
- [ ] New unit test(s) pass
- [ ] `plans/README.md` row 002 → DONE

## STOP conditions

- `CanvasElement` / `boardConfig` types force awkward casts — stop and report type shape needed.
- PDF import paths moved to a different file since plan was written.

## Maintenance notes

- Plan 003 should import these helpers rather than re-copying logic into hooks.

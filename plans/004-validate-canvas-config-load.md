# Plan 004: Validate persisted canvas config at load boundary

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step. If anything in the "STOP conditions" section occurs, stop and report — do not improvise. When done, update the status row for this plan in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 17cbc50..HEAD -- config/canvasDefaults.ts`

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `17cbc50`, 2026-09-01

## Why this matters

`loadCanvasConfig` spreads arbitrary JSON from `localStorage` into `CanvasConfig`. Corrupt or partial data can yield `NaN` dimensions that propagate into layout template math (`layoutTemplates.ts` division by `target.width`).

## Current state

```typescript
// config/canvasDefaults.ts ~29-44
export const loadCanvasConfig = (): CanvasConfig => {
  try {
    const saved = localStorage.getItem(CANVAS_CONFIG_STORAGE_KEY);
    if (!saved) return { ...DEFAULT_CANVAS_CONFIG };
    const parsed = JSON.parse(saved) as Partial<CanvasConfig> & { _v?: number };
    // ... legacy bleed/showGuides migration ...
    return { ...DEFAULT_CANVAS_CONFIG, ...stored, ... };
  } catch {
    return { ...DEFAULT_CANVAS_CONFIG };
  }
};
```

`saveCanvasConfig` swallows quota errors silently (`catch { // ignore }`).

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Typecheck | `npx tsc --noEmit` | exit 0 |
| Build | `npm run build` | exit 0 |

## Scope

**In scope**:
- `config/canvasDefaults.ts`
- `config/canvasDefaults.test.ts` (new)

**Out of scope**:
- Validating `ai-layout-pages` element arrays (separate concern)

## Steps

### Step 1: Add `parseCanvasConfig` pure function

Validate numeric fields after merge:

- `width`, `height` → finite, &gt; 0
- `bleed` → finite, ≥ 0
- `gridRows`, `gridCols` → finite integers ≥ 1
- `borderRadius` → finite, ≥ 0
- `mode` → one of allowed enum values or default
- `backgroundColor` → string or default

On any invalid field, fall back to `DEFAULT_CANVAS_CONFIG` value for that field (or full default on parse throw).

**Verify**: unit tests pass (step 2).

### Step 2: Add tests

`config/canvasDefaults.test.ts` using `node:test`:

- valid stored config round-trips
- `{ width: "bad" }` → default width
- `{ width: -1 }` → default width
- legacy `_v` missing → bleed/guides migration still works

Run: `npx tsx --test config/canvasDefaults.test.ts`

### Step 3: Surface save failures (optional but recommended)

Change `saveCanvasConfig` to return `boolean` or `{ ok: boolean }`. In `DesignEditor.tsx` `useEffect`, if save fails once, set a one-shot console warn or non-blocking toast state — do not spam alerts every render.

**Verify**: `npx tsc --noEmit` → exit 0.

## Done criteria

- [ ] Invalid localStorage config cannot produce NaN width/height
- [ ] New tests pass
- [ ] `npm run build` exits 0
- [ ] `plans/README.md` row 004 → DONE

## STOP conditions

- `CanvasConfig` type in `types.ts` lacks fields needed for validation — report required type updates.

## Maintenance notes

- Add `test` script to `package.json` in a separate DX plan: `"test": "tsx --test '**/*.test.ts'"`.

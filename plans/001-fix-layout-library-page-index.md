# Plan 001: Fix layout-library stale error and page-index drift

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step. If anything in the "STOP conditions" section occurs, stop and report — do not improvise. When done, update the status row for this plan in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 17cbc50..HEAD -- components/DesignEditor.tsx`
> If `DesignEditor.tsx` changed materially since this plan was written, compare excerpts before proceeding.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `17cbc50`, 2026-09-01

## Why this matters

After a successful layout save, the UI can still show a stale corruption warning because `refreshLayoutLibrary(saved.error)` prefers the pre-save error string. Separately, `elements` reads from a fallback page while `setElements` writes to `currentPage`, which can create sparse `pages` arrays if `currentPage` is ever out of range.

## Current state

- `components/DesignEditor.tsx` — monolithic editor; layout save at ~270–272 passes stale error into refresh.
- `components/DesignEditor.tsx:127-140` — read fallback vs write index mismatch.

Excerpt (save path):

```typescript
// DesignEditor.tsx ~270-272
const saved = loadUserLayoutTemplates();
storeUserLayoutTemplates([...saved.templates, template]);
refreshLayoutLibrary(saved.error);
```

Excerpt (refresh):

```typescript
// DesignEditor.tsx ~228-231
setLayoutLibrary({ templates: next.templates, error: error || next.error });
```

Excerpt (pages):

```typescript
// DesignEditor.tsx ~127-138
const elements = pages[currentPage] ?? pages[pages.length - 1] ?? [];
// ...
newPages[currentPage] = nextElements;
```

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Typecheck | `npx tsc --noEmit` | exit 0 |
| Layout tests | `npx tsx --test services/layoutTemplates.test.ts` | all tests pass |
| Build | `npm run build` | exit 0 |

## Scope

**In scope**:
- `components/DesignEditor.tsx`

**Out of scope**:
- `services/layoutTemplates.ts` (unless delete-no-op UX needs a one-line throw — defer)
- Broader DesignEditor decomposition (plan 003)

## Steps

### Step 1: Fix stale layout-library error after save

In `handleSaveLayoutTemplate`, after `storeUserLayoutTemplates`, call `refreshLayoutLibrary()` with **no argument** (or pass `null` explicitly). Only pass a non-null error when the current operation itself failed.

Change `refreshLayoutLibrary` so `error` parameter means “override with this error” only when non-null; when `null`/omitted, use `next.error` from `getLayoutTemplates()` alone. Avoid `error || next.error` if empty string is possible — use `error ?? next.error`.

**Verify**: `grep -n "refreshLayoutLibrary(saved.error)" components/DesignEditor.tsx` → no matches.

### Step 2: Clamp `currentPage` to valid range

Add a small helper or `useEffect` that runs when `pages.length` changes:

```typescript
if (currentPage >= pages.length) {
  setCurrentPage(Math.max(0, pages.length - 1));
}
```

Ensure `elements` and `setElements` use the same index — either clamp `currentPage` eagerly or derive `safePageIndex = Math.min(currentPage, pages.length - 1)` and use it in both read and write paths inside `setElements`.

**Verify**: `npx tsc --noEmit` → exit 0.

### Step 3: Manual sanity (no browser automation required)

Reason through: if `pages = [pageA]` and `currentPage = 5`, after fix `currentPage` becomes `0` and mutations hit `pages[0]`.

**Verify**: `npm run build` → exit 0.

## Test plan

- No new test file required if logic stays in component; optional unit test for a extracted `clampPageIndex(current, length)` in `utils/` if you extract it.
- Run existing: `npx tsx --test services/layoutTemplates.test.ts`.

## Done criteria

- [ ] `npx tsc --noEmit` exits 0
- [ ] `npm run build` exits 0
- [ ] No `refreshLayoutLibrary(saved.error)` after successful save
- [ ] `currentPage` cannot remain ≥ `pages.length`
- [ ] `plans/README.md` row 001 → DONE

## STOP conditions

- `DesignEditor.tsx` structure no longer matches excerpts (drift).
- Fix requires touching `layoutTemplates.ts` storage format.
- Typecheck fails twice after reasonable fix.

## Maintenance notes

- If plan 003 extracts `useLayoutLibrary`, move the refresh fix into that hook instead of duplicating.

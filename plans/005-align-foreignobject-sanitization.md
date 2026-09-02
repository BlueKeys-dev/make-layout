# Plan 005: Align foreignObject SVG sanitization with main SVG rules

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step. If anything in the "STOP conditions" section occurs, stop and report — do not improvise. When done, update the status row for this plan in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 17cbc50..HEAD -- utils/contentSecurity.ts`

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: security
- **Planned at**: commit `17cbc50`, 2026-09-01

## Why this matters

Mermaid class diagrams render labels inside `<foreignObject>`. The branch correctly stopped stripping them, but `sanitizeForeignObjectElement` applies weaker attribute rules than the main SVG loop — e.g. it does not strip `expression()` in inline styles. Defense-in-depth should match.

## Current state

- `utils/contentSecurity.ts` — `sanitizeForeignObjectElement` (~lines 40–70) strips `on*`, `javascript:` URLs, and some `style` `url()` / `@import`.
- Main SVG loop (~lines 147–160) also removes `expression()` and applies `hasUnsafeCssUrl` on all attributes.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Typecheck | `npx tsc --noEmit` | exit 0 |
| Build | `npm run build` | exit 0 |

## Scope

**In scope**:
- `utils/contentSecurity.ts`
- `utils/contentSecurity.test.ts` (new, if feasible without DOM — use `@xmldom/xmldom` only if already a dep; otherwise minimal string fixtures)

**Out of scope**:
- Changing Mermaid render pipeline
- `MindMapGenerator.tsx`

## Steps

### Step 1: Extract shared `isUnsafeSvgAttribute(name, value)` helper

Single function used by both `sanitizeForeignObjectElement` and the main attribute loop. Include:

- `on*` prefix
- `javascript:` / `vbscript:` / `data:` (with existing exceptions if any)
- `url(...)` not starting with `#`
- `expression(` and `@import` in value

**Verify**: `npx tsc --noEmit` → exit 0.

### Step 2: Apply helper inside foreignObject walk

Replace duplicated conditionals in `sanitizeForeignObjectElement` with the shared helper for every attribute on allowed tags.

**Verify**: add test fixture SVG with `<foreignObject><div style="width:expression(alert(1))">x</div></foreignObject>` → `expression` removed or element sanitized.

### Step 3: Regression check for class diagram labels

Fixture: foreignObject with plain `<div>Animal</div>` text must survive sanitization (labels still visible).

**Verify**: `npm run build` → exit 0.

## Test plan

- If no DOM test harness exists, add string-based tests that parse with browser-free XML or document expected serializer output substrings.
- Manual: class diagram in Mind Map generator still shows labels after sanitize.

## Done criteria

- [ ] foreignObject path uses same unsafe-attribute rules as main SVG path
- [ ] Class diagram labels still render (manual or fixture test)
- [ ] `npx tsc --noEmit` exits 0
- [ ] `plans/README.md` row 005 → DONE

## STOP conditions

- Shared helper breaks mindmap label rendering on real fixture — revert and report.

## Maintenance notes

- Any new SVG sanitization rule must be added only in `isUnsafeSvgAttribute`, not duplicated.

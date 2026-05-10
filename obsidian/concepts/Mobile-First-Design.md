---
type: concept
aliases: [Mobile First, Mobile-First]
---

# Mobile-First Design

The constraint that drives [[Public-Pages]] sizing decisions. Target device: **iPhone SE (375×667)**. Every text/spacing pair is `mobile-value sm:desktop-value`.

## Pattern
- Headings: `text-[20-22px] sm:text-[26-28px] font-extrabold leading-[1.15]`
- Sub-labels: `text-[10-11px] font-bold uppercase tracking-[0.22em]`
- Scale buttons: `min-h-[40px] sm:min-h-[48px]` rounded-xl border-2
- CSAT stars: `size-9 sm:size-12` (Lucide `<Star>`, gold stroke default)
- Inputs: `h-10 sm:h-12` rounded-xl border-2 — focus border swap to `var(--brand)` via inline `onFocus`/`onBlur` (NOT shadcn `<Input>` because focus must be brand-aware)
- Primary buttons: `h-12 sm:h-14`
- Logo circle: `124px` mobile / `152px` sm:; translate `-62px` mobile / `-76px` sm:
- Header height: `min(22vh, 180px)` mobile / `~32vh` sm:

## Spacing
- Outer wrapper: `space-y-5 sm:space-y-7` (or `space-y-4 sm:space-y-5` for tighter)
- Internal stacks: `space-y-2.5 sm:space-y-3`
- White-card padding: `pt-20 sm:pt-24`

## Test
DevTools → 375×667 device emulation **before pushing**. There's no CI yet ([[Build-and-Verify]]).

## Connects to
- [[Public-Pages]] — primary surface
- [[Hotfix-Trail]] — Hotfix-9 was the iPhone SE fix

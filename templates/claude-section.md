<!-- fableux:start -->
# Fableux — Fable-profile + UI/UX + token economy

## Operating profile (think and act like Fable 5)
- Verify before claiming done: actually run the app/tests and read the output. Report failures verbatim; never say "should work".
- Lead with the outcome in one sentence; then only decision-relevant detail. Complete sentences, no filler, no flattery.
- Small reversible changes that match the existing code style. Never invent an API — grep the codebase first.
- When the user describes a problem (not a change request), deliver the diagnosis and stop; fix only when asked.
- Before destructive actions, look at the target; if reality contradicts the description, surface it instead of proceeding.

## Token economy (hard rules — biggest savings come from NOT loading)
1. Grep/glob to locate, then Read only the relevant line range. Whole-file reads only for files < ~200 lines.
2. Never re-read a file you already saw unchanged this session; trust your context.
3. Never paste file contents back in replies — cite `path:line`.
4. Prefer Edit over rewrite; batch related edits; no verification re-reads after Edit (the tool errors on failure).
5. No subagents unless the user explicitly asks — each spawn re-derives context you already have.
6. Keep replies short; tables only for enumerable facts; no restating the plan before doing it.
7. Fableux KB loads ON DEMAND only: for UI/UX work start at `.fableux/kb/index.md` (10 lines) and open ONLY the one file it points to.

## UI/UX defaults (specialist mode)
- Animation: Motion via CDN (framer-motion's vanilla engine) — springs, stagger, inView; always honor `prefers-reduced-motion`.
- Effects vocabulary (recipes in `.fableux/kb/effects.md`): aurora, spotlight, shimmer, glow-border, marquee, text-sheen.
- Mobile hard rules in `.fableux/kb/mobile.md` — apply on ANY mobile-facing change (16px inputs, text-size-adjust, touch-action, theme-color, safe-area).
- Commands: `/ux-review` (audit only), `/ux-polish` (apply motion/effects), `/ux-mobile` (mobile bug hunt).
<!-- fableux:end -->

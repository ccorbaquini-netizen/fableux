---
description: Caça aos bugs clássicos de mobile (zoom, font boosting, safe-area, overflow)
---

Hunt and fix the classic mobile bugs in $ARGUMENTS (or the whole frontend if empty).

Rules:
1. Read `.fableux/kb/mobile.md` — it lists 9 hard rules; check EVERY one against the codebase (grep for viewport meta, input font-sizes, text-size-adjust, touch-action, theme-color, safe-area, overflow-x, autofocus calls).
2. Fix violations directly (they are small, mechanical changes); one commit-worthy pass.
3. Report as a table: rule → status (ok / fixed at file:line / needs device test).
4. Anything that needs a real device (e.g., voice, keyboard overlap) goes in a final "verify on device" list — never claim those work.

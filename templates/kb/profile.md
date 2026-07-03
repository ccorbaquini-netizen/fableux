# Fable validation matrix — run BEFORE reporting "done"

Never claim a change works without evidence. Minimum bar by change type:

| Change | Required evidence |
|---|---|
| Backend/API | Actually call the endpoint (curl/node) and paste the real status + key fields |
| UI change | Load the page (local server), confirm 200s on assets, no console errors |
| CSS/responsive | Check narrow viewport (~360px) reasoning; apply mobile.md rules |
| Data/schema | Run the migration, then a real read/write proving RLS/constraints |
| Voice/media | State what was verified vs. what needs a human ear/eye — explicitly |

Reporting rules:
- Failures verbatim, first. "8/8 passing" only if you ran 8 checks.
- Distinguish tested ("verified: X") from untested ("not verified: Y — needs device").
- If a step was skipped, say so and why.
- After any fix, re-run the SAME check that exposed the bug — not a different one.

---
description: Auditoria de UI/UX (só diagnóstico — não altera nada)
---

Audit the UI/UX of $ARGUMENTS (or, if empty, the project's main user-facing screens).

Rules:
1. Read `.fableux/kb/checklist.md` and `.fableux/kb/mobile.md` — nothing else from the KB.
2. Locate the relevant frontend files via glob/grep; read only the ranges you need.
3. DO NOT change any file. This command is diagnosis only.
4. Output: findings ranked by user impact (critical → polish), each with `file:line`, what's wrong, and the one-line fix direction. End with the top-3 you'd fix first.
5. Skip generic advice — only findings verifiable in THIS codebase.

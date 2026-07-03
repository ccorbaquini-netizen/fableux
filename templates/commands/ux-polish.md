---
description: Aplicar movimento e efeitos (Motion + vocabulário 21st.dev) no alvo indicado
---

Apply motion/effects polish to $ARGUMENTS (a screen, component or page).

Rules:
1. Read `.fableux/kb/motion.md` and `.fableux/kb/effects.md` — nothing else from the KB.
2. Prefer CSS-only micro-interactions; use Motion (CDN) only where springs/stagger/inView add real value.
3. Respect the project's existing design tokens/colors — adapt recipes, don't impose new palettes.
4. Always include the `prefers-reduced-motion` guard.
5. Entrances < 700ms; never animate layout-shifting properties on scroll containers.
6. After editing, verify per `.fableux/kb/profile.md` (load the page, assets 200, no console errors) and report what was verified.

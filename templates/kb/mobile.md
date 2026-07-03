# Mobile hard rules — every one of these is a real production bug

1. **Inputs ≥ 16px on mobile** — any focusable field with font-size < 16px makes iOS/Android auto-zoom on focus.
   ```css
   @media (max-width: 820px) { input, select, textarea { font-size: 16px; } }
   ```
2. **Kill font boosting** — Chrome Android inflates text in text-heavy blocks (chats, articles) making ONE screen look "zoomed":
   ```css
   html { -webkit-text-size-adjust: 100%; text-size-adjust: 100%; }
   ```
3. **No accidental zoom** — `html, body { touch-action: manipulation; }` kills double-tap zoom. For app-like screens also
   `<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">`.
4. **No autofocus on touch** — focusing an input opens the keyboard (+ zoom). Gate: `if (matchMedia('(pointer: fine)').matches) el.focus();`
   Also `document.activeElement?.blur?.()` when switching SPA views.
5. **OS bars match the theme** — `<meta name="theme-color" content="#0b0e1a">` + `<meta name="color-scheme" content="dark">`.
6. **Safe areas** — fixed bottom bars need `padding-bottom: calc(8px + env(safe-area-inset-bottom));`.
7. **No horizontal overflow** — `body { overflow-x: hidden; }` and every flex child that must shrink gets `min-width: 0;`.
8. **Hit targets ≥ 44px**; hover-only affordances need a touch equivalent.
9. Test at 360px width AND with the keyboard open before calling it done.

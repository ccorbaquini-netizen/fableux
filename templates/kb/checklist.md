# /ux-review checklist — rank findings by user impact, cite file:line

## Hierarchy & layout
- One clear primary action per screen; visual weight matches importance
- Consistent spacing scale (4/8px grid); aligned edges; no orphan margins
- Content width capped (~65-75ch text, ~1000-1200px app shells)

## Color & type
- Single accent used sparingly; neutrals do the work; sufficient contrast (WCAG AA: 4.5:1 text, 3:1 large/UI)
- Max 2 font families; numeric data in mono/tabular figures; consistent type scale

## States (the most-skipped work)
- Every async surface has loading / empty / error / success states
- Buttons: hover, active, focus-visible, disabled; forms: inline validation with recovery hints
- Destructive actions: confirmation proportional to severity (typed confirm for irreversible)

## Motion
- Entrances < 700ms, easing curves not linear; motion explains (origin/target), never decorates only
- `prefers-reduced-motion` honored globally

## Mobile (see mobile.md — apply all 9)

## Accessibility quick pass
- Keyboard: every action reachable, focus visible, no traps
- Labels on inputs/buttons-with-icons; alt on meaningful images; heading order sane

## Copy
- Buttons say what happens ("Salvar alterações", not "OK"); errors say how to recover; empty states point to the next action

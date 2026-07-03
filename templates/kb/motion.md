# Motion — framer-motion's engine, vanilla JS (no React, no build)

```js
import { animate, inView, stagger } from 'https://cdn.jsdelivr.net/npm/motion@12/+esm';
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
```
Gate every helper with `if (reduced) return;`.

## Cascade (staggered entrance, no scroll dependency)
```js
animate([...els],
  { opacity: [0, 1], transform: ['translateY(24px)', 'translateY(0)'] },
  { duration: .65, delay: stagger(.08), ease: [0.22, 1, 0.36, 1] });
```
Set `el.style.opacity = '0'` on targets BEFORE animating to avoid flash.

## Scroll reveal
```js
inView(el, () => animate(el, { opacity: [0,1], transform: ['translateY(28px)','translateY(0)'] },
  { duration: .7, ease: [0.22,1,0.36,1] }), { amount: .25 });
```

## Count-up (stats)
```js
animate(0, target, { duration: 1, ease: [0.22,1,0.36,1],
  onUpdate: (v) => { el.textContent = Math.round(v); } });
```

## Progress ring (SVG stroke)
```js
// circle: stroke-dasharray = C; start stroke-dashoffset = C
animate(C, C * (1 - pct / 100), { duration: 1.2, ease: [0.22,1,0.36,1],
  onUpdate: (v) => { circle.style.strokeDashoffset = v; } });
```

## 3D tilt on hover
```js
el.addEventListener('mousemove', (e) => {
  const r = el.getBoundingClientRect();
  const rx = ((e.clientY - r.top) / r.height - .5) * -7, ry = ((e.clientX - r.left) / r.width - .5) * 7;
  animate(el, { transform: `perspective(900px) rotateX(${rx}deg) rotateY(${ry}deg)` }, { duration: .3 });
});
el.addEventListener('mouseleave', () =>
  animate(el, { transform: 'perspective(900px) rotateX(0) rotateY(0)' }, { duration: .6 }));
```

## Micro-interactions via CSS (cheaper than JS — prefer when enough)
```css
.pop { animation: pop .35s cubic-bezier(.34,1.56,.64,1); }
@keyframes pop { from { opacity: 0; transform: translateY(10px) scale(.96); } }
```

## Confetti (celebrations) — ~30-line canvas, no lib
Spawn ~90 colored rects at center, random velocity, gravity +.35/frame, fade with
`ctx.globalAlpha = 1 - t/duration`, remove canvas at end. Trigger on goals/highscores only.

# Effects recipes (21st.dev-style, plain CSS — adapt tokens to the project)

## Aurora (ambient background glow)
```css
.hero { position: relative; }
.hero::before {
  content: ''; position: absolute; width: 520px; height: 520px; top: -140px; left: -120px;
  border-radius: 50%; filter: blur(90px); opacity: .35; z-index: -1; pointer-events: none;
  background: radial-gradient(circle, var(--accent) 0%, transparent 65%);
  animation: aurora 14s ease-in-out infinite alternate;
}
@keyframes aurora { to { transform: translate(90px, 50px) scale(1.25); } }
```
Use 2 blobs (::before/::after) with different colors, sizes and durations.

## Spotlight (radial glow follows cursor)
```css
.fx-spotlight { position: relative; overflow: hidden; }
.fx-spotlight::before {
  content: ''; position: absolute; inset: 0; pointer-events: none; opacity: 0; transition: opacity .3s;
  background: radial-gradient(320px circle at var(--mx,50%) var(--my,50%), rgba(80,140,255,.15), transparent 65%);
}
.fx-spotlight:hover::before { opacity: 1; }
```
```js
el.addEventListener('mousemove', (e) => {
  const r = el.getBoundingClientRect();
  el.style.setProperty('--mx', `${e.clientX - r.left}px`);
  el.style.setProperty('--my', `${e.clientY - r.top}px`);
});
```

## Shimmer (sheen sweeps across a button)
```css
.btn-shimmer { position: relative; overflow: hidden; }
.btn-shimmer::after {
  content: ''; position: absolute; top: 0; left: -80%; width: 50%; height: 100%;
  background: linear-gradient(105deg, transparent, rgba(255,255,255,.5), transparent);
  transform: skewX(-20deg); animation: shimmer 3.2s ease-in-out infinite;
}
@keyframes shimmer { 0%,60% { left: -80%; } 100% { left: 160%; } }
```

## Glow border (gradient border — ONLY reliable technique, works on mobile)
Never use a ::after with negative z-index (paints OVER the background on mobile Chrome).
```css
.glow-card {
  border: 1.5px solid transparent; border-radius: 22px;
  background:
    linear-gradient(var(--surface), var(--surface)) padding-box,
    conic-gradient(from 210deg, var(--accent2), var(--accent) 25%, rgba(80,140,255,.12) 45%, rgba(80,140,255,.12) 60%, var(--accent2)) border-box;
}
```

## Marquee (infinite strip; duplicate content once in JS)
```css
.marquee { overflow: hidden; mask-image: linear-gradient(90deg, transparent, #000 12%, #000 88%, transparent); }
.marquee-track { display: flex; gap: 26px; white-space: nowrap; animation: marquee 26s linear infinite; }
.marquee:hover .marquee-track { animation-play-state: paused; }
@keyframes marquee { to { transform: translateX(-50%); } }
```

## Text sheen (gradient sweeps through headline word)
```css
.sheen {
  background: linear-gradient(120deg, var(--accent), var(--accent2), var(--accent));
  background-size: 200% auto; -webkit-background-clip: text; background-clip: text; color: transparent;
  animation: sheen 4s linear infinite;
}
@keyframes sheen { to { background-position: 200% center; } }
```

## Always
```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation: none !important; transition: none !important; }
}
```

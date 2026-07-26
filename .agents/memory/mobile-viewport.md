---
name: Mobile viewport handling
description: How to keep a mobile-web wallet layout from clipping or locking the viewport on iOS/Android.
---

For a mobile-web crypto wallet, avoid `height: 100dvh` combined with `overflow: hidden` on `html`/`body`. It can clip content when the dynamic toolbar shrinks or when the on-screen keyboard appears.

**Rule:**
- Use `min-height: 100dvh` (and `100svh` as a fallback) on the root wrapper.
- Use `overflow-x: hidden` rather than `overflow: hidden` so vertical scrolling still works.
- Set an explicit `viewport` export in `layout.tsx` with `width: 'device-width'`, `initialScale: 1`, and `viewportFit: 'cover'`.
- Add `touch-action: pan-y` to prevent accidental horizontal swipe gestures while keeping vertical scrolling.

**Why:** A locked viewport causes the app to feel broken on different mobile screen ratios and when the keyboard is open. The explicit Next.js `viewport` export also ensures the meta tag is server-rendered consistently.

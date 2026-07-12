# 008 — Count-up animation on numeric stats

- **Status**: DONE
- **Commit**: 6963320
- **Severity**: Missed opportunity (additive)
- **Category**: Missed opportunities
- **Estimated scope**: 1 file (index.html), stats markup + small JS addition

## Problem

```html
<!-- index.html:2714-2734 — current -->
<div class="stats-bar">
  <div class="stats-inner">
    <div class="stat-item reveal">
      <span class="stat-num">8°</span>
      <span class="stat-label">Grado Black Belt</span>
    </div>
    <div class="stat-item reveal reveal-delay-1">
      <span class="stat-num">+20</span>
      <span class="stat-label">Años de Tradición</span>
    </div>
    <div class="stat-item reveal reveal-delay-2">
      <span class="stat-num">20+</span>
      <span class="stat-label">Escuelas en Chile</span>
    </div>
    <div class="stat-item reveal reveal-delay-3">
      <span class="stat-num">∞</span>
      <span class="stat-label">Vías del Kenpo</span>
    </div>
  </div>
</div>
```

These are the site's credibility numbers — the first hard evidence a visitor
sees, right after the hero. Today they're static text that fades up with the
rest of `.reveal`; nothing communicates "these are counted, real numbers."

Two of the four (`8°` grade, `∞`) are not counts and should NOT be animated —
counting up a black-belt degree or an infinity symbol either looks silly or
is literally impossible. Only `+20` (años) and `20+` (escuelas) are true
counts and are the only two in scope.

## Target

```html
<!-- target: index.html:2721-2727 — add data-count-to, wrap number in a span the JS can target -->
<div class="stat-item reveal reveal-delay-1">
  <span class="stat-num" data-count-to="20" data-count-prefix="+">+0</span>
  <span class="stat-label">Años de Tradición</span>
</div>
<div class="stat-item reveal reveal-delay-2">
  <span class="stat-num" data-count-to="20" data-count-suffix="+">0+</span>
  <span class="stat-label">Escuelas en Chile</span>
</div>
```

Leave the `8°` and `∞` `stat-item` blocks completely unchanged.

```js
/* target: add near the existing IntersectionObserver reveal logic,
   index.html ~line 3662 (`entries.forEach(e => { if(e.isIntersecting)
   e.target.classList.add('visible'); });`) */
const countObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (!entry.isIntersecting) return;
    const el = entry.target;
    countObserver.unobserve(el);
    if (prefersReducedMotion) return; // leave final value as rendered in HTML
    const target = Number(el.dataset.countTo);
    const prefix = el.dataset.countPrefix || '';
    const suffix = el.dataset.countSuffix || '';
    const duration = 1200;
    const start = performance.now();
    function tick(now) {
      const elapsed = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - elapsed, 3); // ease-out cubic
      el.textContent = prefix + Math.round(target * eased) + suffix;
      if (elapsed < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  });
}, { threshold: 0.5 });
document.querySelectorAll('[data-count-to]').forEach(el => countObserver.observe(el));
```

This reuses the file's existing `prefersReducedMotion` constant (already
declared at index.html:3615) so reduced-motion users see the static final
number immediately with no counting motion, per the accessibility rule
("reduced motion means fewer/gentler, not necessarily zero" — here the safe
choice is to skip straight to the end state since a numeric count-up is pure
decoration with no comprehension value being lost by omitting it).

## Repo conventions to follow

- The file already has one IntersectionObserver wired up for `.reveal`
  (~line 3662) — this plan adds a second, separate observer rather than
  overloading the existing one, since the reveal observer fires on `0`
  threshold-ish visibility while a count-up reads better triggered around
  50% visibility (`threshold: 0.5`) so it doesn't fire while the element is
  barely peeking into view.
- `prefersReducedMotion` (index.html:3615) is the file's existing reduced-motion
  check — reuse it, do not redeclare `window.matchMedia(...)` again.

## Steps

1. In the stats bar HTML (index.html ~line 2717-2734), add `data-count-to`,
   and `data-count-prefix`/`data-count-suffix` attributes to the "Años de
   Tradición" and "Escuelas en Chile" `.stat-num` spans only, exactly as
   shown in Target. Change their static text content to the zero-state
   (`+0` and `0+` respectively) since JS will fill in the counted value.
2. Leave the "8° Grado Black Belt" and "∞ Vías del Kenpo" stat items
   completely untouched — no `data-count-to` attribute, no text change.
3. Add the `countObserver` JS block from Target near the existing reveal
   IntersectionObserver setup (~line 3662), after `prefersReducedMotion` is
   already declared (~line 3615).
4. Verify `prefersReducedMotion` in this file is a `const` boolean already
   computed once at script load (index.html:3615) — do not recompute per
   element.

## Boundaries

- Do NOT animate the `8°` or `∞` stat items.
- Do NOT change `.stat-item`'s existing `.reveal`/`.reveal-delay-N` classes —
  the fade-up-on-scroll behavior stays; count-up is additive, layered on top,
  triggered by its own separate observer.
- Do NOT introduce a counting library/dependency — vanilla `requestAnimationFrame`
  only, matching the rest of the file's plain-JS approach.

## Verification

- **Mechanical**: open `index.html` in a browser, open the console, confirm
  no errors on scroll.
- **Feel check**:
  - Scroll the stats bar into view — "Años de Tradición" should count up
    from 0 to 20 over ~1.2s with an ease-out (fast start, slow finish) feel,
    landing exactly on `+20`; "Escuelas en Chile" should do the same landing
    on `20+`.
  - Scroll away and back — counters must NOT re-trigger and re-count (the
    `unobserve` call in step 3's JS ensures single-fire).
  - Force `prefers-reduced-motion: reduce` (DevTools Rendering panel) and
    reload — both counters should show their final values (`+20`, `20+`)
    immediately with no counting animation.
  - Confirm "8°" and "∞" stat items behave exactly as before (fade up via
    `.reveal`, static text, untouched).
- **Done when**: both numeric stats count up on first scroll-into-view only,
  landing on the correct final text, and the non-numeric stats are
  unaffected.

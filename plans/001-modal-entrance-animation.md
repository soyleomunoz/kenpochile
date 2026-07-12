# 001 — Add fade+scale entrance animation to modals

- **Status**: DONE
- **Commit**: 6963320
- **Severity**: HIGH
- **Category**: Physicality & origin / Missed opportunity
- **Estimated scope**: 1 file (index.html), 2 selectors + shared close logic

## Problem

`#lightbox` and `.instructor-modal` (the photo lightbox, belt-chart lightbox, and
instructor bio modal — the most frequently triggered interactive surface on the
site) toggle visibility with a hard `display: none` → `display: flex` swap.
`display` cannot be transitioned, so the modal teleports instantly into view
with no fade or scale, and disappears the same way.

```css
/* index.html:1180-1187 — current */
#lightbox {
  display: none; position: fixed; inset: 0;
  background: rgba(0,0,0,0.92);
  z-index: 10000;
  align-items: center; justify-content: center;
  backdrop-filter: blur(10px);
}
#lightbox.open { display: flex; }
```

```css
/* index.html:1260-1267 — current (same pattern) */
.instructor-modal { /* ... */ }
.instructor-modal.open { display: flex; }
```

Content wrapper (no transform-origin/entrance):

```css
/* index.html:1193-1202 */
.lightbox-content {
  position: relative;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 2rem;
  max-width: 500px; width: 90%;
  max-height: 90vh; overflow: hidden;
  text-align: center;
}
```

## Target

Keep `display: none` for true removal from the accessibility/layout tree when
fully closed, but drive the open/close transition through opacity + scale on
both the overlay and its content box, using an intermediate `.is-open` class
so the browser has a state to transition to/from. Modals are centered, so
`transform-origin: center` (the default) is correct — do not add a trigger-based origin.

```css
/* target: index.html — replace #lightbox / .lightbox-content block */
#lightbox {
  display: none; position: fixed; inset: 0;
  background: rgba(0,0,0,0.92);
  z-index: 10000;
  align-items: center; justify-content: center;
  backdrop-filter: blur(10px);
  opacity: 0;
  transition: opacity 220ms var(--ease-out);
}
#lightbox.open { display: flex; }
#lightbox.is-open { opacity: 1; }
#lightbox.lb-chart { /* unchanged */ }

.lightbox-content {
  /* ...existing declarations unchanged... */
  transform: scale(0.94);
  transition: transform 220ms var(--ease-out);
}
#lightbox.is-open .lightbox-content { transform: scale(1); }
```

```css
/* target: same pattern for .instructor-modal */
.instructor-modal {
  /* ...existing declarations unchanged... */
  opacity: 0;
  transition: opacity 220ms var(--ease-out);
}
.instructor-modal.open { display: flex; }
.instructor-modal.is-open { opacity: 1; }

.instructor-modal-content {
  /* ...existing declarations unchanged... */
  transform: scale(0.94);
  transition: transform 220ms var(--ease-out);
}
.instructor-modal.is-open .instructor-modal-content { transform: scale(1); }
```

This depends on plan 004's `--ease-out` token existing in `:root`. If plan 004
has not been applied yet, use the literal value instead:
`transition: opacity 220ms cubic-bezier(0.23, 1, 0.32, 1);` (and same for transform).

## Repo conventions to follow

- Motion tokens live in `:root` alongside color tokens (index.html:27-39); add
  `--ease-out` there (see plan 004).
- The codebase already uses the "two-class" open pattern elsewhere
  (`.section-search-box.open`, `.faq-item.open`) — this plan extends that
  pattern with a second class (`is-open`) purely to give CSS a transition target,
  since `display` itself can't animate.

## Steps

1. In `index.html`, find the JS functions that add/remove `.open` on
   `#lightbox` and `.instructor-modal` (search for `classList.add('open')` /
   `classList.remove('open'` — occurrences near line 3779, 3785, 4869, 4875).
   For every place that adds `'open'`, also add `'is-open'` **one frame later**
   using `requestAnimationFrame`, e.g.:
   ```js
   lb.classList.add('open');
   requestAnimationFrame(() => requestAnimationFrame(() => lb.classList.add('is-open')));
   ```
   (double rAF ensures the browser has painted the `display: flex` state
   before the opacity/transform transition starts — otherwise it can't
   transition from 0.)
2. For every place that removes `'open'`, instead: remove `'is-open'`
   immediately, then remove `'open'` after the transition duration (220ms)
   via `setTimeout`, e.g.:
   ```js
   lb.classList.remove('is-open');
   setTimeout(() => lb.classList.remove('open', 'lightbox-gallery', 'lb-chart'), 220);
   ```
   Preserve every class currently being removed alongside `'open'` in the
   existing code — only change the timing/mechanism, not which classes are
   removed.
3. Add the CSS shown in Target above for both `#lightbox` and
   `.instructor-modal` and their `-content` wrappers.
4. Repeat step 1-2's rAF/setTimeout pattern for any other `.open`-toggling
   modal-like element that shares this exact instant-teleport issue (verify
   there are only these two before extending scope).

## Boundaries

- Do NOT change modal markup, content, or z-index stacking.
- Do NOT add a trigger-anchored `transform-origin` — modals are exempt and
  should scale from center.
- Do NOT touch non-modal `.open` toggles (`.section-search-box`, `.faq-item`,
  `.mobile-menu`) — out of scope for this plan.
- If the JS `classList.add('open')` call sites have drifted from the line
  numbers cited, search by string instead of assuming line numbers.

## Verification

- **Mechanical**: open `index.html` directly in a browser (no build step).
- **Feel check**: click an instructor card to open its modal, and a school
  badge to open the belt-chart lightbox:
  - Modal should visibly fade+grow from 94% to 100% scale, not snap.
  - Closing should fade+shrink out over the same 220ms, not vanish instantly.
  - Rapidly double-click a trigger — the modal must not get stuck between
    states or throw a console error (double rAF + matching setTimeout should
    prevent this for a single modal; if the user can trigger two opens before
    the close completes, verify it still recovers).
  - In DevTools Rendering panel, force `prefers-reduced-motion: reduce` and
    confirm the modal still appears/disappears (near-instantly, per the
    site's existing global reduced-motion rule at index.html:97-104) with no
    stuck opacity-0 state.
- **Done when**: both modal types fade+scale in and out instead of
  instant-toggling, with no visual "stuck at 0 opacity" regressions.

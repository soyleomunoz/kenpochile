# 005 — Add `:active` press feedback to primary interactive elements

- **Status**: DONE
- **Commit**: 6963320
- **Severity**: MEDIUM
- **Category**: Physicality & origin / Missed opportunity
- **Estimated scope**: 1 file (index.html), 4 selectors

## Problem

No selector in `index.html` defines an `:active` state (confirmed: zero
matches for `:active` in the whole file). Every button has a `:hover` lift
(`transform: translateY(-2px)`) but nothing happens on press. On touch
devices, `:hover` never fires at all, so mobile users — likely the majority
of visitors to a local martial-arts landing page — get zero tactile
confirmation when tapping the primary CTA.

```css
/* index.html:356-373 — current */
.btn-primary {
  /* ... */
  transition: all 0.3s;
  /* ... */
}
.btn-primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 35px var(--glow-primary);
}
```

Same pattern for `.btn-outline` (index.html:374-393) and `.btn-submit`
(index.html:2249-2253, contact form submit button).

## Target

```css
/* target: append after each existing :hover rule */
.btn-primary:active {
  transform: scale(0.97);
  box-shadow: 0 4px 20px var(--glow-primary);
}
.btn-outline:active {
  transform: scale(0.97);
  background: rgba(245,166,35,0.12);
}
.btn-submit:active {
  transform: scale(0.97);
}
```

Keep the press scale subtle (0.95-0.98 range per audit) and symmetric with a
fast return — no separate transition duration is needed since these buttons
already transition `transform` (once plan 002 narrows `transition: all`) at
0.3s, which is fine for press-and-release on a marketing CTA (not a
high-frequency UI control where 100-160ms would be required).

## Repo conventions to follow

- Buttons already share the `transform: translateY(-Npx)` hover-lift
  convention; `:active` should use `scale()` instead of `translateY` so press
  reads as "pressing into the surface" rather than "lifting further," which
  would look wrong stacked with the hover lift.

## Steps

1. Add `.btn-primary:active { transform: scale(0.97); box-shadow: 0 4px 20px
   var(--glow-primary); }` immediately after `.btn-primary:hover` (index.html
   ~line 373).
2. Add `.btn-outline:active { transform: scale(0.97); background:
   rgba(245,166,35,0.12); }` immediately after `.btn-outline:hover` (index.html
   ~line 393).
3. Find `.btn-submit:hover` (index.html ~line 2249-2253) and add
   `.btn-submit:active { transform: scale(0.97); }` immediately after it.
4. Do not add `:active` to hover-lift cards (`.escuela-card`,
   `.maestro-card`, etc.) — cards are not primary tap targets in the same
   sense and are out of scope for this plan.

## Boundaries

- Do NOT add `:active` states beyond the three buttons named above.
- Do NOT change `:hover` rules — only add new `:active` rules alongside them.
- Do NOT wrap in `@media (hover: hover)` — `:active` is safe on touch by
  definition (it only fires on actual press), unlike `:hover`.

## Verification

- **Mechanical**: none (pure CSS addition, no build).
- **Feel check**:
  - On desktop, click and hold the primary CTA ("Clase de prueba gratis" or
    equivalent) — button should visibly compress (scale down slightly) while
    held, and return to normal (or hover state, if cursor still over it) on
    release.
  - On a real touch device (or Chrome DevTools device emulation with touch),
    tap the same button — must show the press-compress feedback even though
    `:hover` never applies.
  - Confirm the outline button and the contact form submit button show the
    same behavior.
- **Done when**: all three buttons visibly compress on press, on both mouse
  and touch input.

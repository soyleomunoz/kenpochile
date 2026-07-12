# 009 — Stagger newly-rendered escuela cards

- **Status**: DONE
- **Commit**: 6963320
- **Severity**: Missed opportunity (additive)
- **Category**: Cohesion & tokens
- **Estimated scope**: 1 file (index.html), 1 render function + 1 selector

## Problem

```js
/* index.html:4088-4096 — current */
grid.innerHTML = pageItems.map(e => `
  <div class="escuela-card">
    <div class="escuela-icon"><img src="img/escuelas-insignias/${e.insignia}" alt="Insignia ${e.nombre}" loading="lazy" decoding="async"></div>
    <div class="escuela-nombre">${e.nombre}</div>
    <div class="escuela-director">Dir. ${e.director}</div>
    <div class="escuela-ciudad"><svg class="icon"><use href="#icon-map-pin"/></svg> ${e.lugar}, ${e.region}</div>
    <a href="#contacto" class="btn-escuela" data-escuela="${escuelaLabel(e)}">Inscribirme</a>
  </div>`).join('');
```

```css
/* index.html:868 — current */
.escuela-card { animation: fade-up 0.4s ease both; }
```

When a user filters or paginates the "Nuestras Escuelas" grid, the whole
`innerHTML` is replaced (up to 8 cards, `ESCUELAS_PAGE_SIZE = 8`,
index.html:3902). Each new `.escuela-card` re-triggers its own `fade-up`
entrance since it's a fresh DOM node — good — but all cards animate with the
exact same 0-delay, so up to 8 cards pop in in perfect unison rather than
reading as a considered reveal. A 30-80ms stagger (per audit cohesion rule)
is a decorative, non-blocking addition that reads as more deliberate.

## Target

```js
/* target: index.html:4088-4096 — add inline animation-delay per card index */
grid.innerHTML = pageItems.map((e, i) => `
  <div class="escuela-card" style="animation-delay:${i * 50}ms">
    <div class="escuela-icon"><img src="img/escuelas-insignias/${e.insignia}" alt="Insignia ${e.nombre}" loading="lazy" decoding="async"></div>
    <div class="escuela-nombre">${e.nombre}</div>
    <div class="escuela-director">Dir. ${e.director}</div>
    <div class="escuela-ciudad"><svg class="icon"><use href="#icon-map-pin"/></svg> ${e.lugar}, ${e.region}</div>
    <a href="#contacto" class="btn-escuela" data-escuela="${escuelaLabel(e)}">Inscribirme</a>
  </div>`).join('');
```

```css
/* index.html:868 — unchanged, `both` already ensures the delayed start holds at
   the from-state instead of flashing the final state before its delay elapses */
.escuela-card { animation: fade-up 0.4s ease both; }
```

50ms per card × up to 8 cards = 400ms max added delay on the last card,
staying well within a stagger's role as decorative rather than blocking
(per the audit: "Stagger is decorative — it must never block interaction" —
the grid and pager remain immediately clickable throughout; only the visual
fade-in is delayed per-card, nothing is disabled).

Once plan 004 lands, `fade-up`'s `ease` becomes `var(--ease-out)` — no
further change needed here, this plan's `animation-delay` addition is
independent of that timing-function swap.

## Repo conventions to follow

- Inline `style="animation-delay:...ms"` on dynamically-rendered cards has no
  prior example in this file (existing staggers use static `.reveal-delay-N`
  classes for fixed, known counts) — but since escuela card count per page is
  dynamic (0-8 depending on filter results), a computed inline style is the
  only pattern that scales to a variable list without predefining 8 CSS
  classes. Keep it to this one JS-rendered grid; do not add
  `.reveal-delay-N`-style classes for this case.

## Steps

1. In `renderEscuelasGridAndPager()` (index.html ~line 4074-4098), change the
   `.map(e => ...)` callback to `.map((e, i) => ...)` and add
   `style="animation-delay:${i * 50}ms"` to the `.escuela-card` div's
   opening tag, exactly as shown in Target.
2. Do not change `.escuela-card`'s CSS rule (index.html:868) — `both` fill
   mode is already correct for this to work.

## Boundaries

- Do NOT add stagger to any other dynamically-rendered grid (seminarios,
  videos, blogs, instructores) unless a follow-up plan explicitly covers
  them — this plan is scoped to `renderEscuelasGridAndPager` only.
- Do NOT change `ESCUELAS_PAGE_SIZE` or pagination logic.
- Do NOT make the stagger delay depend on anything other than array index
  `i` (e.g. do not randomize it — deterministic left-to-right/top-to-bottom
  reading order is the point).

## Verification

- **Mechanical**: none.
- **Feel check**: on the "Nuestras Escuelas" section, change the país/región
  filter (or paginate) so the grid re-renders — cards should visibly cascade
  in with a short ripple (top-left to bottom-right-ish, depending on grid
  flow) instead of all popping in simultaneously. With 8 results the last
  card should start ~400ms after the first, still finishing well under 1s
  total.
  - Confirm the grid and "Inscribirme" links are clickable immediately, even
    on cards still mid-fade (stagger must not block interaction).
- **Done when**: cards in a freshly-rendered escuela grid fade in with a
  visible per-card cascade rather than all at once.

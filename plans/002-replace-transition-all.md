# 002 — Replace `transition: all` with explicit properties

- **Status**: DONE
- **Commit**: 6963320
- **Severity**: HIGH
- **Category**: Performance
- **Estimated scope**: 1 file (index.html), 33 selectors

## Problem

`transition: all` appears 33 times across `index.html` (buttons, cards, tabs,
chips, nav links). It transitions every animatable property that changes on
the element, including ones the author didn't intend, and prevents the
browser/engineer from reasoning about what's actually moving.

Representative instances:

```css
/* index.html:113 */
.navbar { transition: all 0.4s ease; }
/* index.html:176 */
.nav-cta { transition: all 0.3s !important; }
/* index.html:367 */
.btn-primary { transition: all 0.3s; }
/* index.html:385 */
.btn-outline { transition: all 0.3s; }
/* index.html:656, 794, 860, 882, 981, 1008, 1095, 1125, 1242, 1340, 1412, 1447, 1477, 1585, 1604, 1860, 1914, 2074, 2249, 2289, 2340, 2354(*transform only, skip), 2370, 2490, 2516 */
/* ...same pattern: transition: all 0.3s|0.4s; */
```

## Target

Replace each `transition: all <dur>` with the exact set of properties that
selector's `:hover`/`.active`/`.open` rule actually changes, keeping the same
duration. Determine the property list by reading the paired hover/active rule
immediately following each declaration.

```css
/* target, e.g. index.html:367 btn-primary (hover changes transform + box-shadow) */
.btn-primary { transition: transform 0.3s, box-shadow 0.3s; }

/* target, e.g. index.html:113 navbar (hover/scroll changes background + box-shadow + backdrop-filter — check actual .scrolled rule) */
.navbar { transition: background 0.4s, box-shadow 0.4s, backdrop-filter 0.4s; }
```

Common patterns you will find repeatedly (cards, tabs, chips): the hover rule
only changes `color`, `border-color`, `background`, `transform`, and/or
`box-shadow` — never more than those five. List exactly the ones present for
each selector; do not add properties that aren't changed anywhere for that
class.

## Repo conventions to follow

- Keep the existing duration value (`0.3s` / `0.4s`) exactly as-is — this plan
  only narrows the property list, it does not change timing.
- `!important` on `.nav-cta` (line 176) must be preserved on the replacement
  (`transition: transform 0.3s, box-shadow 0.3s !important;`).

## Steps

1. Grep `index.html` for `transition: all` to get the current full list of
   line numbers (line numbers below may have shifted if plan 001 or others
   ran first — re-grep before editing).
2. For each match, read the block's paired `:hover`, `.active`, `.open`, or
   `:focus-visible` rule(s) directly below it to see which properties actually
   change.
3. Replace `transition: all <dur>[ !important]` with
   `transition: <prop1> <dur>, <prop2> <dur>[, ...][ !important];` listing only
   the properties found in step 2.
4. If a selector's hover rule changes a property that is expensive to animate
   directly (e.g. `background` gradient swap) but the change is a simple
   composite-friendly property, keep it as-is — this plan is about removing
   `all`, not re-architecting which properties animate (that's out of scope).

## Boundaries

- Do NOT change durations or easing — that's plan 004's job (tokens) and
  should not be conflated with this mechanical narrowing.
- Do NOT touch selectors that already list explicit properties (e.g.
  `index.html:770 .maestro-link { transition: gap 0.3s; }`) — only ones using
  the bare `all` keyword.
- Do NOT add vendor prefixes or new properties not already changing on
  interaction.

## Verification

- **Mechanical**: `grep -c "transition: all" index.html` should return `0`
  when done (open `index.html` in a text editor / use your editor's search).
- **Feel check**: open `index.html` in a browser, hover every button/card
  type touched (primary/outline buttons, escuela/maestro/instructor/video/blog
  cards, país/región tabs, comuna chips, nav links) and confirm the same
  visual hover effect still occurs with no missing property (e.g. a card that
  used to also fade a border color should still fade it, not snap).
- **Done when**: zero `transition: all` occurrences remain and every hover
  effect visually matches pre-change behavior.

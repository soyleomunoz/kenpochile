# 003 — Fix FAQ accordion: layout-triggering transition + hardcoded height cap

- **Status**: DONE
- **Commit**: 6963320
- **Severity**: HIGH
- **Category**: Performance / Correctness
- **Estimated scope**: 1 file (index.html), 1 component (~3 selectors)

## Problem

```css
/* index.html:2129-2134 — current */
.faq-a {
  max-height: 0; overflow: hidden;
  transition: max-height 0.4s ease, padding 0.3s;
  padding: 0 1.5rem;
}
.faq-item.open .faq-a { max-height: 300px; padding: 0 1.5rem 1.2rem; }
```

Two problems: (1) animating `max-height` triggers layout on every frame
instead of compositor-only work; (2) `300px` is a hardcoded cap — any FAQ
answer whose rendered height exceeds 300px gets visually clipped.

## Target

Use the CSS grid `0fr → 1fr` technique, which animates a track size (GPU-cheap
relative to `height`/`max-height` reflow patterns) and has no hardcoded cap
since `1fr` always matches content's natural height:

```css
/* target */
.faq-a {
  display: grid;
  grid-template-rows: 0fr;
  overflow: hidden;
  transition: grid-template-rows 0.4s var(--ease-out), padding 0.3s;
  padding: 0 1.5rem;
}
.faq-a > * { min-height: 0; overflow: hidden; }
.faq-item.open .faq-a { grid-template-rows: 1fr; padding: 0 1.5rem 1.2rem; }
```

The `.faq-a > *` wrapper rule is required by the grid technique: the direct
child of the grid track needs `min-height: 0` to actually collapse instead of
enforcing its own content height on the `0fr` row.

If plan 004 has not been applied yet, use the literal value:
`transition: grid-template-rows 0.4s cubic-bezier(0.23, 1, 0.32, 1), padding 0.3s;`

## Repo conventions to follow

- `.faq-a` currently wraps a single `<p>` (per index.html:2135-2139) — the
  `.faq-a > *` rule targets that `<p>` directly; do not add extra wrapper divs.

## Steps

1. Locate `.faq-a` and `.faq-item.open .faq-a` in `index.html` (~line 2129).
2. Replace the block exactly as shown in Target above.
3. Confirm every `.faq-a` in the rendered FAQ list contains exactly one child
   element (currently a `<p>`) — if any contain multiple children, the
   `min-height: 0` rule still applies to each via `> *` so no markup change is
   needed either way.

## Boundaries

- Do NOT change the FAQ markup structure or JS toggle logic (`classList.add/
  remove('open')` on `.faq-item`) — this is CSS-only.
- Do NOT remove the `padding` transition — keep both properties transitioning
  together as today.

## Verification

- **Mechanical**: open `index.html` in a browser, open dev tools Performance
  panel, record while opening a FAQ item — the animated frames should show
  "Composite" work, not repeated "Layout" recalculation (grid-template-rows
  is not a zero-cost compositor property either, but it avoids the forced
  synchronous layout thrash of animating `max-height` on an ancestor with
  siblings; at minimum confirm no visual regression first).
- **Feel check**:
  - Open a FAQ item with a long answer — it must expand to its full natural
    height with nothing clipped (test with the longest question in the list).
  - Close it — must collapse smoothly back to 0, not snap.
  - Open two items in sequence — no visual jump or double-height flash.
- **Done when**: no FAQ answer is clipped regardless of length, and open/close
  is visually smooth.

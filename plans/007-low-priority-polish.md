# 007 — Low-priority polish: marquee easing + particle spawn scale

- **Status**: DONE
- **Commit**: 6963320
- **Severity**: LOW
- **Category**: Easing & duration / Physicality
- **Estimated scope**: 1 file (index.html), 2 selectors

## Problem

Two minor, low-confidence items from the audit — both defensible as-is, but
worth a one-line tightening since they're cheap:

```css
/* index.html:906-915 — current: tab label marquee for overflowing país/región tabs */
.is-marquee .tab-label-inner {
  animation-name: tab-marquee;
  animation-duration: var(--marquee-duration, 5s);
  animation-timing-function: ease-in-out;
  animation-iteration-count: infinite;
}
@keyframes tab-marquee {
  0%, 12%   { transform: translateX(0); }
  45%, 58%  { transform: translateX(var(--marquee-distance, 0)); }
  90%, 100% { transform: translateX(0); }
}
```

This keyframe holds at both ends and only moves in the 12%→45% and 58%→90%
windows — it is not a continuously-scrolling ticker, so `ease-in-out` on the
transit phases is reasonable (smooth start/stop into the holds). Low-severity
because the audit's "constant motion → linear" rule targets tickers with no
pauses, which this isn't.

```css
/* index.html:2554-2558 — current */
@keyframes float-particle {
  0% { opacity: 0; transform: translateY(100vh) scale(0); }
  10% { opacity: 0.6; }
  90% { opacity: 0.3; }
  100% { opacity: 0; transform: translateY(-20px) scale(1.5); }
}
```

Background hero particles spawn at `scale(0)`. The audit's "never scale(0)"
rule is aimed at UI elements appearing to a user's direct action (a popover,
a modal); this is ambient decoration a user never focuses on, so severity is
low, but a nonzero starting scale is still a one-value fix.

## Target

```css
/* target: index.html:2554-2558 */
@keyframes float-particle {
  0% { opacity: 0; transform: translateY(100vh) scale(0.3); }
  10% { opacity: 0.6; }
  90% { opacity: 0.3; }
  100% { opacity: 0; transform: translateY(-20px) scale(1.5); }
}
```

No change to `tab-marquee` — documented above as reviewed and acceptable
as-is; this plan makes no edit to it. (Kept in this plan file only so the
audit trail shows it was considered, not silently dropped.)

## Repo conventions to follow

- N/A — single-value keyframe edit, no new tokens or patterns introduced.

## Steps

1. In `index.html`, find `@keyframes float-particle` (~line 2554).
2. Change `scale(0)` to `scale(0.3)` in the `0%` rule. Leave every other
   value in the keyframe untouched.
3. Make no change to `tab-marquee` / `.is-marquee .tab-label-inner`.

## Boundaries

- Do NOT touch `tab-marquee` — reviewed and intentionally left as-is (see
  Problem section).
- Do NOT change particle count, size range, spawn timing, or opacity curve —
  only the initial scale value.

## Verification

- **Mechanical**: none.
- **Feel check**: watch the hero section for ~10s — floating particles should
  still look like they're drifting upward and fading, now starting at a
  small-but-visible dot rather than a literal zero-size point (visually this
  is a very subtle difference; do not over-invest time confirming it).
- **Done when**: `float-particle`'s `0%` keyframe uses `scale(0.3)` instead of
  `scale(0)`.

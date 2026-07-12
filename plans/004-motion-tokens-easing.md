# 004 — Introduce motion tokens; apply strong ease-out to entrances

- **Status**: DONE
- **Commit**: 6963320
- **Severity**: MEDIUM
- **Category**: Easing & duration / Cohesion & tokens
- **Estimated scope**: 1 file (index.html), `:root` + 2 shared rules affecting ~30 elements

## Problem

Every entrance animation on the site uses the bare CSS `ease` keyword, which
is too weak for deliberate motion. This is the single highest-leverage change
on the site: it's used by the `fade-up` keyframe (9 uses on hero elements) and
the `.reveal` scroll-in system (23 elements sitewide via `class="... reveal
..."`), so one token swap changes how the whole page feels.

```css
/* index.html:27-39 — current :root, no motion tokens */
:root {
  --primary: #E4572E;
  --secondary: #F97316;
  --accent: #F5A623;
  --bg-dark: #14100D;
  --bg-card: #241A14;
  --text-main: #FFF7ED;
  --text-muted: #D9C4B4;
  --border: rgba(228,87,46,0.3);
  --glass: rgba(36,26,20,0.7);
  --glow-primary: rgba(228,87,46,0.45);
  --glow-gold: rgba(245,166,35,0.45);
}
```

```css
/* index.html:2534-2537 — current */
@keyframes fade-up {
  from { opacity: 0; transform: translateY(30px); }
  to { opacity: 1; transform: translateY(0); }
}
```
(used at lines 299, 313, 338, 343, 353, 398, 868, 1915 with `ease` durations
0.4-0.8s)

```css
/* index.html:2566-2572 — current */
.reveal {
  opacity: 0; transform: translateY(40px);
  transition: opacity 0.7s ease, transform 0.7s ease;
}
.reveal.visible {
  opacity: 1; transform: translateY(0);
}
```

## Target

```css
/* target: add to :root, index.html:27-39 */
:root {
  --primary: #E4572E;
  --secondary: #F97316;
  --accent: #F5A623;
  --bg-dark: #14100D;
  --bg-card: #241A14;
  --text-main: #FFF7ED;
  --text-muted: #D9C4B4;
  --border: rgba(228,87,46,0.3);
  --glass: rgba(36,26,20,0.7);
  --glow-primary: rgba(228,87,46,0.45);
  --glow-gold: rgba(245,166,35,0.45);
  --ease-out: cubic-bezier(0.23, 1, 0.32, 1);
  --ease-in-out: cubic-bezier(0.77, 0, 0.175, 1);
}
```

```css
/* target: index.html:2534-2537 — every animation: fade-up ... ease ...
   declaration (lines 299, 313, 338, 343, 353, 398, 868, 1915) changes its
   timing-function keyword from `ease` to `var(--ease-out)` */
.hero-badge { animation: fade-up 0.8s var(--ease-out) 0.2s both; }
.hero-title { animation: fade-up 0.8s var(--ease-out) 0.4s both; }
/* ...same substitution for every fade-up usage listed above... */
```

```css
/* target: index.html:2566-2572 */
.reveal {
  opacity: 0; transform: translateY(40px);
  transition: opacity 0.6s var(--ease-out), transform 0.6s var(--ease-out);
}
.reveal.visible {
  opacity: 1; transform: translateY(0);
}
```

Duration on `.reveal` is trimmed from `0.7s` to `0.6s` — a strong ease-out
curve front-loads the motion, so the same distance (`40px`) reads as
sluggish at the original duration once the curve gets snappier. This is a
marketing/explanatory context so durations above 300ms remain acceptable
(per the duration budget table, "Marketing / explanatory: can be longer");
0.6s keeps the same character while feeling more responsive.

## Repo conventions to follow

- Motion tokens live in `:root` alongside the existing color tokens
  (index.html:27-39) — same block, same declaration style (`--name: value;`).
- Every consumer references tokens via `var(--token-name)`, matching how color
  tokens are already consumed everywhere else in the file (e.g. `color:
  var(--accent);`).

## Steps

1. Add `--ease-out` and `--ease-in-out` to the `:root` block at index.html:27-39,
   exactly as shown in Target.
2. Grep for `animation: fade-up` (8 occurrences) and change the timing
   function from `ease` to `var(--ease-out)` in each, keeping every other
   part of the shorthand (duration, delay, `both`) unchanged.
3. Update `.reveal` (index.html:2566-2572): change both `transition` timing
   functions from `ease` to `var(--ease-out)`, and change both durations from
   `0.7s` to `0.6s`.
4. Do not touch `.reveal-delay-1..4` (index.html:2573-2576) — those only set
   `transition-delay` and are unaffected by this token change.

## Boundaries

- Do NOT touch hover-state transitions (`transition: color 0.3s`, etc.) in
  this plan — those are covered by plan 002 (`transition: all` narrowing) and
  are a different motion purpose (color/hover, which the audit calls for
  plain `ease`, not the strong `--ease-out` curve).
- Do NOT change `--ease-in-out` usage anywhere yet — it's added here as a
  token for future use (e.g. `.tag-marquee`'s hold-then-move phases) but this
  plan does not require rewiring any existing `ease-in-out` usage.
- Do NOT change animation durations other than `.reveal`'s 0.7s→0.6s.

## Verification

- **Mechanical**: open `index.html` in a browser; confirm no console errors
  (a typo'd `var(--ease-out)` would silently fall back to initial/default
  timing rather than error, so also visually confirm per feel check below).
- **Feel check**:
  - Reload the hero section — badge/title/subtitle/CTAs/trust-line/scroll-cue
    should fade up with a fast-start, soft-landing feel (front-loaded motion),
    not a linear-feeling glide.
  - Scroll down through any section using `.reveal` (stats bar, escuelas,
    instructores, etc.) — entrances should feel snappier than before, still
    smooth, no overshoot/bounce (this curve has no bounce, it's a pure
    ease-out).
  - In DevTools Animations panel, slow playback to 25% and confirm the curve
    visibly front-loads (fast start, long soft tail) rather than moving at a
    constant rate.
- **Done when**: `:root` has both new tokens, all 8 `fade-up` usages and
  `.reveal` reference `var(--ease-out)`, and zero bare `ease` keywords remain
  on those specific declarations.

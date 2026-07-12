# 006 — Cap the infinite WhatsApp float pulse

- **Status**: DONE
- **Commit**: 6963320
- **Severity**: MEDIUM
- **Category**: Purpose & frequency
- **Estimated scope**: 1 file (index.html), 1 selector

## Problem

```css
/* index.html:2461-2474 — current */
.float-whatsapp {
  position: fixed; bottom: 2rem; right: 2rem;
  z-index: 999;
  width: 58px; height: 58px;
  background: #25D366;
  border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  box-shadow: 0 4px 20px rgba(37,211,102,0.4);
  text-decoration: none;
  color: white;
  animation: pulse-wa 2s ease infinite;
  transition: transform 0.3s;
}
```

The floating WhatsApp button pulses forever, from the moment the page loads,
for the entire session, with no relationship to any state change (no unread
count, no new-message signal — it's decorative "look at me" motion on an
element that's visible 100% of the time). Per the audit's frequency table,
motion on something seen constantly needs a real purpose or should be
reduced.

## Target

```css
/* target */
.float-whatsapp {
  /* ...unchanged declarations... */
  animation: pulse-wa 2s ease 3;
  transition: transform 0.3s;
}
```

Changing `infinite` to `3` makes the ring-pulse announce itself three times
(~6s) after page load — enough to draw a first-time visitor's eye to the
contact CTA — then settle into a calm state indistinguishable from any other
floating action button. The button's own `:hover { transform: scale(1.1) }`
(index.html:2474) already provides interaction feedback, so nothing is lost.

## Repo conventions to follow

- `@keyframes pulse-wa` (index.html:2560-2563) is unchanged — this plan only
  changes the `animation-iteration-count` on the consumer, matching how
  `.search-found` (index.html:1757) already uses a finite count
  (`search-found-pulse 0.9s ease-in-out 2`) rather than `infinite` for an
  attention-pulse — this plan brings `.float-whatsapp` in line with that
  existing convention.

## Steps

1. In `index.html`, find `.float-whatsapp` (~line 2471).
2. Change `animation: pulse-wa 2s ease infinite;` to
   `animation: pulse-wa 2s ease 3;`.
3. Leave the `@keyframes pulse-wa` definition and the `:hover` rule
   untouched.

## Boundaries

- Do NOT change the keyframe shape/colors.
- Do NOT touch `.section-search-toggle`'s `search-toggle-pulse` animation —
  that one already stops correctly on hover/focus/open (index.html:1690-1694)
  and is out of scope; it's a good existing pattern, not a finding.
- Do NOT add JS-based re-triggering (e.g. re-pulsing on scroll-into-view) —
  that's a larger behavior change outside this plan's scope.

## Verification

- **Mechanical**: none (pure CSS value change).
- **Feel check**: reload the page and watch the WhatsApp button for ~10
  seconds — the ring pulse should fire 3 times then stop, leaving a static
  button with only the hover-scale interaction remaining active.
- **Done when**: the pulse stops after 3 iterations instead of running for
  the entire session.

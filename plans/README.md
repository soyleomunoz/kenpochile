# Animation improvement plans — KenpoChile landing

Audited 2026-07-11 at commit `6963320`. All findings selected by the user
("aplica todo"); all plans below were then executed directly against
`index.html` in the same session.

| # | Title | Severity | Status |
|---|---|---|---|
| [001](001-modal-entrance-animation.md) | Modal fade+scale entrance | HIGH | DONE |
| [002](002-replace-transition-all.md) | Replace `transition: all` | HIGH | DONE |
| [003](003-faq-accordion-height.md) | FAQ accordion grid-rows fix | HIGH | DONE |
| [004](004-motion-tokens-easing.md) | Motion tokens + strong ease-out | MEDIUM | DONE |
| [005](005-button-press-feedback.md) | `:active` press feedback | MEDIUM | DONE |
| [006](006-whatsapp-pulse-cap.md) | Cap WhatsApp infinite pulse | MEDIUM | DONE |
| [007](007-low-priority-polish.md) | Particle spawn scale (marquee left as-is) | LOW | DONE |
| [008](008-stats-count-up.md) | Count-up on numeric stats | Missed opportunity | DONE |
| [009](009-escuela-grid-stagger.md) | Stagger escuela grid re-render | Missed opportunity | DONE |

## Recommended execution order (as applied)

1. **004** first — introduces `--ease-out`/`--ease-in-out` tokens that 001 and
   003 reference.
2. **001, 003** — depend on 004's tokens (fall back to literal cubic-bezier
   values if applied standalone).
3. **002** — independent, mechanical narrowing of `transition: all`.
4. **005, 006** — independent, small CSS-only tweaks.
5. **007, 008, 009** — independent additive/polish items.

## Dependencies

- 001 and 003 reference `var(--ease-out)`, defined in 004.
- All other plans are independent of each other.

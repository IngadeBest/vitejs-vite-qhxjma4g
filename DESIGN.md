Design decisions and how to use the minimal token system

Goals
- Provide a single source of truth for spacing, colors, radii and container width.
- Make it easy to migrate primitives to use these tokens.

Files added
- `src/ui/tokens.css`: CSS variables and a `.wp-container` utility for centered page content.
- `src/ui/Container.jsx`: small React wrapper around `.wp-container` which accepts `maxWidth` to override the default.

How to use tokens
- Import tokens early in the app: tokens are imported from `src/main.jsx` so they are available globally.
- Prefer CSS variables in components and primitives. Example:
  color: var(--wp-fore);
  background: var(--wp-card-bg);
  border-radius: var(--wp-card-radius);

Container usage
- Replace manual wrappers like `style={{ maxWidth: 1100, margin: '24px auto' }}` with `<Container maxWidth={1100}>...children...</Container>`.
- The Container component applies horizontal padding and centers content.

Next steps (recommended)
1. Migrate UI primitives (`src/ui/button.jsx`, `src/ui/input.jsx`, `src/ui/card.jsx`) to rely on CSS variables from tokens instead of hard-coded values. This will make global theme changes trivial.
2. Replace manual inline fonts/spacing with token-based values. For example, use `var(--wp-space-3)` for padding.
3. Add a `DESIGN.md` section with theming examples (light/dark) and a small theme toggler if needed.

Notes
- This is intentionally minimal to avoid large, risky refactors. If you want, I can continue and update primitives and 3-5 pages to fully adopt tokens and show a theme toggle demo.

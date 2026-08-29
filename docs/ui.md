# Relay UI Styling Rules

These rules keep the renderer aligned with [DESIGN.md](../DESIGN.md).

## Token-only styling

- Core design tokens live in `shared/design/tokens.css` (`@theme` block) and are imported by `app/src/renderer/styles/theme.css`.
- Use Tailwind utilities mapped to tokens: `bg-bg`, `text-text-secondary`, `rounded-panel`, etc.
- **No arbitrary values** — do not use `bg-[#...]`, `w-[312px]`, `rounded-[9px]`, or the default Tailwind palette (`bg-blue-500`, `text-gray-400`).
- If a value is missing, add a token to `shared/design/tokens.css` instead of inlining it in a component.

## Dark mode

- Dark overrides live in `.dark { ... }` in `shared/design/tokens.css`, reusing the same variable names.
- Prefer toggling `.dark` on a root element; avoid per-component light/dark class pairs.

## Status indicators

- Use a **dot + label**, not badge pills.
- Example: `● Connected` — not `[ CONNECTED ]` or colored chips.
- Map connection state to `status-healthy`, `status-warning`, `status-error`, or `text-tertiary`.

## Surfaces

- Workspace panels use `bg-bg-secondary`, `rounded-panel`, and subtle dividers — not heavy cards or thick borders.
- Whitespace and typography establish hierarchy; avoid outlining every region.

## Primitives

- Radix wrappers live in `app/src/renderer/components/ui/`.
- Style them with design tokens only; keep behavior accessible (focus traps, keyboard nav).
- Use `ScrollArea` for primary navigation columns; other scroll regions inherit global scrollbar styling from `scrollbar.css`.

## Motion

- Use `duration-default` (140ms). Animations should be fast and purposeful — no bounce or spring excess.

## Title bar

- The shell title bar uses `.titlebar` (`-webkit-app-region: drag`) so the window can be moved on frameless/hidden-inset macOS chrome.
- Any interactive control inside the title bar must use `.titlebar-no-drag` so clicks are not swallowed by the drag region.

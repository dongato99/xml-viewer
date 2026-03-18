# Responsive Design Spec — XML Viewer CFDI

## Approach

Add Bootstrap 5.3.3 CSS via CDN to handle responsive layout. Bootstrap handles grid/breakpoints/utilities; existing custom CSS handles theme/colors/look-and-feel. No Bootstrap JS. No build step changes.

Bootstrap CSS loaded **before** `style.css` in `index.html` so custom styles take precedence.

**CDN link:** `https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css` with SRI integrity hash.

### Bootstrap CSS Conflict Mitigation

Bootstrap's Reboot will normalize buttons, inputs, tables, and font styles. After adding the CDN link:
- The existing `*, *::before, *::after { margin: 0; padding: 0; }` reset will fight Bootstrap utility classes (`.mb-3`, `.p-2`, etc.). Remove `margin: 0; padding: 0` from the wildcard selector and rely on Bootstrap's Reboot for normalization. Keep `box-sizing: border-box`.
- Verify custom button styles (`.toolbar__btn`, `.pdf-btn`, `.paste__btn`, `.drop-zone__btn`) still override Bootstrap's resets. Increase specificity or add explicit overrides where needed.
- Verify table styles (`.data-grid th`, `.data-grid td`) override Bootstrap's default table styling.
- Verify `<dialog>` positioning is unaffected.
- The existing `body` font-family declaration may need `!important` or higher specificity to survive Bootstrap's Reboot.
- Ensure only `.grid-wrapper` has `overflow-x` set — if a parent element also has overflow, `position: sticky` on frozen columns will break.
- Test in both light and dark themes.

## Breakpoints

| Name    | Range        | Target          |
|---------|-------------|-----------------|
| Phone   | < 576px     | Small phones    |
| Tablet  | 576–768px   | Large phone / small tablet |
| Medium  | 768–992px   | Tablet          |
| Desktop | ≥ 992px     | Current behavior |

## Component Changes

### Header

- **Desktop:** No changes. Flex row with title + theme toggle.
- **Phone:** Title font shrinks to ~1.1rem. Padding tightens.

### Input Area

- **Desktop (≥992px):** Two columns side by side (drag-drop + paste).
- **Tablet (≥576px, <992px):** Two columns, reduced padding.
- **Phone (<576px):** Stacked vertically. Drop zone padding reduced. Textarea min-height reduced.

### Toolbar

All buttons remain visible at every size — compact grouped layout, no overflow menu.

- **Desktop (≥992px):** Current horizontal layout — row count + column filter on left, all buttons on right in one row.
- **Tablet (≥576px, <992px):** Row count + column filter on top row. Buttons wrap into two rows — danger buttons on one line, export/print buttons on another.
- **Phone (<576px):** Full stacked layout:
  1. Row count on top
  2. Column filter full-width
  3. Danger buttons row: Quitar Todo + Quitar Seleccionados (50% each)
  4. Export buttons row 1: Exportar Todo + Exportar Filtrado (50% each)
  5. Export buttons row 2: Exportar Seleccionados + Imprimir Seleccionados (50% each)

### Data Grid

Horizontal scroll at all sizes with frozen columns. No card layout.

**Column order note:** The current render order is PDF, Checkbox, then data columns (Fecha Comprobante, Serie, Folio, RFC Emisor, ...). RFC Emisor is the 4th data column. To freeze it efficiently, we must move RFC Emisor to be the 1st data column in the COLUMNS array in `app.js`, so it sits immediately after PDF and Checkbox. This changes the grid layout at all screen sizes.

**Frozen columns (position: sticky with left offsets):**

| Screen    | Frozen columns                         | Frozen width |
|-----------|----------------------------------------|-------------|
| Desktop (≥992px) | PDF (50px) + Checkbox (40px) + RFC Emisor (full, ~130px) | ~220px |
| Tablet (576–992px) | PDF + Checkbox + RFC Emisor (trimmed, ~90px) | ~180px |
| Phone (<576px) | PDF + Checkbox + RFC Emisor (trimmed, ~70px) | ~160px |

RFC Emisor trimming: `max-width` + `text-overflow: ellipsis` that shrinks at each breakpoint.

**Frozen column backgrounds:** All frozen column cells (`td` and `th`) must have an explicit opaque background color — not transparent — so content scrolling underneath doesn't bleed through. Use `var(--bg-primary)` for odd rows, `var(--bg-secondary)` for even rows, and `var(--bg-tertiary)` for header/filter rows. Hovered rows must also set the frozen cell background to `var(--accent-light)`. Rows with `.row--egreso` or `.row--pago` classes keep the same background rules (the color styling is text-only, not background). Apply in both light and dark themes.

**Z-index layering for frozen + sticky headers:**

| Element | z-index | Sticky direction |
|---------|---------|-----------------|
| Frozen header cells (intersection) | 12 | top + left |
| Regular header cells | 10 | top only |
| Frozen filter row cells | 11 | top + left |
| Regular filter row cells | 9 | top only |
| Frozen body cells | 5 | left only |
| Regular body cells | auto | none |

**Filter row `top` offset:** The current hardcoded `top: 38px` for the filter row will be incorrect at smaller breakpoints where header height changes. Hardcode the correct `top` value in each media query (simpler than a CSS custom property, no JS needed).

**Column visibility interaction:** If the user hides RFC Emisor via the column filter dropdown, the frozen offset for subsequent columns would be wrong. Two options: (a) prevent hiding frozen columns by excluding them from the dropdown, or (b) recalculate left offsets dynamically in JS when visibility changes. Option (a) is simpler and recommended.

**Additional mobile grid adjustments:**
- Cell padding: `8px 12px` → `6px 8px` on phone
- Font size: `0.85rem` → `0.8rem` on phone
- Right-edge gradient fade on `.grid-wrapper` using `::after` pseudo-element. Use theme-aware colors (`var(--bg-primary)` fading to transparent). Fade should disappear when scrolled to the far right (JS scroll listener on `.grid-wrapper`).
- Filter row inputs: smaller padding and font on mobile

### Status Bar

Minor padding adjustment on mobile. Full-width at all sizes.

### Confirm Dialog

Change `min-width: 320px` to `min-width: min(320px, 90vw)` to avoid overflow on small phones. Buttons stay side-by-side.

### Warnings

No changes needed — already stacked vertically.

### General Polish

- `#app` padding: `0 16px` → `0 8px` on phones
- Touch targets: all buttons minimum 44px height on mobile. Checkboxes (currently 16x16px) should have their clickable area expanded to at least 44x44px via padding on the parent `td`/`th` cell.
- Column filter dropdown: expand to near full-width on phones instead of fixed `min-width: 220px`. On tablets, cap at `min(280px, 60vw)` to prevent viewport overflow.

## Files Modified

- `index.html` — add Bootstrap 5.3.3 CDN link, add Bootstrap responsive classes to HTML structure
- `css/style.css` — update media queries for new breakpoints, add frozen column styles, responsive adjustments, Bootstrap conflict overrides
- `js/grid.js` — add frozen column CSS classes and sticky left offsets during grid rendering (PDF, Checkbox, RFC Emisor columns). Add scroll listener for gradient fade.
- `js/app.js` — reorder COLUMNS array to put RFC Emisor first (before Fecha Comprobante). Exclude frozen columns from the column visibility dropdown (dropdown rendering is in `app.js`, not `grid.js`).

## Out of Scope

- No Bootstrap JS (no interactive Bootstrap components)
- No build step / bundler changes
- No card layout for mobile grid
- No overflow/hamburger menu for toolbar

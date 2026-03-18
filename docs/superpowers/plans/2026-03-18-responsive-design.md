# Responsive Design Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the XML Viewer CFDI fully responsive across all screen sizes (phone → desktop) using Bootstrap 5 CSS via CDN.

**Architecture:** Add Bootstrap 5.3.3 CSS-only (no JS) via CDN before the existing `style.css`. Bootstrap handles responsive grid/utilities/breakpoints. Existing custom CSS retains all theme colors, component look-and-feel. Grid gets frozen columns (PDF, Checkbox, RFC Emisor) via `position: sticky`. Toolbar reflows into grouped rows on smaller screens.

**Tech Stack:** Bootstrap 5.3.3 CSS (CDN), vanilla CSS, vanilla JS (ES6 modules)

**Spec:** `docs/superpowers/specs/2026-03-18-responsive-design.md`

---

### Task 1: Add Bootstrap CDN and fix CSS reset conflicts

**Files:**
- Modify: `index.html:6-8` (add CDN link in `<head>`)
- Modify: `css/style.css:48` (fix wildcard reset)

- [ ] **Step 1: Add Bootstrap CSS CDN link to index.html**

In `index.html`, add this line **before** the existing `<link rel="stylesheet" href="css/style.css">`:

```html
<link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet" integrity="sha384-QWTKZyjpPEjISv5WaRU9OFeRpok6YctnYmDr5pNlyT2bRjXh0JMhjY6hW+ALEwIH" crossorigin="anonymous">
```

- [ ] **Step 2: Fix wildcard reset to not fight Bootstrap utilities**

In `css/style.css`, change line 48 from:

```css
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
```

to:

```css
*, *::before, *::after { box-sizing: border-box; }
```

- [ ] **Step 3: Verify Bootstrap integration doesn't break existing styles**

Open the app in a browser and verify in both light and dark themes:
- Body font-family is the same system font stack (if it changed, add `!important` to the `font-family` line in `css/style.css`)
- Buttons (`.toolbar__btn`, `.pdf-btn`, `.paste__btn`, `.drop-zone__btn`) look the same as before
- Table styles (`.data-grid th`, `.data-grid td`) are unchanged
- `<dialog>` confirm dialog positioning and appearance is unaffected
- Verify no parent of `.grid-wrapper` has `overflow` set (only `.grid-wrapper` itself should have `overflow-x: auto`) — this is required for `position: sticky` frozen columns in later tasks

- [ ] **Step 4: Commit**

```bash
git add index.html css/style.css
git commit -m "feat: add Bootstrap 5.3.3 CSS via CDN, fix reset conflicts"
```

---

### Task 2: Responsive header and app container

**Files:**
- Modify: `css/style.css:58-77` (header and #app styles)

- [ ] **Step 1: Add responsive media queries for #app and header**

Add at the bottom of `css/style.css`, replacing the existing `@media (max-width: 768px)` block entirely:

```css
/* === Responsive === */
@media (max-width: 991.98px) {
    .input-area {
        grid-template-columns: 1fr 1fr;
        gap: 12px;
    }
    .input-area__drop-zone {
        padding: 24px;
    }
}

@media (max-width: 575.98px) {
    #app {
        padding: 0 8px 8px;
    }
    .header {
        padding: 10px 0;
        margin-bottom: 10px;
    }
    .header__title {
        font-size: 1.1rem;
    }
    .input-area {
        grid-template-columns: 1fr;
        gap: 10px;
    }
    .input-area__drop-zone {
        padding: 20px;
    }
    .paste__textarea {
        min-height: 80px;
    }
}
```

- [ ] **Step 2: Remove old media query**

Delete the existing `@media (max-width: 768px)` block (lines 538-546 approximately) since the new queries replace it.

- [ ] **Step 3: Verify in browser**

Open the app, resize the browser window from desktop (>992px) → tablet (576-992px) → phone (<576px). Verify:
- Header title shrinks on phone
- App padding reduces on phone
- Input area goes from 2-column to 1-column on phone
- Drop zone padding reduces gracefully

- [ ] **Step 4: Commit**

```bash
git add css/style.css
git commit -m "feat: responsive header, app container, and input area"
```

---

### Task 3: Responsive toolbar with grouped button rows

**Files:**
- Modify: `index.html:34-50` (add wrapper divs for button groups)
- Modify: `css/style.css` (toolbar responsive rules)
- Modify: `js/app.js:43-52` (update DOM refs if IDs change — they don't, just HTML structure)

- [ ] **Step 1: Restructure toolbar HTML with button groups**

In `index.html`, replace the toolbar section (lines 34-50) with:

```html
<section class="toolbar" id="toolbar" hidden>
    <div class="toolbar__top">
        <span id="row-count" class="toolbar__count"></span>
        <div class="toolbar__columns">
            <button id="columns-toggle" class="toolbar__btn">Filtrar Columnas</button>
            <div id="columns-dropdown" class="toolbar__dropdown" hidden></div>
        </div>
    </div>
    <div class="toolbar__actions">
        <div class="toolbar__group toolbar__group--danger">
            <button id="clear-all" class="toolbar__btn toolbar__btn--danger">Quitar Todo</button>
            <button id="clear-selected" class="toolbar__btn toolbar__btn--danger" disabled>Quitar Seleccionados</button>
        </div>
        <div class="toolbar__group toolbar__group--primary">
            <button id="export-all" class="toolbar__btn toolbar__btn--primary">Exportar Todo</button>
            <button id="export-filtered" class="toolbar__btn toolbar__btn--primary">Exportar Filtrado</button>
        </div>
        <div class="toolbar__group toolbar__group--primary">
            <button id="export-selected" class="toolbar__btn toolbar__btn--primary" disabled>Exportar Seleccionados</button>
            <button id="print-selected" class="toolbar__btn toolbar__btn--primary" disabled>Imprimir Seleccionados</button>
        </div>
    </div>
</section>
```

Note: All button IDs remain the same — no JS changes needed for event listeners.

- [ ] **Step 2: Add toolbar responsive CSS**

Delete the existing `.toolbar__left, .toolbar__right` rule (lines 201-205 of `style.css`). Then replace the existing `.toolbar` rule (lines 189-199) with the following. The new CSS also adds `.toolbar__top`, `.toolbar__actions`, and `.toolbar__group` rules:

```css
/* === Toolbar === */
.toolbar {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 12px 16px;
    background: var(--bg-primary);
    border: 1px solid var(--border-light);
    border-radius: var(--radius-md);
    margin-bottom: 16px;
    box-shadow: var(--shadow-sm);
}

.toolbar__top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
}

.toolbar__actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
}

.toolbar__group {
    display: flex;
    gap: 6px;
}

/* Desktop: single row */
@media (min-width: 992px) {
    .toolbar {
        flex-direction: row;
        align-items: center;
        justify-content: space-between;
    }
    .toolbar__actions {
        flex-wrap: nowrap;
    }
}

/* Phone: full-width stacked groups */
@media (max-width: 575.98px) {
    .toolbar__top {
        flex-direction: column;
        align-items: stretch;
    }
    .toolbar__actions {
        flex-direction: column;
    }
    .toolbar__group {
        display: flex;
        width: 100%;
    }
    .toolbar__group .toolbar__btn {
        flex: 1;
        min-height: 44px;
    }
}
```

- [ ] **Step 3: Add responsive column filter dropdown CSS**

Add to the responsive section in `css/style.css`:

```css
@media (max-width: 575.98px) {
    .toolbar__dropdown {
        min-width: calc(100vw - 48px);
        left: -16px;
    }
}

@media (min-width: 576px) and (max-width: 991.98px) {
    .toolbar__dropdown {
        min-width: min(280px, 60vw);
    }
}
```

- [ ] **Step 4: Verify in browser**

Resize from desktop → tablet → phone. Verify:
- Desktop: toolbar is horizontal, all buttons in one row
- Tablet: top row has count + column filter, buttons wrap into grouped rows below
- Phone: everything stacks, each button group is full-width with 50/50 split, buttons are at least 44px tall

- [ ] **Step 5: Commit**

```bash
git add index.html css/style.css
git commit -m "feat: responsive toolbar with grouped button layout"
```

---

### Task 4: Reorder COLUMNS and exclude frozen columns from visibility dropdown

**Files:**
- Modify: `js/app.js:86-129` (reorder COLUMNS array)
- Modify: `js/app.js:219-230` (skip frozen columns in dropdown)

- [ ] **Step 1: Move RFC Emisor to first position in COLUMNS array**

In `js/app.js`, change the COLUMNS array so `rfcEmisor` is the first entry:

```javascript
const COLUMNS = [
    // Frozen column (first data column for sticky positioning)
    { key: 'rfcEmisor', label: 'RFC Emisor', type: 'text' },
    // Shared
    { key: 'fechaComprobante', label: 'Fecha Comprobante', type: 'text', rawKey: '_fechaRaw' },
    { key: 'serie', label: 'Serie', type: 'text' },
    { key: 'folio', label: 'Folio', type: 'text' },
    { key: 'nombreEmisor', label: 'Nombre Emisor', type: 'text' },
    { key: 'uuid', label: 'UUID', type: 'text' },
    { key: 'tipoComprobanteDesc', label: 'Tipo Comprobante', type: 'text' },
    // ... rest unchanged
```

- [ ] **Step 2: Exclude rfcEmisor from column visibility dropdown**

In `js/app.js`, in the `columnsToggle` click handler (around line 219), add a skip for frozen columns:

Change:
```javascript
grid.getColumns().forEach(col => {
```

To:
```javascript
const FROZEN_KEYS = ['rfcEmisor'];
grid.getColumns().filter(col => !FROZEN_KEYS.includes(col.key)).forEach(col => {
```

- [ ] **Step 3: Verify in browser**

Load XML files. Verify RFC Emisor is now the first data column (after PDF and checkbox). Open column visibility dropdown and verify RFC Emisor does NOT appear in the list.

- [ ] **Step 4: Commit**

```bash
git add js/app.js
git commit -m "feat: reorder columns, exclude frozen cols from visibility dropdown"
```

---

### Task 5: Frozen columns in grid rendering

**Files:**
- Modify: `js/grid.js:80-156` (renderHead — add frozen classes and inline sticky styles)
- Modify: `js/grid.js:226-294` (renderBody — add frozen classes and inline sticky styles)

The frozen columns are: PDF (col index 0, width 50px), Checkbox (col index 1, width 40px), and RFC Emisor (first data column, index 2 in the rendered DOM). Their cumulative left offsets are: PDF=0px, Checkbox=50px, RFC Emisor=90px.

- [ ] **Step 1: Add frozen styles to header row in renderHead**

In `js/grid.js`, in `renderHead()`, after creating `pdfTh` (line 86-89), add:

```javascript
pdfTh.classList.add('frozen-col');
pdfTh.style.position = 'sticky';
pdfTh.style.left = '0px';
pdfTh.style.zIndex = '12';
```

After creating `selectAllTh` (line 91-107), add before `headerRow.appendChild(selectAllTh)`:

```javascript
selectAllTh.classList.add('frozen-col');
selectAllTh.style.position = 'sticky';
selectAllTh.style.left = '50px';
selectAllTh.style.zIndex = '12';
```

In the `columns.forEach` loop (line 109), for the first column (index 0, which is rfcEmisor), add frozen styling:

```javascript
columns.forEach((col, i) => {
    const th = document.createElement('th');
    th.dataset.key = col.key;
    th.innerHTML = `${col.label}<span class="sort-indicator"></span>`;
    if (i === 0) {
        th.classList.add('frozen-col');
        th.style.position = 'sticky';
        th.style.left = '90px';
        th.style.zIndex = '12';
    }
    // ... rest of existing click handler
```

- [ ] **Step 2: Add frozen styles to filter row in renderHead**

In `renderHead()`, for the filter row elements:

After creating `filterPdfTh` (line 132-134):
```javascript
filterPdfTh.classList.add('frozen-col');
filterPdfTh.style.position = 'sticky';
filterPdfTh.style.left = '0px';
filterPdfTh.style.zIndex = '11';
```

After creating `filterSelectTh` (line 136-138):
```javascript
filterSelectTh.classList.add('frozen-col');
filterSelectTh.style.position = 'sticky';
filterSelectTh.style.left = '50px';
filterSelectTh.style.zIndex = '11';
```

In the filter row `columns.forEach` loop (line 140), for index 0:
```javascript
columns.forEach((col, i) => {
    const th = document.createElement('th');
    if (i === 0) {
        th.classList.add('frozen-col');
        th.style.position = 'sticky';
        th.style.left = '90px';
        th.style.zIndex = '11';
    }
    // ... rest of existing input creation
```

- [ ] **Step 3: Add frozen styles to body rows in renderBody**

In `renderBody()`, for body cells:

After creating `pdfTd` (line 240-250):
```javascript
pdfTd.classList.add('frozen-col');
pdfTd.style.position = 'sticky';
pdfTd.style.left = '0px';
pdfTd.style.zIndex = '5';
```

After creating `selectTd` (line 252-267):
```javascript
selectTd.classList.add('frozen-col');
selectTd.style.position = 'sticky';
selectTd.style.left = '50px';
selectTd.style.zIndex = '5';
```

In the body `columns.forEach` loop (line 269), add `data-key` to all `td` elements (for CSS targeting) and frozen styling for index 0:
```javascript
columns.forEach((col, i) => {
    const td = document.createElement('td');
    td.dataset.key = col.key;
    if (i === 0) {
        td.classList.add('frozen-col');
        td.style.position = 'sticky';
        td.style.left = '90px';
        td.style.zIndex = '5';
    }
    // ... rest unchanged
```

- [ ] **Step 4: Verify in browser**

Load XML files. Scroll the grid horizontally. Verify:
- PDF, Checkbox, and RFC Emisor columns stay pinned to the left
- Headers stay pinned to the top when scrolling vertically
- The intersection (frozen headers) stay pinned in both directions

- [ ] **Step 5: Commit**

```bash
git add js/grid.js
git commit -m "feat: frozen columns (PDF, checkbox, RFC Emisor) with sticky positioning"
```

---

### Task 6: Frozen column CSS — backgrounds, z-index, and responsive trimming

**Files:**
- Modify: `css/style.css` (add frozen-col styles)

- [ ] **Step 1: Add frozen column base CSS**

Add to `css/style.css`, before the responsive section:

```css
/* === Frozen Columns === */
.frozen-col {
    background: var(--bg-primary);
}

.data-grid thead .frozen-col {
    background: var(--bg-tertiary);
}

.data-grid .filter-row .frozen-col {
    background: var(--bg-secondary);
}

.data-grid tbody tr:nth-child(even) .frozen-col {
    background: var(--bg-secondary);
}

.data-grid tbody tr:hover .frozen-col {
    background: var(--accent-light);
}

/* RFC Emisor column responsive trimming */
.frozen-col[data-key="rfcEmisor"],
td.frozen-col[data-key="rfcEmisor"] {
    max-width: 130px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
```

- [ ] **Step 2: Add responsive trimming for RFC Emisor**

Add to the responsive media queries:

```css
@media (min-width: 576px) and (max-width: 991.98px) {
    .frozen-col[data-key="rfcEmisor"],
    td.frozen-col[data-key="rfcEmisor"] {
        max-width: 90px;
    }
    .data-grid .filter-row th {
        top: 36px;
    }
}

@media (max-width: 575.98px) {
    .frozen-col[data-key="rfcEmisor"],
    td.frozen-col[data-key="rfcEmisor"] {
        max-width: 70px;
    }
}
```

- [ ] **Step 3: Verify in browser**

Load XML files. Check in both light and dark themes:
- Frozen columns have opaque backgrounds (no bleed-through when scrolling)
- Even/odd row backgrounds apply correctly on frozen cells
- Hover highlights frozen cells too
- RFC Emisor truncates with ellipsis on tablet and phone widths

- [ ] **Step 4: Commit**

```bash
git add css/style.css
git commit -m "feat: frozen column backgrounds and responsive RFC Emisor trimming"
```

---

### Task 7: Responsive grid — mobile adjustments and filter row offset

**Files:**
- Modify: `css/style.css` (grid responsive rules)

- [ ] **Step 1: Add mobile grid adjustments**

Add to the phone media query (`@media (max-width: 575.98px)`):

```css
    .data-grid {
        font-size: 0.8rem;
    }
    .data-grid td {
        padding: 6px 8px;
    }
    .data-grid th {
        padding: 8px;
    }
    .data-grid .filter-row th {
        top: 34px;
    }
    .data-grid .filter-row input {
        padding: 4px 6px;
        font-size: 0.75rem;
    }
    .select-col input[type="checkbox"] {
        width: 20px;
        height: 20px;
    }
    .select-col {
        padding: 12px 8px;
        min-height: 44px;
    }
```

- [ ] **Step 2: Add touch target sizing for mobile buttons**

Add to the phone media query:

```css
    .toolbar__btn {
        min-height: 44px;
        font-size: 0.8rem;
    }
    .pdf-btn {
        min-height: 36px;
        padding: 6px 12px;
    }
```

- [ ] **Step 3: Verify in browser**

At phone width (<576px):
- Grid font is smaller, cell padding is tighter
- Filter row inputs are smaller
- Buttons are at least 44px tall (easy to tap)
- Filter row stays sticky below header row without gap or overlap

- [ ] **Step 4: Commit**

```bash
git add css/style.css
git commit -m "feat: responsive grid sizing, touch targets, and filter row offset"
```

---

### Task 8: Scroll gradient fade indicator

**Files:**
- Modify: `css/style.css` (gradient pseudo-element on grid-wrapper)
- Modify: `js/grid.js` (scroll listener)

- [ ] **Step 1: Add gradient fade CSS**

Add to `css/style.css`:

```css
/* === Scroll fade indicator === */
.grid-wrapper {
    position: relative;
}

.grid-wrapper::after {
    content: '';
    position: absolute;
    top: 0;
    right: 0;
    bottom: 0;
    width: 30px;
    background: linear-gradient(to right, transparent, var(--bg-primary));
    pointer-events: none;
    z-index: 6;
    transition: opacity var(--transition);
}

.grid-wrapper.scrolled-end::after {
    opacity: 0;
}
```

- [ ] **Step 2: Add scroll listener in grid.js**

In `js/grid.js`, after the `renderHead()` call at line 309, add:

```javascript
// Scroll fade indicator
const wrapper = container.querySelector('.grid-wrapper');
if (wrapper) {
    wrapper.addEventListener('scroll', () => {
        const atEnd = wrapper.scrollLeft + wrapper.clientWidth >= wrapper.scrollWidth - 1;
        wrapper.classList.toggle('scrolled-end', atEnd);
    });
}
```

- [ ] **Step 3: Verify in browser**

Load data, scroll the grid horizontally. Verify:
- A subtle gradient fade appears on the right edge
- Fade disappears when scrolled all the way to the right
- Fade reappears when scrolling back left
- Works in both light and dark themes

- [ ] **Step 4: Commit**

```bash
git add css/style.css js/grid.js
git commit -m "feat: scroll gradient fade indicator for data grid"
```

---

### Task 9: Confirm dialog and status bar responsive fixes

**Files:**
- Modify: `css/style.css` (dialog and status bar)

- [ ] **Step 1: Fix confirm dialog min-width**

In `css/style.css`, change the `.confirm-dialog` rule's `min-width`:

From:
```css
min-width: 320px;
```

To:
```css
min-width: min(320px, 90vw);
```

- [ ] **Step 2: Add status bar mobile adjustment**

Add to the phone media query:

```css
    .status-bar {
        padding: 6px 10px;
        font-size: 0.8rem;
    }
```

- [ ] **Step 3: Verify in browser**

At phone width:
- Open the confirm dialog (try deleting all rows) — dialog fits within the viewport
- Status bar has tighter padding, smaller text

- [ ] **Step 4: Commit**

```bash
git add css/style.css
git commit -m "feat: responsive confirm dialog and status bar"
```

---

### Task 10: Final visual QA and cleanup

**Files:**
- All modified files

- [ ] **Step 1: Full visual QA sweep**

Test the complete app at these widths in the browser:
- **360px** (small phone)
- **414px** (iPhone Plus)
- **576px** (breakpoint boundary)
- **768px** (tablet)
- **992px** (breakpoint boundary)
- **1200px+** (desktop)

For each width, verify:
1. Header looks correct
2. Input area layout is appropriate
3. Load some XML files
4. Toolbar buttons are all visible and properly grouped
5. Grid scrolls horizontally with frozen columns working
6. Frozen column backgrounds are opaque (no bleed-through)
7. RFC Emisor truncates at appropriate width
8. Gradient fade shows/hides correctly
9. Column filter dropdown doesn't overflow viewport
10. Confirm dialog fits in viewport
11. Test both light and dark themes

- [ ] **Step 2: Fix any visual issues found**

Address any spacing, overflow, or styling issues discovered during QA.

- [ ] **Step 3: Commit fixes if any**

```bash
git add -A
git commit -m "fix: responsive visual QA fixes"
```

# Clearwork — Surface & Elevation System

This file defines how surfaces, cards, borders, and shadows stack to create
depth in Clearwork's dark UI. Colors stay fixed (see CLEARWORK_SKILL.md).
This is about *spatial logic* — how components are layered, not what color they are.

Claude Code must reference this file when building or modifying any component
that involves a background, border, card, sheet, or overlay.

---

## The Core Rule

**In dark mode, elevation = lighter surface.**
Higher = closer to the user = lighter background.
Never use shadows alone to create depth — they're nearly invisible on dark surfaces.
Use surface color increments instead.

```
User's eye
    ↑
[ Sheets / Modals ]   --bg4  #141414   elevation 3
[ Cards / Inputs  ]   --bg3  #111111   elevation 2
[ Card surfaces   ]   --bg2  #090909   elevation 1
[ Page background ]   --bg   #000000   elevation 0
```

---

## Elevation Levels

### Level 0 — Page background
```css
background: var(--bg); /* #000000 */
```
- The canvas everything sits on
- Nothing interactive lives at this level
- Used for: screen background, gaps between sections

---

### Level 1 — Primary card surface
```css
background: var(--bg2); /* #090909 */
border: 1px solid var(--border); /* rgba(255,255,255,0.05) */
border-radius: 14px;
```
- The standard card — project cards, timeline blocks, task rows
- Barely distinguishable from bg — relies on border to define edge
- Used for: `ProjectCard`, `DW block cards`, `task rows`

---

### Level 2 — Elevated / input surface
```css
background: var(--bg3); /* #111111 */
border: 1px solid var(--border); /* rgba(255,255,255,0.05) */
border-radius: 10px;
```
- Sits visibly above a Level 1 card
- Used for: text inputs, inline pickers, selected states inside cards,
  expanded rows, task edit fields

---

### Level 3 — Highest surface
```css
background: var(--bg4); /* #141414 */
border-radius: 8px;
```
- Used sparingly — only for elements that need to float above Level 2
- Used for: progress bar tracks, pill backgrounds, badge fills,
  subtle button backgrounds (`rgba(255,255,255,0.08)`)

---

### Level 4 — Sheets and overlays
```css
background: var(--bg2); /* #090909 */
border-radius: 20px 20px 0 0;
border-top: 1px solid var(--border); /* rgba(255,255,255,0.05) */
```
- Sheets sit above everything via z-index, not via lighter color
- Sheet background matches Level 1 — the z-index + backdrop dim does
  the visual work, not a lighter surface
- Backdrop: `rgba(0,0,0,0.6)` behind all sheets

---

## Borders

**Rule: always rgba white, never hardcoded hex.**

| Use | Value |
|---|---|
| Default card edge | `rgba(255,255,255,0.05)` → `var(--border)` |
| Inner dividers, subtle | `rgba(255,255,255,0.04)` → `var(--border2)` |
| Selected / active card | `rgba(255,255,255,0.12)` |
| Dashed empty slot | `rgba(255,255,255,0.12)` dashed |
| Domain color selected | `${domainColor}` at full opacity — 1.5px |
| Destructive / danger | `var(--red)` at 60% opacity |

**Never use:** `border: 1px solid #2E3235` or any hardcoded hex border.

---

## Interactive States

### Hover
```css
background: rgba(255,255,255,0.04); /* on top of current surface */
```
Additive — adds a subtle lightening layer on top of whatever surface the element sits on.

### Pressed / active
```css
background: rgba(255,255,255,0.07);
transform: scale(0.98);
```

### Selected (non-domain)
```css
background: rgba(255,255,255,0.08); /* --accent-s */
border: 1px solid rgba(255,255,255,0.12);
```

### Selected (domain color)
```css
background: var(--bg2);
border: 1.5px solid ${domainColor};
/* left stripe: 3px solid ${domainColor} */
```

### Disabled / past / done
```css
opacity: 0.40;
pointer-events: none;
```

---

## Shadows

Shadows are nearly invisible on `#000000` backgrounds.
**Use them only for sheets and modals, never for cards.**

| Element | Shadow |
|---|---|
| Bottom sheet | `0 -8px 40px rgba(0,0,0,0.6)` |
| Floating pill nav | `0 4px 24px rgba(0,0,0,0.5)` |
| FAB button | `0 4px 16px rgba(0,0,0,0.4)` |
| Cards | none — border defines the edge |
| Active DW card glow | `0 0 0 1.5px ${domainColor}` (outline, not shadow) |

---

## Domain Color on Surfaces

Domain color appears on cards in three ways only:

### 1. Left stripe (project cards, active blocks)
```css
border-left: 3px solid ${domainColor};
border-radius: 3px 0 0 3px; /* on the stripe only */
```

### 2. Tint wash (DW cards)
```css
background: linear-gradient(
  160deg,
  ${domainColor}A6 0%,    /* 65% */
  ${domainColor}59 60%,   /* 35% */
  ${domainColor}26 100%   /* 15% */
), #0D0D0D;
```

### 3. Dot indicator (task rows, domain labels)
```css
width: 6px;
height: 6px;
border-radius: 50%;
background: ${domainColor};
```

**Never use domain color as a card background fill directly.**
Always apply via gradient wash or stripe — never `background: ${domainColor}`.

---

## Typography on Dark Surfaces

| Role | Color | Weight | Size |
|---|---|---|---|
| Primary text | `var(--text)` #FFFFFF | 400–600 | 15–17px |
| Secondary text | `var(--text2)` #A1A1A1 | 400 | 13–15px |
| Muted / label | `var(--text3)` #404040 | 400–700 | 11–13px |
| White on domain wash | #FFFFFF | 500–700 | any |
| Destructive | `var(--red)` #E05555 | 500 | any |
| CTA / primary action | `var(--accent)` #FFFFFF | 600 | 15–16px |

**Checked/done tasks:** `color: rgba(255,255,255,0.40)` + `text-decoration: line-through`

---

## Component Recipes

### Standard card
```css
background: var(--bg2);
border: 1px solid var(--border);
border-radius: 14px;
padding: 14px 16px;
```

### Input field
```css
background: var(--bg3);
border: 1px solid var(--border);
border-radius: 10px;
padding: 10px 14px;
color: var(--text);
```
On focus:
```css
border-color: rgba(255,255,255,0.15);
outline: none;
```

### Pill button (secondary)
```css
background: var(--bg4);
border: 1px solid var(--border);
border-radius: 22px;
padding: 6px 14px;
color: var(--text2);
```
Active pill:
```css
background: rgba(255,255,255,0.08);
border-color: rgba(255,255,255,0.12);
color: var(--text);
```

### Primary CTA button
```css
background: var(--accent); /* #FFFFFF */
color: #000000;
border-radius: 22px;
padding: 12px 24px;
font-weight: 600;
```

### Destructive button
```css
background: transparent;
border: 1px solid rgba(224,85,85,0.40);
color: var(--red);
border-radius: 22px;
padding: 10px 20px;
```

### Divider
```css
border: none;
border-top: 1px solid var(--border2); /* rgba(255,255,255,0.04) */
margin: 0;
```

### Section header label
```css
border-left: 2px solid var(--border2);
padding-left: 8px;
color: var(--text3);
font-size: 11px;
font-weight: 700;
letter-spacing: 0.07em;
text-transform: uppercase;
```

---

## Z-Index Stack

```
1    Normal content
10   Sticky headers, floating banners
20   FAB button
50   Nav bar
100  Bottom sheets
150  Full-screen overlays (DWPickerSheet)
200  Onboarding flow
```

---

## What Not To Do

| ❌ Wrong | ✅ Right |
|---|---|
| `background: #1a1a1a` hardcoded | `background: var(--bg2)` |
| `border: 1px solid #333` | `border: 1px solid var(--border)` |
| `box-shadow: 0 2px 8px rgba(0,0,0,0.3)` on a card | No shadow — use border |
| `background: ${domainColor}` on a card | Gradient wash or left stripe only |
| `color: white` hardcoded | `color: var(--text)` |
| Lower surface lighter than higher surface | Always: deeper = darker |
| Same bg for card and its parent | Always: card must be +1 step lighter |

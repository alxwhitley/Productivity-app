# Clearwork App — Claude Skill File

Read this file at the start of every Clearwork session before touching any code.

---

## Project Overview

**App:** Clearwork — mobile-first React productivity app (iOS feel)
**Live URL:** https://productivity-app-eight-pearl.vercel.app
**Repo:** github.com/alxwhitley/Productivity-app (capital P) — local at `~/Desktop/nave-source_1/`
**Stack:** React 19, Vite 7, Supabase JS 2 — single `App.jsx`, no TypeScript, no component library
**Philosophy:** Built on Cal Newport (Deep Work, digital minimalism) and Andrew Huberman (biological prime time, shutdown rituals). The app structure teaches these ideas by doing, not by explaining.

---

## File Locations

| Purpose | Path |
|---|---|
| Source | `~/Desktop/nave-source_1/src/App.jsx` |
| Constants | `~/Desktop/nave-source_1/src/constants.js` |
| Utils | `~/Desktop/nave-source_1/src/utils.js` |
| Data hook | `~/Desktop/nave-source_1/src/useData.js` |
| Swipe hook | `~/Desktop/nave-source_1/src/useSwipeDown.js` |
| CSS | `~/Desktop/nave-source_1/src/clearwork.css` |
| Supabase | `~/Desktop/nave-source_1/src/supabase.js` |
| Entry | `~/Desktop/nave-source_1/src/main.jsx` |

**Note:** `useData.js` and `useSwipeDown.js` live in `src/` root, NOT `src/hooks/`.

**To push:**
```bash
cd ~/Desktop/nave-source_1 && git add . && git commit -m "message" && git push
```
Vercel auto-deploys on push.

**Stray files to verify/delete:** `App_preview.jsx`, `App.css`, `index.css` — confirm whether imported before deleting.

---

## Architecture

### File structure
```
src/
  App.jsx
  constants.js
  utils.js
  useData.js          ← in src/ root (not src/hooks/)
  useSwipeDown.js     ← in src/ root (not src/hooks/)
  clearwork.css
  supabase.js
  main.jsx
  components/
  screens/
  sheets/
```

### Data persistence
- `useData(userId)` hook manages all app state
- Writes to `localStorage` on every change (cache)
- Syncs to Supabase `user_data` table when `userId` is present
- **Always add new state fields to `FIELD_DEFAULTS`** in `constants.js` — `applyDefaults()` fills missing keys on load
- Never use `localStorage` directly for new fields — go through `setData`

### Adding new persistent fields
```js
// 1. Add to FIELD_DEFAULTS in constants.js
const FIELD_DEFAULTS = {
  ...
  myNewField: defaultValue,
};
// 2. That's it — applyDefaults handles the rest
```

### React hooks rules — CRITICAL
- Hooks must be declared at the top level of components
- Never inside IIFEs, conditionals, or nested functions
- A past white-screen crash resulted from violating this — do not repeat

---

## CSS System

### Variables — Dark mode (`:root`)
```css
--bg: #181A1B        /* page background */
--bg2: #1E2122       /* card background */
--bg3: #252829       /* input / inner surface */
--bg4: #2C3032       /* subtle surface / progress track */
--border: #2E3235
--border2: #252829   /* card borders, dividers */
--text: #EDEAE5
--text2: #9A9591     /* secondary text */
--text3: #555250     /* muted / labels */
```

### Brand Colors
| Variable | Hex (dark) | Usage |
|---|---|---|
| `--accent` | `#E8A030` | Primary CTA, active nav, amber |
| `--accent-s` | `rgba(232,160,48,0.12)` | Accent tint backgrounds |
| `--green` | `#45C17A` | Completion, tasks done |
| `--red` | `#E05555` | Missed, destructive actions |
| `--blue` | `#5B8AF0` | Deep Work concept, focus |
| `--purple` | `#9B72CF` | Season / long-term thinking |
| `--teal` | `#4BAABB` | Shutdown / recovery |

### Design conventions
- **Font:** DM Sans (loaded from Google Fonts)
- **Border radius:** cards `14px`, sheets `20px` top corners, pills `22px`
- **Page header** (`.ph`): padding `16px 20px`, contains eyebrow + title + optional gear
- **Eyebrow** (`.ph-eye`): `11px`, `font-weight:700`, `letter-spacing:.07em`, uppercase, `var(--text3)`
- **Title** (`.ph-title`): `26px`, `font-weight:700`, `letter-spacing:-.03em`
- **Section header** (`.sh` + `.sh-label`): label has `border-left:2px solid var(--border2)` + `padding-left:8px`
- **Nav icons:** 24×24px SVG, `strokeWidth` 2–2.2, use `currentColor` (see gotchas)

---

## Component Map

### Screens (4 tabs)
| Component | Tab | Description |
|---|---|---|
| `WorkScreen` | work | Bio-phase timeline — blocks, DW slots, loose tasks banner, shutdown footer |
| `TasksScreen` | tasks | Queue of loose tasks — iOS Reminders-inspired rows, pill filters, swipe actions |
| `ProjectsScreen` | projects | Domain tabs, project cards with task lists, loose tasks cards |
| `SeasonScreen` | season | Quarterly goals, review data, domain bars |

### Overlays / Sheets
| Component | Trigger | Description |
|---|---|---|
| `OnboardingFlow` | first login | 5-card swipeable coach sequence |
| `ShutdownSheet` | end of day sticky footer | Ritual checklist + reflection |
| `AddBlockSheet` | FAB | Add block or routine |
| `CategorizeSheet` | inbox item | Assign inbox item to project |
| `QuickReminders` | FAB (capture) | Quick task capture → inbox |
| `TodaySettingsSheet` | Work gear | Name, shutdown toggle, block defaults |
| `DWPickerSheet` | Empty DW block / "Change Project" | Bottom sheet — project cards in selection mode, task checkboxes, confirm |

### Cards / Sub-components
| Component | Used in | Description |
|---|---|---|
| `ProjectCard` | ProjectsScreen | Expanded by default — name, progress bar, task list, inline add |
| `SwipeTask` | ProjectCard | Swipe-to-delete task row |
| `LooseTasksSection` | ProjectsScreen | Subtle collapsed card above project cards per domain |
| `ThisSeasonCard` | PlanScreen | Compact season goals summary |

### Shared
| Component | Description |
|---|---|
| `NavIcon` | SVG nav icons using `currentColor` — work/tasks/projects/season |
| `GearIcon` | Settings gear SVG |
| `StatusBar` | iOS-style status bar mock |

---

## Nav Bar
- Floating pill-shaped bar, always visible on all tabs
- Icon + label per tab
- Active tab: icon in `var(--accent)` + short underline beneath label
- No filled background highlight on active tab
- **FAB:** visible on Work and Projects tabs only — hidden on Tasks and Season

---

## Tasks Tab — Conventions
- **No FAB** on this tab
- iOS Reminders-inspired: no card backgrounds, tasks sit on screen background as plain rows with dividers
- Large stroke circle checkbox on left, task text full width, small domain color dot below text (no text tag)
- **Swipe LEFT** on a row = three buttons revealed on RIGHT: `Sort · Today · Delete`
- **Swipe RIGHT** on a row = instant Quick Win badge toggle on LEFT
- Pill filters at top: `All · Quick Wins`
- Tap empty space below list = inline new task input (keyboard opens, Enter to save)
- Tap existing task text = inline edit
- Sort panel opens inline below the row (flat domain + project list), not a bottom sheet

---

## Work Tab — Conventions
- Header: date, greeting, gear icon — no clock, no deep work progress bar
- Bio-phase progress bar: 4 phases (Mental Peak · Second Wind · Shallow · Wind Down), moving dot, updates every minute
- "Plan My Day" banner: slim one-line, hides once all blocks assigned
- Fixed block slots: 2 under Mental Peak (9am, 11am), 1 under Second Wind (1pm)
- Three block states: Upcoming · Active (glowing border + large timer) · Done (faded + green checkmark)
- Shallow phase: thin "Loose Tasks" banner — tap to expand today's tasks
- Shutdown Ritual: sticky footer above nav bar from 12pm onwards; shows "✓ Day complete" in green after completion

---

## Projects Tab — Conventions
- `padding-bottom: 100px` on `.scroll` to prevent nav bar overlap
- No "Add project" at bottom of screen — lives in gear settings sheet
- All project cards expanded by default, no expand/collapse all chevron
- Domain section order: domain header → Loose Tasks card → project cards
- **Loose Tasks card:** subtle, collapsed by default, `var(--bg)` background with border only, no color accent
  - Top right always shows small grey `+` icon
  - Tapping `+` expands and immediately opens inline input at top of list
  - Tapping header expands/collapses existing tasks
- Inline task editing on tap for all tasks (both loose and project tasks)
- Keyboard scroll: `scrollIntoView({ behavior: 'smooth', block: 'nearest' })` on active input focus + `visualViewport` listener to keep input above keyboard

---

## DWPickerSheet — Conventions
- Opens when tapping an empty DW block slot (immediate)
- Opens via "Change Project" in the `···` menu on an assigned block (pre-selects current project + tasks)
- Sheet: 75% height, scrollable, `border-radius: 20px 20px 0 0`, drag handle, dimmed backdrop
- Header: eyebrow "PICK A FOCUS" + block time subtitle
- Domain tabs: grey by default, tap to filter and light up in domain color
- Project cards unselected: transparent background, dashed border, no left stripe, tasks greyed out
- Project cards selected: solid border, `var(--bg2)` background, domain color left stripe, checkboxes appear on tasks
- Only one card selectable at a time
- Confirm button appears at bottom of selected card — full width, `var(--accent)` background
- On confirm: `mutateDWSlot(dateStr, slotIndex, { projectId, todayTasks: selectedTaskIds })`

---

## Key State (WorkScreen)
```
expandedId           string | null    — which timeline card is expanded
celebratingId        string | null    — block showing completion animation
recentlyChecked      Set<taskId>      — taskIds currently in bounce animation
blockMenuOpen        blockId | null   — gear menu open
editingTaskId        { taskId, projectId, text } | null
dragId / dragOverId  blockId | null   — drag-to-reorder state
dwPickerOpen         slotId | null    — DW project picker open
viewingTomorrow      boolean
```

---

## Utility Functions
```js
toISODate(date?)          // → "YYYY-MM-DD", defaults to today
fmtTime(h, m)             // → "9:00 AM"
fmtRange(h, m, dur)       // → "9:00 AM – 10:30 AM"
getPct(tasks)             // → 0–100, percentage of done tasks
uid()                     // → unique id string
getRoutinesForDate(routineBlocks, date)  // → filtered routines for a day
applyDefaults(saved, defaults)           // → deep merged data object
mutateDWSlot(dateStr, slotIndex, patch)  // → updates deepWorkSlots in setData
                                         //    pass null as patch to clear a slot
```

---

## Known Gotchas

### 1. SVG attributes don't resolve CSS variables
**Wrong:**
```jsx
<circle stroke="var(--accent)" />   // renders nothing
<path fill={`var(--blue)`} />       // renders nothing
```
**Right:**
```jsx
<circle stroke="currentColor" />    // inherits CSS `color` from parent
```
Control color via CSS: `.nav-ico { color: var(--text3); }` and `.nav-btn.on .nav-ico { color: var(--accent); }`

### 2. `overflow-x:hidden` clips pickers
The `.scroll` container clips absolutely-positioned children. Pickers/dropdowns must render in normal flow; use `useEffect` + `scrollRef.scrollTo()` to bring them into view.

### 3. Nav icon sizing
Icons must be **24×24px** with `strokeWidth` of **2.0–2.2**. Thinner strokes disappear. Keep shapes simple — fewer than 6 path elements.

### 4. DW slot mutations
Never mutate `deepWorkSlots` directly. Always use:
```js
mutateDWSlot(dateStr, i, { projectId: p.id, todayTasks: [] }); // assign
mutateDWSlot(dateStr, i, null);                                 // clear
```

### 5. Refs over state for touch tracking
Use `useRef` instead of `useState` for touch position tracking — avoids stale closure bugs in touch handlers.

### 6. todayPrefs access
Always access as `data.todayPrefs || {}` — never destructure directly, guard against undefined.

### 7. useData.js length
`useData.js` is only ~48 lines — verify completeness if unexpected behavior occurs with data persistence.

---

## Data Shape (top-level `data` keys)
```
schemaVersion       number
domains             [{ id, name, color }]
projects            [{ id, name, domainId, status, tasks: [{ id, text, done, doneAt }] }]
blocks              [{ id, label, projectId, startHour, startMin, durationMin, dayOffset, todayTasks }]
inbox               [{ id, text, createdAt }]
looseTasks          [{ id, text, done, domainId, doneAt }]
weekIntention       string
shutdownDone        boolean
seasonGoals         [{ id, text, domainId, done }]
workWeek            number[]        — days of week (0=Sun)
deepBlockDefaults   [{ startHour, startMin, durationMin }]
routineBlocks       [{ id, label, tasks, startHour, startMin, durationMin, completions, recurring, dayOfWeek, targetDate }]
reviewData          { domainBlocks: { [domainId]: number } }
todayPrefs          { name, showShutdown, defaultBlock, hideTimes }
blockCompletions    [{ blockId, date, durationMin }]
deepWorkTargets     { dailyHours, weeklyHours, maxDeepBlocks }
deepWorkSlots       { [dateISO]: [{ projectId, startHour, startMin, durationMin, todayTasks }] }
todayLoosePicks     { [dateISO]: [looseTaskId] }
onboardingDone      boolean
```

---

## Onboarding Flow
- **Trigger:** `!data.onboardingDone` — renders above all app content at `z-index:200`
- **5 cards:** Welcome → Deep Work (blue) → Task Fatigue (green) → Seasons (purple) → Shutdown (teal)
- **Completion:** sets `data.onboardingDone = true` → persisted to Supabase → never shows again
- **Skip:** top-right button, same effect as completion
- **Gesture:** swipe left/right (44px threshold) or tap Next/Let's go button

---

## CSS Class Quick Reference
```
.ph              page header container
.ph-eye          eyebrow label (uppercase, small, colored)
.ph-title        large page title
.ph-sub          subtitle below title
.sh              section header row
.sh-label        section label with left border rule
.tl-card         timeline card (Work tab)
.tl-card-head    tappable card header
.tl-stripe       colored left border accent on cards
.week-card       day card (Plan tab)
.week-card.today-card   amber-tinted current day
.week-card.past-day     0.55 opacity past days
.dw-empty        dashed deep work slot button
.proj-card       project card sliding container
.proj-bar-wrap   progress bar track (4px height)
.proj-bar-fill   progress bar fill (domain color)
.loose-zone      loose tasks container
.nav-btn         bottom nav tab
.nav-btn.on      active nav tab (accent color + underline)
.nav-ico         nav icon wrapper (24×24, color:var(--text3))
.fab             center FAB button (amber, solid) — hidden on Tasks tab
.screen          full-height screen container
.scroll          scrollable content area (overflow-y:auto, overflow-x:hidden)
```

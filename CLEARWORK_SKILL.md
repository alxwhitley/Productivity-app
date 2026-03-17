# Clearwork App — Claude Skill File

Read this file at the start of every Clearwork session before touching any code.

---

## Project Overview

**App:** Clearwork — mobile-first React productivity app (iOS feel)
**Live URL:** https://productivity-app-eight-pearl.vercel.app
**Repo:** github.com/alxwhitley/Productivity-app (capital P) — local at `~/Desktop/nave-source_1/`
**Stack:** React 19, Vite 7, Supabase JS 2 — no TypeScript, no component library
**Philosophy:** Cal Newport (Deep Work, digital minimalism) + Andrew Huberman (biological prime time, shutdown rituals). The app teaches these ideas by doing, not explaining.

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
Vercel auto-deploys on push. **Stray files to verify/delete:** `App_preview.jsx`, `App.css`, `index.css`.

---

## Architecture

```
src/
  App.jsx
  constants.js
  utils.js
  useData.js          ← src/ root (not src/hooks/)
  useSwipeDown.js     ← src/ root (not src/hooks/)
  clearwork.css
  supabase.js
  main.jsx
  components/
  screens/
  sheets/
```

### Data persistence
- `useData(userId)` manages all app state — localStorage cache + Supabase sync
- **Always add new fields to `FIELD_DEFAULTS`** in `constants.js` — never use localStorage directly
- `applyDefaults()` fills missing keys on load automatically

### React hooks — CRITICAL
- Hooks must be at the top level of components — never inside IIFEs, conditionals, or nested functions
- A past white-screen crash resulted from violating this rule

---

## CSS System

### Variables — Dark mode (`:root`)
```css
--bg: #000000        /* page background */
--bg2: #090909       /* card background */
--bg3: #111111       /* input / inner surface */
--bg4: #141414       /* subtle surface / progress track */
--border: rgba(255,255,255,0.05)
--border2: rgba(255,255,255,0.04)
--accent: #FFFFFF    /* primary CTA — white */
--accent-s: rgba(255,255,255,0.08)
--green: #10B981
--red: #E05555
--blue: #3B82F6
--purple: #8B5CF6
--teal: #14B8A6
--text: #FFFFFF
--text2: #A1A1A1
--text3: #404040
```

### Domain color palette (user-selectable — these 4 only)
| Name | Hex |
|---|---|
| Flame | `#E8603C` |
| Sky | `#5BA8D4` |
| Fuchsia | `#C46BAE` |
| Mint | `#7EC8A0` |

**Color semantics (locked):**
- Domain colors are the ONLY accent colors in the UI
- White (`--accent`) = primary CTA only
- Everything else: monochrome
- The DW card's domain color wash is the single color expression on the Work tab — keep surroundings grey

### Design conventions
- **Font:** DM Sans (Google Fonts)
- **Border radius:** cards `14px`, sheets `20px` top corners, pills `22px`
- **Page header** (`.ph`): `16px 20px` padding, eyebrow + title + optional gear
- **Eyebrow** (`.ph-eye`): `11px`, `font-weight:700`, `letter-spacing:.07em`, uppercase, `var(--text3)`
- **Title** (`.ph-title`): `26px`, `font-weight:700`, `letter-spacing:-.03em`
- **Nav icons:** 24×24px SVG, `strokeWidth` 2–2.2, `currentColor`

---

## Component Map

### Screens
| Component | Tab | Description |
|---|---|---|
| `WorkScreen` | work | Bio-phase timeline — DW slots, blocks, loose tasks banner, shutdown footer |
| `TasksScreen` | tasks | Loose task queue — iOS Reminders rows, pill filters, swipe actions |
| `ProjectsScreen` | projects | Domain sections, project cards, loose tasks cards |
| `SeasonScreen` | season | Quarterly goals, review data, domain bars |

### Sheets / Overlays
| Component | Trigger |
|---|---|
| `OnboardingFlow` | `!data.onboardingDone` |
| `ShutdownSheet` | Shutdown footer |
| `AddBlockSheet` | FAB |
| `QuickReminders` | FAB capture |
| `CategorizeSheet` | Inbox item |
| `TodaySettingsSheet` | Work gear |
| `DWPickerSheet` | Empty DW slot / "Change Project" |

### Sub-components
| Component | Used in |
|---|---|
| `ProjectCard` | ProjectsScreen |
| `SwipeTask` | ProjectCard |
| `LooseTasksSection` | ProjectsScreen |
| `NavIcon` | Shared — `currentColor` SVG icons |
| `GearIcon` | Shared |
| `StatusBar` | Shared |

---

## Nav Bar
- Floating pill-shaped bar, always visible on all tabs
- Icon + label per tab; active: icon in `var(--accent)` + short underline beneath label
- No filled background on active tab
- **FAB:** visible on Work and Projects tabs only — hidden on Tasks and Season

---

## Work Tab — Conventions
- Header: date, greeting, gear icon
- Bio-phase progress bar: 4 phases (Mental Peak · Second Wind · Shallow · Wind Down), moving dot, updates every minute
- "Plan My Day" banner: slim, hides once all blocks assigned
- Fixed DW slots: 2 under Mental Peak (9am, 11am), 1 under Second Wind (1pm)
- Block states: Upcoming · Active (glowing border + large timer) · Done (faded + green checkmark)
- Shallow phase: thin "Loose Tasks" banner — tap to expand
- Shutdown Ritual: sticky footer above nav from 12pm; shows "✓ Day complete" after completion

### DW Card rendering
```js
// Active card background
background: `linear-gradient(160deg, ${domainColor}A6 0%, ${domainColor}59 60%, ${domainColor}26 100%), #0D0D0D`
boxShadow: `none`
// A6 = 65% opacity, 59 = 35%, 26 = 15%
```
- All text: white
- Task dividers: `rgba(255,255,255,0.10)`
- Checked tasks: strikethrough + `rgba(255,255,255,0.40)`
- Completed/Skipped state: domain color at 30% + content at 40% opacity
- Empty slot: `var(--bg2)` dark, dashed border, no domain color

---

## Tasks Tab — Conventions
- No FAB, no card backgrounds — tasks sit on screen background as plain rows
- Large stroke circle checkbox left, full-width text, small domain color dot below text
- **Swipe LEFT** → three buttons on RIGHT: `Sort · Today · Delete`
- **Swipe RIGHT** → Quick Win badge toggle on LEFT
- Pill filters: `All · Quick Wins`
- Tap empty space below list = inline new task (Enter to save)
- Sort panel opens inline below row, not a bottom sheet

---

## Projects Tab — Conventions
- `padding-bottom: 100px` on `.scroll` to prevent nav bar overlap
- Domain section order: domain header → Loose Tasks card → project cards
- All project cards expanded by default
- **Loose Tasks card:** collapsed by default, `var(--bg)` + border only, no color accent
  - Small grey `+` top right — tapping opens inline input at top of list
  - Tapping header expands/collapses
- Keyboard scroll: `scrollIntoView({ behavior: 'smooth', block: 'nearest' })` + `visualViewport` listener

---

## DWPickerSheet — Conventions
- 75% height, scrollable, `border-radius: 20px 20px 0 0`, drag handle, dimmed backdrop
- Domain tabs: grey default, tap to filter + light up in domain color
- Unselected card: transparent bg, dashed border, tasks greyed
- Selected card: solid border, `var(--bg2)` bg, domain color left stripe, task checkboxes appear
- One selection at a time; Confirm button full-width `var(--accent)` at bottom of selected card
- On confirm: `mutateDWSlot(dateStr, slotIndex, { projectId, todayTasks: selectedTaskIds })`

---

## Known Gotchas

### 1. SVG attributes don't resolve CSS variables
```jsx
// Wrong — renders nothing
<circle stroke="var(--accent)" />
// Right — inherits from parent CSS color property
<circle stroke="currentColor" />
```

### 2. `overflow-x:hidden` clips pickers
`.scroll` clips absolutely-positioned children. Pickers must render in normal flow; use `scrollRef.scrollTo()` to bring into view.

### 3. Nav icon sizing
24×24px, `strokeWidth` 2.0–2.2. Fewer than 6 path elements. Thinner or more complex = unreadable.

### 4. DW slot mutations
```js
mutateDWSlot(dateStr, i, { projectId: p.id, todayTasks: [] }); // assign
mutateDWSlot(dateStr, i, null);                                 // clear
```

### 5. Refs over state for touch tracking
Use `useRef` for touch positions — avoids stale closure bugs in touch handlers.

### 6. todayPrefs access
Always `data.todayPrefs || {}` — never destructure directly.

### 7. useData.js length
Only ~48 lines — verify completeness if data persistence behaves unexpectedly.

### 8. TDZ (Temporal Dead Zone) risk
Arrow functions capture references at call time. Hoisting variable declarations can introduce TDZ violations. Keep `viewDateKeyISO` and related date variables in their original position — do not hoist them.

---

## iOS Feel Rules

Reference when proposing or building any UI change.

### Touch & targets
- Minimum touch target: **44×44px** for any tappable element
- Page margins: minimum 16px — do not reduce below this
- Card radius: 10–14px (current 14px correct — do not increase)
- Sheet radius: 20px top corners only

### Navigation
- Tab bar: max 5 items
- Active tab: filled/highlighted icon; inactive: outlined or muted
- **Never hide the tab bar on any primary screen**
- Swipe gestures: fast, low threshold, spring physics

### Surfaces & color
- `--bg: #000000` is intentionally harder than Apple's `#1c1c1e` — this is a design choice, not an error
- Elevated surfaces must be **lighter** than the base — `--bg` → `--bg2` → `--bg3` stair-step is correct direction
- Borders: always `rgba(255,255,255,0.x)` in dark mode — never hardcoded hex
- SVG icons: always `currentColor` (see Gotcha #1)

### Swipe action conventions
- Destructive actions (Delete): revealed on **RIGHT** side (swipe left)
- Non-destructive actions (Edit, Sort): revealed on **LEFT** side (swipe right)
- Sheet dismiss: swipe down, 60px minimum drag before commit

### Destructive actions
- Always `--red: #E05555`
- Always require confirmation — never destructive on first tap

---

## Utility Functions
```js
toISODate(date?)                         // → "YYYY-MM-DD", defaults to today
fmtTime(h, m)                            // → "9:00 AM"
fmtRange(h, m, dur)                      // → "9:00 AM – 10:30 AM"
getPct(tasks)                            // → 0–100, % done tasks
uid()                                    // → unique id string
getRoutinesForDate(routineBlocks, date)  // → filtered routines for a day
applyDefaults(saved, defaults)           // → deep merged data object
mutateDWSlot(dateStr, slotIndex, patch)  // → updates deepWorkSlots (null = clear)
```

---

## Data Shape
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
workWeek            number[]
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
- **Trigger:** `!data.onboardingDone` — `z-index:200`, renders above all content
- **5 cards:** Welcome → Deep Work (blue) → Task Fatigue (green) → Seasons (purple) → Shutdown (teal)
- **Completion:** sets `onboardingDone = true` → Supabase → never shows again
- **Gesture:** swipe left/right (44px threshold) or tap Next/Let's go

---

## CSS Class Reference
```
.ph              page header container
.ph-eye          eyebrow label
.ph-title        large page title
.sh / .sh-label  section header + left border label
.tl-card         timeline card (Work tab)
.tl-stripe       colored left border on cards
.proj-card       project card container
.proj-bar-wrap   progress bar track (4px)
.proj-bar-fill   progress bar fill (domain color)
.nav-btn         bottom nav tab
.nav-btn.on      active tab (accent + underline)
.nav-ico         nav icon wrapper (24×24, color:var(--text3))
.fab             FAB button — hidden on Tasks tab
.screen          full-height screen container
.scroll          scrollable area (overflow-y:auto, overflow-x:hidden)
```
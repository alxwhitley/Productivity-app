---
name: clearwork-skill
description: Project context and technical reference for Clearwork, a mobile-first React productivity app. Use this skill at the start of every Clearwork coding session before touching any code. Trigger whenever the user mentions Clearwork, the productivity app, App.jsx, momentum-app, or asks to add features, fix bugs, or modify UI in the productivity app project. This skill contains file locations, architecture rules, CSS variables, component map, data shape, and known gotchas — all required reading before making any changes.
---

# Clearwork App — Claude Skill File

Read this file at the start of every Clearwork session before touching any code.

---

## Project Overview

**App:** Clearwork — mobile-first React productivity app (iOS feel)  
**Live URL:** https://productivityapp-peach.vercel.app  
**Repo:** github.com/alxwhitley/productivityapp — folder `nave-source_1`  
**Stack:** React 19, Vite 7, Supabase JS 2 — single `App.jsx`, no TypeScript, no component library  
**Philosophy:** Built on Cal Newport (Deep Work, digital minimalism) and Andrew Huberman (biological prime time, shutdown rituals). The app structure teaches these ideas by doing, not by explaining.

---

## File Locations

| Purpose | Path |
|---|---|
| Working file | `/home/claude/momentum-app.jsx` |
| Deploy source | `/home/claude/momentum-deploy/src/App.jsx` |
| User outputs | `/mnt/user-data/outputs/App.jsx` |
| Backup | `/home/claude/momentum-app-backup.jsx` |

**Workflow every session:**
1. Read relevant sections of working file before editing (`sed -n 'START,ENDp'`)
2. Edit `/home/claude/momentum-app.jsx`
3. `cp /home/claude/momentum-app.jsx /home/claude/momentum-deploy/src/App.jsx`
4. `cd /home/claude/momentum-deploy && npm run build`
5. If build passes: `cp /home/claude/momentum-app.jsx /mnt/user-data/outputs/App.jsx`
6. Present the output file to the user

Always build before presenting. Never present a file that hasn't compiled cleanly.

---

## Architecture

### Single-file structure
Everything lives in `App.jsx` (~5,400 lines). Order:
1. CSS template literal (`const css = \`...\``)
2. Constants and defaults (`FIELD_DEFAULTS`, `MIGRATIONS`, `INITIAL_DATA`)
3. Utility functions (`toISODate`, `uid`, `getPct`, `fmtTime`, `fmtRange`)
4. Hooks (`useData`)
5. Components — in dependency order (children before parents)
6. `OnboardingFlow` and shared icons (`NavIcon`, `GearIcon`)
7. Screen components (`TodayScreen`, `ProjectsScreen`, `PlanScreen`, `SeasonScreen`)
8. Sheet/overlay components
9. `export default function App()`

### Data persistence
- `useData(userId)` hook manages all app state
- Writes to `localStorage` on every change (cache)
- Syncs to Supabase `user_data` table when `userId` is present
- **Always add new state fields to `FIELD_DEFAULTS`** — `applyDefaults()` fills missing keys on load
- Never use `localStorage` directly for new fields — go through `setData`

### Adding new persistent fields
```js
// 1. Add to FIELD_DEFAULTS
const FIELD_DEFAULTS = {
  ...
  myNewField: defaultValue,
};
// 2. That's it — applyDefaults handles the rest
```

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
| Variable | Hex (dark) | Hex (light) | Usage |
|---|---|---|---|
| `--accent` | `#E8A030` | `#C07818` | Primary CTA, active nav, amber |
| `--accent-s` | `rgba(232,160,48,0.12)` | — | Accent tint backgrounds |
| `--green` | `#45C17A` | `#2E9E5B` | Completion, tasks done |
| `--red` | `#E05555` | `#C43C3C` | Missed, destructive actions |
| `--blue` | `#5B8AF0` | `#3D6FD4` | Deep Work concept, focus |
| `--purple` | `#9B72CF` | `#7B52AF` | Season / long-term thinking |
| `--teal` | `#4BAABB` | `#2E8FA0` | Shutdown / recovery |

These were introduced in the onboarding screens and are the official brand palette. Use these variables instead of hardcoding hex values.

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

### Screens
| Component | Tab | Description |
|---|---|---|
| `TodayScreen` | today | Timeline view — blocks, routines, DW slots, loose tasks |
| `ProjectsScreen` | projects | Domain tabs, project cards with task lists |
| `PlanScreen` | plan | Weekly view — 7 day cards with blocks and DW slots |
| `SeasonScreen` | season | Quarterly goals, review data, domain bars |

### Overlays / Sheets
| Component | Trigger | Description |
|---|---|---|
| `OnboardingFlow` | first login | 5-card swipeable coach sequence |
| `ShutdownSheet` | end of day | Ritual checklist + reflection |
| `AddBlockSheet` | FAB | Add block or routine |
| `CategorizeSheet` | inbox item | Assign inbox item to project |
| `QuickReminders` | FAB (capture) | Quick task capture |
| `TodaySettingsSheet` | Today gear | Name, shutdown toggle, block defaults |

### Cards / Sub-components
| Component | Used in | Description |
|---|---|---|
| `ProjectCard` | ProjectsScreen | Swipeable card — name, progress bar, task list |
| `SwipeTask` | ProjectCard | Swipe-to-delete task row |
| `LooseTasksSection` | TodayScreen | Inbox-style loose tasks per domain |
| `ThisSeasonCard` | PlanScreen | Compact season goals summary (Week tab only) |

### Shared
| Component | Description |
|---|---|
| `NavIcon` | SVG nav icons using `currentColor` — today/projects/plan/season |
| `GearIcon` | Settings gear SVG |
| `StatusBar` | iOS-style status bar mock |

---

## Key State (TodayScreen)
```
editingTaskId: { taskId, projectId, text } | null
blockMenuOpen: blockId | null
blockMenuMode: null | "project"
revealedBlockId: null
viewingTomorrow: boolean
dragId: blockId | null
dragOverId: blockId | null
expandedId: string | null   — which timeline card is expanded
```

## Key State (PlanScreen)
```
wkDwPickerOpen: string | null  — "${dateStr}-${slotIndex}"
wkDwPickerStep: {}             — { [key]: "project" | "confirm" }
wkDwPickerProj: {}             — { [key]: projectId }
wkDwPickerTime: {}             — { [key]: { startHour, startMin, durationMin } }
wkDwPickerTasks: {}            — { [key]: [taskId, ...] }
wkScrollRef: ref               — scroll container for auto-scroll to picker
wkPickerRef: ref               — picker element for scroll-into-view
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
The `.scroll` container has `overflow-x:hidden` which creates a clipping context. Pickers/dropdowns that open inside cards **cannot** use `position:absolute` to escape — they get clipped. Solution: render in normal flow, use `useEffect` + `scrollRef.scrollTo()` to scroll the container so the picker is visible.

### 3. Nav icon sizing
Icons must be **24×24px** with `strokeWidth` of **2.0–2.2**. Thinner strokes disappear. Too many details (>6 path elements) become unreadable. Keep shapes simple and bold.

### 4. DW slot mutations
Never mutate `deepWorkSlots` directly. Use `mutateDWSlot(dateStr, slotIndex, patch)`:
```js
mutateDWSlot(dateStr, i, { projectId: p.id, todayTasks: [] });  // assign
mutateDWSlot(dateStr, i, null);                                  // clear
```

### 5. Past chat sessions
Full session transcripts are stored in `/mnt/transcripts/`. A journal at `/mnt/transcripts/journal.txt` catalogs them. Use `conversation_search` or `recent_chats` tools to find prior decisions before making architectural changes.

---

## Data Shape (top-level `data` keys)
```
schemaVersion       number
domains             [{ id, name, color }]
projects            [{ id, name, domainId, status, tasks: [{ id, text, done }] }]
blocks              [{ id, label, projectId, startHour, startMin, durationMin, dayOffset, todayTasks }]
inbox               [{ id, text }]
looseTasks          [{ id, text, done, domainId }]
weekIntention       string
shutdownDone        boolean
seasonGoals         [{ id, text, domainId, done }]
workWeek            number[]   — days of week (0=Sun)
deepBlockDefaults   [{ startHour, startMin, durationMin }]
routineBlocks       [{ id, label, tasks, startHour, startMin, durationMin, completions }]
reviewData          { domainBlocks: { [domainId]: number } }
todayPrefs          { name, showShutdown, defaultBlock }
blockCompletions    [{ blockId, date, durationMin }]
deepWorkTargets     { dailyHours, weeklyHours }
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
.tl-card         timeline card (Today tab)
.tl-card-head    tappable card header
.tl-stripe       colored left border accent on cards
.week-card       day card (Week tab)
.week-card.today-card   amber-tinted current day
.week-card.past-day     0.55 opacity past days
.dw-empty        dashed deep work slot button
.dw-picker-wrap  project picker dropdown inside DW slot
.proj-card       project card sliding container
.proj-bar-wrap   progress bar track (4px height)
.proj-bar-fill   progress bar fill (domain color)
.loose-zone      loose tasks container
.nav-btn         bottom nav tab
.nav-btn.on      active nav tab (accent color)
.nav-ico         nav icon wrapper (24×24, color:var(--text3))
.fab             center FAB button (amber, solid)
.screen          full-height screen container
.scroll          scrollable content area (overflow-y:auto, overflow-x:hidden)
```

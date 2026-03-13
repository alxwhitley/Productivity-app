# Clearwork — Claude Code Master Context

Read this entire file at the start of every session. This is the single source of truth for the project.

---

# Clearwork App — Skill File

## Project Overview

**App:** Clearwork — mobile-first React productivity app (iOS feel)
**Live URL:** https://productivityapp-peach.vercel.app
**Repo:** github.com/alxwhitley/productivityapp — folder `nave-source_1`
**Stack:** React 19, Vite 7, Supabase JS 2 — single `App.jsx`, no TypeScript, no component library
**Philosophy:** Built on Cal Newport (Deep Work, digital minimalism) and Andrew Huberman (biological prime time, shutdown rituals).

---

## Session Workflow

1. Read this file
2. Read relevant sections of `src/App.jsx` before editing (use grep/sed to find specific sections)
3. Edit `src/App.jsx`
4. Run `npm run build` — must pass before considering any task done
5. Never present or commit a file that hasn't compiled cleanly

**Always build before considering a task done.**

---

## Stack

| Layer | Technology |
|---|---|
| UI framework | React 19 |
| Build tool | Vite 7 |
| Backend / auth | Supabase JS 2 |
| Styling | CSS-in-JS (template literal at top of App.jsx) |
| Language | JavaScript — no TypeScript |
| Component library | None |

Everything lives in a single `src/App.jsx` (~7,400+ lines). No separate CSS files, no component folders.

---

## Architecture

### Single-file structure
Order within `App.jsx`:
1. Imports (`react`, `supabase`)
2. Constants — `DOMAIN_COLORS`, `INITIAL_DATA`
3. Utility functions
4. Data layer — `FIELD_DEFAULTS`, `MIGRATIONS`, `applyDefaults`, `loadData`, `useData`
5. CSS — single template literal `const css = \`...\``
6. Components — children before parents (dependency order)
7. Screens — `TodayScreen`, `ProjectsScreen`, `PlanScreen`, `SeasonScreen`
8. Sheet/overlay components
9. `export default function App()`

### Component Map

| Component | Tab/Role |
|---|---|
| `TodayScreen` | Today tab — timeline, blocks, routines, DW slots, shallow work |
| `ProjectsScreen` | Projects tab — domain tabs, project cards |
| `PlanScreen` | Plan tab — weekly view |
| `SeasonScreen` | Season tab — quarterly goals |
| `PlanMyDayModal` | Plan My Day overlay (lifted state to App) |
| `ShutdownRitual` | End of day ritual (renders inside TodayScreen) |
| `OnboardingFlow` | First login coach sequence |
| `ProjectCard` | Swipeable project card |
| `SwipeTask` | Swipe-to-delete task row |

### Data Persistence
- `useData(userId)` hook manages all state
- Writes to `localStorage` on every `setData` call
- Syncs to Supabase `user_data` table when `userId` present
- **Always add new state fields to `FIELD_DEFAULTS`** — never use localStorage directly

---

## Data Shape (top-level `data` keys)

```
schemaVersion       number
domains             [{ id, name, color }]
projects            [{ id, name, domainId, status, tasks: [{ id, text, done, doneAt }] }]
blocks              [{ id, label, projectId, startHour, startMin, durationMin, dayOffset, todayTasks }]
inbox               [{ id, text, createdAt }]
looseTasks          [{ id, text, done, domainId, doneAt }]
shallowWork         { [dateISO]: [{ id, text, domainId, sourceType, sourceId, taskId, done, doneAt, addedAt }] }
weekIntention       string
shutdownDone        boolean
shutdownDate        null
swClearDate         null
seasonGoals         [{ id, text, domainId, done }]
workWeek            number[]
deepBlockDefaults   [{ startHour, startMin, durationMin }]
routineBlocks       [{ id, label, tasks, startHour, startMin, durationMin, completions }]
reviewData          { domainBlocks: { [domainId]: number } }
todayPrefs          { name, showShutdown, defaultBlock }
blockCompletions    [{ blockId, date, durationMin }]
deepWorkTargets     { dailyHours, weeklyHours, maxDeepBlocks }
deepWorkSlots       { [dateISO]: [{ projectId, startHour, startMin, durationMin, todayTasks }] }
todayLoosePicks     { [dateISO]: [looseTaskId] }
onboardingDone      boolean
wakeUpTime          { hour: 7, min: 0 }
dayLocked           boolean
captured            []
sessionLog          []
```

---

## CSS System

### Dark Mode Variables (`:root`)
```css
--bg: #181A1B
--bg2: #1E2122
--bg3: #252829
--bg4: #2C3032
--border: #2E3235
--border2: #252829
--text: #EDEAE5
--text2: #9A9591
--text3: #555250
```

### Brand Colors
| Variable | Hex | Usage |
|---|---|---|
| `--accent` | `#E8A030` | Primary CTA, active nav, amber |
| `--green` | `#45C17A` | Completion |
| `--red` | `#E05555` | Destructive |
| `--blue` | `#5B8AF0` | Deep Work |
| `--purple` | `#9B72CF` | Season |
| `--teal` | `#4BAABB` | Shutdown |

### Design conventions
- **Font:** DM Sans (Google Fonts)
- **Border radius:** cards `14px`, sheets `20px` top, pills `22px`
- **Nav icons:** 24×24px SVG, strokeWidth 2–2.2, use `currentColor`

---

## Known Gotchas

### 1. React Hooks must never be inside IIFEs or conditionals
TodayScreen uses render IIFEs (`(() => { ... })()`). Never put `useState`, `useRef`, `useEffect` inside them — always hoist to the top of the component function. This has caused bugs before.

### 2. SVG attributes can't use CSS variables
```jsx
// Wrong
<circle stroke="var(--accent)" />
// Right
<circle stroke="currentColor" />
```

### 3. overflow-x:hidden clips pickers
The `.scroll` container clips `position:absolute` children. Pickers must render in normal flow.

### 4. DW slot mutations
Never mutate `deepWorkSlots` directly:
```js
mutateDWSlot(dateStr, i, { projectId: p.id, todayTasks: [] }); // assign
mutateDWSlot(dateStr, i, null); // clear
```

### 5. todayPrefs
Always access as `data.todayPrefs || {}` — never destructure directly.

### 6. Component scope
TodayScreen runs from ~line 2670 to ~line 5143. ProjectsScreen from ~5144. Never let TodayScreen state/refs leak into ProjectsScreen. Always check which component you're editing before making changes.

---

## Utility Functions

```js
toISODate(date?)          // → "YYYY-MM-DD", defaults to today
fmtTime(h, m)             // → "9:00 AM"
fmtRange(h, m, dur)       // → "9:00 AM – 10:30 AM"
getPct(tasks)             // → 0–100, % done
uid()                     // → unique id string
mutateDWSlot(dateStr, slotIndex, patch)  // updates deepWorkSlots
applyDefaults(saved, defaults)           // deep merges data
```

---

## Key State (TodayScreen)
```
expandedId           string | null
focusSlotId          string | null
drawerOpen           boolean
drawerTouchStartY    ref
scrollRef            ref
swipeOpenId          string | null
swipeDeltaX          number
touchStartXRef       ref   ← must be at TodayScreen top level, not inside IIFE
touchMovedRef        ref   ← must be at TodayScreen top level, not inside IIFE
pmdOpen / setPmdOpen       ← lifted to App()
```

---

## Bio Phase Architecture

```js
// Phase boundaries relative to wakeUpTime:
if      (hoursSinceWake < 7)  phase = "DEEP";      // Mental Peak
else if (hoursSinceWake < 10) phase = "RECOVER";   // Second Wind
else if (hoursSinceWake < 13) phase = "TROUGH";    // Shallow Work
else                          phase = "SHUTDOWN";  // Wind Down
```

---

## Shallow Work Data Model

- `data.looseTasks` = Projects tab permanent store (standalone tasks with domain, no project)
- `data.shallowWork[dateISO]` = Today tab daily curated list — resets every morning
- Each shallow work item: `{ id, text, domainId, sourceType: "loose"|"project"|"manual", sourceId, taskId, done, doneAt, addedAt }`
- Checking off propagates done state back to source
- Daily reset wipes `shallowWork[todayISO]`, sends orphan manual tasks to inbox

---

## Feature Roadmap

### Recently Completed ✅
- 5-color brand palette (blue/amber/green/purple/teal)
- Deep Work blocks system with domain-colored borders
- Onboarding coach flow (5-card swipeable)
- Email/password auth (replaced magic link)
- Task checkoff bounce animation
- Next action highlight (amber left border on first unchecked task)
- "Work on This Now" button from Projects tab
- Shallow Work sheet (renamed from Loose Tasks) with swipe-to-delete
- Plan My Day modal (lifted state to App)
- Shutdown Ritual wizard
- Bio phase arc bar
- Swipe-down gesture to open Plan My Day

### In Progress 🔄
- Flexible / no-times mode toggle (hide time column, `todayPrefs.hideTimes`)

### Backlog 💡
- Drag-to-reschedule blocks
- Quick time edit (tap time label)
- Task priority flags
- Week intention prompt
- Focus mode (hide everything except active block)
- Recurring blocks
- Domain picker toolbar on task inputs (deferred — do not add until requested)

---

## Design Philosophy

- **Capture fast** — under 3 seconds
- **Reduce decisions** — every feature makes next action clearer
- **Execution over organization** — help users finish work, not manage tasks
- **Progressive disclosure** — simple flows first
- **Momentum signals** — completion feels rewarding

Before implementing any feature ask:
1. Does this reduce friction between intention and action?
2. Does it make the next action clearer?
3. Does it fit Newport/Huberman philosophy?

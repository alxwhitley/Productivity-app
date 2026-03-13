# ARCHITECTURE.md
Clearwork — Code Architecture Reference

Accurate as of ~5,800 lines. When in doubt, grep the file.

---

## File Structure

Everything lives in one file: `App.jsx`. Order within the file:

1. Imports (`react`, `supabase`)
2. Constants — `DOMAIN_COLORS`, `INITIAL_DATA`
3. Utility functions
4. Data layer — schema version, storage key, `FIELD_DEFAULTS`, `MIGRATIONS`, `applyDefaults`, `loadData`, `useData`
5. CSS — single template literal `const css = \`...\``
6. Components — children before parents (dependency order)
7. Screens — `TodayScreen`, `ProjectsScreen`, `PlanScreen`, `SeasonScreen`
8. Sheet/overlay components
9. `export default function App()`

---

## Component Map

### Screens
| Component | Tab | Line (approx) |
|---|---|---|
| `TodayScreen` | today | ~1227 |
| `ProjectsScreen` | projects | ~3329 |
| `PlanScreen` | plan | ~3583 |
| `SeasonScreen` | season | ~4410 |

### Overlays / Sheets
| Component | Trigger |
|---|---|
| `OnboardingFlow` | First login (`!data.onboardingDone`) |
| `ShutdownSheet` | End-of-day button on Today |
| `AddBlockSheet` | FAB → block |
| `QuickReminders` | FAB → capture |
| `CategorizeSheet` | Inbox item → assign |
| `TodaySettingsSheet` | Today gear icon |
| `ProjectsManageSheet` | Projects gear icon |
| `DomainEditSheet` | Domain edit from Projects |
| `WorkWeekSheet` | Plan tab settings |
| `AssignGhostSheet` | Plan tab ghost block |

### Sub-components
| Component | Used in |
|---|---|
| `ProjectCard` | ProjectsScreen |
| `SwipeTask` | ProjectCard |
| `LooseTasksSection` | ProjectsScreen |
| `RoutineBlockView` | TodayScreen, PlanScreen |
| `ThisSeasonCard` | PlanScreen (week view) |
| `InboxSwipeRow` | CategorizeSheet |

### Shared
| Component | Description |
|---|---|
| `NavIcon` | SVG nav icons — today/projects/plan/season |
| `GearIcon` | Settings gear SVG |
| `StatusBar` | iOS-style status bar mock |
| `OnboardingIllustration` | SVG illustrations for onboarding cards |

---

## Data Layer

### Persistence
`useData(userId)` hook manages all app state:
- Reads from `localStorage` on mount (`nave_data_v1` key)
- Writes to `localStorage` on every `setData` call (cache)
- Syncs to Supabase `user_data` table when `userId` is present
- Schema version tracked in `data.schemaVersion`; migrations run on load

### Adding a New Persistent Field
```js
// 1. Add to FIELD_DEFAULTS — that's it
const FIELD_DEFAULTS = {
  ...
  myNewField: defaultValue,
};
// applyDefaults() merges missing keys automatically on every load
// Never use localStorage directly for new fields — use setData
```

### Data Shape (top-level keys)
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
todayPrefs          { name, showShutdown, defaultBlock }
blockCompletions    [{ blockId, date, durationMin }]
deepWorkTargets     { dailyHours, weeklyHours, maxDeepBlocks }
deepWorkSlots       { [dateISO]: [{ projectId, startHour, startMin, durationMin, todayTasks }] }
todayLoosePicks     { [dateISO]: [looseTaskId] }
onboardingDone      boolean
```

---

## Utility Functions

```js
toISODate(date?)                        // → "YYYY-MM-DD", defaults to today
fmtTime(h, m)                           // → "9:00 AM"
fmtRange(h, m, dur)                     // → "9:00 AM – 10:30 AM"
getPct(tasks)                           // → 0–100, % of done tasks
uid()                                   // → unique id string
getRoutinesForDate(routineBlocks, date) // → filtered routines for a day
applyDefaults(saved, defaults)          // → deep merged data object
mutateDWSlot(dateStr, slotIndex, patch) // → updates deepWorkSlots via setData
                                        //    pass null as patch to clear a slot
```

---

## CSS System

CSS lives in a single template literal at the top of the file (~line 271). It is injected via `<style>{css}</style>` in the App return.

### Dark Mode Variables (`:root`)
```css
--bg: #181A1B        /* page background */
--bg2: #1E2122       /* card background */
--bg3: #252829       /* input / inner surface */
--bg4: #2C3032       /* subtle surface / progress track */
--border: #2E3235
--border2: #252829
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

### Typography
- **Font:** DM Sans (Google Fonts)
- **Page eyebrow** (`.ph-eye`): 11px, weight 700, letter-spacing 0.07em, uppercase, `var(--text3)`
- **Page title** (`.ph-title`): 26px, weight 700, letter-spacing -0.03em
- **Section header** (`.sh-label`): left border rule `border-left: 2px solid var(--border2)` + `padding-left: 8px`

### Layout Classes
```
.screen          full-height screen container
.scroll          scrollable content (overflow-y:auto, overflow-x:hidden)
.ph              page header container
.sh              section header row
.tl-wrap         timeline wrapper (Today tab)
.tl-item         one timeline row (flex, gap 10px)
.tl-left         time column (width 56px, contains time label + connector)
.tl-card         timeline card body
.tl-card.now-card  active block — amber border, scale 1.018, pulse animation
.week-card       day card (Plan tab)
.proj-card       project card (Projects tab)
.nav-btn         bottom nav tab
.nav-btn.on      active nav tab
.fab             center FAB button
```

---

## Known Gotchas

### SVG can't use CSS variables
```jsx
// Wrong — renders nothing
<circle stroke="var(--accent)" />
// Right — inherits color from parent CSS
<circle stroke="currentColor" />
```

### overflow-x:hidden clips absolute pickers
The `.scroll` container clips anything that tries to escape with `position:absolute`. Pickers/dropdowns must render in normal flow; use `scrollRef.scrollTo()` to bring them into view.

### DW slot mutations
Never mutate `deepWorkSlots` directly. Always use:
```js
mutateDWSlot(dateStr, i, { projectId: p.id, todayTasks: [] }); // assign
mutateDWSlot(dateStr, i, null);                                 // clear
```

### Nav icon sizing
Icons must be 24×24px, `strokeWidth` 2.0–2.2. Fewer than 6 path elements. Too thin or too complex = unreadable.

### todayPrefs
Access as `data.todayPrefs || {}` — never destructure directly, guard against undefined.

---

## Key State Snapshots

### TodayScreen
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

### PlanScreen
```
wkDwPickerOpen       string | null    — "${dateStr}-${slotIndex}"
wkDwPickerStep       {}               — { [key]: "project" | "confirm" }
wkDwPickerProj       {}               — { [key]: projectId }
wkDwPickerTime       {}               — { [key]: { startHour, startMin, durationMin } }
wkDwPickerTasks      {}               — { [key]: [taskId, ...] }
```

### App (root)
```
tab                  "today" | "projects" | "plan" | "season"
sheet                string | null    — which sheet is open
jumpToBlock          blockId | null   — auto-expand + scroll on Today mount
focusMode            boolean
```

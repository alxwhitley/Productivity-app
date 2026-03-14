# FEATURE_ROADMAP.md
Clearwork — Feature Roadmap

Update this file as features are completed or priorities change.
Format: mark done items ✅, in-progress 🔄, ideas/backlog 💡

---

## Recently Completed ✅

### Foundation
- ✅ **5-color brand palette** — Huberman-mapped colors (blue/amber/green/purple/slate) applied across domains, onboarding, and project cards
- ✅ **Email/password auth** — Replaced magic link auth with email + password login
- ✅ **Onboarding coach flow** — 5-card swipeable overlay on first login; sets `onboardingDone` on complete or skip

### Work Tab (formerly Today)
- ✅ **Tab renamed to Work** — `TodayScreen` → `WorkScreen`, tab label updated throughout
- ✅ **Bio-phase progress bar** — 4 phases (Mental Peak · Second Wind · Shallow · Wind Down), moving dot, updates every minute
- ✅ **Phase section headers** — ⚡ Mental Peak · 🔁 Second Wind · 📋 Shallow · 🌙 Wind Down
- ✅ **Fixed block slots** — 2 under Mental Peak (9am, 11am), 1 under Second Wind (1pm)
- ✅ **Three block states** — Upcoming · Active (glowing border + large timer) · Done (faded + green checkmark)
- ✅ **Active block highlight** — Current block gets amber border, scale(1.018), breathing pulse animation; auto-expands on entry
- ✅ **Completion celebration** — Marking a block done triggers particle burst overlay + "Block complete" label for 1.6s
- ✅ **Next action highlight** — First unchecked task in active block gets amber left border; advances automatically as tasks complete
- ✅ **Task checkoff bounce** — Checking a task triggers checkbox scale animation + green row flash
- ✅ **"Work on This Now"** — Expanded project cards show full-width button; creates block at current time (rounded 15 min) and jumps to Work tab
- ✅ **Shutdown Ritual sticky footer** — Appears above nav bar from 12pm; shows "✓ Day complete" in green after completion
- ✅ **Shallow Loose Tasks banner** — Thin banner in Shallow phase; tap to expand today's loose tasks
- ✅ **Plan My Day banner** — Slim one-line banner with subtitle; hides once all blocks assigned
- ✅ **Deep work block cap** — `maxDeepBlocks` setting in Work gear; cap applies across blocks and DW slots
- ✅ **Gear menu inline expand** — Block gear opens inline management panel (change project, push to tomorrow, clear slot)

### Tasks Tab (new)
- ✅ **Tasks tab created** — New tab between Work and Projects
- ✅ **iOS Reminders-inspired rows** — No card backgrounds; tasks on screen background with dividers; large stroke circle checkbox; domain color dot below text
- ✅ **Swipe LEFT** — Reveals three buttons on RIGHT: Sort · Today · Delete
- ✅ **Swipe RIGHT** — Instant Quick Win badge toggle on LEFT
- ✅ **Pill filters** — All · Quick Wins
- ✅ **Inline task capture** — Tap empty space below list to open new task input inline
- ✅ **Inline task edit** — Tap existing task text to edit inline
- ✅ **Sort panel** — Inline below row (flat domain + project list), not a bottom sheet
- ✅ **FAB hidden on Tasks tab** — FAB only visible on Work and Projects tabs

### Projects Tab
- ✅ **All cards expanded by default** — No expand/collapse all chevron
- ✅ **Loose Tasks card per domain** — Subtle collapsed card above project cards; `var(--bg)` background, border only, no color accent
- ✅ **Loose Tasks inline add** — Grey `+` top right; tapping expands and opens inline input at top of list
- ✅ **Keyboard scroll behavior** — `scrollIntoView` + `visualViewport` listener keeps active input above keyboard
- ✅ **"Add project" moved to gear** — Removed from bottom of screen

### Nav Bar
- ✅ **Floating pill-shaped nav bar** — Always visible on all tabs
- ✅ **Active tab style** — Icon in `var(--accent)` + short underline beneath label; no filled background highlight
- ✅ **4 tabs** — Work · Tasks · Projects · Season

### Auth
- ✅ **Supabase config** — Site URL must include `https://`; Redirect URLs use `/**` wildcard pattern

---

## In Progress 🔄

- 🔄 **Flexible / no-times mode** — Toggle in Work gear (`todayPrefs.hideTimes`) to hide time column; cards fill full width
- 🔄 **DWPickerSheet** — New bottom sheet for assigning deep work blocks; replaces 2-column grid picker; project cards in selection mode (dashed → solid), task checkboxes, confirm button on card

---

## Near-Term Backlog 💡

### Work Tab
- 💡 **Drag-to-reschedule** — Drag blocks to different time slots (drag-to-reorder exists, no time remapping yet)
- 💡 **Quick time edit** — Tap time label on a block to edit start time inline
- 💡 **Block duration scrubber** — Pull bottom edge of block card to resize duration visually
- 💡 **Plan My Day guided flow** — Rebuild the guided planning flow (currently a stub that navigates to Plan tab)

### Tasks Tab
- 💡 **"Processed X of Y today"** — Queue section header counter showing daily processing progress
- 💡 **Empty state animation** — "Queue clear ✓" in green for 2 seconds when queue is empty
- 💡 **One-time swipe hint** — On first load, brief animation showing swipe directions

### Projects Tab
- 💡 **Task priority flags** — Flag a task as most important in the project; surfaces as "next action" in Work blocks
- 💡 **Project progress nudges** — If active project has no completed tasks in 7 days, surface a subtle prompt
- 💡 **Bulk task add** — Paste a list of tasks and have them parsed into individual rows

### Season Tab
- 💡 **Season review prompt** — Structured review flow at end of quarter before starting new season
- 💡 **Domain balance ring** — Visual ring chart showing block time distributed across domains this season

### Cross-cutting
- 💡 **Focus mode** — Hide everything except the active block and its tasks; all other UI fades out
- 💡 **Recurring blocks** — Mark a block as recurring (daily / weekdays / weekly)
- 💡 **Notifications** — Optional reminder at block start time (requires PWA or native wrapper)
- 💡 **Export** — Export completed work log as text summary or CSV

---

## Deferred / Reconsidered ❌

- ❌ **Today / Later pills on capture** — Removed. Routing during capture adds friction. Inbox processing is the right moment.
- ❌ **Complex onboarding wizard** — Replaced with 5-card swipeable coach sequence.
- ❌ **Domain picker toolbar** — Explicitly deferred. Do not add yet.
- ❌ **DW slot 2-column grid picker** — Replaced by `DWPickerSheet` (bottom sheet with full project cards in selection mode).

---

## Prioritization Principles

When evaluating new features, ask:
1. Does this reduce friction between intention and action?
2. Does it make the next action clearer?
3. Does it fit the Newport/Huberman philosophy — or does it add noise?

Features that encourage organization over execution should be reconsidered or made optional.

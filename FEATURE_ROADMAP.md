# FEATURE_ROADMAP.md
Clearwork — Feature Roadmap

Update this file as features are completed or priorities change.
Format: mark done items ✅, in-progress 🔄, ideas/backlog 💡

---

## Recently Completed ✅

### UI & Interaction
- ✅ **5-color brand palette** — Huberman-mapped colors (blue/amber/green/purple/teal) applied across domains, onboarding, and project cards
- ✅ **Gear menu inline expand** — Block gear opens an inline management panel (change project, push to tomorrow, clear slot)
- ✅ **Deep work block cap** — `maxDeepBlocks` setting in Today gear
- ✅ **Project picker 2-column grid** — DW slot project picker shows 2-col grid with color dot + stacked name/domain
- ✅ **Active block highlight** — Current block gets amber border, scale(1.018), breathing pulse animation; auto-expands on entry
- ✅ **Completion celebration** — Marking a block done triggers particle burst overlay + "Block complete" label for 1.6s
- ✅ **Inbox aging badges** — Colored age badges (green = today, amber = 1 day, red = 3+ days); nav dot pulses red when items age past 2 days
- ✅ **Fast capture rewrite** — QuickReminders is pure capture; items go straight to inbox with `createdAt` timestamp
- ✅ **Next action highlight** — First unchecked task in active block gets amber left border; auto-advances as tasks complete
- ✅ **Task checkoff bounce** — Checkbox scale animation + green row flash in Today timeline and Projects tab
- ✅ **"Work on This Now"** — Creates a 90-min block at current time from Projects tab and jumps to Today

### Data & Auth
- ✅ **Email/password auth** — Replaced magic link login (hit Supabase rate limits); includes sign in/up tabs, forgot password, inline messaging
- ✅ **Onboarding coach flow** — Full-screen swipeable 5-card overlay, persisted via `data.onboardingDone`

### Today Screen — Major Refactor
- ✅ **Biological zoom** — Cards flex based on bio phase; current block expands, future phases compress
- ✅ **Bio phase arc bar** — Visual day arc showing Mental Peak / Second Wind / Shallow Work / Wind Down with now-dot
- ✅ **Plan My Day modal** — Multi-step wizard for planning blocks; state lifted to App() so it persists across modal open/close
- ✅ **Swipe-down to open Plan My Day** — Pull down from top of Today screen triggers PMD modal directly
- ✅ **Shutdown Ritual wizard** — Multi-step end-of-day flow rendered as overlay inside TodayScreen
- ✅ **Shallow Work sheet** — Renamed from "Loose Tasks"; daily curated list (`data.shallowWork[dateISO]`); resets each morning
- ✅ **Shallow Work swipe-to-delete** — Swipe left on task reveals red Delete button on right
- ✅ **Shallow Work tap behavior** — Tap empty row space toggles checkmark; tap task text opens inline edit
- ✅ **Shallow Work project picker** — Pick FAB opens sheet showing loose tasks + project tasks grouped by domain/project
- ✅ **Daily reset** — On new day: wipes shallow work, sends orphan manual tasks to inbox, resets shutdownDone and dayLocked

---

## In Progress 🔄

- 🔄 **Flexible / no-times mode** — Toggle in Today gear to hide the time column (`.tl-left`); cards expand to fill full width; stored in `todayPrefs.hideTimes`

---

## Near-Term Backlog 💡

### Today Screen
- 💡 **Drag-to-reschedule** — Drag blocks to different time slots (drag-to-reorder exists but no time remapping)
- 💡 **Quick time edit** — Tap time label on a block to edit start time inline
- 💡 **Block duration scrubber** — Pull bottom edge of a block card to resize duration

### Projects Screen
- 💡 **Task priority flags** — Flag a task as most important; surfaces as "next action" in Today blocks
- 💡 **Project progress nudges** — Prompt if active project has no completed tasks in 7 days
- 💡 **Bulk task add** — Paste a list and have it parsed into individual task rows

### Plan Screen
- 💡 **Week intention prompt** — If `weekIntention` is empty on Monday morning, prompt before showing week view
- 💡 **Copy last week's blocks** — One-tap to replicate last week's block pattern

### Season Screen
- 💡 **Season review prompt** — Structured review flow at end of quarter before starting new season
- 💡 **Domain balance ring** — Visual ring chart showing block time distributed across domains

### Cross-cutting
- 💡 **Focus mode** — Hide everything except active block and its tasks; all other UI fades out
- 💡 **Recurring blocks** — Mark a block as recurring (daily / weekdays / weekly)
- 💡 **Notifications** — Optional reminder at block start time (requires PWA or native wrapper)
- 💡 **Export** — Export completed work log as text summary or CSV
- 💡 **Domain picker toolbar** — Inline domain dot picker on task add inputs (Projects, Shallow Work, PMD loose tasks); deferred — do not add until requested

---

## Deferred / Reconsidered

- ❌ **Today / Later pills on capture** — Removed. Routing during capture adds friction.
- ❌ **Complex onboarding wizard** — Replaced with 5-card swipeable coach sequence.
- ❌ **"Do Today" from inbox** — Replaced by Shallow Work model.

---

## Notes for Prioritization

When evaluating new features, ask:
1. Does this reduce friction between intention and action?
2. Does it make the next action clearer?
3. Does it fit the Newport/Huberman philosophy — or does it add noise?

Features that encourage organization over execution should be reconsidered or made optional.

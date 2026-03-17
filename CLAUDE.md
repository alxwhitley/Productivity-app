# Clearwork — Claude Code Instructions

## Read this file every session before touching any code.

---

## Project

Mobile-first React productivity app. iOS feel. Built on Cal Newport (Deep Work) and Huberman (ultradian rhythms, shutdown rituals).

- **Repo:** `~/Desktop/nave-source_1/`
- **Live:** https://productivityapp-peach.vercel.app
- **Stack:** React 19, Vite 7, Supabase JS 2, plain JavaScript (no TypeScript), no component library

---

## File Structure

```
nave-source_1/
  src/
    App.jsx              ← routing + root state only (~181 lines)
    main.jsx
    supabase.js
    constants.js         ← FIELD_DEFAULTS, DOMAIN_COLORS, INITIAL_DATA — all persistent data defaults live here
    useData.js           ← primary data hook (read before any data-layer edits)
    useSwipeDown.js      ← swipe gesture hook
    clearwork.css        ← all styles (CSS variables + classes)

    screens/
      WorkScreen.jsx
      ProjectsScreen.jsx
      TasksScreen.jsx
      SeasonScreen.jsx
      ProfileScreen.jsx
      ShutdownRitualScreen.jsx

    components/
      DWCard.jsx
      GearIcon.jsx
      LoginScreen.jsx
      NavIcon.jsx
      OnboardingFlow.jsx
      OnboardingIllustration.jsx
      ProjectCard.jsx
      RoutineBlockView.jsx
      StatusBar.jsx
      SwipeTask.jsx
      TaskRow.jsx
      TimerBlock.jsx
      WaveIcon.jsx

    sheets/
      AddBlockSheet.jsx
      DomainEditSheet.jsx
      DWPickerSheet.jsx
      ProjectsManageSheet.jsx
      QuickReminders.jsx
      ShutdownSheet.jsx
      TodaySettingsSheet.jsx
      WorkWeekSheet.jsx

    assets/
```

---

## Workflow

1. Read the relevant source file(s) before editing — use `sed -n 'START,ENDp'` for large files
2. Make surgical edits only — do not refactor outside the scope of the task
3. Run `npm run build` — must pass before declaring done
4. Push: `cd ~/Desktop/nave-source_1 && git add . && git commit -m "message" && git push`
5. Vercel auto-deploys on push (~12 seconds)

**Never declare a task complete if the build fails.**

---

## Hard Rules

- No TypeScript
- No new dependencies without asking
- No component library
- All new persistent fields go in `FIELD_DEFAULTS` in `constants.js` only — never use localStorage directly
- Hooks at top level only — never inside conditionals, IIFEs, or render functions
- Surgical edits only — do not touch code outside the task scope

---

## CSS System (`clearwork.css`)

### Surface variables
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

### Brand colors (semantic — do not reassign)
```css
--accent: #E8A030    /* primary CTA, active nav — amber */
--green:  #45C17A    /* completion, done states */
--red:    #E05555    /* destructive actions */
--blue:   #5B8AF0    /* deep work / focus */
--purple: #9B72CF    /* season / long-term */
--teal:   #4BAABB    /* shutdown / recovery */
```

### Domain/project color palette (neutral only — these are the ONLY valid picker colors)
- Slate `#6B7A8D` · Rose `#C47A7A` · Sand `#B89B6A` · Sage `#7A9E7E` · Dusk `#8A7AAE` · Stone `#8A9099`

**Brand colors must never appear in domain or project color pickers.**

---

## Known Gotchas

### SVG cannot use CSS variables
```jsx
// Wrong — renders nothing
<circle stroke="var(--accent)" />
// Right — inherit via CSS color property
<circle stroke="currentColor" />
```
Control color via CSS: `.my-icon { color: var(--accent); }`

### overflow-x:hidden clips absolute pickers
The scroll container has `overflow-x:hidden` which creates a clipping context. Dropdowns/pickers inside cards cannot use `position:absolute` to escape — they get clipped. Render in normal flow and use `scrollRef.scrollTo()` to bring them into view.

### TDZ (Temporal Dead Zone) risk
Arrow functions capture references at call time. Hoisting variable declarations can introduce TDZ violations. Keep `viewDateKeyISO` and related date variables in their original position — do not hoist them.

### DW slot mutations
Never mutate `deepWorkSlots` directly. Always use `mutateDWSlot`:
```js
mutateDWSlot(dateStr, i, { projectId: p.id, todayTasks: [] }); // assign
mutateDWSlot(dateStr, i, null);                                 // clear
```

### todayPrefs
Always access as `data.todayPrefs || {}` — never destructure directly without guarding.

---

## Data Shape (top-level keys in `useData`)

```
schemaVersion, domains, projects, blocks, inbox, looseTasks,
weekIntention, shutdownDone, seasonGoals, workWeek,
deepBlockDefaults, routineBlocks, reviewData, todayPrefs,
blockCompletions, deepWorkTargets, deepWorkSlots,
todayLoosePicks, onboardingDone
```

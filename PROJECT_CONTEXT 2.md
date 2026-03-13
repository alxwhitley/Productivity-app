# PROJECT_CONTEXT.md
Clearwork App — Master Context File

Read this at the start of every session. If anything here contradicts the actual code, the code wins.

---

## What Is Clearwork

Clearwork is a mobile-first React productivity app with an iOS feel. It is built on two intellectual frameworks:

- **Cal Newport** — Deep Work, digital minimalism. The app structures your day around protected blocks of focused work, not open-ended task lists.
- **Andrew Huberman** — Biological prime time, ultradian rhythms, shutdown rituals. The 90-minute block cadence and the shutdown ritual are direct implementations of this research.

The app teaches these ideas by doing, not by explaining. Users shouldn't need to read about Deep Work to benefit from it.

**Live URL:** https://productivityapp-peach.vercel.app
**Repo:** github.com/alxwhitley/productivityapp — folder `nave-source_1`

---

## File Locations

| Purpose | Path |
|---|---|
| Working file | `/home/claude/momentum-app.jsx` |
| Deploy source | `/home/claude/momentum-deploy/nave-source_1/src/App.jsx` |
| User outputs | `/mnt/user-data/outputs/App.jsx` |
| Transcript journal | `/mnt/transcripts/journal.txt` |
| Skill file | `CLEARWORK_SKILL.md` (project file — read every session) |

---

## Session Workflow

Every session, in order:

1. Read `CLEARWORK_SKILL.md` from project files
2. Read relevant sections of working file before editing (`sed -n 'START,ENDp'`)
3. Edit `/home/claude/momentum-app.jsx`
4. `cp /home/claude/momentum-app.jsx /home/claude/momentum-deploy/nave-source_1/src/App.jsx`
5. `cd /home/claude/momentum-deploy/nave-source_1 && npm run build`
6. If build passes: `cp /home/claude/momentum-app.jsx /mnt/user-data/outputs/App.jsx`
7. Present the output file

**Never present a file that hasn't compiled cleanly.**

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

Everything lives in a single `App.jsx`. No separate CSS files, no component folders.

---

## Design Philosophy

- **Capture fast.** Task capture must take under 3 seconds.
- **Reduce decisions, not add them.** Every feature should make the next action clearer, not open more choices.
- **Execution over organization.** The app should help users finish work, not manage tasks.
- **Progressive disclosure.** Simple flows first. Complexity only when the user needs it.
- **Momentum signals.** Completion feels rewarding. Progress is visible. The system reinforces doing.

The five brand colors map to Huberman's motivational psychology:
- Blue `#5B8AF0` — deep focus
- Amber `#E8A030` — drive / dopamine (primary accent)
- Green `#45C17A` — completion / recovery
- Purple `#9B72CF` — identity / long-term thinking (seasons)
- Slate `#8A9BB0` — neutral / admin

---

## Product Background

The app has four tabs:

| Tab | Purpose |
|---|---|
| Today | Timeline of today's blocks, routines, deep work slots, and loose tasks |
| Projects | Domain-organized project cards with task lists |
| Plan | Weekly view — 7 day cards with blocks and deep work slots |
| Season | Quarterly goals, domain balance, review data |

The core loop is: **capture → organize → block → execute → shutdown**.

Users capture stray tasks into an inbox, assign them to projects, schedule blocks for those projects on Today or Plan, then work through tasks inside those blocks. The Shutdown Ritual closes the workday deliberately.

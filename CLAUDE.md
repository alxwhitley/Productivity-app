{\rtf1\ansi\ansicpg1252\cocoartf2822
\cocoatextscaling0\cocoaplatform0{\fonttbl\f0\fswiss\fcharset0 Helvetica;}
{\colortbl;\red255\green255\blue255;}
{\*\expandedcolortbl;;}
\margl1440\margr1440\vieww11520\viewh8400\viewkind0
\pard\tx720\tx1440\tx2160\tx2880\tx3600\tx4320\tx5040\tx5760\tx6480\tx7200\tx7920\tx8640\pardirnatural\partightenfactor0

\f0\fs24 \cf0 # Clearwork \'97 Claude Code Instructions\
\
## Read first, every session\
Before touching any code, read these files in order:\
1. `CLEARWORK_SKILL.md` \'97 project overview, architecture, conventions, gotchas\
2. `CLEARWORK_SURFACES.md` \'97 surface and elevation system for all UI components\
\
## Workflow\
- Never edit files without reading the relevant section first\
- Never present a file that hasn't built cleanly\
- Push command: `cd ~/Desktop/nave-source_1 && git add . && git commit -m "message" && git push`\
- Vercel auto-deploys on push (~12 seconds)\
\
## Rules\
- No TypeScript, no component library, no new dependencies without asking\
- All new persistent data fields go in FIELD_DEFAULTS in constants.js only\
- Never use localStorage directly \'97 always go through setData\
- Hooks at top level only \'97 never inside conditionals, IIFEs, or nested functions\
- Run `npm run build` before declaring any task complete\
- Surgical edits only \'97 do not refactor code outside the scope of the task}
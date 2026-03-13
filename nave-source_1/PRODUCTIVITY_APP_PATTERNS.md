
# PRODUCTIVITY_APP_PATTERNS.md
Design Patterns for Productivity Applications

Purpose
This document provides UX and interaction design patterns commonly used in successful productivity tools.
It helps guide feature design, user flows, and interface decisions.

These patterns are inspired by modern productivity software such as:
- Todoist
- Things
- Notion
- Linear
- Superhuman

Claude should reference these patterns when proposing product features or UI improvements.

---

# Core Goal of a Productivity App

A productivity app should help users:

• Capture tasks quickly  
• Decide what matters  
• Focus on the next action  
• Maintain momentum  
• Complete meaningful work

The interface should reduce friction between intention and action.

---

# Pattern 1: Instant Capture

Users should be able to capture a task immediately without navigating complex UI.

Recommended features:

• Quick add input
• Global keyboard shortcut
• Floating add button
• Natural language entry

Example:

"Call dentist tomorrow 10am"

System automatically parses:
Task: Call dentist
Date: Tomorrow
Time: 10am

Goal:
Task capture should take less than 3 seconds.

---

# Pattern 2: Clear Next Action

Users should never wonder what to work on next.

UI should highlight:

• Today's tasks
• Highest priority items
• Tasks currently in progress

Common solutions:

• Today view
• Focus mode
• Priority highlighting
• Smart sorting

---

# Pattern 3: Progressive Complexity

Start simple. Reveal complexity gradually.

Good flow:

1. Add task
2. Add due date (optional)
3. Add project (optional)
4. Add tags or metadata (optional)

Bad flow:

User must configure everything before saving the task.

---

# Pattern 4: Momentum Feedback

Completion should feel rewarding.

Examples:

• subtle completion animation
• progress bar
• daily streak indicator
• celebration micro-interaction

These reinforce task completion behavior.

---

# Pattern 5: Low Cognitive Load

Users should not have to think about the system structure.

Avoid:

• too many folders
• complex configuration
• decision-heavy flows

Prefer:

• smart defaults
• automatic organization
• contextual suggestions

---

# Pattern 6: Frictionless Editing

Users should be able to edit tasks inline.

Examples:

Click task → edit instantly

Avoid modal-heavy editing workflows.

Editing should feel lightweight and reversible.

---

# Pattern 7: Visibility of Progress

Users should see progress clearly.

Examples:

• completed task counters
• daily progress indicators
• project completion percentage

Progress visibility increases motivation.

---

# Pattern 8: Minimal Navigation

Users should stay in one primary workspace.

Avoid forcing navigation across many screens.

Preferred layouts:

• single main task view
• side panel navigation
• expandable details

---

# Pattern 9: Intelligent Defaults

The system should make smart assumptions.

Examples:

Tasks added in "Today" default to today.

Tasks added in a project automatically belong to that project.

Users should rarely need to configure metadata.

---

# Pattern 10: Focus Mode

Allow users to isolate the task they are working on.

Examples:

• distraction-free mode
• hide completed tasks
• show only active task

This supports deep work.

---

# UX Evaluation Checklist

Before implementing a feature, evaluate:

Does this reduce friction?  
Does this help the user start work faster?  
Does this clarify the next action?  
Does this reduce decision fatigue?  
Does this encourage task completion?

If the answer is no, the feature should be reconsidered.

---

# Final Principle

A productivity app should not merely help users organize tasks.

It should help them finish meaningful work.

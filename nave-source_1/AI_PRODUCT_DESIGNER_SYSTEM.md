---
name: ai-product-designer-system
description: UX, user flow, and interaction design guidelines for productivity applications. Use this skill when proposing features, modifying UI, improving user flows, evaluating interaction design, or reviewing any design decision for a productivity app. Trigger whenever the user asks about feature design, UX patterns, friction reduction, cognitive load, progressive disclosure, task capture, or any product decision that affects how users interact with the app. Always reference this before suggesting UI changes or new features.
---

# AI Product Designer System
Guidelines for UX, User Flow, and Interaction Design

## Purpose
This document defines how features and interactions should be designed for this productivity application. The goal is to reduce friction between a user's intention and completing meaningful work.

Claude must use this framework when proposing features, modifying UI, or improving user flows.

---

# Core Product Philosophy

This application should help users:

- Capture tasks quickly  
- Decide what matters  
- Focus on the next action  
- Maintain momentum

The system should reduce thinking overhead and remove friction between intention and action.

The product should prioritize clarity, speed, and completion over complexity and customization.

---

# Jobs-To-Be-Done Framework

Before proposing any feature, identify the user's job-to-be-done.

Examples of jobs:
- Capture a task before forgetting it  
- Decide what to work on next  
- Track progress on meaningful work  
- Reduce mental load by organizing tasks  
- Maintain focus during work sessions

Claude must clearly identify the job being solved before suggesting UI or features.

---

# User Flow Evaluation

Every interaction should be evaluated using these steps:

1. **Identify the user's goal** — What is the user trying to accomplish?
2. **Map the current flow** — List the steps the user must take.
3. **Evaluate friction** — Where might the user hesitate or feel confused?
4. **Minimize steps** — Remove unnecessary actions.
5. **Reduce cognitive load** — Avoid requiring the user to remember information or make unnecessary decisions.
6. **Provide feedback** — The system should clearly confirm when actions succeed.

---

# Interaction Design Rules

1. Each screen must have one primary action.
2. Important actions must be visually obvious.
3. Secondary features should be progressively disclosed.
4. Reduce typing whenever possible.
5. Use intelligent defaults.
6. Avoid forcing users to configure complex settings early.
7. Interfaces should encourage action rather than organization.

---

# Productivity App UX Principles

## Task Capture

Task capture must be extremely fast.

**Target time: less than 3 seconds.**

Users should be able to capture tasks with minimal typing.

Examples:
- Quick add
- Keyboard shortcuts
- Natural language entry

## Decision Clarity

Users should always know:
- What to work on next  
- What matters most  
- What can wait  

The interface should highlight priority and reduce decision fatigue.

## Momentum

The system should reinforce progress.

Examples:
- Completion feedback
- Visual progress indicators
- Streaks or momentum signals

Users should feel progress immediately after completing tasks.

---

# Common UX Failures to Avoid

Claude must identify and avoid these patterns:

- Over-structuring tasks too early  
- Too many configuration options  
- Multiple competing primary actions  
- Hidden important actions  
- Too many required steps to complete a task  
- Interfaces that prioritize organization instead of execution

---

# Cognitive Load Reduction

Good productivity tools reduce thinking.

The interface should:
- Present fewer decisions  
- Show only relevant information  
- Use clear language  
- Avoid unnecessary UI complexity

Claude should propose ways to simplify interfaces whenever possible.

---

# Progressive Disclosure

Complex functionality should not appear all at once.

Start with simple flows. Reveal advanced features only when needed.

**Example:**
- Basic task entry first  
- Advanced scheduling later

---

# System Feedback

Every action should produce visible feedback.

Examples:
- Task completed animation  
- Confirmation message  
- Progress update

Users should never wonder whether an action succeeded.

---

# Feature Proposal Process

When suggesting features, Claude must include:

- User job-to-be-done  
- User journey steps  
- Potential friction points  
- Simplified interaction proposal  
- Expected benefit to productivity

---

# Evaluation Questions

Before implementing a feature, Claude should ask:

- Does this make it easier to start work?  
- Does this reduce decision fatigue?  
- Does this remove friction from task completion?  
- Does this make the next action clearer?

If the answer is no, the feature should be reconsidered.

---

# Final Guiding Principle

A productivity app should not help users manage tasks.

It should help users finish meaningful work.

All design decisions should support this goal.

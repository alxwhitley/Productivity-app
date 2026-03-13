// ARCHITECTURE RULE: All components must be defined at the top level as function declarations.
// Never define components inside other components, render functions, or IIFEs.

import { useState, useEffect, useRef } from "react";
import { supabase } from "./supabase.js";
import { THEME_KEY } from "./constants.js";
import { toISODate, uid } from "./utils.js";
import useData from "./useData.js";
import OnboardingIllustration from "./components/OnboardingIllustration.jsx";
import NavIcon from "./components/NavIcon.jsx";
import StatusBar from "./components/StatusBar.jsx";
import ShutdownSheet from "./sheets/ShutdownSheet.jsx";
import AddBlockSheet from "./sheets/AddBlockSheet.jsx";
import QuickReminders from "./sheets/QuickReminders.jsx";
import CategorizeSheet from "./sheets/CategorizeSheet.jsx";
import TodayScreen from "./screens/TodayScreen.jsx";
import ProjectsScreen from "./screens/ProjectsScreen.jsx";
import PlanScreen from "./screens/PlanScreen.jsx";
import SeasonScreen from "./screens/SeasonScreen.jsx";

// ─── CSS ──────────────────────────────────────────────────────────────────────
const css = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&display=swap');
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent;}
  /* Prevent iOS Safari zoom on input focus — font-size must be >= 16px */
  input,textarea,select{font-size:16px !important;}
  /* Visual compensation: scale text down visually where needed without triggering zoom */
  input.small-input,textarea.small-input,select.small-input{transform-origin:left center;}
  :root{
    --bg:#161514;--bg2:#1E1C1A;--bg3:#252220;--bg4:#2C2926;
    --border:#2E3235;--border2:#252829;
    --accent:#E8A030;--accent-s:rgba(232,160,48,0.12);
    --green:#45C17A;--red:#E05555;
    --text:#EDEAE5;--text2:#9A9591;--text3:#555250;
  }

  /* ── LIGHT MODE ── */
  .light{
    --bg:#F5F2EE;--bg2:#EDEAE5;--bg3:#E4E0DA;--bg4:#D8D3CC;
    --border:#D0CBC3;--border2:#DDD9D3;
    --accent:#C07818;--accent-s:rgba(192,120,24,0.10);
    --green:#2E9E5B;--red:#C43C3C;
    --text:#1A1714;--text2:#5C5550;--text3:#9A938C;
  }
  .light .phone{background:var(--bg);}
  .light .nav{background:var(--bg);border-top-color:var(--border2);}
  .light .sheet{background:var(--bg2);}
  .light .form-select,.light .blk-edit-select,.light .ww-slot-select,.light .add-goal-domain,.light .ii-select{background:var(--bg3);color:var(--text);}
  .light .intent-textarea,.light .add-task-input,.light .loose-add-input,.light .add-goal-input{background:var(--bg3);color:var(--text);}
  .light .now-block,.light .card,.light .week-card,.light .cov-card,.light .dw-card,.light .stat-box,.light .intention-card,.light .season-hero,.light .sg-card,.light .season-pull-card,.light .loose-zone{background:var(--bg2);} .light .loose-section{background:var(--bg2);}
  .light .ghost-block{background:transparent;}
  .light .ww-day{border-color:var(--border);color:var(--text2);}
  .light .ww-day.on{background:var(--accent);border-color:var(--accent);color:#fff;}
  .light .coach-card{background:rgba(192,120,24,0.07);border-color:rgba(192,120,24,0.2);}
  .light .nb-dur,.light .br-dur{background:var(--bg3);}

  /* theme toggle row */
  .theme-toggle-row{display:flex;align-items:center;justify-content:space-between;padding:12px 0;border-top:1px solid var(--border2);margin-top:4px;}
  .theme-toggle-label{font-size:14px;font-weight:500;color:var(--text);}
  .theme-toggle-sub{font-size:12px;color:var(--text3);margin-top:1px;}
  .toggle-pill{width:46px;height:26px;border-radius:13px;background:var(--bg3);border:1.5px solid var(--border);position:relative;cursor:pointer;transition:background .2s,border-color .2s;flex-shrink:0;}
  .toggle-pill.on{background:var(--accent);border-color:var(--accent);}
  .toggle-knob{position:absolute;top:3px;left:3px;width:18px;height:18px;border-radius:50%;background:#fff;transition:transform .2s ease;box-shadow:0 1px 3px rgba(0,0,0,.2);}
  .toggle-pill.on .toggle-knob{transform:translateX(20px);}

  html,body,#root{height:100%;background:var(--bg);font-family:'DM Sans',sans-serif;overflow:hidden;}
  .phone{width:100%;height:100%;background:var(--bg);overflow:hidden;position:relative;display:flex;flex-direction:column;}
  @media(min-width:500px){
    html,body,#root{background:#101213;}
    .phone{width:390px;height:844px;border-radius:44px;box-shadow:0 40px 80px rgba(0,0,0,.7),0 0 0 1px rgba(255,255,255,.05);}
  }

  /* STATUS */
  .status{padding:16px 24px 0;display:flex;justify-content:flex-end;align-items:center;flex-shrink:0;}
  .status-icons{font-size:12px;opacity:.5;display:flex;gap:5px;}

  /* SCREEN */
  .screen{display:none;flex-direction:column;flex:1;overflow:hidden;}
  .screen.active{display:flex;}

  /* SCROLL */
  .scroll{flex:1;overflow-y:auto;overflow-x:hidden;padding-bottom:8px;scrollbar-width:none;}
  .scroll::-webkit-scrollbar{display:none;}

  /* PAGE HEADER */
  .ph{padding:14px 24px 10px;flex-shrink:0;}
  .ph-eye{font-size:11px;font-weight:600;letter-spacing:.07em;text-transform:uppercase;color:var(--text3);margin-bottom:3px;}
  .ph-title{font-size:26px;font-weight:700;color:var(--text);letter-spacing:-.03em;line-height:1.1;}
  .ph-sub{font-size:13px;color:var(--text2);margin-top:2px;}

  /* SECTION HEAD */
  .sh{padding:16px 20px 6px;display:flex;justify-content:space-between;align-items:center;flex-shrink:0;}
  .sh-label{font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--text3);padding-left:8px;border-left:2px solid var(--border2);}
  .sh-btn{font-size:13px;color:var(--accent);font-weight:500;cursor:pointer;background:none;border:none;}

  /* CARD */
  .card{margin:0 16px 8px;background:var(--bg2);border-radius:16px;overflow:hidden;}

  /* DIVIDER */
  .divider{height:1px;background:var(--border2);}

  /* ── TODAY ── */
  .now-block{margin:0 16px 8px;background:var(--bg2);border-radius:16px;overflow:hidden;padding:18px 20px;position:relative;cursor:pointer;}
  .nb-stripe{position:absolute;left:0;top:0;bottom:0;width:4px;}
  .nb-inner{padding-left:12px;}
  .nb-top{display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;}
  .nb-label{font-size:11px;font-weight:600;letter-spacing:.07em;text-transform:uppercase;color:var(--accent);}
  .nb-dur{font-size:12px;color:var(--text2);background:var(--bg3);padding:3px 10px;border-radius:20px;font-weight:500;}
  .nb-project{font-size:22px;font-weight:700;color:var(--text);letter-spacing:-.02em;margin-bottom:2px;}
  .nb-domain{font-size:13px;margin-bottom:3px;}
  .nb-time{font-size:13px;color:var(--text3);margin-bottom:14px;font-variant-numeric:tabular-nums;}
  .task-list{border-top:1px solid var(--border2);padding-top:12px;}
  .task-row{display:flex;align-items:flex-start;gap:12px;padding:7px 0;cursor:pointer;}
  .t-check{width:20px;height:20px;border-radius:50%;border:1.5px solid var(--border);flex-shrink:0;display:flex;align-items:center;justify-content:center;transition:all .15s;margin-top:1px;}
  .t-check.done{background:var(--green);border-color:var(--green);}
  .t-check.done::after{content:'✓';font-size:10px;color:#fff;font-weight:700;}
  .t-check.bouncing{animation:check-bounce .35s cubic-bezier(.22,.68,0,1.4) forwards;}
  .st-wrap.flash{animation:task-flash .4s ease forwards;}
  .t-text{font-size:14px;color:var(--text);line-height:1.4;}
  .t-text.done{color:var(--text3);text-decoration:line-through;}
  /* TIMELINE */
  .tl-wrap{margin:0;padding:0 16px 0 0;display:flex;flex-direction:column;gap:0;}
  .tl-item{display:flex;gap:10px;position:relative;padding-right:16px;align-items:flex-start;}
  .tl-left{display:flex;flex-direction:column;align-items:center;width:56px;flex-shrink:0;padding-left:12px;}
  .tl-connector-top{width:1px;height:18px;background:var(--border2);flex-shrink:0;}
  .tl-pill{font-size:9px;font-weight:700;font-variant-numeric:tabular-nums;white-space:nowrap;padding:3px 6px;cursor:pointer;background:var(--pill-bg,var(--bg3));color:var(--pill-color,var(--text3));border:none;border-radius:20px;font-family:'DM Sans',sans-serif;text-align:center;transition:all .15s;-webkit-tap-highlight-color:transparent;letter-spacing:.02em;flex-shrink:0;}
  .tl-pill.static{cursor:default;}
  .tl-connector{width:1px;flex:1;min-height:8px;background:var(--border2);}

  .tl-swipe-action-btn.swap{background:var(--accent);color:#000;}
  .tl-swipe-action-btn.tomorrow{background:var(--bg4);color:var(--text);}
  .tl-swipe-action-lbl{font-size:11px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;}
  .tl-swipe-action-ico{font-size:16px;line-height:1;}
  .tl-swipe-card{position:relative;z-index:1;transition:transform .3s cubic-bezier(.25,.46,.45,.94);will-change:transform;background:var(--bg2);border-radius:14px;width:100%;}
  .tl-swipe-card.swiping{transition:none;}
  /* Deep Work Slots */
  .dw-empty{width:100%;background:transparent;border:1.5px dashed rgba(255,255,255,.14);border-radius:14px;padding:8px 14px;cursor:pointer;display:flex;align-items:center;gap:12px;transition:border-color .2s,background .2s,color .2s;font-family:"DM Sans",sans-serif;min-height:44px;}
  .dw-empty:active{background:rgba(255,255,255,.03);}
  .dw-empty.is-open{background:rgba(232,160,48,.08);border-color:rgba(232,160,48,.5);border-style:solid;}
  .dw-empty.is-open .dw-empty-label{color:var(--accent);}
  .dw-empty.is-open .dw-empty-sub{color:rgba(232,160,48,.5);}
  .dw-empty.is-open .dw-plus{color:var(--accent);}
  .dw-plus{width:22px;height:22px;border-radius:50%;border:1.5px solid rgba(255,255,255,.2);display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,.35);font-size:14px;font-weight:300;flex-shrink:0;}
  .dw-empty-label{font-size:11px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:rgba(255,255,255,.25);margin-bottom:1px;}
  .dw-empty-sub{font-size:12px;color:rgba(255,255,255,.18);}
  .dw-empty-dur{font-size:11px;color:rgba(255,255,255,.18);margin-left:auto;flex-shrink:0;}
  .dw-picker-wrap{background:var(--bg3);border:1.5px dashed rgba(255,255,255,.14);border-top:none;border-radius:0 0 14px 14px;overflow:hidden;}
  .dw-picker-sect{padding:10px 10px 6px;font-size:11px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:var(--text3);}
  .dw-proj-grid{display:grid;grid-template-columns:1fr 1fr;gap:4px;padding:4px 6px 8px;max-height:240px;overflow-y:auto;overscroll-behavior:contain;}
  .dw-proj-row{display:flex;align-items:center;gap:8px;padding:9px 10px;cursor:pointer;border-radius:10px;background:var(--bg4);}
  .dw-proj-row:active{background:var(--border);}
  .dw-proj-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0;}
  .dw-proj-name{font-size:13px;color:var(--text);flex:1;font-weight:500;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
  .dw-proj-domain{font-size:10px;color:var(--text3);}
  .dw-confirm-wrap{padding:12px;}
  .dw-time-row{display:flex;gap:8px;margin-bottom:12px;}
  .dw-time-sel{flex:1;background:var(--bg4);border:1px solid var(--border);border-radius:8px;padding:9px 10px;color:var(--text);font-family:"DM Sans",sans-serif;font-size:16px;outline:none;appearance:none;}
  .dw-confirm-btn{width:100%;background:var(--accent);color:#000;border:none;border-radius:10px;padding:11px;font-size:14px;font-weight:700;cursor:pointer;font-family:"DM Sans",sans-serif;display:flex;align-items:center;justify-content:center;gap:8px;}
  .dw-back{background:none;border:none;color:var(--text3);font-size:12px;cursor:pointer;font-family:"DM Sans",sans-serif;padding:8px 0 0;display:block;width:100%;text-align:center;}
  .tl-swap-panel{background:var(--bg3);border-radius:0 0 14px 14px;padding:8px;display:flex;flex-direction:column;gap:1px;border-top:1px solid var(--border);}
  .tl-drag-handle{width:18px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;cursor:grab;opacity:.35;flex-shrink:0;padding:14px 0;}
  .tl-drag-handle:active{cursor:grabbing;opacity:.7;}
  .tl-drag-handle span{display:block;width:14px;height:2px;background:var(--text3);border-radius:2px;}
  .tl-item.dragging{opacity:.4;border:1px dashed var(--border);}
  .tl-item.drag-over{border-top:2px solid var(--accent);}
  /* No-times mode */
  .tl-wrap.no-times{padding:0 16px;}
  .today-plan-mode{background:rgba(232,160,48,.045);transition:background .6s ease;}
  .today-work-mode{background:#12151F;transition:background .6s ease;}
  .today-plan-mode .screen,.today-plan-mode{--bg:#181A1B;}
  .today-work-mode .ph-eye{color:var(--blue)!important;}
  .plan-block-row{display:flex;align-items:center;gap:12px;padding:12px 16px;background:var(--bg2);border-radius:14px;margin:0 16px 8px;border:1px solid var(--border);cursor:pointer;transition:border-color .15s,background .15s;}
  .plan-block-row:active{background:var(--bg3);}
  .plan-block-row.assigned{border-color:var(--domain-color,var(--border));}
  .begin-btn{display:block;width:calc(100% - 32px);margin:16px 16px 8px;padding:16px;background:var(--accent);color:#000;border:none;border-radius:16px;font-size:16px;font-weight:800;font-family:"DM Sans",sans-serif;letter-spacing:.01em;cursor:pointer;transition:transform .1s,opacity .1s;}
  .begin-btn:active{transform:scale(.98);opacity:.9;}
  .work-hero{margin:0 16px 12px;background:var(--bg2);border-radius:20px;overflow:hidden;border:1px solid var(--border);}
  .work-hero.has-domain{border-color:var(--domain-color,var(--border));}
  .work-next-strip{margin:0 16px 8px;display:flex;flex-direction:column;gap:6px;}
  .work-next-card{background:var(--bg2);border-radius:12px;padding:11px 14px;border:1px solid var(--border);display:flex;align-items:center;gap:10;}
  .earlier-link{text-align:center;padding:8px 0 4px;font-size:12px;color:var(--text3);font-weight:600;cursor:pointer;font-family:"DM Sans",sans-serif;letter-spacing:.02em;}
  .replan-btn{background:none;border:none;font-size:11px;color:var(--text3);font-weight:600;cursor:pointer;font-family:"DM Sans",sans-serif;padding:0;letter-spacing:.03em;}
  .tl-wrap.no-times .tl-item{padding-right:0;gap:0;}
  .tl-wrap.no-times .tl-left{display:none;}
  .tl-wrap.no-times .tl-item+.tl-item{margin-top:8px;}

  .tl-card{width:100%;background:var(--bg2);border-radius:14px;overflow:hidden;transition:opacity .2s,border-color .2s,box-shadow .2s,transform .25s;}
  .tl-card.done-card{opacity:.32;filter:saturate(0.1);}
  .tl-card.missed-card{border:1px solid var(--domain-color,rgba(255,255,255,.1));box-shadow:0 0 14px var(--domain-color,transparent);}
  .tl-card.now-card{border:2px solid var(--domain-color,rgba(232,160,48,.7));box-shadow:0 0 0 4px var(--domain-color,rgba(232,160,48,.08)),0 0 40px var(--domain-color,rgba(232,160,48,.2));transform:scale(1.018);transform-origin:center top;background:var(--bg2);animation:now-pulse 3s ease-in-out infinite;}
  @keyframes now-pulse{0%,100%{box-shadow:0 0 0 4px var(--domain-color,rgba(232,160,48,.08)),0 0 40px var(--domain-color,rgba(232,160,48,.2));}50%{box-shadow:0 0 0 6px var(--domain-color,rgba(232,160,48,.14)),0 0 55px var(--domain-color,rgba(232,160,48,.28));}}
  .tl-card.active-card{border:1px solid rgba(232,160,48,.25);box-shadow:0 0 24px rgba(232,160,48,.09);}
  .tl-card.upcoming-card{border:1px solid var(--domain-color,rgba(255,255,255,.08));box-shadow:0 0 14px var(--domain-color,transparent);}
  /* Routine pill card */
  .tl-card.routine-pill{background:var(--bg3);border-radius:22px;border:1px solid var(--border2);}
  .tl-card.routine-pill.now-card{border:1.5px solid rgba(232,160,48,.4);box-shadow:0 0 12px rgba(232,160,48,.1);transform:none;}
  .tl-card.routine-pill.done-card{opacity:.32;filter:saturate(0.1);}
  .tl-check-icon.missed{width:20px;height:20px;border-radius:50%;border:1.5px solid var(--border);display:flex;align-items:center;justify-content:center;flex-shrink:0;}
  .tl-card-head{display:flex;align-items:center;gap:10px;padding:12px 14px;cursor:pointer;}
  .tl-stripe{width:3px;border-radius:2px;align-self:stretch;min-height:28px;flex-shrink:0;}
  .tl-info{flex:1;min-width:0;}
  .tl-name{font-size:15px;font-weight:600;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
  .tl-meta{font-size:11px;color:var(--text3);margin-top:2px;}
  .tl-dur{font-size:11px;font-weight:500;background:var(--bg3);color:var(--text3);padding:3px 8px;border-radius:6px;white-space:nowrap;flex-shrink:0;}
  .tl-prime-pill{font-size:9px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;padding:2px 7px;border-radius:20px;background:rgba(232,160,48,.12);color:var(--accent);border:1px solid rgba(232,160,48,.25);flex-shrink:0;white-space:nowrap;}
  .tl-now-pill{font-size:9px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;background:rgba(232,160,48,.15);color:var(--accent);border:1px solid rgba(232,160,48,.3);padding:2px 7px;border-radius:20px;flex-shrink:0;}
  .tl-tasks{border-top:1px solid var(--border2);padding:10px 14px 14px 14px;}
  .tl-task-row{display:flex;align-items:center;gap:10px;padding:6px 0;border-radius:8px;transition:background .2s;}
  .tl-task-row.next-action{background:rgba(232,160,48,.07);border-left:2px solid var(--accent);padding-left:8px;margin-left:-2px;}
  .tl-check{width:18px;height:18px;border-radius:50%;border:1.5px solid var(--border);flex-shrink:0;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:all .15s;}
  .tl-check.done{background:var(--green);border-color:var(--green);}
  .tl-check.bouncing{animation:check-bounce .35s cubic-bezier(.22,.68,0,1.4) forwards;}
  @keyframes check-bounce{0%{transform:scale(0);opacity:0;}60%{transform:scale(1.4);}100%{transform:scale(1);opacity:1;}}
  .tl-task-row.flash{animation:task-flash .4s ease forwards;}
  @keyframes task-flash{0%{background:rgba(69,193,122,.18);}100%{background:transparent;}}
  .tl-task-txt{font-size:13px;color:var(--text);flex:1;}
  .tl-task-txt.done{text-decoration:line-through;opacity:.45;}
  .tl-add-task{display:flex;gap:8px;margin-top:6px;padding-top:8px;border-top:1px solid var(--border2);}
  .tl-add-input{flex:1;background:var(--bg3);border:none;border-radius:8px;padding:8px 10px;color:var(--text);font-family:'DM Sans',sans-serif;font-size:16px;outline:none;}
  /* LOOSE TASKS BLOCK */
  .lt-block-wrap{padding:0 16px 8px;}
  .lt-block{background:var(--bg2);border-radius:14px;overflow:hidden;border:1px solid var(--border);}
  .lt-block-head{display:flex;align-items:center;gap:10px;padding:12px 14px;cursor:pointer;}
  .lt-stripe{width:3px;border-radius:2px;align-self:stretch;min-height:18px;background:var(--text3);opacity:.35;flex-shrink:0;}
  .lt-info{flex:1;min-width:0;}
  .lt-title{font-size:14px;font-weight:600;color:var(--text);}
  .lt-meta{font-size:11px;color:var(--text3);margin-top:1px;}
  .lt-body{border-top:1px solid var(--border2);padding:8px 0;}
  .lt-task-row{display:flex;align-items:center;gap:10px;padding:9px 14px;}
  .lt-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0;}
  .lt-check{width:18px;height:18px;border-radius:50%;border:1.5px solid var(--border);display:flex;align-items:center;justify-content:center;flex-shrink:0;cursor:pointer;transition:all .15s;}
  .lt-check.done{background:var(--green);border-color:var(--green);}
  .lt-task-text{flex:1;font-size:13px;color:var(--text);}
  .lt-task-text.done{color:var(--text3);text-decoration:line-through;}
  .lt-picker{padding:10px 14px;border-top:1px solid var(--border2);}
  .lt-picker-title{font-size:11px;font-weight:600;color:var(--text3);letter-spacing:.06em;text-transform:uppercase;margin-bottom:8px;}
  .lt-pick-row{display:flex;align-items:center;gap:10px;padding:7px 0;cursor:pointer;}
  .lt-pick-check{width:16px;height:16px;border-radius:4px;border:1.5px solid var(--border);display:flex;align-items:center;justify-content:center;flex-shrink:0;}
  .lt-pick-check.sel{background:var(--accent);border-color:var(--accent);}
  .lt-empty{font-size:12px;color:var(--text3);padding:12px 14px;font-style:italic;}
  /* TIME PICKER POPOVER */
  .time-pick-wrap{position:relative;display:inline-block;}
  .tl-time-btn{font-size:9px;font-weight:700;font-variant-numeric:tabular-nums;white-space:nowrap;padding:3px 6px;cursor:pointer;background:var(--pill-bg,var(--bg3));color:var(--pill-color,var(--text3));border:none;border-radius:20px;font-family:'DM Sans',sans-serif;text-align:center;transition:all .15s;-webkit-tap-highlight-color:transparent;letter-spacing:.02em;}
  .tl-time-btn:hover,.tl-time-btn.open{filter:brightness(1.3);}
  .tl-time{font-size:9px;font-weight:700;font-variant-numeric:tabular-nums;white-space:nowrap;padding:3px 6px;background:var(--bg3);color:var(--text3);border-radius:20px;text-align:center;letter-spacing:.02em;}
  .time-popover{position:absolute;left:50%;transform:translateX(-50%);top:calc(100% + 4px);background:var(--bg2);border:1px solid var(--border);border-radius:12px;box-shadow:0 8px 32px rgba(0,0,0,.4);z-index:50;overflow:hidden;width:96px;}
  .time-popover-inner{max-height:200px;overflow-y:auto;overscroll-behavior:contain;}
  .time-slot{padding:9px 12px;font-size:12px;font-variant-numeric:tabular-nums;color:var(--text2);cursor:pointer;text-align:center;transition:background .1s;}
  .time-slot:hover{background:var(--bg3);}
  .time-slot.current{color:var(--accent);font-weight:700;background:rgba(232,160,48,.08);}
  /* TODAY TASK PICKER */
  .picker-wrap{padding:12px 14px 14px;}
  .picker-heading{font-size:11px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:var(--text3);margin-bottom:10px;}
  .picker-task{display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border2);cursor:pointer;}
  .picker-task:last-of-type{border-bottom:none;}
  .picker-box{width:18px;height:18px;border-radius:5px;border:1.5px solid var(--border);flex-shrink:0;display:flex;align-items:center;justify-content:center;transition:all .15s;}
  .picker-box.checked{background:var(--accent);border-color:var(--accent);}
  .picker-box.checked::after{content:'✓';font-size:9px;color:#000;font-weight:800;}
  .picker-task-txt{font-size:13px;color:var(--text);flex:1;}
  .picker-add{display:flex;gap:8px;margin-top:10px;padding-top:10px;border-top:1px solid var(--border2);}
  .picker-input{flex:1;background:var(--bg3);border:none;border-radius:8px;padding:8px 10px;color:var(--text);font-family:'DM Sans',sans-serif;font-size:16px;outline:none;}
  .picker-confirm{width:100%;margin-top:12px;background:var(--accent);color:#000;border:none;border-radius:10px;padding:10px;font-size:13px;font-weight:700;cursor:pointer;font-family:'DM Sans',sans-serif;}
  .picker-confirm:disabled{opacity:.4;cursor:not-allowed;}
  /* LATE START */
  .tl-missed-badge{font-size:9px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;padding:2px 7px;border-radius:20px;background:rgba(224,85,85,.1);color:var(--red);border:1px solid rgba(224,85,85,.2);flex-shrink:0;}
  .tl-start-btn{font-size:10px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;padding:3px 10px;border-radius:20px;background:rgba(232,160,48,.15);color:var(--accent);border:1px solid rgba(232,160,48,.3);cursor:pointer;font-family:'DM Sans',sans-serif;flex-shrink:0;}
  .tl-start-btn:active{background:rgba(232,160,48,.28);}
  .tl-countdown{font-size:12px;font-weight:700;color:var(--accent);font-variant-numeric:tabular-nums;flex-shrink:0;}
  .tl-check-icon{width:20px;height:20px;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0;}
  .tl-check-icon.full{background:var(--green);}
  .tl-check-icon.partial{background:var(--bg3);border:1.5px solid var(--border);}
  .tl-conflict-warn{margin:0 0 6px;padding:8px 12px;background:rgba(224,85,85,.08);border:1px solid rgba(224,85,85,.2);border-radius:8px;font-size:11px;color:#E05555;display:flex;align-items:center;gap:8px;}
  /* NOW marker line */
  .now-marker{display:flex;align-items:center;gap:8px;margin:4px 16px 4px;position:relative;}
  .now-marker-line{flex:1;height:1px;background:var(--accent);opacity:.4;}
  .now-marker-label{font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--accent);opacity:.7;white-space:nowrap;}
  /* clock */
  .today-clock{font-size:26px;font-weight:700;color:var(--text);letter-spacing:-.03em;font-variant-numeric:tabular-nums;line-height:1.1;}
  .today-clock-ampm{font-size:13px;font-weight:500;color:var(--text3);margin-left:4px;}
  .shutdown-row{margin:4px 16px 0;background:var(--bg2);border-radius:14px;padding:14px 18px;display:flex;align-items:center;gap:12px;cursor:pointer;}
  .sd-ico{font-size:17px;}
  .sd-txt{font-size:14px;font-weight:500;color:var(--text2);}
  .sd-arr{margin-left:auto;font-size:16px;color:var(--text3);}

  /* ── PROJECTS NEW LAYOUT ── */
  .domain-tabs{display:flex;flex-shrink:0;border-bottom:2px solid var(--border2);}
  .domain-tab{
    flex:1;padding:13px 4px 11px;border:none;border-bottom:3px solid transparent;margin-bottom:-2px;cursor:pointer;
    font-family:'DM Sans',sans-serif;font-size:13px;font-weight:600;
    background:transparent;color:var(--text3);transition:color .15s,border-color .15s;
    display:flex;align-items:center;justify-content:center;gap:6px;
  }
  .domain-tab.active{color:var(--text);}
  .domain-tab-dot{width:7px;height:7px;border-radius:50%;flex-shrink:0;}
  .domain-tab-edit{
    width:36px;height:36px;border-radius:12px;border:1.5px dashed var(--border);
    background:transparent;cursor:pointer;display:flex;align-items:center;justify-content:center;
    color:var(--text3);font-size:18px;flex-shrink:0;
  }


  /* LOOSE TASKS */
  /* LOOSE ZONE — minimal tap-to-add */
  .loose-zone{margin:0 16px 10px;min-height:72px;border-radius:14px;display:flex;flex-direction:column;position:relative;background:var(--bg2);border:1px solid var(--border2);}
  .loose-empty{flex:1;min-height:72px;display:flex;align-items:center;justify-content:center;color:var(--text3);opacity:.35;}
  .loose-split-bar{display:flex;min-height:56px;border-radius:14px;overflow:hidden;}
  .loose-split-btn{flex:1;display:flex;align-items:center;justify-content:center;gap:7px;cursor:pointer;color:var(--text3);font-size:13px;font-weight:500;opacity:.45;transition:opacity .15s,background .15s;border:none;background:none;font-family:'DM Sans',sans-serif;}
  .loose-split-btn:active{opacity:.9;background:var(--bg3);}
  .loose-split-divider{width:1px;background:var(--border2);align-self:stretch;margin:10px 0;flex-shrink:0;}
  .loose-tasks-list{display:flex;flex-direction:column;}
  .loose-add-inline{padding:10px 14px 4px;}
  .loose-inline-input{width:100%;background:transparent;border:none;border-bottom:1px solid var(--border);padding:6px 2px;color:var(--text);font-family:'DM Sans',sans-serif;font-size:16px;outline:none;}
  .loose-inline-input::placeholder{color:var(--text3);}
  .loose-add-more{display:flex;align-items:center;gap:6px;padding:8px 14px 12px;color:var(--text3);font-size:12px;cursor:pointer;opacity:.5;}
  .loose-add-more:active{opacity:1;}
  .loose-section{margin:0 16px 10px;background:var(--bg2);border-radius:14px;overflow:hidden;border:1px solid var(--border2);}
  .loose-header{display:flex;align-items:center;justify-content:space-between;padding:12px 16px 8px;}
  .loose-title{font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--text3);padding-left:8px;border-left:2px solid var(--border2);}
  .loose-count{font-size:11px;color:var(--text3);background:var(--bg3);border-radius:20px;padding:2px 8px;}
  .loose-task-row{display:flex;align-items:center;gap:10px;padding:11px 16px;border-top:1px solid var(--border2);cursor:pointer;position:relative;}
  .loose-task-row:hover{background:var(--bg3);}
  .loose-check{width:18px;height:18px;border-radius:50%;border:1.5px solid var(--border);flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:10px;color:transparent;transition:all .15s;}
  .loose-check.done{background:var(--green);border-color:var(--green);color:#fff;}
  .loose-task-text{flex:1;font-size:13px;color:var(--text);line-height:1.4;}
  .loose-task-text.done{color:var(--text3);text-decoration:line-through;}
  .loose-assign-btn{font-size:11px;color:var(--text3);background:var(--bg3);border:1px solid var(--border);border-radius:20px;padding:3px 9px;cursor:pointer;font-family:'DM Sans',sans-serif;white-space:nowrap;flex-shrink:0;}
  .loose-add-row{display:flex;align-items:center;gap:8px;padding:8px 16px 12px;border-top:1px solid var(--border2);}
  .loose-add-input{flex:1;background:var(--bg3);border:1px solid var(--border);border-radius:8px;padding:7px 10px;color:var(--text);font-family:'DM Sans',sans-serif;font-size:16px;outline:none;}
  .loose-add-btn{background:var(--accent);color:#000;border:none;border-radius:8px;padding:7px 12px;font-size:13px;font-weight:700;cursor:pointer;font-family:'DM Sans',sans-serif;}

  /* LOOSE TASK ASSIGN POPOVER */
  .loose-assign-pop{position:absolute;right:16px;top:36px;background:var(--bg4);border:1px solid var(--border);border-radius:12px;padding:10px 12px;z-index:20;min-width:180px;box-shadow:0 8px 24px rgba(0,0,0,.4);}
  .lap-title{font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--text3);margin-bottom:8px;}
  .lap-proj{padding:7px 10px;font-size:13px;color:var(--text2);cursor:pointer;border-radius:8px;display:flex;align-items:center;gap:8px;}
  .lap-proj:hover{background:var(--bg3);color:var(--text);}
  .lap-dot{width:6px;height:6px;border-radius:50%;flex-shrink:0;}

  /* SWIPEABLE PROJECT ROW */
  .swipe-wrapper{position:relative;overflow:hidden;margin:0 16px 8px;border-radius:14px;}
  .swipe-content{background:var(--bg2);border-radius:14px;transition:transform .2s ease;position:relative;z-index:1;}
  .swipe-delete-bg{
    position:absolute;right:0;top:0;bottom:0;width:80px;
    background:var(--red);border-radius:14px;
    display:flex;align-items:center;justify-content:center;
    color:#fff;font-size:12px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;
    z-index:0;
  }

  .proj-card{padding:14px 16px;cursor:pointer;}
  .proj-card-top{display:flex;align-items:center;gap:10px;margin-bottom:8px;}
  .proj-card-stripe{width:3px;border-radius:2px;flex-shrink:0;align-self:stretch;min-height:20px;}
  .proj-card-name{font-size:15px;font-weight:600;color:var(--text);flex:1;}
  .proj-card-name-input{
    font-size:15px;font-weight:600;color:var(--text);flex:1;background:transparent;
    border:none;border-bottom:1.5px solid var(--accent);outline:none;font-family:'DM Sans',sans-serif;
    padding:2px 0;
  }
  .proj-card-badge{font-size:10px;font-weight:600;letter-spacing:.05em;text-transform:uppercase;padding:3px 8px;border-radius:20px;flex-shrink:0;cursor:pointer;}
  .badge-active{background:var(--accent-s);color:var(--accent);}
  .badge-backlog{background:var(--bg3);color:var(--text3);}
  .proj-bar-wrap{height:4px;background:var(--bg4);border-radius:2px;overflow:hidden;margin-bottom:6px;}
  .proj-bar-fill{height:100%;border-radius:2px;transition:width .5s cubic-bezier(.4,0,.2,1);}
  .proj-card-meta{display:flex;justify-content:space-between;}
  /* Session mode */
  .proj-session-bar-wrap{height:4px;background:var(--bg4);border-radius:2px;overflow:hidden;margin-bottom:6px;}
  .proj-session-bar-fill{height:100%;border-radius:2px;opacity:0.7;transition:width .5s cubic-bezier(.4,0,.2,1);}
  .proj-session-log{padding:8px 0 2px;}
  .proj-session-log-item{display:flex;align-items:flex-start;gap:8px;padding:5px 0;border-bottom:1px solid var(--border2);}
  .proj-session-log-item:last-child{border-bottom:none;}
  .proj-session-log-note{font-size:12px;color:var(--text2);flex:1;line-height:1.4;}
  .proj-session-log-meta{font-size:10px;color:var(--text3);white-space:nowrap;padding-top:1px;}
  .session-focus-input{width:100%;background:var(--bg3);border:1px solid var(--border);border-radius:10px;padding:10px 12px;font-size:13px;color:var(--text);font-family:'DM Sans',sans-serif;outline:none;resize:none;box-sizing:border-box;line-height:1.4;}
  .session-focus-input:focus{border-color:var(--accent);}
  .session-focus-note{font-size:12px;color:var(--text3);font-style:italic;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
  .proj-card-tasks{font-size:11px;color:var(--text3);}
  .proj-card-pct{font-size:11px;font-weight:600;}

  /* EXPANDED TASKS */


  /* ROUTINE BLOCKS */
  .routine-block{margin:0 0 1px;background:var(--bg2);cursor:pointer;}
  .routine-block-header{display:flex;align-items:center;gap:10px;padding:10px 14px;}
  .routine-stripe{width:3px;border-radius:2px;align-self:stretch;min-height:28px;flex-shrink:0;background:var(--text3);opacity:.5;}
  .routine-info{flex:1;}
  .routine-title{font-size:14px;font-weight:600;color:var(--text);}
  .routine-meta{font-size:11px;color:var(--text3);margin-top:1px;}
  .routine-badge{font-size:9px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;padding:2px 7px;border-radius:20px;background:rgba(232,160,48,.12);color:var(--accent);border:1px solid rgba(232,160,48,.25);flex-shrink:0;}
  .routine-tasks{border-top:1px solid var(--border2);}
  .routine-task-row{display:flex;align-items:center;gap:10px;padding:9px 14px 9px 28px;}
  .routine-check{width:18px;height:18px;border-radius:50%;border:1.5px solid var(--border);flex-shrink:0;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:all .15s;}
  .routine-check.done{background:var(--green);border-color:var(--green);}
  .routine-task-text{font-size:13px;color:var(--text);flex:1;transition:opacity .15s;}
  .routine-task-text.done{text-decoration:line-through;opacity:.45;}

  /* PROJECT EDIT PANEL */
  .proj-edit-panel{padding:14px 16px 16px;border-top:1px solid var(--border2);background:var(--bg2);}
  .proj-edit-row{display:flex;gap:8px;margin-bottom:12px;}
  .proj-edit-input{flex:1;background:var(--bg3);border:1.5px solid var(--accent);border-radius:8px;padding:8px 10px;color:var(--text);font-family:'DM Sans',sans-serif;font-size:16px;font-weight:600;outline:none;}
  .proj-edit-swatches{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px;}
  .proj-swatch{width:28px;height:28px;border-radius:50%;cursor:pointer;border:2px solid transparent;transition:transform .1s,border-color .15s;flex-shrink:0;}
  .proj-swatch.selected{border-color:#fff;transform:scale(1.15);}
  .proj-edit-save{background:var(--accent);color:#000;border:none;border-radius:8px;padding:9px 18px;font-size:13px;font-weight:700;cursor:pointer;font-family:'DM Sans',sans-serif;}


  /* GEAR ICON (consistent across tabs) */
  .tab-gear{background:none;border:none;color:var(--text3);cursor:pointer;padding:6px;line-height:0;flex-shrink:0;opacity:.7;border-radius:8px;transition:opacity .15s,background .15s;}
  .tab-gear:active{opacity:1;background:var(--bg3);}

  /* SETTINGS SECTION HEADER */
  .set-section{font-size:11px;font-weight:700;letter-spacing:.09em;text-transform:uppercase;color:var(--text3);margin:16px 0 8px;}

  /* SETTINGS ROW */
  .set-row{display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--border2);}
  .set-row:last-child{border-bottom:none;}
  .set-row-label{font-size:14px;color:var(--text);}
  .set-row-sub{font-size:12px;color:var(--text3);margin-top:2px;}
  .set-input{background:var(--bg3);border:1.5px solid var(--border);border-radius:8px;padding:7px 10px;color:var(--text);font-family:'DM Sans',sans-serif;font-size:16px;outline:none;width:100%;margin-top:6px;}
  .set-input:focus{border-color:var(--accent);}

  /* PROJECTS MANAGE SHEET */
  .pm-proj-row{display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--border2);}
  .pm-proj-row:last-child{border-bottom:none;}
  .pm-proj-swatch{width:10px;height:10px;border-radius:50%;flex-shrink:0;}
  .pm-proj-name{flex:1;background:var(--bg3);border:1px solid var(--border);border-radius:7px;padding:6px 9px;color:var(--text);font-family:'DM Sans',sans-serif;font-size:13px;outline:none;}
  .pm-proj-name:focus{border-color:var(--accent);}


  /* PROJECT PILLS — assign ghost sheet */
  .proj-pills-group{margin-bottom:14px;}
  .proj-pills-domain-label{font-size:10px;font-weight:700;letter-spacing:.09em;text-transform:uppercase;color:var(--text3);margin-bottom:6px;}
  .proj-pills-row{display:flex;flex-wrap:wrap;gap:7px;}
  .proj-pill{padding:7px 13px;border-radius:20px;font-size:13px;font-weight:600;font-family:'DM Sans',sans-serif;cursor:pointer;border:1.5px solid transparent;transition:all .15s;background:transparent;}
  .proj-pill.selected{color:#000 !important;}
  .proj-pill:active{transform:scale(.96);}

  /* SWIPEABLE TASK ROW */
  .st-wrap{position:relative;overflow:hidden;border-bottom:1px solid var(--border2);}
  .st-wrap:last-of-type{border-bottom:none;}
  .st-delete-bg{position:absolute;right:0;top:0;bottom:0;width:72px;background:var(--red);display:flex;align-items:center;justify-content:center;cursor:pointer;}
  .st-delete-ico{font-size:13px;font-weight:700;color:#fff;letter-spacing:.04em;text-transform:uppercase;}
  .st-inner{display:flex;align-items:flex-start;gap:12px;padding:9px 0;background:var(--bg2);position:relative;z-index:1;}
  .st-edit-input{flex:1;background:var(--bg3);border:1.5px solid var(--accent);border-radius:8px;padding:4px 8px;color:var(--text);font-family:'DM Sans',sans-serif;font-size:16px;outline:none;line-height:1.4;}

  .proj-tasks-expand{border-top:1px solid var(--border2);padding:4px 16px 14px;}
  .pte-task{display:flex;align-items:flex-start;gap:12px;padding:8px 0;cursor:pointer;border-bottom:1px solid var(--border2);}
  .pte-task:last-of-type{border-bottom:none;}

  /* ADD PROJECT */
  .add-proj-row{padding:11px 16px;display:flex;align-items:center;gap:8px;cursor:pointer;border-top:1px solid var(--border2);}
  .add-proj-ico{font-size:15px;color:var(--text3);}
  .add-proj-txt{font-size:13px;color:var(--text3);}

  /* DOMAIN EDIT SHEET */
  .domain-edit-list{margin-bottom:12px;}
  .domain-edit-row{display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--border2);}
  .domain-edit-row:last-child{border-bottom:none;}
  .domain-color-dot{width:24px;height:24px;border-radius:50%;flex-shrink:0;cursor:pointer;border:2px solid transparent;}
  .domain-color-dot.selected{border-color:var(--text);}
  .domain-name-input{
    flex:1;background:transparent;border:none;border-bottom:1px solid var(--border);
    padding:4px 0;color:var(--text);font-family:'DM Sans',sans-serif;font-size:14px;outline:none;
  }
  .domain-del-btn{background:none;border:none;color:var(--red);font-size:18px;cursor:pointer;padding:4px;flex-shrink:0;}
  .color-picker-row{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px;}
  .color-swatch{width:28px;height:28px;border-radius:50%;cursor:pointer;border:2px solid transparent;transition:transform .1s;}
  .color-swatch.sel{border-color:#fff;transform:scale(1.15);}
  .gear-btn-inline{background:none;border:none;cursor:pointer;padding:4px 6px;color:var(--text3);line-height:1;border-radius:8px;flex-shrink:0;transition:color .15s,transform .25s ease;}
  .gear-btn-inline:hover{color:var(--text2);}
  .gear-btn-inline.open{color:var(--text2);transform:rotate(45deg);}
  .blk-mgmt-panel{overflow:hidden;max-height:0;transition:max-height .3s cubic-bezier(.4,0,.2,1),opacity .22s ease;opacity:0;}
  .blk-mgmt-panel.open{max-height:420px;opacity:1;}
  .blk-mgmt-inner{border-top:1px solid var(--border2);padding:3px 0;}
  .blk-mgmt-proj-list{max-height:220px;overflow-y:auto;overscroll-behavior:contain;}
  .blk-mgmt-row{display:flex;align-items:center;gap:12px;padding:11px 16px;cursor:pointer;background:none;border:none;width:100%;font-family:'DM Sans',sans-serif;transition:background .12s;}
  .blk-mgmt-row:hover{background:rgba(255,255,255,.04);}
  .blk-mgmt-row-ico{width:18px;display:flex;align-items:center;justify-content:center;color:var(--text3);flex-shrink:0;}
  .blk-mgmt-row-txt{font-size:14px;color:var(--text2);font-weight:500;}
  .blk-mgmt-row.danger .blk-mgmt-row-ico{color:var(--red);}
  .blk-mgmt-row.danger .blk-mgmt-row-txt{color:var(--red);}
  .blk-mgmt-row.sub-item{padding-left:24px;}
  .blk-mgmt-divider{height:1px;background:var(--border2);margin:2px 14px;}
  .add-domain-btn{width:100%;background:var(--bg3);border:1.5px dashed var(--border);border-radius:12px;padding:12px;color:var(--text3);font-size:14px;cursor:pointer;font-family:'DM Sans',sans-serif;margin-top:8px;}

  /* ── PLAN ── */
  .intention-card{margin:0 16px 8px;background:var(--bg2);border-radius:16px;padding:16px 18px;}
  .ic-text{font-size:14px;color:var(--text2);line-height:1.65;}
  .ic-edit{font-size:12px;color:var(--accent);font-weight:500;margin-top:10px;cursor:pointer;background:none;border:none;display:block;}
  .intent-textarea{width:100%;background:var(--bg3);border:1px solid var(--border);border-radius:10px;padding:12px 14px;color:var(--text);font-family:'DM Sans',sans-serif;font-size:16px;line-height:1.6;resize:none;margin-top:10px;outline:none;}
  .intent-save{margin-top:8px;background:var(--accent);color:#000;border:none;border-radius:10px;padding:9px 18px;font-size:13px;font-weight:600;cursor:pointer;font-family:'DM Sans',sans-serif;}


  /* WEEK PLAN CARDS */
  .week-card{margin:0 16px 8px;background:var(--bg2);border-radius:16px;overflow:hidden;border:1px solid var(--border2);transition:opacity .2s;}
  .week-card.past-day{opacity:0.55;}
  .week-card.today-card{border-color:rgba(232,160,48,0.3);}
  .wc-head{padding:13px 18px;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--border2);}
  .today-card .wc-head{background:rgba(232,160,48,0.05);}
  .wc-day{font-size:14px;font-weight:600;color:var(--text);}
  .wc-day.today{color:var(--accent);}
  .wc-date{font-size:12px;color:var(--text3);}

  .wc-add{padding:11px 18px;display:flex;align-items:center;gap:8px;cursor:pointer;}
  .wca-ico{font-size:15px;color:var(--text3);}
  .wca-txt{font-size:13px;color:var(--text3);}


  /* GHOST / EMPTY DEEP WORK BLOCKS */
  .ghost-block{display:flex;gap:12px;align-items:center;padding:10px 18px;border-bottom:1px solid var(--border2);cursor:pointer;background:transparent;transition:background .15s;}
  .ghost-block:hover{background:rgba(232,160,48,0.04);}
  .ghost-stripe{width:3px;border-radius:2px;flex-shrink:0;align-self:stretch;min-height:36px;border:1.5px dashed var(--border);background:transparent;}
  .ghost-inner{flex:1;}
  .ghost-time{font-size:12px;color:var(--text3);font-variant-numeric:tabular-nums;min-width:80px;}
  .ghost-label{font-size:13px;font-weight:500;color:var(--text3);}
  .ghost-hint{font-size:11px;color:var(--accent);opacity:.7;margin-top:2px;}
  .ghost-assign{font-size:11px;color:var(--text3);padding:4px 10px;border:1px dashed var(--border);border-radius:20px;white-space:nowrap;}
  .missed-block{display:flex;gap:12px;align-items:center;padding:9px 18px;border-bottom:1px solid var(--border2);background:rgba(224,85,85,0.03);}
  .missed-stripe{width:3px;border-radius:2px;flex-shrink:0;align-self:stretch;min-height:30px;background:var(--red);opacity:.35;}
  .missed-inner{flex:1;}
  .missed-time{font-size:11px;color:var(--text3);font-variant-numeric:tabular-nums;}
  .missed-label{font-size:12px;color:var(--text3);opacity:.6;}
  .missed-tag{font-size:10px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--red);opacity:.6;padding:2px 7px;border:1px solid rgba(224,85,85,.25);border-radius:20px;white-space:nowrap;}

  /* WORK WEEK CUSTOMIZER SHEET */
  .ww-days{display:flex;gap:8px;justify-content:center;margin:12px 0 6px;}
  .ww-day{width:42px;height:42px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:600;cursor:pointer;border:1.5px solid var(--border);color:var(--text3);transition:all .15s;font-family:'DM Sans',sans-serif;}
  .ww-day.on{background:var(--accent);border-color:var(--accent);color:#000;}
  .ww-presets{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px;}
  .ww-preset{background:var(--bg3);border:1px solid var(--border);border-radius:20px;padding:7px 14px;font-size:12px;font-weight:600;color:var(--text2);cursor:pointer;font-family:'DM Sans',sans-serif;transition:all .15s;}
  .ww-preset:hover{border-color:var(--accent);color:var(--accent);}
  .ww-times{margin-top:4px;}
  .ww-slot-row{display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border2);}
  .ww-slot-row:last-child{border-bottom:none;}
  .ww-slot-num{font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--accent);min-width:60px;}
  .ww-slot-type{font-size:12px;color:var(--text2);flex:1;}
  .ww-slot-select{background:var(--bg4);border:1px solid var(--border);border-radius:8px;padding:6px 10px;color:var(--text);font-family:'DM Sans',sans-serif;font-size:16px;outline:none;appearance:none;}
  .plan-gear{background:none;border:none;color:var(--text3);cursor:pointer;padding:6px;line-height:0;opacity:.7;border-radius:8px;transition:opacity .15s,background .15s;}

  /* ASSIGN BLOCK SHEET coach card */
  .coach-card{background:rgba(232,160,48,0.07);border:1px solid rgba(232,160,48,0.2);border-radius:12px;padding:12px 14px;margin-bottom:14px;}
  .coach-title{font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--accent);margin-bottom:4px;}
  .coach-body{font-size:13px;color:var(--text2);line-height:1.55;}

  /* BLOCK INLINE EDIT */
  .blk-edit-del{background:rgba(224,85,85,0.15);color:var(--red);border:none;border-radius:8px;padding:9px 14px;font-size:13px;cursor:pointer;font-family:'DM Sans',sans-serif;}

  /* ── REVIEW ── */
  .stats-row{margin:0 16px 8px;display:grid;grid-template-columns:1fr 1fr;gap:8px;}
  .stat-box{background:var(--bg2);border-radius:14px;padding:16px;}
  .stat-n{font-size:38px;font-weight:700;color:var(--text);letter-spacing:-.03em;line-height:1;}
  .stat-lbl{font-size:12px;color:var(--text2);margin-top:5px;}
  .cov-card{margin:0 16px 8px;background:var(--bg2);border-radius:16px;padding:16px 18px;}
  .cov-row{display:flex;align-items:center;gap:10px;margin-bottom:12px;}
  .cov-row:last-child{margin-bottom:0;}
  .cov-dot{width:7px;height:7px;border-radius:50%;flex-shrink:0;}
  .cov-name{font-size:13px;font-weight:500;color:var(--text);min-width:74px;}
  .cov-bar-wrap{flex:1;height:4px;background:var(--bg3);border-radius:2px;overflow:hidden;}
  .cov-bar-fill{height:100%;border-radius:2px;}
  .cov-ct{font-size:12px;color:var(--text2);min-width:50px;text-align:right;}
  .cov-zero{color:var(--red)!important;}
  .dw-card{margin:0 16px 8px;background:var(--bg2);border-radius:16px;padding:16px 18px;}
  .dw-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:6px;}
  .dw-col{display:flex;flex-direction:column;align-items:center;gap:5px;}
  .dw-lbl{font-size:9px;font-weight:600;letter-spacing:.1em;color:var(--text3);text-transform:uppercase;}
  .dw-sq{width:100%;aspect-ratio:1;border-radius:8px;background:var(--bg3);}
  .dw-sq.full{background:var(--accent);}
  .dw-sq.half{background:rgba(232,160,48,.3);}

  .mv-info{flex:1;}
  .mv-name{font-size:14px;font-weight:500;color:var(--text);margin-bottom:6px;}
  .mv-bar-wrap{height:3px;background:var(--bg3);border-radius:2px;overflow:hidden;}
  .mv-bar-fill{height:100%;border-radius:2px;}
  .mv-delta{font-size:13px;font-weight:600;color:var(--green);}

  /* ── SEASON ── */
  .season-pull-card{margin:0 16px 8px;border-radius:16px;overflow:hidden;border:1px solid rgba(232,160,48,0.2);background:rgba(232,160,48,0.04);}
  .spc-head{padding:13px 18px 10px;display:flex;justify-content:space-between;align-items:center;}
  .spc-eyebrow{font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--accent);opacity:.75;}
  .spc-edit{font-size:11px;color:var(--accent);background:none;border:none;cursor:pointer;font-family:'DM Sans',sans-serif;font-weight:600;opacity:.8;}
  .spc-goal{display:flex;align-items:center;gap:10px;padding:7px 18px;}
  .spc-goal:last-child{padding-bottom:13px;}
  .spc-dot{width:6px;height:6px;border-radius:50%;flex-shrink:0;}
  .spc-text{font-size:13px;color:var(--text2);line-height:1.4;flex:1;}
  .spc-text.done{color:var(--text3);text-decoration:line-through;}
  .spc-check{width:16px;height:16px;border-radius:50%;border:1.5px solid var(--border);display:flex;align-items:center;justify-content:center;flex-shrink:0;cursor:pointer;font-size:9px;color:transparent;transition:all .15s;}
  .spc-check.checked{background:var(--green);border-color:var(--green);color:#fff;}
  .spc-empty{padding:10px 18px 14px;font-size:12px;color:var(--text3);}
  .season-hero{margin:0 16px 8px;background:var(--bg2);border-radius:16px;padding:18px;}
  .sh-quarter{font-size:10px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--accent);margin-bottom:6px;}
  .sh-title{font-size:20px;font-weight:700;color:var(--text);letter-spacing:-.02em;margin-bottom:4px;}
  .sh-sub{font-size:12px;color:var(--text3);}
  .sg-card{margin:0 16px 8px;background:var(--bg2);border-radius:16px;overflow:hidden;}
  .sg-row{display:flex;align-items:flex-start;gap:14px;padding:13px 18px;border-bottom:1px solid var(--border2);}
  .sg-row:last-child{border-bottom:none;}
  .sg-stripe{width:3px;border-radius:2px;flex-shrink:0;align-self:stretch;min-height:30px;}
  .sg-body{flex:1;}
  .sg-text{font-size:14px;font-weight:500;color:var(--text);line-height:1.4;}
  .sg-text.done{color:var(--text3);text-decoration:line-through;}
  .sg-domain{font-size:11px;color:var(--text3);margin-top:3px;}
  .sg-check{width:22px;height:22px;border-radius:50%;border:1.5px solid var(--border);display:flex;align-items:center;justify-content:center;flex-shrink:0;cursor:pointer;font-size:12px;color:transparent;transition:all .15s;margin-top:1px;}
  .sg-check.checked{background:var(--green);border-color:var(--green);color:#fff;}
  .sg-del{background:none;border:none;color:var(--text3);font-size:16px;cursor:pointer;padding:2px 0 2px 4px;flex-shrink:0;margin-top:1px;}
  .add-goal-row{padding:12px 18px;display:flex;align-items:flex-start;gap:8px;border-top:1px solid var(--border2);flex-wrap:wrap;}
  .add-goal-input{flex:1;min-width:0;background:var(--bg3);border:1px solid var(--border);border-radius:10px;padding:8px 12px;color:var(--text);font-family:'DM Sans',sans-serif;font-size:16px;outline:none;}
  .add-goal-domain{background:var(--bg3);border:1px solid var(--border);border-radius:10px;padding:8px 10px;color:var(--text);font-family:'DM Sans',sans-serif;font-size:13px;outline:none;appearance:none;}
  .add-goal-btn{background:var(--accent);color:#000;border:none;border-radius:10px;padding:8px 14px;font-size:13px;font-weight:700;cursor:pointer;font-family:'DM Sans',sans-serif;}
  .season-divider{margin:8px 16px 4px;display:flex;align-items:center;gap:10px;}
  .sdiv-line{flex:1;height:1px;background:var(--border2);}
  .sdiv-label{font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--text3);}
  /* ── NAV ── */
  .nav{flex-shrink:0;height:78px;background:var(--bg);border-top:1px solid var(--border2);display:flex;align-items:flex-end;padding-bottom:10px;position:relative;z-index:25;overflow:visible;}
  .nav-btn{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;cursor:pointer;padding-top:10px;}
  .nav-ico{width:24px;height:24px;display:flex;align-items:center;justify-content:center;color:var(--text3);transition:color .15s;}
  .nav-ico svg{width:24px;height:24px;display:block;color:inherit;}
  .nav-lbl{font-size:10px;font-weight:500;letter-spacing:.04em;color:var(--text3);text-transform:uppercase;transition:color .15s;}
  .nav-btn.on .nav-ico,.nav-btn.on .nav-lbl{color:var(--accent);}
  .nav-dot{position:absolute;top:8px;right:calc(50% - 14px);width:8px;height:8px;border-radius:50%;background:var(--accent);box-shadow:0 0 6px rgba(232,160,48,.6);}
  .nav-dot.urgent{background:var(--red);box-shadow:0 0 8px rgba(224,85,85,.7);animation:dot-pulse 1.5s ease-in-out infinite;}
  @keyframes dot-pulse{0%,100%{box-shadow:0 0 8px rgba(224,85,85,.7);}50%{box-shadow:0 0 14px rgba(224,85,85,.9);}}
  @keyframes pulse-dot{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.4;transform:scale(.65)}}
  @keyframes dw-running-pulse{0%,100%{box-shadow:0 0 0 2px rgba(155,114,207,.15),0 0 24px rgba(155,114,207,.12);}50%{box-shadow:0 0 0 3px rgba(155,114,207,.3),0 0 36px rgba(155,114,207,.22);}}
  .nav-btn{position:relative;}

  /* ── SHEETS ── */
  .backdrop{position:absolute;inset:0;background:rgba(0,0,0,.55);z-index:50;}
  .sheet{position:absolute;bottom:0;left:0;right:0;background:var(--bg2);border-radius:24px 24px 0 0;z-index:60;padding:12px 20px 34px;max-height:85%;display:flex;flex-direction:column;animation:slideUp .28s cubic-bezier(.32,.72,0,1);}
  @keyframes slideUp{from{transform:translateY(100%)}to{transform:translateY(0)}}
  .sheet-pull{width:36px;height:4px;background:var(--border);border-radius:2px;margin:0 auto 18px;}
  .sheet-title{font-size:20px;font-weight:700;color:var(--text);letter-spacing:-.02em;margin-bottom:4px;}
  .sheet-sub{font-size:13px;color:var(--text2);margin-bottom:18px;}
  .sheet-scroll{flex:1;overflow-y:auto;scrollbar-width:none;}
  .sheet-scroll::-webkit-scrollbar{display:none;}
  .sd-item{display:flex;align-items:center;gap:14px;padding:13px 0;border-bottom:1px solid var(--border2);cursor:pointer;}
  .sd-item:last-of-type{border-bottom:none;}
  .sd-box{width:20px;height:20px;border-radius:6px;border:1.5px solid var(--border);flex-shrink:0;display:flex;align-items:center;justify-content:center;transition:all .15s;}
  .sd-box.done{background:var(--green);border-color:var(--green);}
  .sd-box.done::after{content:'✓';font-size:10px;color:#fff;font-weight:700;}
  .sd-item-txt{font-size:14px;color:var(--text);}
  .sd-btn{margin-top:18px;width:100%;background:var(--accent);color:#000;border:none;border-radius:14px;padding:15px;font-size:15px;font-weight:700;cursor:pointer;font-family:'DM Sans',sans-serif;}
  .sd-btn:disabled{opacity:.5;cursor:not-allowed;}

  /* FORM */
  .form-row{margin-bottom:14px;}
  .form-label{font-size:11px;font-weight:600;letter-spacing:.07em;text-transform:uppercase;color:var(--text3);margin-bottom:6px;display:block;}
  .form-select,.form-input{width:100%;background:var(--bg3);border:1px solid var(--border);border-radius:10px;padding:11px 14px;color:var(--text);font-family:'DM Sans',sans-serif;font-size:16px;outline:none;appearance:none;}
  .form-row-2{display:grid;grid-template-columns:1fr 1fr;gap:10px;}
  .form-btn{width:100%;background:var(--accent);color:#000;border:none;border-radius:12px;padding:14px;font-size:15px;font-weight:700;cursor:pointer;font-family:'DM Sans',sans-serif;margin-top:6px;}

  /* ADD TASK */
  .add-task-tap{min-height:36px;cursor:pointer;}
  .add-task-tap:active{background:var(--bg3);}
  .add-task-inline{display:flex;align-items:center;border-top:1px solid var(--border2);padding:0 14px;}
  .add-task-inline-input{flex:1;background:transparent;border:none;outline:none;color:var(--text);font-family:'DM Sans',sans-serif;font-size:16px;padding:10px 0;}
  .add-task-inline-input::placeholder{color:var(--text3);}
  /* keep old classes for TodayScreen usage */
  .add-task-row{display:flex;gap:8px;padding-top:10px;border-top:1px solid var(--border2);}
  .add-task-input{flex:1;background:var(--bg3);border:1px solid var(--border);border-radius:10px;padding:9px 12px;color:var(--text);font-family:'DM Sans',sans-serif;font-size:16px;outline:none;}
  .add-task-input::placeholder{color:var(--text3);}
  .add-task-btn{background:var(--accent);color:#000;border:none;border-radius:10px;padding:9px 14px;font-size:13px;font-weight:600;cursor:pointer;font-family:'DM Sans',sans-serif;}

  /* INBOX */
  .inbox-banner{margin:0 16px 10px;background:var(--accent);border-radius:14px;padding:13px 16px;display:flex;align-items:center;gap:12px;cursor:pointer;}
  .ib-icon{font-size:18px;flex-shrink:0;}
  .ib-info{flex:1;}
  .ib-title{font-size:14px;font-weight:700;color:#000;line-height:1.2;}
  .ib-sub{font-size:12px;color:rgba(0,0,0,.6);margin-top:2px;}
  .ib-arrow{font-size:18px;color:rgba(0,0,0,.5);}
  .reminder-card{margin:0 16px 8px;background:rgba(232,160,48,.12);border:1px solid rgba(232,160,48,.35);border-radius:14px;padding:13px 16px;display:flex;align-items:flex-start;gap:10px;}
  .reminder-card-dot{width:8px;height:8px;border-radius:50%;background:var(--accent);flex-shrink:0;margin-top:5px;}
  .reminder-card-text{flex:1;font-size:14px;color:var(--text);font-weight:500;line-height:1.4;}
  .reminder-card-assign{background:var(--accent);color:#000;border:none;border-radius:8px;padding:6px 12px;font-size:12px;font-weight:700;cursor:pointer;font-family:'DM Sans',sans-serif;flex-shrink:0;}
  .reminder-section-label{margin:0 16px 6px;font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--accent);opacity:.8;}
  .inbox-swipe-wrap{position:relative;overflow:hidden;border-radius:12px;margin-bottom:8px;}
  .inbox-action-left{position:absolute;left:0;top:0;bottom:0;width:90px;background:var(--green);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;cursor:pointer;border-radius:12px;}
  .inbox-action-right{position:absolute;right:0;top:0;bottom:0;width:90px;background:var(--red);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;cursor:pointer;border-radius:12px;}
  .inbox-action-lbl{font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#fff;}
  .inbox-action-ico{font-size:18px;line-height:1;}
  .inbox-item{background:var(--bg3);border-radius:12px;padding:14px 16px;position:relative;z-index:1;}
  .ii-text{font-size:14px;color:var(--text);font-weight:500;margin-bottom:10px;}
  .ii-label{font-size:10px;font-weight:600;letter-spacing:.07em;text-transform:uppercase;color:var(--text3);margin-bottom:6px;}
  .ii-select{width:100%;background:var(--bg4);border:1px solid var(--border);border-radius:8px;padding:9px 12px;color:var(--text);font-family:'DM Sans',sans-serif;font-size:16px;outline:none;appearance:none;margin-bottom:8px;}
  .ii-actions{display:flex;gap:8px;}
  .ii-save{flex:1;background:var(--accent);color:#000;border:none;border-radius:8px;padding:9px;font-size:13px;font-weight:600;cursor:pointer;font-family:'DM Sans',sans-serif;}
  .ii-save:disabled{opacity:.4;cursor:not-allowed;}
  .ii-dismiss{background:var(--bg4);color:var(--text3);border:none;border-radius:8px;padding:9px 14px;font-size:13px;cursor:pointer;font-family:'DM Sans',sans-serif;}
  .inbox-empty{text-align:center;padding:30px 0;color:var(--text3);font-size:14px;}

  /* ── Block completion celebration ── */
  .block-celebrate{position:relative;padding:18px 0 14px;display:flex;flex-direction:column;align-items:center;gap:6px;overflow:hidden;}
  .block-celebrate-burst{position:relative;height:40px;width:100%;display:flex;align-items:center;justify-content:center;gap:6px;}
  .celebrate-particle{font-size:16px;display:inline-block;animation:celebrate-pop .7s cubic-bezier(.22,.68,0,1.2) calc(var(--i) * 60ms) both;}
  @keyframes celebrate-pop{0%{transform:scale(0) translateY(8px);opacity:0;}60%{transform:scale(1.3) translateY(-4px);opacity:1;}100%{transform:scale(1) translateY(0);opacity:1;}}
  .block-celebrate-label{font-size:13px;font-weight:700;letter-spacing:.04em;color:var(--green);animation:fade-up .4s ease .3s both;}
  @keyframes fade-up{from{opacity:0;transform:translateY(6px);}to{opacity:1;transform:translateY(0);}}

  /* ── Inbox aging badges ── */
  .reminder-card-age{font-size:10px;font-weight:700;letter-spacing:.05em;padding:2px 7px;border-radius:10px;flex-shrink:0;margin-top:3px;}
  .reminder-card-age.age-fresh{background:rgba(69,193,122,.15);color:var(--green);}
  .reminder-card-age.age-warn{background:rgba(232,160,48,.15);color:var(--accent);}
  .reminder-card-age.age-old{background:rgba(224,85,85,.15);color:var(--red);}


  /* QUICK REMINDERS MODAL */
  /* ── Capture panel ── */
  .cap-backdrop{position:absolute;inset:0;z-index:24;background:rgba(0,0,0,.55);backdrop-filter:blur(2px);}
  .cap-panel{position:absolute;left:0;right:0;bottom:0;background:var(--bg2);border-radius:24px 24px 0 0;z-index:25;display:flex;flex-direction:column;height:75vh;animation:sheet-up .22s cubic-bezier(.4,0,.2,1);box-shadow:0 -4px 40px rgba(0,0,0,.5);}
  .cap-handle-row{display:flex;justify-content:center;padding-top:10px;flex-shrink:0;}
  .cap-handle{width:36px;height:4px;border-radius:2px;background:var(--border);}
  .cap-header{display:flex;align-items:center;justify-content:space-between;padding:10px 20px 12px;flex-shrink:0;border-bottom:1px solid var(--border2);}
  .cap-title{font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--text3);}
  .cap-close{background:none;border:none;cursor:pointer;padding:4px;color:var(--text3);display:flex;align-items:center;justify-content:center;}
  .cap-items{max-height:40%;overflow-y:auto;padding:6px 18px 4px;flex-shrink:0;}
  .cap-item{display:flex;align-items:flex-start;gap:10px;padding:9px 0;border-bottom:1px solid var(--border2);}
  .cap-item-dot{width:5px;height:5px;border-radius:50%;background:var(--text3);flex-shrink:0;margin-top:7px;}
  .cap-item-text{flex:1;font-size:15px;color:var(--text);line-height:1.4;}
  .cap-textarea-row{padding:10px 18px 6px;flex:1;display:flex;flex-direction:column;}
  .cap-textarea{width:100%;background:transparent;border:none;outline:none;resize:none;color:var(--text);font-family:'DM Sans',sans-serif;font-size:16px;line-height:1.55;box-sizing:border-box;min-height:52px;flex:1;}
  .cap-textarea::placeholder{color:var(--text3);}
  .cap-footer{padding:8px 18px 28px;display:flex;align-items:center;justify-content:space-between;flex-shrink:0;}
  .cap-count{font-size:12px;color:var(--text3);}
  .cap-done-btn{background:var(--bg3);border:1px solid var(--border);border-radius:20px;padding:7px 18px;font-size:13px;font-weight:700;color:var(--text2);cursor:pointer;font-family:'DM Sans',sans-serif;}
  /* legacy qr classes kept for safety */
  .qr-backdrop{position:absolute;inset:0;z-index:24;background:rgba(0,0,0,.6);backdrop-filter:blur(2px);}
  .qr-panel{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:calc(100% - 40px);max-width:340px;background:var(--bg2);border-radius:20px;box-shadow:0 16px 48px rgba(0,0,0,.6);z-index:25;overflow:hidden;animation:qr-in .2s cubic-bezier(.34,1.3,.64,1);}
  @keyframes qr-in{from{opacity:0;transform:translate(-50%,-46%) scale(.94);}to{opacity:1;transform:translate(-50%,-50%) scale(1);}}
  .qr-header{padding:16px 18px 10px;font-size:13px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--text3);}
  .qr-items{max-height:260px;overflow-y:auto;}
  .qr-item{display:flex;align-items:center;gap:6px;padding:9px 12px 9px 18px;border-bottom:1px solid var(--border2);}
  .qr-item-text{flex:1;font-size:14px;color:var(--text);min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
  .qr-item-input{flex:1;background:transparent;border:none;outline:none;font-family:'DM Sans',sans-serif;font-size:14px;color:var(--text);min-width:0;padding:0;}
  .qr-pill{flex-shrink:0;padding:4px 9px;border-radius:20px;font-size:11px;font-weight:700;letter-spacing:.03em;cursor:pointer;border:1.5px solid transparent;transition:all .12s;font-family:'DM Sans',sans-serif;line-height:1.4;}
  .qr-pill-today{border-color:rgba(232,160,48,.3);color:rgba(232,160,48,.45);background:transparent;}
  .qr-pill-today.active{background:var(--accent-s);border-color:var(--accent);color:var(--accent);}
  .qr-pill-later{border-color:rgba(255,255,255,.1);color:rgba(255,255,255,.25);background:transparent;}
  .qr-pill-later.active{background:rgba(255,255,255,.07);border-color:rgba(255,255,255,.3);color:var(--text2);}
  .qr-input-row{display:flex;align-items:center;padding:10px 18px 14px;}
  .qr-input{flex:1;background:transparent;border:none;outline:none;color:var(--text);font-family:'DM Sans',sans-serif;font-size:16px;}
  .qr-input::placeholder{color:var(--text3);}


  /* FAB */
  .fab{width:50px;height:50px;border-radius:50%;background:var(--accent);border:none;color:#000;font-size:24px;cursor:pointer;display:flex;align-items:center;justify-content:center;position:relative;bottom:28px;z-index:26;flex-shrink:0;transition:transform .15s,background .15s;font-family:'DM Sans',sans-serif;box-shadow:0 2px 16px rgba(0,0,0,.3);}
  .fab.open{background:var(--accent);filter:brightness(1.1);transform:scale(1.05);}
  .fab:active{transform:scale(.93);}
  .capture-input{width:100%;background:var(--bg3);border:1.5px solid var(--accent);border-radius:12px;padding:14px 16px;color:var(--text);font-family:'DM Sans',sans-serif;font-size:16px;outline:none;margin-bottom:14px;}
  .capture-input::placeholder{color:var(--text3);}
  .capture-btn{width:100%;background:var(--accent);color:#000;border:none;border-radius:12px;padding:14px;font-size:15px;font-weight:700;cursor:pointer;font-family:'DM Sans',sans-serif;}
  .capture-hint{font-size:12px;color:var(--text3);text-align:center;margin-top:10px;}

  .spacer{height:16px;}
`;

// ─── STATUS BAR (no time) ─────────────────────────────────────────────────────
// ─── ONBOARDING FLOW ──────────────────────────────────────────────────────────


const ONBOARDING_CARDS = [
  {
    eyebrow: "Welcome to Clearwork",
    headline: "Built on two\nbig ideas.",
    body: "Clearwork isn't a to-do app. It's a system built around how your brain actually works — drawing on the research of Cal Newport and Andrew Huberman.",
    accent: "#E8A030",
    illustration: "welcome",
  },
  {
    eyebrow: "Cal Newport · Deep Work",
    headline: "Your best thinking needs\nprotected time.",
    body: "Shallow tasks — email, admin, quick replies — expand to fill whatever time you give them. Deep Work blocks carve out uninterrupted 60–90 minute windows for the work that actually moves things forward.",
    accent: "#5B8AF0",
    illustration: "deepwork",
  },
  {
    eyebrow: "Task Fatigue",
    headline: "A long list is\ndemotivating by design.",
    body: "Seeing 40 tasks creates decision paralysis before you've started. Clearwork keeps tasks inside projects, projects inside domains — and Today only shows what's actually scheduled. The rest is out of sight until you need it.",
    accent: "#45C17A",
    illustration: "tasks",
  },
  {
    eyebrow: "Cal Newport · Seasons",
    headline: "Big goals need\na longer horizon.",
    body: "Weeks are too short for meaningful progress. Clearwork uses a quarterly Season — up to 4 goals that define what this chapter is actually about. Everything else is in service of those.",
    accent: "#9B72CF",
    illustration: "season",
  },
  {
    eyebrow: "Newport + Huberman · Shutdown",
    headline: "Ending work deliberately\nprotects your recovery.",
    body: "Without a clear stop signal, your brain keeps processing work problems into the evening. The Shutdown Ritual is a deliberate cognitive closure — a signal that the workday is done and recovery can begin.",
    accent: "#4BAABB",
    illustration: "shutdown",
  },
];

const NAV_ITEMS = [
  { id:"today",    lbl:"Today"    },
  { id:"projects", lbl:"Projects" },
  { id:"plan",     lbl:"Week"     },
  { id:"season",   lbl:"Season"   },
];

function OnboardingFlow({ onDone }) {
  const [card, setCard] = useState(0);
  const [animDir, setAnimDir] = useState(null); // "in" | null
  const touchStartX = useRef(null);
  const total = ONBOARDING_CARDS.length;
  const current = ONBOARDING_CARDS[card];

  const advance = (dir = 1) => {
    const next = card + dir;
    if (next < 0) return;
    if (next >= total) { onDone(); return; }
    setAnimDir("out");
    setTimeout(() => {
      setCard(next);
      setAnimDir("in");
      setTimeout(() => setAnimDir(null), 280);
    }, 180);
  };

  const onTouchStart = e => { touchStartX.current = e.touches[0].clientX; };
  const onTouchEnd = e => {
    if (touchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (dx < -44) advance(1);
    else if (dx > 44) advance(-1);
  };

  const slideStyle = {
    transform: animDir === "out" ? "translateX(-32px)" : animDir === "in" ? "translateX(16px)" : "translateX(0)",
    opacity: animDir === "out" ? 0 : animDir === "in" ? 0 : 1,
    transition: animDir === "out" ? "transform .18s ease-in, opacity .18s ease-in" : animDir === "in" ? "none" : "transform .28s cubic-bezier(.2,.8,.4,1), opacity .28s ease-out",
  };

  return (
    <div
      style={{ position:"absolute", inset:0, zIndex:200, background:"var(--bg)", display:"flex", flexDirection:"column", borderRadius:"inherit", overflow:"hidden" }}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <StatusBar />

      {/* Skip */}
      <div style={{ display:"flex", justifyContent:"flex-end", padding:"8px 20px 0" }}>
        <button onClick={onDone} style={{ background:"none", border:"none", color:"var(--text3)", fontSize:13, fontWeight:500, cursor:"pointer", fontFamily:"'DM Sans',sans-serif", padding:"4px 0" }}>
          Skip
        </button>
      </div>

      {/* Card content */}
      <div style={{ flex:1, display:"flex", flexDirection:"column", justifyContent:"center", padding:"0 32px 16px", ...slideStyle }}>

        {/* Illustration */}
        <div style={{ display:"flex", justifyContent:"center", marginBottom:32 }}>
          <OnboardingIllustration type={current.illustration} accent={current.accent} />
        </div>

        {/* Eyebrow */}
        <div style={{ fontSize:11, fontWeight:700, letterSpacing:".1em", textTransform:"uppercase", color:current.accent, marginBottom:10 }}>
          {current.eyebrow}
        </div>

        {/* Headline */}
        <div style={{ fontSize:28, fontWeight:800, color:"var(--text)", lineHeight:1.15, letterSpacing:"-.02em", marginBottom:16, whiteSpace:"pre-line" }}>
          {current.headline}
        </div>

        {/* Body */}
        <div style={{ fontSize:15, color:"var(--text2)", lineHeight:1.6, fontWeight:400 }}>
          {current.body}
        </div>
      </div>

      {/* Bottom controls */}
      <div style={{ padding:"0 28px 36px", display:"flex", flexDirection:"column", gap:20 }}>

        {/* Progress dots */}
        <div style={{ display:"flex", justifyContent:"center", gap:6 }}>
          {ONBOARDING_CARDS.map((_, i) => (
            <div key={i} style={{
              width: i === card ? 20 : 6,
              height: 6,
              borderRadius: 3,
              background: i === card ? current.accent : "var(--border)",
              transition: "width .25s cubic-bezier(.4,0,.2,1), background .25s",
            }} />
          ))}
        </div>

        {/* Next / Let's go button */}
        <button
          onClick={() => advance(1)}
          style={{
            width:"100%",
            padding:"15px",
            background: current.accent,
            color: "#000",
            border:"none",
            borderRadius:14,
            fontSize:16,
            fontWeight:800,
            cursor:"pointer",
            fontFamily:"'DM Sans',sans-serif",
            letterSpacing:"-.01em",
          }}
        >
          {card === total - 1 ? "Let's go →" : "Next →"}
        </button>
      </div>
    </div>
  );
}

// ─── APP ──────────────────────────────────────────────────────────────────────

// ── Login Screen ─────────────────────────────────────────────────────────────
function LoginScreen() {
  const [mode, setMode] = useState("signin"); // "signin" | "signup" | "forgot"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const f = "'DM Sans',sans-serif";
  const inputStyle = { width:"100%", padding:"14px 16px", background:"#1E2122", border:"1px solid #2C3032", borderRadius:12, color:"#fff", fontSize:16, fontFamily:f, outline:"none", marginBottom:10, display:"block", boxSizing:"border-box" };
  const btnStyle = (disabled) => ({ width:"100%", padding:"15px", background:"#E8A030", color:"#000", border:"none", borderRadius:12, fontSize:15, fontWeight:700, cursor:"pointer", fontFamily:f, transition:"opacity .15s", opacity: disabled ? .6 : 1, marginTop:4 });

  const handleSignIn = async () => {
    if (!email.trim() || !password) return;
    setLoading(true); setError("");
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setLoading(false);
    if (error) setError(error.message);
  };

  const handleSignUp = async () => {
    if (!email.trim() || !password) return;
    if (password.length < 6) { setError("Password must be at least 6 characters"); return; }
    setLoading(true); setError("");
    const { error } = await supabase.auth.signUp({ email: email.trim(), password });
    setLoading(false);
    if (error) { setError(error.message); return; }
    setSuccess("Account created! Check your email to confirm, then sign in.");
    setMode("signin");
  };

  const handleForgot = async () => {
    if (!email.trim()) { setError("Enter your email first"); return; }
    setLoading(true); setError("");
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: window.location.origin });
    setLoading(false);
    if (error) { setError(error.message); return; }
    setSuccess("Password reset email sent! Check your inbox.");
    setMode("signin");
  };

  return (
    <div style={{ position:"fixed", inset:0, display:"flex", flexDirection:"column", background:"#101213", fontFamily:f }}>
      {/* Branding */}
      <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"0 32px" }}>
        <div style={{ fontSize:36, fontWeight:700, color:"#fff", letterSpacing:"-.02em", marginBottom:10 }}>Clearwork</div>
        <div style={{ fontSize:14, color:"#555", textAlign:"center", lineHeight:1.6, maxWidth:240 }}>The Productivity App that makes you love getting things done</div>
      </div>

      {/* Form */}
      <div style={{ padding:"28px 24px 52px", borderTop:"1px solid #1E2122" }}>
        <div style={{ maxWidth:340, margin:"0 auto" }}>

          {/* Tab switcher */}
          <div style={{ display:"flex", gap:0, marginBottom:20, background:"#1E2122", borderRadius:12, padding:4 }}>
            {[["signin","Sign In"],["signup","Sign Up"]].map(([m, lbl]) => (
              <button key={m} onClick={() => { setMode(m); setError(""); setSuccess(""); }}
                style={{ flex:1, padding:"9px", border:"none", borderRadius:9, fontFamily:f, fontSize:13, fontWeight:600, cursor:"pointer", transition:"all .15s",
                  background: mode === m ? "#2C3032" : "transparent",
                  color: mode === m ? "#fff" : "#666"
                }}>{lbl}</button>
            ))}
          </div>

          {success && <div style={{ fontSize:13, color:"#45C17A", marginBottom:12, padding:"10px 12px", background:"rgba(69,193,122,.08)", borderRadius:8 }}>{success}</div>}
          {error && <div style={{ fontSize:13, color:"#E05555", marginBottom:10 }}>{error}</div>}

          {mode === "forgot" ? (
            <>
              <div style={{ fontSize:13, color:"#888", marginBottom:14 }}>Enter your email and we'll send a reset link.</div>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" style={inputStyle} autoFocus />
              <button onClick={handleForgot} disabled={loading} style={btnStyle(loading)}>{loading ? "Sending…" : "Send Reset Link"}</button>
              <button onClick={() => { setMode("signin"); setError(""); }} style={{ width:"100%", padding:"12px", background:"none", border:"none", color:"#666", fontSize:13, cursor:"pointer", fontFamily:f, marginTop:8 }}>← Back to sign in</button>
            </>
          ) : (
            <>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key === "Enter" && (mode==="signin" ? handleSignIn() : handleSignUp())} placeholder="you@example.com" style={inputStyle} autoFocus />
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === "Enter" && (mode==="signin" ? handleSignIn() : handleSignUp())} placeholder="Password" style={inputStyle} />
              <button onClick={mode === "signin" ? handleSignIn : handleSignUp} disabled={loading} style={btnStyle(loading)}>
                {loading ? "…" : mode === "signin" ? "Sign In" : "Create Account"}
              </button>
              {mode === "signin" && (
                <button onClick={() => { setMode("forgot"); setError(""); setSuccess(""); }} style={{ width:"100%", padding:"12px", background:"none", border:"none", color:"#666", fontSize:13, cursor:"pointer", fontFamily:f, marginTop:4 }}>Forgot password?</button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [session, setSession] = useState(undefined); // undefined = loading
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => setSession(session));
    return () => subscription.unsubscribe();
  }, []);

  const userId = session?.user?.id || null;
  const [data, setData] = useData(userId);
  const [tab, setTab] = useState("today");
  const [sheet, setSheet] = useState(null);

  const [captureOpen, setCaptureOpen] = useState(false);
  const [jumpToBlock, setJumpToBlock] = useState(null); // blockId to auto-expand when switching to Today
  const [lightMode, setLightMode] = useState(() => {
    try { return localStorage.getItem(THEME_KEY) === "light"; } catch { return false; }
  });
  const toggleTheme = () => setLightMode(v => {
    const next = !v;
    try { localStorage.setItem(THEME_KEY, next ? "light" : "dark"); } catch {}
    return next;
  });

  // Show loading while Supabase checks session
  if (session === undefined) {
    return (
      <div style={{ height:"100%", display:"flex", alignItems:"center", justifyContent:"center", background:"#101213" }}>
        <div style={{ width:32, height:32, border:"3px solid #333", borderTop:"3px solid #E8A030", borderRadius:"50%", animation:"spin 0.8s linear infinite" }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }
  if (!session) return <LoginScreen />;

  const safeData = {
    ...data,
    domains: data.domains || [],
    projects: data.projects || [],
    blocks: data.blocks || [],
    inbox: data.inbox || [],
    looseTasks: data.looseTasks || [],
    deepWorkSlots: data.deepWorkSlots || {},
    deepWorkTargets: data.deepWorkTargets || { dailyHours: 4, weeklyHours: 20, maxDeepBlocks: 3 },
    todayPrefs: data.todayPrefs || { name: '', showShutdown: true },
    routineBlocks: data.routineBlocks || [],
    seasonGoals: data.seasonGoals || [],
    blockCompletions: data.blockCompletions || [],
    todayLoosePicks: data.todayLoosePicks || {},
    captured: data.captured || [],
    sessionLog: data.sessionLog || [],
    emptyBlocks: data.emptyBlocks || [],
    workWeek: data.workWeek || [2,3,4,5,6],
    reviewData: data.reviewData || { domainBlocks: {}, projectProgress: {}, daysWorked: [] },
  };

  const closeSheet = () => setSheet(null);

  const handleAddRoutine = r => setData(d => ({ ...d, routineBlocks: [...(d.routineBlocks||[]), r] }));
  const handleQuickAdd = item => {
    setData(d => ({
      ...d,
      inbox: [...(d.inbox || []), { id: item.id, text: item.text, createdAt: item.createdAt || Date.now() }]
    }));
  };
  const handleCategorize = (itemId, projectId, markDone = false) => setData(d => {
    const item = d.inbox.find(i => i.id===itemId);
    if (!item || !projectId) return d;
    return { ...d, inbox: d.inbox.filter(i=>i.id!==itemId), projects: d.projects.map(p => p.id===projectId ? { ...p, tasks: [...p.tasks,{id:uid(),text:item.text,done:markDone}] } : p) };
  });
  const handleDismissInbox = itemId => setData(d => ({ ...d, inbox: d.inbox.filter(i=>i.id!==itemId) }));
  const handleDoToday = itemId => setData(d => {
    const item = d.inbox.find(i => i.id === itemId);
    if (!item) return d;
    return {
      ...d,
      inbox: d.inbox.filter(i => i.id !== itemId),
      looseTasks: [...(d.looseTasks || []), { id: uid(), domainId: null, text: item.text, done: false, doneAt: null }],
    };
  });

  return (
    <>
      <style>{css}</style>
      <div style={{ height:"100%", display:"flex", alignItems:"center", justifyContent:"center", background: lightMode ? "#E8E4DE" : "#101213" }}>
        <div className={`phone ${lightMode ? "light" : ""}`}>
          {!safeData.onboardingDone && (
            <OnboardingFlow onDone={() => setData(d => ({ ...d, onboardingDone: true }))} />
          )}
          {tab==="today"    && <TodayScreen    data={safeData} setData={setData} openShutdown={()=>setSheet("shutdown")} onSignOut={() => supabase.auth.signOut()} jumpToBlock={jumpToBlock} onClearJump={() => setJumpToBlock(null)} setTab={setTab} />}
          {tab==="projects" && <ProjectsScreen data={safeData} setData={setData} openCategorize={()=>setSheet("categorize")} />}
          {tab==="plan"     && <PlanScreen     data={safeData} setData={setData} onGoToSeason={()=>setTab("season")} lightMode={lightMode} toggleTheme={toggleTheme} />}
          {tab==="season"  && <SeasonScreen   data={safeData} setData={setData} />}

          {sheet==="shutdown"  && <ShutdownSheet    onClose={closeSheet} onComplete={()=>setData(d=>({...d,shutdownDone:true,shutdownDate:toISODate()}))} alreadyDone={safeData.shutdownDone} data={safeData} onCategorizeLoose={(taskId, domainId) => setData(d => {
              const todayISO = new Date().toISOString().slice(0,10);
              // Assign domain + remove from todayLoosePicks (it's now categorized)
              const picks = (d.todayLoosePicks||{})[todayISO] || [];
              const newPicks = picks.filter(id => id !== taskId);
              return {
                ...d,
                looseTasks: (d.looseTasks||[]).map(t => t.id === taskId ? { ...t, domainId } : t),
                todayLoosePicks: { ...(d.todayLoosePicks||{}), [todayISO]: newPicks }
              };
            })} />}
          {sheet==="addblock"  && <AddBlockSheet    data={safeData} onClose={closeSheet} onAddRoutine={handleAddRoutine} />}

          {sheet==="categorize"&& <CategorizeSheet  data={safeData} onClose={closeSheet} onCategorize={handleCategorize} onDismiss={handleDismissInbox} onDoToday={handleDoToday} />}

          {captureOpen && (
            <QuickReminders
              onClose={() => setCaptureOpen(false)}
              onAddCaptured={item => setData(d => ({ ...d, captured: [...(d.captured||[]), item] }))}
              existingCaptured={safeData.captured}
            />
          )}

          <div className="nav">
            {/* Today + Projects */}
            {NAV_ITEMS.slice(0,2).map(n => (
              <div key={n.id} className={`nav-btn ${tab===n.id?"on":""}`} onClick={()=>setTab(n.id)}>
                {n.id === "projects" && (safeData.inbox.length > 0 || safeData.captured.length > 0) && (
                  <span className={`nav-dot${safeData.inbox.some(i => i.createdAt && Date.now() - i.createdAt > 2 * 24 * 60 * 60 * 1000) ? " urgent" : ""}`} />
                )}
                <span className="nav-ico"><NavIcon id={n.id} active={tab===n.id} /></span>
                <span className="nav-lbl">{n.lbl}</span>
              </div>
            ))}

            {/* Center FAB */}
            <button
              className={`fab${captureOpen ? " open" : ""}`}
              onClick={() => setCaptureOpen(v => !v)}
            >
              {captureOpen
                ? <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/></svg>
                : <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/></svg>
              }
            </button>

            {/* Week + Season */}
            {NAV_ITEMS.slice(2).map(n => (
              <div key={n.id} className={`nav-btn ${tab===n.id?"on":""}`} onClick={()=>setTab(n.id)}>
                <span className="nav-ico"><NavIcon id={n.id} active={tab===n.id} /></span>
                <span className="nav-lbl">{n.lbl}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

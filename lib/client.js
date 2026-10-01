window.__ModuleLoader__.load({
  id: 'dsh-client-ui-gpt-helper',
  factory(require) {
    const React = require('react')
    const { createPortal } = require('react-dom')
    const h = React.createElement

    const NS = 'gpt-helper'

    /** Number of particles in the slider trail (prototype value). */
    const PARTICLE_COUNT = 42
    /** Particle diameters cycled by index (prototype value). */
    const PARTICLE_SIZES = [1.7, 2, 2.35, 2.75, 3.2]
    /** Thumb travel is clamped inside the track, so end levels are not flush. */
    const RATIO_MIN = 0.055
    const RATIO_MAX = 0.945

    // ─────────────────────────────────────────────────────────────────────────
    // Styles
    //
    // Ported from `chatgpt-pc-ui-prototype.html`, with classes namespaced under
    // `gptm-` and driven by `data-*` attributes instead of the prototype's
    // `fast` / `ultra` classes. The control's own colours (track, gradients,
    // bolt, thumb) are literal, as the authoring rules allow for artwork; the
    // menu surface keeps the host's `--dsw-alias-*` tokens so the popover still
    // belongs to the DSH theme.
    // ─────────────────────────────────────────────────────────────────────────
    const CSS = `
/* The prototype opens with a global border-box reset; DSH does not set one
   globally (it declares box-sizing per component), so without this the menu's
   declared width is its CONTENT width and the track comes out ~22px wider than
   the prototype's. Every level ratio is calibrated against the prototype's
   track width, so that difference shows up as the fill's left cap peeking past
   the thumb at the lowest level. */
.gptm-root, .gptm-root *, .gptm-menu, .gptm-menu * { box-sizing: border-box; }

.gptm-root { position: relative; min-width: 0; }

/* trigger: bolt (fast only) + model + level + caret */
.gptm-trigger {
  display: flex; align-items: center; gap: 4px;
  height: 28px; padding: 0 8px; max-width: min(360px, 45cqw); min-width: 0;
  border: none; border-radius: 10px;
  background: transparent; outline: none; cursor: pointer;
  color: var(--dsw-alias-label-primary);
  font-size: 13px; font-weight: 400; line-height: 20px;
}
.gptm-trigger:hover:not(:disabled),
.gptm-trigger[aria-expanded="true"] { background: var(--dsw-alias-interactive-bg-hover); }
.gptm-trigger:focus-visible { box-shadow: 0 0 0 2px var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary)); }
.gptm-trigger:disabled { color: var(--dsw-alias-label-dimmed); cursor: default; }
.gptm-root svg, .gptm-menu svg { display: block; flex: none; }
.gptm-triggerBolt { display: none; flex: none; align-items: center; color: #242527; }
.gptm-trigger[data-fast="true"] .gptm-triggerBolt { display: flex; }
.gptm-triggerModel { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
.gptm-triggerLevel { flex: none; color: #585b60; }
.gptm-trigger[data-ultra="true"] .gptm-triggerLevel { color: #8a48ea; }
.gptm-triggerCaret { flex: none; color: #77797d; transition: transform 150ms cubic-bezier(.2,.8,.2,1); }
.gptm-trigger[aria-expanded="true"] .gptm-triggerCaret { transform: rotate(180deg); }

/* popover surface — host theme. Not a scroll container: like the prototype the
   popover grows with its content, and the model list below is the only
   scrolling region. There, overflow-x stays hidden because setting one axis to
   auto computes the other to auto as well, and the thumb legitimately overhangs
   the track by a pixel at the top level. */
.gptm-menu {
  position: fixed; z-index: 1100; display: flex; flex-direction: column;
  width: 258px; max-width: calc(100vw - 32px);
  max-height: min(440px, calc(100vh - 96px));
  padding: 9px 11px 12px; overflow: hidden;
  border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 17px;
  background: var(--dsw-alias-bg-layer-1, var(--dsw-alias-bg-base));
  box-shadow: var(--dsw-elevation-prominent, 0 16px 42px rgba(0,0,0,.12));
  color: var(--dsw-alias-label-primary);
  transform-origin: 44% 100%;
  animation: gptm-in 160ms cubic-bezier(.2,.8,.2,1);
}
@keyframes gptm-in {
  from { opacity: 0; transform: translateY(3px) scale(.985); }
  to   { opacity: 1; transform: none; }
}
@media (prefers-reduced-motion: reduce) {
  .gptm-menu { animation: none; }
  .gptm-triggerCaret { transition: none; }
}

/* header: 34px | 1fr | 34px */
.gptm-head {
  display: grid; grid-template-columns: 34px 1fr 34px; align-items: center;
  gap: 5px; height: 44px; margin-bottom: 5px; flex: none;
  transition: height 140ms cubic-bezier(.2,.8,.2,1), margin-bottom 140ms cubic-bezier(.2,.8,.2,1), grid-template-columns 140ms cubic-bezier(.2,.8,.2,1);
}
.gptm-head[data-quota="true"] { height: 34px; grid-template-columns: 0 1fr 0; gap: 0; margin-bottom: 3px; }
.gptm-iconBtn {
  display: grid; place-items: center; width: 32px; height: 32px; padding: 0;
  border: 0; border-radius: 9px; color: #74767b; background: transparent; cursor: pointer;
  transition: color 100ms ease-out, background-color 80ms ease-out, transform 80ms ease-out, opacity 100ms ease-out;
}
.gptm-iconBtn:hover:not(:disabled) { background: var(--dsw-alias-interactive-bg-hover); }
.gptm-iconBtn:active:not(:disabled) { transform: scale(.97); }
.gptm-iconBtn:disabled { opacity: .4; cursor: default; }
.gptm-fastToggle[aria-pressed="true"] { color: #4d7df4; }
.gptm-fastToggle .gptm-boltFill { opacity: 0; transition: opacity 100ms ease-out; }
.gptm-fastToggle[aria-pressed="true"] .gptm-boltFill { opacity: 1; }
.gptm-fastToggle .gptm-boltOutline { opacity: 1; transition: opacity 100ms ease-out; }
.gptm-fastToggle[aria-pressed="true"] .gptm-boltOutline { opacity: 0; }
.gptm-head[data-quota="true"] .gptm-iconBtn { opacity: 0; pointer-events: none; transform: scale(.82); }

.gptm-status {
  display: grid; place-items: center; align-content: center; min-width: 0; min-height: 42px;
  padding: 3px 10px; border: 0; border-radius: 8px;
  color: inherit; background: transparent; font: inherit; text-align: center; cursor: pointer;
  transition: background-color 80ms ease-out;
}
.gptm-status:hover:not(:disabled) { background: var(--dsw-alias-interactive-bg-hover); }
.gptm-status:disabled { cursor: default; }
.gptm-menu[data-fast="true"] .gptm-status { background: var(--dsw-alias-interactive-bg-hover); }
.gptm-head[data-quota="true"] .gptm-status { background: transparent; }
.gptm-statusTitle {
  max-width: 180px; overflow: hidden; color: #4e7fe9;
  font-size: 14px; font-weight: 650; line-height: 1.15; white-space: nowrap; text-overflow: ellipsis;
  transition: opacity 90ms ease-out, color 120ms ease-out;
}
.gptm-menu[data-ultra="true"] .gptm-statusTitle {
  color: #8b48f5;
  background: linear-gradient(90deg, #5683f6, #7f52f7 48%, #b24dec);
  -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent;
}
.gptm-head[data-quota="true"] .gptm-statusTitle {
  max-width: none; color: #9b4dea; font-size: 13px; font-weight: 600;
  background: linear-gradient(90deg, #6c63f5, #b647e3);
  -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent;
}
.gptm-statusModel {
  margin-top: 3px; color: #77797e; font-size: 12px; line-height: 1.1; white-space: nowrap;
}
.gptm-head[data-quota="true"] .gptm-statusModel { display: none; }

/* slider */
.gptm-slider {
  --value: 75%;
  position: relative; height: 26px; flex: none;
  cursor: grab; touch-action: none; outline: none;
}
.gptm-slider:active { cursor: grabbing; }
.gptm-slider:focus-visible::after {
  content: ""; position: absolute; inset: -4px; border: 2px solid rgba(11,132,255,.38); border-radius: 17px; corner-shape: round;
}
.gptm-slider[data-disabled="true"] { opacity: .5; cursor: default; }
/* Every full-round radius below pairs corner-shape: round with it. DSH's theme
   injects a universal rule over *, :before and :after that sets
   corner-shape: superellipse(1.5) under @supports, which turns a 50% circle
   into a squircle and deforms pill ends. The plugin's own full-round shapes
   must opt back out, exactly as every shipped DSH component sheet does.
   Decorative radii (menu, trigger, rows) keep the theme's smoothing. */
.gptm-track, .gptm-fill {
  position: absolute; top: 1px; left: 0; height: 24px;
  border-radius: 999px; corner-shape: round;
}
.gptm-track { width: 100%; overflow: hidden; background: #e8e7e8; box-shadow: inset 0 0 0 1px rgba(0,0,0,.025); }
/* min-width keeps the fill at least as wide as it is tall, so its cap stays a
   true 12px semicircle. A narrower box makes the browser scale the 999px radii
   down (the fill comes out ~6.4px), which squares the cap off just enough to
   poke past the 28px thumb at the lowest level — the blue sliver on the left.
   The extra width is hidden under the thumb, so nothing else changes. */
.gptm-fill { z-index: 1; width: var(--value); min-width: 24px; overflow: hidden; background: #5184f4; }
/* Deliberate deviation from the prototype. It gives the top level a SECOND
   gradient for fast-mode-off — #3941c4 to #a987ff to #7d57eb — declared after
   the one below so it wins, which makes the track jump colour the moment the
   bolt is toggled. One gradient is used for both states instead, so fast mode
   changes only the particles and the trail's own opacity. */
.gptm-slider[data-ultra="true"] .gptm-fill {
  background: linear-gradient(90deg, #536ae8 0%, #8178fa 42%, #7953e9 72%, #9b4ae7 100%);
}
.gptm-slider[data-snapping="true"] .gptm-fill { transition: width 130ms cubic-bezier(.2,.8,.2,1); }

/* Ticks sit on the SAME ratios as the thumb. The prototype distributes them by
   flex over a 12px inset instead, which puts its interior ticks up to ~7px away
   from the thumb positions they are supposed to mark; anchoring both to one set
   of ratios is what removes the mismatch at the ends. */
.gptm-ticks {
  position: absolute; z-index: 2; inset: 0;
  pointer-events: none; transition: opacity 100ms ease-out;
}
.gptm-slider[data-ultra="true"] .gptm-ticks { opacity: 0; }
.gptm-tick {
  position: absolute; top: 50%; width: 4px; height: 4px; margin: -2px 0 0 -2px;
  border: 0; border-radius: 50%; corner-shape: round; background: #aaaeb4;
  transition: width 100ms ease-out, height 100ms ease-out, margin 100ms ease-out, background-color 100ms ease-out;
}
.gptm-tick[data-past="true"] { background: rgba(255,255,255,.35); }
.gptm-tick[data-current="true"] { width: 8px; height: 8px; margin: -4px 0 0 -4px; background: rgba(255,255,255,.38); }

.gptm-trail {
  position: absolute; z-index: 3; top: 1px; left: 0;
  width: var(--value); min-width: 24px; height: 24px; overflow: hidden; border-radius: 999px; corner-shape: round;
  opacity: 0; pointer-events: none;
  transition: opacity 120ms ease-out, width 130ms cubic-bezier(.2,.8,.2,1);
}
.gptm-slider[data-fast="true"] .gptm-trail,
.gptm-slider[data-ultra="true"] .gptm-trail { opacity: 1; }
.gptm-slider[data-ultra="true"][data-fast="false"] .gptm-trail { opacity: .76; }
.gptm-particle {
  position: absolute; left: calc(var(--x) * 1%); top: calc(var(--y) * 1%);
  width: var(--pw); height: var(--ph); border-radius: 50%; corner-shape: round;
  background: rgba(255,255,255,.96); box-shadow: 0 0 2.5px rgba(255,255,255,.7);
  opacity: 0; transform-origin: 50% 50%;
  animation: gptm-drift var(--dur) linear infinite; animation-delay: var(--d);
}
.gptm-particle[data-streak="true"] { border-radius: 999px; corner-shape: round; }
@keyframes gptm-drift {
  0%   { opacity: 0; transform: translate(5px, 0) rotate(var(--rot)) scale(.45); }
  14%  { opacity: calc(var(--peak) * var(--spin)); }
  42%  { opacity: calc(.7 * var(--peak) * var(--spin)); }
  72%  { opacity: calc(.32 * var(--peak) * var(--spin)); }
  100% { opacity: 0; transform: translate(var(--tx), var(--ty)) rotate(var(--rot)) scale(.25); }
}
/* Idle state (top level, fast mode off): the drift geometry is replaced
   wholesale by the idle set, so these particles become small, slow, round
   dots instead of flat streaks racing across the pill. */
.gptm-slider[data-tremble="true"] .gptm-particle {
  left: calc(var(--idle-x) * 1%);
  top: calc(var(--idle-y) * 1%);
  width: var(--idle-size);
  height: var(--idle-size);
  border-radius: 50%;
  corner-shape: round;
  background: rgba(255,255,255,.84);
  box-shadow: 0 0 1.5px rgba(255,255,255,.25);
  animation-name: gptm-tremble;
  animation-duration: var(--idle-duration);
  animation-timing-function: ease-in-out;
}
.gptm-slider[data-tremble="true"] .gptm-particle:nth-child(even) { display: none; }
@keyframes gptm-tremble {
  0%, 100% { opacity: calc(.24 * var(--spin)); transform: translate(-.15px, .06px) scale(.92); }
  25%      { opacity: calc(.38 * var(--spin)); transform: translate(.18px, -.1px) scale(.97); }
  50%      { opacity: calc(var(--idle-peak) * var(--spin)); transform: translate(-.05px, .16px) scale(1); }
  75%      { opacity: calc(.32 * var(--spin)); transform: translate(.1px, .03px) scale(.95); }
}
@media (prefers-reduced-motion: reduce) { .gptm-particle { animation: none; opacity: .35; } }

.gptm-thumb {
  position: absolute; z-index: 4; top: -1px; left: var(--value);
  width: 28px; height: 28px; border: 1px solid rgba(0,0,0,.075); border-radius: 50%; corner-shape: round;
  background: #fcfcfd;
  box-shadow: 0 1px 3px rgba(0,0,0,.17), 0 0 0 .5px rgba(0,0,0,.04);
  transform: translateX(-50%) scale(1);
  transition: transform 70ms ease-out;
}
.gptm-slider[data-dragging="true"] .gptm-thumb { transform: translateX(-50%) scale(.97); }
.gptm-slider[data-snapping="true"] .gptm-thumb { transition: left 130ms cubic-bezier(.2,.8,.2,1), transform 70ms ease-out; }

/* model pane */
.gptm-paneHead { display: flex; align-items: center; gap: 2px; height: 40px; flex: none; }
.gptm-scroll {
  flex: 1 1 auto; min-height: 0;
  overflow-y: auto; overflow-x: hidden;
  overscroll-behavior: contain;
}
.gptm-search {
  flex: none;
  width: 100%; margin: 0 0 4px; padding: 6px 8px;
  border: none; border-radius: var(--dsw-radius-sm, 6px);
  background: transparent; outline: none;
  color: var(--dsw-alias-label-primary); font: inherit; font-size: 13px;
}
.gptm-search::placeholder { color: var(--dsw-alias-label-caption); }
.gptm-heading {
  padding: 6px 8px 4px; color: var(--dsw-alias-label-caption);
  font-size: 11px; font-weight: 500; letter-spacing: .02em;
}
.gptm-row {
  display: flex; align-items: center; gap: 8px; width: 100%;
  padding: 7px 8px; border: none; border-radius: 9px;
  background: none; cursor: pointer; text-align: left;
  color: var(--dsw-alias-label-primary); font: inherit; font-size: 13px; font-weight: 400;
}
.gptm-row:hover:not(:disabled) { background: var(--dsw-alias-interactive-bg-hover); }
.gptm-row:disabled { cursor: default; color: var(--dsw-alias-label-dimmed); }
.gptm-rowText { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.gptm-check { flex: none; width: 14px; color: var(--dsw-alias-state-business-primary); }
.gptm-note { padding: 8px; color: var(--dsw-alias-label-tertiary); font-size: 12px; line-height: 18px; }
.gptm-error {
  flex: none; margin: 0 0 4px; padding: 7px 8px; border-radius: var(--dsw-radius-md, 8px);
  background: var(--dsw-alias-interactive-bg-hover-danger);
  color: var(--dsw-alias-state-error-primary); font-size: 12px; line-height: 18px;
}
.gptm-spin {
  flex: none; width: 12px; height: 12px; border-radius: 50%; corner-shape: round;
  border: 1.6px solid var(--dsw-alias-border-l3); border-top-color: var(--dsw-alias-label-tertiary);
  animation: gptm-spin 700ms linear infinite;
}
@keyframes gptm-spin { to { transform: rotate(360deg); } }
`

    const ZH = {
      'trigger.loading': '加载中',
      'trigger.fallback': '选择模型',
      'effort.providerDefault': '默认',
      'section.model': '选择模型',
      'section.effort': '思考强度',
      'search.placeholder': '搜索模型',
      'empty.models': '没有匹配的模型。',
      'empty.efforts': '当前模型未提供思考强度等级。',
      'provider.account': 'DeepSeek 账户',
      'status.loading': '正在读取模型列表…',
      'fast.label': '开启快速模式',
      'action.reset': '重置思考设置',
      'action.back': '返回模型列表',
      'quota.title': '更快消耗使用额度',
    }

    const EN = {
      'trigger.loading': 'Loading',
      'trigger.fallback': 'Select model',
      'effort.providerDefault': 'Default',
      'section.model': 'Select model',
      'section.effort': 'Thinking',
      'search.placeholder': 'Search models',
      'empty.models': 'No matching models.',
      'empty.efforts': 'This model provides no thinking levels.',
      'provider.account': 'DeepSeek Account',
      'status.loading': 'Loading the model list…',
      'fast.label': 'Turn on fast mode',
      'action.reset': 'Reset thinking settings',
      'action.back': 'Back to model list',
      'quota.title': 'Uses your quota faster',
    }

    // ── icons ───────────────────────────────────────────────────────────────
    // Bolt and caret geometry are copied from the prototype verbatim.
    const BOLT_PATH = 'M13.2 2.8 5.8 13h5l-1 8.2 8.4-11.1h-5z'

    // The prototype uses TWO different bolts from the same path: the trigger's
    // is a solid `fill="currentColor"` glyph, while the popover's fast toggle is
    // an outline that swaps to a fill when pressed. Rendering one shape for both
    // made the trigger's bolt read heavier than the prototype's.
    function Bolt({ size = 18, solid = false }) {
      if (solid) {
        return h(
          'svg',
          {
            width: size,
            height: size,
            viewBox: '4.5 2 15 20',
            fill: 'currentColor',
            'aria-hidden': true,
          },
          h('path', { d: BOLT_PATH }),
        )
      }
      return h(
        'svg',
        { width: size, height: size, viewBox: '4.5 2 15 20', 'aria-hidden': true },
        h('path', {
          className: 'gptm-boltOutline',
          d: BOLT_PATH,
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.7,
          strokeLinejoin: 'round',
        }),
        h('path', { className: 'gptm-boltFill', d: BOLT_PATH, fill: 'currentColor' }),
      )
    }

    function Caret() {
      return h(
        'svg',
        {
          className: 'gptm-triggerCaret',
          width: 12,
          height: 12,
          viewBox: '0 0 20 20',
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.8,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          'aria-hidden': true,
        },
        h('path', { d: 'm6 8 4 4 4-4' }),
      )
    }

    function ResetIcon() {
      return h(
        'svg',
        {
          width: 17,
          height: 17,
          viewBox: '0 0 24 24',
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.7,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          'aria-hidden': true,
        },
        h('path', { d: 'M4.4 9A8 8 0 1 1 4 15.6' }),
        h('path', { d: 'M4.4 4.8V9h4.2' }),
      )
    }

    function Check() {
      return h(
        'svg',
        { className: 'gptm-check', viewBox: '0 0 16 16', width: 14, height: 14, 'aria-hidden': true },
        h('path', {
          d: 'M3.5 8.5l3 3 6-7',
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.8,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
        }),
      )
    }

    function ArrowLeft() {
      return h(
        'svg',
        { viewBox: '0 0 16 16', width: 15, height: 15, 'aria-hidden': true },
        h('path', {
          d: 'M9.5 3.5 5 8l4.5 4.5',
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.6,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
        }),
      )
    }

    // ── particle pattern ────────────────────────────────────────────────────
    // Transcribed field-for-field from the prototype's generator. Each particle
    // carries TWO complete geometries: the drifting trail (fast mode) and the
    // in-place tremble shown at the top level with fast mode off. The idle set
    // is what makes those particles small circles instead of the flat streaks
    // the drift set produces.
    const PARTICLES = Array.from({ length: PARTICLE_COUNT }, (_, i) => {
      const size = PARTICLE_SIZES[i % PARTICLE_SIZES.length]
      const streak = i % 4 === 0 || i % 7 === 0
      return {
        key: i,
        streak,
        // drift geometry
        x: 4 + ((i * 37) % 92),
        y: 13 + ((i * 29) % 68),
        width: streak ? size * 2.15 : size,
        height: streak ? Math.max(0.8, size * 0.55) : size,
        delay: -((i * 173) % 1250),
        duration: 620 + ((i * 113) % 630),
        travelX: -(10 + ((i * 17) % 20)),
        travelY: -4 + ((i * 11) % 9),
        rotation: streak ? -48 + ((i * 23) % 78) : 0,
        peak: 0.66 + ((i * 7) % 29) / 100,
        // idle geometry
        idleX: 5 + ((i * 41) % 84),
        idleY: 30 + ((i * 17) % 41),
        idleSize: i % 6 === 0 ? 1.9 : 1.15 + (i % 3) * 0.18,
        idleDuration: 2100 + ((i * 131) % 1100),
        idlePeak: 0.5 + ((i * 7) % 24) / 100,
      }
    })

    /**
     * Level positions. The prototype's rule is even fractions of the track
     * clamped to the thumb's travel: for its five levels `[.055, .25, .5, .75,
     * .945]` is exactly `clamp(i/4, .055, .945)`. Spreading the levels evenly
     * across the clamped span instead — which this used to do — puts every
     * interior level in the wrong place.
     */
    function levelRatios(count) {
      if (count <= 1) return [0.5]
      return Array.from({ length: count }, (_, i) =>
        Math.min(RATIO_MAX, Math.max(RATIO_MIN, i / (count - 1))),
      )
    }

    /**
     * The composer's model + thinking control.
     *
     * Props arrive from three shares: `locked` from the owner (the composer
     * seat's declarer), `available`/`directory`/`load`/`select` from this
     * plugin's per-session `inject`, and `t` from the `locale` seat declared at
     * registration.
     *
     * All data and submission ride the shared per-session `ModelDirectory` the
     * shipped control also uses, so the selection this writes is exactly what
     * the `/model` popup and the next request see.
     */
    function ModelEffortControl({ locked, available, directory, load, select, t }) {
      const state = React.useSyncExternalStore(
        (fn) => directory.subscribe(fn),
        () => directory.getSnapshot(),
      )
      const [open, setOpen] = React.useState(false)
      const [pane, setPane] = React.useState('thinking')
      const [query, setQuery] = React.useState('')
      const [pos, setPos] = React.useState(null)
      const [fast, setFast] = React.useState(false)
      const [quota, setQuota] = React.useState(false)
      const [dragging, setDragging] = React.useState(false)
      const [snapping, setSnapping] = React.useState(false)
      const [dragRatio, setDragRatio] = React.useState(null)
      const [dragIndex, setDragIndex] = React.useState(null)
      const triggerRef = React.useRef(null)
      const menuRef = React.useRef(null)
      const searchRef = React.useRef(null)
      const sliderRef = React.useRef(null)
      const spinRef = React.useRef(0)
      const snapTimerRef = React.useRef(0)
      const quotaShowRef = React.useRef(0)
      const quotaHideRef = React.useRef(0)

      const groups = state.groups ?? []
      const current = state.current ?? null
      const pending = state.pending ?? null
      const busy = pending !== null
      const disabled = locked === true || available === false

      const choices = React.useMemo(
        () => groups.flatMap((group) => group.models.map((model) => ({ group, model }))),
        [groups],
      )

      const currentChoice =
        current === null
          ? undefined
          : choices.find(
              (c) => c.group.id === current.provider && c.model.id === current.model,
            )

      const reasoning = currentChoice?.model.reasoning
      // An adapter may advertise reasoning metadata without a level list.
      const efforts = reasoning?.efforts ?? []
      const effectiveEffort = current?.reasoningEffort ?? reasoning?.defaultEffort

      // The offered levels, with an explicit "model default" entry prepended
      // only when the adapter declares no default of its own.
      const levels = React.useMemo(() => {
        if (reasoning === undefined) return []
        return [
          ...(reasoning.defaultEffort === undefined
            ? [{ key: 'provider-default', effort: undefined, label: t('effort.providerDefault') }]
            : []),
          ...efforts.map((effort) => ({
            key: `effort:${effort.id}`,
            effort: effort.id,
            label: effort.name,
          })),
        ]
      }, [reasoning, efforts, t])

      const ratios = React.useMemo(() => levelRatios(levels.length), [levels.length])
      const foundIndex = levels.findIndex((level) => level.effort === effectiveEffort)
      const levelIndex = foundIndex === -1 ? 0 : foundIndex

      // While a gesture is in flight the visuals follow the pointer, not the
      // committed selection — the prototype repaints the level continuously and
      // only submits on release. `applyLevel` still commits `nearestIndex`.
      const displayIndex = dragIndex ?? levelIndex
      const displayLabel =
        levels.length === 0
          ? state.retainedEffort
          : (levels[displayIndex]?.label ?? state.retainedEffort)

      const modelLabel =
        choices.length === 0 && state.status === 'loading'
          ? t('trigger.loading')
          : (currentChoice?.model.name ??
            (current === null
              ? t('trigger.fallback')
              : `${current.provider}/${current.model}`))

      const isUltra = levels.length > 1 && displayIndex === levels.length - 1
      // Prototype: the trail is drawn whenever fast mode is on or the level is
      // top; tremble replaces drift only at the top level with fast mode off.
      const tremble = isUltra && !fast

      const shownRatio =
        dragRatio ?? (levels.length === 0 ? RATIO_MIN : (ratios[displayIndex] ?? RATIO_MIN))

      // ── the ramp ──────────────────────────────────────────────────────────
      // The prototype cross-faded a trail whose particle cycles were already in
      // flight, so nothing ever "spun up". Easing `--spin` to 1 gives the trail
      // a real ignition and coast-down while keeping the steady state byte-for
      // -byte equivalent to the prototype's opacities.
      React.useEffect(() => {
        const node = sliderRef.current
        if (node === null || !open) return undefined
        const target = isUltra || fast ? 1 : 0
        let raf = 0
        let last = performance.now()
        const tick = (now) => {
          const dt = Math.min(64, now - last)
          last = now
          const value = spinRef.current
          if (Math.abs(target - value) > 0.002) {
            // Asymmetric: ignite faster than it dies down.
            const step = dt * (target > value ? 1 / 600 : 1 / 900)
            spinRef.current = target > value ? Math.min(target, value + step) : Math.max(target, value - step)
            node.style.setProperty('--spin', String(spinRef.current))
            raf = requestAnimationFrame(tick)
          } else if (value !== target) {
            spinRef.current = target
            node.style.setProperty('--spin', String(target))
          }
        }
        raf = requestAnimationFrame(tick)
        return () => cancelAnimationFrame(raf)
      }, [open, fast, isUltra])

      React.useEffect(() => {
        if (!open) {
          spinRef.current = 0
          sliderRef.current?.style.setProperty('--spin', '0')
        }
      }, [open])

      React.useEffect(
        () => () => {
          clearTimeout(snapTimerRef.current)
          clearTimeout(quotaShowRef.current)
          clearTimeout(quotaHideRef.current)
        },
        [],
      )

      // ── open / close ──────────────────────────────────────────────────────
      const close = React.useCallback(() => {
        setOpen(false)
        setPane('thinking')
      }, [])

      const toggle = React.useCallback(() => {
        if (disabled) return
        setOpen((wasOpen) => {
          if (wasOpen) return false
          setQuery('')
          setPane('thinking')
          load()
          return true
        })
      }, [disabled, load])

      React.useEffect(() => {
        if (!open) return undefined
        const onPointerDown = (event) => {
          if (triggerRef.current?.contains(event.target) === true) return
          if (menuRef.current?.contains(event.target) === true) return
          close()
        }
        const onKeyDown = (event) => {
          if (event.key === 'Escape') {
            event.stopPropagation()
            close()
          }
        }
        document.addEventListener('mousedown', onPointerDown)
        document.addEventListener('keydown', onKeyDown, true)
        return () => {
          document.removeEventListener('mousedown', onPointerDown)
          document.removeEventListener('keydown', onKeyDown, true)
        }
      }, [open, close])

      React.useLayoutEffect(() => {
        if (!open) return undefined
        const place = () => {
          const trigger = triggerRef.current
          if (trigger === null) return
          const rect = trigger.getBoundingClientRect()
          setPos({
            left: Math.max(8, Math.min(rect.left, window.innerWidth - 274)),
            bottom: Math.max(8, window.innerHeight - rect.top + 8),
          })
        }
        place()
        window.addEventListener('resize', place)
        window.addEventListener('scroll', place, true)
        return () => {
          window.removeEventListener('resize', place)
          window.removeEventListener('scroll', place, true)
        }
      }, [open])

      React.useEffect(() => {
        if (open && pane === 'models' && choices.length > 4) searchRef.current?.focus()
      }, [open, pane, choices.length])

      // ── selection ─────────────────────────────────────────────────────────
      // The shared directory owns the in-flight state: it publishes `pending`
      // while the Host settles and writes `error` on failure. Close only on
      // success, so a rejected selection leaves the menu open with the reason
      // visible.
      const submit = (selection, closeAfter) => {
        Promise.resolve(select(selection)).then(
          (result) => {
            if ((result === undefined || result.ok === true) && closeAfter) close()
          },
          () => {},
        )
      }

      const showQuota = () => {
        clearTimeout(quotaShowRef.current)
        clearTimeout(quotaHideRef.current)
        quotaShowRef.current = setTimeout(() => {
          setQuota(true)
          quotaHideRef.current = setTimeout(() => setQuota(false), 1350)
        }, 145)
      }

      const applyLevel = (index, options) => {
        const choice = levels[index]
        if (choice === undefined || current === null) return
        if (options?.announceTop === true && levels.length > 1 && index === levels.length - 1) {
          showQuota()
        }
        submit(
          {
            provider: current.provider,
            model: current.model,
            ...(choice.effort === undefined ? {} : { reasoningEffort: choice.effort }),
          },
          false,
        )
      }

      const chooseModel = (group, model) => {
        if (busy) return
        const isCurrent = current?.provider === group.id && current.model === model.id
        const reasoningEffort = isCurrent
          ? (current?.reasoningEffort ?? model.reasoning?.defaultEffort)
          : model.reasoning?.defaultEffort
        submit(
          {
            provider: group.id,
            model: model.id,
            ...(reasoningEffort === undefined ? {} : { reasoningEffort }),
          },
          true,
        )
      }

      const reset = () => {
        setFast(false)
        if (current === null || reasoning === undefined) return
        const fallback = reasoning.defaultEffort ?? efforts[0]?.id
        submit(
          {
            provider: current.provider,
            model: current.model,
            ...(fallback === undefined ? {} : { reasoningEffort: fallback }),
          },
          false,
        )
      }

      // ── slider pointer handling ───────────────────────────────────────────
      // Ported from the prototype, which drives the drag from WINDOW listeners
      // filtered by an active pointer id, rather than from handlers on the
      // track itself. Two consequences matter:
      //
      //  - the drag survives the pointer leaving the track in any direction,
      //    which is what made rightward drags die (a move handler bound to the
      //    track only sees events while the pointer is over it or while pointer
      //    capture holds);
      //  - the handlers read live state from refs, so a React re-render landing
      //    between two moves can never leave a stale `dragging: false` closure
      //    in charge and swallow the rest of the gesture.
      const ratioFromClientX = (clientX) => {
        const node = sliderRef.current
        if (node === null) return null
        const rect = node.getBoundingClientRect()
        if (rect.width === 0) return null
        const raw = (clientX - rect.left) / rect.width
        // Clamp to the end levels, exactly as the prototype clamps to its first
        // and last step ratios.
        return Math.min(ratios[ratios.length - 1], Math.max(ratios[0], raw))
      }

      const nearestIndex = (ratio) => {
        let best = 0
        let bestDistance = Infinity
        for (let i = 0; i < ratios.length; i += 1) {
          const distance = Math.abs(ratios[i] - ratio)
          if (distance < bestDistance) {
            bestDistance = distance
            best = i
          }
        }
        return best
      }

      const snapBack = () => {
        setSnapping(true)
        clearTimeout(snapTimerRef.current)
        snapTimerRef.current = setTimeout(() => setSnapping(false), 150)
      }

      const sliderDisabled = busy || current === null || levels.length === 0

      // Live gesture bookkeeping. `drag` holds what the pointer is doing right
      // now; `dragIndex` is the level the visuals follow until the Host settles.
      const drag = React.useRef({ active: false, pointerId: null })

      const paintContinuous = (clientX) => {
        const ratio = ratioFromClientX(clientX)
        if (ratio === null) return
        setDragRatio(ratio)
        setDragIndex(nearestIndex(ratio))
      }

      const beginDrag = (event) => {
        if (sliderDisabled) return
        if (event.pointerType === 'mouse' && event.button !== 0) return
        // Suppresses the compatibility mouse events, so a drag neither selects
        // text nor hands the track a focus ring.
        event.preventDefault()
        drag.current.active = true
        drag.current.pointerId = event.pointerId
        setSnapping(false)
        setDragging(true)
        try {
          event.currentTarget.setPointerCapture(event.pointerId)
        } catch {
          // Capture is an optimisation; the window listeners below are the
          // actual guarantee that the gesture keeps receiving events.
        }
        paintContinuous(event.clientX)
      }

      const finishDrag = (event) => {
        if (!drag.current.active || event.pointerId !== drag.current.pointerId) return
        drag.current.active = false
        drag.current.pointerId = null
        setDragging(false)
        const ratio = ratioFromClientX(event.clientX)
        setDragRatio(null)
        setDragIndex(null)
        snapBack()
        try {
          if (event.currentTarget?.hasPointerCapture?.(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId)
          }
        } catch {
          // Nothing to release.
        }
        if (ratio === null) return
        applyLevel(nearestIndex(ratio), { announceTop: true })
      }

      const cancelDrag = (event) => {
        if (!drag.current.active || event.pointerId !== drag.current.pointerId) return
        drag.current.active = false
        drag.current.pointerId = null
        setDragging(false)
        setDragRatio(null)
        setDragIndex(null)
      }

      // The window listeners are registered once; the handler table is refreshed
      // every render so they always run the newest closure.
      const dragHandlers = React.useRef({ move: null, up: null, cancel: null })
      dragHandlers.current.move = (event) => {
        if (!drag.current.active || event.pointerId !== drag.current.pointerId) return
        event.preventDefault()
        paintContinuous(event.clientX)
      }
      dragHandlers.current.up = finishDrag
      dragHandlers.current.cancel = cancelDrag

      React.useEffect(() => {
        const onMove = (event) => dragHandlers.current.move?.(event)
        const onUp = (event) => dragHandlers.current.up?.(event)
        const onCancel = (event) => dragHandlers.current.cancel?.(event)
        window.addEventListener('pointermove', onMove, { passive: false })
        window.addEventListener('pointerup', onUp)
        window.addEventListener('pointercancel', onCancel)
        return () => {
          window.removeEventListener('pointermove', onMove)
          window.removeEventListener('pointerup', onUp)
          window.removeEventListener('pointercancel', onCancel)
        }
      }, [])

      const onSliderKey = (event) => {
        if (sliderDisabled) return
        let next = levelIndex
        if (event.key === 'ArrowRight' || event.key === 'ArrowUp') next = levelIndex + 1
        else if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') next = levelIndex - 1
        else if (event.key === 'Home') next = 0
        else if (event.key === 'End') next = levels.length - 1
        else return
        event.preventDefault()
        const clamped = Math.min(levels.length - 1, Math.max(0, next))
        if (clamped !== levelIndex) {
          snapBack()
          applyLevel(clamped, { announceTop: true })
        }
      }

      // ── render ────────────────────────────────────────────────────────────
      // Addressed subagent sessions expose no model seat at all; the directory
      // service would throw for them.
      if (available === false) return null

      const trigger = h(
        'button',
        {
          ref: triggerRef,
          type: 'button',
          className: 'gptm-trigger',
          'data-gpt-helper': 'model-effort-trigger',
          'data-fast': fast,
          'data-ultra': isUltra,
          'aria-haspopup': 'dialog',
          'aria-expanded': open,
          'aria-busy': busy,
          title:
            displayLabel === undefined ? modelLabel : `${modelLabel} · ${displayLabel}`,
          disabled,
          onClick: toggle,
        },
        h('span', { className: 'gptm-triggerBolt' }, h(Bolt, { size: 14, solid: true })),
        h('span', { className: 'gptm-triggerModel' }, modelLabel),
        displayLabel === undefined
          ? null
          : h('span', { className: 'gptm-triggerLevel' }, displayLabel),
        busy ? h('span', { className: 'gptm-spin', 'aria-hidden': true }) : h(Caret, null),
      )

      let menu = null
      if (open && pos !== null) {
        const body = []
        // The model rows are the only scrollable region; the thinking pane grows
        // with the popover instead (see the `.gptm-menu` comment).
        const rows = []

        if (state.error !== null && state.error !== undefined) {
          body.push(h('div', { key: 'error', className: 'gptm-error' }, String(state.error)))
        }

        if (pane === 'models') {
          const showSearch = choices.length > 4
          const needle = query.trim().toLowerCase()
          const filteredGroups =
            needle === ''
              ? groups
              : groups
                  .map((group) => ({
                    ...group,
                    models: group.models.filter((model) =>
                      String(model.name ?? model.id).toLowerCase().includes(needle),
                    ),
                  }))
                  .filter((group) => group.models.length > 0)

          body.push(
            h(
              'div',
              { key: 'paneHead', className: 'gptm-paneHead' },
              h(
                'button',
                {
                  type: 'button',
                  className: 'gptm-iconBtn',
                  title: t('action.back'),
                  'aria-label': t('action.back'),
                  onClick: () => setPane('thinking'),
                },
                h(ArrowLeft, null),
              ),
            ),
          )

          if (showSearch) {
            body.push(
              h('input', {
                key: 'search',
                ref: searchRef,
                className: 'gptm-search',
                type: 'text',
                value: query,
                placeholder: t('search.placeholder'),
                'aria-label': t('search.placeholder'),
                onChange: (event) => setQuery(event.target.value),
              }),
            )
          }

          if (filteredGroups.length === 0) {
            rows.push(
              h(
                'div',
                { key: 'empty', className: 'gptm-note' },
                choices.length === 0 ? t('status.loading') : t('empty.models'),
              ),
            )
          }

          for (const group of filteredGroups) {
            const providerName =
              group.id === 'deepseek-account' ? t('provider.account') : (group.name ?? group.id)
            rows.push(h('div', { key: `p:${group.id}`, className: 'gptm-heading' }, providerName))
            for (const model of group.models) {
              const isCurrent = current?.provider === group.id && current.model === model.id
              rows.push(
                h(
                  'button',
                  {
                    key: `m:${group.id}/${model.id}`,
                    type: 'button',
                    className: 'gptm-row',
                    role: 'menuitemradio',
                    'aria-checked': isCurrent,
                    title: model.name,
                    disabled: busy,
                    onClick: () => chooseModel(group, model),
                  },
                  h('span', { className: 'gptm-rowText' }, model.name ?? model.id),
                  isCurrent ? h(Check, null) : null,
                ),
              )
            }
          }

          body.push(h('div', { key: 'rows', className: 'gptm-scroll' }, rows))
        } else {
          body.push(
            h(
              'div',
              { key: 'head', className: 'gptm-head', 'data-quota': quota },
              h(
                'button',
                {
                  type: 'button',
                  className: 'gptm-iconBtn gptm-fastToggle',
                  'data-gpt-helper': 'fast-toggle',
                  'aria-pressed': fast,
                  'aria-label': t('fast.label'),
                  title: t('fast.label'),
                  onClick: () => setFast((wasFast) => !wasFast),
                },
                h(Bolt, { size: 18 }),
              ),
              h(
                'button',
                {
                  type: 'button',
                  className: 'gptm-status',
                  title: t('section.model'),
                  disabled: busy || choices.length === 0,
                  onClick: () => setPane('models'),
                },
                h(
                  'span',
                  { className: 'gptm-statusTitle' },
                  quota ? t('quota.title') : (displayLabel ?? t('section.effort')),
                ),
                h('span', { className: 'gptm-statusModel' }, `${modelLabel} ›`),
              ),
              h(
                'button',
                {
                  type: 'button',
                  className: 'gptm-iconBtn',
                  title: t('action.reset'),
                  'aria-label': t('action.reset'),
                  onClick: reset,
                },
                h(ResetIcon, null),
              ),
            ),
          )

          if (levels.length === 0) {
            body.push(h('div', { key: 'noEffort', className: 'gptm-note' }, t('empty.efforts')))
          } else {
            const ticks = levels.map((level, i) =>
              h('i', {
                key: level.key,
                className: 'gptm-tick',
                'data-past': i <= displayIndex,
                'data-current': i === displayIndex && !dragging,
                style: { left: `${ratios[i] * 100}%` },
              }),
            )

            const particles = PARTICLES.map((p) =>
              h('i', {
                key: p.key,
                className: 'gptm-particle',
                'data-streak': p.streak,
                style: {
                  '--x': String(p.x),
                  '--y': String(p.y),
                  '--pw': `${p.width}px`,
                  '--ph': `${p.height}px`,
                  '--d': `${p.delay}ms`,
                  '--dur': `${p.duration}ms`,
                  '--tx': `${p.travelX}px`,
                  '--ty': `${p.travelY}px`,
                  '--rot': `${p.rotation}deg`,
                  '--peak': String(p.peak),
                  '--idle-x': String(p.idleX),
                  '--idle-y': String(p.idleY),
                  '--idle-size': `${p.idleSize}px`,
                  '--idle-duration': `${p.idleDuration}ms`,
                  '--idle-peak': String(p.idlePeak),
                },
              }),
            )

            body.push(
              h(
                'div',
                {
                  key: 'slider',
                  ref: sliderRef,
                  className: 'gptm-slider',
                  'data-gpt-helper': 'thinking-slider',
                  'data-fast': fast,
                  'data-ultra': isUltra,
                  'data-tremble': tremble,
                  'data-dragging': dragging,
                  'data-snapping': snapping,
                  'data-disabled': sliderDisabled,
                  role: 'slider',
                  tabIndex: sliderDisabled ? -1 : 0,
                  'aria-label': t('section.effort'),
                  'aria-valuemin': 0,
                  'aria-valuemax': Math.max(0, levels.length - 1),
                  'aria-valuenow': levelIndex,
                  'aria-valuetext': displayLabel ?? '',
                  style: { '--value': `${shownRatio * 100}%`, '--spin': String(spinRef.current) },
                  onPointerDown: beginDrag,
                  onKeyDown: onSliderKey,
                },
                h('div', { className: 'gptm-track' }),
                h('div', { className: 'gptm-fill' }),
                h('div', { className: 'gptm-ticks', 'aria-hidden': true }, ticks),
                h('div', { className: 'gptm-trail', 'aria-hidden': true }, particles),
                h('div', { className: 'gptm-thumb' }),
              ),
            )
          }
        }

        menu = createPortal(
          h(
            'div',
            {
              ref: menuRef,
              className: 'gptm-menu',
              role: 'dialog',
              'data-gpt-helper': 'model-effort-menu',
              'data-fast': fast,
              'data-ultra': isUltra,
              'aria-label': t('section.effort'),
              style: { left: `${pos.left}px`, bottom: `${pos.bottom}px` },
            },
            body,
          ),
          document.body,
        )
      }

      return h(
        React.Fragment,
        null,
        h('style', null, CSS),
        h('div', { className: 'gptm-root' }, trigger),
        menu,
      )
    }

    return {
      // `remote` and `remote.session` are required even though this plugin never
      // touches them directly: `ctx.modelDirectories.directoryFor()` resolves
      // `remote.session` internally, and the client context guard only resolves
      // a service that appears in the calling fiber's inject chain (otherwise:
      // `cannot get property "remote.session" without inject`). The shipped
      // control lists exactly these for the same reason.
      inject: ['slots', 'modelDirectories', 'sessions', 'locale', 'remote', 'remote.session'],
      apply(ctx) {
        // Development beacon: distinguishes "bundle never ran" from "ran but
        // failed to register", which is otherwise invisible because an
        // unoccupied `single` slot renders nothing at all.
        console.info('[gpt-helper] client half applied')

        ctx.effect(() => ctx.locale.register(NS, { zh: ZH, en: EN }), 'gpt-helper: dictionaries')

        ctx.slots.inject('conversation.input.model', () =>
          ctx.slots.register(
            {
              name: 'conversation.input.model',
              // Required: shadow the shipped composer control.
              //
              // For a `single` slot the registry sorts an occupied cell's
              // entries by priority ascending and renders the first, and two
              // entries at the SAME priority throw ("single slot ... already
              // has a registration"). The shipped control registers at the
              // default 0, and a boot-graph plugin like this one does NOT get a
              // priority allocated for it — the decreasing auto-allocation in
              // `dsh-cordis-client-runner` belongs to the separate
              // agent-authored runtime-plugin loader. So the negative priority
              // must be passed explicitly here, or registration throws and the
              // shipped control silently stays in place.
              priority: -1,
              locale: NS,
              // Per-session face, mirroring the shipped control so both entries
              // share one directory and one submission path.
              inject: (sessionId) => {
                const directory = ctx.modelDirectories.directoryFor(sessionId)
                const available = ctx.sessions.subagentAddress(sessionId) === undefined
                return {
                  available,
                  directory: directory.store,
                  load: () => {
                    if (available) directory.load().catch(() => {})
                  },
                  select: (selection) =>
                    available ? directory.select(selection) : Promise.resolve(undefined),
                }
              },
            },
            ModelEffortControl,
          ),
        )
      },
    }
  },
})

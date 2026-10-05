# dsh-client-ui-gpt-helper

A [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) **client (browser) plugin**
that replaces the Web composer's model seat with a ChatGPT-desktop-style control: a popover with
the provider-grouped model list and an animated **thinking-level slider** carrying a particle
trail, plus a lightning **fast-mode** toggle.

The interaction design and every timing value are ported from a self-contained prototype that
ships in this repository — open [`docs/chatgpt-pc-ui-prototype.html`](docs/chatgpt-pc-ui-prototype.html)
in a browser to see the original.

## What it does

- **Model selection** — the real catalog, grouped by provider, searchable past four entries.
- **Thinking level** — the selected model's advertised levels become tick marks on a slider with
  a filled track and a 28px thumb. Drag, click a tick, or use the arrow keys; the value snaps to
  the nearest level and submits through the shared session directory.
- **Fast mode** — a bolt toggle that lights a particle trail. **Visual only:** DSH has no
  fast-mode concept, so it changes nothing except the animation. Turning it on ignites the trail
  and turning it off coasts it down (see [the ramp](#the-particle-ramp)).
- **Fast-mode lock** — hold the bolt for 600 ms to pin fast mode on. The hold is stored, so the
  bolt is lit again after a reload, in a new session and after restarting the app; the trigger
  grows a small lock badge and the popover swaps its bolt for a lock. A plain click is inert while
  the lock is held, and a second hold releases it (leaving fast mode on).
- **Colour configuration** — press `Ctrl+Shift+Alt+G` to open the colour panel and theme the
  control without editing this file (see [Colours](#colours)).

It **replaces** the shipped composer control rather than sitting beside it, and it reuses that
control's data layer, so the `/model` command and the next request stay in sync.

## Requirements

- DeepSeek Harness with the Web client (the `desktop` profile or any profile mounting
  `@deepseek-ai/dsh-web-app`).
- No build step. The `lib/*.js` files are authored directly in the shipped bundle format, so
  cloning the repository is enough.

## Install

This package is a **dsh bundle**: `package.json` declares `dsh.bundle.patch`, so dsh treats
[`cordis.patch.yml`](cordis.patch.yml) as a composition layer and mounts it for you.

```sh
dsh plugin --profile <profile> add dsh-client-ui-gpt-helper
```

That installs the package into the profile and appends it to the profile's bundle list. The
profile is watched, so dsh recomposes without a restart. Remove it with
`dsh plugin --profile <profile> remove dsh-client-ui-gpt-helper`.

### From a local checkout

```sh
dsh plugin --profile desktop add /absolute/path/to/dsh-client-ui-gpt-helper
```

### Mounting by hand

Compose [`cordis.patch.yml`](cordis.patch.yml) into the profile's own patch file, and make the
package resolvable from the profile directory:

```sh
pnpm add link:/absolute/path/to/dsh-client-ui-gpt-helper --dir "$DSH_HOME/profiles/desktop"
```

```yaml
# $DSH_HOME/profiles/<profile>/cordis.patch.yml
- insert:
    - id: gpt-helper
      name: dsh-client-ui-gpt-helper
```

A patch `insert` row may also name a path instead of a package — dsh rewrites `./`-relative and
absolute names to file URLs anchored at the patch file — which needs no install at all.

## How the takeover works

`conversation.input.model` is a **`single`** slot owned by
`@deepseek-ai/dsh-client-ui-conversation`, occupied by `@deepseek-ai/dsh-client-ui-model-selection`
at the default priority `0`.

A second registration at the *same* priority throws — `single slot "…" already has a
registration`. But the registry sorts a cell's entries by priority ascending and renders the
first, and its own error text says *"register at a different priority to shadow it (lowest
renders)"*. This plugin therefore **must** pass an explicit negative priority:

```js
ctx.slots.register({ name: 'conversation.input.model', priority: -1, … })
```

> The decreasing auto-allocation in `dsh-cordis-client-runner` belongs to a *different* loader
> (agent-authored runtime plugins, whose ledger carries `agentId`/`pluginRunId`). A boot-graph
> plugin like this one is not covered by it, and omitting the priority makes registration throw
> while the shipped control silently stays in place.

Keeping the shipped package enabled is the point: its `ctx.modelDirectories` service and the
`/model` slash command keep working, and **only the UI is replaced**. Data and submission ride
the same per-session `ModelDirectory`, so a switch made in either entry is what the other and the
next request see.

## The control

**Trigger** — a bolt (only while fast mode is lit, with a lock badge while the lock is held), the
model name, the thinking level and a caret; a spinner while a selection settles.

**Thinking pane** (default)

- *Header* — the 32×32 fast-mode bolt toggle, a status button showing the level over the model
  name that opens the model pane, and a reset button. The header is a `34px 1fr 34px` grid. The
  bolt is replaced by a lock while the lock is held, and the status button then says so instead of
  naming the level; the reset button clears the lock too, since fast mode was always part of what
  it resets.
- *Slider* — level positions follow the prototype's rule: even fractions of the track clamped to
  the thumb's travel, `clamp(i/(n-1), .055, .945)`, which reproduces its
  `[.055, .25, .5, .75, .945]` exactly. Ticks are anchored to those same ratios rather than
  flex-distributed as in the prototype, whose interior ticks land up to ~7px away from the thumb
  positions they mark.
- *Colours* — the rail is the theme's own surface and the fill is solid `#5184f4`; a gradient
  appears only at the top level. Every one of them is a token — see [Colours](#colours).
- *Particle trail* — 42 deterministic particles in a trail element sized to `--value`, so they
  are clipped to the filled pill. 18 of them are streaks. Every particle carries **two** complete
  geometries: the drifting trail and the in-place tremble shown at the top level with fast mode
  off, which is what makes those particles small slow dots instead of flat streaks.
- *Quota notice* — entering the top level briefly collapses the header and swaps the title for
  `更快消耗使用额度`, as the prototype does.
- *Hint* — one line naming the hold gesture, because a press that must be held has no affordance
  of its own.

**Model pane** — a back button, search past four models, and the provider-grouped list with the
current model checked.

### How a token resolves

**Every colour is a literal, and no colour ever travels through a `var()`.** The stylesheet writes
each token's shipped value inline; the injected rule carries only what the user overrode.

```css
/* the plugin's stylesheet — the shipped pair, no variables anywhere */
.gptm-track { background: #e8e7e8; }
:root[data-dsw-theme="light"] { --c-trigger.model: #242527; }   /* 6 tokens differ */
.gptm-root  { --c-trigger.model: #ffffff; }                      /* the dark default */

/* injected into <head> by applyTheme — only the overrides, as literals */
:root { --c-trigger.model: #ff0000; }
```

`applyTheme` writes nothing at all when no token is overridden: the stylesheet's own literals are
the appearance. An override is published on a bare `:root`, which beats the shipped
`:root[data-dsw-theme="light"]` block by specificity — that is what makes **your** colour hold in
both themes while the six shipped theme-dependent tokens keep following the app.

## Colours

The control's palette is a table of 24 tokens, each with two literals: `default` (used inline in the
stylesheet and on `<body>`-level dark) and `light` (published under the light-theme selector). Six
tokens differ between the two; the rest are tuned for a surface that is the same in both themes.

> **A colour must never be written `var(--c-x)` or `var(--c-x, fallback)`.** This app's Chromium
> drops any declaration whose value is *only* a `var(…)` — including `color`, `background`,
> `transform` and `box-shadow` — regardless of whether the variable is defined and regardless of a
> fallback being present. Measured on the running page: `CSS.supports('background', 'var(--x, #fff)')`
> answers `false`, and a rule written `color: var(--c-trigger.level)` reaches the document as an
> **empty declaration block**. That is what made the slider invisible for several rounds — its track,
> fill, thumb and ticks had their paint silently dropped while their geometry measured perfectly
> (`235x24` at the right position, `background-color: rgba(0,0,0,0)`). `selfcheck.mjs` fails if the
> stylesheet regrows a `var(--c-…)` reference or if a published override contains a `var()`.

Press **`Ctrl+Shift+Alt+G`** to open the colour panel:

- one row per token: a colour well, a text field for the literal (`rgba(…)`, gradients, and so on),
  and a `↺` that drops that one override;
- a hotkey field, so the chord above is itself editable (it is validated, and a half-typed chord
  is refused rather than allowed to break the working one);
- a JSON surface holding the exact document the settings are stored as, with **Import** and
  **Copy config JSON**;
- **Restore default colours**, which empties every override at once.

A row always shows a concrete colour — the override, or the literal the stylesheet carries — and its
placeholder names the theme token that row would follow if left alone. **An untouched token follows
the DSH theme; an edited token is pinned to your colour in both themes**; `↺`, a cleared field, or
**Restore** is how a token goes back to following the theme.

Storage is `localStorage` under `dsh-client-ui-gpt-helper:config:v1` (and `…:fast:v1` for the fast
lock), because a browser bundle cannot touch a file on disk. The JSON surface exists so that the
same document can live in a file you keep: copy it out, edit it, paste it back. Values are
validated on the way in **and** on the way out of storage — a hand-edited blob cannot close a
declaration and inject CSS.

The tokens, in panel order: `trigger.bolt`, `trigger.model`, `trigger.level`, `trigger.levelMax`,
`trigger.caret`, `trigger.lockMark`, `menu.bolt`, `menu.boltLit`, `menu.level`, `menu.levelMax`,
`menu.levelGrad`, `menu.quota`, `menu.quotaGrad`, `slider.track`, `slider.fill`, `slider.fillGrad`,
`slider.thumb`, `slider.tick`, `slider.tickPast`, `slider.tickCurrent`, `slider.particle`,
`slider.particleGlow`, `slider.particleIdle`, `slider.particleIdleGlow`.

### Shipped themes

Two ready-made schemes live in `docs/`, each with all 24 tokens and validated contrast. Paste one
into the panel's JSON surface and press **Import**, or apply it from the console:

```js
// docs/theme-sunset.json — warm gold, for a dark app
localStorage.setItem('dsh-client-ui-gpt-helper:config:v1', JSON.stringify({
  version: 1, hotkey: 'Ctrl+Shift+Alt+G',
  colors: {
    'trigger.bolt': '#f0b429', 'trigger.model': '#e8e6e3', 'trigger.level': '#ffc857',
    'trigger.levelMax': '#ff8a5b', 'trigger.caret': '#9b948c', 'trigger.lockMark': '#ff6b6b',
    'menu.bolt': '#f0b429', 'menu.boltLit': '#ffc857', 'menu.level': '#ffc857',
    'menu.levelMax': '#ff9e64', 'menu.levelGrad': 'linear-gradient(90deg, #ffe08a, #ffb454 48%, #ff7a59)',
    'menu.quota': '#ff9e64', 'menu.quotaGrad': 'linear-gradient(90deg, #ffd166, #ff7a59)',
    'slider.track': '#3a332b', 'slider.fill': '#f0b429',
    'slider.fillGrad': 'linear-gradient(90deg, #ffe08a 0%, #ffc857 34%, #ff9e64 68%, #ff6b6b 100%)',
    'slider.thumb': '#fffaf0', 'slider.tick': '#5a5145',
    'slider.tickPast': 'rgba(48,36,20,.55)', 'slider.tickCurrent': 'rgba(48,36,20,.62)',
    'slider.particle': '#fff3d1', 'slider.particleGlow': 'rgba(255,214,120,.85)',
    'slider.particleIdle': '#ffd8a8', 'slider.particleIdleGlow': 'rgba(255,216,168,.35)'
  }
}));
location.reload();
```

`docs/theme-neon.json` is the other one — cyan-to-magenta, for maximum separation from the shipped
blue. Both were measured with the same luminance maths as
[Why the accents are those accents](#why-the-accents-are-those-accents); the ticks are the token
worth re-checking when you invent a scheme, because they sit on the FILL, not on the popover: a
light tick disappears into a pale fill.

### Why the accents are those accents

Six tokens differ between the shipped dark and light values — the four trigger accents plus the
caret and the lock badge — because the trigger sits on the composer, which is light in the light
theme. The other accents have no theme pair, and they are tuned for the surface they are drawn on:
**that surface is the same in both themes**, because the popover is a dark translucent layer over
whatever is behind it. White text is therefore correct in both, while a mid-tone accent that looks
fine on a white page is close to invisible on the popover. That was the readability report: the rail
and thumb are near-white and always readable, but the level blue and the model name under it were
not.

Measured contrast against the popover surface (WCAG relative luminance; 4.5 for body text, 3.0 for
large text and graphical objects):

| token | before | after |
| --- | --- | --- |
| `menu.level` | `#4e7fe9` — **3.73** | `#7fa8ff` — **6.03** |
| `menu.levelMax` | `#8b48f5` — **2.93** | `#b98cff` — **5.57** |
| `menu.quota` | `#9b4dea` — **3.13** | `#c08cff` — **5.69** |
| popover model name | `--dsw-alias-label-caption` | `#ffffff` — **14.16** |
| popover bolt (idle) | `--dsw-alias-label-secondary` | `#ffffff` — **14.16** |

`scripts/contrast.mjs` reprints this table from the token table in `lib/client.js`, which is how the
numbers above were produced rather than guessed.

## Implementation notes

These are the non-obvious things, kept because each one cost a debugging round.

### The particle ramp

The prototype had **no ramp**: it cross-faded a container whose particle cycles were already in
flight, and the level changed only the trail's width and gradient. Here a `--spin` intensity is
eased onto the slider node with `requestAnimationFrame` — up over ~600 ms, down over ~900 ms, so
extinguishing has the inertia of coasting — and it scales each particle's peak opacity through
the keyframes. At steady state `--spin` is 1, so the rendered opacities are exactly the
prototype's.

### The squircle trap

DSH's theme plugin injects, under `@supports (corner-shape: superellipse(1.5))`, a universal rule
over `*`, `:before` and `:after`:

```css
:root { --dsw-corner-shape: superellipse(1.5) }
*, :before, :after { corner-shape: var(--dsw-corner-shape) }
```

So **every rounded corner in the app is a superellipse, not a circular arc**. A
`border-radius: 50%` circle becomes a squircle — a rounded *square* — and pill ends deform. The
theme README states the rule: full-round shapes must pair `corner-shape: round` with their radius
in the owning stylesheet, which is why every shipped DSH component sheet carries that line beside
its radii.

Every full-round radius here — track, fill, trail, thumb, ticks, particles, streak particles, the
busy spinner and the slider's focus ring — pairs `corner-shape: round`. Decorative radii (menu,
trigger, rows, notes) deliberately do **not**, so they keep the theme's intended smoothing.

### The box-sizing reset

The prototype opens with `* { box-sizing: border-box }`. DSH does not set that globally — it
declares `box-sizing` per component — so without a reset the popover is sized by *content* width
and the track comes out ~22px wider than the prototype's 236px, shifting every level position.
The plugin scopes its own reset to its two subtrees.

### The clamped corner radius

`border-radius: 999px` is clamped by the box. On the ~13px fill the lowest level produces, the
browser scales every radius by `width / (radius sum)` and the cap comes out at ~6.4px instead of
12px; a squared-off cap then pokes past the 28px thumb by ~1.3px near the top and bottom. The fill
and trail therefore carry `min-width: 24px`, so the cap is always a true semicircle. The extra
width sits under the thumb and changes nothing else. Verified numerically: 12.87px → 1.31px
protrusion, 24px → fully covered.

### Dragging

The drag is driven from **window** `pointermove`/`pointerup`/`pointercancel` listeners filtered by
an active pointer id, as the prototype does, with the handler table held in a ref. Binding the
moves to the track instead drops the gesture the moment the pointer leaves it, and lets a
re-render land a stale `dragging: false` closure mid-drag — together those made a rightward drag
die. The visuals follow the pointer continuously; only the nearest level is committed on release.

### Scrolling

Like the prototype, the popover is *not* a scroll container — it grows with its content, bounded
only by `max-height` — and the model list is the single scrolling region. This matters: giving the
whole body `overflow-y: auto` also computes `overflow-x` to `auto`, so any sub-pixel overflow
grows scrollbars on both edges. The list region pins `overflow-x: hidden`.

### One gradient, not two

A deliberate deviation. The prototype declares a **second** top-level gradient for fast-mode-off
(`#3941c4 → #a987ff → #7d57eb`) after the first, so the track jumps colour the instant the bolt is
toggled. This plugin uses the fast-mode gradient for both states, leaving fast mode to change only
the particles and the trail's opacity.

## What it reads

From the shared directory snapshot: `current` (`provider`/`model`/`reasoningEffort`), `groups`
(`[{ id, name, models: [{ id, name, reasoning }] }]`), `status`, `pending`, `error`,
`retainedEffort`. From `reasoning`: `defaultEffort` and `efforts` (`[{ id, name }]`). Submission is
`directory.select({ provider, model, reasoningEffort? })`, which forwards to the host through
`sessions.selectModel`.

## Development

```sh
npm run validate          # or: node scripts/validate-plugin.mjs .
npm run selfcheck         # or: node scripts/selfcheck.mjs
npm run contrast          # or: node scripts/contrast.mjs
npm run loadcheck         # or: node scripts/loadcheck.mjs
```

The validator is read-only and asserts the contract the client module system relies on: the
`dsh.client` declaration, the `exports` map, the `__ModuleLoader__` wrapper, that the factory `id`
equals the package name, that the CSS template literal contains no stray backtick or `${`, and
that every `t('key')` the component uses exists in both locale dictionaries.

`selfcheck.mjs` covers what the validator cannot: the colour table, the hotkey parser, the published
overrides and the two stores. The bundle's factory needs a browser, a cordis context and a live model
directory, so the check cuts the factory body out of `lib/client.js` verbatim, evaluates it against
a small React-and-DOM stub, and then exercises the real functions and renders the real components.
It asserts, among other things, that the stylesheet never reads a colour through a `var()`, that a
declaration-escape attempt is refused, and that a hold locks fast mode while a click cannot unlock it.

`contrast.mjs` reads the token table and prints each colour's WCAG contrast against the popover
surface, failing when anything drops under 3.0 there. It is how the accent values in
[Why the accents are those accents](#why-the-accents-are-those-accents) were chosen.

`loadcheck.mjs` loads the bundle **the way the app loads it** — as a classic script calling
`window.__ModuleLoader__.load`, then `factory(require)`, then `apply()` and one render — and reports
the stage that failed. That path is worth checking on its own because a failure there does not stay
in the plugin: the app logs `web boot: 1 entry did not activate` and restarts, so "did my edit keep
the bundle importable" is a question to answer before reloading the page, not after.

Client bundles are hot-reloaded: DSH's client-HMR polls each bundle's mtime and republishes it, so
editing `lib/client.js` reaches the running page within about a second. Changes to `package.json`
or the mount row need a page reload.

### The build marker, and why a crash here is not local

`lib/client.js` carries `const BUILD`, and the control writes it onto its root as `data-build`
beside a `console.info('[gpt-helper] client half applied — build …')`. The reason is that a
**browser cannot be asked what code it is running**: this control's markup is indistinguishable
between versions, so a page that loaded a stale module looks exactly like one that did not. Ask the
page instead:

```js
document.querySelector('[data-gpt-helper="root"]')?.dataset.build
```

Bump `BUILD` by hand whenever a change has to be confirmed in a running page.

Three traps, each of which cost a debugging round:

- **A render-time `ReferenceError` fails the whole web boot.** An extra element that referenced a
  constant defined elsewhere in the factory threw inside `ModelEffortControl`, and the app reported
  `web boot: 1 entry did not activate` in
  `%APPDATA%\@deepseek-ai\dsh-desktop\logs\crash-*-web-boot.log` and restarted. The slot entry has
  no error boundary of its own: it "fails loudly" by taking the boot with it. Keep anything new in
  the render path defined in the same scope, or pass it in.
- **HMR swaps the module under a live tree.** During the swap one more render can run against the
  outgoing module, so a `ReferenceError` and the new build's `applied` log line can appear together
  in one console dump. Read the LAST line, and hard-refresh (`Ctrl+Shift+R`) before believing any of
  it.
- **A crash log with an EMPTY renderer console is usually the editor, not the app.** Saving
  `lib/client.js` several times in a row means the HMR poll can read the file mid-write; the import
  then fails with nothing to report, and the log is left behind. Before investigating one, compare
  its timestamp with the file's mtime and run `npm run loadcheck`: if the current file loads, the log
  is a fossil. `data-build` and the log's own error level are what distinguish a real failure.

The consequence for anyone building on this: prefer a `data-` attribute over a new node when adding
a marker, and check the console after every edit rather than assuming the reload was clean.

## Repository layout

```
lib/index.js                    host half — an empty apply(), mirroring shipped client-only packages
lib/client.js                   browser half — styles, locale dictionaries, and the control
cordis.patch.yml                the bundle layer: the row that mounts the plugin
scripts/validate-plugin.mjs     structural validator (see Development)
scripts/selfcheck.mjs           behavioural check for the colours, the hotkey and the fast lock
scripts/contrast.mjs            WCAG contrast of the shipped palette on the popover surface
docs/chatgpt-pc-ui-prototype.html   the original design prototype
```

## Caveats

- This is a **UI replacement** for a slot DSH owns, taken over by priority. A future DSH release
  may change the slot's props or the shipped control's priority, in which case the selectors and
  the registration here need revisiting. The plugin fails loudly rather than silently: a broken
  slot entry reports `slot entry crashed in 'conversation.input.model'`.
- Fast mode is presentation only: DSH has no fast-mode concept, so the toggle and its lock change
  nothing but the animation. The lock persists the *toggle*, not any request behaviour.
- Colour settings live in `localStorage`, which is per browser profile rather than per DSH profile.
  A second window sees them, a second machine does not; move them with **Copy config JSON**.

## License

[MIT](LICENSE)

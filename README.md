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

It **replaces** the shipped composer control rather than sitting beside it, and it reuses that
control's data layer, so the `/model` command and the next request stay in sync.

## Requirements

- DeepSeek Harness with the Web client (the `desktop` profile or any profile mounting
  `@deepseek-ai/dsh-web-app`).
- No build step. The `lib/*.js` files are authored directly in the shipped bundle format, so
  cloning the repository is enough.

## Install

The plugin must be resolvable from a profile directory and mounted with one row.

**1. Link it into the profile** (so edits are picked up without reinstalling):

```sh
pnpm add link:/absolute/path/to/dsh-client-ui-gpt-helper --dir "$DSH_HOME/profiles/desktop"
```

**2. Mount it** by appending the row from
[`examples/cordis.patch.yml`](examples/cordis.patch.yml) to that profile's `cordis.patch.yml`:

```yaml
- insert:
    - id: gpt-helper
      name: dsh-client-ui-gpt-helper
```

The profile patch is watched, so DSH recomposes without a restart. To uninstall, delete the row
and run `pnpm remove dsh-client-ui-gpt-helper` in the profile directory.

<details>
<summary>Mounting without an install</summary>

A patch `insert` row may name a path instead of a package. `dsh` rewrites `./`-relative and
absolute names to file URLs anchored at the patch file:

```yaml
- insert:
    - id: gpt-helper
      name: './node_modules/dsh-client-ui-gpt-helper/lib/index.js'
```
</details>

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

**Trigger** — a bolt (only while fast mode is lit), the model name, the thinking level and a
caret; a spinner while a selection settles.

**Thinking pane** (default)

- *Header* — the 32×32 fast-mode bolt toggle, a status button showing the level over the model
  name that opens the model pane, and a reset button. The header is a `34px 1fr 34px` grid.
- *Slider* — level positions follow the prototype's rule: even fractions of the track clamped to
  the thumb's travel, `clamp(i/(n-1), .055, .945)`, which reproduces its
  `[.055, .25, .5, .75, .945]` exactly. Ticks are anchored to those same ratios rather than
  flex-distributed as in the prototype, whose interior ticks land up to ~7px away from the thumb
  positions they mark.
- *Colours* — the rail is `#e8e7e8` and the fill is solid `#5184f4`; a gradient appears only at
  the top level.
- *Particle trail* — 42 deterministic particles in a trail element sized to `--value`, so they
  are clipped to the filled pill. 18 of them are streaks. Every particle carries **two** complete
  geometries: the drifting trail and the in-place tremble shown at the top level with fast mode
  off, which is what makes those particles small slow dots instead of flat streaks.
- *Quota notice* — entering the top level briefly collapses the header and swaps the title for
  `更快消耗使用额度`, as the prototype does.

**Model pane** — a back button, search past four models, and the provider-grouped list with the
current model checked.

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
```

The validator is read-only and asserts the contract the client module system relies on: the
`dsh.client` declaration, the `exports` map, the `__ModuleLoader__` wrapper, that the factory `id`
equals the package name, that the CSS template literal contains no stray backtick or `${`, and
that every `t('key')` the component uses exists in both locale dictionaries.

Client bundles are hot-reloaded: DSH's client-HMR polls each bundle's mtime and republishes it, so
editing `lib/client.js` reaches the running page within about a second. Changes to `package.json`
or the mount row need a page reload.

## Repository layout

```
lib/index.js                    host half — an empty apply(), mirroring shipped client-only packages
lib/client.js                   browser half — styles, locale dictionaries, and the control
scripts/validate-plugin.mjs     structural validator (see Development)
examples/cordis.patch.yml       the mount row for a profile
docs/chatgpt-pc-ui-prototype.html   the original design prototype
```

## Caveats

- This is a **UI replacement** for a slot DSH owns, taken over by priority. A future DSH release
  may change the slot's props or the shipped control's priority, in which case the selectors and
  the registration here need revisiting. The plugin fails loudly rather than silently: a broken
  slot entry reports `slot entry crashed in 'conversation.input.model'`.
- Fast mode is presentation only and persists nothing.

## License

[MIT](LICENSE)

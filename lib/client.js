window.__ModuleLoader__.load({
  id: 'dsh-client-ui-gpt-helper',
  factory(require) {
    const React = require('react')
    const { createPortal } = require('react-dom')
    const h = React.createElement

    const NS = 'gpt-helper'

    /**
     * Build marker. Bump it whenever a change has to be confirmed in a running
     * page: it is logged on apply and written onto a `<data>` element, so
     * `document.querySelector('[data-gpt-helper="build"]').value` answers "did
     * the page actually load this file" without guessing.
     */
    const BUILD = '0.6.0+scheme-library'

    // ─────────────────────────────────────────────────────────────────────────
    // Configuration
    //
    // The control's colours are a documented token table so the appearance can be
    // changed without editing this file. Each token holds one literal, and the
    // stylesheet is GENERATED from the table (`buildCss`) with the user's overrides
    // substituted in. No colour ever travels through a CSS custom property or a
    // `var()`, because this app's Chromium drops a declaration whose value is only a
    // `var(…)`; see COLOR_TOKENS for the measurement that established it.
    //
    // Two halves share this table:
    //
    //  - `FAST_STORE` — the fast-mode switch and its lock. It is deliberately
    //    independent of the config: it is user state, not artwork.
    //  - `CONFIG_STORE` — the colour table and the panel hotkey, persisted to
    //    `localStorage` so it survives a reload, a new session, and a restart of
    //    the app.
    //
    // A browser bundle cannot read a file from disk, so "a config file" is
    // realised as JSON: the panel edits it live, and exports/imports the exact
    // same document through the clipboard.
    // ─────────────────────────────────────────────────────────────────────────

    /** localStorage keys. Namespaced per package, not per profile. */
    const CONFIG_KEY = 'dsh-client-ui-gpt-helper:config:v1'
    const FAST_KEY = 'dsh-client-ui-gpt-helper:fast:v1'

    /** How long the bolt must be held to toggle its lock (ms). */
    const LONG_PRESS_MS = 600

    /** Hotkey used when the configuration carries none. */
    const DEFAULT_HOTKEY = 'Ctrl+Shift+Alt+G'

    // One field per colour, in the order the panel lists them.
    //
    //  - `value` is the colour for the LIGHT UI and `dark` the one for the dark UI. Both
    //    are shipped defaults, so the control reads correctly out of the box whichever
    //    theme the app is in; a stored override replaces a token on BOTH sides, because
    //    the panel edits one value per token.
    //
    // **No colour may travel through a CSS custom property or a `var()` in this
    // plugin.** Measured on the running page, this app's Chromium drops ANY
    // declaration whose value is only a `var(…)` — with a fallback, without one,
    // defined variable or not — so a rule written `color: var(--c-trigger.level)`
    // arrives in the document as an empty declaration block. The stylesheet is
    // therefore BUILT with the resolved literals and injected whole (see
    // `buildCss`), which leaves no custom property in the path at all.
    //
    // Stored overrides are validated on the way in AND on the way out of storage,
    // so a hand-edited blob can never break out of the declaration it lands in.
    const COLOR_TOKENS = [
      // The trigger sits on the composer, which follows the theme: dark ink on the
      // light composer, near-white on the dark one. `#ffffff` here was the bug — the
      // model name was invisible on a light page.
      { key: 'trigger.bolt', group: 'trigger', value: '#585b60', dark: '#cfd3d6' },
      { key: 'trigger.model', group: 'trigger', value: '#242527', dark: '#ffffff' },
      { key: 'trigger.level', group: 'trigger', value: '#585b60', dark: '#cfd3d6' },
      { key: 'trigger.levelMax', group: 'trigger', value: '#8a48ea', dark: '#b98cff' },
      { key: 'trigger.caret', group: 'trigger', value: '#77797d', dark: '#9aa0a6' },
      { key: 'trigger.lockMark', group: 'trigger', value: '#4d7df4', dark: '#7fa8ff' },
      // The popover's surface is the same dark translucent layer in both themes, so its
      // own colours do not need a second set.
      { key: 'menu.bolt', group: 'menu', value: '#ffffff', dark: '#ffffff' },
      { key: 'menu.boltLit', group: 'menu', value: '#7fa8ff', dark: '#7fa8ff' },
      { key: 'menu.level', group: 'menu', value: '#7fa8ff', dark: '#7fa8ff' },
      { key: 'menu.levelMax', group: 'menu', value: '#b98cff', dark: '#b98cff' },
      {
        key: 'menu.levelGrad',
        group: 'menu',
        value: 'linear-gradient(90deg, #86a6ff, #a68dff 48%, #c78cff)',
        dark: 'linear-gradient(90deg, #86a6ff, #a68dff 48%, #c78cff)',
      },
      { key: 'menu.quota', group: 'menu', value: '#c08cff', dark: '#c08cff' },
      {
        key: 'menu.quotaGrad',
        group: 'menu',
        value: 'linear-gradient(90deg, #9d8bff, #d78bf0)',
        dark: 'linear-gradient(90deg, #9d8bff, #d78bf0)',
      },
      // The slider carries a light track in the light theme and a dark one in the dark
      // theme, so everything drawn on it needs both: a near-white thumb and white ticks
      // vanish into the LIGHT track, which is what the second report was about.
      { key: 'slider.track', group: 'slider', value: '#e8e7e8', dark: '#3a3a3e' },
      { key: 'slider.fill', group: 'slider', value: '#5184f4', dark: '#5184f4' },
      {
        key: 'slider.fillGrad',
        group: 'slider',
        value: 'linear-gradient(90deg, #536ae8 0%, #8178fa 42%, #7953e9 72%, #9b4ae7 100%)',
        dark: 'linear-gradient(90deg, #536ae8 0%, #8178fa 42%, #7953e9 72%, #9b4ae7 100%)',
      },
      { key: 'slider.thumb', group: 'slider', value: '#fdfdfe', dark: '#d7d9de' },
      { key: 'slider.tick', group: 'slider', value: '#8b8f96', dark: '#c9ccd2' },
      { key: 'slider.tickPast', group: 'slider', value: 'rgba(40,44,52,.42)', dark: 'rgba(255,255,255,.42)' },
      { key: 'slider.tickCurrent', group: 'slider', value: 'rgba(40,44,52,.5)', dark: 'rgba(255,255,255,.5)' },
      { key: 'slider.particle', group: 'slider', value: 'rgba(38,42,50,.9)', dark: 'rgba(255,255,255,.96)' },
      { key: 'slider.particleGlow', group: 'slider', value: 'rgba(38,42,50,.55)', dark: 'rgba(255,255,255,.7)' },
      { key: 'slider.particleIdle', group: 'slider', value: 'rgba(38,42,50,.8)', dark: 'rgba(255,255,255,.84)' },
      { key: 'slider.particleIdleGlow', group: 'slider', value: 'rgba(38,42,50,.22)', dark: 'rgba(255,255,255,.25)' },
    ].map((token) => ({
      ...token,
      field: token.value.startsWith('linear-gradient') ? 'text' : 'color',
    }))

    const TOKEN_KEYS = COLOR_TOKENS.map((token) => token.key)

    const TOKEN_BY_KEY = new Map(COLOR_TOKENS.map((token) => [token.key, token]))

    // Literal colours (hex, rgb[a], hsl[a], a CSS colour keyword) and linear
    // gradients. Everything else — including anything that could close a
    // declaration and inject a rule — is rejected, so the tokens a user can type
    // are exactly the shapes the shipped table contains.
    const COLOR_PATTERN =
      /^(?:#[0-9a-f]{3,8}|rgba?\(\s*[0-9.,%\s/]+\)|hsla?\(\s*[0-9.,%\s/]+\)|transparent|currentcolor|none|[a-z]{3,24}|linear-gradient\(\s*[0-9a-z%.,()\s#/-]*\s*\))$/i

    function safeColor(candidate) {
      if (typeof candidate !== 'string') return null
      const value = candidate.trim()
      return COLOR_PATTERN.test(value) ? value : null
    }

    /**
     * A partial override table: only the tokens the user actually set. An absent
     * token costs nothing — the stylesheet already carries that token's literal,
     * so "not overridden" and "overridden to its default" render identically.
     */
    function normalizeColors(input) {
      const colors = {}
      if (input === null || typeof input !== 'object') return colors
      for (const key of TOKEN_KEYS) {
        const value = safeColor(input[key])
        if (value !== null) colors[key] = value
      }
      // Keys the table no longer declares are dropped, so a stored document
      // written by an older version can never grow back a token.
      return colors
    }

    /** The two sides a scheme can be edited and rendered for. */
    const SIDES = ['light', 'dark']

    /** Name a scheme gets when its document never named one. */
    const UNNAMED = '未命名'

    /** An empty per-side override table. */
    function emptySides() {
      return { light: {}, dark: {} }
    }

    /** Both sides of a stored `sides` object, validated token by token. */
    function normalizeSides(input) {
      const source = input !== null && typeof input === 'object' ? input : {}
      return { light: normalizeColors(source.light), dark: normalizeColors(source.dark) }
    }

    /** A scheme name that is not taken in the library, by suffixing rather than refusing. */
    function freeSchemeName(schemes, wanted) {
      const base = String(wanted ?? '').trim() === '' ? UNNAMED : String(wanted).trim()
      if (schemes[base] === undefined) return base
      for (let index = 2; index < 1000; index += 1) {
        const candidate = `${base} (${index})`
        if (schemes[candidate] === undefined) return candidate
      }
      return `${base} (${Date.now()})`
    }

    function normalizeScheme(input) {
      const source = input !== null && typeof input === 'object' ? input : {}
      const name =
        typeof source.name === 'string' && source.name.trim() !== '' ? source.name.trim() : UNNAMED
      return { name, colors: normalizeColors(source.colors) }
    }

    /** The library: every named scheme, validated token by token. */
    function normalizeSchemes(input) {
      const schemes = {}
      if (input === null || typeof input !== 'object') return schemes
      for (const [name, scheme] of Object.entries(input)) {
        const clean = name.trim()
        if (clean === '') continue
        schemes[clean] = { ...normalizeScheme(scheme), name: clean }
      }
      return schemes
    }

    /** One active scheme name per side, or null. */
    function normalizeSlots(input) {
      const source = input !== null && typeof input === 'object' ? input : {}
      const slots = {}
      for (const entry of SIDES) {
        const name = source[entry]?.scheme
        slots[entry] = { scheme: typeof name === 'string' && name.trim() !== '' ? name : null }
      }
      return slots
    }

    /**
     * The scheme a side renders with, honouring `crossApply`.
     *
     * `crossApply` names one side whose colours are used for BOTH, which is the "use this
     * side for both" button. It deliberately does not clear either activation: turning it
     * off restores each side to its own scheme.
     */
    function schemeForSide(config, side) {
      const wanted = config.crossApply ?? side
      const name = config.slots?.[wanted]?.scheme
      return name === null || name === undefined ? undefined : config.schemes?.[name]
    }

    /** The scheme the panel edits for a side — its OWN activation, ignoring crossApply. */
    function editScheme(config, side) {
      const name = config.slots?.[side]?.scheme
      return name === null || name === undefined ? undefined : config.schemes?.[name]
    }

    /**
     * What a token shows on one side, in priority order.
     *
     *   1. the master switch is off  -> the shipped literal, library and activations kept
     *   2. that side's active scheme  -> its colour for this token
     *   3. that side's own override   -> the per-token tune-up from the panel
     *   4. otherwise                  -> the shipped literal for that side
     */
    function tokenValueFor(config, side, key) {
      const token = TOKEN_BY_KEY.get(key) ?? null
      if (token === null) return ''
      const shipped = side === 'dark' ? (token.dark ?? token.value) : token.value
      if (config.paused === true) return shipped
      // The per-token tune-up WINS over the scheme. It is what the panel row writes, so
      // the other order would let an active scheme silently swallow a colour the user
      // had just typed — the edit would appear to do nothing.
      return config.sides?.[side]?.[key] ?? schemeForSide(config, side)?.colors?.[key] ?? shipped
    }

    /** What the panel row shows and edits: the same resolution the sheet uses. */
    function tokenValue(config, side, key) {
      return tokenValueFor(config, side, key)
    }

    /** True when the side's own table sets this token, so a row knows it can be cleared. */
    function isTuned(config, side, key) {
      return config.sides?.[side]?.[key] !== undefined
    }

    // ── which side is showing ────────────────────────────────────────────────
    /**
     * The attribute this app puts on `<html>` to name the active theme. Measured on the
     * running page: `data-ds-theme-source="dark"`, alongside
     * `style="color-scheme: dark"`. This plugin named `data-dsw-theme` for a while,
     * which the app never sets, so the dark rules never matched.
     */
    const THEME_ATTRIBUTE = 'data-ds-theme-source'

    /**
     * Which side the app is showing, read from that attribute, then from the media query.
     *
     * The attribute is what the app actually sets, so it is the first answer; the media
     * query covers a page that carries no attribute at all. When neither says anything
     * the light side is assumed, which is the side the shipped stylesheet is written for.
     *
     * This only decides which override table the PANEL edits. The generated stylesheet
     * carries both sides either way, so a wrong answer here mis-targets the editor and
     * never the rendering.
     */
    function detectSide() {
      try {
        const value = document.documentElement?.getAttribute?.(THEME_ATTRIBUTE)
        const text = String(value ?? '').toLowerCase()
        if (text.includes('dark')) return 'dark'
        if (text.includes('light')) return 'light'
      } catch {
        // Fall through to the media query.
      }
      try {
        if (window.matchMedia?.('(prefers-color-scheme: dark)')?.matches === true) return 'dark'
      } catch {
        // Fall through to the default.
      }
      return 'light'
    }

    // ── hotkey ──────────────────────────────────────────────────────────────
    // Stored as `Ctrl+Shift+Alt+G`: modifiers in that spelling, then a
    // KeyboardEvent.code without its `Key`/`Digit` prefix. `readHotkey` reports
    // validity rather than repairing silently, so the panel can tell a user who
    // typed nonsense from one who typed a new chord.
    const HOTKEY_PATTERN = /^(?:(Ctrl|Alt|Shift|Meta)\+){1,4}[A-Z0-9]$/

    function readHotkey(candidate) {
      if (typeof candidate !== 'string') return { hotkey: DEFAULT_HOTKEY, valid: false }
      const parts = candidate
        .split('+')
        .map((part) => part.trim())
        .filter((part) => part !== '')
      if (parts.length < 2) return { hotkey: DEFAULT_HOTKEY, valid: false }
      const code = parts[parts.length - 1].toUpperCase()
      if (!/^[A-Z0-9]$/.test(code)) return { hotkey: DEFAULT_HOTKEY, valid: false }
      const mods = []
      for (const part of parts.slice(0, -1)) {
        const mod = part.toLowerCase()
        const canonical =
          mod === 'ctrl' || mod === 'control'
            ? 'Ctrl'
            : mod === 'alt'
              ? 'Alt'
              : mod === 'shift'
                ? 'Shift'
                : mod === 'meta' || mod === 'cmd'
                  ? 'Meta'
                  : null
        if (canonical === null) return { hotkey: DEFAULT_HOTKEY, valid: false }
        if (!mods.includes(canonical)) mods.push(canonical)
      }
      const hotkey = `${mods.join('+')}+${code}`
      return { hotkey, valid: HOTKEY_PATTERN.test(hotkey) }
    }

    function parseHotkey(binding) {
      const parts = readHotkey(binding).hotkey.split('+')
      const code = parts[parts.length - 1]
      const mods = parts.slice(0, -1)
      return {
        ctrl: mods.includes('Ctrl'),
        alt: mods.includes('Alt'),
        shift: mods.includes('Shift'),
        meta: mods.includes('Meta'),
        code: /^[0-9]$/.test(code) ? `Digit${code}` : `Key${code}`,
      }
    }

    // `event.code` is layout-independent and unaffected by AltGr rewriting
    // `event.key`, so the chord is matched on the code plus the exact modifier
    // set — a near miss must not fire.
    function hotkeyMatches(event, parsed) {
      return (
        event.ctrlKey === parsed.ctrl &&
        event.altKey === parsed.alt &&
        event.shiftKey === parsed.shift &&
        event.metaKey === parsed.meta &&
        event.code === parsed.code
      )
    }

    /**
     * The persisted document (version 3): the scheme library, one active scheme per side,
     * the master switch, the cross-side override, and a per-token tune-up table per side.
     *
     * Everything here is OPTIONAL state on top of the shipped palette: an empty document
     * renders the shipped appearance, which is what makes "restore defaults" a reset
     * rather than a second copy of the palette.
     */
    function defaultConfig() {
      return {
        version: 3,
        hotkey: DEFAULT_HOTKEY,
        paused: false,
        crossApply: null,
        slots: normalizeSlots({}),
        schemes: {},
        sides: emptySides(),
      }
    }

    /**
     * Reads a stored document.
     *
     * Version 1 kept ONE flat `colors` table and version 2 kept one per side; both applied
     * to every side they could reach. In both cases the overrides are carried forward as
     * the per-side tune-up tables, because that is what they did — dropping them, or
     * applying them to one side only, would change a user's palette the moment they
     * upgraded. The new fields are simply absent in an older document.
     */
    function normalizeConfig(input) {
      const source = input !== null && typeof input === 'object' ? input : {}
      const config = defaultConfig()
      config.hotkey = readHotkey(source.hotkey).hotkey
      config.paused = source.paused === true
      config.crossApply = SIDES.includes(source.crossApply) ? source.crossApply : null
      config.slots = normalizeSlots(source.slots)
      config.schemes = normalizeSchemes(source.schemes)

      if (source.sides !== undefined) {
        config.sides = normalizeSides(source.sides)
      } else {
        const flat = normalizeColors(source.colors)
        config.sides = { light: { ...flat }, dark: { ...flat } }
      }

      // An activation whose scheme the library no longer has cannot render; clearing it is
      // better than pinning the side to nothing, which would look like a broken palette.
      for (const side of SIDES) {
        const name = config.slots[side].scheme
        if (name !== null && config.schemes[name] === undefined) config.slots[side] = { scheme: null }
      }
      return config
    }

    /** The JSON a user edits and the library exports. */
    function configToDocument(config) {
      const document_ = {
        version: 3,
        hotkey: config.hotkey,
        paused: config.paused,
        crossApply: config.crossApply,
        slots: { light: { ...config.slots.light }, dark: { ...config.slots.dark } },
        schemes: {},
        sides: { light: { ...config.sides.light }, dark: { ...config.sides.dark } },
      }
      for (const [name, scheme] of Object.entries(config.schemes)) {
        document_.schemes[name] = { name: scheme.name, colors: { ...scheme.colors } }
      }
      return document_
    }

    /** One scheme as its own document, which is what the per-row export writes. */
    function schemeToDocument(scheme) {
      return { version: 1, name: scheme.name, colors: { ...scheme.colors } }
    }

    /**
     * Reads a pasted document: one scheme (`{ name, colors }`) or a library
     * (`{ schemes: { name: { colors } } }`). Returns the names it added, and any that were
     * renamed to avoid clobbering an existing scheme.
     */
    function importSchemes(config, input) {
      const source = input !== null && typeof input === 'object' ? input : null
      if (source === null) return { schemes: config.schemes, added: [], renamed: [] }

      const incoming = []
      if (source.schemes !== null && typeof source.schemes === 'object') {
        for (const [name, entry] of Object.entries(source.schemes)) {
          if (entry === null || typeof entry !== 'object') continue
          incoming.push({ name: typeof entry.name === 'string' && entry.name !== '' ? entry.name : name, entry })
        }
      } else if (source.colors !== null && typeof source.colors === 'object') {
        incoming.push({ name: typeof source.name === 'string' ? source.name : UNNAMED, entry: source })
      }

      const schemes = { ...config.schemes }
      const added = []
      const renamed = []
      for (const { name, entry } of incoming) {
        const colors = normalizeColors(entry.colors)
        if (Object.keys(colors).length === 0) continue
        const finalName = freeSchemeName(schemes, name)
        if (finalName !== String(name).trim()) renamed.push(`${name} -> ${finalName}`)
        schemes[finalName] = { name: finalName, colors }
        added.push(finalName)
      }
      return { schemes, added, renamed }
    }

    function readStorage(key) {
      try {
        return window.localStorage.getItem(key)
      } catch {
        // Storage can be unavailable (private mode, disabled). The session then
        // simply runs on defaults instead of failing to render.
        return null
      }
    }

    function writeStorage(key, value) {
      try {
        window.localStorage.setItem(key, value)
      } catch {
        // Same as above: nothing to persist, nothing to break.
      }
    }

    function readConfig() {
      const raw = readStorage(CONFIG_KEY)
      if (raw === null) return defaultConfig()
      try {
        return normalizeConfig(JSON.parse(raw))
      } catch {
        return defaultConfig()
      }
    }

    // ── stores ──────────────────────────────────────────────────────────────
    // Both are module singletons handed to `useSyncExternalStore`, so every
    // mounted control (one per open session) reads one shared source and a change
    // made in one is visible in the others immediately. Snapshots are replaced,
    // never mutated, which is what lets the hook compare them by identity.
    function createStore(initial, persist) {
      let snapshot = initial
      const listeners = new Set()
      const emit = () => {
        for (const listener of [...listeners]) listener()
      }
      return {
        subscribe(listener) {
          listeners.add(listener)
          return () => listeners.delete(listener)
        },
        getSnapshot() {
          return snapshot
        },
        replace(next) {
          snapshot = next
          if (persist !== undefined) persist(snapshot)
          emit()
        },
        update(fn) {
          this.replace(fn(snapshot))
        },
      }
    }

    const CONFIG_STORE = createStore(readConfig(), (config) => {
      writeStorage(CONFIG_KEY, JSON.stringify(configToDocument(config)))
    })

    function readFast() {
      const raw = readStorage(FAST_KEY)
      if (raw === null) return { fast: false, locked: false }
      try {
        const parsed = JSON.parse(raw)
        const locked = parsed?.locked === true
        return {
          // The lock's meaning is "fast mode stays on". Anything else would let
          // a hand-edited blob contradict the lock it stores.
          locked,
          fast: locked ? true : parsed?.fast === true,
        }
      } catch {
        return { fast: false, locked: false }
      }
    }

    const FAST_STORE = createStore(readFast(), (state) => {
      writeStorage(FAST_KEY, JSON.stringify(state))
    })

    /**
     * A fast-mode toggle that is blocked by the lock is a dead end, so the
     * gesture that made the lock must be able to release it without the pointer
     * ever reaching the button again: storage is re-read on `focus`/`pointerdown`
     * at the document, and the storage event covers a second window.
     */
    function rearmFastFromStorage() {
      const next = readFast()
      const current = FAST_STORE.getSnapshot()
      if (next.fast !== current.fast || next.locked !== current.locked) FAST_STORE.replace(next)
    }

    window.addEventListener('storage', (event) => {
      if (event.key === null || event.key === FAST_KEY) rearmFastFromStorage()
      if (event.key === null || event.key === CONFIG_KEY) CONFIG_STORE.replace(readConfig())
    })

    // ── theme application ───────────────────────────────────────────────────
    // One source of truth for colour: `buildCss` resolves the token table into the
    // stylesheet text below, and that text is rendered into the control's own
    // `<style>`. There is no custom property in the path and no second sheet —
    // see COLOR_TOKENS for the measurement that forced this.

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
    // `fast` / `ultra` classes. The menu surface keeps the host's `--dsw-alias-*`
    // tokens so the popover still belongs to DSH's theme; this control's own
    // colours are the token table's, resolved by `buildCss`.
    //
    // Each colour is written `var(--c-<token>)` as a MARKER, not as live CSS: the
    // markers are substituted with literals before the text reaches a `<style>`.
    // See COLOR_TOKENS for why a real `var()` cannot carry a colour here.
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Splits a stylesheet into its top-level statements, each kept whole.
     *
     * The generator needs COMPLETE rules, and this is why: an earlier version diffed the
     * template line by line and copied the lines that differed. A multi-line rule
     * (`color: …;\n  border-radius: …; }`) then contributed its first line only, leaving
     * the rest of the rule stranded — the browser parsed 118 rules out of 152 closing
     * braces and silently dropped the difference. Fragments of a rule are not a rule.
     */
    function cssStatements(css) {
      const statements = []
      let buffer = ''
      let depth = 0
      for (const char of css) {
        if (char === '{') depth += 1
        if (char === '}') depth -= 1
        buffer += char
        if (depth === 0 && (char === '}' || char === ';')) {
          if (buffer.trim() !== '') statements.push(buffer)
          buffer = ''
        }
      }
      if (buffer.trim() !== '') statements.push(buffer)
      return statements
    }

    /** Resolves every colour marker in a fragment for one side. */
    function resolveSide(text, config, side) {
      return text.replace(/var\((--c-[a-zA-Z0-9.]+)\)/g, (_whole, name) =>
        tokenValueFor(config, side, name.slice(4)),
      )
    }

    /**
     * The stylesheet text, with every colour already resolved for BOTH sides.
     *
     * The light values are inline, and a whole rule is re-declared under the dark scope
     * when any of its colours differ — so a theme that does not care about the theme adds
     * nothing, and a rule that does is never emitted in pieces. The dark scope is the
     * app's own theme attribute, matched by exact value, plus a
     * `@media (prefers-color-scheme: dark)` fallback for a page carrying no such
     * attribute.
     *
     * This string is what the control renders into its `<style>`, so a colour change
     * simply produces different text.
     */
    function buildCss(config) {
      const light = resolveSide(CSS_TEMPLATE, config, 'light')

      // Whole statements only, compared as statements rather than as lines.
      const overrides = []
      for (const statement of cssStatements(CSS_TEMPLATE)) {
        const asLight = resolveSide(statement, config, 'light')
        const asDark = resolveSide(statement, config, 'dark')
        if (asLight !== asDark) overrides.push(asDark.trim())
      }
      if (overrides.length === 0) return light

      const block = overrides.join('\n')
      const indented = block.replace(/\n/g, '\n  ')
      return (
        `${light}\n` +
        `html[${THEME_ATTRIBUTE}="dark"] {\n${block}\n}\n` +
        `@media (prefers-color-scheme: dark) {\n  html {\n${indented}\n  }\n}`
      )
    }

    const CSS_TEMPLATE = `
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
.gptm-root svg, .gptm-menu svg, .gptm-config svg { display: block; flex: none; }
.gptm-triggerBolt { display: none; flex: none; align-items: center; position: relative; color: var(--c-trigger.bolt); }
/* The lock badge: the bolt says fast mode is on, the badge says it cannot be
   turned off until the bolt is long-pressed again. */
.gptm-lockMark {
  position: absolute; right: -4px; bottom: -3px; color: var(--c-trigger.lockMark);
}
.gptm-trigger[data-fast="true"] .gptm-triggerBolt { display: flex; }
.gptm-triggerModel { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; color: var(--c-trigger.model); }
.gptm-triggerLevel { flex: none; color: var(--c-trigger.level); }
.gptm-trigger[data-ultra="true"] .gptm-triggerLevel { color: var(--c-trigger.levelMax); }
/* Locked: the level is replaced by the lock word, which is never "max". */
.gptm-trigger[data-locked="true"] .gptm-triggerLevel { color: var(--c-trigger.lockMark); }
.gptm-triggerCaret { flex: none; color: var(--c-trigger.caret); transition: transform 150ms cubic-bezier(.2,.8,.2,1); }
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
  border: 0; border-radius: 9px; color: var(--c-menu.bolt); background: transparent; cursor: pointer;
  transition: color 100ms ease-out, background-color 80ms ease-out, transform 80ms ease-out, opacity 100ms ease-out;
}
.gptm-iconBtn:hover:not(:disabled) { background: var(--dsw-alias-interactive-bg-hover); }
.gptm-iconBtn:active:not(:disabled) { transform: scale(.97); }
.gptm-iconBtn:disabled { opacity: .4; cursor: default; }
.gptm-menu[data-fast="true"] .gptm-fastToggle { color: var(--c-menu.boltLit); }
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
  max-width: 180px; overflow: hidden; color: var(--c-menu.level);
  /* 1.15 was tight enough to clip the descender of the bold level names: a bold
     "g" wants a little more than a 1.1em box, and the dotted i plus the tall
     ascender leave no room to borrow. 1.3 centres it in the same header. */
  padding: 1px 0;
  font-size: 14px; font-weight: 650; line-height: 1.3; white-space: nowrap; text-overflow: ellipsis;
  transition: opacity 90ms ease-out, color 120ms ease-out;
}
.gptm-menu[data-ultra="true"] .gptm-statusTitle {
  color: var(--c-trigger.levelMax);
  background: var(--c-menu.levelGrad);
  -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent;
}
.gptm-head[data-quota="true"] .gptm-statusTitle {
  max-width: none; color: var(--c-menu.quota); font-size: 13px; font-weight: 600;
  background: var(--c-menu.quotaGrad);
  -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent;
}
/* Locked fast mode borrows the quota treatment — a gradient text — because it
   says the same kind of thing: this state is not the ordinary one. The token is
   shared, so one edit recolours both. */
.gptm-head[data-locked="true"] .gptm-statusTitle {
  max-width: none; color: var(--c-menu.quota); font-size: 13px; font-weight: 600;
  background: var(--c-menu.quotaGrad);
  -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent;
}
.gptm-head[data-quota="true"] .gptm-statusTitle,
.gptm-head[data-locked="true"] .gptm-statusTitle { padding: 1px 10px; }
.gptm-statusModel {
  /* 1.1 left the descender of the model name (the "p" in DeepSeek) on the edge of
     the box for the same reason. */
  margin-top: 2px; color: var(--dsw-alias-label-primary, #fff);
  padding-bottom: 1px; font-size: 12px; line-height: 1.25; white-space: nowrap;
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
.gptm-track { width: 100%; overflow: hidden; background: var(--c-slider.track); box-shadow: inset 0 0 0 1px rgba(0,0,0,.025); }
/* min-width keeps the fill at least as wide as it is tall, so its cap stays a
   true 12px semicircle. A narrower box makes the browser scale the 999px radii
   down (the fill comes out ~6.4px), which squares the cap off just enough to
   poke past the 28px thumb at the lowest level — the blue sliver on the left.
   The extra width is hidden under the thumb, so nothing else changes. */
.gptm-fill { z-index: 1; width: var(--value); min-width: 24px; overflow: hidden; background: var(--c-slider.fill); }
/* Deliberate deviation from the prototype. It gives the top level a SECOND
   gradient for fast-mode-off — #3941c4 to #a987ff to #7d57eb — declared after
   the one below so it wins, which makes the track jump colour the moment the
   bolt is toggled. One gradient is used for both states instead, so fast mode
   changes only the particles and the trail's own opacity. */
.gptm-slider[data-ultra="true"] .gptm-fill {
  background: var(--c-slider.fillGrad);
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
  border: 0; border-radius: 50%; corner-shape: round; background: var(--c-slider.tick);
  transition: width 100ms ease-out, height 100ms ease-out, margin 100ms ease-out, background-color 100ms ease-out;
}
.gptm-tick[data-past="true"] { background: var(--c-slider.tickPast); }
.gptm-tick[data-current="true"] { width: 8px; height: 8px; margin: -4px 0 0 -4px; background: var(--c-slider.tickCurrent); }

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
  background: var(--c-slider.particle); box-shadow: 0 0 2.5px var(--c-slider.particleGlow);
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
  background: var(--c-slider.particleIdle);
  box-shadow: 0 0 1.5px var(--c-slider.particleIdleGlow);
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
  background: var(--c-slider.thumb);
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
.gptm-hint { padding: 6px 8px 0; color: var(--dsw-alias-label-caption); font-size: 11px; line-height: 15px; }
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

/* ── configuration panel ────────────────────────────────────────────────────
   Colour swatches, the hotkey, JSON import/export, and a restore. The layout is
   a CSS grid rather than fixed pixel offsets so a longer localized label wraps
   instead of pushing the swatch off the row (DSH ships at several font scales). */
.gptm-configBackdrop { position: fixed; inset: 0; z-index: 1200; background: rgba(0,0,0,.18); }
.gptm-config {
  position: fixed; z-index: 1201; display: flex; flex-direction: column;
  width: 400px; max-width: calc(100vw - 32px);
  max-height: min(560px, calc(100vh - 64px)); overflow: hidden;
  border: 1px solid var(--dsw-alias-border-l1); border-radius: 14px;
  background: var(--dsw-alias-bg-layer-1, var(--dsw-alias-bg-base));
  box-shadow: var(--dsw-elevation-prominent, 0 16px 42px rgba(0,0,0,.2));
  color: var(--dsw-alias-label-primary);
  font-size: 12px; line-height: 16px;
  animation: gptm-in 140ms cubic-bezier(.2,.8,.2,1);
}
.gptm-configHead {
  display: flex; align-items: center; justify-content: space-between; gap: 8px;
  flex: none; padding: 10px 10px 8px 14px; border-bottom: 1px solid var(--dsw-alias-border-l1);
}
.gptm-configHead strong { font-size: 13px; font-weight: 600; }
.gptm-configHead span { color: var(--dsw-alias-label-tertiary); font-size: 11px; }
.gptm-configClose {
  flex: none; width: 24px; height: 24px; border: 0; border-radius: 7px;
  background: transparent; color: var(--dsw-alias-label-secondary); cursor: pointer; font: inherit; line-height: 1;
}
.gptm-configClose:hover { background: var(--dsw-alias-interactive-bg-hover); }
.gptm-configBody { flex: 1 1 auto; min-height: 0; overflow-y: auto; overflow-x: hidden; padding: 8px 14px 12px; }
.gptm-configGroup { margin: 8px 0 4px; color: var(--dsw-alias-label-caption); font-size: 11px; font-weight: 600; letter-spacing: .03em; }
/* The side picker: which override table the rows below edit. */
.gptm-configSides { display: flex; align-items: center; flex-wrap: wrap; gap: 6px; margin: 2px 0 6px; }
.gptm-configSides .gptm-configGroup { margin: 0; }
.gptm-configSides .gptm-configBtn[data-active="true"] {
  border-color: var(--dsw-alias-state-business-primary);
  color: var(--dsw-alias-state-business-primary);
}
.gptm-configSideNow { margin-left: auto; color: var(--dsw-alias-label-caption); font-size: 11px; }
.gptm-configRow { display: grid; grid-template-columns: minmax(0,1fr) 30px minmax(0,100px) 20px; align-items: center; gap: 8px; padding: 3px 0; }
.gptm-configRow[data-field="text"] { grid-template-columns: minmax(0,1fr) 20px; }
.gptm-configRow[data-field="text"] .gptm-configText { grid-column: 1; }
.gptm-configClear {
  width: 20px; height: 20px; padding: 0; border: 0; border-radius: 6px;
  background: transparent; color: var(--dsw-alias-label-caption); cursor: pointer; font: inherit; line-height: 1;
}
.gptm-configClear:hover { background: var(--dsw-alias-interactive-bg-hover); color: var(--dsw-alias-label-primary); }
.gptm-configClear:disabled { opacity: .35; cursor: default; }
.gptm-configLabel { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--dsw-alias-label-secondary); }
.gptm-configSwatch {
  width: 30px; height: 22px; padding: 0; border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 6px; background: transparent; cursor: pointer;
}
.gptm-configInput {
  width: 100%; min-width: 0; padding: 4px 6px; border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 6px; background: var(--dsw-alias-bg-base); outline: none;
  color: var(--dsw-alias-label-primary); font: inherit; font-size: 11px;
}
.gptm-configInput:focus { border-color: var(--dsw-alias-state-business-primary); }
.gptm-configHint { margin: 4px 0 2px; color: var(--dsw-alias-label-tertiary); font-size: 11px; line-height: 15px; }
.gptm-configText {
  width: 100%; min-height: 88px; padding: 6px 8px; border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 7px; background: var(--dsw-alias-bg-base); outline: none;
  color: var(--dsw-alias-label-primary); font: inherit; font-size: 11px; line-height: 15px;
  resize: vertical; font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
}
.gptm-configFoot { flex: none; display: flex; flex-wrap: wrap; gap: 6px; padding: 9px 14px 11px; border-top: 1px solid var(--dsw-alias-border-l1); }
.gptm-configBtn {
  padding: 5px 9px; border: 1px solid var(--dsw-alias-border-l2); border-radius: 7px;
  background: transparent; color: var(--dsw-alias-label-primary); font: inherit; font-size: 11px; cursor: pointer;
}
.gptm-configBtn:hover:not(:disabled) { background: var(--dsw-alias-interactive-bg-hover); }
.gptm-configBtn:disabled { opacity: .5; cursor: default; }
.gptm-configBtn[data-tone="danger"] { color: var(--dsw-alias-state-error-primary); }
.gptm-configBtn[data-tone="primary"] { border-color: transparent; background: var(--dsw-alias-state-business-primary); color: #fff; }
.gptm-configNotice { flex: none; padding: 0 14px 9px; color: var(--dsw-alias-state-business-primary); font-size: 11px; }
.gptm-configNotice[data-tone="error"] { color: var(--dsw-alias-state-error-primary); }
.gptm-configHotkey {
  display: flex; align-items: center; gap: 8px; margin: 4px 0 6px;
  color: var(--dsw-alias-label-secondary);
}
.gptm-configHotkey .gptm-configInput { width: 132px; }

/* The style element below the one this sheet is written into — see buildCss. */
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
      'fast.locked': '快速模式已锁定',
      'fast.lockHint': '长按闪电锁定／解锁快速模式',
      'config.title': '控件配色',
      'config.section.trigger': '触发栏',
      'config.section.menu': '弹层',
      'config.section.slider': '滑块',
      'config.hint': '改动即时生效并保存在本机浏览器。未改动的项跟随深浅色主题；改过的项固定为你选的颜色。清空输入框或点 ↺ 可恢复跟随主题。',
      'config.hotkey': '打开本面板的快捷键',
      'config.textMode': '渐变',
      'config.rowReset': '恢复此项默认',
      'config.reset': '恢复默认配色',
      'config.copy': '复制配置 JSON',
      'config.import': '导入',
      'config.close': '关闭',
      'config.saved': '已保存',
      'config.copied': '已复制到剪贴板',
      'config.invalid': '无效的颜色或快捷键，已回退为默认值',
      'config.importFail': '导入失败：JSON 解析错误',
      'config.resetDone': '已恢复默认配色',
      'config.editTarget': '编辑哪一侧',
      'config.side.light': '浅色',
      'config.side.dark': '深色',
      'config.showing': '当前界面',
      'config.activated': '已激活',
      'config.cleared': '已清除',
      'config.needName': '先给配色起个名字',
      'config.imported': '已导入',
      'config.importEmpty': '没有可导入的方案',
      'config.renamed': '已改名',
      'config.enabled': '启用自定义配色',
      'config.library': '配色库',
      'config.libraryEmpty': '还没有保存过配色。改完颜色在下面命名保存即可。',
      'config.saveAs': '方案名称',
      'config.save': '另存为',
      'config.useLight': '用于浅色',
      'config.useDark': '用于深色',
      'config.useBoth': '两侧都用',
      'config.rename': '重命名',
      'config.deleteScheme': '删除这个方案',
      'config.crossOn': '用这一侧覆盖两侧',
      'config.crossOff': '取消覆盖',
      'config.clearSide': '这一侧用默认',
      'config.schemeJson': '配色库 JSON',
      'config.schemeJsonHint': '只含配色方案，不含快捷键与激活状态。可导入单个方案或整库。',
      'config.exportAll': '导出整库',
      'config.exportOne': '导出',
      'config.importSchemes': '导入到配色库',
      'config.sideDefault': '随包默认',
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
      'fast.locked': 'Fast mode locked',
      'fast.lockHint': 'Long-press the bolt to lock / unlock fast mode',
      'config.title': 'Control colours',
      'config.section.trigger': 'Trigger',
      'config.section.menu': 'Popover',
      'config.section.slider': 'Slider',
      'config.hint': 'Edits apply at once and are stored in this browser. Untouched tokens keep following the light/dark theme; an edited token is pinned to your colour. Empty a field or press ↺ to follow the theme again.',
      'config.hotkey': 'Hotkey that opens this panel',
      'config.textMode': 'Gradient',
      'config.rowReset': 'Reset this token',
      'config.reset': 'Restore default colours',
      'config.copy': 'Copy config JSON',
      'config.import': 'Import',
      'config.close': 'Close',
      'config.saved': 'Saved',
      'config.copied': 'Copied to the clipboard',
      'config.invalid': 'Invalid colour or hotkey — fell back to the default',
      'config.importFail': 'Import failed: the JSON did not parse',
      'config.resetDone': 'Default colours restored',
      'config.editTarget': 'Editing',
      'config.side.light': 'light',
      'config.side.dark': 'dark',
      'config.showing': 'Showing',
      'config.activated': 'Activated',
      'config.cleared': 'Cleared',
      'config.needName': 'Name the scheme first',
      'config.imported': 'Imported',
      'config.importEmpty': 'Nothing to import',
      'config.renamed': 'renamed',
      'config.enabled': 'Custom colours enabled',
      'config.library': 'Scheme library',
      'config.libraryEmpty': 'Nothing saved yet. Name the colours below to keep them.',
      'config.saveAs': 'Scheme name',
      'config.save': 'Save as',
      'config.useLight': 'For light',
      'config.useDark': 'For dark',
      'config.useBoth': 'Both sides',
      'config.rename': 'Rename',
      'config.deleteScheme': 'Delete this scheme',
      'config.crossOn': 'Apply to both sides',
      'config.crossOff': 'Stop applying to both',
      'config.clearSide': 'Use the default here',
      'config.schemeJson': 'Library JSON',
      'config.schemeJsonHint': 'Schemes only — no hotkey, no activations. Import one or all of them.',
      'config.exportAll': 'Export all',
      'config.exportOne': 'Export',
      'config.importSchemes': 'Import into the library',
      'config.sideDefault': 'shipped default',
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

    // ── lock icons ──────────────────────────────────────────────────────────
    // Two drawings for two jobs. `LockMark` is a badge that rides the corner of a
    // bolt that is already on screen; `LockIcon` replaces the bolt outright.

    /** Lock badge: a small lock drawn over a disc, so it stays legible over a lit bolt. */
    function LockMark({ size = 10 }) {
      return h(
        'svg',
        {
          className: 'gptm-lockMark',
          width: size,
          height: size,
          viewBox: '0 0 16 16',
          fill: 'none',
          'aria-hidden': true,
        },
        h('circle', { cx: 8, cy: 8, r: 8, fill: 'currentColor', opacity: 0.16 }),
        h('rect', {
          x: 3.6,
          y: 7.2,
          width: 8.8,
          height: 5.9,
          rx: 1.6,
          fill: 'currentColor',
        }),
        h('path', {
          d: 'M5.7 7.2V5.4a2.3 2.3 0 0 1 4.6 0v1.8',
          stroke: 'currentColor',
          strokeWidth: 1.6,
          strokeLinecap: 'round',
        }),
      )
    }

    /** Standalone lock, for the popover toggle while the lock is held. */
    function LockIcon({ size = 18 }) {
      return h(
        'svg',
        {
          width: size,
          height: size,
          viewBox: '0 0 16 16',
          fill: 'none',
          'aria-hidden': true,
        },
        h('rect', {
          x: 3.2,
          y: 7,
          width: 9.6,
          height: 6.8,
          rx: 1.8,
          stroke: 'currentColor',
          strokeWidth: 1.6,
        }),
        h('path', {
          d: 'M5.5 7V5.2a2.5 2.5 0 0 1 5 0V7',
          stroke: 'currentColor',
          strokeWidth: 1.6,
          strokeLinecap: 'round',
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

    // ── configuration panel ─────────────────────────────────────────────────

    /**
     * Panel visibility. Deliberately NOT persisted: a colour panel that reopens
     * itself after a reload would be in the way of the control it edits.
     */
    const PANEL_STORE = createStore({ open: false })

    /** Panel-visible copy of the hotkey, so a half-typed chord is not normalized away. */
    function hotkeyDraftFrom(config) {
      return config.hotkey
    }

    /** `#rgb`/`#rrggbb`/`#rrggbbaa` for the native colour well; anything else keeps the fallback. */
    function toHexColor(value, fallback) {
      if (typeof value !== 'string') return fallback
      const raw = value.trim()
      if (/^#[0-9a-f]{6}$/i.test(raw)) return raw
      if (/^#[0-9a-f]{3}$/i.test(raw)) {
        return `#${raw[1]}${raw[1]}${raw[2]}${raw[2]}${raw[3]}${raw[3]}`
      }
      if (/^#[0-9a-f]{8}$/i.test(raw)) return raw.slice(0, 7)
      const rgb = /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/i.exec(raw)
      if (rgb !== null) {
        const hex = (part) => Number(part).toString(16).padStart(2, '0')
        return `#${hex(rgb[1])}${hex(rgb[2])}${hex(rgb[3])}`
      }
      return fallback
    }

    /**
     * Colour configuration panel: one row per token, the panel hotkey, JSON
     * import/export, and a restore. It is a portal like the popover, styled with
     * the host's theme tokens so it belongs to DSH while editing the control's
     * own artwork tokens.
     */
    function ConfigPanel({ t }) {
      const config = React.useSyncExternalStore(
        (fn) => CONFIG_STORE.subscribe(fn),
        () => CONFIG_STORE.getSnapshot(),
      )
      const [draft, setDraft] = React.useState('')
      const [hotkeyDraft, setHotkeyDraft] = React.useState(config.hotkey)
      const [notice, setNotice] = React.useState(null)
      const noticeTimer = React.useRef(0)
      // Which side the rows edit. It starts on the side the app is showing, so the panel
      // opens editing what the user is looking at, and the buttons above the rows pin it.
      const [side, setSide] = React.useState(() => detectSide())
      // A name for "save these colours as a scheme", and the paste box for importing
      // schemes. Both are panel-local: neither is part of the stored document.
      const [nameDraft, setNameDraft] = React.useState('')
      const [schemeDraft, setSchemeDraft] = React.useState('')

      // The textarea follows the store: it is seeded on mount and re-seeded after
      // an import or a restore, which are the two moments the document changes
      // from underneath it. Typing in the rows does not retarget it.
      const refill = React.useCallback((next) => {
        setDraft(JSON.stringify(configToDocument(next), null, 2))
      }, [])

      React.useEffect(() => {
        refill(CONFIG_STORE.getSnapshot())
      }, [refill])

      // An import or a restore rewrites the hotkey too; the field follows the
      // store, and because every keystroke writes back what it normalized to,
      // this never fights typing.
      React.useEffect(() => {
        setHotkeyDraft(config.hotkey)
      }, [config.hotkey])

      React.useEffect(() => () => clearTimeout(noticeTimer.current), [])

      const say = (message, tone) => {
        setNotice({ message, tone: tone ?? 'ok' })
        clearTimeout(noticeTimer.current)
        noticeTimer.current = setTimeout(() => setNotice(null), 2600)
      }

      /** Mutates a copy of the config. Every write goes through here. */
      const patch = (mutate) =>
        CONFIG_STORE.update((current) =>
          mutate({
            ...current,
            sides: { light: { ...current.sides.light }, dark: { ...current.sides.dark } },
          }),
        )

      const setColor = (key, value) => {
        // An empty field is how a token goes back to following its side's shipped
        // literal: this side's override is dropped and the stylesheet's default for that
        // side takes over.
        if (value.trim() === '') {
          patch((next) => {
            delete next.sides[side][key]
            return next
          })
          return
        }
        const safe = safeColor(value)
        patch((next) => {
          // An unparseable value is refused outright rather than replaced: the
          // row keeps showing what was typed so it can be corrected, and the
          // stylesheet keeps the previous value in the meantime.
          if (safe === null) return next
          next.sides[side][key] = safe
          return next
        })
      }

      const setHotkey = (value) => {
        setHotkeyDraft(value)
        const parsed = readHotkey(value)
        if (!parsed.valid) {
          // Nothing is written: a half-typed chord must not throw away the one
          // that still works. The field keeps what was typed so it can be fixed.
          if (value.trim() !== '') say(t('config.invalid'), 'error')
          return
        }
        patch((next) => {
          next.hotkey = parsed.hotkey
          return next
        })
      }

      const restore = () => {
        const fresh = defaultConfig()
        CONFIG_STORE.replace(fresh)
        refill(fresh)
        say(t('config.resetDone'))
      }

      /** Copies text, falling back to a hidden textarea when the clipboard is refused. */
      const copyText = (text, done) => {
        const fallback = () => {
          const area = document.createElement('textarea')
          area.value = text
          area.setAttribute('readonly', 'readonly')
          area.style.position = 'fixed'
          area.style.opacity = '0'
          document.body.appendChild(area)
          area.select()
          try {
            document.execCommand('copy')
          } catch {
            // Nothing else to try; the textarea stays visible to the user.
          }
          document.body.removeChild(area)
        }
        if (navigator.clipboard?.writeText !== undefined) {
          navigator.clipboard.writeText(text).then(done, () => {
            fallback()
            done()
          })
        } else {
          fallback()
          done()
        }
      }

      const copy = () => {
        // Export is always the stored document, which is exactly what the import
        // reads back, so a round trip through a text file loses nothing. The
        // textarea is only an editing surface for the import.
        copyText(JSON.stringify(configToDocument(CONFIG_STORE.getSnapshot()), null, 2), () =>
          say(t('config.copied')),
        )
      }

      const importDraft = () => {
        let parsed = null
        try {
          parsed = JSON.parse(draft)
        } catch {
          say(t('config.importFail'), 'error')
          return
        }
        CONFIG_STORE.replace(normalizeConfig(parsed))
        refill(CONFIG_STORE.getSnapshot())
        say(t('config.saved'))
      }

      // ── the scheme library ──────────────────────────────────────────────────
      const setPaused = (next) => patch((draft_) => ({ ...draft_, paused: next }))

      /** Activates a scheme on one side; null clears that side. */
      const activate = (entry, name) => {
        patch((draft_) => ({
          ...draft_,
          slots: { ...draft_.slots, [entry]: { scheme: name } },
          // Activating a scheme clears that side's per-token tune-ups: they were made
          // against a different palette, and a tune-up wins over the scheme, so leaving
          // them would let a stray tweak from the previous scheme override the new one.
          sides: { ...draft_.sides, [entry]: {} },
        }))
        say(name === null ? t('config.cleared') : `${t('config.activated')}: ${name}`)
      }

      /** Lends one side's colours to both, without clearing either activation. */
      const toggleCrossApply = (entry) =>
        patch((draft_) => ({ ...draft_, crossApply: draft_.crossApply === entry ? null : entry }))

      /** Stores the side's current colours under a name of its own. */
      const saveAs = () => {
        const name = nameDraft.trim()
        if (name === '') {
          say(t('config.needName'), 'error')
          return
        }
        patch((draft_) => {
          // The library keeps the side's EFFECTIVE colours, so a scheme is a complete
          // palette rather than a patch on top of whatever happened to be active.
          const colors = {}
          for (const token of COLOR_TOKENS) colors[token.key] = tokenValueFor(draft_, side, token.key)
          const finalName = freeSchemeName(draft_.schemes, name)
          return {
            ...draft_,
            schemes: { ...draft_.schemes, [finalName]: { name: finalName, colors } },
            slots: { ...draft_.slots, [side]: { scheme: finalName } },
          }
        })
        setNameDraft('')
        say(t('config.saved'))
      }

      const renameScheme = (from, to) => {
        const name = String(to ?? '').trim()
        if (name === '' || name === from) return
        patch((draft_) => {
          if (draft_.schemes[name] !== undefined) return draft_
          const schemes = { ...draft_.schemes }
          schemes[name] = { ...schemes[from], name }
          delete schemes[from]
          const slots = {}
          for (const entry of SIDES) {
            slots[entry] = {
              scheme: draft_.slots[entry].scheme === from ? name : draft_.slots[entry].scheme,
            }
          }
          return { ...draft_, schemes, slots }
        })
      }

      const removeScheme = (name) => {
        patch((draft_) => {
          const schemes = { ...draft_.schemes }
          delete schemes[name]
          const slots = {}
          for (const entry of SIDES) {
            slots[entry] = { scheme: draft_.slots[entry].scheme === name ? null : draft_.slots[entry].scheme }
          }
          return { ...draft_, schemes, slots }
        })
      }

      /** Reads the paste box into the library, leaving the activations alone. */
      const importSchemesFromDraft = () => {
        let parsed = null
        try {
          parsed = JSON.parse(schemeDraft)
        } catch {
          say(t('config.importFail'), 'error')
          return
        }
        const result = importSchemes(CONFIG_STORE.getSnapshot(), parsed)
        if (result.added.length === 0) {
          say(t('config.importEmpty'), 'error')
          return
        }
        patch((draft_) => ({ ...draft_, schemes: result.schemes }))
        setSchemeDraft('')
        say(
          result.renamed.length === 0
            ? `${t('config.imported')}: ${result.added.join(', ')}`
            : `${t('config.imported')}: ${result.added.join(', ')} · ${t('config.renamed')}: ${result.renamed.join(', ')}`,
        )
      }

      /** Copies the library, or one scheme, as JSON. */
      const exportSchemes = (only) => {
        const schemes = {}
        for (const [name, scheme] of Object.entries(config.schemes)) {
          if (only !== undefined && name !== only) continue
          schemes[name] = schemeToDocument(scheme)
        }
        const payload =
          only === undefined
            ? { version: 1, schemes }
            : (schemes[only] ?? schemeToDocument({ name: only, colors: {} }))
        copyText(JSON.stringify(payload, null, 2), () => say(t('config.copied')))
      }

      // ── the side picker ─────────────────────────────────────────────────────
      // Each side keeps its own overrides, so this is what says which table the rows
      // below edit. It opens on the side the app is showing.
      const sideBar = h(
        'div',
        { key: 'sideBar', className: 'gptm-configSides' },
        h('span', { className: 'gptm-configGroup' }, t('config.editTarget')),
        ...SIDES.map((entry) =>
          h(
            'button',
            {
              key: entry,
              type: 'button',
              className: 'gptm-configBtn',
              'data-active': side === entry ? 'true' : 'false',
              'aria-pressed': side === entry ? 'true' : 'false',
              onClick: () => setSide(entry),
            },
            t(`config.side.${entry}`),
          ),
        ),
        h(
          'span',
          { className: 'gptm-configSideNow' },
          `${t('config.showing')}: ${t(`config.side.${detectSide()}`)}`,
        ),
      )

      // ── the master switch and the two sides ──────────────────────────────────
      // The switch is the whole palette's power: off renders the shipped colours while
      // keeping the library and both activations, so it is a pause and not a reset.
      const head = h(
        'div',
        { key: 'master', className: 'gptm-configMaster' },
        h(
          'label',
          { className: 'gptm-configSwitch' },
          h('input', {
            type: 'checkbox',
            checked: config.paused !== true,
            onChange: (event) => setPaused(event.target.checked === false),
          }),
          h('span', null, t('config.enabled')),
        ),
      )

      const sideRows = SIDES.map((entry) => {
        const activeName = config.slots[entry].scheme
        const label = activeName === null ? t('config.sideDefault') : activeName
        return h(
          'div',
          { key: `side:${entry}`, className: 'gptm-configSide', 'data-active': side === entry },
          h(
            'button',
            {
              type: 'button',
              className: 'gptm-configSideName',
              title: t('config.editTarget'),
              onClick: () => setSide(entry),
            },
            `${t(`config.side.${entry}`)}: ${label}`,
          ),
          h(
            'button',
            {
              type: 'button',
              className: 'gptm-configBtn',
              disabled: activeName === null,
              title: config.crossApply === entry ? t('config.crossOff') : t('config.crossOn'),
              onClick: () => toggleCrossApply(entry),
            },
            config.crossApply === entry ? t('config.crossOff') : t('config.crossOn'),
          ),
          h(
            'button',
            {
              type: 'button',
              className: 'gptm-configBtn',
              disabled: activeName === null,
              onClick: () => activate(entry, null),
            },
            t('config.clearSide'),
          ),
        )
      })

      // ── the library ─────────────────────────────────────────────────────────
      const names = Object.keys(config.schemes).sort()
      const library = [
        h('div', { key: 'libHead', className: 'gptm-configGroup' }, t('config.library')),
      ]
      if (names.length === 0) {
        library.push(h('div', { key: 'libEmpty', className: 'gptm-configHint' }, t('config.libraryEmpty')))
      }
      for (const name of names) {
        const used = SIDES.filter((entry) => config.slots[entry].scheme === name)
        library.push(
          h(
            'div',
            { key: `lib:${name}`, className: 'gptm-configLib' },
            h('span', { className: 'gptm-configLibName', title: name }, name),
            h(
              'span',
              { className: 'gptm-configLibMeta' },
              used.length === 0 ? '' : used.map((entry) => t(`config.side.${entry}`)).join('/'),
            ),
            h(
              'button',
              { type: 'button', className: 'gptm-configBtn', onClick: () => activate('light', name) },
              t('config.useLight'),
            ),
            h(
              'button',
              { type: 'button', className: 'gptm-configBtn', onClick: () => activate('dark', name) },
              t('config.useDark'),
            ),
            h(
              'button',
              {
                type: 'button',
                className: 'gptm-configBtn',
                onClick: () =>
                  patch((draft_) => ({
                    ...draft_,
                    slots: { light: { scheme: name }, dark: { scheme: name } },
                    sides: { light: {}, dark: {} },
                  })),
              },
              t('config.useBoth'),
            ),
            h(
              'button',
              {
                type: 'button',
                className: 'gptm-configBtn',
                title: t('config.exportOne'),
                onClick: () => exportSchemes(name),
              },
              t('config.exportOne'),
            ),
            h(
              'button',
              {
                type: 'button',
                className: 'gptm-configBtn',
                title: t('config.rename'),
                onClick: () => {
                  const to = window.prompt(t('config.rename'), name)
                  if (to !== null) renameScheme(name, to)
                },
              },
              t('config.rename'),
            ),
            h(
              'button',
              {
                type: 'button',
                className: 'gptm-configBtn',
                'data-tone': 'danger',
                title: t('config.deleteScheme'),
                onClick: () => removeScheme(name),
              },
              '×',
            ),
          ),
        )
      }

      // ── saving the side's colours, and moving the library as JSON ────────────
      const saveRow = h(
        'div',
        { key: 'saveRow', className: 'gptm-configEditHead' },
        h('span', { className: 'gptm-configGroup' }, t(`config.side.${side}`)),
        h('input', {
          className: 'gptm-configInput',
          type: 'text',
          value: nameDraft,
          placeholder: t('config.saveAs'),
          'aria-label': t('config.saveAs'),
          onChange: (event) => setNameDraft(event.target.value),
        }),
        h(
          'button',
          { type: 'button', className: 'gptm-configBtn', 'data-tone': 'primary', onClick: saveAs },
          t('config.save'),
        ),
      )

      const schemeJson = [
        h(
          'div',
          { key: 'schemeJsonHead', className: 'gptm-configLibJson' },
          h('span', { className: 'gptm-configGroup' }, t('config.schemeJson')),
          h(
            'button',
            { type: 'button', className: 'gptm-configBtn', onClick: () => exportSchemes(undefined) },
            t('config.exportAll'),
          ),
        ),
        h('div', { key: 'schemeJsonHint', className: 'gptm-configHint' }, t('config.schemeJsonHint')),
        h('textarea', {
          key: 'schemeJsonText',
          className: 'gptm-configText',
          value: schemeDraft,
          spellCheck: false,
          placeholder: t('config.schemeJson'),
          'aria-label': t('config.schemeJson'),
          onChange: (event) => setSchemeDraft(event.target.value),
        }),
        h(
          'div',
          { key: 'schemeJsonActions', className: 'gptm-configEditHead' },
          h('span', null, ''),
          h('span', null, ''),
          h(
            'button',
            {
              type: 'button',
              className: 'gptm-configBtn',
              'data-tone': 'primary',
              onClick: importSchemesFromDraft,
            },
            t('config.importSchemes'),
          ),
        ),
      ]

      // Rows show the EFFECTIVE value for the edited side — that side's tuned colour, its
      // scheme's colour, or its shipped literal — so a token that is following the theme
      // reads as something a user can recognize and edit rather than as empty.
      const rows = [head, sideBar, ...sideRows, ...library, saveRow, ...schemeJson]
      let lastGroup = null
      for (const token of COLOR_TOKENS) {
        if (token.group !== lastGroup) {
          lastGroup = token.group
          rows.push(
            h('div', { key: `g:${token.group}`, className: 'gptm-configGroup' }, t(`config.section.${token.group}`)),
          )
        }
        const overridden = config.sides[side][token.key] !== undefined
        // A gradient is not a colour the well can open on, so it gets a text field
        // whatever state it is in.
        const textOnly = token.field === 'text'
        // The row shows a CONCRETE value — this side's override, or this side's shipped
        // literal — because a colour field cannot display "not overridden".
        const value = tokenValue(config, side, token.key)
        // The placeholder repeats the shipped colour FOR THIS SIDE, so a row that was
        // reset is distinguishable from one showing exactly that value.
        const placeholder = side === 'dark' ? (token.dark ?? token.value) : token.value
        const clearButton = h(
          'button',
          {
            type: 'button',
            className: 'gptm-configClear',
            title: t('config.rowReset'),
            'aria-label': `${t('config.rowReset')} ${token.key}`,
            disabled: !overridden,
            onClick: () => setColor(token.key, ''),
          },
          '↺',
        )
        if (textOnly) {
          rows.push(
            h(
              'div',
              { key: token.key, className: 'gptm-configRow', 'data-field': 'text' },
              h('span', { className: 'gptm-configLabel', title: token.key }, token.key),
              h('input', {
                className: 'gptm-configText',
                type: 'text',
                value,
                spellCheck: false,
                placeholder,
                'aria-label': token.key,
                onChange: (event) => setColor(token.key, event.target.value),
              }),
              clearButton,
            ),
          )
        } else {
          rows.push(
            h(
              'div',
              { key: token.key, className: 'gptm-configRow' },
              h('span', { className: 'gptm-configLabel', title: token.key }, token.key),
              h('input', {
                className: 'gptm-configSwatch',
                type: 'color',
                value: toHexColor(value, token.value),
                'aria-label': token.key,
                onChange: (event) => setColor(token.key, event.target.value),
              }),
              h('input', {
                className: 'gptm-configInput',
                type: 'text',
                value,
                spellCheck: false,
                placeholder,
                'aria-label': `${token.key} value`,
                onChange: (event) => setColor(token.key, event.target.value),
              }),
              clearButton,
            ),
          )
        }
      }

      return createPortal(
        h(
          React.Fragment,
          null,
          h('div', {
            className: 'gptm-configBackdrop',
            'data-gpt-helper': 'config-backdrop',
            onClick: () => PANEL_STORE.replace({ open: false }),
          }),
          h(
            'div',
            {
              className: 'gptm-config',
              role: 'dialog',
              'aria-modal': 'true',
              'data-gpt-helper': 'config-panel',
              'aria-label': t('config.title'),
              style: {
                left: '50%',
                top: '50%',
                transform: 'translate(-50%, -50%)',
              },
            },
            h(
              'div',
              { className: 'gptm-configHead' },
              h('strong', null, t('config.title')),
              h('span', null, config.hotkey),
              h(
                'button',
                {
                  type: 'button',
                  className: 'gptm-configClose',
                  title: t('config.close'),
                  'aria-label': t('config.close'),
                  onClick: () => PANEL_STORE.replace({ open: false }),
                },
                '×',
              ),
            ),
            h(
              'div',
              { className: 'gptm-configBody' },
              h('div', { className: 'gptm-configHint' }, t('config.hint')),
              h(
                'div',
                { className: 'gptm-configHotkey' },
                h('span', null, t('config.hotkey')),
                h('input', {
                  className: 'gptm-configInput',
                  type: 'text',
                  value: hotkeyDraftFrom(config),
                  spellCheck: false,
                  'aria-label': t('config.hotkey'),
                  onChange: (event) => setHotkey(event.target.value),
                }),
              ),
              rows,
              h('div', { className: 'gptm-configGroup' }, 'JSON'),
              h('textarea', {
                className: 'gptm-configText',
                value: draft,
                spellCheck: false,
                'aria-label': 'JSON',
                onChange: (event) => setDraft(event.target.value),
              }),
            ),
            notice === null
              ? null
              : h(
                  'div',
                  {
                    className: 'gptm-configNotice',
                    'data-tone': notice.tone,
                    role: 'status',
                  },
                  notice.message,
                ),
            h(
              'div',
              { className: 'gptm-configFoot' },
              h(
                'button',
                { type: 'button', className: 'gptm-configBtn', 'data-tone': 'primary', onClick: importDraft },
                t('config.import'),
              ),
              h('button', { type: 'button', className: 'gptm-configBtn', onClick: copy }, t('config.copy')),
              h(
                'button',
                { type: 'button', className: 'gptm-configBtn', 'data-tone': 'danger', onClick: restore },
                t('config.reset'),
              ),
            ),
          ),
        ),
        document.body,
      )
    }

    /**
     * The panel as the control consults it. Returns `[open, close]`, plus a
     * document-level hotkey listener.
     *
     * Every mounted control installs one — one per open session — so a single
     * chord is handled by several listeners; each only flips the shared store, so
     * they all agree on the outcome. The handler reads the store rather than a
     * captured `open`, so it stays correct across re-renders, and it matches on
     * `event.code` with the exact modifier set because a near miss (Ctrl+Shift+G,
     * say) must not fire.
     */
    function useConfigPanelHotkey() {
      const open = React.useSyncExternalStore(
        (fn) => PANEL_STORE.subscribe(fn),
        () => PANEL_STORE.getSnapshot().open,
      )
      const config = React.useSyncExternalStore(
        (fn) => CONFIG_STORE.subscribe(fn),
        () => CONFIG_STORE.getSnapshot(),
      )

      React.useEffect(() => {
        const parsed = parseHotkey(config.hotkey)
        const onKeyDown = (event) => {
          if (!hotkeyMatches(event, parsed)) return
          event.preventDefault()
          event.stopPropagation()
          PANEL_STORE.replace({ open: !PANEL_STORE.getSnapshot().open })
        }
        document.addEventListener('keydown', onKeyDown, true)
        return () => {
          document.removeEventListener('keydown', onKeyDown, true)
        }
      }, [config.hotkey])

      const close = React.useCallback(() => PANEL_STORE.replace({ open: false }), [])
      return [open, close]
    }

    /**
     * Fast mode plus its lock, shared across every mounted control.
     *
     * The lock is a statement about persistence, so it is the lock that is stored
     * and not merely the toggle: with `locked: true` the stored `fast` is forced
     * true on the way in, which is what makes "stays on" true after a reload, in
     * a new session, and in a second window.
     */
    function useFastLock() {
      const state = React.useSyncExternalStore(
        (fn) => FAST_STORE.subscribe(fn),
        () => FAST_STORE.getSnapshot(),
      )

      const setFast = React.useCallback((next) => {
        FAST_STORE.update((current) => ({
          locked: current.locked,
          // While locked the value is not the user's to change.
          fast: current.locked ? true : typeof next === 'function' ? next(current.fast) : next === true,
        }))
      }, [])

      const toggleLock = React.useCallback(() => {
        FAST_STORE.update((current) => {
          const locked = !current.locked
          // Locking forces fast mode on — that IS the feature. Unlocking leaves
          // the toggle where it is, so unlocking never silently switches
          // anything off.
          return { locked, fast: locked ? true : current.fast }
        })
      }, [])

      return { fast: state.fast, locked: state.locked, setFast, toggleLock }
    }

    /**
     * Long-press on a button.
     *
     * The button keeps a plain `onClick` — a `click` always arrives after a hold,
     * so suppressing it here means the caller's own handler stays unconditional
     * and `useLongPress` stays free of overlay callbacks. `consumed()` is what
     * lets the caller drop the click that a completed hold produces.
     */
    function useLongPress(onLongPress) {
      const timer = React.useRef(0)
      const fired = React.useRef(false)

      const clear = React.useCallback(() => {
        clearTimeout(timer.current)
        timer.current = 0
      }, [])

      React.useEffect(() => clear, [clear])

      const onPointerDown = (event) => {
        if (event.pointerType === 'mouse' && event.button !== 0) return
        fired.current = false
        clear()
        timer.current = setTimeout(() => {
          timer.current = 0
          fired.current = true
          onLongPress()
        }, LONG_PRESS_MS)
      }

      return {
        /** True while the hold that just ended was the long one. */
        consumed: () => fired.current,
        /** Call after acting on a click, so the next press starts clean. */
        reset: () => {
          fired.current = false
        },
        handlers: {
          onPointerDown,
          onPointerUp: clear,
          onPointerLeave: clear,
          onPointerCancel: clear,
          onContextMenu: (event) => {
            if (timer.current !== 0 || fired.current) event.preventDefault()
          },
        },
      }
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

      // Fast mode and its lock live outside React, in a store shared by every
      // mounted control, because the lock is a persistence statement rather than
      // a per-session toggle.
      const { fast, locked: fastLocked, setFast, toggleLock } = useFastLock()
      const [panelOpen, closePanel] = useConfigPanelHotkey()
      const config = React.useSyncExternalStore(
        (fn) => CONFIG_STORE.subscribe(fn),
        () => CONFIG_STORE.getSnapshot(),
      )

      React.useEffect(() => {
        document.addEventListener('focus', rearmFastFromStorage, true)
        document.addEventListener('pointerdown', rearmFastFromStorage, true)
        return () => {
          document.removeEventListener('focus', rearmFastFromStorage, true)
          document.removeEventListener('pointerdown', rearmFastFromStorage, true)
        }
      }, [])

      const fastToggle = useLongPress(toggleLock)

      const groups = state.groups ?? []
      const current = state.current ?? null
      const pending = state.pending ?? null
      const busy = pending !== null
      // `locked` is the slot owner's prop (an addressed subagent session cannot
      // pick a model); the fast-mode lock is a separate, user-held state.
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
        /**
         * The value the node is actually at.
         *
         * Read from the node rather than trusted to a ref: the inline `--spin` is part of
         * the render output, so a fresh node starts at the render's value and the ref can
         * disagree with it. Reading the DOM is what the browser does anyway, and the ref
         * is only the fallback for a node that cannot be inspected.
         */
        const currentValue = () => {
          // `?.()` on the METHOD, not just on `style`: a node whose style object has no
          // `getPropertyValue` (any non-browser DOM) would otherwise throw here.
          const raw = node.style?.getPropertyValue?.('--spin')
          const parsed = raw === undefined || raw === null || raw === '' ? Number.NaN : Number(raw)
          return Number.isFinite(parsed) ? parsed : spinRef.current
        }
        const write = (value) => {
          spinRef.current = value
          node.style.setProperty('--spin', String(value))
        }

        // The target is already reached, so this is the resting state: write it and stop.
        // Bailing out here instead — which this did — left the node at whatever the render
        // had put there, and the ramp only re-ran when `open`, `fast` or `isUltra` changed.
        // That is why starting with the lock already on could render a trail with no
        // particles until the lock was toggled.
        if (Math.abs(target - currentValue()) <= 0.002) {
          write(target)
          return undefined
        }

        let raf = 0
        let last = performance.now()
        const tick = (now) => {
          const dt = Math.min(64, now - last)
          last = now
          const value = currentValue()
          if (Math.abs(target - value) > 0.002) {
            // Asymmetric: ignite faster than it dies down.
            const step = dt * (target > value ? 1 / 600 : 1 / 900)
            write(target > value ? Math.min(target, value + step) : Math.max(target, value - step))
            raf = requestAnimationFrame(tick)
          } else {
            write(target)
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

      // The colour panel takes over the screen, so the popover gets out of its
      // way rather than stacking under the backdrop.
      React.useEffect(() => {
        if (panelOpen) close()
      }, [panelOpen, close])

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

      /**
       * The reset button restores the *thinking* settings, and fast mode is part
       * of the state it has always cleared. The lock is cleared first so the
       * `setFast(false)` below is not immediately forced back on by it.
       */
      const reset = () => {
        if (fastLocked) toggleLock()
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

      const triggerTitle = fastLocked
        ? t('fast.locked')
        : displayLabel === undefined
          ? modelLabel
          : `${modelLabel} · ${displayLabel}`

      const trigger = h(
        'button',
        {
          ref: triggerRef,
          type: 'button',
          className: 'gptm-trigger',
          'data-gpt-helper': 'model-effort-trigger',
          'data-fast': fast,
          'data-ultra': isUltra,
          'data-locked': fastLocked,
          'aria-haspopup': 'dialog',
          'aria-expanded': open,
          'aria-busy': busy,
          title: triggerTitle,
          disabled,
          onClick: toggle,
        },
        h(
          'span',
          { className: 'gptm-triggerBolt' },
          h(Bolt, { size: 14, solid: true }),
          fastLocked ? h(LockMark, null) : null,
        ),
        h('span', { className: 'gptm-triggerModel' }, modelLabel),
        // Locked fast mode is the more important state, so it takes the slot the
        // thinking level would occupy.
        fastLocked
          ? h('span', { className: 'gptm-triggerLevel' }, t('fast.locked'))
          : displayLabel === undefined
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
              { key: 'head', className: 'gptm-head', 'data-quota': quota, 'data-locked': fastLocked },
              h(
                'button',
                {
                  type: 'button',
                  className: 'gptm-iconBtn gptm-fastToggle',
                  'data-gpt-helper': 'fast-toggle',
                  'aria-pressed': fast,
                  // Not `disabled`: the long press is the only way back out, and a
                  // disabled button receives no pointer events at all.
                  'aria-disabled': busy,
                  'aria-label': t('fast.label'),
                  title: t('fast.lockHint'),
                  onClick: () => {
                    if (fastToggle.consumed()) {
                      fastToggle.reset()
                      return
                    }
                    // Locked means "on and staying on", so a plain click is inert
                    // rather than an off switch that the lock would undo.
                    if (fastLocked) return
                    setFast((wasFast) => !wasFast)
                  },
                  ...fastToggle.handlers,
                },
                fastLocked ? h(LockIcon, { size: 18 }) : h(Bolt, { size: 18 }),
              ),
              h(
                'button',
                {
                  type: 'button',
                  className: 'gptm-status',
                  title: fastLocked ? t('fast.lockHint') : t('section.model'),
                  disabled: busy || choices.length === 0,
                  onClick: () => setPane('models'),
                },
                h(
                  'span',
                  { className: 'gptm-statusTitle' },
                  quota
                    ? t('quota.title')
                    : fastLocked
                      ? t('fast.locked')
                      : (displayLabel ?? t('section.effort')),
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
                  'data-locked': fastLocked,
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
                  // `--spin` follows the STATE, not the ref's initial value. The ramp
                  // then animates from whatever the node carries, so opening the panel on
                  // an already-fast (locked) session shows the full trail immediately.
                  style: {
                    '--value': `${shownRatio * 100}%`,
                    '--spin': String(isUltra || fast ? Math.max(spinRef.current, 0.999) : 0),
                  },
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

            // The lock has no visible affordance of its own — it is a hold on a
            // button that otherwise looks like a tap — so the thinking pane says
            // so once.
            body.push(h('div', { key: 'hint', className: 'gptm-hint' }, t('fast.lockHint')))
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
              'data-locked': fastLocked,
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
        // The sheet is generated per render from the current colours: it carries
        // the literals, so an override is simply a different string. React replaces
        // the text of this <style> in place, which is what makes the control repaint
        // the moment the panel changes something.
        h('style', null, buildCss(config)),
        // The build marker rides the trigger as an attribute instead of a node of
        // its own: an extra element in this Fragment is one more thing that can be
        // wrong in a boot path that fails closed, and a `data-` attribute cannot.
        h('div', { className: 'gptm-root', 'data-gpt-helper': 'root', 'data-build': BUILD }, trigger),
        menu,
        panelOpen ? h(ConfigPanel, { t }) : null,
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
        console.info(`[gpt-helper] client half applied — build ${BUILD}`)

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

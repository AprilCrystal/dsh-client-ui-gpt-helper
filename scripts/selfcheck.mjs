/**
 * Throwaway harness.
 *
 * The client bundle's factory cannot be called from Node — it needs a browser, a
 * cordis context and a live model directory — but everything this change touched
 * lives in plain script sections around the component. This harness cuts the
 * factory body out of lib/client.js VERBATIM (from the configuration constants
 * down to the final `return`), evaluates it, and then exercises the pieces:
 * colour validation, the hotkey parser, the theme rule, the stores, and real
 * render passes of the control and the configuration panel through a React stub
 * that supports the hooks those components use.
 *
 * Nothing under test is re-typed here, so a pass means the shipped code behaves.
 */
import { readFileSync } from 'node:fs'

const problems = []
const check = (name, ok, detail) => {
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${name}${ok || detail === undefined ? '' : ` — ${detail}`}`)
  if (!ok) problems.push(name)
}

const source = readFileSync('lib/client.js', 'utf8')

// ── DOM stub ────────────────────────────────────────────────────────────────
const byId = new Map()
const documentShim = {
  head: {
    appendChild(node) {
      byId.set(node.id, node)
    },
  },
  body: { appendChild() {}, removeChild() {} },
  listeners: [],
  getElementById: (id) => byId.get(id) ?? null,
  createElement: () => ({
    style: { setProperty() {} },
    textContent: '',
    remove() {
      byId.delete(this.id)
    },
  }),
  addEventListener(type, handler) {
    this.listeners.push({ type, handler })
  },
  removeEventListener(type, handler) {
    this.listeners = this.listeners.filter((entry) => entry.handler !== handler)
  },
}

const storage = new Map()
const windowShim = {
  addEventListener() {},
  localStorage: {
    getItem: (key) => (storage.has(key) ? storage.get(key) : null),
    setItem: (key, value) => storage.set(key, String(value)),
  },
}

// ── a React stub that still runs the real components ────────────────────────
// The components are ordinary functions of `h` (createElement), so a minimal
// implementation that supports the hooks this control uses runs them for real.
const frames = new Map()
let currentFrame = null
let currentProps = null
let hookIndex = 0
let pendingEffects = []

function renderComponent(component, props) {
  const key = component.name || 'anon'
  const existing = frames.get(key) ?? { slots: [] }
  frames.set(key, existing)
  const previousFrame = currentFrame
  const previousProps = currentProps
  const previousIndex = hookIndex
  currentFrame = existing
  currentProps = props
  hookIndex = 0
  try {
    return component(props)
  } finally {
    currentFrame = previousFrame
    currentProps = previousProps
    hookIndex = previousIndex
  }
}

function slotAt(index, create) {
  const slots = currentFrame.slots
  if (slots[index] === undefined) slots[index] = create()
  return slots[index]
}

const rect = () => ({ left: 120, right: 300, top: 700, bottom: 728, width: 180, height: 28 })

const ReactStub = {
  createElement(type, rawProps, ...children) {
    const flat = children.flat(Infinity).filter((child) => child !== null && child !== undefined && child !== false)
    if (typeof type === 'function') {
      const { ref: _ref, ...props } = { ...(rawProps ?? {}) }
      if (flat.length > 0) props.children = flat.length === 1 ? flat[0] : flat
      return renderComponent(type, props)
    }
    const { ref = null, ...props } = { ...(rawProps ?? {}) }
    return { type, props: { ...props, children: flat }, ref }
  },
  Fragment: 'Fragment',
  useRef(initial) {
    const slot = slotAt(hookIndex, () => ({ current: initial }))
    hookIndex += 1
    return slot
  },
  useState(initial) {
    const index = hookIndex
    hookIndex += 1
    const slot = slotAt(index, () => ({ value: typeof initial === 'function' ? initial() : initial }))
    return [
      slot.value,
      (next) => {
        slot.value = typeof next === 'function' ? next(slot.value) : next
      },
    ]
  },
  useEffect(fn, deps) {
    const index = hookIndex
    hookIndex += 1
    const slot = slotAt(index, () => ({ deps: undefined, cleanup: undefined }))
    slot.effect = fn
    if (slot.deps === undefined || deps.some((value, i) => !Object.is(value, slot.deps[i]))) pendingEffects.push(slot)
    slot.deps = deps
  },
  useLayoutEffect(fn, deps) {
    ReactStub.useEffect(fn, deps)
  },
  useCallback(fn) {
    hookIndex += 1
    return fn
  },
  useMemo(fn) {
    const index = hookIndex
    hookIndex += 1
    return slotAt(index, () => ({ value: fn() })).value
  },
  useSyncExternalStore(subscribe, getSnapshot) {
    hookIndex += 1
    // Real React subscribes and re-renders the subscriber on a store change. The
    // stub cannot schedule on its own, so the component under test hands it a
    // re-render function through props.__rerender.
    const rerender = currentProps?.__rerender
    if (typeof subscribe === 'function' && typeof rerender === 'function') subscribe(rerender)
    return getSnapshot()
  },
}

// The stores re-render their subscribers, so a store write while a component is
// mounted re-runs the effect that applies the colour rule. That is exactly how
// the real app reacts to a colour edit, and the only reason it is spelled out
// here is that this stub has no scheduler of its own.
function subscribeStore(store, rerender) {
  return {
    getSnapshot: () => store.getSnapshot(),
    subscribe: (listener) =>
      store.subscribe(() => {
        rerender()
        listener()
      }),
  }
}

function attachRefs(node) {
  if (node === null || node === undefined || typeof node !== 'object') return
  if (Array.isArray(node)) {
    for (const entry of node) attachRefs(entry)
    return
  }
  if (node.ref !== null && typeof node.ref === 'object') node.ref.current = { ...node, getBoundingClientRect: rect }
  attachRefs(node.props?.children)
}

function find(node, predicate, found = []) {
  if (node === null || node === undefined || typeof node !== 'object') return found
  if (Array.isArray(node)) {
    for (const entry of node) find(entry, predicate, found)
    return found
  }
  if (predicate(node)) found.push(node)
  find(node.props?.children, predicate, found)
  return found
}

function flush() {
  const queue = pendingEffects
  pendingEffects = []
  for (const slot of queue) {
    if (typeof slot.cleanup === 'function') slot.cleanup()
    slot.cleanup = slot.effect()
  }
}

// ── cut the factory body out, verbatim ──────────────────────────────────────
// From the configuration constants to the end of the component definitions: the
// factory's own `return { inject, apply }` is what this replaces. The three store
// singletons are lifted out and injected, so the harness can subscribe to them
// and drive the re-renders a real store change produces.
const tailStart = source.indexOf('    const CONFIG_KEY =')
const tail = source.slice(tailStart)
const returnStart = tail.lastIndexOf('\n    return {')
if (tailStart === -1 || returnStart === -1) throw new Error('could not cut the factory body')

const body = tail
  .slice(0, returnStart)
  .replace(
    /const CONFIG_STORE = createStore\([\s\S]*?\n    \}\)\n/,
    'const CONFIG_STORE = stores.config\n',
  )
  .replace(/const FAST_STORE = createStore\([\s\S]*?\n    \}\)\n/, 'const FAST_STORE = stores.fast\n')
  .replace(/const PANEL_STORE = createStore\(\{ open: false \}\)\n/, 'const PANEL_STORE = stores.panel\n')

if (body.includes('const CONFIG_STORE = createStore')) throw new Error('store lifting failed')

const script = `
const window = arguments[0]
const document = arguments[1]
const React = arguments[2]
const stores = arguments[3]
const h = React.createElement
// The panel is a portal like the popover is; the stub renders it in place.
const createPortal = (node) => node
// The particle ramp asks for an animation frame; a browser has these globals.
const requestAnimationFrame = () => 0
const cancelAnimationFrame = () => {}
// The build marker is defined above the slice point, so it is lifted out too.
const BUILD = ${JSON.stringify(/const BUILD = '([^']+)'/.exec(source)[1])}
${body}
return { BUILD, COLOR_TOKENS, safeColor, normalizeColors, readHotkey, parseHotkey, hotkeyMatches, normalizeConfig, configToDocument, defaultConfig, buildCss, CONFIG_STORE, FAST_STORE, PANEL_STORE, ConfigPanel, toHexColor, LONG_PRESS_MS, CONFIG_KEY, FAST_KEY, DEFAULT_HOTKEY, ModelEffortControl }
`

// ── store handles for the harness ───────────────────────────────────────────
function makeStore(initial) {
  let snapshot = initial
  const listeners = new Set()
  return {
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    getSnapshot: () => snapshot,
    replace(next) {
      snapshot = next
      for (const listener of [...listeners]) listener()
    },
    update(fn) {
      this.replace(fn(snapshot))
    },
  }
}
const configStore = makeStore({ colors: {}, hotkey: 'Ctrl+Shift+Alt+G' })
const fastStore = makeStore({ fast: false, locked: false })
const panelStore = makeStore({ open: false })

let api = null
try {
  // eslint-disable-next-line no-new-func
  api = new Function(script)(windowShim, documentShim, ReactStub, {
    config: configStore,
    fast: fastStore,
    panel: panelStore,
  })
} catch (error) {
  console.log('FAIL  evaluating the sliced factory body —', error.stack)
  process.exit(1)
}

const t = (key) => key

// The panel and the control subscribe to stores; this is what a real renderer
// would schedule, handed to the stub through the one prop it understands.
// eslint-disable-next-line prefer-const
let panelTree = null
let applyThemeCalls = 0
const renderPanel = () => {
  panelTree = renderComponent(api.ConfigPanel, { t, __rerender: renderPanel })
  flush()
  return panelTree
}

// ── the module's own shape ──────────────────────────────────────────────────
check('the factory body evaluated', api !== null)
check('the build marker was read', typeof api.BUILD === 'string' && api.BUILD.length > 0, api.BUILD)
check('24 colour tokens', api.COLOR_TOKENS.length === 24, `got ${api.COLOR_TOKENS.length}`)
check('default hotkey is Ctrl+Shift+Alt+G', api.DEFAULT_HOTKEY === 'Ctrl+Shift+Alt+G')
check('the lock press is 600ms', api.LONG_PRESS_MS === 600)
check(
  'every token carries a literal value',
  api.COLOR_TOKENS.every((token) => typeof token.value === 'string' && token.value.length > 0),
)
check(
  'every token carries a literal value',
  api.COLOR_TOKENS.every((token) => typeof token.value === 'string' && token.value.length > 0),
)
check(
  'no token value is a var()',
  api.COLOR_TOKENS.every((token) => !token.value.includes('var(')),
  api.COLOR_TOKENS.filter((token) => token.value.includes('var(')).map((t) => t.key).join(','),
)
check(
  'the three gradients are text fields',
  api.COLOR_TOKENS.filter((token) => token.field === 'text').length === 3,
  api.COLOR_TOKENS.filter((token) => token.field === 'text').map((token) => token.key).join(','),
)

// The measured root cause of the invisible slider, and the rule it forces: this
// app's Chromium drops a declaration whose value is only a var(), so the generated
// sheet must contain no `var(--c-…)` at all once it has been built.
const shipped = api.buildCss({ colors: {}, hotkey: 'x' })
check('the generated sheet keeps no colour placeholder', !shipped.includes('var(--c-'))
check('the generated sheet paints the track with a literal', shipped.includes('background: #e8e7e8'))
// The thumb and the tick are the two tokens that used to be near-white on BOTH sides,
// which made them vanish into the light track. Each side now has its own value.
check('the generated sheet paints the light thumb with a literal', shipped.includes('background: #fdfdfe'))
check('the generated sheet paints the light tick with a literal', shipped.includes('background: #8b8f96'))
check(
  'the generated sheet paints the dark thumb with its own literal',
  shipped.includes('background: #d7d9de'),
)
check('the generated sheet paints a tick with a literal', shipped.includes('background: #c9ccd2'))
const withOverride = api.buildCss({ colors: { 'slider.track': '#ff8800' }, hotkey: 'x' })
check(
  'an override reaches the generated sheet',
  withOverride.includes('background: #ff8800') && !withOverride.includes('background: #e8e7e8'),
)
check(
  'an override leaves the other colours shipped',
  withOverride.includes('background: #fdfdfe') && withOverride.includes('background: #5184f4'),
)
// DSH's own theme tokens legitimately stay as var() — they belong to the host and
// resolve fine. What must never survive is a reference to one of OUR colour tokens.
check('no colour token survives as a var()', !withOverride.includes('var(--c-'))
check('the sheet keeps DSH theme tokens live', withOverride.includes('var(--dsw-alias-label-primary'))

// ── colour validation ───────────────────────────────────────────────────────
check('accepts hex', api.safeColor('#ff0000') === '#ff0000')
check('accepts short hex', api.safeColor('#f00') === '#f00')
check('accepts rgba', api.safeColor('rgba(255,255,255,.35)') === 'rgba(255,255,255,.35)')
check('accepts a gradient', api.safeColor('linear-gradient(90deg, #000, #fff)') !== null)
check('rejects a declaration escape', api.safeColor('red; } body { display: none') === null)
check('rejects a stray brace', api.safeColor('red}') === null)
check('rejects var() indirection', api.safeColor('var(--dsw-alias-label-primary)') === null)
check('rejects a non-string', api.safeColor(42) === null)
check(
  'normalizeColors keeps only real overrides',
  JSON.stringify(api.normalizeColors({ 'trigger.bolt': '#ff0000', other: '#000' })) === '{"trigger.bolt":"#ff0000"}',
)
check('normalizeColors drops junk', JSON.stringify(api.normalizeColors({ 'trigger.bolt': 'red;} ' })) === '{}')
check('normalizeConfig fills the hotkey', api.normalizeConfig({}).hotkey === 'Ctrl+Shift+Alt+G')
check('normalizeConfig normalizes a stored hotkey', api.normalizeConfig({ hotkey: 'ctrl+alt+k' }).hotkey === 'Ctrl+Alt+K')
check('defaultConfig carries no overrides', Object.keys(api.defaultConfig().colors).length === 0)
check(
  'configToDocument is the editable shape',
  JSON.stringify(api.configToDocument(api.defaultConfig())) ===
    '{"version":1,"hotkey":"Ctrl+Shift+Alt+G","colors":{}}',
)

// ── hotkey parsing ──────────────────────────────────────────────────────────
const parsed = api.parseHotkey('Ctrl+Shift+Alt+G')
check(
  'parses a chord into event fields',
  parsed.ctrl && parsed.shift && parsed.alt && !parsed.meta && parsed.code === 'KeyG',
  JSON.stringify(parsed),
)
check('parses a digit', api.parseHotkey('Ctrl+1').code === 'Digit1')
const chord = { code: 'KeyG', ctrlKey: true, altKey: true, shiftKey: true, metaKey: false }
check('matches exactly', api.hotkeyMatches(chord, parsed) === true)
check('rejects a near miss', api.hotkeyMatches({ ...chord, shiftKey: false }, parsed) === false)
check('rejects an extra modifier', api.hotkeyMatches({ ...chord, metaKey: true }, parsed) === false)
check('reports nonsense as invalid', api.readHotkey('nonsense').valid === false)
check('accepts a real chord', api.readHotkey('Ctrl+Alt+K').valid === true)

// ── the fast-mode store ─────────────────────────────────────────────────────
check('fast mode starts off', api.FAST_STORE.getSnapshot().fast === false)
check('the lock starts off', api.FAST_STORE.getSnapshot().locked === false)
check('the config store still holds defaults', api.CONFIG_STORE.getSnapshot().hotkey === 'Ctrl+Shift+Alt+G')

// The injected store replaces the real one, so its persistence side effect is
// re-attached here. Everything else about it is the module's own `createStore`.
api.CONFIG_STORE.subscribe(() => {
  storage.set(api.CONFIG_KEY, JSON.stringify(api.configToDocument(api.CONFIG_STORE.getSnapshot())))
})

// ── render the configuration panel ──────────────────────────────────────────
const snapshot = {
  groups: [
    {
      id: 'deepseek-account',
      name: 'DeepSeek Account',
      models: [
        {
          id: 'deepseek-v41-flash',
          name: 'DeepSeek-V41-Flash',
          reasoning: {
            efforts: [
              { id: 'high', name: 'High' },
              { id: 'max', name: 'Max' },
            ],
          },
        },
      ],
    },
  ],
  current: { provider: 'deepseek-account', model: 'deepseek-v41-flash', reasoningEffort: 'high' },
  status: 'ready',
  pending: null,
  error: null,
}

// The control owns the effect that applies the colour table, so it is what the
// rule is read from — the panel only edits the store.
const controlProps = {
  locked: false,
  available: true,
  directory: { subscribe: () => () => {}, getSnapshot: () => snapshot },
  load: () => {},
  select: () => Promise.resolve({ ok: true }),
  t,
}
let controlTree = null
const renderControl = () => {
  controlTree = renderComponent(api.ModelEffortControl, { ...controlProps, __rerender: renderControl })
  attachRefs(controlTree)
  flush()
  return controlTree
}
renderControl()
renderPanel()

const rows = find(panelTree, (node) => node.props?.className === 'gptm-configRow')
const rowFor = (title) => rows.find((row) => row.props.children[0].props.title === title)
check('panel renders every token row', rows.length === 24, `rows=${rows.length}`)
check('panel shows the hotkey', find(panelTree, (node) => node.props?.value === 'Ctrl+Shift+Alt+G').length === 1)
check('panel exposes the JSON document', find(panelTree, (node) => node.props?.['aria-label'] === 'JSON').length === 1)
check(
  'panel offers import',
  find(panelTree, (node) => node.props?.children === 'config.import').length === 1 ||
    find(panelTree, (node) => Array.isArray(node.props?.children) && node.props.children.includes('config.import'))
      .length === 1,
)
check(
  'panel offers a full restore',
  find(panelTree, (node) => node.props?.children === 'config.reset').length === 1 ||
    find(panelTree, (node) => Array.isArray(node.props?.children) && node.props.children.includes('config.reset'))
      .length === 1,
)
check(
  'a row names the shipped colour',
  rowFor('trigger.model').props.children[2].props.placeholder === '#242527',
  rowFor('trigger.model').props.children[2].props.placeholder,
)
// The row shows the LIGHT literal while no override exists; the dark side is a separate
// declaration in the generated sheet, not a second value in the field.
check('a row shows the shipped colour', rowFor('trigger.model').props.children[2].props.value === '#242527')
check(
  'a theme-neutral row names the same value',
  rowFor('slider.track').props.children[2].props.placeholder === '#e8e7e8',
)
check('a gradient row is a text field', rowFor('slider.fillGrad').props['data-field'] === 'text')

// ── editing through the panel ───────────────────────────────────────────────
// The assertion is made against the sheet the CONTROL renders, because that
// <style> is what the page paints from. Checking the store alone would have
// passed during the round where the override went into a custom property that
// nothing read.
// The stub collects children into an array where real React would pass the single
// string through; both shapes are accepted, but nothing else is — a stylesheet
// OBJECT here is what React rejects with error #31.
const renderedSheet = () => {
  const child = find(controlTree, (node) => node.type === 'style')[0]?.props?.children
  if (typeof child === 'string') return child
  if (Array.isArray(child) && child.every((entry) => typeof entry === 'string')) return child.join('')
  return null
}
const isStockSheet = () => renderedSheet()?.includes('background: #e8e7e8') === true
const rowsOf = (tree) =>
  find(tree, (node) => node.props?.className === 'gptm-configRow').map((row) => ({
    title: row.props.children[0].props.title,
    row,
  }))
const rowIn = (tree, title) => rowsOf(tree).find((entry) => entry.title === title).row

check('nothing is overridden yet, so the sheet is the stock one', isStockSheet())
check('the row reset is disabled until overridden', rowIn(panelTree, 'trigger.bolt').props.children[3].props.disabled === true)
rowIn(panelTree, 'trigger.bolt').props.children[1].props.onChange({ target: { value: '#ff0000' } })
controlTree = renderControl()
check('editing a colour rewrites the rendered sheet', renderedSheet().includes('color: #ff0000;'))
check('editing a colour persists it', storage.get(api.CONFIG_KEY).includes('#ff0000'))
check('editing one colour leaves the rest alone', api.CONFIG_STORE.getSnapshot().colors['slider.fill'] === undefined)

rowIn(panelTree, 'slider.track').props.children[1].props.onChange({
  target: { value: 'red; } body { display: none' },
})
controlTree = renderControl()
check('an injection attempt is refused', renderedSheet().includes('background: #e8e7e8'))

rowIn(panelTree, 'trigger.bolt').props.children[3].props.onClick()
controlTree = renderControl()
check('a per-row reset drops the override', isStockSheet())
check('a per-row reset clears storage', storage.get(api.CONFIG_KEY).includes('#ff0000') === false)
check(
  'a per-row reset leaves the hotkey alone',
  api.CONFIG_STORE.getSnapshot().hotkey === 'Ctrl+Shift+Alt+G',
)

// A gradient row accepts a gradient, and a nonsense value is refused.
rowIn(panelTree, 'slider.fillGrad').props.children[1].props.onChange({
  target: { value: 'linear-gradient(90deg, #000, #fff)' },
})
controlTree = renderControl()
check('a gradient is accepted', renderedSheet().includes('linear-gradient(90deg, #000, #fff)'))
rowIn(panelTree, 'slider.fillGrad').props.children[1].props.onChange({ target: { value: 'nonsense(' } })
controlTree = renderControl()
check('a nonsense gradient is refused', renderedSheet().includes('linear-gradient(90deg, #000, #fff)'))

// The full restore empties the override table again.
const panelButtons = find(panelTree, (node) => node.props?.className === 'gptm-configBtn')
const resetButton = panelButtons.find(
  (node) =>
    node.props.children === 'config.reset' ||
    (Array.isArray(node.props.children) && node.props.children.includes('config.reset')),
)
check('the panel has a restore button', resetButton !== undefined, `buttons=${panelButtons.length}`)
resetButton.props.onClick()
controlTree = renderControl()
check('the full restore puts the stock sheet back', isStockSheet())
check('the full restore keeps no colours', Object.keys(api.CONFIG_STORE.getSnapshot().colors).length === 0)

// ── the rendered control ────────────────────────────────────────────────────
const byData = (tree, value) => find(tree, (node) => node.props?.['data-gpt-helper'] === value)[0]
const textOf = (value) => (Array.isArray(value) ? value.filter((entry) => typeof entry === 'string').join('') : value)
controlTree = renderControl()
// A build marker that reaches the DOM is what makes "the page is running a stale
// module" answerable. A ReferenceError on it took the whole web boot down once.
check(
  'the build marker reaches the DOM',
  find(controlTree, (node) => node.props?.['data-build'] === api.BUILD).length === 1,
)

// A slot entry that renders an object as a child fails inside React — "Minified
// React error #31", args `[object CSS]` — and takes the whole web boot with it. A
// stylesheet object reaching `h('style', null, …)` is the realistic way in, so the
// rendered tree is walked and anything that is not a string, number or element is
// rejected. This is the regression the load check could not see: it calls the
// component directly, without a hook runtime, so its tree is always empty.
const badChildren = []
const walkChildren = (node, where) => {
  if (node === null || node === undefined || typeof node === 'boolean') return
  if (typeof node === 'string' || typeof node === 'number') return
  if (Array.isArray(node)) {
    node.forEach((child, index) => walkChildren(child, `${where}[${index}]`))
    return
  }
  if (typeof node === 'object' && node.type !== undefined && node.props !== undefined) {
    walkChildren(node.props.children, `${where}<${String(node.type)}>`)
    return
  }
  badChildren.push(`${where}: ${Object.prototype.toString.call(node)}`)
}
walkChildren(controlTree.props.children, 'root')
check('every rendered child is a string, number or element', badChildren.length === 0, badChildren.join(' | '))
check(
  'the stylesheet renders as text, not an object',
  renderedSheet() !== null,
  Object.prototype.toString.call(find(controlTree, (node) => node.type === 'style')[0]?.props?.children),
)
check('the rendered sheet carries no colour placeholder', renderedSheet()?.includes('var(--c-') === false)
check('the rendered sheet paints the track', renderedSheet()?.includes('background: #e8e7e8') === true)

const trigger = byData(controlTree, 'model-effort-trigger')
check('control renders its trigger', trigger !== undefined)
check('trigger starts unlocked', trigger.props['data-locked'] === false)
check(
  'trigger names the model',
  textOf(find(controlTree, (node) => node.props?.className === 'gptm-triggerModel')[0].props.children) ===
    'DeepSeek-V41-Flash',
  JSON.stringify(find(controlTree, (node) => node.props?.className === 'gptm-triggerModel')[0].props.children),
)
check(
  'trigger shows the level',
  textOf(find(controlTree, (node) => node.props?.className === 'gptm-triggerLevel')[0].props.children) === 'High',
  JSON.stringify(find(controlTree, (node) => node.props?.className === 'gptm-triggerLevel')[0].props.children),
)
check('bolt hidden without fast mode', trigger.props['data-fast'] === false)

// The popover opens through the trigger, and its placement lands in a layout
// effect, so the render after the click is the one that shows the menu.
byData(controlTree, 'model-effort-trigger').props.onClick()
controlTree = renderControl()
controlTree = renderControl()
const menu = byData(controlTree, 'model-effort-menu')
check('clicking the trigger opens the popover', menu !== undefined)
check('the popover knows the lock state', menu?.props['data-locked'] === false)
const fastToggle = byData(controlTree, 'fast-toggle')
check('the popover carries the fast toggle', fastToggle !== undefined)
check('the fast toggle starts unpressed', fastToggle.props['aria-pressed'] === false)
check('the bolt is drawn while unlocked', find(controlTree, (node) => node.props?.className === 'gptm-boltOutline').length > 0)
check('no lock badge while unlocked', find(controlTree, (node) => node.props?.className === 'gptm-lockMark').length === 0)
check(
  'the popover explains the hold gesture',
  find(controlTree, (node) => node.props?.className === 'gptm-hint').length === 1,
)

// ── the lock itself ─────────────────────────────────────────────────────────
// A short press toggles fast mode and does not lock.
fastToggle.props.onPointerDown({ pointerType: 'mouse', button: 0 })
fastToggle.props.onPointerUp()
fastToggle.props.onClick({ preventDefault() {}, stopPropagation() {} })
controlTree = renderControl()
check('a short press turns fast mode on', api.FAST_STORE.getSnapshot().fast === true)
check('a short press does not lock', api.FAST_STORE.getSnapshot().locked === false)

// A completed hold locks it, and the click that follows is dropped.
const holdButton = byData(controlTree, 'fast-toggle')
holdButton.props.onPointerDown({ pointerType: 'mouse', button: 0 })
check('the lock is not set while the hold runs', api.FAST_STORE.getSnapshot().locked === false)
await new Promise((resolve) => setTimeout(resolve, 700))
check('the hold locked fast mode', api.FAST_STORE.getSnapshot().locked === true && api.FAST_STORE.getSnapshot().fast === true)
holdButton.props.onPointerUp()
holdButton.props.onClick({ preventDefault() {}, stopPropagation() {} })
controlTree = renderControl()
check('the trigger reports the lock', byData(controlTree, 'model-effort-trigger').props['data-locked'] === true)
check('the lock badge is drawn', find(controlTree, (node) => node.props?.className === 'gptm-lockMark').length === 1)
check(
  'the level slot shows the lock word',
  find(controlTree, (node) => node.props?.className === 'gptm-triggerLevel').some(
    (node) => textOf(node.props.children) === 'fast.locked',
  ),
)
check(
  'the popover says fast mode is locked',
  find(controlTree, (node) => node.props?.className === 'gptm-statusTitle').some(
    (node) => textOf(node.props.children) === 'fast.locked',
  ),
)

// A plain click while locked must not switch fast mode off.
byData(controlTree, 'fast-toggle').props.onClick({ preventDefault() {}, stopPropagation() {} })
controlTree = renderControl()
check('a click while locked is inert', api.FAST_STORE.getSnapshot().fast === true)
check('the lock survives the click', api.FAST_STORE.getSnapshot().locked === true)

// A second hold releases it.
byData(controlTree, 'fast-toggle').props.onPointerDown({ pointerType: 'mouse', button: 0 })
await new Promise((resolve) => setTimeout(resolve, 700))
check('the second hold released the lock', api.FAST_STORE.getSnapshot().locked === false)
check('and left fast mode on', api.FAST_STORE.getSnapshot().fast === true)

console.log(problems.length === 0 ? '\nALL CHECKS PASSED' : `\n${problems.length} FAILED: ${problems.join(' | ')}`)
process.exitCode = problems.length === 0 ? 0 : 1

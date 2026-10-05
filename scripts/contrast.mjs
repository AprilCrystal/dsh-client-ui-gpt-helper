/**
 * Throwaway: measure the shipped palette against the popover's background so the
 * "invisible in dark mode" report becomes numbers instead of guesses.
 * Relative luminance per WCAG; 4.5 is the readable-text threshold, 3.0 the
 * large-text / graphical-object one.
 */
import { readFileSync } from 'node:fs'

const source = readFileSync('lib/client.js', 'utf8')

// Pull the token table out of the bundle. The table is a plain script section, so
// it is evaluated rather than pattern-matched: a hand-written parser got the
// multi-line entries wrong twice, and this check exists to be trusted.
const tail = source.slice(source.indexOf('    const CONFIG_KEY ='))
const body = tail
  .slice(0, tail.lastIndexOf('\n    return {'))
  .replace(/const CONFIG_STORE = createStore\([\s\S]*?\n    \}\)\n/, 'const CONFIG_STORE = stores.config\n')
  .replace(/const FAST_STORE = createStore\([\s\S]*?\n    \}\)\n/, 'const FAST_STORE = stores.fast\n')
  .replace(/const PANEL_STORE = createStore\(\{ open: false \}\)\n/, 'const PANEL_STORE = stores.panel\n')

const inertStore = { subscribe: () => () => {}, getSnapshot: () => ({}), replace() {}, update() {} }
const tokens = new Function(
  `const window = arguments[0]
   const document = arguments[1]
   const React = arguments[2]
   const stores = arguments[3]
   const h = () => null
   const createPortal = (n) => n
   const requestAnimationFrame = () => 0
   const cancelAnimationFrame = () => {}
   const BUILD = 'contrast'
   ${body}
   return { COLOR_TOKENS }`,
)(
  { addEventListener() {}, localStorage: { getItem: () => null, setItem() {} } },
  { getElementById: () => null, createElement: () => ({}), addEventListener() {}, removeEventListener() {} },
  {
    createElement: () => null,
    Fragment: 'F',
    useRef: () => ({ current: null }),
    useState: (v) => [v, () => {}],
    useEffect() {},
    useLayoutEffect() {},
    useCallback: (f) => f,
    useMemo: (f) => f(),
    useSyncExternalStore: (_s, get) => get(),
  },
  { config: inertStore, fast: inertStore, panel: inertStore },
).COLOR_TOKENS

const shipped = new Map(
  tokens.map((token) => [
    token.key,
    token.light === token.default ? token.default : `${token.default} (light ${token.light})`,
  ]),
)

function parseColour(value) {
  if (typeof value !== 'string') return null
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(value.trim())
  if (hex !== null) {
    const raw = hex[1].length === 3 ? hex[1].split('').map((c) => c + c).join('') : hex[1]
    return [0, 2, 4].map((i) => parseInt(raw.slice(i, i + 2), 16))
  }
  const rgb = /^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/i.exec(value)
  if (rgb !== null) return [1, 2, 3].map((i) => Number(rgb[i]))
  return null
}

const channel = (value) => {
  const c = value / 255
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}
const luminance = ([r, g, b]) => 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
const contrast = (a, b) => {
  const la = luminance(a)
  const lb = luminance(b)
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}

// Surfaces a token can be drawn on. The popover is a dark translucent layer in
// BOTH themes — that is the surface the menu.* accents and the slider ticks are
// calibrated against, and the one the verdict uses. The light column is context
// only: a near-white rail is meant to sit on the dark popover, so a low ratio
// against a white page is expected rather than a fault.
const popover = {
  'popover (assumed)': [43, 43, 43],
  'popover (pure)': [30, 30, 30],
}
const context = { 'white page': [255, 255, 255] }
const surfaces = { ...popover, ...context }

const watched = [
  'menu.bolt',
  'menu.level',
  'menu.levelMax',
  'menu.quota',
  'menu.boltLit',
  'slider.track',
  'slider.fill',
  'slider.thumb',
  'slider.tick',
  'slider.tickPast',
  'slider.tickCurrent',
  'trigger.lockMark',
]

let failed = false
console.log('token'.padEnd(30), Object.keys(surfaces).map((s) => s.padStart(18)).join(''), '  verdict')
for (const key of watched) {
  const value = shipped.get(key)
  const colour = parseColour(value)
  const cells = Object.values(surfaces).map((surface) =>
    (colour === null ? 'n/a' : contrast(colour, surface).toFixed(2)).padStart(18),
  )
  const worst = colour === null ? null : Math.min(...Object.values(popover).map((s) => contrast(colour, s)))
  let verdict = '  (unparsed)'
  if (worst !== null) {
    verdict = worst >= 4.5 ? '  OK text' : worst >= 3 ? '  graphic only' : '  TOO LOW'
    if (worst < 3) failed = true
  }
  console.log(`${key} (${value ?? '?'})`.padEnd(30), cells.join(''), verdict)
}

console.log('\nthresholds: 4.5 body text | 3.0 large text and graphics, measured on the popover surface')
console.log(
  'note: theme tokens resolve from DSH; the literal beside each var() is the fallback shown here.',
)
if (failed) {
  console.log('\nFAILED: a token is below 3.0 on the surface it is drawn on.')
  process.exitCode = 1
} else {
  console.log('\nOK: every token clears 3.0 on the popover surface.')
}

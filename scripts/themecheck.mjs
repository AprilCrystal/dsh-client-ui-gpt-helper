/**
 * Theme-file check: every palette under `docs/` is complete, uses only tokens the
 * plugin declares, and clears a readability floor on the surface each token is drawn on.
 *
 * Standalone on purpose: it reads `docs/*.json` and `lib/client.js` as TEXT (to learn the
 * token names) and never imports or evaluates the bundle, never touches the host half and
 * never runs the plugin. A palette file is data; checking it must not be able to affect
 * the app.
 *
 *   node scripts/themecheck.mjs
 *
 * Why it exists: these palettes ship as examples, and a palette that names a token the
 * plugin does not declare loses that colour silently on import. A checker that reads a
 * field name which no longer exists is worse than none — an earlier version of this idea
 * printed `?` for every value and still reported OK — so an unparseable or unknown entry
 * fails here rather than being skipped.
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const results = []
const check = (name, ok, detail) => {
  results.push({ name, ok })
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${name}${ok || detail === undefined ? '' : ` — ${detail}`}`)
}

// ── the token names, read as text ───────────────────────────────────────────
const source = readFileSync('lib/client.js', 'utf8')
const keys = [...source.matchAll(/\{ key: '([^']+)', group: '/g)].map((match) => match[1])
check('the plugin declares 24 tokens', keys.length === 24, String(keys.length))

// ── colour maths (WCAG relative luminance) ──────────────────────────────────
const parse = (value) => {
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
const averageOfGradient = (value) => {
  const stops = value
    .replace(/^[^()]*\(/, '')
    .replace(/\)\s*$/, '')
    .split(',')
    .map((part) => part.trim().replace(/^[-\d.]+%?\s+/, ''))
  const parsed = stops.map(parse).filter(Boolean)
  if (parsed.length === 0) return null
  return [0, 1, 2].map((channel) => parsed.reduce((sum, colour) => sum + colour[channel], 0) / parsed.length)
}
const perceived = (value) => (typeof value === 'string' && value.includes('gradient') ? averageOfGradient(value) : parse(value))
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

// Surfaces: the popover is a dark translucent layer, the composer follows the theme.
const POPOVER = [43, 43, 43]
const COMPOSER_DARK = [26, 26, 28]
const COMPOSER_LIGHT = [250, 250, 250]

/** Tokens held to the floor. The ticks and the thumb are design choices, not text. */
const WATCHED = [
  'menu.bolt', 'menu.boltLit', 'menu.level', 'menu.levelMax', 'menu.levelGrad',
  'menu.quota', 'menu.quotaGrad',
  'trigger.bolt', 'trigger.model', 'trigger.level', 'trigger.levelMax', 'trigger.caret', 'trigger.lockMark',
]
const FLOOR = 3.0

// ── every palette file ──────────────────────────────────────────────────────
const DOCS = 'docs'
const files = readdirSync(DOCS).filter((name) => /^theme-.*\.json$/.test(name)).sort()
check('there are palettes to check', files.length > 0, files.join(', '))

for (const file of files) {
  const path = join(DOCS, file)
  let document = null
  try {
    document = JSON.parse(readFileSync(path, 'utf8'))
  } catch (error) {
    check(`${file} parses`, false, error.message)
    continue
  }
  const colours = document.colors
  if (colours === null || typeof colours !== 'object') {
    check(`${file} has a colors object`, false)
    continue
  }
  check(`${file} names a scheme`, typeof document.name === 'string' && document.name !== '', String(document.name))

  const missing = keys.filter((key) => colours[key] === undefined)
  const unknown = Object.keys(colours).filter((key) => !keys.includes(key))
  check(`${file} declares all 24 tokens`, missing.length === 0, missing.join(', '))
  check(`${file} declares no unknown token`, unknown.length === 0, unknown.join(', '))

  const darkOverride = document.overrides?.dark
  if (darkOverride !== undefined) {
    const badOverride = Object.keys(darkOverride).filter((key) => !keys.includes(key))
    check(`${file} dark override uses real tokens`, badOverride.length === 0, badOverride.join(', '))
  }

  // Which side this file is FOR. A deep, dark palette is judged on the dark composer;
  // judging it against a light page would report every accent as unreadable, which says
  // nothing about how it looks where it is meant to be used. `overrides.dark` present
  // means the file describes both sides, so `colors` is the light one.
  const sides = darkOverride === undefined
    ? [{ label: 'dark', set: colours, composer: COMPOSER_DARK }]
    : [
        { label: 'light', set: colours, composer: COMPOSER_LIGHT },
        { label: 'dark', set: { ...colours, ...darkOverride }, composer: COMPOSER_DARK },
      ]

  for (const side of sides) {
    const fill = perceived(side.set['slider.fill']) ?? [81, 132, 244]
    const offenders = []
    for (const key of WATCHED) {
      const value = side.set[key]
      const colour = perceived(value)
      if (colour === null) {
        offenders.push(`${key}=UNPARSED(${String(value)})`)
        continue
      }
      const surface = key.startsWith('menu.') ? POPOVER : side.composer
      const ratio = contrast(colour, surface)
      if (ratio < FLOOR) offenders.push(`${key}=${ratio.toFixed(2)}`)
    }
    // The ticks sit on the fill, and are reported for information only.
    const tick = contrast(perceived(side.set['slider.tick']) ?? [0, 0, 0], fill)
    check(
      `${file} (${side.label}) clears the floor`,
      offenders.length === 0,
      offenders.length === 0 ? `ticks-on-fill ${tick.toFixed(2)} (by design)` : offenders.join(', '),
    )
  }
}

const failed = results.filter((result) => !result.ok)
console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
if (failed.length > 0) {
  console.log(`FAILED: ${failed.map((result) => result.name).join(' | ')}`)
  process.exitCode = 1
}

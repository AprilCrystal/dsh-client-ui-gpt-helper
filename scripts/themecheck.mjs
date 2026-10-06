/**
 * Theme-file check: every palette under `docs/` is complete, uses only tokens the plugin
 * declares, and clears a readability floor on the surface each token is drawn on.
 *
 * Two shapes are accepted, because both are real and a file that is neither must FAIL
 * rather than be skipped:
 *
 *   - the LIBRARY shape, which is what `docs/` ships and what the panel's JSON import
 *     reads: `{ version, schemes: { "<name>": { name, colors } } }`;
 *   - the single-scheme shape `{ version, name, colors }`, which is what a per-scheme
 *     export writes.
 *
 * Standalone on purpose: it reads `docs/*.json` and the token names out of `lib/client.js`
 * as TEXT — it never imports or evaluates the bundle, touches the host half, or runs the
 * plugin. A palette is data, and checking it must not be able to affect the app.
 *
 *   node scripts/themecheck.mjs
 *
 * Why it exists: these palettes ship as examples, and a palette naming a token the plugin
 * does not declare loses that colour silently on import. A checker that reads a field name
 * which no longer exists is worse than none — an earlier version of this idea printed `?`
 * for every value and still reported OK — so an unparseable or unknown entry fails here
 * rather than being skipped.
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
// Matched on `key` and `group` only, so the shape of the entry between them is not
// something this check can be broken by. An earlier pattern required them to be adjacent,
// which a one-line entry with a `value` in between silently defeated.
const keys = [...source.matchAll(/\{\s*key:\s*'([^']+)'\s*,\s*group:/g)].map((match) => match[1])
check('the plugin declares 24 tokens', keys.length === 24, String(keys.length))
if (keys.length !== 24) {
  console.log(`FAILED: could not read the token table — found ${keys.length} entries`)
  process.exitCode = 1
}

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
const perceived = (value) =>
  typeof value === 'string' && value.includes('gradient') ? averageOfGradient(value) : parse(value)
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

/**
 * Tokens held to the floor.
 *
 * The particles and the past/current dots are NOT here: they ride on the FILL, whose
 * colour a palette sets freely, so a floor computed against a fixed surface would reject
 * legible palettes. `slider.tick` is the one dot that sits on the track, and it is held to
 * a floor against that track instead.
 */
const WATCHED = [
  'menu.bolt',
  'menu.boltLit',
  'menu.level',
  'menu.levelMax',
  'menu.levelGrad',
  'menu.quota',
  'menu.quotaGrad',
  'trigger.bolt',
  'trigger.model',
  'trigger.level',
  'trigger.levelMax',
  'trigger.caret',
  'trigger.lockMark',
]
const FLOOR = 3.0
/**
 * The floor for the one dot that sits on the track, set from the shipped palettes rather
 * than from a guess.
 *
 * It is a 4px marker whose job is to be subtly visible, and the contrast a 4px dot needs is
 * far below what 12px text needs. Across the ten shipped palettes the measured value ranges
 * from 1.60 (日落金's dark side, `#5a5145` on `#3a332b` — the palette that shipped in this
 * repository first) to 4.80. The floor sits just under that minimum: it is low enough to
 * accept the design that predates this check, and high enough to catch a tick that has been
 * made invisible. The measured value is printed on every row, because the number is the
 * useful part.
 */
const TICK_FLOOR = 1.55

/** Which side a single-set palette is for: a dark track means it is a dark palette. */
const sideOfScheme = (colours) => {
  const track = perceived(colours['slider.track'])
  return track !== null && luminance(track) < 0.2 ? 'dark' : 'light'
}

/** One resolved palette, measured and reported. */
function measure(label, colours, side) {
  const composer = side === 'dark' ? COMPOSER_DARK : COMPOSER_LIGHT
  const track = perceived(colours['slider.track']) ?? (side === 'dark' ? [58, 58, 62] : [228, 227, 228])
  const offenders = []
  for (const key of WATCHED) {
    const value = colours[key]
    const colour = perceived(value)
    if (colour === null) {
      offenders.push(`${key}=UNPARSED(${String(value)})`)
      continue
    }
    const surface = key.startsWith('menu.') ? POPOVER : composer
    const ratio = contrast(colour, surface)
    if (ratio < FLOOR) offenders.push(`${key}=${ratio.toFixed(2)}`)
  }
  /**
   * The unreached tick is judged against the TRACK, not the composer.
   *
   * It is a 4px dot whose job is to mark a level, and the part of the track the fill has
   * reached uses a different token (`slider.tickPast`) — so this one only ever shows on
   * the bare track. A 4px dot reads at a much lower contrast than 12px text, which is why
   * the floor here is lower than `FLOOR` and the measured value is reported either way:
   * the number is the useful part, and 3.0 there would reject fifty shades of grey dot
   * that are plainly visible.
   */
  const tick = perceived(colours['slider.tick'])
  let tickRatio = null
  if (tick === null) offenders.push('slider.tick=UNPARSED')
  else {
    tickRatio = contrast(tick, track)
    if (tickRatio < TICK_FLOOR) offenders.push(`slider.tick=${tickRatio.toFixed(2)} on the track`)
  }
  const note = tickRatio === null ? '' : ` · tick/track ${tickRatio.toFixed(2)}`
  check(`${label} clears the floor`, offenders.length === 0, offenders.join(', ') + note)
}

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

  // Normalise both shapes into `[name, colours]` pairs, and refuse anything else.
  let schemes = null
  if (document.schemes !== null && typeof document.schemes === 'object') {
    schemes = Object.entries(document.schemes).map(([name, scheme]) => [name, scheme?.colors])
  } else if (document.colors !== null && typeof document.colors === 'object') {
    schemes = [[typeof document.name === 'string' ? document.name : file, document.colors]]
  }
  if (schemes === null || schemes.length === 0) {
    check(`${file} describes at least one scheme`, false)
    continue
  }

  for (const [name, colours] of schemes) {
    if (colours === null || typeof colours !== 'object') {
      check(`${file} / ${name} has a colors object`, false)
      continue
    }
    const missing = keys.filter((key) => colours[key] === undefined)
    const unknown = Object.keys(colours).filter((key) => !keys.includes(key))
    check(`${file} / ${name} declares all 24 tokens`, missing.length === 0, missing.join(', '))
    check(`${file} / ${name} declares no unknown token`, unknown.length === 0, unknown.join(', '))
    // In the library shape the key and the embedded name must agree, or the panel would
    // list one name and store another.
    if (document.schemes !== undefined) {
      check(
        `${file} / ${name} agrees with its own name field`,
        document.schemes[name]?.name === name,
        String(document.schemes[name]?.name),
      )
    }
    measure(`${file} / ${name}`, colours, sideOfScheme(colours))
  }
}

const failed = results.filter((result) => !result.ok)
console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
if (failed.length > 0) {
  console.log(`FAILED: ${failed.map((result) => result.name).join(' | ')}`)
  process.exitCode = 1
}

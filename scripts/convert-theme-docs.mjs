/**
 * Convert every palette in `docs/` to the library shape the panel's JSON import reads.
 *
 * Old shape (two-sided, one scheme per file):
 *   { "version": 1, "name": "樱", "colors": {…}, "overrides": { "dark": {…} } }
 *
 * New shape (a library, so one paste brings both sides in):
 *   { "version": 1, "schemes": { "樱 · 浅色": { "name": …, "colors": {…} },
 *                                "樱 · 深色": { "name": …, "colors": {…} } } }
 *
 * A file with no `overrides.dark` describes a DARK-ONLY palette, so it contributes one
 * scheme. **Those files carry no `name` field** — an earlier batch wrote only `colors` —
 * so the name comes from the filename and the table below. Reading `document.name` blindly
 * turned such a file into `{ "<undefined>": { name: undefined, colors: {} } }` and threw
 * its palette away, which is what happened once already.
 *
 *   node scripts/convert-theme-docs.mjs
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const DOCS = 'docs'

/** Scheme names for the files that do not carry one. */
const NAMES = {
  abyss: '玄青',
  aurora: '极光',
  ember: '烬',
  ink: '墨夜',
  plum: '幽紫',
  moss: '苔',
  neon: '霓虹',
  sakura: '樱',
  sea: '海',
  sunset: '日落金',
}

const files = readdirSync(DOCS).filter((name) => /^theme-.*\.json$/.test(name)).sort()
const report = []

for (const file of files) {
  const path = join(DOCS, file)
  const document = JSON.parse(readFileSync(path, 'utf8'))
  const stem = file.replace(/^theme-/, '').replace(/\.json$/, '')

  // A file that was already converted must not be converted again: its colours now live
  // under `schemes`, and reading `colors` would produce an empty palette.
  if (document.schemes !== undefined) {
    report.push([file, Object.keys(document.schemes), 'already a library — left alone'])
    continue
  }

  const base =
    typeof document.name === 'string' && document.name.trim() !== ''
      ? document.name.trim()
      : NAMES[stem]
  if (base === undefined) {
    console.log(`${file}: no name in the file and none in the table — NOT converted`)
    process.exitCode = 1
    continue
  }

  const dark = document.overrides?.dark
  const schemes = {}
  if (dark === undefined) {
    schemes[base] = { name: base, colors: { ...document.colors } }
  } else {
    schemes[`${base} · 浅色`] = { name: `${base} · 浅色`, colors: { ...document.colors } }
    schemes[`${base} · 深色`] = { name: `${base} · 深色`, colors: { ...document.colors, ...dark } }
  }

  writeFileSync(path, `${JSON.stringify({ version: 1, schemes }, null, 2)}\n`, 'utf8')
  report.push([
    file,
    Object.keys(schemes),
    Object.values(schemes)
      .map((scheme) => Object.keys(scheme.colors).length)
      .join('/'),
  ])
}

for (const [file, names, detail] of report) {
  console.log(`${file.padEnd(24)} ${names.join('  ').padEnd(26)} ${detail}`)
}
console.log(`\nconverted ${report.length} files`)

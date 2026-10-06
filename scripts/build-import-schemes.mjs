/**
 * Convert the two-sided scheme files into the flat documents the reverted (0.4.0)
 * palette panel imports.
 *
 * The panel's **Import** reads `{ version, hotkey, colors }` and ignores everything
 * else, so pasting `docs/theme-*.json` straight in silently drops `overrides` — the
 * dark half of the palette. These converted files carry one resolved set of all 24
 * tokens and nothing else.
 *
 *   node scripts/build-import-schemes.mjs
 *
 * Both sides are emitted for each scheme, because the 0.4.0 plugin has no per-side
 * support: whatever you import applies to the light AND the dark UI. Pick the side
 * that matches how you mostly run the app.
 */
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const DOCS = 'docs'
const TARGET = join(DOCS, 'import')
const HOTKEY = 'Ctrl+Shift+Alt+G'

await mkdir(TARGET, { recursive: true })

const sources = (await readdir(DOCS)).filter((name) => /^theme-.*\.json$/.test(name)).sort()
const written = []

for (const file of sources) {
  const document = JSON.parse(await readFile(join(DOCS, file), 'utf8'))
  const base = file.replace(/^theme-/, '').replace(/\.json$/, '')
  const dark = document.overrides?.dark ?? {}
  const sides = [
    { suffix: 'for-dark', label: '深色', colours: { ...document.colors, ...dark } },
    { suffix: 'for-light', label: '浅色', colours: document.colors },
  ]
  for (const side of sides) {
    const payload = { version: 1, hotkey: HOTKEY, colors: side.colours }
    const target = join(TARGET, `${base}-${side.suffix}.json`)
    await writeFile(target, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
    written.push([`${base}-${side.suffix}.json`, `${document.name} · ${side.label}`, Object.keys(side.colours).length])
  }
}

for (const [name, label, count] of written) {
  console.log(`${name.padEnd(24)} ${label.padEnd(14)} tokens=${count}`)
}
console.log(`\nwrote ${written.length} files into ${TARGET} — paste one into the panel's JSON box and press Import`)

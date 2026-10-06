/**
 * Convert the palette files under `docs/` into the flat documents the palette panel
 * imports.
 *
 * The panel's **Import** reads `{ version, hotkey, colors }` and ignores everything else,
 * so pasting `docs/theme-*.json` straight in silently drops `overrides` — with it, the
 * whole dark half of a two-sided palette.
 *
 * Which files it writes depends on what the source describes:
 *
 *   - a palette with an `overrides.dark` block describes BOTH sides, so two documents are
 *     written: `<name>-for-light.json` (the base `colors`) and `<name>-for-dark.json`
 *     (base with the override applied);
 *   - a palette with NO override is a dark-only palette, meant to be used as it stands, so
 *     only `<name>-for-dark.json` is written. Emitting a `-for-light` twin would publish
 *     the same colours twice under a name that suggests they are light-tuned, which they
 *     are not.
 *
 *   node scripts/build-import-schemes.mjs
 */
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const DOCS = 'docs'
const TARGET = join(DOCS, 'import')
const HOTKEY = 'Ctrl+Shift+Alt+G'

// Rebuilt from scratch so a renamed palette cannot leave its old documents behind.
await rm(TARGET, { recursive: true, force: true })
await mkdir(TARGET, { recursive: true })

const sources = (await readdir(DOCS)).filter((name) => /^theme-.*\.json$/.test(name)).sort()
const written = []

for (const file of sources) {
  const document = JSON.parse(await readFile(join(DOCS, file), 'utf8'))
  const base = file.replace(/^theme-/, '').replace(/\.json$/, '')
  const dark = document.overrides?.dark
  const sides =
    dark === undefined
      ? [{ suffix: 'for-dark', colours: document.colors }]
      : [
          { suffix: 'for-dark', colours: { ...document.colors, ...dark } },
          { suffix: 'for-light', colours: document.colors },
        ]
  for (const side of sides) {
    const payload = { version: 1, hotkey: HOTKEY, colors: side.colours }
    const target = join(TARGET, `${base}-${side.suffix}.json`)
    await writeFile(target, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
    written.push([`${base}-${side.suffix}.json`, document.name, Object.keys(side.colours).length])
  }
}

for (const [name, label, count] of written) {
  console.log(`${name.padEnd(26)} ${label.padEnd(8)} tokens=${count}`)
}
console.log(`\nwrote ${written.length} files into ${TARGET} — paste one into the panel's JSON box and press Import`)

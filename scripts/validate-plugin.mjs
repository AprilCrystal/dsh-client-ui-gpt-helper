// Structural validation for this DSH client plugin.
// Read-only: asserts the contract the DSH client module system relies on.
// Usage: node scripts/validate-plugin.mjs [packageDir]   (default: this package)
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const dir = process.argv[2] ?? new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')
const fail = []
const ok = []

const manifest = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'))

// ── manifest contract ────────────────────────────────────────────────────────
const client = manifest.dsh?.client
if (!client) fail.push('package.json: dsh.client section is required for a browser half')
else {
  if (client.platform !== 'web') fail.push(`package.json: dsh.client.platform must be "web", got ${JSON.stringify(client.platform)}`)
  else ok.push('dsh.client.platform is "web"')
  if (!Array.isArray(client.inject)) fail.push('package.json: dsh.client.inject must be an array')
  else ok.push(`dsh.client.inject orders ${client.inject.length} package(s)`)
}

const clientExport = manifest.exports?.['./client']
if (!clientExport) fail.push('package.json: exports["./client"] is required')
else ok.push(`exports["./client"] -> ${clientExport}`)

if (!manifest.exports?.['.']) fail.push('package.json: exports["."] (host half) is required')
else ok.push(`exports["."] -> ${manifest.exports['.']}`)

// ── host half ────────────────────────────────────────────────────────────────
const hostPath = join(dir, manifest.exports['.'].replace(/^\.\//, ''))
const hostSrc = readFileSync(hostPath, 'utf8')
if (!/export\s+(function\s+apply|const\s+apply|\{[^}]*\bapply\b)/.test(hostSrc)) {
  fail.push(`${manifest.exports['.']}: must export apply()`)
} else ok.push('host half exports apply()')

// ── browser half ─────────────────────────────────────────────────────────────
const browserPath = join(dir, clientExport.replace(/^\.\//, ''))
const browserSrc = readFileSync(browserPath, 'utf8')

if (!browserSrc.includes('__ModuleLoader__.load(')) fail.push(`${clientExport}: must call window.__ModuleLoader__.load({...})`)
else ok.push('browser half uses the __ModuleLoader__.load wrapper')

// The resolved manifest package name identifies the browser module, so the
// factory id must equal it exactly.
const idMatch = browserSrc.match(/\bid:\s*['"]([^'"]+)['"]/)
if (!idMatch) fail.push(`${clientExport}: factory is missing the id field`)
else if (idMatch[1] !== manifest.name) fail.push(`${clientExport}: id "${idMatch[1]}" must equal package name "${manifest.name}"`)
else ok.push(`browser factory id equals the package name (${manifest.name})`)

if (!/factory\s*\(/.test(browserSrc)) fail.push(`${clientExport}: factory(require) is required`)
else ok.push('browser half exposes a factory(require)')

if (!/require\(\s*['"]react['"]\s*\)/.test(browserSrc) && /createElement/.test(browserSrc)) {
  fail.push(`${clientExport}: uses createElement without require('react')`)
}

// ── CSS template integrity ───────────────────────────────────────────────────
// The stylesheet is a JS template literal, so a backtick or a `${` inside it
// terminates or interpolates it. Both have been introduced by accident while
// writing CSS comments, so catch them here instead of at `node --check`.
const cssStart = browserSrc.indexOf('const CSS = `')
if (cssStart === -1) {
  fail.push(`${clientExport}: could not locate the CSS template literal`)
} else {
  const cssEnd = browserSrc.indexOf('`', cssStart + 'const CSS = `'.length)
  const css = cssEnd === -1 ? '' : browserSrc.slice(cssStart + 'const CSS = `'.length, cssEnd)
  if (cssEnd === -1) fail.push(`${clientExport}: CSS template literal is unterminated`)
  const strayBacktick = css.includes('`')
  const interpolation = css.includes('${')
  if (strayBacktick) fail.push(`${clientExport}: CSS block contains a backtick, which ends the template literal`)
  if (interpolation) fail.push(`${clientExport}: CSS block contains \${...}, which the template literal would evaluate`)
  if (!strayBacktick && !interpolation && cssEnd !== -1) {
    ok.push('CSS block is free of backticks and template interpolation')
  }
}

// ── locale coverage ──────────────────────────────────────────────────────────
// Every `t('key')` the component uses must exist in every registered dictionary,
// or the UI renders a raw key at the user.
const usedKeys = [...new Set([...browserSrc.matchAll(/\bt\(\s*'([^']+)'\s*\)/g)].map((m) => m[1]))]
const dictStart = browserSrc.indexOf('const ZH')
const dictEnd = browserSrc.indexOf('// ── icons')
if (dictStart === -1 || dictEnd === -1) {
  fail.push(`${clientExport}: could not locate the locale dictionaries (ZH / EN block)`)
} else {
  const dicts = browserSrc.slice(dictStart, dictEnd)
  for (const locale of ['ZH', 'EN']) {
    const from = dicts.indexOf(`const ${locale} = {`)
    const to = dicts.indexOf('}', from)
    const body = from === -1 ? '' : dicts.slice(from, to)
    const missing = usedKeys.filter((key) => !body.includes(`'${key}'`))
    if (missing.length > 0) fail.push(`${clientExport}: ${locale} dictionary is missing: ${missing.join(', ')}`)
  }
  if (usedKeys.length > 0) ok.push(`locale keys used by the component are all defined (${usedKeys.length})`)
}

// ── report ───────────────────────────────────────────────────────────────────
for (const line of ok) console.log(`  ok   ${line}`)
for (const line of fail) console.log(`  FAIL ${line}`)
console.log(fail.length === 0 ? `\nPASS  ${dir}` : `\nFAILED  ${dir} (${fail.length})`)
process.exit(fail.length === 0 ? 0 : 1)

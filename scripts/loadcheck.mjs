/**
 * Load the bundle the way the app does — classic script calling
 * `window.__ModuleLoader__.load`, then `factory(require)` — with React stubbed.
 * A parse error, an unknown top-level identifier, or a throw during factory() or
 * apply() surfaces here; that is what "import failed" in the web-boot log means.
 *
 * Kept as a script because a browser cannot be asked why it failed to import, and
 * this bundle's import failure takes the whole web boot down with it.
 */
import { readFileSync } from 'node:fs'

const source = readFileSync('lib/client.js', 'utf8')
console.log('bytes:', source.length)

const inertStore = () => ({
  subscribe: () => () => {},
  getSnapshot: () => ({}),
  replace() {},
  update() {},
})

let definition = null
const React = {
  createElement: (type, props, ...children) => ({ type, props, children }),
  Fragment: 'Fragment',
  useRef: (initial) => ({ current: initial }),
  useState: (initial) => [typeof initial === 'function' ? initial() : initial, () => {}],
  useEffect: () => {},
  useLayoutEffect: () => {},
  useCallback: (fn) => fn,
  useMemo: (fn) => fn(),
  useSyncExternalStore: (_subscribe, getSnapshot) => getSnapshot(),
}

const window = {
  __ModuleLoader__: {
    load(loaded) {
      definition = loaded
    },
  },
  addEventListener() {},
  localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
  innerWidth: 1440,
  innerHeight: 900,
}

const document = {
  head: { appendChild() {} },
  body: { appendChild() {}, removeChild() {} },
  getElementById: () => null,
  createElement: () => ({ style: { setProperty() {} }, removeChild() {}, appendChild() {} }),
  addEventListener() {},
  removeEventListener() {},
}

let stage = 'parse'
try {
  new Function(
    'window',
    'document',
    'navigator',
    'performance',
    'requestAnimationFrame',
    'cancelAnimationFrame',
    'console',
    source,
  )(window, document, {}, { now: () => 0 }, () => 0, () => {}, console)
  console.log('1. script evaluated: OK')

  stage = 'registration'
  if (definition === null) throw new Error('the script did not call __ModuleLoader__.load')
  console.log('2. registered id:', definition.id)

  stage = 'factory'
  const instance = definition.factory((name) => {
    if (name === 'react') return React
    if (name === 'react-dom') return { createPortal: (node) => node }
    throw new Error(`unexpected require: ${name}`)
  })
  console.log('3. factory returned:', Object.keys(instance).join(', '))

  stage = 'apply'
  let registered = null
  let locales = 0
  instance.apply({
    effect(fn) {
      fn()
    },
    locale: {
      register() {
        locales += 1
      },
    },
    slots: {
      inject(_name, fn) {
        fn({ name: _name })
      },
      register(entry, component) {
        registered = { entry, component }
        return () => {}
      },
    },
    modelDirectories: { directoryFor: () => ({ store: inertStore(), load: () => {}, select: () => {} }) },
    sessions: { subagentAddress: () => undefined },
  })
  console.log('4. apply(): OK — slot registered:', registered !== null, '| locale dictionaries:', locales)

  stage = 'render'
  const tree = registered.component({
    locked: false,
    available: true,
    directory: inertStore(),
    load: () => {},
    select: () => Promise.resolve({ ok: true }),
    t: (key) => key,
  })
  const children = tree?.props?.children ?? []
  console.log('5. control renders without throwing (tree checked in selfcheck)')

  // NOTE: this calls the component directly, so the tree it returns is empty — the
  // real render-tree checks live in selfcheck.mjs, which has the hook runtime.
  console.log('\nRESULT: OK — the bundle loads and runs the way the app loads it.')
} catch (error) {
  console.log(`\nRESULT: FAILED at stage "${stage}"`)
  console.log(error?.stack ?? String(error))
  process.exitCode = 1
}

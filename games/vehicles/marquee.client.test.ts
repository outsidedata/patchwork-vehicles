// The title's menu as a page shows it, the page made as `index.html` makes it, on a loopback to the
// game's manager, in node with no canvas: the page's key listeners kept and fired by hand. While the
// intro plays nothing of the marquee shows; a key skips it; then ui3d shows the name and a word for
// each place, every word a thing of its menu with its hit box, top to bottom in the order of `places`,
// the first selected. The keys move the selection down and up, stopping at either end, and Enter on a
// word sends the seat to its scene.
import { afterEach, expect, test, vi } from 'vitest'
import type * as THREE from 'three'
import { boot, type Row, type Scene } from '#engine/engine.ts'
import type { Client } from '#engine/browser.ts'
import { accept, link, load, manager, view } from '#addons/scenemanager/scenemanager.addon.ts'
import { loopback } from '#addons/loopback/loopback.addon.ts'
import { keyCode } from '#plugins/player/player.plugin.ts'
import { sim } from './vehicles.sim.ts'
import file from './vehicles.scene.json' with { type: 'json' }
import defs from './assets/vehicles.json' with { type: 'json' }

vi.setConfig({ testTimeout: 180_000 })

const DT = file.prefabs.engine.dt
const base = new URL('./', import.meta.url).href
const places = defs.marquee.places

// The page's listeners, kept so the test can hand them key events as the browser would.
const listeners: { type: string; f: (e: unknown) => void }[] = []
vi.stubGlobal('addEventListener', (type: string, f: (e: unknown) => void) => listeners.push({ type, f }))
vi.stubGlobal('removeEventListener', (type: string, f: (e: unknown) => void) => {
  const k = listeners.findIndex(l => l.type === type && l.f === f)
  if (k >= 0) listeners.splice(k, 1)
})
const key = (name: string) => {
  for (const type of ['keydown', 'keyup']) {
    const e = { key: name, code: keyCode(name), repeat: false, target: null, preventDefault() {}, stopPropagation() {}, ctrlKey: false, metaKey: false, altKey: false }
    for (const l of [...listeners].filter(l => l.type === type)) l.f(e)
  }
}
// The UI listens once it has a canvas: a stand-in.
const mount = (me: Client) => {
  me.plugins.ui.canvas = { addEventListener() {}, removeEventListener() {}, style: {}, remove() {}, width: 1280, height: 720 }
}
// One turn of node's event loop, as a browser gives one between frames: the loader reads a file from
// disk, which lands only when the loop turns.
const turn = () => new Promise<void>(done => setImmediate(done))

const pages: ReturnType<typeof view>[] = []
afterEach(() => { for (const p of pages.splice(0)) p.close() })

test('after the intro the title\'s words are ui3d\'s menu, moved by the keys, and Enter goes to the selected place', async () => {
  const truth = boot(structuredClone(file) as Scene, sim)
  await load(truth, base)
  const page = view(link(loopback(accept(manager(truth)))), file as Scene, base, mount)
  pages.push(page)
  const frame = async () => {
    truth.step(DT)
    await page.frame()
    await turn()
  }
  const until = async (ok: () => boolean, most: number) => {
    for (let k = 0; k < most && !ok(); k++) await frame()
    expect(ok()).toBe(true)
  }
  const thing = (k: string) => (page.client?.plugins.render3d.overlay.scene as THREE.Scene | undefined)?.getObjectByName(k)
  const box = (k: string) => thing(`${k}.box`) as THREE.Mesh<THREE.BoxGeometry> | undefined
  const selected = () => page.client!.plugins.ui3d.selected() as string | undefined
  const intro = () => page.client?.plugins.wire.rows.find((r: Row) => r.kind === 'cutscene')?.data

  // nothing of the marquee while the intro plays; a key skips it
  await until(() => !!intro()?.running, 1800)
  expect(thing('name')).toBeUndefined()
  expect(thing('place.0')).toBeUndefined()
  key('x')
  await until(() => !!intro()?.done, 120)

  // the name, the lights and every place's word, each with its hit box once it has geometry
  await until(() => !!thing('name') && places.every((_, i) => !!box(`place.${i}`)), 600)
  expect(thing('key')).toBeDefined()
  expect(thing('sweep')).toBeDefined()
  expect(box('name')).toBeUndefined()
  // the words top to bottom, in the order of `places`, as the camera draws them
  const down = places.map((_, i) => {
    const b = box(`place.${i}`)!
    expect(b.geometry.parameters.width).toBeGreaterThan(b.geometry.parameters.height)
    return page.client!.plugins.render3d.project(b.getWorldPosition(b.position.clone()).toArray()).y as number
  })
  for (let i = 1; i < down.length; i++) expect(down[i]).toBeGreaterThan(down[i - 1])

  // the first selected; the keys move it down and up, stopping at either end
  expect(selected()).toBe('place.0')
  key('ArrowUp')
  await frame()
  expect(selected()).toBe('place.0')
  for (let i = 1; i < places.length; i++) {
    key('ArrowDown')
    await frame()
    expect(selected()).toBe(`place.${i}`)
  }
  key('ArrowDown')
  await frame()
  expect(selected()).toBe(`place.${places.length - 1}`)
  key('ArrowUp')
  await frame()
  const at = places.length - 2
  expect(selected()).toBe(`place.${at}`)

  // Enter sends the seat to the selected word's scene
  key('Enter')
  await until(() => page.name === places[at].scene, 120)
})

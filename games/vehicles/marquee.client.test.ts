// The title as a page shows it, the page made as `index.html` makes it, on a loopback to the game's
// manager, in node with no canvas: the page's key listeners kept and fired by hand. Once the page has
// loaded, ui3d shows the name and a word for each place, every word a thing of its menu with its hit
// box, top to bottom in the order of `places`, the first selected, the camera circling the jeep. The
// keys move the selection down and up, stopping at either end, and Enter on a word sends the seat to
// its scene. The title makes no sound and the scene it sends the seat to does: the page runs on a
// stand-in AudioContext that keeps the gain every sound goes out through.
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

// An AudioContext that keeps each gain it makes, the first of which is the one every sound goes out
// through. A file it is asked to decode never comes, so no sound is ever started.
class Param {
  value = 1
  setTargetAtTime() {}
  linearRampToValueAtTime() {}
  setValueAtTime() {}
  cancelScheduledValues() {}
}
class Node {
  connect(to: Node) { return to }
  disconnect() {}
}
class Gain extends Node { gain = new Param() }
class Context {
  static made: Context[] = []
  state = 'running'
  currentTime = 0
  destination = new Node()
  listener = Object.fromEntries(['positionX', 'positionY', 'positionZ', 'forwardX', 'forwardY', 'forwardZ', 'upX', 'upY', 'upZ'].map(k => [k, new Param()]))
  gains: Gain[] = []
  closed = false
  constructor() { Context.made.push(this) }
  addEventListener() {}
  resume() { return Promise.resolve() }
  close() { this.closed = true; return Promise.resolve() }
  createGain() { const g = new Gain(); this.gains.push(g); return g }
  decodeAudioData() { return new Promise<never>(() => {}) }
}

const pages: ReturnType<typeof view>[] = []
afterEach(() => {
  for (const p of pages.splice(0)) p.close()
  Context.made.length = 0
  delete (globalThis as { AudioContext?: unknown }).AudioContext
})

async function enter() {
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
  const shown = () => !!thing('name') && places.every((_, i) => !!box(`place.${i}`))
  return { page, frame, until, thing, box, selected, shown }
}

test('once the page has loaded the title\'s words are ui3d\'s menu, moved by the keys, and Enter goes to the selected place', async () => {
  const g = await enter()

  // the name, the lights and every place's word, each with its hit box once it has geometry
  await g.until(g.shown, 1800)
  expect(g.thing('key')).toBeDefined()
  expect(g.thing('sweep')).toBeDefined()
  expect(g.box('name')).toBeUndefined()
  // the words top to bottom, in the order of `places`, as the camera draws them
  const down = places.map((_, i) => {
    const b = g.box(`place.${i}`)!
    expect(b.geometry.parameters.width).toBeGreaterThan(b.geometry.parameters.height)
    return g.page.client!.plugins.render3d.project(b.getWorldPosition(b.position.clone()).toArray()).y as number
  })
  for (let i = 1; i < down.length; i++) expect(down[i]).toBeGreaterThan(down[i - 1])

  // the first selected; the keys move it down and up, stopping at either end
  expect(g.selected()).toBe('place.0')
  key('ArrowUp')
  await g.frame()
  expect(g.selected()).toBe('place.0')
  for (let i = 1; i < places.length; i++) {
    key('ArrowDown')
    await g.frame()
    expect(g.selected()).toBe(`place.${i}`)
  }
  key('ArrowDown')
  await g.frame()
  expect(g.selected()).toBe(`place.${places.length - 1}`)
  key('ArrowUp')
  await g.frame()
  const at = places.length - 2
  expect(g.selected()).toBe(`place.${at}`)

  // Enter sends the seat to the selected word's scene
  key('Enter')
  await g.until(() => g.page.name === places[at].scene, 120)
})

test('the camera circles the jeep, as far from it as the title\'s definition says', async () => {
  const g = await enter()
  await g.until(g.shown, 1800)
  const C = defs.marquee.camera
  const plugins = g.page.client!.plugins
  for (let k = 0; k < 30; k++) {
    await g.frame()
    const jeep = plugins.wire.rows.find((r: Row) => r.kind === 'driver')!.data
    const at = plugins.render3d.camera.position
    expect(Math.hypot(at.x - jeep.pos[0], at.z - jeep.pos[2])).toBeCloseTo(Math.hypot(C.pos[0], C.pos[2]), 3)
    expect(at.y - jeep.pos[1]).toBeCloseTo(C.pos[1], 3)
  }
})

test('the title is silent and the scene its words lead to is not', async () => {
  ;(globalThis as { AudioContext?: unknown }).AudioContext = Context
  const g = await enter()
  await g.until(g.shown, 1800)
  for (let k = 0; k < 30; k++) await g.frame()
  expect(Context.made).toHaveLength(1)
  expect(Context.made[0].gains[0].gain.value).toBe(0)

  const to = places.findIndex(p => p.scene === 'moon')
  for (let i = 0; i < to; i++) {
    key('ArrowDown')
    await g.frame()
  }
  key('Enter')
  await g.until(() => g.page.name === 'moon', 120)
  for (let k = 0; k < 30; k++) await g.frame()
  expect(Context.made).toHaveLength(2)
  expect(Context.made[0].closed).toBe(true)
  expect(Context.made[1].gains[0].gain.value).toBe(1)
})

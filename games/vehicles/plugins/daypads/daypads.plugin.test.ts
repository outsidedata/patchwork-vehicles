// The day pads of the gym as a page draws them, the page made as `index.html` makes it, on a loopback to the game's
// manager, in node with no canvas. Once the clock's item has landed, every pad of the gym's entry has its column, a
// cylinder of the definition's size standing on the land at the pad's place, and a copy of the one clock over it, `clock.lift`
// metres up, its hour hand and minute hand turned to the pad's hour, the dial turned to face the camera. What the page
// made is let go of when it closes.
import { afterEach, expect, test, vi } from 'vitest'
import * as THREE from 'three'
import { boot, type Row, type Scene } from '#engine/engine.ts'
import type { Client } from '#engine/browser.ts'
import { accept, link, load, manager, view } from '#addons/scenemanager/scenemanager.addon.ts'
import { loopback } from '#addons/loopback/loopback.addon.ts'
import { sim } from '../../vehicles.sim.ts'
import { handsAt } from './daypads.plugin.ts'
import file from '../../vehicles.scene.json' with { type: 'json' }
import gym from '../../gym.scene.json' with { type: 'json' }
import defs from '../../assets/vehicles.json' with { type: 'json' }

vi.setConfig({ testTimeout: 300_000 })

const DT = file.prefabs.engine.dt
const base = new URL('../../', import.meta.url).href
const k = defs.daypads

vi.stubGlobal('addEventListener', () => {})
vi.stubGlobal('removeEventListener', () => {})
// The UI listens once it has a canvas: a stand-in.
const mount = (me: Client) => {
  me.plugins.ui.canvas = { addEventListener() {}, removeEventListener() {}, style: {}, remove() {}, width: 1280, height: 720 }
}
// One turn of node's event loop, as a browser gives one between frames: the loader reads a file from disk, which lands
// only when the loop turns.
const turn = () => new Promise<void>(done => setImmediate(done))

// An AudioContext that never decodes a sound, for the gym's audio plugin.
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
class Context {
  state = 'running'
  currentTime = 0
  destination = new Node()
  listener = Object.fromEntries(['positionX', 'positionY', 'positionZ', 'forwardX', 'forwardY', 'forwardZ', 'upX', 'upY', 'upZ'].map(n => [n, new Param()]))
  addEventListener() {}
  resume() { return Promise.resolve() }
  close() { return Promise.resolve() }
  createGain() { return Object.assign(new Node(), { gain: new Param() }) }
  decodeAudioData() { return new Promise<never>(() => {}) }
}
vi.stubGlobal('AudioContext', Context)

const pages: ReturnType<typeof view>[] = []
afterEach(() => { for (const p of pages.splice(0)) p.close() })

async function enter() {
  const scene = structuredClone(file) as Scene
  scene.prefabs.scenemanager.entry = 'gym'
  const truth = boot(scene, sim)
  await load(truth, base)
  const page = view(link(loopback(accept(manager(truth)))), scene, base, mount)
  pages.push(page)
  const frame = async () => {
    truth.step(DT)
    await page.frame()
    await turn()
  }
  const until = async (ok: () => boolean, most: number) => {
    for (let n = 0; n < most && !ok(); n++) await frame()
    expect(ok()).toBe(true)
  }
  return { page, frame, until }
}

const entry = gym.actors.find(a => 'is' in a && a.is === 'daypads') as { pads: { x: number; z: number; hour: number; colour: string }[] }

test('every pad has its column and a clock over it with its hands at the pad\'s hour, facing the camera', async () => {
  const g = await enter()
  const plugins = () => g.page.client!.plugins
  const scene = () => g.page.client?.plugins.render3d?.scene as THREE.Scene | undefined
  const bones = (name: string) => { const found: THREE.Object3D[] = []; scene()?.traverse(o => { if (o.name === name) found.push(o) }); return found }
  await g.until(() => bones(k.clock.hands.hour).length === entry.pads.length, 1800)

  const row = plugins().wire.rows.find((r: Row) => r.kind === 'daypads')!
  const foot = row.data.foot as number[]
  const camera = plugins().render3d.camera as THREE.Camera
  const axis = new THREE.Vector3(...(k.clock.hands.axis as [number, number, number]))
  // the top object of the scene each thing hangs in
  const top = (o: THREE.Object3D) => { let t = o; while (t.parent && t.parent !== scene()) t = t.parent; return t }

  entry.pads.forEach((pad, i) => {
    // the column: a cylinder of the definition's size standing on the land at the pad's place
    const columns = scene().children.filter(o => (o as THREE.Mesh).geometry instanceof THREE.CylinderGeometry && Math.abs(o.position.x - pad.x) < 1e-9 && Math.abs(o.position.z - pad.z) < 1e-9) as THREE.Mesh<THREE.CylinderGeometry>[]
    expect(columns).toHaveLength(1)
    const column = columns[0]
    expect(column.position.y).toBe(foot[i])
    expect(column.geometry.parameters.radiusTop).toBe(k.radius)
    expect(column.geometry.parameters.height).toBe(k.height)
    expect(column.castShadow).toBe(false)
    expect((column.material as THREE.MeshStandardMaterial).color.getHexString()).toBe(new THREE.Color(pad.colour).getHexString())

    // the clock: the copy standing over this pad, its hands turned to the pad's hour
    const hand = bones(k.clock.hands.hour).find(b => Math.abs(top(b).position.x - pad.x) < 1e-9 && Math.abs(top(b).position.z - pad.z) < 1e-9)!
    expect(hand).toBeDefined()
    const clock = top(hand)
    expect(clock.position.y).toBeCloseTo(foot[i] + k.clock.lift, 9)
    const at = handsAt(pad.hour)
    const minute = bones(k.clock.hands.minute).find(b => top(b) === clock)!
    expect(hand.quaternion.angleTo(new THREE.Quaternion().setFromAxisAngle(axis, (at.hour * Math.PI) / 180))).toBeLessThan(1e-6)
    expect(minute.quaternion.angleTo(new THREE.Quaternion().setFromAxisAngle(axis, (at.minute * Math.PI) / 180))).toBeLessThan(1e-6)
    // the dial's normal, -z at the item's zero, points at the camera along the ground
    const normal = new THREE.Vector3(0, 0, -1).applyQuaternion(clock.quaternion)
    const to = new THREE.Vector3(camera.position.x - pad.x, 0, camera.position.z - pad.z).normalize()
    expect(normal.dot(to)).toBeGreaterThan(1 - 1e-6)
  })

  // each copy is its own: the three clocks' hour hands are not one object, and the hands differ with the hours
  const hands = bones(k.clock.hands.hour)
  expect(new Set(hands).size).toBe(entry.pads.length)
  expect(new Set(hands.map(h => h.quaternion.w.toFixed(6))).size).toBe(new Set(entry.pads.map(p => handsAt(p.hour).hour.toFixed(6))).size)

  // closing lets go of everything the page made
  const before = scene()
  g.page.close()
  pages.length = 0
  expect(before.children.filter(o => (o as THREE.Mesh).geometry instanceof THREE.CylinderGeometry)).toHaveLength(0)
  const left: THREE.Object3D[] = []
  before.traverse(o => { if (o.name === k.clock.hands.hour) left.push(o) })
  expect(left).toHaveLength(0)
})

test('the hands show the hour: a quarter past three is a quarter turn of the minute hand and a quarter of three twelfths', () => {
  expect(handsAt(3.25)).toEqual({ hour: 97.5, minute: 90 })
  expect(handsAt(0)).toEqual({ hour: 0, minute: 0 })
  expect(handsAt(12)).toEqual({ hour: 0, minute: 0 })
  expect(handsAt(23.5)).toEqual({ hour: 345, minute: 180 })
})

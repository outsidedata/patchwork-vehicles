// One seat's keys and gamepad on one page on vehicles's manager, as `index.html` makes it: the triggers,
// the left stick, the buttons, the start button and the menu it opens, the right stick's look round,
// and the rumble of a crash. The page listens on a stand-in for the window that keeps every listener
// with its phase, the UI's in the capture phase first, as a browser hands them a key, and reads a
// stand-in gamepad each frame. What each press did is read off the road's rows, by id after every
// step, since the road runs ahead and the server's rewind may load its truth again.
import { afterEach, expect, test, vi } from 'vitest'
import type * as THREE from 'three'
import { boot, type Row, type Scene, type Truth } from '#engine/engine.ts'
import { accept, link, load, manager, view } from '#addons/scenemanager/scenemanager.addon.ts'
import { loopback } from '#addons/loopback/loopback.addon.ts'
import { heard } from '#addons/heard/heard.addon.ts'
import { keyCode, possessed } from '#plugins/player/player.plugin.ts'
import { sim } from './vehicles.sim.ts'
import file from './vehicles.scene.json'
import defs from './assets/vehicles.json'

vi.setConfig({ testTimeout: 300_000 })

const DT = file.prefabs.engine.dt
const here = new URL('./', import.meta.url).href
const { deadzone, resolution } = file.world.player

// The page's listeners by type and phase: the UI listens in the capture phase, and the player asks it
// whether it took a key, so a key reaches the capture listeners first, as in a browser.
type On = { type: string; f: (e: unknown) => void; capture: boolean }
const listening: On[] = []
vi.stubGlobal('addEventListener', (type: string, f: (e: unknown) => void, o?: unknown) => { listening.push({ type, f, capture: o === true }) })
vi.stubGlobal('removeEventListener', (type: string, f: (e: unknown) => void, o?: unknown) => {
  const i = listening.findIndex(x => x.type === type && x.f === f && x.capture === (o === true))
  if (i >= 0) listening.splice(i, 1)
})
const key = (type: 'keydown' | 'keyup', k: string) => {
  const e = { code: keyCode(k), key: k, repeat: false, target: null, preventDefault() {} }
  for (const capture of [true, false]) for (const o of listening.filter(o => o.type === type && o.capture === capture)) o.f(e)
}

// One Xbox pad, its buttons in the standard mapping and its four axes, shaking into `shook`.
type Effect = { startDelay: number; duration: number; strongMagnitude: number; weakMagnitude: number }
const shook: Effect[] = []
const pad = {
  connected: true,
  id: 'Xbox Wireless Controller (STANDARD GAMEPAD Vendor: 045e Product: 0b13)',
  buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })),
  axes: [0, 0, 0, 0],
  vibrationActuator: { playEffect: (_type: string, e: Effect) => { shook.push(e); return Promise.resolve('complete') } },
}
vi.stubGlobal('navigator', { getGamepads: () => [pad] })
const button = (i: number, value: number) => { pad.buttons[i] = { pressed: value > 0, value } }
// A stick pushed `v` past the dead zone, out of the rest of the way to the rim, as the page reads it.
const out = (v: number) => Math.sign(v) * (deadzone + Math.abs(v) * (1 - deadzone))
afterEach(() => {
  for (let i = 0; i < pad.buttons.length; i++) button(i, 0)
  pad.axes = [0, 0, 0, 0]
  shook.length = 0
})

// What render3d draws on and the UI listens through: no renderer is made in node.
const surface = (s: Scene) => ({ addEventListener: () => {}, removeEventListener: () => {}, style: {} as any, width: s.prefabs.engine.width, height: s.prefabs.engine.height, remove() {} })

async function start() {
  const truth = boot(structuredClone(file) as Scene, sim)
  const places = await load(truth, here)
  const road = places.get('road')!
  const answered = heard(road)
  const p = view(link(loopback(accept(manager(truth)))), file as Scene, here, (me, s) => {
    me.plugins.render3d.canvas = surface(s)
    me.plugins.ui.canvas = surface(s)
  })
  // A step of the truth, then the page's frame, which reads the gamepad and sends what changed.
  const frames = async (k: number) => { for (let i = 0; i < k; i++) { truth.step(DT); await p.frame() } }
  // The page comes to the title, the entry, and goes to the plains by the marquee's first word.
  await frames(2)
  p.client!.plugins.scenemanager.go(defs.marquee.places[0].scene)
  await frames(30)
  const row = (t: Truth, id: number) => t.rows.find(r => r.id === id)!
  const me = (): Row => row(road, possessed(p.client!.rows)!.id)
  const car = (): Row | undefined => me().data.held && row(road, me().data.held.id)
  const until = async (done: () => boolean, max: number, what: string) => {
    for (let i = 0; i < max && !done(); i++) await frames(1)
    if (!done()) throw new Error(`${what} did not happen in ${max} frames`)
  }
  // The pad's left button, `next`, pressed and let go: the seat put in the next free car's seat.
  const next = async () => {
    const from = me().data.held?.id
    button(2, 1)
    await frames(1)
    button(2, 0)
    await until(() => me().data.board === 'seated' && me().data.held?.id !== from, 600, 'seated in the next car')
  }
  return { truth, places, road, p, frames, me, car, until, next, answered, ui: () => p.client!.plugins.ui }
}

test('in a car the triggers work the pedal as far as each is squeezed, the left stick the steering as far as it is pushed, and the bottom button the brake, each on the step after the frame that read it', async () => {
  const g = await start()
  await g.next()
  const pedal = () => g.car()!.data.pedal, steer = () => g.car()!.data.steer
  // The pad read on a frame, its message taken on the next step and not before.
  const read = async (set: () => void, value: () => unknown, was: unknown, now: unknown) => {
    set()
    await g.p.frame()
    expect(value()).toEqual(was)
    g.truth.step(DT)
    expect(value()).toEqual(now)
    await g.p.frame()
  }
  await read(() => button(7, 0.5), pedal, 0, 0.5)
  // Both triggers: the right less the left.
  await read(() => button(6, 0.25), pedal, 0.5, 0.25)
  await read(() => { button(7, 0); button(6, 1) }, pedal, 0.25, -1)
  await read(() => button(6, 0), pedal, -1, 0)
  // Positive left: the stick half way out to the right steers half right, all the way left full left.
  await read(() => { pad.axes[0] = out(0.5) }, steer, 0, -0.5)
  await read(() => { pad.axes[0] = out(-1) }, steer, -0.5, 1)
  await read(() => { pad.axes[0] = 0 }, steer, 1, 0)
  await read(() => button(0, 1), () => g.car()!.data.brake, 0, 1)
  await read(() => button(0, 0), () => g.car()!.data.brake, 1, 0)
  // Every pedal and steer the road answered was a whole number of steps of the scene's resolution.
  for (const h of g.answered.filter(h => h.msg.action === 'pedal' || h.msg.action === 'steer')) {
    expect(Number.isInteger((h.msg.args[0] as number) * resolution)).toBe(true)
  }
  expect(g.answered.filter(h => h.msg.action === 'steer').map(h => h.msg.args[0])).toEqual([-0.5, 1, 0])
  // The keyboard drives it too, all the way.
  await read(() => key('keydown', 'ArrowUp'), pedal, 0, 1)
  await read(() => key('keyup', 'ArrowUp'), pedal, 1, 0)
})

test('on foot the left stick walks and turns the person as far as it is pushed, the triggers walk it nothing, and the right button held runs', async () => {
  const g = await start()
  const stick = () => g.me().data.stick
  pad.axes = [out(0.5), out(-0.75), 0, 0]
  await g.p.frame()
  expect(stick()).toEqual([0, 0])
  g.truth.step(DT)
  expect(stick()).toEqual([-0.5, 0.75])
  button(7, 1)
  button(1, 1)
  await g.frames(2)
  expect(stick()).toEqual([-0.5, 0.75])
  expect(g.me().data.run).toBe(true)
  // The d-pad holds a way all the way.
  pad.axes = [0, 0, 0, 0]
  button(12, 1)
  await g.frames(2)
  expect(stick()).toEqual([0, 1])
  button(12, 0)
  button(7, 0)
  button(1, 0)
  await g.frames(2)
  expect(stick()).toEqual([0, 0])
  expect(g.me().data.run).toBe(false)
  // The top button gets it in the car it stands by.
  button(3, 1)
  await g.frames(2)
  expect(g.me().data.board).toBe('approach')
})

test('start or Escape opens where to drive, which holds the input: the d-pad moves its focus, the right button or Escape closes it, and the bottom button drives to the place focused', async () => {
  const g = await start()
  const panel = defs.atlas.panel
  const places = defs.atlas.places
  const shown = (i: number) => g.ui().panel(panel).getChildByLabel(`place.${places[i].scene}`)!
  button(9, 1)
  await g.frames(2)
  button(9, 0)
  expect(g.ui().opened(panel)).toBe(true)
  expect(g.ui().modal()).toBe(panel)
  expect(g.ui().focused(shown(0))).toBe(true)
  // Every place is a button labelled as the definition says, where it says.
  places.forEach((place, i) => {
    expect(shown(i).position.x).toBe(place.at[0])
    expect(shown(i).position.y).toBe(place.at[1])
    expect(shown(i).getChildAt(1).text).toBe(place.label)
  })
  expect(g.ui().panel(panel).getChildByLabel('title')!.text).toBe(defs.atlas.title.text)
  // While it is open the left stick walks no seat.
  pad.axes = [out(1), out(-1), 0, 0]
  await g.frames(2)
  expect(g.me().data.stick).toEqual([0, 0])
  pad.axes = [0, 0, 0, 0]
  await g.frames(2)
  expect(g.ui().focused(shown(0))).toBe(true)
  button(13, 1)
  await g.frames(1)
  button(13, 0)
  await g.frames(1)
  expect(g.ui().focused(shown(1))).toBe(true)
  // The right button closes it, and Escape opens and closes it.
  button(1, 1)
  await g.frames(1)
  button(1, 0)
  await g.frames(1)
  expect(g.ui().opened(panel)).toBe(false)
  key('keydown', 'Escape')
  key('keyup', 'Escape')
  await g.frames(1)
  expect(g.ui().opened(panel)).toBe(true)
  key('keydown', 'Escape')
  key('keyup', 'Escape')
  await g.frames(1)
  expect(g.ui().opened(panel)).toBe(false)
  // Opened again, down twice to the gym, pressed: the seat drives the gym.
  button(9, 1)
  await g.frames(1)
  button(9, 0)
  await g.frames(1)
  for (let i = 0; i < 2; i++) {
    button(13, 1)
    await g.frames(1)
    button(13, 0)
    await g.frames(1)
  }
  expect(g.ui().focused(shown(2))).toBe(true)
  expect(places[2].scene).toBe('gym')
  const left = g.p.client!
  button(0, 1)
  await g.until(() => g.p.name === 'gym', 120, 'the seat in the gym')
  button(0, 0)
  expect(left.plugins.scenemanager.here).toBe(false)
  await g.frames(30)
  const gym = g.places.get('gym')!
  const mine = possessed(g.p.client!.rows)!
  expect(gym.rows.find(r => r.id === mine.id)!.kind).toBe('player')
  expect(g.p.client!.plugins.ui.opened(panel)).toBe(false)
})

test('the right stick swings the camera round the person it follows and back, and nothing of it is sent', async () => {
  const g = await start()
  await g.frames(120)
  const camera = () => (g.p.client!.plugins.render3d.camera as THREE.PerspectiveCamera).position
  const stood = [...g.me().data.pos]
  // The horizontal way from the person to the eye.
  const around = () => Math.atan2(camera().x - g.me().data.pos[0], camera().z - g.me().data.pos[2])
  const behind = around(), high = camera().y
  pad.axes = [0, 0, out(1), 0]
  await g.frames(240)
  const swung = around() - behind
  expect(Math.atan2(Math.sin(swung), Math.cos(swung))).toBeCloseTo(-defs.player.orbit.yaw, 2)
  pad.axes = [0, 0, 0, out(1)]
  await g.frames(240)
  const back = around() - behind
  expect(Math.atan2(Math.sin(back), Math.cos(back))).toBeCloseTo(0, 2)
  expect(camera().y).toBeGreaterThan(high + 0.5)
  pad.axes = [0, 0, 0, 0]
  await g.frames(240)
  expect(camera().y).toBeCloseTo(high, 2)
  expect(g.answered.filter(h => h.msg.action === 'look')).toEqual([])
  expect(g.me().data.pos).toEqual(stood)
})

// The change in the held car's chassis velocity, as the page draws it, since the last time it was
// asked: over the last frame, which took one step.
const jolts = (g: Awaited<ReturnType<typeof start>>) => {
  let was: number[] | undefined
  return () => {
    const rows = g.p.client!.rows, car = rows.find(r => r.id === g.car()!.id)!
    const vel = rows.find(r => r.id === car.data.chassis)!.data.vel as number[]
    const dv = was ? Math.hypot(vel[0] - was[0], vel[1] - was[1], vel[2] - was[2]) : 0
    was = [...vel]
    return dv
  }
}

test('a crash of the car the seat drives shakes the pad as hard as the jolt over rumble.full, and standing still shakes it not at all', async () => {
  const g = await start()
  const r = defs.player.rumble
  await g.next()
  await g.next()
  expect(g.car()!.data.vehicle).toBe('jeep')
  await g.frames(60)
  expect(shook).toEqual([])
  // Full throttle along the road until it hits something.
  button(7, 1)
  await g.until(() => shook.some(e => e.strongMagnitude >= r.strong * 0.99), 1500, 'a crash at full shake')
  for (const e of shook) {
    expect(e.duration).toBe(r.seconds * 1000)
    expect(e.strongMagnitude).toBeGreaterThanOrEqual(r.strong * (r.from / r.full) - 1e-9)
    expect(e.strongMagnitude).toBeLessThanOrEqual(r.strong)
    expect(e.weakMagnitude).toBeCloseTo((e.strongMagnitude / r.strong) * r.weak, 9)
  }
})

test('driven on the keyboard, the same crash shakes no pad, even one that got the seat into the car', async () => {
  const g = await start()
  const r = defs.player.rumble
  await g.next()
  await g.next()
  expect(g.car()!.data.vehicle).toBe('jeep')
  const jolt = jolts(g)
  jolt()
  key('keydown', 'ArrowUp')
  let most = 0
  for (let i = 0; i < 1500 && most < r.full; i++) {
    await g.frames(1)
    most = Math.max(most, jolt())
  }
  key('keyup', 'ArrowUp')
  // The jeep jolted as hard as the pad's full shake, and nothing shook.
  expect(most).toBeGreaterThanOrEqual(r.full)
  expect(shook).toEqual([])
})

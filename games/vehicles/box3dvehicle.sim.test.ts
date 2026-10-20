// box3dvehicle with vehicles's fleet, as its scene file writes it, on flat box3d ground, whose top is
// y = 0. The test writes its own scenes: a manager and one child, a yard, which `load` boots as a
// game's would, so box3d is handed the car's kinds by box3dvehicle's mod, and box3dvehicle box3d's
// gravity by box3d's (`world.box3dvehicle.mods.gravity`). A write the test makes to the car's row
// between steps is what a rule would write.
import { afterAll, expect, test } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { boot, type Scene, type Truth, type W } from '#engine/engine.ts'
import { load } from '#addons/scenemanager/scenemanager.addon.ts'
import { scenemanager } from '#plugins/scenemanager/scenemanager.sim.ts'
import type { Static } from '#plugins/box3d/box3d.sim.ts'
import { standing, torqueAt, turn, type Electric, type Fleet, type Petrol, type Vehicle } from '#plugins/box3dvehicle/box3dvehicle.sim.ts'
import vehiclesFile from './vehicles.scene.json'

const DT = 1 / 60
const G = 10
const surface = { friction: 0.9, restitution: 0, rollingResistance: 0 }
const flat: Static = { pos: [0, -1, 0], rot: [0, 0, 0, 1], shapes: [{ box: [2000, 1, 200],baseMaterial: surface }] }

// The scene's fleet: the one vehicle a yard makes, `car`, its parts of the kinds `body`, `tyre` and
// `axle`, in box3d's gravity unless `mods` says otherwise.
const fleet = (v: Vehicle, mods: Fleet['mods'] = { gravity: 'box3d' }): Fleet => ({ chassis: 'body', wheel: 'tyre', joint: 'axle', vehicles: { car: v }, mods })

const dir = mkdtempSync(join(tmpdir(), 'box3dvehicle-'))
afterAll(() => rmSync(dir, { recursive: true }))
const path = (p: string) => JSON.stringify(new URL(p, import.meta.url).pathname)
let made = 0

// A yard with one car made at height `y` on flat ground, falling `g` m/s², booted and loaded: its
// truth, and its `w` as the last step left it.
async function yard(v: Vehicle, y = 1, flip = false, g = G, mods?: Fleet['mods'], ground: Static = flat): Promise<{ truth: Truth; w: () => W }> {
  const name = `yard${made++}`
  const at = { pos: [0, 0, 0], rot: [0, 0, 0, 1], vel: [0, 0, 0], spin: [0, 0, 0], awake: true }
  const actors = [{ is: 'box3d' }, { is: 'box3dvehicle', vehicle: 'car', pos: [0, y, 0], rot: [0, 0, 0, 1] }]
  const scene = {
    world: { box3d: { gravity: [0, -g, 0], subStepCount: 4, static: [ground], kinds: {}, mods: { kinds: 'box3dvehicle' } }, box3dvehicle: fleet(v, mods) },
    prefabs: { engine: { dt: DT }, scenemanager: { out: {} }, box3d: {}, box3dvehicle: { throttle: 0, brake: 0, steer: 0 }, body: at, tyre: at, axle: {}, probe: {} },
    actors: [{ is: 'scenemanager' }, ...(flip ? actors.reverse() : actors), { is: 'probe' }],
    plugins: ['scenemanager'],
  }
  writeFileSync(join(dir, `${name}.scene.json`), JSON.stringify(scene))
  writeFileSync(join(dir, `${name}.sim.ts`), `
import { scenemanager } from ${path('../../plugins/scenemanager/scenemanager.sim.ts')}
import { box3d } from ${path('../../plugins/box3d/box3d.sim.ts')}
import { box3dvehicle } from ${path('../../plugins/box3dvehicle/box3dvehicle.sim.ts')}
import file from './${name}.scene.json' with { type: 'json' }
export const sim = { scenemanager, box3d, box3dvehicle, body: {}, tyre: {}, axle: {}, probe: { after(_me, _dt, w) { globalThis.${name} = w } } }
export const scene = file
`)
  const top: Scene = {
    prefabs: { engine: { dt: DT }, scenemanager: { scenes: { [name]: { file: `${name}.scene.json`, suspend: false } }, dt: DT, entry: name, port: 0 } },
    actors: [{ is: 'scenemanager' }],
    plugins: ['scenemanager'],
  }
  const truth = (await load(boot(top, { scenemanager }), pathToFileURL(dir + '/').href)).get(name)!
  return { truth, w: () => (globalThis as any)[name] }
}

const run = (truth: Truth, k: number) => { for (let i = 0; i < k; i++) truth.step(DT) }
const car = (truth: Truth) => truth.rows.find(r => r.kind === 'box3dvehicle')!
const part = (truth: Truth, id: number) => truth.rows.find(r => r.id === id)!.data
const chassis = (truth: Truth) => part(truth, car(truth).data.chassis)
const heading = (truth: Truth) => turn(chassis(truth).rot, [1, 0, 0])
const settled = async (v: Vehicle, flip = false) => { const y = await yard(v, 1, flip); run(y.truth, 120); return y }

const RPM = 60 / (2 * Math.PI)
// vehicles's fleet, as its scene file writes it.
const vehicles = (vehiclesFile.world.box3dvehicle as unknown as Fleet).vehicles
// A vehicle of the fleet with its gearbox made manual, so a test holds the gear it puts it in.
const manual = (v: Vehicle): Vehicle => ({ ...v, engine: { ...(v.engine as Petrol), automatic: undefined } })
// The speed along the car's heading.
const forward = (truth: Truth) => { const h = heading(truth), v = chassis(truth).vel; return v[0] * h[0] + v[1] * h[1] + v[2] * h[2] }

test('the jeep pulls to its redline in every gear, each at the speed its gear and final drive make of the redline', async () => {
  // A ball turns at most a quarter turn a step in Box3D unless it is let turn faster: 47 rad/s at 60
  // steps a second, 19.8 m/s on the jeep's 0.42 m wheels, which held it there in every gear; its fifth
  // now runs to 36 m/s, of the 37.9 its redline makes there, well past that. Held in
  // each gear until it gains no more than 1 cm/s in a second, then up one, the engine reaches its
  // redline in each, and the car the redline's wheel speed in that gear less what the tyres slip and
  // the limiter's cut leave short of it, 7% at most. Its gearbox is made manual to hold each gear.
  const jeep = manual(vehicles.jeep), e = jeep.engine as Petrol, r = jeep.axles[0].wheel.radius
  const { truth } = await settled(jeep)
  Object.assign(car(truth).data, { gear: 1, throttle: 1 })
  const best = e.gears.map(() => 0), revs = e.gears.map(() => 0)
  for (let g = 1; g <= e.gears.length; g++) {
    car(truth).data.gear = g
    let last = -Infinity
    for (let s = 0; s < 30 && best[g - 1] - last > 0.01; s++) {
      last = best[g - 1]
      for (let i = 0; i < 60; i++) {
        truth.step(DT)
        best[g - 1] = Math.max(best[g - 1], forward(truth))
        revs[g - 1] = Math.max(revs[g - 1], car(truth).data.rpm)
      }
    }
  }
  e.gears.forEach((g, i) => {
    const at = (e.redline / RPM / (g * e.final)) * r
    expect(revs[i]).toBeGreaterThan(e.redline * 0.98)
    expect(best[i]).toBeLessThanOrEqual(at)
    expect(best[i]).toBeGreaterThan(at * 0.93)
  })
  expect(best.at(-1)!).toBeGreaterThan(19.8 * 1.75)
}, 60_000)

test('a petrol engine\'s torque reaches each driven wheel as its curve times the gear, the final drive and the efficiency, shared among them', async () => {
  // In 3rd at full throttle on ground that grips, each of the four driven wheel joints' motors pulls
  // with what the row says the engine makes, through the gearing, a quarter each, to 2%. Its gearbox
  // is made manual to hold 3rd.
  const jeep = manual(vehicles.jeep), e = jeep.engine as Petrol
  const { truth } = await settled(jeep)
  Object.assign(car(truth).data, { gear: 3, throttle: 1 })
  run(truth, 90)
  const d = car(truth).data, share = (d.torque * e.gears[2] * e.final * e.efficiency) / 4
  expect(d.torque).toBeCloseTo(torqueAt(e.curve, d.rpm), 6)
  for (const id of d.joints) {
    const j = part(truth, id)
    expect(Math.abs(Math.abs(j.measured.spinTorque) - share) / share).toBeLessThan(0.02)
  }
})

test('the cart\'s electric motor pulls it to the speed of its redline through its one reduction, and no faster', async () => {
  // Near its redline the motor makes its power over its speed, a few newtons at the tyres, which its
  // tyres' rolling resistance holds a little short of the redline's 25 km/h: within 5% of it.
  const cart = vehicles.cart, e = cart.engine as Electric, r = cart.axles[0].wheel.radius
  const top = (e.redline / RPM / e.ratio) * r
  const { truth } = await settled(cart)
  Object.assign(car(truth).data, { gear: 1, throttle: 1 })
  let best = 0
  for (let i = 0; i < 60 * 20; i++) { truth.step(DT); best = Math.max(best, forward(truth)) }
  expect(best).toBeGreaterThan(top * 0.95)
  expect(best).toBeLessThan(top * 1.005)
  expect(car(truth).data.rpm).toBeLessThanOrEqual(e.redline)
}, 30_000)

test('an electric motor pulls with its torque until it makes its power, then with its power over its speed', async () => {
  // Past the speed where torque times speed is the power, the torque falls as the motor spins up.
  const cart = vehicles.cart, e = cart.engine as Electric
  const { truth } = await settled(cart)
  Object.assign(car(truth).data, { gear: 1, throttle: 1 })
  run(truth, 2)
  expect(car(truth).data.torque).toBe(e.torque)
  run(truth, 300)
  const d = car(truth).data, omega = d.rpm / RPM
  expect(omega).toBeGreaterThan(e.power / e.torque)
  expect(d.torque).toBeCloseTo(e.power / omega, 3)
}, 30_000)

test('an electric car lifted off slows by its regen, more than one put in neutral', async () => {
  const lift = async (gear: number) => {
    const { truth } = await settled(vehicles.cart)
    Object.assign(car(truth).data, { gear: 1, throttle: 1 })
    run(truth, 180)
    Object.assign(car(truth).data, { gear, throttle: 0 })
    const from = forward(truth)
    run(truth, 60)
    return from - forward(truth)
  }
  expect(await lift(1)).toBeGreaterThan((await lift(0)) + 0.3)
}, 30_000)

test('an electric car goes backwards in reverse and stands in neutral', async () => {
  const went = async (gear: number) => {
    const { truth } = await settled(vehicles.cart)
    Object.assign(car(truth).data, { gear, throttle: 1 })
    run(truth, 120)
    return forward(truth)
  }
  expect(await went(-1)).toBeLessThan(-1)
  expect(Math.abs(await went(0))).toBeLessThan(0.05)
})

test('the monster truck dropped 2 m lands on its suspension: its springs take it inside their travel and it stays on its wheels', async () => {
  // Made 2 m over where it stands, the truck falls onto 1 m of travel. Its bump stops catch the last
  // of it short of the end, its body never reaches the ground, and it comes back to rest upright.
  const truck = vehicles.truck
  const { truth } = await yard(truck, standing(truck) + 2)
  let deepest = 0, lowest = Infinity
  for (let i = 0; i < 240; i++) {
    truth.step(DT)
    deepest = Math.max(deepest, ...car(truth).data.compression)
    lowest = Math.min(lowest, chassis(truth).pos[1] - truck.body.height / 2)
    expect(turn(chassis(truth).rot, [0, 1, 0])[1]).toBeGreaterThan(0.9)
  }
  const travel = truck.axles[0].spring.travel
  expect(deepest).toBeGreaterThan(travel / 2)
  expect(deepest).toBeLessThan(travel)
  expect(lowest).toBeGreaterThan(0.1)
  run(truth, 180)
  car(truth).data.compression.forEach((c: number) => expect(Math.abs(c - truck.axles[0].spring.sag)).toBeLessThan(0.02))
}, 30_000)

test('the monster truck stands on its sag and drives off', async () => {
  const { truth } = await settled(vehicles.truck)
  run(truth, 120)
  car(truth).data.compression.forEach((c: number) => expect(Math.abs(c - vehicles.truck.axles[0].spring.sag)).toBeLessThan(0.01))
  Object.assign(car(truth).data, { gear: 1, throttle: 1 })
  run(truth, 120)
  expect(forward(truth)).toBeGreaterThan(5)
})

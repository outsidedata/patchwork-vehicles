// vehicles's gym booted as the server boots it, its cars spawned where a test puts them and driven by
// writing their rows as the player's acts do. A wheel grips and drags by the surface painted under it
// (`box3dvehicle.mods.grip` and `.drag`, terrain3d's).
//   The surfaces: three jeeps, one on concrete, one on the mud patch and one on the ice patch, each
//   launched in first gear at full throttle for two seconds, each go less far than the one before.
//   The drag strip: each vehicle of the fleet from rest along the asphalt at z 172 in vehicles, its
//   automatic shifting up as it goes: the jeep reaches 80 km/h in about six seconds and 130 before the
//   strip ends, the truck tops out at the redline of its third, near 100, and the cart reaches its
//   25 km/h and no faster.
//   The braking line: a jeep at 60 km/h braked on the asphalt stops within a few car lengths, and on
//   the ice lane beside it goes several times as far.
//   The coast: a jeep set rolling at 30 km/h in neutral on the asphalt, the grass and the mud loses
//   about its surface's drag times g of speed a second.
import { expect, test, vi } from 'vitest'
import { boot, type Row, type Scene, type Truth } from '#engine/engine.ts'
import { load } from '#addons/scenemanager/scenemanager.addon.ts'
import { heightAt } from '#plugins/terrain3d/terrain3d.sim.ts'
import { standing, turn, type Fleet, type Petrol } from '#plugins/box3dvehicle/box3dvehicle.sim.ts'
import { sim } from './vehicles.sim.ts'
import file from './vehicles.scene.json'

vi.setConfig({ testTimeout: 120_000 })

const DT = file.prefabs.engine.dt
const RPM = 60 / (2 * Math.PI)
const here = new URL('./', import.meta.url).href
const fleet = file.world.box3dvehicle as unknown as Fleet
const step = (t: Truth, k: number) => { for (let i = 0; i < k; i++) t.step(DT) }
const gym = async () => (await load(boot(structuredClone(file) as Scene, sim), here)).get('gym')!
const chassis = (t: Truth, car: Row) => t.rows.find(r => r.id === car.data.chassis)!.data
const forward = (t: Truth, car: Row) => { const c = chassis(t, car), h = turn(c.rot, [1, 0, 0]); return c.vel[0] * h[0] + c.vel[1] * h[1] + c.vel[2] * h[2] }
// A car of `vehicle` standing on the gym at [x, z], facing +x.
const spawn = (t: Truth, vehicle: string, x: number, z: number) => {
  const w = { world: t.world, scene: { world: t.world } } as any
  return t.spawn('box3dvehicle', { vehicle, pos: [x, heightAt(w, x, z) + standing(fleet.vehicles[vehicle]) + 0.1, z], rot: [0, 0, 0, 1] })
}

test('a car launched for two seconds goes less far on mud than on concrete, and less far again on ice', async () => {
  const g = await gym()
  const places = { concrete: [-30, 40], mud: [95, 50], ice: [155, 50] }
  const cars = Object.values(places).map(([x, z]) => spawn(g, 'jeep', x, z))
  step(g, 90)
  const start = cars.map(c => [...chassis(g, c).pos])
  for (const c of cars) { c.data.gear = 1; c.data.throttle = 1 }
  step(g, 120)
  const [concrete, mud, ice] = cars.map((c, i) => Math.hypot(chassis(g, c).pos[0] - start[i][0], chassis(g, c).pos[2] - start[i][2]))
  expect(concrete).toBeGreaterThan(5)
  expect(mud).toBeLessThan(concrete * 0.9)
  expect(ice).toBeLessThan(mud * 0.7)
})

// A car of `vehicle` driven flat out from rest at the west end of the drag strip until it runs out of
// strip or time, in vehicles, its gearbox shifting itself: the time it first went
// `kmh` km/h (Infinity if never), the fastest it went, and the farthest it strayed off the strip's
// middle line, m.
async function drag(vehicle: string, kmh: number): Promise<{ at: number; best: number; wander: number }> {
  const g = await gym()
  const car = spawn(g, vehicle, -185, 172)
  step(g, 90)
  Object.assign(car.data, { gear: 1, throttle: 1 })
  let at = Infinity, best = 0, wander = 0
  for (let i = 0; i < 60 * 40 && chassis(g, car).pos[0] < 185; i++) {
    g.step(DT)
    const s = forward(g, car)
    best = Math.max(best, s)
    if (at === Infinity && s * 3.6 >= kmh) at = (i + 1) * DT
    wander = Math.max(wander, Math.abs(chassis(g, car).pos[2] - 172))
  }
  return { at, best: best * 3.6, wander }
}

test('on the drag strip the jeep makes 80 km/h in about six seconds and 130 by the end, short of its fifth\'s redline, the truck tops out near its 100, and the cart makes its 25 km/h and no more, each holding its line', async () => {
  // As run: the jeep 6.0 s to 80 and 130 km/h by the strip's end, its fifth's redline 136; the truck
  // 4.9 s to 80 and 99 km/h at the redline of its third; the cart 4.75 s to 24 and 24.3 km/h.
  const jeep = await drag('jeep', 80), truck = await drag('truck', 80), cart = await drag('cart', 24)
  const e = fleet.vehicles.jeep.engine as Petrol
  const redline = (e.redline / RPM / (e.gears[e.gears.length - 1] * e.final)) * fleet.vehicles.jeep.axles[0].wheel.radius * 3.6
  expect(jeep.at).toBeGreaterThan(5.5)
  expect(jeep.at).toBeLessThan(6.5)
  expect(jeep.best).toBeGreaterThan(120)
  expect(jeep.best).toBeLessThan(redline)
  expect(truck.at).toBeLessThan(Infinity)
  expect(truck.best).toBeGreaterThan(95)
  expect(truck.best).toBeLessThan(100.5)
  expect(cart.at).toBeLessThan(Infinity)
  expect(cart.best).toBeLessThan(25.5)
  for (const car of [jeep, truck, cart]) expect(car.wander).toBeLessThan(6)
})

// A jeep set rolling at 60 km/h along the lane at z `lane`, every wheel turning at that speed, then
// braked full: how far it goes stopping. It is set going rather than run up, as on ice it would take
// most of the lane to get there.
async function stop(lane: number): Promise<number> {
  const g = await gym()
  const car = spawn(g, 'jeep', -150, lane)
  step(g, 90)
  const v = 60 / 3.6, r = fleet.vehicles.jeep.axles[0].wheel.radius
  chassis(g, car).vel = [v, 0, 0]
  for (const id of car.data.wheels) Object.assign(g.rows.find(x => x.id === id)!.data, { vel: [v, 0, 0], spin: [0, 0, -v / r] })
  Object.assign(car.data, { throttle: 0, brake: 1, gear: 0 })
  const from = chassis(g, car).pos[0]
  for (let i = 0; i < 60 * 30 && forward(g, car) > 0.1; i++) g.step(DT)
  return chassis(g, car).pos[0] - from
}

test('a jeep braked from 60 km/h stops within a few car lengths on the asphalt, and goes several times as far on the ice lane', async () => {
  const asphalt = await stop(172), ice = await stop(188)
  expect(asphalt).toBeLessThan(30)
  expect(ice).toBeGreaterThan(asphalt * 4)
})

// A jeep set rolling at 30 km/h along +x at [x, z], every wheel turning at that speed, in neutral and
// off the brake: the speed it has lost after two seconds of rolling, m/s.
async function coast(x: number, z: number): Promise<number> {
  const g = await gym()
  const car = spawn(g, 'jeep', x, z)
  step(g, 90)
  const v = 30 / 3.6, r = fleet.vehicles.jeep.axles[0].wheel.radius
  chassis(g, car).vel = [v, 0, 0]
  for (const id of car.data.wheels) Object.assign(g.rows.find(w => w.id === id)!.data, { vel: [v, 0, 0], spin: [0, 0, -v / r] })
  Object.assign(car.data, { throttle: 0, brake: 0, gear: 0 })
  step(g, 120)
  return v - forward(g, car)
}

test('a jeep rolling free loses speed by the drag of the ground under it, its drag times g a second: hardly any on asphalt, more on grass, most in the mud', async () => {
  // Each patch is 28 m round, so the jeep rolls its two seconds, under 17 m, on it. As run: 0.23 m/s
  // on the asphalt (0.012), 1.54 on the grass (0.08), 2.77 in the mud (0.15), where drag · g · 2 s
  // is 0.24, 1.57 and 2.94.
  const g = 9.8, drag = (await import('./assets/gym.json')).surfaces
  const lost = { asphalt: await coast(-150, 172), grass: await coast(30, 50), mud: await coast(95, 50) }
  for (const [name, v] of Object.entries(lost)) {
    const law = drag[name as keyof typeof lost].drag * g * 2
    expect(v).toBeGreaterThan(law * 0.85)
    expect(v).toBeLessThan(law * 1.1)
  }
  expect(lost.asphalt).toBeLessThan(lost.grass)
  expect(lost.grass).toBeLessThan(lost.mud)
})

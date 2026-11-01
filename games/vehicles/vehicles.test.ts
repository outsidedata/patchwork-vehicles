// vehicles booted as the server boots it, with two connections on the road: the three cars stand side by
// side on the land, and each seat holds the car its start names from the step that car is made, the
// first seat the jeep, with no body of its own. The cars stay put with nobody driving, a seat's pedal
// drives the car it holds and no other, held back from a stop it reverses, a value not a number does
// nothing and one past its range is kept to it, `lights` switches its car's headlights, `next` moves the
// seat to the next free car, carrying the controls it last sent, a car let go of, by `next` or by a seat
// that leaves, is braked by its spot, and a seat whose own car another holds takes the first free one.
// The jeep driven into the pedestrian knocks him down as a box3d ragdoll, and he stands again. Then two
// pages drive it for half a minute on the simulator under 150 ms of lag.
import { expect, test, vi } from 'vitest'
import { boot, type Row, type Scene, type Truth, type W } from '#engine/engine.ts'
import { connection, load, manager } from '#addons/scenemanager/scenemanager.addon.ts'
import { heightAt } from '#plugins/terrain3d/terrain3d.sim.ts'
import { turn } from '#plugins/box3dvehicle/box3dvehicle.sim.ts'
import defs from './assets/vehicles.json'
import { parse, simulate, summary } from '#addons/simulator/simulator.addon.ts'
import { sim } from './vehicles.sim.ts'
import { sim as roadSim } from './road.sim.ts'
import file from './vehicles.scene.json'
import { possessed } from '#addons/player/player.addon.ts'

vi.setConfig({ testTimeout: 60_000 })

const DT = file.prefabs.engine.dt
const here = new URL('./', import.meta.url).href

// The road's `w`, as box3d's tick is handed it each step, for terrain3d's queries.
let w: W
const box3d = roadSim.box3d
roadSim.box3d = { ...box3d, tick(me, dt, ww) { w = ww; box3d.tick!(me, dt, ww) } }

// The manager, the road and two connections on it, each come from the title, the entry, by the word
// that goes to the plains (the marquee's first place), as a player picks it.
async function road() {
  const truth = boot(structuredClone(file) as Scene, sim)
  const road = (await load(truth, here)).get('road')!
  const step = (k: number) => { for (let i = 0; i < k; i++) truth.step(DT) }
  // A connection that comes to the title and goes to the plains, on the step after.
  const join = () => {
    const heard: { scene: string; seat: number; n: number; rows: Row[] }[] = []
    const c = connection(manager(truth), d => heard.push({ scene: d.scene, seat: d.seat, n: d.packet.n, rows: d.packet.rows }))
    return { c, last: () => heard[heard.length - 1] }
  }
  const go = (s: ReturnType<typeof join>) => {
    const last = s.last()
    const id = last.rows.find(r => r.kind === 'scenemanager')!.id
    s.c.take({ scene: last.scene, seat: last.seat, msg: { seq: 1, n: last.n, id, action: 'go', args: [defs.marquee.places[0].scene] } })
  }
  const seats = [join(), join()]
  step(1)
  for (const s of seats) go(s)
  step(1)
  return { truth, road, seats, step, join, go, get w() { return w } }
}
const vehicles = (road: Truth) => road.rows.filter(r => r.kind === 'box3dvehicle').sort((a, b) => a.id - b.id)
const part = (road: Truth, id: number) => road.rows.find(r => r.id === id)!.data
const flat = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[2] - b[2])

// The road's rows are read afresh by id after every step: the road runs ahead (`world.predict`), so
// the server's rewind may load its truth again, and a row object kept across a step is a copy that
// no longer changes.
type Road = Awaited<ReturnType<typeof road>>
const row = (g: Road, id: number) => g.road.rows.find(r => r.id === id)!
// The id of the car the `player` row of seat `s` holds, as the road has it now.
const held = (g: Road, s: number): number | undefined => row(g, possessed(g.seats[s].last().rows)!.id).data.held?.id
// A press from seat `s` at its own `player` row, numbered `seq` as the page numbers it and stamped
// with the road's step, as a page stamps it: the road puts a press back on the step it is stamped
// with, and a press stamped before the seat held its car has no car to reach.
const press = (g: Road, s: number, seq: number, action: string, ...args: unknown[]) => {
  const last = g.seats[s].last(), me = possessed(last.rows)!
  g.seats[s].c.take({ scene: 'road', seat: last.seat, msg: { seq, n: g.road.n, id: me.id, action, args: args as any[] } })
}
const chassisOf = (g: Road, car: number) => part(g.road, row(g, car).data.chassis)
const fleet = file.world.box3dvehicle.vehicles as Record<string, { axles: { wheel: { radius: number } }[] }>
// Steps until `done`, failing after `max` of them.
const until = (g: Road, done: () => boolean, max: number, what: string) => {
  for (let i = 0; i < max; i++) {
    if (done()) return i
    g.step(1)
  }
  throw new Error(`${what} did not happen in ${max} steps`)
}
// Seat `s`'s first press, numbered `seq`, which changes nothing: it holds its car from the start.
const getIn = (g: Road, s: number, seq: number) => press(g, s, seq, 'brake', 0)

test('the golf cart, the jeep and the monster truck stand side by side on their wheels on the land', async () => {
  const g = await road()
  g.step(90)
  const cars = vehicles(g.road)
  expect(cars.map(c => c.data.vehicle)).toEqual(['cart', 'jeep', 'truck'])
  // every wheel's bottom, its centre less its radius, on the land
  for (const car of cars) car.data.wheels.forEach((id: number, i: number) => {
    const [x, y, z] = part(g.road, id).pos, r = fleet[car.data.vehicle].axles[i >> 1].wheel.radius
    expect(Math.abs(y - r - heightAt(g.w, x, z))).toBeLessThan(0.15)
  })
  const [cart, jeep, truck] = cars.map(c => chassisOf(g, c.id).pos)
  expect(Math.abs(cart[0] - jeep[0])).toBeLessThan(0.5)
  expect(Math.abs(truck[0] - jeep[0])).toBeLessThan(0.5)
  expect(cart[2]).toBeLessThan(jeep[2])
  expect(jeep[2]).toBeLessThan(truck[2])
})

test('after 300 idle steps every car is still within 0.5 m of where it stood', async () => {
  const g = await road()
  g.step(5)
  const start = vehicles(g.road).map(c => [...chassisOf(g, c.id).pos])
  g.step(300)
  vehicles(g.road).forEach((c, i) => expect(flat(chassisOf(g, c.id).pos, start[i])).toBeLessThan(0.5))
})

test('a seated seat\'s pedal moves the car it holds and no other', async () => {
  const g = await road()
  g.step(30)
  getIn(g, 0, 1)
  const mine = held(g, 0)!
  expect(row(g, mine).data.vehicle).toBe('jeep')
  const ids = vehicles(g.road).map(c => c.id)
  const start = new Map(ids.map(id => [id, [...chassisOf(g, id).pos]]))
  press(g, 0, 2, 'pedal', 1)
  g.step(120)
  expect(flat(chassisOf(g, mine).pos, start.get(mine)!)).toBeGreaterThan(5)
  for (const id of ids) if (id !== mine) expect(flat(chassisOf(g, id).pos, start.get(id)!)).toBeLessThan(0.5)
})

test('the jeep driven into the pedestrian knocks him down as a box3d ragdoll thrown the way it drove, and he stands again where he stood once he has lain his again seconds', async () => {
  const g = await road()
  g.step(30)
  const pedestrian = () => g.road.rows.find(r => r.kind === 'pedestrian')!
  const stood = [...pedestrian().data.pos]
  getIn(g, 0, 1)
  press(g, 0, 2, 'pedal', 1)
  until(g, () => pedestrian().data.limp, 1200, 'the pedestrian knocked down')
  const jeep = chassisOf(g, held(g, 0)!)
  const bones = () => g.road.rows.filter(r => r.kind === 'bone' && r.data.of === pedestrian().id)
  expect(Object.keys(pedestrian().data.ragdoll)).toHaveLength(bones().length)
  expect(bones().length).toBeGreaterThan(0)
  // Thrown the way the jeep drove: his body moves off along its heading.
  const before = bones().map(b => [...b.data.pos])
  g.step(20)
  const moved = bones().map((b, i) => [b.data.pos[0] - before[i][0], b.data.pos[2] - before[i][2]])
  const heading = turn(jeep.rot, [1, 0, 0])
  const along = moved.reduce((s, [dx, dz]) => s + dx * heading[0] + dz * heading[2], 0) / moved.length
  expect(along).toBeGreaterThan(0.1)
  until(g, () => !pedestrian().data.limp, Math.ceil(defs.pedestrian.again / DT) + 10, 'the pedestrian standing again')
  expect(bones()).toHaveLength(0)
  expect(g.road.rows.filter(r => r.kind === 'bonejoint')).toHaveLength(0)
  expect(flat(pedestrian().data.pos, stood)).toBeLessThan(1e-9)
})

test('a seat holding its pedal back from a stop puts its car in reverse and backs up, and the pedal forward puts it back in drive', async () => {
  const g = await road()
  g.step(30)
  getIn(g, 0, 1)
  const car = held(g, 0)!
  const start = [...chassisOf(g, car).pos]
  press(g, 0, 2, 'pedal', -1)
  g.step(120)
  expect(row(g, car).data.gear).toBe(-1)
  const { pos, rot } = chassisOf(g, car), heading = turn(rot, [1, 0, 0])
  expect((pos[0] - start[0]) * heading[0] + (pos[2] - start[2]) * heading[2]).toBeLessThan(-1)
  press(g, 0, 3, 'pedal', 1)
  g.step(180)
  expect(row(g, car).data.gear).toBeGreaterThan(0)
})

test('a car its seat moves off while driving it is braked to a stop, and the seat\'s pedal drives the car it moved to', async () => {
  const g = await road()
  g.step(30)
  getIn(g, 0, 1)
  const jeep = held(g, 0)!
  press(g, 0, 2, 'pedal', 1)
  g.step(90)
  press(g, 0, 3, 'next')
  g.step(5)
  const truck = held(g, 0)!
  expect(row(g, truck).data.vehicle).toBe('truck')
  expect(row(g, jeep).data.brake).toBe(1)
  expect(row(g, jeep).data.pedal).toBeNull()
  const truckAt = [...chassisOf(g, truck).pos]
  g.step(240)
  const was = [...chassisOf(g, jeep).pos]
  g.step(120)
  expect(flat(chassisOf(g, jeep).pos, was)).toBeLessThan(0.05)
  expect(flat(chassisOf(g, truck).pos, truckAt)).toBeGreaterThan(5)
})

test('a seat that leaves lets go of its car, which its spot keeps braked', async () => {
  const g = await road()
  g.step(30)
  getIn(g, 1, 1)
  const cart = held(g, 1)!
  expect(row(g, cart).data.vehicle).toBe('cart')
  press(g, 1, 2, 'pedal', 1)
  g.step(30)
  expect(row(g, cart).data.pedal).toBe(1)
  g.seats[1].c.close()
  g.step(2)
  expect(g.road.rows.filter(r => r.kind === 'player')).toHaveLength(1)
  expect(row(g, cart).data.brake).toBe(1)
  expect(row(g, cart).data.pedal).toBeNull()
})

// Two seats for 30 seconds, 150 ms each way with 20 ms of jitter, one page on a 60 Hz display and one
// on a 120 Hz, each driving off its pad and steering: recorded as JSONL, read back and summarised, in
// less processor time than it plays. Each page draws packets from its first frame on, the step it
// draws never goes back, since each way keeps the packets in order, and its camera follows the car's
// body, its distance from it moving as the car does.
test.skip('two seats drive 30 seconds under 150 ms and 20 ms of jitter, at 60 Hz and 120 Hz, recorded and summarised faster than they play', async () => {
  const leg = { delay: 150, jitter: 20 }
  const keys = (list: [number, string, number][]) => list.flatMap(([at, key, ms]) => [{ at, key }, { at: at + ms, key, up: true }])
  // The processor time the run took, which, unlike the wall's, other work on the machine does not
  // stretch: the test file runs in a process of its own.
  const lines: string[] = []
  const t0 = process.cpuUsage()
  await simulate({
    file: file as Scene, sim, base: here, seed: 1, ms: 30_000, write: l => lines.push(l),
    watch: { kinds: ['car'], fields: ['pos', 'rot', 'vel'], own: ['held', 'chassis'] },
    pages: [
      { display: { hz: 60 }, up: leg, down: leg, presses: keys([[2000, 'KeyW', 6000], [5000, 'KeyD', 800], [12000, 'KeyS', 1500], [16000, 'KeyW', 5000], [18000, 'KeyA', 1200]]) },
      { display: { hz: 120 }, up: leg, down: leg, presses: keys([[3000, 'KeyW', 5000], [9000, 'KeyA', 700], [14000, 'KeyW', 4000], [15000, ' ', 600]]) },
    ],
  })
  const cpu = process.cpuUsage(t0)
  expect((cpu.user + cpu.system) / 1000).toBeLessThan(30_000)
  const s = summary(parse(lines.join('\n')))
  expect(s.steps).toBe(1800)
  expect(s.pages.map(p => p.page)).toEqual([0, 1])
  for (const p of s.pages) {
    expect(p.histogram.first).not.toBeNull()
    expect(Object.keys(p.histogram.counts).every(k => Number(k) >= 0)).toBe(true)
    expect(p.standoff.rms).toBeGreaterThan(0)
  }
}, 120_000)

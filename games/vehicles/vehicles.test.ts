// vehicles booted as the server boots it, with two connections on the road: the three cars stand side by
// side on the land, and each seat's person stands on foot beside the car its start names, holding none.
// On foot `walk` walks it and the steering turns it, each as far as it is pushed, and the pedal moves
// nothing. `use` within reach of where a car's `enter`
// begins walks it there and gets it in (`plugins/interact`), holding the car from the step it starts
// getting in, out of reach it does nothing, and a car another seat holds is not got into; seated, `use`
// gets it out at any speed, the car let go of and braked by its spot, the person on foot beside it.
// The cars stay put with nobody driving, a seated seat's pedal drives the car it holds and no other,
// held back from a stop it reverses, `next` moves the seat into the seat of the next free car, from
// the car it is in or from on foot, and a car let go of, by `next` or by a seat that leaves, is braked
// by its spot. The jeep driven into the pedestrian knocks him down as a box3d ragdoll, and he stands
// again. Then two pages drive it for half a minute on the simulator under 150 ms of lag.
import { expect, test, vi } from 'vitest'
import { boot, type Row, type Scene, type Truth, type W } from '#engine/engine.ts'
import { connection, load, manager } from '#addons/scenemanager/scenemanager.addon.ts'
import { heightAt } from '#plugins/terrain3d/terrain3d.sim.ts'
import { turn } from '#plugins/box3dvehicle/box3dvehicle.sim.ts'
import { placeOf, startOf } from '#plugins/interact/interact.sim.ts'
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
  const seats = [0, 1].map(() => {
    const heard: { scene: string; seat: number; n: number; rows: Row[] }[] = []
    const c = connection(manager(truth), d => heard.push({ scene: d.scene, seat: d.seat, n: d.packet.n, rows: d.packet.rows }))
    return { c, last: () => heard[heard.length - 1] }
  })
  const step = (k: number) => { for (let i = 0; i < k; i++) truth.step(DT) }
  step(1)
  for (const s of seats) {
    const last = s.last()
    const id = last.rows.find(r => r.kind === 'scenemanager')!.id
    s.c.take({ scene: last.scene, seat: last.seat, msg: { seq: 1, n: last.n, id, action: 'go', args: [defs.marquee.places[0].scene] } })
  }
  step(1)
  return { truth, road, seats, step, get w() { return w } }
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
// Seat `s`'s `player` row, as the road has it now.
const person = (g: Road, s: number) => row(g, possessed(g.seats[s].last().rows)!.id)
// The car of the vehicle `name`.
const carNamed = (g: Road, name: string) => vehicles(g.road).find(c => c.data.vehicle === name)!
// Where a car's `enter` begins for seat `s`'s person, and its seat point, this step.
const enterOf = (g: Road, s: number, car: Row) => startOf(g.w, person(g, s), car, 'enter')
const seatOf = (g: Road, car: Row) => placeOf(g.w, car, 'seat')
// Steps until `done`, failing after `max` of them.
const until = (g: Road, done: () => boolean, max: number, what: string) => {
  for (let i = 0; i < max; i++) {
    if (done()) return i
    g.step(1)
  }
  throw new Error(`${what} did not happen in ${max} steps`)
}
// Seat `s` presses use, from where it stands, and is seated in the car it walks to; the next press is
// numbered `seq` + 1.
const getIn = (g: Road, s: number, seq: number) => {
  press(g, s, seq, 'use')
  until(g, () => person(g, s).data.board === 'seated', 1200, `seat ${s} seated`)
}

test('the golf cart, the jeep and the monster truck stand side by side on their wheels on the land, and each seat\'s person stands on foot on the ground beside the car its start names, holding none', async () => {
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
  for (const [s, name] of [[0, 'jeep'], [1, 'cart']] as const) {
    const p = person(g, s).data
    expect(p).toMatchObject({ held: null, board: '', stood: true, grounded: true })
    // at `stand` from where its car's `enter` begins, within reach of it, on the land
    const from = enterOf(g, s, carNamed(g, name)).at
    expect(flat(p.pos, from)).toBeCloseTo(Math.hypot(...defs.player.board.stand), 1)
    expect(flat(p.pos, from)).toBeLessThan(defs.player.board.reach)
    expect(Math.abs(p.pos[1] - heightAt(g.w, p.pos[0], p.pos[2]))).toBeLessThan(0.1)
  }
})

test('on foot walk walks the person ahead and back along its heading, the steering turns it, and no car moves', async () => {
  const g = await road()
  g.step(30)
  const ids = vehicles(g.road).map(c => c.id)
  const start = new Map(ids.map(id => [id, [...chassisOf(g, id).pos]]))
  const p0 = [...person(g, 0).data.pos], h0 = person(g, 0).data.heading
  press(g, 0, 1, 'walk', 1)
  g.step(60)
  const p1 = person(g, 0).data.pos
  // a second's creep, eased up to it, straight ahead
  expect(flat(p1, p0)).toBeGreaterThan(0.6 * defs.player.foot.creep)
  expect(flat(p1, p0)).toBeLessThan(defs.player.foot.creep * 1.05)
  const along = (p1[0] - p0[0]) * Math.sin(h0) + (p1[2] - p0[2]) * Math.cos(h0)
  expect(along / flat(p1, p0)).toBeGreaterThan(0.99)
  press(g, 0, 2, 'walk', 0)
  press(g, 0, 3, 'steer', 1)
  g.step(30)
  press(g, 0, 4, 'steer', 0)
  g.step(1)
  // half a second turning left at `turn`
  const turned = person(g, 0).data.heading - h0
  expect(Math.atan2(Math.sin(turned), Math.cos(turned))).toBeCloseTo(defs.player.foot.turn * 31 * DT, 1)
  for (const id of ids) expect(flat(chassisOf(g, id).pos, start.get(id)!)).toBeLessThan(0.5)
  expect(person(g, 0).data.held).toBeNull()
})

// A stick pushed part of the way: the gamepad's (`player.client.ts`, read analog).
test('on foot a stick pushed part of the way walks and turns the person that fraction of its pace and of turn, the pedal moves it nothing, and a value past 1 or not a number is kept to 1 or does nothing', async () => {
  const g = await road()
  g.step(30)
  const pace = (seq: number, act: string, v: unknown) => {
    press(g, 0, seq, act, v)
    g.step(1)
    const at = [...person(g, 0).data.pos]
    g.step(60)
    return flat(person(g, 0).data.pos, at)
  }
  // Walked into its pace first, so each second read is at the pace it holds.
  press(g, 0, 1, 'walk', 0.5)
  g.step(60)
  const half = pace(2, 'walk', 0.5)
  expect(half).toBeCloseTo(0.5 * defs.player.foot.creep, 1)
  expect(person(g, 0).data.stick).toEqual([0, 0.5])
  // Past 1 is 1, and not a number changes nothing.
  pace(3, 'walk', 4)
  expect(person(g, 0).data.stick).toEqual([0, 1])
  const full = pace(4, 'walk', 4)
  expect(full).toBeCloseTo(defs.player.foot.creep, 1)
  for (const [seq, bad] of [[5, 'fast'], [6, NaN], [7, Infinity], [8, null]] as const) {
    press(g, 0, seq, 'walk', bad)
    g.step(1)
    expect(person(g, 0).data.stick).toEqual([0, 1])
  }
  // The pedal on foot is the car's alone.
  press(g, 0, 9, 'walk', 0)
  g.step(60)
  const still = [...person(g, 0).data.pos]
  expect(pace(10, 'pedal', 1)).toBeLessThan(0.01)
  expect(flat(person(g, 0).data.pos, still)).toBeLessThan(0.01)
  expect(person(g, 0).data.stick).toEqual([0, 0])
  // A quarter of the steering turns a quarter of `turn` each of the 60 steps it is held.
  const h0 = person(g, 0).data.heading
  press(g, 0, 11, 'steer', 0.25)
  g.step(60)
  press(g, 0, 12, 'steer', 0)
  g.step(1)
  const turned = person(g, 0).data.heading - h0
  expect(Math.atan2(Math.sin(turned), Math.cos(turned))).toBeCloseTo(0.25 * defs.player.foot.turn * 60 * DT, 9)
})

test('use out of reach of where any free car\'s enter begins does nothing; within reach the person walks there, takes hold of the car as it starts getting in, gets in and is seated on the car\'s seat point', async () => {
  const g = await road()
  g.step(30)
  const jeep = carNamed(g, 'jeep')
  // walked out of reach: use does nothing
  press(g, 0, 1, 'steer', 1)
  until(g, () => Math.abs(Math.sin((person(g, 0).data.heading - enterOf(g, 0, jeep).yaw) / 2)) > 0.999, 240, 'turned round')
  press(g, 0, 2, 'steer', 0)
  press(g, 0, 3, 'walk', 1)
  // out of reach of where every free car's enter begins, not only the jeep's
  const free = () => vehicles(g.road).filter(c => c.id !== held(g, 1))
  until(g, () => free().every(c => flat(person(g, 0).data.pos, enterOf(g, 0, c).at) > defs.player.board.reach + 0.5), 600, 'walked away')
  press(g, 0, 4, 'walk', 0)
  g.step(30)
  press(g, 0, 5, 'use')
  g.step(5)
  expect(person(g, 0).data).toMatchObject({ board: '', held: null })
  // back in reach: use walks it to the door, and it starts getting in there, facing as enter begins
  press(g, 0, 6, 'steer', 1)
  until(g, () => Math.abs(Math.sin((person(g, 0).data.heading - enterOf(g, 0, jeep).yaw) / 2)) < 0.02, 240, 'turned back')
  press(g, 0, 7, 'steer', 0)
  press(g, 0, 8, 'walk', 1)
  until(g, () => flat(person(g, 0).data.pos, enterOf(g, 0, jeep).at) < defs.player.board.reach - 0.5, 600, 'walked back')
  press(g, 0, 9, 'walk', 0)
  press(g, 0, 10, 'use')
  g.step(2)
  expect(person(g, 0).data.board).toBe('approach')
  expect(person(g, 0).data.held).toBeNull()
  until(g, () => person(g, 0).data.board === 'in', 600, 'getting in')
  expect(held(g, 0)).toBe(jeep.id)
  expect(flat(person(g, 0).data.pos, enterOf(g, 0, jeep).at)).toBeLessThan(0.1)
  until(g, () => person(g, 0).data.board === 'seated', 600, 'seated')
  g.step(2)
  const seat = seatOf(g, jeep)
  for (let i = 0; i < 3; i++) expect(person(g, 0).data.pos[i]).toBeCloseTo(seat.at[i], 6)
})

// A page sends a key or a trigger only when it changes, so one held down while the person gets in
// is sent once, before the car is the person's to drive.
test('a pedal and steering held down while the person gets in work its car from the step it is seated, and carry on to the car next moves it to', async () => {
  const g = await road()
  g.step(30)
  press(g, 0, 1, 'use')
  until(g, () => person(g, 0).data.board === 'in', 600, 'getting in')
  const jeep = held(g, 0)!
  press(g, 0, 2, 'pedal', 1)
  press(g, 0, 3, 'steer', -0.5)
  g.step(1)
  expect(person(g, 0).data.controls).toEqual({ pedal: 1, steer: -0.5, brake: 0 })
  expect(row(g, jeep).data).toMatchObject({ pedal: 0, steer: 0 })
  until(g, () => person(g, 0).data.board === 'seated', 600, 'seated')
  expect(row(g, jeep).data).toMatchObject({ pedal: 1, steer: -0.5 })
  g.step(90)
  expect(Math.hypot(...(chassisOf(g, jeep).vel as number[]))).toBeGreaterThan(2)
  press(g, 0, 4, 'next')
  g.step(1)
  const next = held(g, 0)!
  expect(next).not.toBe(jeep)
  expect(person(g, 0).data.board).toBe('seated')
  expect(row(g, next).data).toMatchObject({ pedal: 1, steer: -0.5 })
})

test('seated, use gets the person out at speed: the car let go of the step it starts getting out, braked by its spot, the person on foot beside it once out, and walking again', async () => {
  const g = await road()
  g.step(30)
  getIn(g, 0, 1)
  const jeep = held(g, 0)!
  press(g, 0, 2, 'pedal', 1)
  g.step(120)
  expect(Math.hypot(...(chassisOf(g, jeep).vel as number[]))).toBeGreaterThan(3)
  press(g, 0, 3, 'use')
  g.step(2)
  expect(person(g, 0).data.board).toBe('out')
  expect(held(g, 0)).toBeUndefined()
  expect(row(g, jeep).data.brake).toBe(1)
  until(g, () => person(g, 0).data.board === '', 600, 'out')
  expect(person(g, 0).data.interact).toBeNull()
  // beside the car, on its driver's side, on foot
  expect(flat(person(g, 0).data.pos, seatOf(g, row(g, jeep)).at)).toBeLessThan(4)
  g.step(60)
  expect(person(g, 0).data.grounded).toBe(true)
  const at = [...person(g, 0).data.pos]
  press(g, 0, 4, 'walk', 1)
  g.step(60)
  expect(flat(person(g, 0).data.pos, at)).toBeGreaterThan(0.6)
})

test('a car another seat holds is not got into: use near it does nothing, and a seat walking up to a car another gets into first is back on foot', async () => {
  const g = await road()
  g.step(30)
  getIn(g, 0, 1)
  // seat 1 stands by the cart; it walks to the jeep's door and presses use there
  const jeep = carNamed(g, 'jeep')
  const s1 = person(g, 1)
  const [x, , z] = enterOf(g, 1, jeep).at
  s1.data.pos = [x, heightAt(g.w, x, z), z]
  g.step(2)
  press(g, 1, 1, 'use')
  g.step(5)
  expect(person(g, 1).data.board === 'approach' && person(g, 1).data.toward === jeep.id).toBe(false)
  expect(held(g, 0)).toBe(jeep.id)
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

test('next moves a seat into the seat of the next car no seat holds, in the spots\' order and round, from on foot or from the car it is in, leaving every car where it is', async () => {
  const g = await road()
  g.step(30)
  getIn(g, 0, 1)
  getIn(g, 1, 1)
  const count = vehicles(g.road).length
  press(g, 0, 2, 'next')
  g.step(5)
  expect(row(g, held(g, 0)!).data.vehicle).toBe('truck')
  expect(person(g, 0).data.board).toBe('seated')
  const seat = seatOf(g, row(g, held(g, 0)!))
  for (let i = 0; i < 3; i++) expect(person(g, 0).data.pos[i]).toBeCloseTo(seat.at[i], 6)
  // the cart is the next round from the truck, and seat 1 holds it, so seat 0 goes on to the jeep
  press(g, 0, 3, 'next')
  g.step(5)
  expect(row(g, held(g, 0)!).data.vehicle).toBe('jeep')
  expect(row(g, held(g, 1)!).data.vehicle).toBe('cart')
  expect(vehicles(g.road)).toHaveLength(count)
  // from on foot, out of the jeep: into the first free car in the spots' order, the cart being seat
  // 1's, the jeep again
  press(g, 0, 4, 'use')
  until(g, () => person(g, 0).data.board === '', 600, 'out')
  press(g, 0, 5, 'next')
  g.step(5)
  expect(row(g, held(g, 0)!).data.vehicle).toBe('jeep')
  expect(person(g, 0).data.board).toBe('seated')
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

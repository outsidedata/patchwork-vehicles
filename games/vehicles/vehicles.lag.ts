// vehicles under lag, offline: the manager and two pages in one process on the simulator
// (`addons/simulator`), each page on its own seat, 150 ms each way, on a 60 Hz display. The two cars
// start on their pads facing each other, both jeeps. Both seats press throttle at PRESS_AT ms and
// drive until the cars hit: the first server step at which the two chassis are within touching
// distance, the sum of their half-lengths (the jeep's body `length` in `world.box3dvehicle`) and 0.5 m. The run ends AFTER
// frames after the hit.
//
// `lag()` plays it and returns every frame, the k-th frame of each page together: for each seat, its
// own car and the other car as its page drew them (position, heading, forward speed), the step of the
// packet its page drew, and the packets it has taken so far; the server's two cars after each step,
// by step; the frame each seat's press came before; and the frame of the hit.
// Run from node it prints a line per seat per frame and, last, the packets each seat took:
//   node --experimental-strip-types games/vehicles/vehicles.lag.ts
// `vehicles.lag.test.ts` asserts on what `lag()` returns.
import type { Scene } from '#engine/engine.ts'
import { simulate, type FrameRecord, type StepRecord, type Watched } from '#addons/simulator/simulator.addon.ts'
import { sim } from './vehicles.sim.ts'
import file from './vehicles.scene.json' with { type: 'json' }

export type Car = { pos: number[]; heading: number; forward: number; vel: number[] }
export type Seat = { own?: Car; other?: Car; n: number; packets: number }
export type Frame = { k: number; t: number; seats: Seat[] }

const DT = file.prefabs.engine.dt
export const LAG = Math.round(0.150 / DT)
export const PRESS_AT = 1000
export const AFTER = 120
export const TOUCH = file.world.box3dvehicle.vehicles.jeep.body.length + 0.5
const MS = 12_000

// A chassis as a Car: its forward, the chassis's +x turned by its rot, as an angle about up
// (positive to the left, -z) and the speed along it.
function carOf(chassis: Watched[string]): Car {
  const [x, y, z, s] = chassis.rot as number[]
  const f = [1 - 2 * (y * y + z * z), 2 * (x * y + s * z), 2 * (x * z - s * y)]
  const vel = chassis.vel as number[]
  return { pos: [...(chassis.pos as number[])], heading: Math.atan2(-f[2], f[0]), forward: vel[0] * f[0] + vel[1] * f[1] + vel[2] * f[2], vel: [...vel] }
}
// The chassis of the car `vehicle` names in `rows`, as a Car.
const chassisOf = (rows: Watched, vehicle: Watched[string] | undefined) => {
  const c = vehicle && rows[vehicle.chassis as number]
  return c ? carOf(c) : undefined
}
const all = (rows: Watched, kind: string) => Object.entries(rows).filter(([, r]) => r.kind === kind)

export async function lag(): Promise<{ frames: Frame[]; server: Map<number, Car[]>; press: number[]; hit: number }> {
  const leg = { delay: LAG * DT * 1000 }
  const records = await simulate({
    file: file as Scene, sim, base: new URL('./', import.meta.url).href, seed: 1, ms: MS,
    pages: [0, 1].map(() => ({ display: { hz: 60 }, up: leg, down: leg, presses: [{ at: PRESS_AT, act: ['pedal', 1] as [string, number] }] })),
    watch: { kinds: ['player', 'box3dvehicle', 'car'], fields: ['seat', 'held', 'chassis', 'pos', 'rot', 'vel'] },
  })
  // The server's cars after each step, seat by seat, off each seat's player row.
  const server = new Map<number, Car[]>()
  let hitStep: StepRecord | undefined
  for (const s of records.filter((r): r is StepRecord => r.type === 'step')) {
    const rows = s.rows!.road
    const players = all(rows, 'player').map(([, p]) => p).sort((a, b) => (a.seat as number) - (b.seat as number))
    const cars = players.map(p => chassisOf(rows, rows[(p.held as { id: number } | null)?.id ?? -1])).filter((c): c is Car => !!c)
    server.set(s.scenes.road, cars)
    if (!hitStep && cars.length === 2 && Math.hypot(cars[0].pos[0] - cars[1].pos[0], cars[0].pos[2] - cars[1].pos[2]) < TOUCH) hitStep = s
  }
  if (!hitStep) throw new Error('the cars never hit')
  const pages = [0, 1].map(i => records.filter((r): r is FrameRecord => r.type === 'frame' && r.page === i))
  const seats = pages.map(fs => {
    let packets = 0
    return fs.map((f): Seat => {
      packets += f.took.length
      const me = all(f.rows, 'player').map(([, r]) => r)[0]
      const vehicles = all(f.rows, 'box3dvehicle')
      const held = (me?.held as { id: number } | null | undefined)?.id
      const theirs = all(f.rows, 'player').map(([, r]) => (r.held as { id: number } | null | undefined)?.id).find(id => id !== held)
      const mine = vehicles.find(([id]) => Number(id) === held)?.[1]
      const other = vehicles.find(([id]) => Number(id) === theirs)?.[1]
      return { own: chassisOf(f.rows, mine), other: chassisOf(f.rows, other), n: f.n ?? 0, packets }
    })
  })
  const count = Math.min(...pages.map(fs => fs.length))
  const frames: Frame[] = Array.from({ length: count }, (_, k) => ({ k, t: pages[0][k].t, seats: seats.map(s => s[k]) }))
  const hit = frames.findIndex(f => f.t >= hitStep!.t)
  if (hit < 0 || hit + AFTER >= frames.length) throw new Error(`the cars hit at ${hitStep.t} ms, too late for ${AFTER} frames after it in ${MS} ms`)
  const press = pages.map(fs => fs.findIndex(f => f.t > PRESS_AT))
  return { frames: frames.slice(0, hit + AFTER + 1), server, press, hit }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { frames, hit } = await lag()
  const car = (c?: Car) => c ? `${c.pos.map(v => v.toFixed(2)).join(',')} h${c.heading.toFixed(2)} v${c.forward.toFixed(2)}` : '-'
  for (const f of frames) f.seats.forEach((s, i) => console.log(`${f.k} seat${i} step ${s.n} own ${car(s.own)} other ${car(s.other)} packets ${s.packets}`))
  const last = frames[frames.length - 1]
  console.log(`hit at frame ${hit}; ${last.seats.map((s, i) => `seat${i} packets ${s.packets}`).join(', ')}`)
}

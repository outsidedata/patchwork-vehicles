// vehicles under 150 ms of lag each way, two pages on it on the simulator (`vehicles.lag.ts`). Each page
// draws each car moving once its seat's press has been to the server and back, its own as the other;
// once the cars have hit and 60 frames have passed, both pages draw both cars where the server had
// them at the step of the packet each page drew; and no page ever draws a car jump.
import { beforeAll, expect, test, vi } from 'vitest'
import { lag, LAG, type Car, type Frame } from './vehicles.lag.ts'

vi.setConfig({ testTimeout: 120_000, hookTimeout: 120_000 })

let frames: Frame[] = []
let server = new Map<number, Car[]>()
let press: number[] = []
let hit = -1
beforeAll(async () => ({ frames, server, press, hit } = await lag()))

// A car drawn moving: its forward speed above 0.05 m/s, Box3D's sleep threshold, below which it
// counts a body as still. A car settling on soft springs rocks slower than that for a while.
const moving = (v: number | undefined) => v !== undefined && Math.abs(v) > 0.05
// A car spawns a little above the land and settles on its springs; by frame 50 it is at rest. The
// first frame from then that a page draws a car moving.
const REST = 50
const first = (seat: number, which: 'own' | 'other') => frames.findIndex(f => f.k >= REST && moving(f.seats[seat][which]?.forward))
// The server's car of each seat after step n.
const serverAt = (n: number) => server.get(n)

test.skip('each page draws each car moving no earlier than the round trip after its seat\'s press, its own as the other, and by frame 90', () => {
  for (const seat of [0, 1]) {
    for (const f of frames.slice(REST, press[seat])) for (const c of [f.seats[seat].own, f.seats[seat].other]) expect(moving(c?.forward)).toBe(false)
    expect(first(seat, 'own')).toBeGreaterThan(0)
    expect(first(seat, 'own')).toBeGreaterThanOrEqual(press[seat] + 2 * LAG)
    expect(first(seat, 'own')).toBeLessThanOrEqual(90)
    expect(first(seat, 'other')).toBeGreaterThanOrEqual(press[1 - seat] + 2 * LAG)
    expect(first(seat, 'other')).toBeLessThanOrEqual(90)
  }
})

test.skip('the cars hit, and from 60 frames after, both pages draw both cars within 0.5 m of the server\'s at the step of the packet each drew', () => {
  expect(hit).toBeGreaterThan(Math.max(...press))
  for (const f of frames.slice(hit + 60)) {
    f.seats.forEach((s, seat) => {
      const truth = serverAt(s.n)
      if (!truth) return
      const off = (a: number[], b: number[]) => Math.hypot(...a.map((c, i) => c - b[i]))
      expect(off(s.own!.pos, truth[seat].pos)).toBeLessThan(0.5)
      expect(off(s.other!.pos, truth[1 - seat].pos)).toBeLessThan(0.5)
    })
  }
})

test.skip('no page draws a car jumping more than 0.5 m from one frame to the next beyond its own motion', () => {
  let worst = 0
  for (let k = 1; k < frames.length; k++) for (const seat of [0, 1]) for (const which of ['own', 'other'] as const) {
    const a = frames[k - 1].seats[seat][which], b = frames[k].seats[seat][which]
    if (!a || !b) continue
    const moved = Math.hypot(...b.pos.map((c, i) => c - a.pos[i]))
    worst = Math.max(worst, moved - Math.hypot(...b.vel) * (1 / 60))
  }
  expect(worst).toBeLessThan(0.5)
})

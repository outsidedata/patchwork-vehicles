// The title booted as the server boots it, a seat entering it as the entry. The cars stand with their
// brakes on and the intro waits until the curtain's `ready`; `ready` starts the intro and every driver
// in one step; the cars then drive their routes, following their `next` waypoints round; at the end the
// cast's `direct` is null and the cars drive on; a skip ends the intro at once; the curtain starts it
// alone after its `wait`; a seat cannot start a driver; and a driver handed a cue it cannot obey throws.
import { expect, test, vi } from 'vitest'
import { boot, type Row, type Scene } from '#engine/engine.ts'
import { connection, load, manager, type Down } from '#addons/scenemanager/scenemanager.addon.ts'
import { sim } from './vehicles.sim.ts'
import { driver } from './driver.sim.ts'
import file from './vehicles.scene.json'
import defs from './assets/vehicles.json'
import intro from './assets/intro.json'

vi.setConfig({ testTimeout: 300_000 })

const DT = file.prefabs.engine.dt
const here = new URL('./', import.meta.url).href

async function title() {
  const truth = boot(structuredClone(file) as Scene, sim)
  const room = (await load(truth, here)).get('title')!
  const heard: Down[] = []
  const seat = connection(manager(truth), d => heard.push(d))
  truth.step(DT)
  let seq = 0
  const send = (id: number, action: string, ...args: any[]) => {
    const last = heard[heard.length - 1]
    seat.take({ scene: last.scene, seat: last.seat, msg: { seq: ++seq, n: last.packet.n, id, action, args } })
  }
  const one = (kind: string) => room.rows.find(r => r.kind === kind)!
  const drivers = () => room.rows.filter(r => r.kind === 'driver')
  const step = (k: number) => { for (let i = 0; i < k; i++) truth.step(DT) }
  return { truth, room, heard, send, one, drivers, step }
}
const speed = (rows: Row[], d: Row) => {
  const car = rows.find(r => r.id === d.data.made)!
  const [vx, , vz] = rows.find(r => r.id === car.data.chassis)!.data.vel
  return Math.hypot(vx, vz)
}

test('the seat enters the title, where the intro waits and the cars stand braked until the curtain\'s ready', async () => {
  const g = await title()
  expect(g.heard[g.heard.length - 1].scene).toBe(file.prefabs.scenemanager.entry)
  g.step(60)
  expect(g.one('cutscene').data.running).toBe(false)
  for (const d of g.drivers()) {
    expect(d.data.on).toBe(false)
    const car = g.room.rows.find(r => r.id === d.data.made)!
    expect(car.data.brake).toBe(1)
  }
})

test('ready starts the intro and every driver in one step, and the cars drive their routes round', async () => {
  const g = await title()
  g.send(g.one('curtain').id, 'ready')
  g.step(1)
  expect(g.one('cutscene').data.running).toBe(true)
  expect(g.one('cutscene').data.e).toBeCloseTo(DT, 9)
  for (const d of g.drivers()) expect(d.data.on).toBe(true)
  const first = new Map(g.drivers().map(d => [d.id, d.data.next]))
  g.step(Math.round(40 / DT))
  for (const d of g.drivers()) {
    expect(d.data.next).not.toBe(first.get(d.id))
    expect(speed(g.room.rows, d)).toBeGreaterThan(defs.driver.speeds[d.data.vehicle as keyof typeof defs.driver.speeds] * (1 - defs.driver.corner))
  }
})

test('at the intro\'s end the cast is let go and the cars drive on', async () => {
  const g = await title()
  g.send(g.one('curtain').id, 'ready')
  g.step(Math.ceil(intro.end / DT) + 2)
  expect(g.one('cutscene').data.done).toBe(true)
  for (const d of g.drivers()) expect(d.data.direct).toBe(null)
  g.step(60)
  for (const d of g.drivers()) expect(speed(g.room.rows, d)).toBeGreaterThan(1)
})

test('a skip ends the intro at once, and the cars drive on', async () => {
  const g = await title()
  g.send(g.one('curtain').id, 'ready')
  g.step(120)
  g.send(g.one('cutscene').id, 'skip')
  g.step(2)
  expect(g.one('cutscene').data.done).toBe(true)
  g.step(120)
  for (const d of g.drivers()) expect(speed(g.room.rows, d)).toBeGreaterThan(1)
})

test('the curtain starts the intro alone after its wait, and a ready after does nothing', async () => {
  const g = await title()
  g.step(Math.ceil(defs.curtain.wait / DT) + 1)
  expect(g.one('cutscene').data.running).toBe(true)
  const e = g.one('cutscene').data.e
  g.send(g.one('curtain').id, 'ready')
  g.step(1)
  expect(g.one('cutscene').data.e).toBeCloseTo(e + DT, 9)
})

test('no seat can start a driver', async () => {
  const g = await title()
  const d = g.drivers()[0]
  g.send(d.id, 'start')
  g.step(1)
  expect(g.drivers()[0].data.on).toBe(false)
})

test('a driver handed a cue it cannot obey throws, naming it', () => {
  const me = { id: 1, kind: 'driver', data: { name: 'jeep', direct: { walk: { to: [0, 0] } } } } as unknown as Row
  expect(() => driver.tick!(me, DT, {} as never)).toThrow('the driver jeep drives itself, and takes no walk')
})

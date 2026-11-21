// The title booted as the server boots it, a seat entering it as the entry. The jeep is the one car on
// it, made on the dunes and driving from the first step, with nothing to wait for: it drives round its
// route, every waypoint of it, staying on its wheels and at speed.
import { expect, test, vi } from 'vitest'
import { boot, type Row, type Scene } from '#engine/engine.ts'
import { connection, load, manager, type Down } from '#addons/scenemanager/scenemanager.addon.ts'
import { sim } from './vehicles.sim.ts'
import file from './vehicles.scene.json'
import defs from './assets/vehicles.json'

vi.setConfig({ testTimeout: 300_000 })

const DT = file.prefabs.engine.dt
const here = new URL('./', import.meta.url).href

async function title() {
  const truth = boot(structuredClone(file) as Scene, sim)
  const room = (await load(truth, here)).get('title')!
  const heard: Down[] = []
  connection(manager(truth), d => heard.push(d))
  truth.step(DT)
  const drivers = () => room.rows.filter(r => r.kind === 'driver')
  const step = (k: number) => { for (let i = 0; i < k; i++) truth.step(DT) }
  return { heard, room, drivers, step }
}
const chassisOf = (rows: Row[], d: Row) => rows.find(r => r.id === rows.find(c => c.id === d.data.made)!.data.chassis)!
const speed = (rows: Row[], d: Row) => {
  const [vx, , vz] = chassisOf(rows, d).data.vel
  return Math.hypot(vx, vz)
}
// How far the chassis's up leans from the world's: its y, 1 upright and 0 on its side.
const upright = (rows: Row[], d: Row) => {
  const [x, , z] = chassisOf(rows, d).data.rot
  return 1 - 2 * (x * x + z * z)
}

test('the seat enters the title, where the jeep is the one car and is driving from the first step', async () => {
  const g = await title()
  expect(g.heard[g.heard.length - 1].scene).toBe(file.prefabs.scenemanager.entry)
  expect(g.drivers().map(d => d.data.vehicle)).toEqual(['jeep'])
  g.step(120)
  expect(g.room.rows.filter(r => r.kind === 'box3dvehicle')).toHaveLength(1)
  const [jeep] = g.drivers()
  expect(speed(g.room.rows, jeep)).toBeGreaterThan(defs.driver.speeds.jeep * (1 - defs.driver.corner))
})

test('the jeep drives its route round on the dunes, every waypoint of it, upright', async () => {
  const g = await title()
  const [jeep] = g.drivers()
  const route = defs.driver.routes[jeep.data.route as keyof typeof defs.driver.routes]
  const seen = new Set<number>()
  let lowest = 1
  for (let second = 0; second < 90; second++) {
    g.step(Math.round(1 / DT))
    seen.add(jeep.data.next)
    lowest = Math.min(lowest, upright(g.room.rows, jeep))
  }
  expect([...seen].sort()).toEqual(route.map((_, i) => i))
  expect(lowest).toBeGreaterThan(0.8)
  expect(speed(g.room.rows, jeep)).toBeGreaterThan(1)
})

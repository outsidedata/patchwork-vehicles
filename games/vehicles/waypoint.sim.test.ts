// The waypoint on the road, booted as the server boots it with two seats come from the title: it
// stands at the land's height between `min` and `max` metres from the first car, a car a seat holds
// reaching it throws the effect from its middle and sends it between `min` and `max` from that car, and
// a car nobody holds reaches nothing.
import { expect, test, vi } from 'vitest'
import { boot, type Row, type Scene, type Truth, type W } from '#engine/engine.ts'
import { connection, load, manager } from '#addons/scenemanager/scenemanager.addon.ts'
import { heightAt } from '#plugins/terrain3d/terrain3d.sim.ts'
import { sim } from './vehicles.sim.ts'
import { sim as roadSim } from './road.sim.ts'
import file from './vehicles.scene.json'
import defs from './assets/vehicles.json'

vi.setConfig({ testTimeout: 60_000 })

const DT = file.prefabs.engine.dt
const here = new URL('./', import.meta.url).href
const k = defs.waypoint

// The road's `w`, as box3d's tick is handed it each step, for terrain3d's queries.
let w: W
const box3d = roadSim.box3d
roadSim.box3d = { ...box3d, tick(me, dt, ww) { w = ww; box3d.tick!(me, dt, ww) } }

async function road() {
  const truth = boot(structuredClone(file) as Scene, sim)
  const road = (await load(truth, here)).get('road')!
  const step = (n: number) => { for (let i = 0; i < n; i++) truth.step(DT) }
  for (let s = 0; s < 2; s++) {
    const heard: { scene: string; seat: number; n: number; rows: Row[] }[] = []
    const c = connection(manager(truth), d => heard.push({ scene: d.scene, seat: d.seat, n: d.packet.n, rows: d.packet.rows }))
    step(1)
    const last = heard[heard.length - 1], id = last.rows.find(r => r.kind === 'scenemanager')!.id
    c.take({ scene: last.scene, seat: last.seat, msg: { seq: 1, n: last.n, id, action: 'go', args: [defs.marquee.places[0].scene] } })
  }
  step(30)
  return { road, step }
}
const ring = (road: Truth) => road.rows.find(r => r.kind === 'waypoint')!
const car = (road: Truth, vehicle: string) => road.rows.find(r => r.kind === 'box3dvehicle' && r.data.vehicle === vehicle)!
const chassis = (road: Truth, c: Row) => road.rows.find(r => r.id === c.data.chassis)!.data.pos as number[]
const across = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[2] - b[2])
// Stood on the land: its middle `radius - sink` over the land's height there.
const stands = (pos: number[]) => expect(pos[1] - heightAt(w, pos[0], pos[2])).toBeCloseTo(k.ring.radius - k.ring.sink, 9)

test('the ring stands on the land between min and max metres from the first car', async () => {
  const g = await road()
  const pos = ring(g.road).data.pos
  const first = g.road.rows.find(r => r.kind === 'box3dvehicle')!
  const d = across(pos, chassis(g.road, first))
  expect(d).toBeGreaterThanOrEqual(k.min - 0.5)
  expect(d).toBeLessThanOrEqual(k.max + 0.5)
  stands(pos)
  expect(ring(g.road).data.n).toBe(0)
})

test('a held car within reach throws the effect from the ring and sends it between min and max from that car; one nobody holds reaches nothing', async () => {
  const g = await road()
  // The ring put on the UTV, which nobody holds and stands past reach of the cars the seats hold:
  // nothing.
  const utv = chassis(g.road, car(g.road, 'utv'))
  for (const held of ['jeep', 'cart']) expect(across(utv, chassis(g.road, car(g.road, held)))).toBeGreaterThan(k.reach)
  ring(g.road).data.pos = [...utv]
  g.step(1)
  expect(ring(g.road).data.n).toBe(0)
  // On the jeep, which the first seat holds.
  const jeep = car(g.road, 'jeep')
  const was = [...chassis(g.road, jeep)]
  ring(g.road).data.pos = [...was]
  g.step(1)
  expect(ring(g.road).data.n).toBe(1)
  const live = g.road.rows.find(r => r.kind === 'particle3d')!.data.live as { effect: string; at: number[] }[]
  expect(live.filter(e => e.effect === k.effect).map(e => e.at)).toEqual([was])
  const pos = ring(g.road).data.pos, d = across(pos, chassis(g.road, jeep))
  expect(d).toBeGreaterThanOrEqual(k.min - 0.5)
  expect(d).toBeLessThanOrEqual(k.max + 0.5)
  stands(pos)
})

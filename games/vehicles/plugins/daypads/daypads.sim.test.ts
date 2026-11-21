// The day pads on the road, booted as the server boots it with two seats come from the title: the one `daypads` row holds
// the pads of the road's entry, each standing on the land at its `x`, `z`; a car a seat holds driving into one sets the
// sky's clock to that pad's hour and the car's headlights to that pad's `lights`, once, as it enters; and a car high over
// a pad is not in it. A pad its file gives wrongly is refused, naming it.
import { expect, test, vi } from 'vitest'
import { boot, type Row, type Scene, type Truth, type W } from '#engine/engine.ts'
import { connection, load, manager } from '#addons/scenemanager/scenemanager.addon.ts'
import { heightAt } from '#plugins/terrain3d/terrain3d.sim.ts'
import { sim } from '../../vehicles.sim.ts'
import { sim as roadSim } from '../../road.sim.ts'
import { checked, type Pad } from './daypads.sim.ts'
import file from '../../vehicles.scene.json'
import road_scene from '../../road.scene.json'
import plains from '../../plains.partial_scene.json'
import defs from '../../assets/vehicles.json'

vi.setConfig({ testTimeout: 60_000 })

const DT = file.prefabs.engine.dt
const here = new URL('../../', import.meta.url).href
const k = defs.daypads

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
    c.take({ scene: last.scene, seat: last.seat, msg: { seq: 1, n: last.n, id, action: 'go', args: ['road'] } })
  }
  step(30)
  return { road, step }
}
const pads = (road: Truth) => road.rows.find(r => r.kind === 'daypads')!
const sky = (road: Truth) => road.rows.find(r => r.kind === 'skydome3d')!
const hourOf = (road: Truth) => (sky(road).data.t / plains.world.skydome3d.day) * 24
const car = (road: Truth, vehicle: string) => road.rows.find(r => r.kind === 'box3dvehicle' && r.data.vehicle === vehicle)!
const chassis = (road: Truth, c: Row) => road.rows.find(r => r.id === c.data.chassis)!.data.pos as number[]
// Pad `i` moved to stand at [x, z] with its column's foot at `y`, as a new row value.
const moved = (p: Row, i: number, [x, y, z]: number[]) => {
  p.data.pads = (p.data.pads as Pad[]).map((pad, j) => (j === i ? { ...pad, x, z } : pad))
  p.data.foot = (p.data.foot as number[]).map((f, j) => (j === i ? y : f))
}
// Pad `i` moved far from every car.
const away = (p: Row, i: number) => moved(p, i, [1e5, 0, 1e5])

test('the one row holds the road\'s entry\'s pads, each standing on the land under it', async () => {
  const g = await road()
  const entry = road_scene.actors.filter(a => a.is === 'daypads')
  expect(entry).toHaveLength(1)
  expect(pads(g.road).data.pads).toEqual(entry[0].pads)
  const foot = pads(g.road).data.foot as number[]
  expect(foot).toHaveLength(entry[0].pads.length)
  foot.forEach((y, i) => expect(y).toBe(heightAt(w, entry[0].pads[i].x, entry[0].pads[i].z)))
})

test('a held car driving into a pad sets that pad\'s hour and headlights once; leaving and entering again sets them again', async () => {
  const g = await road()
  const p = pads(g.road), list = p.data.pads as Pad[]
  const jeep = car(g.road, 'jeep')
  const was = [...chassis(g.road, jeep)]
  for (let i = 1; i < list.length; i++) away(p, i)
  moved(p, 0, [was[0], was[1] - 1, was[2]])
  g.step(1)
  expect((p.data.in as number[][])[0]).toEqual([jeep.id])
  expect(hourOf(g.road)).toBeCloseTo(list[0].hour, 6)
  expect(jeep.data.lights).toBe(list[0].lights)
  // Staying in it: the clock and the lights set by something else are left alone.
  sky(g.road).data.t = 0
  jeep.data.lights = !list[0].lights
  g.step(1)
  expect(sky(g.road).data.t).toBe(0)
  expect(jeep.data.lights).toBe(!list[0].lights)
  // Out of it, then in again.
  away(p, 0)
  g.step(1)
  expect((p.data.in as number[][])[0]).toEqual([])
  moved(p, 0, [was[0], was[1] - 1, was[2]])
  g.step(1)
  expect(hourOf(g.road)).toBeCloseTo(list[0].hour, 6)
  expect(jeep.data.lights).toBe(list[0].lights)
  // Each other pad sets its own hour, and its own lights, on or off, never over: the lights are set to what the pad says
  // from either state the car had them in.
  expect(new Set(list.map(pad => pad.lights)).size).toBe(2)
  for (const [i, pad] of list.entries()) for (const had of [true, false]) {
    away(p, 0)
    for (let j = 1; j < list.length; j++) away(p, j)
    g.step(1)
    jeep.data.lights = had
    moved(p, i, [was[0], was[1] - 1, was[2]])
    g.step(1)
    expect(hourOf(g.road)).toBeCloseTo(pad.hour, 6)
    expect(jeep.data.lights).toBe(pad.lights)
  }
})

test('a held car over the top of the column is not in it', async () => {
  const g = await road()
  const p = pads(g.road)
  sky(g.road).data.t = 0
  const jeep = chassis(g.road, car(g.road, 'jeep'))
  moved(p, 0, [jeep[0], jeep[1] - k.height - 5, jeep[2]])
  g.step(1)
  expect((p.data.in as number[][])[0]).toEqual([])
  expect(sky(g.road).data.t).toBe(0)
})

test('a pad its file gives wrongly is refused, naming it', () => {
  const good = { x: 1, z: 2, hour: 5.5, lights: true, colour: '#fff' }
  expect(checked([good])).toEqual([good])
  expect(() => checked({})).toThrow('no pads list')
  expect(() => checked([good, { ...good, x: '1' }])).toThrow('daypads pad 1 has no number x')
  expect(() => checked([{ ...good, hour: 24 }])).toThrow('daypads pad 0 has the hour 24')
  expect(() => checked([{ ...good, lights: 1 }])).toThrow('daypads pad 0 has lights 1')
  expect(() => checked([{ ...good, colour: undefined }])).toThrow('daypads pad 0 has no colour')
})

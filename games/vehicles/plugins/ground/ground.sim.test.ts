// vehicles's ground on the road, booted as the server boots it. At the start the road holds the chunks
// under every spot, and each spot's car spawns at the land's height there plus the height its vehicle
// stands at (box3dvehicle's `standing`) and its `spawnLift`, and settles on
// its wheels. The car a seat gets into, its pedal held down for 150 m: at every step the chunk under where its velocity
// takes it in `ahead` seconds is listed, it never goes below the land, and the list never holds more
// than `radius` and `ahead` allow.
import { expect, test, vi } from 'vitest'
import { boot, type Row, type Scene, type W } from '#engine/engine.ts'
import { connection, load, manager } from '#addons/scenemanager/scenemanager.addon.ts'
import { heightAt } from '#plugins/terrain3d/terrain3d.sim.ts'
import { standing, type Fleet } from '#plugins/box3dvehicle/box3dvehicle.sim.ts'
import { sim } from '../../vehicles.sim.ts'
import { sim as roadSim } from '../../road.sim.ts'
import file from '../../vehicles.scene.json'
import roadFile from '../../road.scene.json'
import defs from '../../assets/vehicles.json'

vi.setConfig({ testTimeout: 300_000 })

const DT = file.prefabs.engine.dt
const here = new URL('../../', import.meta.url).href
const { count, cell } = file.world.box3d.chunk
const SPAN = (count - 1) * cell
const { ahead, radius, spawnLift } = defs.car
const pads = roadFile.actors.filter(a => a.is === 'spot') as unknown as { x: number; z: number; vehicle: string }[]
const fleet = file.world.box3dvehicle as unknown as Fleet
const keyOf = (x: number, z: number) => `${Math.floor(x / SPAN)},${Math.floor(z / SPAN)}`

let w: W
const box3d = roadSim.box3d
roadSim.box3d = { ...box3d, tick(me, dt, ww) { w = ww; box3d.tick!(me, dt, ww) } }

// The manager, the road and `seats` connections, each come from the title, the entry, by the word that
// goes to the plains (the marquee's first place), as a player picks it; with `arrive` false they stay
// on the title and the road has not stepped yet (it steps with or without a seat, `suspend` false).
async function road(seats: number, arrive = true) {
  const truth = boot(structuredClone(file) as Scene, sim)
  const road = (await load(truth, here)).get('road')!
  const heard: { seat: number; rows: Row[] }[][] = []
  const at: { scene: string; seat: number; n: number; rows: Row[] }[] = []
  const conns = []
  for (let s = 0; s < seats; s++) {
    const mine: { seat: number; rows: Row[] }[] = []
    heard.push(mine)
    const c = connection(manager(truth), d => {
      mine.push({ seat: d.seat, rows: d.packet.rows })
      at[s] = { scene: d.scene, seat: d.seat, n: d.packet.n, rows: d.packet.rows }
    })
    Object.assign(mine, { c })
    conns.push(c)
  }
  if (!arrive) return { truth, road, heard, step: () => truth.step(DT) }
  truth.step(DT)
  conns.forEach((c, s) => {
    const id = at[s].rows.find(r => r.kind === 'scenemanager')!.id
    c.take({ scene: at[s].scene, seat: at[s].seat, msg: { seq: 1, n: at[s].n, id, action: 'go', args: [defs.marquee.places[0].scene] } })
  })
  truth.step(DT)
  return { truth, road, heard, step: () => truth.step(DT) }
}
const listed = (rows: Row[]) => new Set((rows.find(r => r.kind === 'box3d')!.data.ground as number[][]).map(k => `${k[0]},${k[1]}`))

test('at the start the road holds the chunks under every spot, and each spot\'s car spawns at the land plus where it stands and its spawnLift, and settles on its wheels', async () => {
  const g = await road(2, false)
  const at0 = listed(g.road.rows)
  for (const pad of pads) expect(at0.has(keyOf(pad.x, pad.z))).toBe(true)
  let spawned: number[][] = []
  for (let k = 0; k < 3 && spawned.length < pads.length; k++) {
    g.step()
    spawned = g.road.rows.filter(r => r.kind === 'box3dvehicle').map(r => g.road.rows.find(c => c.id === r.data.chassis)?.data.pos).filter(Boolean)
  }
  expect(spawned).toHaveLength(pads.length)
  pads.forEach((pad, i) => {
    expect(spawned[i][0]).toBeCloseTo(pad.x, 6)
    expect(spawned[i][2]).toBeCloseTo(pad.z, 6)
    expect(spawned[i][1]).toBeCloseTo(heightAt(w, pad.x, pad.z) + standing(fleet.vehicles[pad.vehicle]) + spawnLift, 2)
  })
  for (let k = 0; k < 60; k++) g.step()
  const cars = g.road.rows.filter(r => r.kind === 'box3dvehicle')
  cars.forEach((car, i) => {
    const chassis = g.road.rows.find(r => r.id === car.data.chassis)!.data
    expect(Math.hypot(chassis.pos[0] - spawned[i][0], chassis.pos[1] - spawned[i][1], chassis.pos[2] - spawned[i][2])).toBeLessThan(0.5)
    // each wheel's bottom, its centre less its radius, within 0.5 m of the land
    car.data.wheels.forEach((id: number, k: number) => {
      const [x, y, z] = g.road.rows.find(r => r.id === id)!.data.pos
      expect(y - fleet.vehicles[car.data.vehicle].axles[k >> 1].wheel.radius - heightAt(w, x, z)).toBeLessThan(0.5)
    })
  })
})

test('a car held at full pedal for 150 m: the chunk ahead is listed before it gets there, it never goes below the land, and the list stays within its bound', async () => {
  const g = await road(1)
  for (let k = 0; k < 30; k++) g.step()
  const me = g.heard[0][g.heard[0].length - 1]
  const player = me.rows.find(r => r.kind === 'player')!
  // the seat gets into the jeep it stands by (`use`), then holds the pedal
  ;(g.heard[0] as any).c.take({ scene: 'road', seat: me.seat, msg: { seq: 1, n: g.road.n, id: player.id, action: 'use', args: [] } })
  for (let k = 0; g.road.rows.find(r => r.id === player.id)!.data.board !== 'seated'; k++) {
    g.step()
    expect(k).toBeLessThan(1200)
  }
  ;(g.heard[0] as any).c.take({ scene: 'road', seat: me.seat, msg: { seq: 2, n: g.road.n, id: player.id, action: 'pedal', args: [1] } })
  const held = g.road.rows.find(r => r.id === player.id)!.data.held.id
  const car = () => g.road.rows.find(r => r.id === held)!
  const chassis = () => g.road.rows.find(r => r.id === car().data.chassis)!.data
  const start = [...chassis().pos]
  let steps = 0
  while (Math.hypot(chassis().pos[0] - start[0], chassis().pos[2] - start[2]) < 150) {
    g.step()
    steps++
    expect(steps).toBeLessThan(20000)
    const { pos, vel } = chassis()
    const keys = listed(g.road.rows)
    expect(keys.has(keyOf(pos[0] + vel[0] * ahead, pos[2] + vel[2] * ahead))).toBe(true)
    expect(pos[1]).toBeGreaterThan(heightAt(w, pos[0], pos[2]))
    // every car streams its own chunks, the parked ones too: the bound is theirs summed
    const bound = g.road.rows.filter(r => r.kind === 'box3dvehicle').reduce((n, c) => {
      const v = g.road.rows.find(r => r.id === c.data.chassis)!.data.vel
      return n + (Math.ceil(Math.hypot(v[0], v[2]) * ahead / (SPAN / 2)) + 1) * (2 * radius + 1) ** 2
    }, 0)
    expect(keys.size).toBeLessThanOrEqual(bound)
  }
})

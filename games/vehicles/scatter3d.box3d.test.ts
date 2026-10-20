// scatter3d's mod for box3d in vehicles. The manager names it in `world.box3d.mods.props`, so every
// child that steps box3d with scatter3d's numbers has its trees and boulders solid: the road, booted
// as its server boots it, hands box3d scatter3d's props, and a jeep driven flat out at a fir stops at
// its trunk instead of passing through it.
import { expect, test, vi } from 'vitest'
import { boot, type Row, type Scene, type Truth } from '#engine/engine.ts'
import { load, modsOf } from '#addons/scenemanager/scenemanager.addon.ts'
import { heightAt } from '#plugins/terrain3d/terrain3d.sim.ts'
import { placed, solids, type Solid } from '#plugins/scatter3d/scatter3d.sim.ts'
import { props } from '#plugins/scatter3d/scatter3d.box3d.ts'
import { standing, type Fleet } from '#plugins/box3dvehicle/box3dvehicle.sim.ts'
import { sim } from './vehicles.sim.ts'
import file from './vehicles.scene.json'

vi.setConfig({ testTimeout: 120_000 })

const DT = file.prefabs.engine.dt
const here = new URL('./', import.meta.url).href
const fleet = file.world.box3dvehicle as unknown as Fleet
const road = async () => (await load(boot(structuredClone(file) as Scene, sim), here)).get('road')!
const chassis = (t: Truth, car: Row) => t.rows.find(r => r.id === car.data.chassis)!.data

test('vehicles\'s road gives box3d scatter3d\'s props', async () => {
  const t = await road()
  expect(modsOf(t.world, 'box3d', 'props')).toEqual([props])
})

test('a jeep driven flat out at a fir stops at its trunk and never passes it', async () => {
  const t = await road()
  t.step(DT)
  const w = { world: t.world, scene: { world: t.world } } as any
  const ground = placed(w)
  // A tall fir with nothing else solid within 6 m of the jeep's way to it from the west, nor for 12 m
  // past it, on ground that rises or falls less than half a metre along it. The jeep starts with its
  // nose 2 m short of the trunk, so, unsteered, it is still on the trunk's line when it gets there.
  const { width, length } = fleet.vehicles.jeep.body
  const near = solids(w, 0, 0, 400, ground)
  const clear = (s: Solid) => near.every(o => o === s || Math.abs(o.z - s.z) > o.radius + 6 || o.x > s.x + 12 || o.x < s.x - 8)
  const level = (s: Solid) => [-6, -3, 0, 3, 6].every(d => Math.abs(heightAt(w, s.x - d, s.z) - heightAt(w, s.x, s.z)) < 0.5)
  const fir = near.find(s => s.tall !== undefined && s.tall > 5 && clear(s) && level(s))!
  expect(fir).toBeDefined()
  const x = fir.x - fir.radius - length / 2 - 2, z = fir.z
  const car = t.spawn('box3dvehicle', { vehicle: 'jeep', pos: [x, heightAt(w, x, z) + standing(fleet.vehicles.jeep) + 0.1, z], rot: [0, 0, 0, 1] })
  for (let i = 0; i < 90; i++) t.step(DT)
  Object.assign(car.data, { gear: 1, throttle: 1 })
  // The jeep's middle never comes nearer the trunk than the trunk's radius and half the jeep's width,
  // the nearest its side can bring it, so no part of the body is ever inside the trunk; and it gets
  // within its nose of it, so it was the trunk that held it off, not falling short.
  let closest = Infinity
  for (let i = 0; i < 60 * 3; i++) {
    t.step(DT)
    const [cx, , cz] = chassis(t, car).pos
    closest = Math.min(closest, Math.hypot(fir.x - cx, fir.z - cz))
  }
  expect(closest).toBeGreaterThan(fir.radius + width / 2 - 0.1)
  expect(closest).toBeLessThan(fir.radius + length / 2 + 0.5)
})

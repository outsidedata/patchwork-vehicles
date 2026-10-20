// box3d's mod for box3dvehicle. Vehicles's road, loaded as its server loads it, names it for
// box3dvehicle's `gravity`.
import { expect, test } from 'vitest'
import { boot, type Scene } from '#engine/engine.ts'
import { load, mod } from '#addons/scenemanager/scenemanager.addon.ts'
import { gravity } from '#plugins/box3d/box3d.box3dvehicle.ts'
import { sim } from './vehicles.sim.ts'
import file from './vehicles.scene.json'

test('vehicles\'s road gives its cars box3d\'s gravity, its world.box3d.gravity', async () => {
  const road = (await load(boot(structuredClone(file) as Scene, sim), new URL('./', import.meta.url).href)).get('road')!
  expect(mod(road.world, 'box3dvehicle', 'gravity')).toBe(gravity)
  expect(road.world.box3d.gravity).toEqual([0, -9.8, 0])
})

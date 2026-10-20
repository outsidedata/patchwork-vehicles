// terrain3d's mod for box3dvehicle. Vehicles's road, loaded as its page and server load it, names it for
// box3dvehicle's `land`, `grip` and `drag` and lists terrain3d ahead of box3dvehicle. What `grip` and
// `drag` do to a car is in `gym.test.ts`.
import { expect, test } from 'vitest'
import { boot, type Scene } from '#engine/engine.ts'
import { ahead, load, mod } from '#addons/scenemanager/scenemanager.addon.ts'
import { drag, grip, land } from '#plugins/terrain3d/terrain3d.box3dvehicle.ts'
import { sim } from './vehicles.sim.ts'
import file from './vehicles.scene.json'

const here = new URL('./', import.meta.url).href

test('vehicles\'s road gives box3dvehicle this land, from a plugin it lists ahead of box3dvehicle', async () => {
  const road = (await load(boot(structuredClone(file) as Scene, sim), here)).get('road')!
  expect(mod(road.world, 'box3dvehicle', 'land')).toBe(land)
  expect(() => ahead(road.scene, 'box3dvehicle', 'land')).not.toThrow()
  expect(mod(road.world, 'box3dvehicle', 'grip')).toBe(grip)
  expect(mod(road.world, 'box3dvehicle', 'drag')).toBe(drag)
})

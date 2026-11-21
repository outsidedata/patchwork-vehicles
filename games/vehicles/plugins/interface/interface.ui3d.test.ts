// The interface's words for ui3d, as the title scene loads them: its `world.ui3d.mods.behaviors` names
// the interface, and `behaviors()` hands ui3d `reveal` and `sway`, each run here on a thing in a camera's
// frame as ui3d runs it.
import { expect, test } from 'vitest'
import * as THREE from 'three'
import { boot, type Scene } from '#engine/engine.ts'
import { load, modsOf } from '#addons/scenemanager/scenemanager.addon.ts'
import type { Behaviors, Placed } from '#plugins/ui3d/ui3d.plugin.ts'
import { sim } from '../../vehicles.sim.ts'
import file from '../../vehicles.scene.json' with { type: 'json' }

const base = new URL('../../', import.meta.url).href

// A thing at the camera's frame's origin, `age` seconds after it was first shown, the camera turned a
// quarter round its upright.
function thing(age: number): Placed {
  const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2)
  const holder = new THREE.Group()
  holder.quaternion.copy(q)
  const object = new THREE.Object3D()
  holder.add(object)
  return { key: 'k', holder, object, selected: false, chosen: false, age, camera: { p: new THREE.Vector3(), q }, T: THREE, plugins: {} as never }
}

test('the title delivers the interface\'s reveal and sway to ui3d, and each moves the thing as its numbers say', async () => {
  const truth = boot(structuredClone(file) as Scene, sim)
  const scenes = await load(truth, base)
  const world = scenes.get('title')!.world
  const all = modsOf<() => Behaviors>(world, 'ui3d', 'behaviors')
  expect(all.length).toBe(1)
  const { reveal, sway } = all[0]()
  expect(Object.keys(all[0]()).sort()).toEqual(['reveal', 'sway'])

  // reveal: hidden until `after`, then in from `from` in the camera's frame, turned `turn` that unwinds
  const R = { after: 1, seconds: 2, from: [0, -3, -10], turn: 0.5 }
  const early = thing(0.5)
  reveal(R, early)
  expect(early.holder.visible).toBe(false)
  const start = thing(1 + 1e-9)
  reveal(R, start)
  expect(start.holder.visible).toBe(true)
  const from = new THREE.Vector3(0, -3, -10).applyQuaternion(start.camera.q)
  expect(start.holder.position.distanceTo(from)).toBeLessThan(1e-6)
  expect(start.holder.quaternion.angleTo(start.camera.q)).toBeCloseTo(0.5, 6)
  const half = thing(2)
  reveal(R, half)
  expect(half.holder.position.length()).toBeCloseTo(from.length() * 0.5 ** 3, 6)
  const done = thing(3)
  reveal(R, done)
  expect(done.holder.position.length()).toBe(0)
  expect(done.holder.quaternion.angleTo(done.camera.q)).toBeLessThan(1e-9)

  // sway: still until `after`, then a sine of each of yaw, pitch and roll
  const S = { yaw: [0.1, 1], pitch: [0, 1], roll: [0, 1], phase: -0.7, after: 2 }
  const still = thing(1)
  sway(S, still)
  expect(still.holder.quaternion.angleTo(still.camera.q)).toBeLessThan(1e-9)
  const swung = thing(2 + Math.PI / 2)
  sway(S, swung)
  expect(swung.holder.quaternion.angleTo(swung.camera.q)).toBeCloseTo(0.1, 6)
})

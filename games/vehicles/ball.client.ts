// A ball: a sphere of its kind's one `sphere` shape's radius in the scene's `world.box3d.kinds`
// table, which box3d moves, in its definition's `colour` (`assets/vehicles.json`): a standard material
// render3d dresses, so the sky's light, wet and snow reach it, casting and taking shadows.
import type { Row } from '#engine/engine.ts'
import type { Plugins } from '#engine/browser.ts'
import { def } from '#plugins/loader/loader.sim.ts'

let mesh: any
let id = 0

export function setup(row: Row, plugins: Plugins) {
  const { THREE, scene } = plugins.render3d
  const { radius } = plugins.wire.scene.world!.box3d.kinds[row.kind].shapes[0].sphere
  mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 32, 24), plugins.render3d.dress(new THREE.MeshStandardMaterial({ color: def(plugins.wire, row.kind).colour })))
  mesh.castShadow = mesh.receiveShadow = true
  scene.add(mesh)
  id = row.id
  plugins.box3d.follow(id, mesh)
}

export function tick() {}

export function remove(plugins: Plugins) {
  plugins.box3d.drop(id)
  plugins.render3d.scene.remove(mesh)
  mesh.geometry.dispose()
  mesh.material.dispose()
}

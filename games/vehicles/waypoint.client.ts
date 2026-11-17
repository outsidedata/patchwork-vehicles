// The waypoint's look: the ring, and where it is on the screen. Every number is the `waypoint`
// definition's in `assets/vehicles.json`, every look a ui style in `vehicles.scene.json`.
//   The ring: a torus `ring.radius` round and `ring.tube` thick, standing up at the row's `pos`, in
//   `ring.colour` lit from inside at `ring.glow`, drawn in render3d, casting no shadow. It turns about
//   up from its `yaw`, `ring.spin` radians a second of the moment drawn, `(n − 1 + between) × dt`, the
//   steps' clock and never the page's; its turn is set whole, as a quaternion. The spin is only drawn,
//   so no rule reads it. A point light (`light`: colour, intensity, distance, decay) shines from its
//   middle. The ring and the light jump when the row's `n` changes, or when it is first placed: they
//   are flagged `userData.teleport` that frame, so render3d draws them at the new place and never
//   sliding there, and lowered on the next.
//   On the UI's `waypoint` panel, from the point `marker.lift` metres over the ring's top:
//   - while that point is on the screen, `marker.edge` pixels in from every side, a marker pinned there
//     (`waypoint.marker`), a triangle `marker.size` across and tall pointing down at it, and the metres
//     from the car the seat holds to the ring under it (`waypoint.distance`), `marker.gap` below its tip;
//   - while it is not, an arrow (`waypoint.arrow`), `marker.arrow` long and wide, `marker.edge` in from
//     the edge of the screen on the line from the middle toward the point, pointing at it; a point
//     behind the camera is pointed at the other way, where turning round would find it.
import type * as PIXI from 'pixi.js'
import type { Row } from '#engine/engine.ts'
import type { Plugins } from '#engine/browser.ts'
import { def } from '#plugins/loader/loader.sim.ts'
import { holding } from '#plugins/player/player.plugin.ts'

let mesh: any
let light: any
let up: any
// The row's `n` as last drawn, undefined until the ring is first placed.
let reached: number | undefined

export function setup(row: Row, plugins: Plugins) {
  const { THREE, scene, dress } = plugins.render3d
  const { ring, light: glow } = def(plugins.wire, row.kind)
  const material = dress(new THREE.MeshStandardMaterial({ color: ring.colour, emissive: ring.colour, emissiveIntensity: ring.glow }))
  mesh = new THREE.Mesh(new THREE.TorusGeometry(ring.radius, ring.tube, ring.sides, ring.segments), material)
  mesh.castShadow = false
  mesh.visible = false
  scene.add(mesh)
  light = new THREE.PointLight(glow.colour, glow.intensity, glow.distance, glow.decay)
  light.castShadow = false
  light.visible = false
  scene.add(light)
  up = new THREE.Vector3(0, 1, 0)
  reached = undefined
}

export function tick(row: Row, plugins: Plugins) {
  const pos = row.data.pos as number[] | null
  if (!pos) return
  const { ring: spun } = def(plugins.wire, row.kind)
  const jumped = row.data.n !== reached
  reached = row.data.n
  mesh.userData.teleport = light.userData.teleport = jumped
  mesh.visible = light.visible = true
  mesh.position.set(pos[0], pos[1], pos[2])
  light.position.set(pos[0], pos[1], pos[2])
  const drawn = (plugins.wire.n - 1 + (plugins.wire.between ?? 1)) * (plugins.wire.scene.prefabs.engine.dt as number)
  mesh.quaternion.setFromAxisAngle(up, row.data.yaw + drawn * spun.spin)

  const { ui, wire } = plugins
  const { Container, Graphics, Text } = ui.PIXI as typeof PIXI
  const { ring, marker } = def(wire, row.kind)
  const at = [pos[0], pos[1] + ring.radius + marker.lift, pos[2]]
  const seen = ui.project(at), { width, height } = ui.area(), e = marker.edge
  const on = !seen.behind && seen.x >= e && seen.x <= width - e && seen.y >= e && seen.y <= height - e

  if (on) {
    const shown = ui.show('waypoint', `${row.id}.marker`, () => {
      const c = new Container()
      const [w, h] = marker.size
      c.addChild(new Graphics().poly([-w / 2, -h, w / 2, -h, 0, 0]).fill(ui.style('waypoint.marker')))
      const t = new Text({ text: '', style: ui.style('waypoint.distance') })
      t.label = 'distance'
      t.anchor.set(0.5, 0)
      t.position.set(0, marker.gap)
      c.addChild(t)
      return c
    })
    ui.pin(shown, at)
    const car = holding(wire.rows)
    const chassis = car && wire.rows.find(r => r.id === car.data.chassis)
    const label = shown.getChildByLabel('distance') as PIXI.Text
    label.visible = !!chassis
    if (chassis) {
      const [cx, cy, cz] = chassis.data.pos as number[]
      label.text = `${Math.round(Math.hypot(pos[0] - cx, pos[1] - cy, pos[2] - cz))} m`
    }
    return
  }

  // Off the screen: an arrow on the inset edge, on the line from the middle toward the point.
  const mx = width / 2, my = height / 2
  let dx = seen.x - mx, dy = seen.y - my
  if (seen.behind) { dx = -dx; dy = -dy }
  const s = Math.min((mx - e) / Math.max(Math.abs(dx), 1e-6), (my - e) / Math.max(Math.abs(dy), 1e-6))
  const arrow = ui.show('waypoint', `${row.id}.arrow`, () => {
    const [length, across] = marker.arrow
    return new Graphics().poly([length / 2, 0, -length / 2, -across / 2, -length / 2, across / 2]).fill(ui.style('waypoint.arrow'))
  })
  arrow.position.copyFrom(ui.panel('waypoint').toLocal({ x: mx + dx * s, y: my + dy * s }))
  arrow.rotation = Math.atan2(dy, dx)
}

export function remove(plugins: Plugins) {
  plugins.render3d.scene.remove(mesh, light)
  light.dispose()
  mesh.geometry.dispose()
  mesh.material.dispose()
}

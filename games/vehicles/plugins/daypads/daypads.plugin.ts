// The browser half of daypads (`daypads.sim.ts` says what a pad is). For each pad of the `daypads` row it draws
//   the column   a see-through, glowing cylinder open at both ends, `radius` across and `height` tall in the pad's
//                `colour`, standing on the land at the row's `foot`, drawn in render3d, casting no shadow;
//   the clock    a copy of item3d's one clock, `clock.item`, pro-ng's `icons/time/clock_face` baked at twelve o'clock,
//                `clock.lift` metres over the land in the column's middle, turned about up to face the camera
//                (`plugins.render3d.camera`) each frame. Its two hand bones, `clock.hands.hour` and `.minute`, are
//                turned clockwise seen from the front about `clock.hands.axis`, in the bone's own space, to the pad's
//                hour: the hour hand `hour % 12` twelfths of a turn, the minute hand the hour's fraction of a turn.
//                A clock is added once its item is made (`ready`); until then the column stands without it.
// Every number is the `daypads` definition's in `assets/vehicles.json`; the pads are the row's.
//
// It is listed after item3d and before render3d, and item3d after supershader3d, the order item3d asks. What it
// makes is let go in `close`.
import type * as THREE from 'three'
import type { Plugins } from '#engine/browser.ts'
import type { Row } from '#engine/engine.ts'
import { def } from '#plugins/loader/loader.sim.ts'
import type { Pad } from './daypads.sim.ts'

type Drawn = { column: THREE.Mesh; clock?: THREE.Object3D }

// The angles in degrees the clock's hour hand and minute hand stand at, clockwise from twelve, to show `hour`.
export const handsAt = (hour: number) => ({ hour: (hour % 12) * 30, minute: (hour % 1) * 360 })

export function daypads() {
  let drawn: Drawn[] = []

  const me = {
    tick(plugins: Plugins) {
      const row = plugins.wire.rows.find((r: Row) => r.kind === 'daypads')
      if (!row || !row.data.foot) return
      const { THREE, scene, dress, camera } = plugins.render3d
      const k = def(plugins.wire, row.kind)
      const pads = row.data.pads as Pad[], foot = row.data.foot as number[]
      if (!drawn.length) {
        drawn = pads.map((pad, i) => {
          const material = dress(new THREE.MeshStandardMaterial({
            color: pad.colour, emissive: pad.colour, emissiveIntensity: k.glow, transparent: true, opacity: k.opacity, depthWrite: false,
          }))
          const geometry = new THREE.CylinderGeometry(k.radius, k.radius, k.height, k.sides, 1, true)
          geometry.translate(0, k.height / 2, 0)
          const column = new THREE.Mesh(geometry, material)
          column.castShadow = false
          column.receiveShadow = false
          column.position.set(pad.x, foot[i], pad.z)
          scene.add(column)
          return { column }
        })
      }
      pads.forEach((pad, i) => {
        const d = drawn[i]
        if (!d.clock && plugins.item3d.ready(k.clock.item)) {
          const clock = plugins.item3d.mesh(k.clock.item) as THREE.Object3D
          const axis = new THREE.Vector3(...k.clock.hands.axis as [number, number, number])
          const turn = (bone: string, degrees: number) => {
            const b = clock.getObjectByName(bone)
            if (!b) throw new Error(`the clock item ${k.clock.item} has no bone ${bone}`)
            b.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(axis, (degrees * Math.PI) / 180))
          }
          const at = handsAt(pad.hour)
          turn(k.clock.hands.hour, at.hour)
          turn(k.clock.hands.minute, at.minute)
          clock.position.set(pad.x, foot[i] + k.clock.lift, pad.z)
          scene.add(clock)
          d.clock = clock
        }
        // the dial faces -z as the item stands at its zero: turned about up so that it faces the camera
        if (d.clock) d.clock.rotation.y = Math.atan2(-(camera.position.x - pad.x), -(camera.position.z - pad.z))
      })
    },
    close(plugins: Plugins) {
      const scene = plugins.render3d?.scene
      for (const d of drawn) {
        scene?.remove(d.column)
        d.column.geometry.dispose()
        ;(d.column.material as THREE.Material).dispose()
        if (d.clock) scene?.remove(d.clock)
      }
      drawn = []
    },
  }
  return me
}

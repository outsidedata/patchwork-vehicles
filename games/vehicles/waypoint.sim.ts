// The waypoint: one ring standing up out of the land, to drive to. No timer and no score; it is there
// to be reached, and then it is somewhere else.
//
// Its row, the `waypoint` prefab:
//   pos   [x, y, z], the middle of the ring, or null before it is first placed.
//   yaw   radians the ring is turned about up.
//   n     how many times it has been reached.
//
// Its definition, `waypoint` in `assets/vehicles.json`:
//   reach   metres from the ring's middle a car's chassis comes within to reach it: its sphere of
//           influence.
//   min     the fewest metres from the car that reached it the next ring stands; `max` the most.
//   ring    `{ radius, tube, sink, ... }`: the ring's middle stands `radius - sink` over the land.
//   effect  the particle3d effect thrown from the ring's middle when it is reached.
//
// `before`: while it has no place, it is placed from the first car made. `after`, once the cars have
// moved: a car a seat holds whose chassis is within `reach` of the middle sets the effect off there,
// and the ring goes to a new place, a roll of `w.die()` round that car, between `min` and `max` metres
// off, at the land's height there (terrain3d), turned a rolled yaw.
import type { Kind, Row, W } from '#engine/engine.ts'
import * as math from '#plugins/math/math.sim.ts'
import { def } from '#plugins/loader/loader.sim.ts'
import { emit } from '#plugins/particle3d/particle3d.sim.ts'
import { heightAt } from '#plugins/terrain3d/terrain3d.sim.ts'
import { holderOf } from '#plugins/player/player.sim.ts'

// The ring put somewhere new round [x, z].
function place(me: Row, w: W, x: number, z: number) {
  const k = def(w, me.kind)
  const turn = w.die() * 2 * Math.PI, far = k.min + w.die() * (k.max - k.min)
  const px = x + math.cos(turn) * far, pz = z + math.sin(turn) * far
  me.data.pos = [px, heightAt(w, px, pz) + k.ring.radius - k.ring.sink, pz]
  me.data.yaw = w.die() * 2 * Math.PI
}

const chassisOf = (w: W, car: Row) => w.get(car.data.chassis).data

export const waypoint: Kind = {
  before(me, _dt, w) {
    if (me.data.pos) return
    const car = w.all('box3dvehicle').find(c => c.data.chassis !== undefined)
    if (!car) return
    const [x, , z] = chassisOf(w, car).pos
    place(me, w, x, z)
  },
  after(me, _dt, w) {
    if (!me.data.pos) return
    const k = def(w, me.kind), [x, y, z] = me.data.pos as number[]
    for (const car of w.all('box3dvehicle')) {
      if (car.data.chassis === undefined || !holderOf(w, car)) continue
      const [cx, cy, cz] = chassisOf(w, car).pos
      if (math.hypot(cx - x, cy - y, cz - z) > k.reach) continue
      emit(w, k.effect, [x, y, z])
      me.data.n += 1
      place(me, w, cx, cz)
      return
    }
  },
}

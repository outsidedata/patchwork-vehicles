// Where a car is made: a `spot` actor, `name`d, at `x`, `z` on the land, turned `yaw` about up
// (positive turns left, from the car's forward +x), the car the fleet's vehicle named `vehicle`
// (`world.box3dvehicle.vehicles`). A spot makes nothing on its own: a scene opens with no car, and a
// seat's `player` row makes the car of a spot when it gets into it (`make`), standing on the land
// there (terrain3d's heightAt plus the vehicle's `standing` height) and dropped from the car's
// `spawnLift` above that. The spot keeps its id in `made`.
//
// A car no `player` row holds (`holderOf`, `plugins/player`), its seat having moved to another car
// or left, is scrapped by its spot the step after, its chassis, wheels and joints with it
// (box3dvehicle's `scrap`), and `made` is 0 again. So the scene holds no more cars than seats.
import type { Kind, Row, W } from '#engine/engine.ts'
import { def } from '#plugins/loader/loader.sim.ts'
import { heightAt } from '#plugins/terrain3d/terrain3d.sim.ts'
import { scrap, standing, vehicle, type Fleet } from '#plugins/box3dvehicle/box3dvehicle.sim.ts'
import { holderOf } from '#plugins/player/player.sim.ts'
import * as math from '#plugins/math/math.sim.ts'

// The car spot `me` made, while it stands.
export const carOf = (w: W, me: Row): Row | undefined => (me.data.made ? w.all('box3dvehicle').find(c => c.id === me.data.made) : undefined)

// Spot `me`'s car, made now at the spot if it has none.
export function make(w: W, me: Row): Row {
  const had = carOf(w, me)
  if (had) return had
  const { vehicle: name, x, z, yaw } = me.data
  const fleet: Fleet = w.world.box3dvehicle
  const y = heightAt(w, x, z) + standing(fleet.vehicles[name]) + def(w, 'car').spawnLift
  const car = vehicle(w, name, [x, y, z], [0, math.sin(yaw / 2), 0, math.cos(yaw / 2)])
  me.data.made = car.id
  return car
}

export const spot: Kind = {
  before(me, _dt, w) {
    const car = carOf(w, me)
    if (!car) { me.data.made = 0; return }
    if (holderOf(w, car)) return
    scrap(w, car)
    me.data.made = 0
  },
}

// Where a car stands when the scene starts: a `spot` actor, `name`d, at `x`, `z` on the land, turned
// `yaw` about up (positive turns left, from the car's forward +x), the car the fleet's vehicle named
// `vehicle` (`world.box3dvehicle.vehicles`). On its first step it makes the car whole, standing on the
// land there (terrain3d's heightAt plus the vehicle's `standing` height) and dropped from the car's
// `spawnLift` above that, and keeps its id in `made`.
//
// It keeps the car parked while nobody drives it. Each step a car that no `player` row holds
// (`holderOf`, `plugins/player`), a seat having moved to another car or left, has its pedal and
// steering let go and its brake held; a seat that holds it drives it through its own acts.
import type { Kind, Row, W } from '#engine/engine.ts'
import { def } from '#plugins/loader/loader.sim.ts'
import { heightAt } from '#plugins/terrain3d/terrain3d.sim.ts'
import { standing, vehicle, type Fleet } from '#plugins/box3dvehicle/box3dvehicle.sim.ts'
import { holderOf } from '#plugins/player/player.sim.ts'
import * as math from '#plugins/math/math.sim.ts'

// The car of the spot `me` made, once it has made it.
export const carOf = (w: W, me: Row): Row | undefined => (me.data.made ? w.all('box3dvehicle').find(c => c.id === me.data.made) : undefined)

export const spot: Kind = {
  before(me, _dt, w) {
    if (!me.data.made) {
      const { vehicle: name, x, z, yaw } = me.data
      const fleet: Fleet = w.world.box3dvehicle
      const y = heightAt(w, x, z) + standing(fleet.vehicles[name]) + def(w, 'car').spawnLift
      me.data.made = vehicle(w, name, [x, y, z], [0, math.sin(yaw / 2), 0, math.cos(yaw / 2)]).id
      return
    }
    const car = carOf(w, me)
    if (!car || holderOf(w, car)) return
    car.data.pedal = null
    car.data.throttle = 0
    car.data.steer = 0
    car.data.brake = 1
  },
}

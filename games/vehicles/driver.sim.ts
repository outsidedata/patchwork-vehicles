// A driver: the title's autopilot, one `actors` entry per car, which the intro films (a cast kind of
// core's `plugins/cutscene`). On its first step it makes its car whole, the fleet's vehicle named
// `vehicle` (`world.box3dvehicle.vehicles`), standing on the land at `x`, `z` (terrain3d's heightAt plus
// the vehicle's `standing` height, dropped from the car definition's `spawnLift`), turned `turn` about
// up (positive turns left, from the car's forward +x), and keeps its id in `made`.
//
// It drives round its route, `route`, a key of its definition's `routes`: a loop of ground points
// [x, z], heading for `next`, and on to the one after once its car is within `reach` metres of it.
// Each step, while `on`, it steers its car toward that point, the steer the angle to it (positive
// left) times `steer`, kept to −1 to 1, and works its one pedal toward its vehicle's `speeds` m/s along
// the car's forward, eased by `corner` of it for an angle of π to the point, the pedal the shortfall
// times `gain`, kept to −1 to 1 (box3dvehicle's acts `steer` and `pedal`). Until `on`, the car stands
// with its brake held. Its closed act `start` puts it `on`: the title's curtain calls it in the step
// the intro starts (`curtain.sim.ts`), so the cars set out with the cue clock.
//
// As a cast member it carries `name`, and `pos` and `yaw`, its car's chassis's place and heading
// (anim's yaw: θ faces (sin θ, cos θ)), written after box3d moves the car each step, which a shot
// follows and looks at. It drives itself, so the cutscene's `direct` changes nothing it does: a
// `direct` that holds `walk`, `face`, `play` or `gesture` throws, naming it, since the cue file is
// data from outside the program. Its act `advance(dt)` runs its own step, the steering and the pedal
// and its pose read off its car; box3d's step, which moves the car, is box3d's, so a skipped intro
// leaves the cars where they stood and they drive on from there.
import type { Kind, Row, W } from '#engine/engine.ts'
import { def } from '#plugins/loader/loader.sim.ts'
import { heightAt } from '#plugins/terrain3d/terrain3d.sim.ts'
import { standing, vehicle, type Fleet } from '#plugins/box3dvehicle/box3dvehicle.sim.ts'
import * as math from '#plugins/math/math.sim.ts'

type Driver = { reach: number; steer: number; gain: number; corner: number; speeds: Record<string, number>; routes: Record<string, number[][]> }

const VERBS = ['walk', 'face', 'play', 'gesture']

const carOf = (w: W, me: Row): Row | undefined => (me.data.made ? w.all('box3dvehicle').find(c => c.id === me.data.made) : undefined)
const chassisOf = (w: W, car: Row): Row | undefined => w.all('car').find(c => c.id === car.data.chassis)

// The chassis's forward (+x) and left (−z) in the world, from its quaternion [x, y, z, w].
function axes(rot: number[]) {
  const [x, y, z, q] = rot
  const forward = [1 - 2 * (y * y + z * z), 2 * (x * y + q * z), 2 * (x * z - q * y)]
  const left = [-2 * (x * z + q * y), -2 * (y * z - q * x), -(1 - 2 * (x * x + y * y))]
  return { forward, left }
}

// Its pose read off its car's chassis.
function pose(me: Row, w: W) {
  const car = carOf(w, me)
  const chassis = car && chassisOf(w, car)
  if (!chassis) return
  const { forward } = axes(chassis.data.rot)
  me.data.pos = [...chassis.data.pos]
  me.data.yaw = math.atan2(forward[0], forward[2])
}

function obeys(me: Row) {
  const direct = me.data.direct
  if (!direct) return
  for (const verb of VERBS) if (verb in direct) throw new Error(`the driver ${me.data.name} drives itself, and takes no ${verb}`)
}

// One step of its driving: the car made, then held or steered round the route.
function drive(me: Row, w: W) {
  const d = me.data
  if (!d.made) {
    const fleet: Fleet = w.world.box3dvehicle
    const y = heightAt(w, d.x, d.z) + standing(fleet.vehicles[d.vehicle]) + def(w, 'car').spawnLift
    d.made = vehicle(w, d.vehicle, [d.x, y, d.z], [0, math.sin(d.turn / 2), 0, math.cos(d.turn / 2)]).id
    return
  }
  const car = carOf(w, me)
  const chassis = car && chassisOf(w, car)
  if (!car || !chassis) return
  if (!d.on) {
    w.call(car, 'pedal', -1, 0)
    w.call(car, 'steer', -1, 0)
    w.call(car, 'brake', -1, 1)
    return
  }
  const k = def(w, me.kind) as Driver
  const route = k.routes[d.route]
  const [px, , pz] = chassis.data.pos as number[]
  let to = route[d.next]
  if (math.hypot(to[0] - px, to[1] - pz) <= k.reach) {
    d.next = (d.next + 1) % route.length
    to = route[d.next]
  }
  const { forward, left } = axes(chassis.data.rot)
  const dx = to[0] - px, dz = to[1] - pz
  const angle = math.atan2(dx * left[0] + dz * left[2], dx * forward[0] + dz * forward[2])
  const [vx, , vz] = chassis.data.vel as number[]
  const along = vx * forward[0] + vz * forward[2]
  const want = k.speeds[d.vehicle] * (1 - k.corner * Math.min(1, Math.abs(angle) / Math.PI))
  w.call(car, 'brake', -1, 0)
  w.call(car, 'steer', -1, Math.max(-1, Math.min(1, angle * k.steer)))
  w.call(car, 'pedal', -1, Math.max(-1, Math.min(1, (want - along) * k.gain)))
}

export const driver: Kind = {
  before(me, _dt, w) {
    drive(me, w)
  },
  tick(me) {
    obeys(me)
  },
  after(me, _dt, w) {
    pose(me, w)
  },
  acts: {
    start(me) {
      me.data.on = true
    },
    advance(me, w) {
      drive(me, w)
      obeys(me)
      pose(me, w)
    },
  },
}

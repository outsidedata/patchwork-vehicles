// The row one seat possesses: the driver, with no body. `addons/player` spawns it and writes the slot it
// gave the connection into `seat`, and every seat is sent it, the seat's own marked `mine`. The cars are
// not it: each is a `box3dvehicle` row made at a `spot` actor (`spot.sim.ts`) when a seat gets into
// it, and the driver holds one (`take` in `plugins/player`) for as long as its seat is in the scene; a
// car it lets go of is scrapped by its spot, so the scene holds one car a seat. It has no place
// of its own: the camera, the HUD and every other reader go through the car it holds (`holding`). A page
// running the scene ahead (`addons/predict`) runs every rule on its copy, so the car it holds answers
// the keys on the next frame.
//
// Its row, the scene's `player` prefab, carries beside `seat` and `held`:
//   controls  `{ pedal, steer, brake }`, the last of each the seat sent, kept to its range: a page sends
//             a key or a trigger only when it changes, so one held down while the seat waits for a car,
//             or while it moves to another car, is handed to the car the step it takes hold of it.
//
// `before`: each step it holds no car, it gets into the spot its slot's `start` names, while no seat
// holds that spot's car; failing that, the first spot whose car no seat holds, in the order the scene
// lists the spots. Getting into a spot makes its car there (`make`), and the car is handed its
// `controls`.
//
// Its acts are the page's keys and gamepad (`player.client.ts`); each value arrives from outside the
// program, so one that is not a finite number does nothing, and one past its range is kept to it:
//   pedal, steer, brake   kept in `controls`, and passed on to the car it holds, which works the one
//             pedal (box3dvehicle's acts, `relay`); holding none, only kept.
//   lights()  the car it holds has its headlights switched, on if off, off if on (box3dvehicle's
//             `lights` act); holding none, nothing.
//   next()    it lets go of its car, which its spot scraps the step after, and gets into the next
//             spot, in the order the scene lists the spots and round to the first, whose car no seat
//             holds, so two seats never hold one car: that spot's car is made at the spot and handed
//             its `controls`. With no other spot free, nothing.
//   upright() the car it holds is put back on its wheels: its chassis and every wheel lifted LIFT
//             metres, turned flat about the chassis on the heading its nose points along, and stilled,
//             so it drops onto its wheels (box3d moves a body whose row a rule writes). Holding none,
//             nothing.
import type { Act, Kind, Row, W } from '#engine/engine.ts'
import { holderOf, holding, letGo, relay, take } from '#plugins/player/player.sim.ts'
import { turn } from '#plugins/box3dvehicle/box3dvehicle.sim.ts'
import { carOf, make } from './spot.sim.ts'

type Vec3 = [number, number, number]
type Quat = [number, number, number, number]

// How far `upright` lifts the car before dropping it, metres.
export const LIFT = 4 / 3

const mul = (a: Quat, b: Quat): Quat => [
  a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
  a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
  a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
  a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
]
const inverse = (q: Quat): Quat => [-q[0], -q[1], -q[2], q[3]]

// The turn about y alone that points the car's nose (+x) the way `rot` points it across the ground. A
// car stood on its nose or tail points nowhere across it, so its roof's heading is taken instead.
function flat(rot: Quat): Quat {
  const [fx, , fz] = turn(rot, [1, 0, 0])
  const [ux, , uz] = turn(rot, [0, 1, 0])
  const [x, z] = Math.hypot(fx, fz) > 1e-3 ? [fx, fz] : [ux, uz]
  const yaw = Math.atan2(-z, x)
  return [0, Math.sin(yaw / 2), 0, Math.cos(yaw / 2)]
}

// `car`'s chassis and wheels moved as one: lifted LIFT, turned flat about the chassis, and stilled.
function upright(w: W, car: Row) {
  const chassis = w.get(car.data.chassis).data
  const at = chassis.pos as Vec3, by = mul(flat(chassis.rot), inverse(chassis.rot))
  const to: Vec3 = [at[0], at[1] + LIFT, at[2]]
  for (const id of [car.data.chassis, ...car.data.wheels] as number[]) {
    const d = w.get(id).data, off = turn(by, [d.pos[0] - at[0], d.pos[1] - at[1], d.pos[2] - at[2]])
    d.pos = [to[0] + off[0], to[1] + off[1], to[2] + off[2]]
    d.rot = mul(by, d.rot)
    d.vel = [0, 0, 0]
    d.spin = [0, 0, 0]
  }
}

const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

// A spot a seat may get into: its car not made, or made and held by no seat.
const free = (w: W, spot: Row): boolean => {
  const car = carOf(w, spot)
  return !car || !holderOf(w, car)
}

// The spot its slot's start names.
const ownSpot = (w: W, me: Row): Row => {
  const name = w.find('start', s => s.data.slot === me.data.seat).data.spot
  return w.find('spot', s => s.data.name === name)
}

const relayed = relay({ box3dvehicle: ['pedal', 'steer', 'brake'] })

// Each control of the car, and the range it is kept to.
const RANGE = { pedal: [-1, 1], steer: [-1, 1], brake: [0, 1] } as const
type Control = keyof typeof RANGE

// A control of the car: kept in `controls`, and relayed to the car it holds.
const control = (name: Control): Act => (me, w, seat, v: unknown) => {
  if (!finite(v)) return
  const [lo, hi] = RANGE[name]
  me.data.controls = { ...me.data.controls, [name]: Math.max(lo, Math.min(hi, v)) }
  if (holding(w, me)) return relayed[name](me, w, seat, v)
}

// `car` taken hold of and handed the controls the seat last sent.
function into(me: Row, w: W, car: Row) {
  take(me, w, car)
  for (const c of Object.keys(RANGE) as Control[]) w.call(car, c, -1, me.data.controls[c])
}

export const player: Kind = {
  before(me, _dt, w) {
    if (holding(w, me)) return
    const own = ownSpot(w, me)
    const spot = free(w, own) ? own : w.all('spot').find(s => free(w, s))
    if (spot) into(me, w, make(w, spot))
  },
  acts: {
    pedal: control('pedal'),
    steer: control('steer'),
    brake: control('brake'),
    lights(me, w) {
      const car = holding(w, me)
      if (car) w.call(car, 'lights', -1, car.data.lights !== true)
    },
    upright(me, w) {
      const car = holding(w, me)
      if (car) upright(w, car)
    },
    next(me, w) {
      const spots = w.all('spot'), now = holding(w, me)
      const from = now ? spots.findIndex(s => carOf(w, s) === now) : -1
      for (let k = 1; k <= spots.length; k++) {
        const spot = spots[(from + k) % spots.length]
        if (!free(w, spot)) continue
        letGo(me)
        into(me, w, make(w, spot))
        return
      }
    },
  },
}

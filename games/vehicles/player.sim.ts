// The row one seat possesses: the driver, with no body. `addons/player` spawns it and writes the slot it
// gave the connection into `seat`, and every seat is sent it, the seat's own marked `mine`. The cars are
// not it: each is a `box3dvehicle` row a `spot` actor made (`spot.sim.ts`), parked side by side, and the
// driver holds one (`take` in `plugins/player`) for as long as its seat is in the scene. It has no place
// of its own: the camera, the HUD and every other reader go through the car it holds (`holding`). A page
// running the scene ahead (`addons/predict`) runs every rule on its copy, so the car it holds answers
// the keys on the next frame.
//
// Its row, the scene's `player` prefab, carries beside `seat` and `held`:
//   controls  `{ pedal, steer, brake }`, the last of each the seat sent, kept to its range: a page sends
//             a key or a trigger only when it changes, so one held down while the seat waits for a car,
//             or while it moves to another car, is handed to the car the step it takes hold of it.
//
// `before`: each step it holds no car, it takes hold of the car of the spot its slot's `start` names,
// once that spot has made it and while no seat holds it; failing that, the first car no seat holds, in
// the order the scene lists the spots. The car taken is handed its `controls`.
//
// Its acts are the page's keys and gamepad (`player.client.ts`); each value arrives from outside the
// program, so one that is not a finite number does nothing, and one past its range is kept to it:
//   pedal, steer, brake   kept in `controls`, and passed on to the car it holds, which works the one
//             pedal (box3dvehicle's acts, `relay`); holding none, only kept.
//   lights()  the car it holds has its headlights switched, on if off, off if on (box3dvehicle's
//             `lights` act); holding none, nothing.
//   next()    it lets go of its car, which its spot parks from the next step at whatever speed it goes,
//             and takes the next one, in the order the scene lists the spots and round to the first,
//             that no seat holds, so two seats never hold one car, handing it its `controls`. With no
//             other car free, nothing.
import type { Act, Kind, Row, W } from '#engine/engine.ts'
import { holderOf, holding, letGo, relay, take } from '#plugins/player/player.sim.ts'
import { carOf } from './spot.sim.ts'

const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

// Every spot's car, in the order the scene lists the spots, once each is made.
const cars = (w: W): Row[] => w.all('spot').flatMap(s => carOf(w, s) ?? [])

// The car of the spot its slot's start names, once made.
function ownCar(w: W, me: Row): Row | undefined {
  const name = w.find('start', s => s.data.slot === me.data.seat).data.spot
  return carOf(w, w.find('spot', s => s.data.name === name))
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
    const own = ownCar(w, me)
    const car = own && !holderOf(w, own) ? own : cars(w).find(c => !holderOf(w, c))
    if (car) into(me, w, car)
  },
  acts: {
    pedal: control('pedal'),
    steer: control('steer'),
    brake: control('brake'),
    lights(me, w) {
      const car = holding(w, me)
      if (car) w.call(car, 'lights', -1, car.data.lights !== true)
    },
    next(me, w) {
      const all = cars(w), now = holding(w, me)
      const from = now ? all.indexOf(now) : -1
      for (let k = 1; k <= all.length; k++) {
        const car = all[(from + k) % all.length]
        if (car === now || holderOf(w, car)) continue
        letGo(me)
        into(me, w, car)
        return
      }
    },
  },
}

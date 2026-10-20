// The row one seat possesses: the driver, a person. `addons/player` spawns it and writes the slot it
// gave the connection into `seat`, and every seat is sent it, the seat's own marked `mine`. The cars are
// not it: each is a `box3dvehicle` row a `spot` actor made (`spot.sim.ts`), parked side by side, and the
// driver holds one (`take` in `plugins/player`) from the step it starts getting in until the step it
// starts getting out. A page running the scene ahead (`addons/predict`) runs every rule on its copy, so
// the person and the car it holds answer the keys on the next frame.
//
// The person is the mechworker (`world.anim.kinds.player`, the contractor's rig and model), a walker
// body (`world.walker.kinds.player`), and gets in and out of a car through the car's interactions
// (`plugins/interact`, `world.interact.kinds.box3dvehicle`): the car's points are its look's
// (box3dvehicle's `look.points`: `seat`, the wheel's grips, the pedals). Its row, the scene's `player`
// prefab, carries beside `seat` and `held` walker's body (`pos`, `yaw`, `vel`, `grounded`, `sliding`,
// `speed`, `want`, `face`, `jump`, `side`, `turned`), anim's fields and `rig`, and its own:
//   stood     whether it has been stood beside its car.
//   stick     how it is steered on foot, [x, z], each −1 to 1: x turns it (left positive) that
//             fraction of `turn`, z walks it (forward positive) that fraction of its pace.
//   run       whether the run key is held.
//   heading   the way it walks, radians (anim's yaw: θ faces (sin θ, cos θ)), turned by the stick's x.
//   board     where it is: '' on foot, 'approach' walking up to a car's door, else the name of the
//             step of the car's interaction it is in (`in`, `seated`, `out`).
//   toward    the id of the car it is approaching, null otherwise.
//   interact  the interaction it is in, null on foot (`plugins/interact`).
//   controls  `{ pedal, steer, brake }`, the last of each the seat sent, kept to its range, seated or
//             not: a page sends a key or a trigger only when it changes, so one held down while the
//             person gets in, or while it moves to another car, is handed to the car the step it is
//             seated.
// Every number is the player definition's in `assets/vehicles.json`: `foot` `{ creep, run, turn }`, its
// paces on foot (m/s) and how fast the stick turns it (rad/s); and `board`: `reach`, the flat metres
// from where a car's `enter` begins within which `use` sets off to get in; `stand` [ahead, left], the
// metres from there, in its facing, it is first stood, facing as `enter` begins; `stop` and `facing`, the metres and radians from that place and its
// facing at which it starts getting in; `enter`, `sit` and `exit`, the names of the interactions it
// gets in by, is put straight into the seat by, and gets out by.
//
// `before`: once, the first step its slot's `start`'s spot has made its car, it is stood at `stand`
// from the place that car's `enter` begins, facing as that does, on the ground.
// `tick`, on foot: it turns by the stick's x times `turn`, walks (walker's `walk`) ahead or back at
// the stick's z times `run` while run is held, else times `creep`, and is animated, its clip's travel
// carried.
// Approaching: it walks to where the car's `enter` begins (walker's `seek`) and turns to face as it
// does; there, within `stop` and `facing`, it takes hold of the car and begins `enter` (interact's
// `begin`), unless another seat holds it by then, when it is back on foot.
// `after`, in an interaction: interact's `advance` every step, after the car has moved, then anim's
// `animate` for the clip's playhead; the interaction placing the body, its travel is not carried. The
// step it reaches `seated` its car is handed its `controls`. An interaction that ends (`exit`'s last
// step played, or the car gone) leaves it on foot where it ends.
//
// Its acts are the page's keys and gamepad (`player.client.ts`); each value arrives from outside the
// program, so one that is not a finite number does nothing, and one past its range is kept to it:
//   pedal, steer, brake   kept in `controls`, and seated, passed on to the car it holds, which works
//             the one pedal (box3dvehicle's acts, `relay`); otherwise nothing more, but `steer(v)` on
//             foot, which is the stick's x, −1 to 1.
//   walk(v)   on foot, the stick's z, −1 to 1; otherwise nothing.
//   run(v)    on foot, 1 or 0 for the run key.
//   use()     on foot: it sets off for the nearest car, by where each car's `enter` begins, within
//             `reach` of it, that no seat holds. Seated: it leaves `enter` (interact's `end`), lets go
//             of the car, which its spot parks from the next step at whatever speed it goes, and begins
//             `exit`. Otherwise nothing.
//   next()    it leaves whatever interaction it is in, lets go of its car and takes the next one, in
//             the order the scene lists the spots and round to the first, that no seat holds, so two
//             seats never hold one car, and is put in its seat (`sit`), its `controls` handed to the
//             car taken.
import type { Act, Kind, Row, W } from '#engine/engine.ts'
import { def } from '#plugins/loader/loader.sim.ts'
import { holderOf, holding, letGo, relay, take } from '#plugins/player/player.sim.ts'
import { carry, groundOf, relative, seek, stand, walk, numbers } from '#plugins/walker/walker.sim.ts'
import { animate } from '#plugins/anim/anim.sim.ts'
import { advance, begin, end, startOf, stepOf } from '#plugins/interact/interact.sim.ts'
import * as math from '#plugins/math/math.sim.ts'
import { carOf } from './spot.sim.ts'

type Foot = { creep: number; run: number; turn: number }
type Board = { reach: number; stand: number[]; stop: number; facing: number; enter: string; sit: string; exit: string }

const wrap = (a: number) => a - 2 * Math.PI * Math.ceil((a - Math.PI) / (2 * Math.PI))
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

const footOf = (w: W, me: Row) => def(w, me.kind).foot as Foot
const boardOf = (w: W, me: Row) => def(w, me.kind).board as Board

// Every spot's car, in the order the scene lists the spots, once each is made.
const cars = (w: W): Row[] => w.all('spot').flatMap(s => carOf(w, s) ?? [])

// The car of the spot its slot's start names, once made.
function ownCar(w: W, me: Row): Row | undefined {
  const name = w.find('start', s => s.data.slot === me.data.seat).data.spot
  return carOf(w, w.find('spot', s => s.data.name === name))
}

// The body held still where it is put, standing on the ground as anim reads it.
function put(me: Row, pos: number[], yaw: number) {
  Object.assign(me.data, { pos, yaw: wrap(yaw), vel: [0, 0, 0], want: [0, 0], face: null, grounded: true, sliding: false, speed: 0 })
}

// The car the body walks up to, by `toward`.
const approached = (w: W, me: Row): Row | undefined => cars(w).find(c => c.id === me.data.toward)

const seated = (me: Row) => me.data.board === 'seated'

const relayed = relay({ box3dvehicle: ['pedal', 'steer', 'brake'] })

// On foot, the stick's axis `axis` set to `v`, kept to −1 to 1.
function steady(me: Row, axis: 0 | 1, v: unknown) {
  if (me.data.board !== '' || !finite(v)) return
  const stick = [...(me.data.stick as number[])]
  stick[axis] = Math.max(-1, Math.min(1, v))
  me.data.stick = stick
}

// Each control of the car, and the range it is kept to.
const RANGE = { pedal: [-1, 1], steer: [-1, 1], brake: [0, 1] } as const
type Control = keyof typeof RANGE

// A control of the car: kept in `controls`; seated, relayed to the car; on foot, the stick's axis it
// sets, if any.
const control = (name: Control, axis?: 0 | 1): Act => (me, w, seat, v: unknown) => {
  if (!finite(v)) return
  const [lo, hi] = RANGE[name]
  me.data.controls = { ...me.data.controls, [name]: Math.max(lo, Math.min(hi, v)) }
  if (seated(me)) return relayed[name](me, w, seat, v)
  if (axis !== undefined) steady(me, axis, v)
}

// The car it is seated in handed the controls it last sent.
function hand(me: Row, w: W, car: Row) {
  for (const c of Object.keys(RANGE) as Control[]) w.call(car, c, -1, me.data.controls[c])
}

// Into the interaction `name` of `car`, holding it, its controls at rest (its spot parked it with the
// brake on): the board field its first step's name, and seated at once, handed its controls.
function into(me: Row, w: W, car: Row, name: string) {
  take(me, w, car)
  for (const c of Object.keys(RANGE)) w.call(car, c, -1, 0)
  begin(me, w, car, name)
  Object.assign(me.data, { board: stepOf(me, w)!, stick: [0, 0], run: false, toward: null })
  if (seated(me)) hand(me, w, car)
}

export const player: Kind = {
  before(me, _dt, w) {
    if (me.data.stood) return
    const car = ownCar(w, me)
    if (!car) return
    const k = boardOf(w, me)
    const s = startOf(w, me, car, k.enter)
    // Ahead of a facing θ is (sin θ, cos θ), left of it (cos θ, −sin θ).
    const [ahead, left] = k.stand
    const x = s.at[0] + ahead * math.sin(s.yaw) + left * math.cos(s.yaw)
    const z = s.at[2] + ahead * math.cos(s.yaw) - left * math.sin(s.yaw)
    put(me, [x, stand(numbers(me, w), groundOf(w), x, z), z], s.yaw)
    Object.assign(me.data, { heading: wrap(s.yaw), stood: true })
  },
  tick(me, dt, w) {
    const d = me.data
    if (!d.stood || (d.board !== '' && d.board !== 'approach')) return
    const g = groundOf(w)
    if (d.board === 'approach') {
      const car = approached(w, me)
      if (!car || holderOf(w, car)) return void Object.assign(d, { board: '', toward: null })
      const k = boardOf(w, me)
      const s = startOf(w, me, car, k.enter)
      const there = seek(me, w, [s.at[0], s.at[2]], k.stop, g)
      d.face = there ? s.yaw : null
      if (there && Math.abs(wrap(d.yaw - s.yaw)) <= k.facing) return void into(me, w, car, k.enter)
    } else {
      const f = footOf(w, me)
      const [x, z] = d.stick as number[]
      d.heading = wrap(d.heading + x * f.turn * dt)
      const [wx, wz] = relative([0, z], d.heading)
      const pace = d.run ? f.run : f.creep
      Object.assign(d, { want: [wx * pace, wz * pace], face: d.heading })
    }
    walk(me, w, dt, g)
    d.jump = false
    const { travel } = animate(me, w, dt)
    if (travel.move[0] || travel.move[1]) carry(me, w, travel.move, g)
    if (travel.yaw) d.yaw = wrap(d.yaw + travel.yaw)
  },
  after(me, dt, w) {
    const d = me.data
    if (!d.stood || d.board === '' || d.board === 'approach') return
    const r = advance(me, w, dt)
    if (!r || r.done) {
      d.board = ''
      d.heading = wrap(d.yaw)
      if (holding(w, me)) letGo(me)
      return
    }
    const was = d.board
    d.board = r.name
    if (seated(me) && was !== 'seated') hand(me, w, holding(w, me)!)
    animate(me, w, dt)
  },
  acts: {
    pedal: control('pedal'),
    steer: control('steer', 0),
    brake: control('brake'),
    walk(me, _w, _seat, v: unknown) { steady(me, 1, v) },
    run(me, _w, _seat, v: unknown) {
      if (me.data.board === '' && (v === 0 || v === 1)) me.data.run = v === 1
    },
    use(me, w) {
      const d = me.data
      if (!d.stood) return
      const k = boardOf(w, me)
      if (d.board === '') {
        const near = cars(w)
          .filter(c => !holderOf(w, c))
          .map(c => ({ c, at: startOf(w, me, c, k.enter).at }))
          .map(({ c, at }) => ({ c, far: math.hypot(at[0] - d.pos[0], at[2] - d.pos[2]) }))
          .filter(({ far }) => far <= k.reach)
          .sort((a, b) => a.far - b.far)[0]
        if (near) Object.assign(d, { board: 'approach', toward: near.c.id, stick: [0, 0], run: false })
        return
      }
      if (!seated(me)) return
      const car = holding(w, me)!
      end(me, w)
      letGo(me)
      begin(me, w, car, k.exit)
      d.board = stepOf(me, w)!
    },
    next(me, w) {
      const d = me.data
      if (!d.stood) return
      const all = cars(w), now = holding(w, me)
      const from = now ? all.indexOf(now) : -1
      for (let k = 1; k <= all.length; k++) {
        const car = all[(from + k) % all.length]
        if (car === now || holderOf(w, car)) continue
        end(me, w)
        letGo(me)
        into(me, w, car, boardOf(w, me).sit)
        return
      }
    },
  },
}

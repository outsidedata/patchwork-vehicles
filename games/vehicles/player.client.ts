// One seat's keys, gamepad and camera, bound to the scene's actions (`world.player.actions` in
// `vehicles.scene.json`, which names every key of each). In a car: the arrows or w a s d up and down, or
// the right and left triggers, the pedal (down brakes, and from a stop reverses: box3dvehicle's one
// pedal, the right trigger less the left); left and right, the d-pad or the left stick, the steering;
// space or the pad's bottom button the brake. On foot the same keys, the d-pad or the left stick walk
// the person ahead and back and turn it, and shift or the pad's right button held runs. e, f or the
// pad's top button gets in the nearest car and out of the one it is in; v or its left button moves
// the seat to the next free car (`player.sim.ts`). The pedal, the steering and the walk are read
// analog (`plugins/player`, Analog), so a trigger or a stick pushed part of the way drives or walks
// that much, and each is sent when it changes. Escape or the pad's start button opens the menu of
// where to drive (the panel the `player` definition's `menu` names, `atlas.client.ts`).
//
// The right stick looks round (`look`), and is the page's alone: nothing of it is sent. Pushed right
// it swings the camera round to look to the right of what it follows, `orbit.yaw` radians at the rim,
// and pushed down or up it raises or lowers the camera round the pivot by up to `orbit.pitch` [down,
// up] radians, each followed on a critically damped spring at `orbit.hz`, so let go of it springs back
// behind.
//
// A jolt of the car the seat holds shakes the gamepad (`rumble`, `plugins/player`): its chassis's
// velocity changed by `rumble.from` m/s or more in one step (a landing, a bump struck at speed, a
// crash), as this page draws it, shakes it for `rumble.seconds`, its motors at `strong` and `weak`
// times the change over `rumble.full`, no more than all the way. It is the page's own feel of its own
// car, read off the rows it draws, and no other seat's.
//
// The camera is this page's alone: nothing of it is on a row. It follows what the seat is: the chassis
// of the car this seat holds (`holding`, `plugins/player`), or, holding none, its person, its own
// `player` row, read off the rows the page draws, so the frame the seat gets in, gets out or moves to
// another car the camera jumps to it. It sits behind it, on three critically damped springs run on the
// steps' clock, so a crash's bounces and tumbles reach the view as a sway rather than a shake. The
// pivot is the chassis's (or the person's) `pos`, followed across the ground at `followHz` and up and
// down at `riseHz`, which is lower, as a car's bounce is up and down; the eye is `back` metres behind
// the pivot along the heading and `high` above it, swung round it as the right stick looks, and looks
// at `aim` above it: the `player`
// definition's `camera` for a car, its `foot.camera` for the person. The heading is the chassis's
// forward (its +x turned by its rot), or the person's facing (`yaw`), laid flat on the ground and
// followed at `turnHz`, as a vector rather than an angle: a car standing on its nose has little forward
// left on the ground, so it turns the camera little, and there is no angle to wrap. Up is world up.
// A spring is critically damped (the smooth-damp of Game Programming Gems 4, 1.10), so it comes to
// rest without passing its target. The springs move only on a frame that took a step, by the steps'
// seconds since the last they moved (at most a tenth of a second, after a hidden tab), so the camera
// is placed once a step, as the car is, and render3d draws both between the last two steps: a camera
// placed on the page's clock on a frame of no step would be drawn where it was set, a step ahead of
// the car drawn behind it, and judder whenever the frames and steps fell unevenly. The camera jumps
// to the car the frame it first follows a chassis, and when the steps go back. While something else holds render3d's camera (`claimed()`: a cutscene,
// the editor's orbit) it is left alone, and the springs jump to the car when it is given back.
//
// `eye()` is `{ pos, dir, target }`: where the camera stands, the way it looks (its world −z), and
// the pivot the springs are following, the chassis's `pos` raised by `aim` as this frame draws it.
import type * as THREE from 'three'
import type { Row } from '#engine/engine.ts'
import type { Plugins } from '#engine/browser.ts'
import { holding, type Controls } from '#plugins/player/player.plugin.ts'
import { def } from '#plugins/loader/loader.sim.ts'

type Camera = { back: number; high: number; aim: number; followHz: number; riseHz: number; turnHz: number }
type Orbit = { yaw: number; pitch: [down: number, up: number]; hz: number }
type Rumble = { from: number; full: number; strong: number; weak: number; seconds: number }
type Spring = { x: number; v: number }

let followed = 0
let last = -1 // the step the camera was last placed on; -1 is none
let springs: Record<'x' | 'y' | 'z' | 'fx' | 'fz' | 'yaw' | 'pitch', Spring> | undefined
let render3d: Plugins['render3d'] | undefined
let target = [0, 0, 0]
let look = [0, 0] // the right stick as last read, x right and y down, each −1 to 1
let felt: { chassis: number; vel: number[]; n: number } | undefined // the held car's chassis velocity on the step the camera was last placed

// One frame of a critically damped spring toward `to` at `hz`.
function spring(s: Spring, to: number, hz: number, dt: number) {
  const w = 2 * Math.PI * hz, k = w * dt
  const e = 1 / (1 + k + 0.48 * k * k + 0.235 * k * k * k)
  const off = s.x - to, t = (s.v + w * off) * dt
  s.v = (s.v - w * t) * e
  s.x = to + (off + t) * e
}

function setupOurs(row: Row, plugins: Plugins) {
  followed = 0
  last = -1
  springs = undefined
  look = [0, 0]
  felt = undefined
  render3d = plugins.render3d
  plugins.player.control({
    axis: { pedal: v => ['pedal', v], steer: v => ['steer', v], walk: v => ['walk', v] },
    hold: { brake: v => ['brake', v], run: v => ['run', v] },
    press: { use: ['use'], next: ['next'], menu: () => plugins.ui.open(def(plugins.wire, row.kind).menu) },
    stick: { look: (x, y) => { look = [x, y]; return undefined } },
    analog: ['pedal', 'steer', 'walk', 'look'],
  } satisfies Controls)
}

// The held car's chassis jolted since the step the camera was last placed: the gamepad shaken.
function jolt(chassis: Row | undefined, n: number, r: Rumble, plugins: Plugins) {
  if (!chassis) return void (felt = undefined)
  const vel = chassis.data.vel as number[]
  if (felt && felt.chassis === chassis.id && n > felt.n) {
    const dv = Math.hypot(vel[0] - felt.vel[0], vel[1] - felt.vel[1], vel[2] - felt.vel[2]) / (n - felt.n)
    const k = Math.min(1, dv / r.full)
    if (dv >= r.from) plugins.player.rumble({ strong: k * r.strong, weak: k * r.weak, seconds: r.seconds })
  }
  felt = { chassis: chassis.id, vel: [...vel], n }
}

function tickOurs(row: Row, plugins: Plugins) {
  const n = plugins.wire.n
  const car = holding(plugins.wire.rows)
  const chassis = car && plugins.wire.rows.find(r => r.id === car.data.chassis)
  const me = plugins.wire.rows.find(r => r.id === row.id)
  const it = chassis ?? me
  if (!it || plugins.render3d.claimed() !== undefined) { last = -1; return }
  // A frame that took no step leaves the camera where the last step placed it, for render3d to draw
  // between the steps with what it follows.
  if (springs && last >= 0 && n === last && it.id === followed) return
  const k = def(plugins.wire, row.kind)
  const c = (chassis ? k.camera : k.foot.camera) as Camera
  const [px, py, pz] = it.data.pos as number[]
  let fx: number, fz: number
  if (chassis) {
    const [x, y, z, s] = chassis.data.rot as number[]
    fx = 1 - 2 * (y * y + z * z)
    fz = 2 * (x * z - s * y)
  } else {
    fx = Math.sin(it.data.yaw)
    fz = Math.cos(it.data.yaw)
  }
  // Where the right stick asks the camera to swing: round to the right for a push right, up for a push
  // down.
  const o = k.orbit as Orbit
  const yaw = -look[0] * o.yaw, pitch = look[1] * (look[1] > 0 ? o.pitch[1] : o.pitch[0])
  const at = { x: px, y: py, z: pz, fx, fz, yaw, pitch }
  if (!springs || last < 0 || n < last || it.id !== followed) {
    followed = it.id
    springs = { x: { x: px, v: 0 }, y: { x: py, v: 0 }, z: { x: pz, v: 0 }, fx: { x: fx, v: 0 }, fz: { x: fz, v: 0 }, yaw: { x: yaw, v: 0 }, pitch: { x: pitch, v: 0 } }
  } else {
    const dt = Math.min(0.1, (n - last) * plugins.wire.scene.prefabs.engine.dt)
    spring(springs.x, at.x, c.followHz, dt)
    spring(springs.z, at.z, c.followHz, dt)
    spring(springs.y, at.y, c.riseHz, dt)
    spring(springs.fx, at.fx, c.turnHz, dt)
    spring(springs.fz, at.fz, c.turnHz, dt)
    spring(springs.yaw, at.yaw, o.hz, dt)
    spring(springs.pitch, at.pitch, o.hz, dt)
  }
  jolt(chassis, n, k.rumble as Rumble, plugins)
  last = n
  const len = Math.hypot(springs.fx.x, springs.fz.x) || 1
  const hx = springs.fx.x / len, hz = springs.fz.x / len
  // The heading turned by the swing, toward its left (hz, −hx) for a swing above 0, and the eye on the
  // circle round the pivot through where it stands unswung, `back` behind and `high − aim` above,
  // raised or lowered round it by the pitch.
  const a = springs.yaw.x, cy = Math.cos(a), sy = Math.sin(a)
  const vx = hx * cy + hz * sy, vz = hz * cy - hx * sy
  const reach = Math.hypot(c.back, c.high - c.aim), up = Math.atan2(c.high - c.aim, c.back) + springs.pitch.x
  const camera = plugins.render3d.camera as THREE.PerspectiveCamera
  const p = [springs.x.x, springs.y.x + c.aim, springs.z.x]
  camera.position.set(p[0] - vx * reach * Math.cos(up), p[1] + reach * Math.sin(up), p[2] - vz * reach * Math.cos(up))
  camera.up.set(0, 1, 0)
  camera.lookAt(p[0], p[1], p[2])
  target = [px, py + c.aim, pz]
}

function removeOurs(plugins: Plugins) {
  plugins.player.unbind()
}

// The camera, for the seat's own row; another seat's row holds none.
export function eye(): { pos: number[]; dir: number[]; target: number[] } | undefined {
  if (!ours) return undefined
  const camera = render3d?.camera as THREE.PerspectiveCamera | undefined
  if (!camera) throw new Error('the vehicles camera has not been placed')
  const { Vector3 } = render3d!.THREE as typeof THREE
  return { pos: camera.getWorldPosition(new Vector3()).toArray(), dir: camera.getWorldDirection(new Vector3()).toArray(), target }
}

// Every seat is sent every `player` row (`addons/player`), and this look is loaded for each: it binds
// keys and moves the camera only for the row that is this seat's, the one that is `mine`.
let ours = false

export function setup(row: Row, plugins: Plugins) {
  ours = row.data.mine === true
  if (ours) setupOurs(row, plugins)
}

export function tick(row: Row, plugins: Plugins) {
  if (ours) return tickOurs(row, plugins)
}

export function remove(plugins: Plugins) {
  if (ours) removeOurs(plugins)
}

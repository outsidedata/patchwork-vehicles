// The interface's words for ui3d: how the title's words come in and move, delivered to ui3d
// (`plugins/ui3d`, Words) when a scene names `interface` in `world.ui3d.mods.behaviors`.
//   reveal  { after, seconds, from, turn }   hidden until `after` seconds after the thing is first
//           shown, then over `seconds` it comes in from `from` (metres right, up and ahead of where it
//           stands, in the camera's frame) to where it stands, easing out as a cubic, turned `turn`
//           radians about its upright that unwind as it comes.
//   sway    { yaw, pitch, roll, phase, after }   it turns about its own middle, each of `yaw`, `pitch`
//           and `roll` `[radians, radians a second]` of a sine, `phase` radians along it, from `after`
//           seconds after it is first shown.
// Each moves the thing's holder, which carries its hit box.
// It is loaded on the server too, as every mod a scene names is, so it imports types alone.
import type { Behaviors, Placed } from '#plugins/ui3d/ui3d.plugin.ts'

const ease = (k: number) => 1 - (1 - k) ** 3
const clamp01 = (v: number) => Math.min(1, Math.max(0, v))
const wave = ([amp, rate]: number[], t: number, phase: number) => amp * Math.sin(rate * t + phase)

type Reveal = { after: number; seconds: number; from: number[]; turn: number }
type Sway = { yaw: number[]; pitch: number[]; roll: number[]; phase: number; after: number }

export const behaviors = (): Behaviors => ({
  reveal(n: Reveal, it: Placed) {
    const k = (it.age - n.after) / n.seconds
    if (k <= 0) {
      it.holder.visible = false
      return
    }
    const left = 1 - ease(clamp01(k))
    const { T } = it
    it.holder.position.add(new T.Vector3().fromArray(n.from).multiplyScalar(left).applyQuaternion(it.camera.q))
    it.holder.quaternion.multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 1, 0), left * n.turn))
  },
  sway(n: Sway, it: Placed) {
    const t = Math.max(0, it.age - n.after)
    const { T } = it
    it.holder.quaternion.multiply(new T.Quaternion().setFromEuler(new T.Euler(wave(n.pitch, t, n.phase), wave(n.yaw, t, n.phase + 0.7), wave(n.roll, t, n.phase + 1.9))))
  },
})

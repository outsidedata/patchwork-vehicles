// A person standing in their idle on the land, animated by anim, which draws them: the farmer_man
// body and idle-only rig of `world.anim.kinds.pedestrian` (`assets/pedestrian/`). Each step they
// stand on the ground under their `pos` (walker's ground, `world.walker.mods`), until something kills
// them: then they lie limp as a box3d ragdoll (ragdoll3d's physics mode), and anim neither draws nor
// moves them. They stand again where they stood once they have lain their definition's `again`
// seconds.
//
// The row: `pos`, `yaw`, `vel`, `grounded`, `limp`, which anim reads; `rig`; anim's own fields;
// ragdoll3d's `limpFor`, `blow`, `pose` and `ragdoll` while they lie, and `stood`, where they stood.
//
// `hit(struck)`, a rule's (seat −1), hitscan3d's `Struck` with the `speed` of what struck them (a car,
// `box3dvehicle`'s `hit`): they die (ragdoll3d's `die`), thrown along the way it struck at its speed,
// from the height it met them.
import type { Kind } from '#engine/engine.ts'
import { animate, rest } from '#plugins/anim/anim.sim.ts'
import { def } from '#plugins/loader/loader.sim.ts'
import * as math from '#plugins/math/math.sim.ts'
import { groundOf } from '#plugins/walker/walker.sim.ts'
import { die, lie, rise } from '#plugins/ragdoll3d/ragdoll3d.sim.ts'
import type { Struck } from '#plugins/hitscan3d/hitscan3d.sim.ts'

export const pedestrian: Kind = {
  tick(me, dt, w) {
    const d = me.data
    if (d.limp) {
      lie(me)
      if (d.limpFor * dt >= def(w, me.kind).again) {
        rise(w, me)
        rest(me)
        d.pos = [...d.stood]
      }
      return
    }
    d.pos = [d.pos[0], groundOf(w).height(d.pos[0], d.pos[2]), d.pos[2]]
    d.stood = [...d.pos]
    animate(me, w, dt)
  },
  acts: {
    hit(me, w, seat, h: Struck & { speed: number }) {
      if (seat !== -1 || me.data.limp) return
      const l = math.hypot(h.dir[0], h.dir[2])
      die(w, me, { dir: l > 0 ? [h.dir[0] / l, h.dir[2] / l] : [0, 0], speed: h.speed, height: h.point[1] - me.data.pos[1] })
    },
  },
}

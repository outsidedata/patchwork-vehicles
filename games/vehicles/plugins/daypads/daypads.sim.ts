// daypads: the day pads of a scene, one plugin and one `daypads` actor entry for all of them. A day pad is a
// column standing on the land that sets the time of day and the headlights of a car a seat holds when it
// drives into it, with a clock in the column that shows the time it sets. A scene places the plugin once and
// lists its pads in that entry:
//   { "is": "daypads", "pads": [ { "x": 28, "z": 0, "hour": 16.2, "lights": false, "colour": "#87ceeb" } ] }
// A pad is
//   x, z     metres, where the column's middle stands on the land
//   hour     0 up to 24, the hour of the day it sets, as skydome3d's `time` act takes it; its clock's hands point to it
//   lights   true or false, the headlights it sets on the car that enters: set, never switched over, so a car
//            that enters gets that value whatever it had
//   colour   the column's colour, a CSS colour
// Every pad's clock is a copy of the one kit item `world.item3d` lists as the definition's `clock.item`, pro-ng's
// `icons/time/clock_face`, baked once by the game's bake (`assets/daypads.make.ts`) with a rim of the definition's
// `clock.rim`; each copy's hands are turned to the pad's hour (`daypads.plugin.ts`).
//
// Its row, the `daypads` prefab:
//   pads   the entry's pads (they are the scene's, fixed)
//   foot   the land's height under each pad (terrain3d), or null before they are placed
//   in     for each pad, the ids of the cars a seat holds that were inside it on the last step
//
// Its definition, `daypads` in `assets/vehicles.json`:
//   radius   metres across the land from a pad's middle that a car's chassis comes within to be inside
//   height   metres the column stands over the land; a chassis higher than that is over it, not in it
//   glow, opacity, sides   the column's look (`daypads.plugin.ts`)
//   clock    { item, rim, radius, lift, hands }: the clock's item in `world.item3d.items`, its rim's colour, one of `RIMS`,
//            the rim's outer radius in metres, which the item is baked at, the metres its lowest point stands over the
//            land, and its `hands`: the names of its hour hand's and minute hand's bones in the baked glb and the `axis`
//            they turn about in the bone's own space (`daypads.plugin.ts`)
//
// `before`: the first step, each pad is checked and placed on the land. `after`, once the cars have moved: each
// car a seat holds whose chassis is inside a pad and was not on the step before has its headlights set to the
// pad's `lights` (box3dvehicle's `lights` act) and the scene's sky is asked for its `hour` (skydome3d's `time`
// act), so the clock jumps there and a car that stays on a pad sets them once, not every step.
import type { Kind, Row } from '#engine/engine.ts'
import * as math from '#plugins/math/math.sim.ts'
import { def } from '#plugins/loader/loader.sim.ts'
import { heightAt } from '#plugins/terrain3d/terrain3d.sim.ts'
import { holderOf } from '#plugins/player/player.sim.ts'

export type Pad = { x: number; z: number; hour: number; lights: boolean; colour: string }

// The rims of pro-ng's `icons/time/clock_face`, its `Rim` key.
export const RIMS = ['gold', 'orange', 'red', 'pink', 'violet', 'indigo', 'blue', 'sky', 'teal', 'green']

// A scene's pads as its file gives them, checked: they come from outside the program, and the drawing reads them.
export function checked(pads: unknown): Pad[] {
  if (!Array.isArray(pads)) throw new Error('the daypads entry has no pads list')
  return pads.map((p: Record<string, unknown>, i) => {
    const at = `daypads pad ${i}`
    for (const key of ['x', 'z', 'hour'] as const) if (typeof p[key] !== 'number') throw new Error(`${at} has no number ${key}`)
    if (!((p.hour as number) >= 0 && (p.hour as number) < 24)) throw new Error(`${at} has the hour ${p.hour}, which is not from 0 up to 24`)
    if (typeof p.lights !== 'boolean') throw new Error(`${at} has lights ${JSON.stringify(p.lights)}, which is not true or false`)
    if (typeof p.colour !== 'string') throw new Error(`${at} has no colour`)
    return p as unknown as Pad
  })
}

const chassisOf = (w: { get(id: number): Row }, car: Row) => w.get(car.data.chassis).data

export const daypads: Kind = {
  before(me, _dt, w) {
    if (me.data.foot) return
    const pads = checked(me.data.pads)
    me.data.foot = pads.map(p => heightAt(w, p.x, p.z))
    me.data.in = pads.map(() => [])
  },
  after(me, _dt, w) {
    if (!me.data.foot) return
    const k = def(w, me.kind), pads = me.data.pads as Pad[], foot = me.data.foot as number[], was = me.data.in as number[][]
    const cars = w.all('box3dvehicle').filter(car => car.data.chassis !== undefined && holderOf(w, car))
    me.data.in = pads.map((pad, i) => {
      const inside = cars.filter(car => {
        const [cx, cy, cz] = chassisOf(w, car).pos
        return math.hypot(cx - pad.x, cz - pad.z) <= k.radius && cy <= foot[i] + k.height
      })
      for (const car of inside) {
        if (was[i].includes(car.id)) continue
        w.call(car, 'lights', -1, pad.lights)
        w.call(w.find('skydome3d'), 'time', -1, pad.hour)
      }
      return inside.map(car => car.id)
    })
  },
}

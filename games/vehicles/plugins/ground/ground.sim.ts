// vehicles's ground: which chunks of the land box3d holds. Each step, before box3d steps, it writes the
// `box3d` row's `ground` (`plugins/box3d`) as, for each `car` row, the chunk under every point of the
// car's path from where it is to where its velocity takes it in its definition's `ahead` seconds,
// sampled every half chunk and at its end, each with the chunks within its definition's `radius`
// (in chunks) round it. A chunk is `world.box3d.chunk.count` heights a side `cell` metres apart, so
// (count − 1)·cell metres, and chunk [i, j] is the one whose corner is at i and j times that. With
// no car the row keeps the list the scene gave it. It is called by the car's rule, and every car
// calls it: each writes the one list of all of them.
import type { W } from '#engine/engine.ts'
import { def } from '#plugins/loader/loader.sim.ts'
import * as math from '#plugins/math/math.sim.ts'

export function stream(w: W) {
  const cars = w.all('car')
  if (!cars.length) return
  const { count, cell } = w.world.box3d.chunk as { count: number; cell: number }
  const span = (count - 1) * cell
  const keys = new Map<string, number[]>()
  for (const car of cars) {
    const { ahead, radius } = def(w, car.kind) as { ahead: number; radius: number }
    const [px, , pz] = car.data.pos as number[], [vx, , vz] = car.data.vel as number[]
    const reach = math.hypot(vx, vz) * ahead
    const samples = Math.ceil(reach / (span / 2))
    for (let s = 0; s <= samples; s++) {
      const t = samples ? (s / samples) * ahead : 0
      const i = Math.floor((px + vx * t) / span), j = Math.floor((pz + vz * t) / span)
      for (let a = -radius; a <= radius; a++) for (let b = -radius; b <= radius; b++) keys.set(`${i + a},${j + b}`, [i + a, j + b])
    }
  }
  w.find('box3d').data.ground = [...keys.values()].sort((a, b) => a[0] - b[0] || a[1] - b[1])
}

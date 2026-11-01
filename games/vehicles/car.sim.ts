// A car's chassis: a box3d body of the `car` kind, which box3d moves. Its rule streams the land
// round every car (vehicles's `ground` plugin) before box3d steps.
import type { Kind } from '#engine/engine.ts'
import { stream } from './plugins/ground/ground.sim.ts'

export const car: Kind = {
  before(_me, _dt, w) {
    stream(w)
  },
}

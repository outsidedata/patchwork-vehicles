// Where a seat starts: a `start` actor of the scene, one per slot, for the slot in `slot`, in the car
// of the `spot` actor named `spot` (`spot.sim.ts`). The `player` row of that slot takes that car. It
// has no rule and is not drawn.
import type { Kind } from '#engine/engine.ts'

export const start: Kind = {}

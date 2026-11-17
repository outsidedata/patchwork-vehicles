// The manager. One row, naming the title, the road, the gym, the desert, the moon and
// the park, and that every connection enters the title. Its scene file holds what they share: the
// catalogue, the defs, the car, the ball, the starts, the trees and grass, the physics and the sky's clock.
import type { Sim } from '#engine/engine.ts'
import { scenemanager } from '#plugins/scenemanager/scenemanager.sim.ts'

export const sim: Sim = { scenemanager }

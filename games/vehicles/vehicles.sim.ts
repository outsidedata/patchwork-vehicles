// The manager. One row, naming the road, the stylized road, the gym and the desert, and that every
// connection enters the road. Its scene file holds what the two share: the catalogue, the defs, the car, the ball, the
// starts, the trees and grass, the physics and the sky's weather.
import type { Sim } from '#engine/engine.ts'
import { scenemanager } from '#plugins/scenemanager/scenemanager.sim.ts'

export const sim: Sim = { scenemanager }

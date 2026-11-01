// The kinds of the park and the park.scene.json file next to this one: a golf course of nine holes to
// drive round. The land is terrain3d's field `assets/park.json`: gentle rolling ground, a broad swell
// (167 m cells) with smaller knolls over it, 0 to 10 m high and levelled 25 m round the origin where the
// cars stand, drawn as rough meadow. Its brush strokes, written by `assets/park.course.ts` from the
// holes it lists, lay the course on it: a concrete cart path cut level across the slope (`bench`) in a
// loop past every hole, fairways painted in mown grass, flattened greens and tees painted green, and
// sand traps sunk into the ground and drawn in sand, each gripping by its `grip`, dragging by its
// `drag` and throwing up its `spray`. On the rough stand the road's firs, grass clumps and boulders
// (the manager's `world.scatter3d`); every painted surface has a `cover` of 0, so none stand on the
// course. Its `world.box3d` stands the cars on the ground a metre a cell and against the solid
// scatter (`props`), with no kinds of its own. The cars, the starts, the HUD and the sky are as on
// the gym (`gym.sim.ts`); slot 0 starts in the jeep and slot 1 in the truck.
import type { Scene, Sim } from '#engine/engine.ts'
import { box3d } from '#plugins/box3d/box3d.sim.ts'
import { scenemanager } from '#plugins/scenemanager/scenemanager.sim.ts'
import { loader } from '#plugins/loader/loader.sim.ts'
import { skydome3d } from '#plugins/skydome3d/skydome3d.sim.ts'
import { box3dvehicle } from '#plugins/box3dvehicle/box3dvehicle.sim.ts'
import { player } from './player.sim.ts'
import { car } from './car.sim.ts'
import { wheel } from './wheel.sim.ts'
import { axle } from './axle.sim.ts'
import { start } from './start.sim.ts'
import { spot } from './spot.sim.ts'
import { hud } from './hud.sim.ts'
import { atlas } from './atlas.sim.ts'
import file from './park.scene.json' with { type: 'json' }

export const sim: Sim = { loader, scenemanager, skydome3d, box3d, box3dvehicle, player, car, wheel, axle, start, spot, hud, atlas }

export const scene = file as Scene

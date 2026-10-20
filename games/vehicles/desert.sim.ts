// The kinds of the desert and the desert.scene.json file next to this one: open rolling dunes to drive
// on and nothing else. The land is terrain3d's field `assets/desert.json`: a broad swell under long
// dune crests, stretched along one way, turned half a radian and warped 80 m so they wander, with a
// fine ripple over them, all riding a deep rolling octave (2.5 km cells, about 75 m from trough to
// crest) that lifts and drops whole fields of dunes, and levelled 30 m round the origin where the cars
// stand; the ball is dropped 30 m over the ground there. It is drawn in one
// ground layer, wind-rippled sand (`assets/ground/sand-*.webp`, cut by the bake from cc0-textures.com's Ground055S). Nothing
// is scattered on it: its `world.box3d` is the manager's without scatter3d's props. The sky is a clear
// day (the `clear` weather) with a warmer horizon. The cars, the ball, the starts and the HUD are as on
// the road (`road.sim.ts`); slot 0 starts in the jeep and slot 1 in the truck.
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
import { ball } from './ball.sim.ts'
import { start } from './start.sim.ts'
import { spot } from './spot.sim.ts'
import { hud } from './hud.sim.ts'
import { atlas } from './atlas.sim.ts'
import file from './desert.scene.json' with { type: 'json' }

export const sim: Sim = { loader, scenemanager, skydome3d, box3d, box3dvehicle, player, car, wheel, axle, ball, start, spot, hud, atlas }

export const scene = file as Scene

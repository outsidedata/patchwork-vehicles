// The kinds of the stylized road and the stylized.scene.json file next to this one: the road's every kind
// and rule (`road.sim.ts`), on the same land shaped by `assets/stylized.json`, painted in flat colours
// with crisp edges, under a clear sky. Its scatter3d draws the road's firs, grass clumps and boulders.
// Everything else it shares with the road is the manager's, `vehicles.scene.json`.
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
import file from './stylized.scene.json' with { type: 'json' }

export const sim: Sim = { loader, scenemanager, skydome3d, box3d, box3dvehicle, player, car, wheel, axle, ball, start, spot, hud, atlas }

export const scene = file as Scene

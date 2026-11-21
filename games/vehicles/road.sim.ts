// The kinds of the road and the road.scene.json file next to this one. A car is box3dvehicle's: a
// `box3dvehicle` row per car and the box3d rows it is made of, a `car` chassis, four `wheel`s and
// four `axle` joints, every one of them made from `world.box3dvehicle`, which box3dvehicle hands
// box3d (`world.box3d.mods.kinds`) and draws with its browser half. The land is terrain3d's field, `world.terrain3d`, given to box3d
// chunk by chunk (`world.box3d.mods`), which vehicles's `ground` plugin streams ahead of each car, and to
// box3dvehicle, whose cars throw dust from it and stand in box3d's gravity (`world.box3dvehicle.mods`). Every
// number of vehicles's own kinds that never changes is its definition in `assets/vehicles.json`, which
// the scene's `world.defs` names. The fleet's four cars, the golf cart, the jeep, the monster truck
// and the UTV, each have a `spot` side by side, and the road opens with none of them made: each seat
// starts in the car of the spot its slot's `start` names, made there as it gets in, and on `next` its
// car is scrapped and the next free spot's car made at that spot for it. A ball, a box3d body of the
// `ball` kind, drops in front of them to be knocked about. The sky is skydome3d's row, with no
// weather, the firs and boulders are lod3d's and the grass is grass3d's (`assets/grasses.json`),
// none with a row, on terrain3d's ground and never on the road, whose painted surface covers nothing. What the road shares
// with the other places is the manager's, `vehicles.scene.json`; its land, its sky's look
// and how it is drawn are in `plains.partial_scene.json`, which it extends.
import type { Kind, Scene, Sim } from '#engine/engine.ts'
import type { Prepare } from '#addons/scenemanager/scenemanager.addon.ts'
import { particle3d } from '#plugins/particle3d/particle3d.sim.ts'
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
import { pedestrian } from './pedestrian.sim.ts'
import { waypoint } from './waypoint.sim.ts'
import { bone, bonejoint } from '#plugins/ragdoll3d/ragdoll3d.sim.ts'
import file from './road.scene.json' with { type: 'json' }

// The particles' gravity on the Earth, the effects file's `gravity` driver, set as the scene loads.
const particles: Kind & Prepare = { ...particle3d, async prepare(me) { me.data.drivers = { gravity: 9.8 } } }

export const sim: Sim = { loader, scenemanager, skydome3d, box3d, box3dvehicle, particle3d: particles, player, car, wheel, axle, ball, start, spot, hud, atlas, pedestrian, bone, bonejoint, waypoint }

export const scene = file as unknown as Scene

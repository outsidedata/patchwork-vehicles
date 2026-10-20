// The kinds of the gym and the gym.scene.json file next to this one: a flat place to try the car on.
// The land is terrain3d's field `assets/gym.json`, level ground at 0 with brush strokes on it: a row
// of whoops, a washboard and a speed bump on the main strip, a shallow ditch and a steep one across
// it, a hill, a bowl, a bank and a table two metres up; and painted surfaces, each gripping by its
// `grip` and dragging by its `drag` (the manager's `box3dvehicle.mods.grip` and `.drag`, terrain3d's),
// each wheel throwing up its `spray`: asphalt strips (grip 1.1, drag 0.012, nothing thrown), patches
// of grass (0.7, 0.08), mud (0.4, 0.25) and ice (0.1, 0.01), and lanes of gravel (0.6, 0.05) and dirt
// (0.65, 0.04), on concrete (1, 0, the car's own dust);
// and along the far side, a 380 m asphalt drag strip at z 172 and an ice braking lane beside it at
// z 188, both from x -190 to 190. Its spots park the golf cart and the jeep side by side and the
// monster truck facing the kicker at z -30; slot 0 starts in the jeep and slot 1 in the truck, and a
// seat's `next` moves it to the next free car.
// It is drawn by terrain3d's static rings, the finest covering all 400 m at a metre a cell, built
// once and never rebuilt as the car moves. Its `world.box3d` is the manager's with the
// ground's chunks a metre a cell, 32 m a side, so the physics feels the washboard's ridges two metres apart, and the `ramp` and
// `kicker` kinds, still wedges whose hulls are their shapes. The cars, the ball, the starts, the HUD
// and the sky are as on the road (`road.sim.ts`).
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
import { ramp } from './ramp.sim.ts'
import { kicker } from './kicker.sim.ts'
import file from './gym.scene.json' with { type: 'json' }

export const sim: Sim = { loader, scenemanager, skydome3d, box3d, box3dvehicle, player, car, wheel, axle, ball, start, spot, hud, atlas, ramp, kicker }

export const scene = file as Scene

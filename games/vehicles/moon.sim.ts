// The kinds of the moon and the moon.scene.json file next to this one: a grey cratered plain under a
// black sky. The land is terrain3d's field `assets/moon.json`: a slow swell with a faint undulation and
// grain on it, pocked by three lattices of craters (basins 90 to 220 m across their radius, pits 12 to
// 50 m and pocks 2 to 12 m), each floor sunk below a raised rim and its ejecta apron, and levelled 30 m
// round the origin where the cars stand. It is drawn in two ground layers cut by the bake from
// cc0-textures.com: grey regolith everywhere (`rocky_ground_1`) and dark rubble on the crater walls
// (`ground_14`), laid by slope. The sky is skydome3d's look turned airless: every colour of the dome
// black, no haze or mist, a hard white sun, a dim sky light, and the dome's moon drawn as the Earth,
// blue and four times the size the moon is seen from the Earth. Things fall at the moon's 1.62 m/s²:
// its `world.box3d.gravity`, which box3d steps every body by and box3dvehicle's cars read through
// box3d's `gravity` mod. The cars, the ball, the
// starts and the HUD are as on the road (`road.sim.ts`); slot 1 starts in the truck. Beside them stands the lunar rover, the Apollo LRV from the library's pro-ng kit (`assets/rover/`), and
// slot 0 starts in it: its body, its wheels and its hubs each a pro-ng glb that box3dvehicle draws through
// supershader3d's `models` mod, in the scene's one shader, as it draws the jeep's (`assets/jeep/`), their
// looks file `assets/kit.looks.json` (`world.supershader3d.looks`); every car's numbers are the manager's
// (`vehicles.scene.json`).
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
import { waypoint } from './waypoint.sim.ts'
import file from './moon.scene.json' with { type: 'json' }

// The particles' gravity on the moon, the effects file's `gravity` driver, set as the scene loads.
const particles: Kind & Prepare = { ...particle3d, async prepare(me) { me.data.drivers = { gravity: 1.62 } } }

export const sim: Sim = { loader, scenemanager, skydome3d, box3d, box3dvehicle, particle3d: particles, player, car, wheel, axle, ball, start, spot, hud, atlas, waypoint }

export const scene = file as Scene

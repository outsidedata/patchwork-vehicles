// The title scene and the title.scene.json file next to this one, the game's entry. It is played on the
// plains (`plains.partial_scene.json`, which it shares with the road): the land, its sky and the box3d
// row, with the title's own cast, three cars each driven round the plains by a `driver`, the title's
// autopilot (`driver.sim.ts`): the jeep down the dirt road, over the mound and the bumps, and back; the
// monster truck and the golf cart round an oval either side of it.
//
// First the intro: core's cutscene, its cue file the scene's `world.cutscene.script`
// (`assets/intro.json`): the camera following each car, the bars and the fade, and no words. The
// `curtain` starts the intro and every driver in the same step, once the page has its models and
// textures and the land is shown, or after its wait (`curtain.sim.ts`). The cutscene stands on
// terrain3d's ground: its server half on `heightAt`, its browser half on the `land` mod.
//
// After it, the title: the `marquee` is the game's name and a word for each place to drive, in 3D over
// the plains, which go on behind them for as long as the scene runs, its camera carrying on the intro's
// last shot (`marquee.client.ts`). It is a plain seat with no `player`, whose words send the seat to
// the plains, the desert or the test track.
import type { Scene, Sim } from '#engine/engine.ts'
import { loader } from '#plugins/loader/loader.sim.ts'
import { scenemanager } from '#plugins/scenemanager/scenemanager.sim.ts'
import { skydome3d } from '#plugins/skydome3d/skydome3d.sim.ts'
import { box3d } from '#plugins/box3d/box3d.sim.ts'
import { box3dvehicle } from '#plugins/box3dvehicle/box3dvehicle.sim.ts'
import { heightAt } from '#plugins/terrain3d/terrain3d.sim.ts'
import { cutscene } from '#plugins/cutscene/cutscene.sim.ts'
import { car } from './car.sim.ts'
import { wheel } from './wheel.sim.ts'
import { axle } from './axle.sim.ts'
import { driver } from './driver.sim.ts'
import { curtain } from './curtain.sim.ts'
import { marquee } from './marquee.sim.ts'
import file from './title.scene.json' with { type: 'json' }

export const sim: Sim = { loader, scenemanager, skydome3d, box3d, box3dvehicle, car, wheel, axle, driver, curtain, marquee, cutscene: cutscene(heightAt) }

export const scene = file as Scene

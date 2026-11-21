// The title scene and the title.scene.json file next to this one, the game's entry. It is played on the
// desert (`desert.partial_scene.json`, which it shares with the desert to drive on, `desert.sim.ts`): the
// dunes, their sky and the box3d row, with the title's own cast, the jeep, driven round the dunes by a
// `driver`, the title's autopilot (`driver.sim.ts`).
//
// There is no intro: a seat comes straight onto the title. The page shows the loading screen until the
// land and the models are in, and then the `marquee` is the game's name and a word for each place to
// drive, in 3D over the dunes, which go on behind them for as long as the scene runs, its camera
// following the jeep (`marquee.client.ts`). It is a plain seat with no `player`, whose words send the
// seat to the plains, the desert, the moon or the test track.
//
// The title makes no sound. It lists `store` and `audio`, and names the store's `silent` key, which
// starts true and nothing sets, as the key the volume is muted by (`world.audio.volume`), so the jeep's
// engine, which every car's `look.sound` plays through audio, is never heard here. The scenes it sends
// the seat to name no volume, and play at 1.
import type { Kind, Scene, Sim } from '#engine/engine.ts'
import type { Prepare } from '#addons/scenemanager/scenemanager.addon.ts'
import { particle3d } from '#plugins/particle3d/particle3d.sim.ts'
import { loader } from '#plugins/loader/loader.sim.ts'
import { scenemanager } from '#plugins/scenemanager/scenemanager.sim.ts'
import { skydome3d } from '#plugins/skydome3d/skydome3d.sim.ts'
import { box3d } from '#plugins/box3d/box3d.sim.ts'
import { box3dvehicle } from '#plugins/box3dvehicle/box3dvehicle.sim.ts'
import { car } from './car.sim.ts'
import { wheel } from './wheel.sim.ts'
import { axle } from './axle.sim.ts'
import { driver } from './driver.sim.ts'
import { marquee } from './marquee.sim.ts'
import file from './title.scene.json' with { type: 'json' }

// The particles' gravity on the Earth, the effects file's `gravity` driver, set as the scene loads.
const particles: Kind & Prepare = { ...particle3d, async prepare(me) { me.data.drivers = { gravity: 9.8 } } }

export const sim: Sim = { loader, scenemanager, skydome3d, box3d, box3dvehicle, particle3d: particles, car, wheel, axle, driver, marquee }

export const scene = file as Scene

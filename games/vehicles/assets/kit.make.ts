// The vehicles made from the library's pro-ng kit, made by vehicles's bake (`vehicles.bake.ts`): each a body, its
// wheels and its hubs, each a pro-ng scene of one thing, `<vehicle>/<name>.kit.json`, so box3dvehicle draws the body on
// the chassis, a wheel on each wheel row and a hub at each wheel (`world.box3dvehicle.vehicles.<vehicle>.look`,
// vehicles.scene.json):
//   rover/   the Apollo LRV (`pro-ng/kit/spacecraft/LRV_KIT.md`):
//     body.kit              spacecraft/lrv/rover/lrv with Corners false: the chassis, the crew's seats and console,
//                           the boxes, the antennas, the pallet and each corner's arms, damper and link, no wheel
//     wheel-<side>.kit      spacecraft/lrv/wheel/mesh_wheel, Hand -1 on the left and 1 on the right
//     hub-<end>-<side>.kit  spacecraft/lrv/wheel/hub: the traction drive and the fender, End 1 at the front and -1
//                           at the back
//   jeep/    the Jeep TJ (`pro-ng/kit/modern/VEHICLES_KIT.md`):
//     body.kit              modern/vehicles/jeep_tj/jeep with Corners and Steering false: the frame, the axles'
//                           beams, the springs, shocks, arms, bars and shafts, the body, the lamps and the cab, no
//                           wheel, hub or steering; and modern/vehicles/jeep_tj/interior/steering placed alone at the
//                           jeep's STEERING_PLACE as the thing `steer`, so its bone `steer wheel` is the node
//                           box3dvehicle turns as the steering wheel, its +x down the column
//     wheel-<side>.kit      modern/vehicles/jeep_tj/wheels/wheel, Hand -1 on the left and 1 on the right
//     hub-<end>-<side>.kit  modern/vehicles/jeep_tj/running_gear/hub_front (the knuckle, rotor and caliper) and
//                           hub_rear (the backing plate and drum), Hand -1 on the left and 1 on the right
//   kit.set.kit.json        every one of them in one scene, made only for its looks file: every material any of them
//                           draws
// Each is cut in Blender by the library's `pro-ng/procedural.py` and packed by its `pro-ng/pack.mjs`, which writes the
// glb for supershader3d and its looks file beside it. Each but the set's glb is written beside its scene as
// `<name>.glb` and its looks file as `<name>.looks.json` (which box3dvehicle's models mod reads the material names
// from); the set's looks file is made supershader3d's (`packLooks`) and written as `kit.looks.json`, every scene's
// `world.supershader3d.looks` that draws one of them, with every picture its looks read in `looks/`.
import fs from 'node:fs'
import path from 'node:path'
import { execFile } from 'node:child_process'
import type { Looks, Tools } from '#scripts/bake.ts'
import { packLooks } from '#scripts/pack-looks.ts'

const here = import.meta.dirname
const root = path.join(here, '..', '..', '..')
const VEHICLES = ['rover', 'jeep']
const SET = 'kit.set.kit'

const node = (args: string[]) => new Promise<void>((done, fail) =>
  execFile(process.execPath, args, { maxBuffer: 1 << 26 }, (e, stdout, stderr) => (e ? fail(new Error(`${stdout}${stderr}`)) : done())))

export async function kits({ blender, scratch, library }: Tools) {
  const prong = path.join(library, 'pro-ng')
  // `scene` cut and packed in the scratch folder `<key>`, and the folder handed back
  const cut = async (scene: string, name: string, key: string) => {
    const out = scratch(key)
    fs.mkdirSync(out, { recursive: true })
    await blender(['--factory-startup', '--python-exit-code', '1', '--python', path.join(prong, 'procedural.py'), '--', 'file', scene, out])
    await node([path.join(prong, 'pack.mjs'), path.join(out, `${name}.glb`)])
    return out
  }
  for (const vehicle of VEHICLES) {
    const folder = path.join(here, vehicle)
    for (const file of fs.readdirSync(folder).filter(f => f.endsWith('.kit.json')).sort()) {
      const name = file.replace(/\.json$/, '')
      const out = await cut(path.join(folder, file), name, `${vehicle}-${name}`)
      for (const suffix of ['.glb', '.looks.json']) {
        fs.copyFileSync(path.join(out, name + suffix), path.join(folder, name + suffix))
        console.log('wrote', path.relative(root, path.join(folder, name + suffix)))
      }
    }
  }
  const out = await cut(path.join(here, `${SET}.json`), SET, SET)
  const looks: Looks = packLooks(JSON.parse(fs.readFileSync(path.join(out, `${SET}.looks.json`), 'utf8')))
  fs.writeFileSync(path.join(here, 'kit.looks.json'), JSON.stringify(looks, null, 1) + '\n')
  console.log('wrote', path.relative(root, path.join(here, 'kit.looks.json')))
  fs.rmSync(path.join(here, 'looks'), { recursive: true, force: true })
  if (looks.pictures.length) {
    fs.mkdirSync(path.join(here, 'looks'))
    for (const p of looks.pictures) fs.copyFileSync(path.join(out, 'looks', p.file), path.join(here, 'looks', p.file))
    console.log('wrote', path.relative(root, path.join(here, 'looks')), `${looks.pictures.length} pictures`)
  }
}

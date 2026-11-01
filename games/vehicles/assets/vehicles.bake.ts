// vehicles's bake, `yarn bake vehicles` (core's `scripts/bake.ts`): the trees and grass every scene's
// scatter3d draws, made by the library's scripts from the specs beside this file, and the truck's body,
// made by box3dvehicle's own script, each packed by gltfpack and written where the catalogue reads it;
// and the engines every car is heard by:
//   truck/truck.glb   box3dvehicle's `truck/truck.py`, built to `world.box3dvehicle.vehicles.truck` in
//                vehicles.scene.json, the model its look names
//   title/title.glb   `title/title.py`, the marquee's words in 3D from the Saira Condensed font beside it
//   firs.glb     the library's `trees/trees.py` from `firs.trees.json`: rows tall, mid and small, the
//                library's spruce species, LODs 0 to 3, `<row>-<lod>-<part>`
//   clumps.glb   the library's `foliage/foliage.py` from `clumps.foliage.json`: the nine clumps of the
//                library's `props/lod-grass`, LODs 0 and 1, `<row>-<lod>`
//   sounds/      the library's `sounds/sounds.mjs` from `vehicles.sounds.json`: each car's engine as
//                loops held at fixed rpms, `<car>-<rpm>.wav`, the jeep's a flat-plane V8, the truck's a
//                V8 diesel and the cart's an electric motor, which each Vehicle's `look.sound`
//                names
// The trees' leaf and bark sets are asked of `texture` first, so each is downloaded into the library
// before Blender reads it.
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import type { Tools } from '#scripts/bake.ts'

const here = import.meta.dirname

export default async ({ blender, pack, scratch, library, texture }: Tools) => {
  const trees = path.join(here, 'firs.trees.json')
  const { leafSets, barkSets } = await import(pathToFileURL(path.join(library, 'trees', 'trees.mjs')).href) as { leafSets: (spec: string) => string[], barkSets: (spec: string) => string[] }
  for (const zip of [...leafSets(trees), ...barkSets(trees)]) await texture(zip)
  const made = [
    { out: 'firs.glb', script: path.join(library, 'trees', 'trees.py'), spec: trees },
    { out: 'clumps.glb', script: path.join(library, 'foliage', 'foliage.py'), spec: path.join(here, 'clumps.foliage.json') },
  ]
  for (const { out, script, spec } of made) {
    const raw = scratch(out)
    await blender(['--factory-startup', '--python-exit-code', '1', '--python', script, '--', spec, raw])
    await pack(raw, path.join(here, out))
    console.log('wrote', path.join('games', 'vehicles', 'assets', out))
  }
  const truck = scratch('truck.glb')
  await blender(['--factory-startup', '--python-exit-code', '1', '--python', path.join(here, '..', '..', '..', 'plugins', 'box3dvehicle', 'truck', 'truck.py'), '--', path.join(here, '..', 'vehicles.scene.json'), 'truck', truck])
  await pack(truck, path.join(here, 'truck', 'truck.glb'))
  console.log('wrote', path.join('games', 'vehicles', 'assets', 'truck', 'truck.glb'))
  const title = scratch('title.glb')
  await blender(['--factory-startup', '--python-exit-code', '1', '--python', path.join(here, 'title', 'title.py'), '--', title])
  await pack(title, path.join(here, 'title', 'title.glb'))
  console.log('wrote', path.join('games', 'vehicles', 'assets', 'title', 'title.glb'))
  const { sounds } = await import(pathToFileURL(path.join(library, 'sounds', 'sounds.mjs')).href) as { sounds: (spec: string, out: string) => string[] }
  for (const f of sounds(path.join(here, 'vehicles.sounds.json'), path.join(here, 'sounds'))) console.log('wrote', path.relative(path.join(here, '..', '..', '..'), f))
}

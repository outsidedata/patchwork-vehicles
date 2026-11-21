// The day pads' clock, made by vehicles's bake (`vehicles.bake.ts`): one kit item, pro-ng's `icons/time/clock_face`, built
// by the `items` tool at twelve o'clock with the rim and radius of the definition's `daypads.clock` (`assets/vehicles.json`),
// into
//   daypads/<item>.glb, daypads/<item>.item.json   the item named by `daypads.clock.item`
// Every pad of every scene draws a copy of it and turns its two hand bones to the pad's hour (`daypads.plugin.ts`), so one
// bake shows every time. The folder is made again each bake. The scene's one looks file holds the clock's materials
// because the set scene (`kit.set.kit.json`) holds a clock of the same rim (`setBuildings`).
// A scene draws the clock through item3d, which wants the item in the manager scene's `world.item3d.items` and its glb and
// sidecar in the loader's catalogue; `unlisted` says what the manager scene lacks of those, and the bake throws with it.
import fs from 'node:fs'
import path from 'node:path'
import type { Tools } from '#scripts/bake.ts'

const here = import.meta.dirname
const root = path.join(here, '..', '..', '..')
const MANAGER = path.join(here, '..', 'vehicles.scene.json')

export type Clock = { item: string; rim: string; radius: number; lift: number }

// The buildings of the set scene (`kit.set.kit.json`) the clock adds, so the looks file holds its materials. A scene
// states every key of a building.
export const setBuildings = (clock: Clock): Record<string, unknown>[] =>
  [{ kind: 'icons/time/clock_face', name: 'clock', place: [12, 0], Hour: 0, Minute: 0, Rim: clock.rim, Radius: clock.radius }]

// What the manager scene lacks for the clock to be drawn: its `world.item3d.items` entry and the two catalogue entries
// it names, each as it should be written.
export function unlisted(item: string): string[] {
  const world = (JSON.parse(fs.readFileSync(MANAGER, 'utf8')) as { world: Record<string, any> }).world
  const assets = world.loader.assets as Record<string, unknown>
  const want = { glb: `${item}-glb`, file: `${item}-item` }
  const glb = { type: 'binary', url: `/games/vehicles/assets/daypads/${item}.glb`, preload: true }
  const file = { type: 'json', url: `/games/vehicles/assets/daypads/${item}.item.json`, preload: true }
  const missing: string[] = []
  if (JSON.stringify(world.item3d?.items?.[item]) !== JSON.stringify(want)) missing.push(`world.item3d.items.${item} = ${JSON.stringify(want)}`)
  if (JSON.stringify(assets[want.glb]) !== JSON.stringify(glb)) missing.push(`world.loader.assets.${want.glb} = ${JSON.stringify(glb)}`)
  if (JSON.stringify(assets[want.file]) !== JSON.stringify(file)) missing.push(`world.loader.assets.${want.file} = ${JSON.stringify(file)}`)
  return missing
}

export async function clock({ items, scratch }: Pick<Tools, 'items' | 'scratch'>, c: Clock) {
  const sheet = scratch('daypads.items.json')
  fs.mkdirSync(path.dirname(sheet), { recursive: true })
  fs.writeFileSync(sheet, JSON.stringify({ items: { [c.item]: { kind: 'icons/time/clock_face', keys: { Hour: 0, Minute: 0, Rim: c.rim, Radius: c.radius } } } }, null, 1))
  const out = path.join(here, 'daypads')
  fs.rmSync(out, { recursive: true, force: true })
  await items({ sheet, out })
  console.log('wrote', path.relative(root, path.join(out, `${c.item}.glb`)))
  const missing = unlisted(c.item)
  if (missing.length) throw new Error(`the manager scene vehicles.scene.json does not list the day pads' clock:\n  ${missing.join('\n  ')}`)
}

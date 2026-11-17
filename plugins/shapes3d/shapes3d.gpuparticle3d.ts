// shapes3d's mod for gpuparticle3d (`addons/scenemanager`'s mods), the page's. A scene with
// `world.gpuparticle3d.mods: { solids: ['shapes3d'] }` has every particle of a layer with a `bounce` bounce off
// shapes3d's shapes, on the GPU.
//
// `solids(plugins)` is asked once a frame: it reads the shapes off the rows this page holds (and the files
// `world.shapes3d.shapes` names), and hands back each box, plane, hyperplane and cylinder as the data it is,
// `{ <word>: shape }`, which gpuparticle3d's step meets as hitscan3d and shapes3d's own lines meet them
// (`lineBox`, `linePlane`, `lineHyperplane`, hitscan3d's `cylinder`); `triangles` are met by nothing, as in
// shapes3d's particle3d mod.
import type { Row, W } from '#engine/engine.ts'
import type { Plugins } from '#engine/browser.ts'
import type { Solid } from '#plugins/gpuparticle3d/gpuparticle3d.plugin.ts'
import { shapes } from './shapes3d.sim.ts'

const MET = ['box', 'plane', 'hyperplane', 'cylinder']

export function solids(plugins: Plugins): Solid[] {
  const wire = plugins.wire
  const w = {
    world: wire.scene.world ?? {},
    all: (kind: string) => wire.rows.filter(r => r.kind === kind),
    get: (id: number) => wire.rows.find(r => r.id === id),
    find: (kind: string, pred: (r: Row) => boolean = () => true) => wire.rows.find(r => r.kind === kind && pred(r)),
  } as unknown as W
  return shapes(w).filter(p => MET.includes(p.word)).map(p => ({ [p.word]: p.shape[p.word] }) as Solid)
}

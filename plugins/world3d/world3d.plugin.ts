// The browser half of world3d (`world3d.sim.ts` says what world3d is and every part of a place): it draws the scene's
// place, plays its moving things and burns its effects. It builds on render3d, supershader3d, particle3d and the
// loader, which it takes out of `plugins`.
//
// The place. On its first tick it reads the place's clips and effects (each a preloaded `json` entry) and starts the
// glb's (`binary`); once the glb has landed and supershader3d's looks file has, it unpacks the glb and assembles it
// (supershader3d's `supershader3d.glb.ts`), each call drawn by supershader3d's material for it, writes the course table's rows, and adds
// the mesh to render3d's scene, casting and taking shadows. A call supershader3d has no material for throws, naming
// it. `close` takes it away and disposes its geometry, its skeleton and its mixer's cache.
//
// The course table. The wall looks read each row's course feet (its courses' heights off the ground) and its thing's
// walls' thickness from `csCourses`, a float texture of COURSES + 1 columns, a row for each thing and look that
// courses it, the row the vertex's slot `s2` names (its fourth number, % 256). `courses(three)` hands out the one
// table, made on its first call, ROWS rows so every row a vertex can name is there; the place's rows (its glb's extras'
// `courses`) are written into it as the place is built, and a place of more rows than ROWS throws. supershader3d binds
// it as its shared texture `courses` through world3d's mod (`world3d.supershader3d.ts`). `close` disposes it.
//
// The clips. Every clip of the place's clips file plays on its one mesh, by one mixer. Each whose `start` is on plays
// from the moment the place is built, looping where its `loop` says, and a clip that does not loop holds its last
// frame. Each tick the mixer goes on by the page's time since the tick before, or by `advance(seconds)`. A game starts
// and stops a clip by its thing's and its own name: `clip('tavern/tavern fan', 'spin', true)`, `false` to stop it.
// Stopped, the thing stands where it was; started again, it goes on from there. A clip asked for before the place is
// built, or by a name the place has not, throws.
//
// The effects. Each spawn of the place's effects file is emitted through particle3d, at its point along its way, for
// ever, on the first tick particle3d holds every effect the spawns name.
import type * as THREE from 'three'
import type { Plugins } from '#engine/browser.ts'
import { json } from '#plugins/loader/loader.sim.ts'
import type { Looks } from '#plugins/supershader3d/supershader3d.plugin.ts'
import { entry } from './world3d.sim.ts'
import { assemble, unpack, type CourseRow, type Unpacked } from '#plugins/supershader3d/supershader3d.glb.ts'
import { played, type Clips, type Played, type Spawn } from './world3d.place.ts'

export const COURSES = 256
export const ROWS = 256

export function world3d() {
  let started = false
  let gone = false
  // the place unpacked, waiting for supershader3d's looks file, and its clips
  let waiting: Unpacked | undefined
  let clips: Clips = { things: [] }
  let spawns: Spawn[] = []
  let mesh: THREE.Mesh | undefined
  let table: THREE.DataTexture | undefined
  let data: Float32Array | undefined
  let mixer: THREE.AnimationMixer | undefined
  let actions = new Map<string, Played>()
  let last: number | undefined

  const find = (thing: string, clip: string) => {
    if (!mixer) throw new Error(`world3d: no place is animated, so no clip ${clip} of ${thing}`)
    const p = actions.get(`${thing}\n${clip}`)
    if (!p) throw new Error(`world3d: the place has no clip ${clip} of ${thing}; it has ${[...actions.values()].map(a => `${a.clip} of ${a.thing}`).join(', ') || 'none'}`)
    return p
  }

  const courses = (three: typeof THREE) => {
    if (!table) {
      data = new Float32Array((COURSES + 1) * ROWS)
      table = new three.DataTexture(data, COURSES + 1, ROWS, three.RedFormat, three.FloatType)
      table.minFilter = table.magFilter = three.NearestFilter
      table.needsUpdate = true
    }
    return table
  }

  const write = (three: typeof THREE, rows: CourseRow[]) => {
    if (rows.length > ROWS) throw new Error(`world3d: the place has ${rows.length} course rows, and the course table ${ROWS}`)
    const t = courses(three)
    const width = COURSES + 1
    rows.forEach((r, row) => {
      for (let c = 0; c < COURSES; c++) data![row * width + c] = c < r.feet.length ? r.feet[c] : 1e4 + c
      data![row * width + COURSES] = r.wallDepth
    })
    t.needsUpdate = true
  }

  const animate = (three: typeof THREE, m: THREE.AnimationMixer, made: Played[]) => {
    mixer = m
    for (const p of made) {
      const key = `${p.thing}\n${p.clip}`
      if (actions.has(key)) throw new Error(`world3d: the place has the clip ${p.clip} of ${p.thing} twice`)
      actions.set(key, p)
      p.action.setLoop(p.loop ? three.LoopRepeat : three.LoopOnce, Infinity)
      p.action.clampWhenFinished = !p.loop
      if (p.start) p.action.play()
    }
  }

  const build = (plugins: Plugins, town: Unpacked) => {
    const T = plugins.render3d.THREE as typeof THREE
    const looks: Looks = plugins.supershader3d.looks()
    write(T, town.info.courses)
    mesh = assemble(T, town, looks, call => {
      const material = plugins.supershader3d.material(call)
      if (!material) throw new Error(`world3d: the place draws ${call} triangles, and supershader3d has no ${call} material`)
      return material
    })
    mesh.castShadow = mesh.receiveShadow = true
    plugins.render3d.scene.add(mesh)
    if (clips.things.length) {
      const m = new T.AnimationMixer(mesh)
      animate(T, m, played(T, m, mesh, town, clips))
    }
  }

  const me = {
    courses,
    clip(thing: string, clip: string, on: boolean) {
      const { action } = find(thing, clip)
      if (!on) { action.paused = true; return }
      if (action.paused) action.paused = false
      if (!action.isRunning()) action.reset().play()
    },
    advance(seconds: number) {
      mixer?.update(seconds)
    },
    tick(plugins: Plugins) {
      if (!started) {
        started = true
        const world = plugins.wire.scene.world ?? {}
        clips = json(plugins.wire, entry(world, 'clips')) as Clips
        spawns = (json(plugins.wire, entry(world, 'effects')) as { spawns: Spawn[] }).spawns
        plugins.loader.load(entry(world, 'glb')).then(async (glb: { bytes: Uint8Array }) => {
          const town = await unpack(glb.bytes)
          if (!gone) waiting = town
        })
      }
      if (spawns.length && spawns.every(s => plugins.particle3d.has(s.effect))) {
        for (const s of spawns) plugins.particle3d.emit(s.effect, s.at, { dir: s.dir, life: Infinity })
        spawns = []
      }
      if (waiting && plugins.supershader3d.looks()) {
        const town = waiting
        waiting = undefined
        build(plugins, town)
      }
      const now = performance.now()
      if (last !== undefined) me.advance((now - last) / 1000)
      last = now
    },
    close(plugins: Plugins) {
      gone = true
      waiting = undefined
      mixer?.stopAllAction()
      if (mesh) {
        plugins.render3d.scene.remove(mesh)
        mesh.geometry.dispose()
        mixer?.uncacheRoot(mesh)
        if ((mesh as THREE.SkinnedMesh).isSkinnedMesh) (mesh as THREE.SkinnedMesh).skeleton.dispose()
      }
      mesh = undefined
      mixer = undefined
      actions = new Map()
      table?.dispose()
      table = undefined
      data = undefined
    },
  }
  return me
}

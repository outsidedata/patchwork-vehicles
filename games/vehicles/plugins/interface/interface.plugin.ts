// The interface: the title's words drawn in 3D over the desert for ui3d to show (`plugins/ui3d`), and the
// words that move them (`interface.ui3d.ts`). Loaded by `shipped`, it hands out:
//
// `word(root, node, faceFinish, sideFinish, env?)`: the node `node` of a model's `root` (the loader's
// model `title`, made by `assets/title/title.py`, one node per word, its faces' material named `face` and
// its walls' and bevel's `side`) made a word of its own: its geometry copied, its faces and sides each a
// material of its own set to a finish, reflecting `env`. A finish is { colour, metalness, roughness, env,
// clearcoat? }: `colour` one colour, or [bottom, top], a gradient up the word's capitals, laid in the
// word's own copy of its geometry's colours. It hands back { node, face, side, geometries }, and the
// word's geometries and materials are let go with `letGo(word)`.
// `finish(material, finish)`: the finish set on a material.
// `environment(env)`: what the finishes reflect, a sphere seen from inside, coloured from `ground` below
// to `horizon` at the level and `sky` above, with a band of `band` round the level `width` radians tall
// (so chrome shows a bright line across it, as polished metal does), `size` metres across, drawn through
// the renderer's PMREM; undefined with no renderer (in node), and the finishes reflect nothing.
//
// Every number is the definition's of the kind whose look calls it.
import type * as THREE from 'three'
import type { Plugins } from '#engine/browser.ts'

export type Finish = { colour: string | string[]; metalness: number; roughness: number; env: number; clearcoat?: number }
export type Env = { sky: string; horizon: string; ground: string; band: string; width: number; size: number }
export type Word = { node: THREE.Object3D; face: THREE.MeshPhysicalMaterial; side: THREE.MeshPhysicalMaterial; geometries: THREE.BufferGeometry[] }

const clamp01 = (v: number) => Math.min(1, Math.max(0, v))

function iface() {
  let plugins: Plugins | undefined
  const three = () => plugins!.render3d.THREE as typeof THREE

  const me = {
    tick(p: Plugins) { plugins = p },
    word(root: THREE.Object3D, node: string, faceFinish: Finish, sideFinish: Finish, env?: THREE.Texture): Word {
      const T = three()
      const it = root.getObjectByName(node)
      if (!it) throw new Error(`the title's model has no node ${node}`)
      const face = new T.MeshPhysicalMaterial({ name: 'face', vertexColors: Array.isArray(faceFinish.colour) })
      const side = new T.MeshPhysicalMaterial({ name: 'side' })
      const geometries: THREE.BufferGeometry[] = []
      it.traverse(o => {
        const mesh = o as THREE.Mesh
        if (!mesh.isMesh) return
        mesh.geometry = mesh.geometry.clone()
        geometries.push(mesh.geometry)
        if (Array.isArray(faceFinish.colour)) {
          const [lo, hi] = faceFinish.colour.map(c => new T.Color(c))
          const p = mesh.geometry.attributes.position
          mesh.geometry.computeBoundingBox()
          const { min, max } = mesh.geometry.boundingBox!
          const colours: number[] = []
          const at = new T.Color()
          for (let i = 0; i < p.count; i++) {
            at.copy(lo).lerp(hi, clamp01((p.getY(i) - min.y) / Math.max(1e-6, max.y - min.y)))
            colours.push(at.r, at.g, at.b)
          }
          mesh.geometry.setAttribute('color', new T.Float32BufferAttribute(colours, 3))
        }
        const own = (m: THREE.Material) => (m.name === 'face' ? face : side)
        mesh.material = Array.isArray(mesh.material) ? mesh.material.map(own) : own(mesh.material)
        mesh.frustumCulled = false
      })
      for (const m of [face, side]) m.envMap = env ?? null
      it.position.set(0, 0, 0)
      me.finish(face, faceFinish)
      me.finish(side, sideFinish)
      return { node: it, face, side, geometries }
    },
    letGo(w: Word) {
      w.face.dispose()
      w.side.dispose()
      for (const g of w.geometries) g.dispose()
    },
    finish(m: THREE.MeshPhysicalMaterial, F: Finish) {
      const gradient = Array.isArray(F.colour)
      m.color.set(gradient ? '#ffffff' : (F.colour as string))
      m.emissive.set('#000000')
      m.metalness = F.metalness
      m.roughness = F.roughness
      m.envMapIntensity = F.env
      m.clearcoat = F.clearcoat ?? 0
    },
    environment(E: Env): THREE.Texture | undefined {
      const renderer = plugins!.render3d.renderer as THREE.WebGLRenderer | undefined
      if (!renderer) return
      const T = three()
      const geometry = new T.SphereGeometry(E.size, 64, 32)
      const colours: number[] = []
      const at = new T.Color(), sky = new T.Color(E.sky), horizon = new T.Color(E.horizon), ground = new T.Color(E.ground), band = new T.Color(E.band)
      const p = geometry.attributes.position
      for (let i = 0; i < p.count; i++) {
        const a = Math.asin(Math.max(-1, Math.min(1, p.getY(i) / E.size)))
        if (Math.abs(a) < E.width / 2) at.copy(band)
        else if (a > 0) at.copy(horizon).lerp(sky, Math.min(1, a / (Math.PI / 2)))
        else at.copy(horizon).lerp(ground, Math.min(1, -a / (Math.PI / 8)))
        colours.push(at.r, at.g, at.b)
      }
      geometry.setAttribute('color', new T.Float32BufferAttribute(colours, 3))
      const room = new T.Scene()
      const material = new T.MeshBasicMaterial({ vertexColors: true, side: T.BackSide })
      room.add(new T.Mesh(geometry, material))
      const pmrem = new T.PMREMGenerator(renderer)
      const target = pmrem.fromScene(room)
      pmrem.dispose()
      geometry.dispose()
      material.dispose()
      return target.texture
    },
  }
  return me
}

export { iface as interface }
export type Interface = ReturnType<typeof iface>

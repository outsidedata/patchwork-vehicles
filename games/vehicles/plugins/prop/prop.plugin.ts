// vehicles's props: a still thing to drive over, a box3d body whose one shape is a `hull` in its kind's
// entry of `world.box3d.kinds`, which box3d stands where its row says. `prop(row, plugins)`, which
// each prop kind's actor calls in its `setup`, draws the row as that hull, flat-shaded in its
// definition's `colour` (`assets/vehicles.json`), a standard material render3d dresses so the sky's
// light reaches it, casting and taking shadows, and has box3d's browser half keep it on the row. It
// hands back what its actor's `remove` calls to take it away. The hull's faces are the planes
// through three of its points that every other point is on one side of, each wound to face out, so
// the drawing is the shape box3d collides with and the scene file holds it once.
import type * as THREE from 'three'
import type { Row } from '#engine/engine.ts'
import type { Plugins } from '#engine/browser.ts'
import { def } from '#plugins/loader/loader.sim.ts'

type V = [number, number, number]
const sub = (a: V, b: V): V => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const cross = (a: V, b: V): V => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const dot = (a: V, b: V) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]

// The hull's triangles, as flat [x, y, z, …], each wound so its normal points out. A face of more
// than three points is fanned from its first point about its middle, in turn order.
export function triangles(flat: number[]): number[] {
  const p: V[] = []
  for (let i = 0; i < flat.length; i += 3) p.push([flat[i], flat[i + 1], flat[i + 2]])
  const eps = 1e-6, seen = new Set<string>(), out: number[] = []
  for (let a = 0; a < p.length; a++) for (let b = a + 1; b < p.length; b++) for (let c = b + 1; c < p.length; c++) {
    let n = cross(sub(p[b], p[a]), sub(p[c], p[a]))
    const len = Math.hypot(...n)
    if (len < eps) continue
    n = [n[0] / len, n[1] / len, n[2] / len]
    const d = p.map(q => dot(n, sub(q, p[a])))
    if (d.some(x => x > eps)) {
      if (d.some(x => x < -eps)) continue
      n = [-n[0], -n[1], -n[2]]
    }
    const face = p.map((_, i) => i).filter(i => Math.abs(d[i]) <= eps)
    const key = face.join(',')
    if (seen.has(key)) continue
    seen.add(key)
    const mid = face.reduce<V>((m, i) => [m[0] + p[i][0] / face.length, m[1] + p[i][1] / face.length, m[2] + p[i][2] / face.length], [0, 0, 0])
    const u = sub(p[face[0]], mid), v = cross(n, u)
    face.sort((i, j) => Math.atan2(dot(sub(p[i], mid), v), dot(sub(p[i], mid), u)) - Math.atan2(dot(sub(p[j], mid), v), dot(sub(p[j], mid), u)))
    for (let k = 1; k + 1 < face.length; k++) out.push(...p[face[0]], ...p[face[k]], ...p[face[k + 1]])
  }
  return out
}

export function prop(row: Row, plugins: Plugins): () => void {
  const three = plugins.render3d.THREE as typeof THREE
  const points: number[] = plugins.wire.scene.world!.box3d.kinds[row.kind].shapes[0].hull.points
  const geometry = new three.BufferGeometry()
  geometry.setAttribute('position', new three.Float32BufferAttribute(triangles(points), 3))
  geometry.computeVertexNormals()
  const material = plugins.render3d.dress(new three.MeshStandardMaterial({ color: def(plugins.wire, row.kind).colour, flatShading: true }))
  const mesh = new three.Mesh(geometry, material)
  mesh.castShadow = mesh.receiveShadow = true
  plugins.render3d.scene.add(mesh)
  plugins.box3d.follow(row.id, mesh)
  return () => {
    plugins.box3d.drop(row.id)
    plugins.render3d.scene.remove(mesh)
    geometry.dispose()
    material.dispose()
  }
}

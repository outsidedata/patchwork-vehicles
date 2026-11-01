// Writes the brush strokes of the park's field, `park.json`'s `layers`, from the nine holes below, so
// the course can be made again or changed by editing this file and running it from the repo's root:
//   node --experimental-strip-types games/vehicles/assets/park.course.ts
// The game never reads this file. Each hole is a tee, the points its fairway bends at, and a green, in
// metres on the land (x, z). The strokes, in the order they are written, so each lies over the last:
//   - the cart path cut level across the slope (`bench`) along `PATH`, a loop past every hole;
//   - each tee and green flattened (`flatten`) to the height of the rolling ground under its middle,
//     read off the field's own height program with no strokes on it (`landOf`), so it sits in the hill;
//   - each sand trap sunk `BUNKER.depth` metres (`lower`): two beside each green, across the way in, and
//     one at the edge of the last leg of each fairway, on alternate sides hole by hole;
//   - the paint: the fairways (every hole with a bend or longer than `PAR3` m, from `FAIRWAY.from` metres
//     off the tee to the green), then the greens and tees, then the sand, then the path over all.
import { readFileSync, writeFileSync } from 'node:fs'
import { landOf, type Field, type Stroke } from '../../../plugins/terrain3d/terrain3d.sim.ts'

type P = [number, number]
type Hole = { tee: P; bends: P[]; green: P }

const HOLES: Hole[] = [
  { tee: [30, -10], bends: [], green: [250, -60] },
  { tee: [280, -30], bends: [], green: [330, -180] },
  { tee: [310, -220], bends: [[220, -330]], green: [80, -370] },
  { tee: [60, -345], bends: [], green: [-130, -300] },
  { tee: [-160, -270], bends: [], green: [-260, -160] },
  { tee: [-290, -130], bends: [[-380, 20]], green: [-330, 180] },
  { tee: [-320, 210], bends: [], green: [-140, 300] },
  { tee: [-100, 330], bends: [], green: [40, 290] },
  { tee: [80, 270], bends: [[150, 150]], green: [60, 40] },
]

const PATH: P[] = [
  [-10, 6], [40, 15], [150, -5], [255, -25], [310, -20], [365, -100], [360, -185], [345, -235], [300, -290],
  [240, -375], [120, -405], [60, -400], [0, -385], [-130, -345], [-185, -300], [-230, -265], [-300, -185],
  [-320, -140], [-370, -90], [-420, 20], [-390, 170], [-350, 225], [-290, 260], [-150, 340], [-60, 370],
  [40, 335], [90, 310], [130, 280], [195, 150], [110, 30], [40, 15],
]

const LAYER = { at: [0, 0] as P, size: 1000, px: 1250 }
const PAR3 = 180
const BENCH = { radius: 4, hardness: 0.6 }
const PATH_PAINT = { radius: 2.5, hardness: 0.9 }
const TEE = { radius: 5, flat: 6 }
const GREEN = { radius: 14, flat: 16 }
const FAIRWAY = { radius: 16, hardness: 0.85, from: 45 }
const BUNKER = { radius: 6, sink: 7, depth: 0.8, beside: 21, back: 4, edge: 18, along: 0.6 }

const file = new URL('./park.json', import.meta.url)
const field: Field = JSON.parse(readFileSync(file, 'utf8'))
const bare = landOf({ ...field, layers: [] })
const level = ([x, z]: P) => Number(bare.height(x, z).toFixed(3))

const sub = (a: P, b: P): P => [a[0] - b[0], a[1] - b[1]]
const unit = ([x, z]: P): P => { const l = Math.hypot(x, z); return [x / l, z / l] }
const at = (p: P, d: P, k: number): P => [Number((p[0] + d[0] * k).toFixed(1)), Number((p[1] + d[1] * k).toFixed(1))]
const across = ([x, z]: P): P => [-z, x]
const runs = (ps: P[]) => ps.flatMap((p, i) => (i ? [[], p] : [p])) as (P | [])[]

const stroke = (verb: Stroke['verb'], radius: number, hardness: number, path: (P | [])[], extra: { strength?: number; level?: number; surface?: string } = {}): Stroke =>
  ({ verb, radius, hardness, strength: extra.strength ?? 0, level: extra.level ?? 0, surface: extra.surface ?? '', path })

const fairways: P[][] = []
const bunkers: P[] = []
HOLES.forEach((h, i) => {
  const line = [h.tee, ...h.bends, h.green]
  const last = line.at(-2)!
  const into = unit(sub(h.green, last))
  const side = across(into)
  bunkers.push(at(at(h.green, into, -BUNKER.back), side, BUNKER.beside), at(at(h.green, into, -BUNKER.back), side, -BUNKER.beside))
  const length = line.slice(1).reduce((s, p, k) => s + Math.hypot(...sub(p, line[k])), 0)
  if (!h.bends.length && length <= PAR3) return
  fairways.push([at(h.tee, unit(sub(line[1], h.tee)), FAIRWAY.from), ...h.bends, h.green])
  const leg = Math.hypot(...sub(h.green, last))
  bunkers.push(at(at(last, into, leg * BUNKER.along), side, i % 2 ? BUNKER.edge : -BUNKER.edge))
})

const strokes = [
  stroke('bench', BENCH.radius, BENCH.hardness, PATH),
  ...HOLES.map(h => stroke('flatten', TEE.flat, 0.5, [h.tee], { level: level(h.tee) })),
  ...HOLES.map(h => stroke('flatten', GREEN.flat, 0.6, [h.green], { level: level(h.green) })),
  stroke('lower', BUNKER.sink, 0.2, runs(bunkers), { strength: BUNKER.depth }),
  ...fairways.map(f => stroke('surface', FAIRWAY.radius, FAIRWAY.hardness, f, { surface: 'fairway' })),
  stroke('surface', GREEN.radius, 0.9, runs(HOLES.map(h => h.green)), { surface: 'green' }),
  stroke('surface', TEE.radius, 0.9, runs(HOLES.map(h => h.tee)), { surface: 'green' }),
  stroke('surface', BUNKER.radius, 0.85, runs(bunkers), { surface: 'sand' }),
  stroke('surface', PATH_PAINT.radius, PATH_PAINT.hardness, PATH, { surface: 'path' }),
]

field.layers = [{ ...LAYER, strokes }]
writeFileSync(file, JSON.stringify(field, null, 2) + '\n')
console.log(`park.json: ${HOLES.length} holes, ${fairways.length} fairways, ${bunkers.length} sand traps, ${strokes.length} strokes`)

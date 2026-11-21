// The marquee's look, over the title's desert: the game's name and a word for each place to drive in
// 3D, and nothing else written on the screen.
//
// When it shows. Nothing of it shows while the page is loading: the loading screen (`loader.ui.ts`) is
// over the page until every preloaded file is in, every shader compiled and the land whole, and the
// marquee waits on the same three. From the first frame they are met it comes up on this page's
// clock: the name in 3D over `name.reveal`, and the places' words `words.reveal.after` seconds after
// they are first shown, each `words.reveal.stagger` after the last, over `words.reveal.seconds`.
//
// The 3D. Every word is a node of the loader's model `model` (made by `assets/title/title.py`, the
// name's node `name` and each place's its scene), made a word by the interface plugin
// (`plugins/interface`, `word`) with its finishes, and shown by ui3d (`plugins/ui3d`) in render3d's
// overlay, over the desert and never behind any of it, held in the camera's frame: its `at` is metres
// right, up and ahead (−z) of the camera, its face toward it, `scale` times the model's metre-tall
// capitals. It comes in by the interface's `reveal`, from `from` (metres from where it stands, in the
// camera's frame; the name's `reveal.from`, a word's `words.reveal.from`), turned `turn` radians about
// its upright that unwind as it comes, then sways about its own middle by the interface's `sway`,
// `sway.yaw`, `pitch` and `roll` each `[radians, radians a second]` of a sine, each word a phase of its
// own, from the moment it has come in. The overlay's `near` and `far` are `world.ui3d.overlay`.
//
// The finish. Each word's faces and walls are set to its finishes once, when it is made: the name's
// `name.face` and `name.side`; a place's face its own `face`, its side `words.side`. Every finish
// reflects the interface's environment made once from `env`. A key light `key` (a point light of
// `colour`, `power` candela, reaching `distance` metres, at `at` in the camera's frame) lights them; a
// sweep light, `sweep`, crosses the name from `from` to `to` (the camera's frame) over `seconds`, first
// `at` seconds after the name's reveal begins and every `every` after, its power `power` × sin(πu) of
// the way u across. Both are shown by ui3d, as the words are.
//
// The menu. Each place's word can be selected (ui3d's `select`): the pointer over it selects it,
// ui3d's keys (`world.ui3d.keys`) move the selection from word to word in their order and press the
// one selected, and so does a click on it. A press sends the seat to the word's scene with the
// scenemanager's open `go`. The first place is selected first. The selected word grows to
// `words.focus.scale` and its face glows `words.focus.glow` of its face's top colour (ui3d's `grow` and
// `glow`); the others are drawn at `words.dim` of their colour (`dim`). The keys of ui3d's selection
// are `place.<i>`, `i` each place's place in `places`.
//
// The camera: this claims render3d's camera once the land is there and follows the driver named
// `camera.follows` (the jeep), from `camera.pos`, metres right, up and ahead of it in the world's
// axes, looking at its point `camera.head` metres up, with the field of view `camera.fov`, the offset
// turned about the upright `camera.orbit` radians a second on this page's clock from the frame it took
// the camera. So the jeep drives on in view as the camera circles it. It lets go when the row goes.
//
// Its definition, every word, place and number, as above: camera { orbit, follows, pos, look, head,
// fov }, model, env, key, sweep, sway, name { text, at, scale, reveal { seconds, from, turn }, face,
// side }, words { scale, side, dim, focus { scale, glow }, reveal { after, stagger, seconds, from, turn }
// }, places [{ scene, word, at, face }].
import type * as THREE from 'three'
import type { Row } from '#engine/engine.ts'
import type { Plugins } from '#engine/browser.ts'
import { def } from '#plugins/loader/loader.sim.ts'
import { view } from '#plugins/cutscene/cutscene.sim.ts'
import type { Look } from '#plugins/ui3d/ui3d.plugin.ts'
import type { Env, Finish, Interface, Word } from './plugins/interface/interface.plugin.ts'

type Reveal = { seconds: number; from: number[]; turn: number }
type Place = { scene: string; word: string; at: number[]; face: Finish }
type Camera = { orbit: number; follows: string; pos: number[]; look: string; head: number; fov: number }
type Marquee = {
  camera: Camera
  model: string
  env: Env
  key: { colour: string; power: number; at: number[]; distance: number }
  sweep: { colour: string; power: number; from: number[]; to: number[]; at: number; seconds: number; every: number; distance: number }
  sway: { yaw: number[]; pitch: number[]; roll: number[] }
  name: { text: string; at: number[]; scale: number; reveal: Reveal; face: Finish; side: Finish }
  words: { scale: number; side: Finish; dim: number; focus: { scale: number; glow: number }; reveal: Reveal & { after: number; stagger: number } }
  places: Place[]
}
type Made = { name: Word; words: Word[]; key: THREE.PointLight; sweep: THREE.PointLight; env?: THREE.Texture }

let shown = 0 // this page's clock the first frame the page was whole, ms; 0 not yet
let held = 0 // this page's clock the first frame it held the camera, ms; 0 not yet
let holder: object | undefined
let made: Made | undefined

// The point p turned `a` radians about the upright through `about`, as a yaw turns a heading.
const turned = (p: number[], about: number[], a: number) => {
  const x = p[0] - about[0], z = p[2] - about[2]
  return [about[0] + x * Math.cos(a) + z * Math.sin(a), p[1], about[2] + z * Math.cos(a) - x * Math.sin(a)]
}

// Whether everything the loading screen waits on is met: every preloaded file in, every shader compiled
// and the land whole.
const whole = ({ loader }: Plugins) => {
  const { done, of } = loader.preloads()
  return done >= of && loader.shaders() === 0 && loader.settled()
}

function camera(plugins: Plugins, C: Camera, now: number) {
  const { render3d, wire, terrain3d } = plugins
  const cam = render3d.camera as THREE.PerspectiveCamera | undefined
  const ground = terrain3d.ground
  if (!cam || !ground) return
  const driver = wire.rows.find(r => r.kind === 'driver' && r.data.name === C.follows)
  if (!driver) return
  holder ??= {}
  if (!render3d.claim(holder)) return
  held ||= now
  const a = (C.orbit * (now - held)) / 1000
  const to = { pos: turned(C.pos, [0, 0, 0], a), look: C.look, fov: C.fov, head: C.head, follows: C.follows }
  const p = view(to, { [C.follows]: driver.id }, wire.rows, (x, z) => ground.height(x, z))
  if (!p) return
  cam.position.set(p.pos[0], p.pos[1], p.pos[2])
  cam.quaternion.set(p.quat[0], p.quat[1], p.quat[2], p.quat[3])
  if (cam.fov !== p.fov) {
    cam.fov = p.fov
    cam.updateProjectionMatrix()
  }
}

function make(plugins: Plugins, M: Marquee): Made | undefined {
  const { render3d, loader } = plugins
  const face = plugins.interface as Interface
  if (!loader.ready(M.model)) {
    loader.load(M.model).catch(() => {})
    return
  }
  const T = render3d.THREE as typeof THREE
  const root = loader.model(M.model).scene as THREE.Object3D
  const env = face.environment(M.env)
  const name = face.word(root, 'name', M.name.face, M.name.side, env)
  const words = M.places.map(p => face.word(root, p.scene, p.face, M.words.side, env))
  const key = new T.PointLight(M.key.colour, M.key.power, M.key.distance, 2)
  const sweep = new T.PointLight(M.sweep.colour, 0, M.sweep.distance, 2)
  return { name, words, key, sweep, env }
}

// The sway of a thing `phase` radians along it, from `after` seconds after it is first shown.
const swaying = (M: Marquee, phase: number, after: number) => ({ ...M.sway, phase, after })

export function setup() {
  shown = held = 0
  made = undefined
}

export function tick(row: Row, plugins: Plugins) {
  const { wire, render3d, ui3d, scenemanager } = plugins
  const now = performance.now()
  const M = def(wire, row.kind) as Marquee
  camera(plugins, M.camera, now)
  if (!shown && !whole(plugins)) return
  shown ||= now
  const since = (now - shown) / 1000
  const T = render3d.THREE as typeof THREE

  made ??= render3d.camera ? make(plugins, M) : undefined
  if (!made) return
  const N = M.name
  ui3d.show('name', () => made!.name.node, { at: N.at, scale: N.scale, reveal: { after: 0, seconds: N.reveal.seconds, from: N.reveal.from, turn: N.reveal.turn }, sway: swaying(M, 0, N.reveal.seconds) } satisfies Look)
  const W = M.words
  M.places.forEach((p, i) => {
    const start = W.reveal.after + i * W.reveal.stagger
    const top = Array.isArray(p.face.colour) ? p.face.colour[1] : p.face.colour
    ui3d.show(`place.${i}`, () => made!.words[i].node, {
      at: p.at,
      scale: W.scale,
      select: true,
      reveal: { after: start, seconds: W.reveal.seconds, from: W.reveal.from, turn: W.reveal.turn },
      sway: swaying(M, 1.3 * (i + 1), start + W.reveal.seconds),
      grow: { scale: W.focus.scale },
      glow: { colour: top, power: W.focus.glow, materials: ['face'] },
      dim: { by: W.dim },
    } satisfies Look)
  })
  const pressed = ui3d.pressed() as string | undefined
  if (pressed?.startsWith('place.')) scenemanager.go(M.places[Number(pressed.slice(6))].scene)
  ui3d.show('key', () => made!.key, { at: M.key.at } satisfies Look)
  const S = M.sweep
  const v = since >= S.at ? ((since - S.at) % S.every) / S.seconds : 1
  const across = v < 1 ? new T.Vector3().fromArray(S.from).lerp(new T.Vector3().fromArray(S.to), v).toArray() : S.from
  ui3d.show('sweep', () => made!.sweep, { at: across } satisfies Look)
  made.sweep.intensity = v < 1 ? S.power * Math.sin(Math.PI * v) : 0
}

export function remove(plugins: Plugins) {
  const { render3d } = plugins
  if (holder) render3d.release(holder)
  holder = undefined
  if (made) {
    const face = plugins.interface as Interface
    for (const w of [made.name, ...made.words]) face.letGo(w)
    made.key.dispose()
    made.sweep.dispose()
    made.env?.dispose()
  }
  made = undefined
  shown = held = 0
}

// The HUD on the UI's `hud` panel, for the car the seat holds (`holding`, `plugins/player`): a car's
// instrument cluster, placed by the `hud` definition in `assets/vehicles.json`, in pixels from the
// panel's top left, each look a ui style in `vehicles.scene.json`.
//   The dials, `tach` and `speedo`: each a round face (`hud.face`) `radius` round with its middle at
//   `at`, a rim (`hud.rim`), and its scale swept clockwise from `sweep[0]` to `sweep[1]` radians (0
//   along +x, down the screen positive): a major tick (`hud.tick`) every `step`, `tick[0]` long in from
//   the rim, `minor` smaller ones (`hud.minor`, `tick[1]` long) between, and at each major tick its
//   value over `scale` (`hud.label`) `labels` out from the middle. The needle (`hud.needle`) is
//   `needle[0]` long, `needle[1]` wide at its hub and reaches `needle[2]` back past it, over a hub
//   (`hud.hub`) `hub` round. A caption (`hud.caption`) sits `caption.at` from the middle.
//   The tachometer reads the engine's rpm up to the first `step` past its vehicle's `engine.redline`,
//   with the arc from the redline on in `hud.red`, `red` in from the rim. The speedometer reads the
//   speed over the ground in km/h up to `max`, and shows it in figures (`hud.readout`) at `readout`.
//   The selector: `letters` (reverse, neutral, drive) `gap` apart from `at` (`hud.gear`), the one the
//   car is in tinted `hud.on` and the rest `hud.off`; in a forward gear of a petrol engine the gear's
//   number (`hud.number`) stands `number` past the drive letter.
// Every text is centred on its place by `anchor`. An electric car's motor rpm shows on the
// tachometer; a car with a direct-drive engine has no gear or revs, and shows its speedometer alone.
import type * as PIXI from 'pixi.js'
import type { Row } from '#engine/engine.ts'
import type { Plugins } from '#engine/browser.ts'
import { def } from '#plugins/loader/loader.sim.ts'
import { design, type Electric, type Petrol } from '#plugins/box3dvehicle/box3dvehicle.sim.ts'
import { holding } from '#plugins/player/player.plugin.ts'

type Dial = {
  at: [number, number]; radius: number; sweep: [number, number]; step: number; minor: number; scale: number
  tick: [number, number]; labels: number; needle: [number, number, number]; hub: number
  caption: { at: [number, number]; text: string }
}

export function setup() {}

export function tick(row: Row, plugins: Plugins) {
  const { ui, wire } = plugins
  const { Container, Graphics, Text } = ui.PIXI as typeof PIXI
  const k = def(wire, row.kind)
  const car = holding(wire.rows)
  const chassis = car && wire.rows.find(r => r.id === car.data.chassis)
  if (!car || !chassis) return
  const engine = design(wire.scene.world!, car).engine
  const text = (style: string, at: number[], value: string) => {
    const t = new Text({ text: value, style: ui.style(style) })
    t.anchor.set(k.anchor[0], k.anchor[1])
    t.position.set(at[0], at[1])
    return t
  }
  const angle = (d: Dial, value: number, max: number) => d.sweep[0] + (d.sweep[1] - d.sweep[0]) * Math.max(0, Math.min(1, value / max))

  // A dial reading up to `max`, its arc from `red` on in `hud.red`, and its needle, labelled `needle`.
  const dial = (d: Dial, max: number, red?: number) => {
    const c = new Container()
    c.position.set(d.at[0], d.at[1])
    const face = new Graphics().circle(0, 0, d.radius).fill(ui.style('hud.face')).circle(0, 0, d.radius).stroke(ui.style('hud.rim'))
    c.addChild(face)
    if (red !== undefined) {
      const r = d.radius - k.tach.red, a0 = angle(d, red, max), a1 = d.sweep[1]
      c.addChild(new Graphics().moveTo(r * Math.cos(a0), r * Math.sin(a0)).arc(0, 0, r, a0, a1).stroke(ui.style('hud.red')))
    }
    const ticks = new Graphics()
    const majors = Math.round(max / d.step)
    for (let i = 0; i <= majors * (d.minor + 1); i++) {
      const major = i % (d.minor + 1) === 0, a = angle(d, (i * d.step) / (d.minor + 1), max)
      const r0 = d.radius - (major ? d.tick[0] : d.tick[1]), r1 = d.radius
      ticks.moveTo(r0 * Math.cos(a), r0 * Math.sin(a)).lineTo(r1 * Math.cos(a), r1 * Math.sin(a)).stroke(ui.style(major ? 'hud.tick' : 'hud.minor'))
    }
    c.addChild(ticks)
    for (let i = 0; i <= majors; i++) {
      const a = angle(d, i * d.step, max)
      c.addChild(text('hud.label', [d.labels * Math.cos(a), d.labels * Math.sin(a)], String((i * d.step) / d.scale)))
    }
    c.addChild(text('hud.caption', d.caption.at, d.caption.text))
    const [length, width, tail] = d.needle
    const needle = new Graphics().poly([-tail, -width / 2, length, 0, -tail, width / 2]).fill(ui.style('hud.needle'))
    needle.label = 'needle'
    c.addChild(needle, new Graphics().circle(0, 0, d.hub).fill(ui.style('hud.hub')))
    return c
  }
  const point = (c: PIXI.Container, a: number) => { c.getChildByLabel('needle')!.rotation = a }

  const speedo: Dial = k.speedo
  const [vx, , vz] = chassis.data.vel as number[]
  const kmh = Math.hypot(vx, vz) * 3.6
  point(ui.show('hud', 'speedo', () => dial(speedo, k.speedo.max)), angle(speedo, kmh, k.speedo.max))
  ui.show('hud', 'readout', () => text('hud.readout', [speedo.at[0] + k.speedo.readout[0], speedo.at[1] + k.speedo.readout[1]], '')).text = String(Math.round(kmh))
  if (!('curve' in engine) && !('power' in engine)) return

  const tach: Dial = k.tach, e = engine as Petrol | Electric
  const top = (Math.floor(e.redline / tach.step) + 1) * tach.step
  point(ui.show('hud', `tach.${car.data.vehicle}`, () => dial(tach, top, e.redline)), angle(tach, car.data.rpm, top))

  const gear: number = car.data.gear, sel = k.selector
  const lit = Math.sign(gear) + 1
  sel.letters.forEach((letter: string, i: number) => {
    const t = ui.show('hud', `gear.${letter}`, () => text('hud.gear', [sel.at[0] + i * sel.gap, sel.at[1]], letter))
    t.tint = ui.style(i === lit ? 'hud.on' : 'hud.off').color
  })
  if (gear > 0 && 'curve' in engine) {
    const at = [sel.at[0] + (sel.letters.length - 1) * sel.gap + sel.number[0], sel.at[1] + sel.number[1]]
    ui.show('hud', 'number', () => text('hud.number', at, '')).text = String(gear)
  }
}

export function remove() {}

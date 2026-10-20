// The atlas on the UI's modal panel the `atlas` definition names (`panel`), in `assets/vehicles.json`, a
// menu the player opens: the seat's `menu` action opens it (`player.client.ts`), and `world.ui`'s
// `back` keys close it, on the keyboard or a gamepad. While it is open it has the input, so the seat
// lets go of every key and its car coasts, and the arrows, w a s d, the d-pad or the left stick move
// the focus, and Enter, Space or the pad's bottom button press the button focused.
//
// Drawn in the panel's pixels from its top left: the face, a rounded box `face.size` big and
// `face.radius` round (`atlas.face`, rimmed in `atlas.rim`); the title's `text` (`atlas.title`)
// centred by `title.anchor` on `title.at`; and a button (`atlas.button`) at each place's `at`, in the
// definition's order, labelled `label`, the first focused as the menu opens. A button pressed moves
// the seat to that place's `scene` (the scenemanager's `go`), the scene it is on among them, which it
// enters again on foot beside its car, every other row as it left them.
import type * as PIXI from 'pixi.js'
import type { Row } from '#engine/engine.ts'
import type { Plugins } from '#engine/browser.ts'
import { def } from '#plugins/loader/loader.sim.ts'

type Place = { scene: string; label: string; at: [number, number] }

export function setup() {}

export function tick(row: Row, plugins: Plugins) {
  const { ui } = plugins
  const d = def(plugins.wire, row.kind)
  if (!ui.opened(d.panel)) return
  const { Graphics, Text } = ui.PIXI as typeof PIXI
  const [w, h] = d.face.size
  ui.show(d.panel, 'face', () => new Graphics().roundRect(0, 0, w, h, d.face.radius).fill(ui.style('atlas.face')).roundRect(0, 0, w, h, d.face.radius).stroke(ui.style('atlas.rim')))
  for (const p of d.places as Place[]) {
    ui.show(d.panel, `place.${p.scene}`, () => ui.button({ ...ui.style('atlas.button'), label: p.label }).on('pointertap', () => plugins.scenemanager.go(p.scene)))
      .position.set(p.at[0], p.at[1])
  }
  const title = ui.show(d.panel, 'title', () => new Text({ text: '', style: ui.style('atlas.title') }))
  title.anchor.set(d.title.anchor[0], d.title.anchor[1])
  title.position.set(d.title.at[0], d.title.at[1])
  title.text = d.title.text
}

export function remove() {}

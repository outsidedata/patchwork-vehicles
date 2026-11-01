// The curtain's look: what this page shows before the intro, and how it is skipped.
//
// Before the cutscene runs, the `curtain` ui panel is covered in the style `curtain.cover`, so the
// page shows black, not the plains half drawn. The first frame every model and texture the scene's
// loader catalogue holds is in (fetched and decoded, or failed) and the land the intro stands on (the
// cutscene's `land` mod, terrain3d's ground) is shown, the page sends the curtain's open act `ready`
// once (`curtain.sim.ts`), and the intro starts; a page that comes when it has started, or is done,
// sends nothing. While the cutscene runs, any key or any press of the pointer sends the cutscene's open
// act `skip` once, which plays it through for every seat (`plugins/cutscene`). The listeners are the
// page's, on the window, taken off when the row goes.
import type { Row } from '#engine/engine.ts'
import type { Plugins } from '#engine/browser.ts'
import { mod } from '#addons/scenemanager/scenemanager.addon.ts'

// The catalogue's types a page must have in before the intro is worth showing.
const SHOWN = ['model', 'texture']

type Land = (plugins: Plugins) => { shown(): boolean } | undefined

let loaded = false
let sent = false
let skipped = false
let listen: ((e: Event) => void) | undefined

const cutsceneOf = (plugins: Plugins) => plugins.wire.rows.find(r => r.kind === 'cutscene')

export function setup(_row: Row, plugins: Plugins) {
  loaded = sent = skipped = false
  const assets = plugins.wire.scene.world!.loader.assets as Record<string, { type: string }>
  const names = Object.entries(assets).filter(([, e]) => SHOWN.includes(e.type)).map(([name]) => name)
  void Promise.allSettled(names.map(name => plugins.loader.load(name))).then(() => { loaded = true })
  listen = () => {
    const c = cutsceneOf(plugins)
    if (skipped || !c?.data.running) return
    skipped = true
    plugins.wire.send(c.id, 'skip')
  }
  addEventListener('keydown', listen)
  addEventListener('pointerdown', listen)
}

export function tick(row: Row, plugins: Plugins) {
  const d = cutsceneOf(plugins)?.data
  const land = mod<Land>(plugins.wire.scene.world!, 'cutscene', 'land')?.(plugins)
  if (loaded && land?.shown() && !sent && !row.data.started) {
    sent = true
    plugins.wire.send(row.id, 'ready')
  }
  const { ui } = plugins
  if (d?.running || d?.done) return
  const [w, h] = plugins.wire.scene.world!.ui.panels.curtain.size
  ui.show('curtain', 'cover', () => new ui.PIXI.Graphics().rect(0, 0, w, h).fill(ui.style('curtain.cover')))
}

export function remove() {
  if (listen) {
    removeEventListener('keydown', listen)
    removeEventListener('pointerdown', listen)
  }
  listen = undefined
}

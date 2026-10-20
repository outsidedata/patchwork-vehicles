// A ramp, drawn as its hull by vehicles's `prop` (`plugins/prop/prop.plugin.ts`).
import type { Row } from '#engine/engine.ts'
import type { Plugins } from '#engine/browser.ts'
import { prop } from './plugins/prop/prop.plugin.ts'

let done = () => {}

export function setup(row: Row, plugins: Plugins) {
  done = prop(row, plugins)
}

export function tick() {}

export function remove() {
  done()
}

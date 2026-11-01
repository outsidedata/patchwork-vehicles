// The atlas: one `actors` entry in each scene a seat drives in, whose browser half (`atlas.client.ts`)
// draws the menu of the scenes to drive in, which the seat's `menu` action opens. It has no rule: what
// is open is the page's alone, and the seat moves by the scenemanager's `go`.
import type { Kind } from '#engine/engine.ts'

export const atlas: Kind = {}

// The marquee: one `actors` entry of the title scene, the game's name and a word for each place to
// drive in 3D over the desert once the page has loaded, drawn by `marquee.client.ts` through ui3d, whose
// selection is its menu. It has no rule: its words move the seat with the scenemanager's open `go`. Its
// definition, in `assets/vehicles.json`, holds every word, place, colour and number it draws, and
// `places`, the scenes it offers in order, each with its word; the words' 3D model is made from them
// by `assets/title/title.py`.
import type { Kind } from '#engine/engine.ts'

export const marquee: Kind = {}

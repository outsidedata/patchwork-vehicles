// The curtain: the title's intro, held until a page can show it, and the cars started with it. The
// intro (core's `plugins/cutscene`, the scene's `world.cutscene.script`) is not `auto`: a page that has
// just arrived is still fetching the cars' models and the ground's textures and preparing the land
// where the first shot stands, and an intro played to an empty set is wasted. One row. Its act `ready`,
// which is open, is sent by a page once every model and texture the title's catalogue holds is in and
// the land is shown (`curtain.client.ts`). Then, in one step, it starts the cutscene (its closed act
// `start`, called with seat −1) and every driver (its closed act `start`), so the cars set out on the
// step the cue clock starts and are where the cue file was written for them. So that no page can hold
// it for ever, the row does the same itself once it has waited its definition's `wait` seconds. `t` is
// the seconds the row has waited, and `started` that it has started both; a second `ready`, or one
// after the wait, does nothing, and the intro plays once for the life of the truth: a seat that comes
// later finds it done, and the cars driving behind the title.
import type { Kind, Row, W } from '#engine/engine.ts'
import { def } from '#plugins/loader/loader.sim.ts'

// A clock that is a sum of steps reaches a time within this of it.
const TOLERANCE = 1e-9

function raise(me: Row, w: W) {
  if (me.data.started) return
  me.data.started = true
  w.call(w.find('cutscene'), 'start', -1)
  for (const d of w.all('driver')) w.call(d, 'start', -1)
}

export const curtain: Kind = {
  before(me, dt, w) {
    if (me.data.started) return
    me.data.t += dt
    if (me.data.t >= def(w, me.kind).wait - TOLERANCE) raise(me, w)
  },
  acts: {
    ready(me, w) { raise(me, w) },
  },
  open: ['ready'],
}

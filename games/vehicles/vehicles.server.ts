// The manager and the road in one process, behind one socket. Each socket is one connection: one
// seat on the road, its car on the pad of the slot `addons/player` gave it.
import { boot, type Scene } from '#engine/engine.ts'
import { accept, load, manager, run } from '#addons/scenemanager/scenemanager.addon.ts'
import { serve } from '#addons/socket/socket.addon.ts'
import { sim } from './vehicles.sim.ts'
import file from './vehicles.scene.json' with { type: 'json' }

const scene = file as Scene
const truth = boot(scene, sim)
await load(truth, import.meta.url)
await serve(manager(truth).data.port, accept(manager(truth)))
run(truth)

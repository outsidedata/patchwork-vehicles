# motion3d: table stakes

motion3d is for games about a hero doing things: an action RPG, a tuned combat game. These six things are
what such a game needs before its animation feels right. Each entry says what was true in the code before,
what motion3d does now, and how that is proven. An entry is done when its proof passes, in a test and on
screen in `games/demo_motion3d` (its `dev.html` stations, each run through `dev.runNow` and its checks read).

| # | Table stake | Status |
|---|---|---|
| 1 | Input buffer and cancel timing | done |
| 2 | The jump | done |
| 3 | Clip markers | done |
| 4 | Additive layers | done |
| 5 | Attacks land on their target | done |
| 6 | Traversal from the walls themselves | done |

## 1. Input buffer and cancel timing

**Before.** The buffer was the demo's (`player.sim.ts`), one key deep, its cancel points a share of each
clip written by hand per pair of keys. A new game had none.

**Now.** motion3d's: `queue(me, w, key)` puts a key at the back of the buffer and `drive` plays the front
one once it may, for at most the motion3d file's `buffer.hold` seconds of steps it was free to play in.
A one-shot a key played is cut only from its cancel point, `buffer.cancel[<key playing>][<key pressed>]`,
a time in its clip: seconds, `"NN%"`, or `"strike"`, the second its blow lands as the bake measured it.
The demo's `player.sim.ts` has no buffer of its own; its cancel table is the X Bot's motion3d file's.

**Proof.** `motion3d.sim.test.ts`: a key during the backflip plays nothing before its cancel point, queued
plays there, and a key nothing plays is dropped after its hold. `demo_motion3d.sim.test.ts`: three lights
pressed in the first tenth of a second play `light1`, `light2`, `light3`, each from the step after the one
before's strike. On screen: the station `combo: three lights pressed at once chain` runs done.

## 2. The jump

**Before.** The body left the ground on the jump clip's first frame, and every jump went `jumpH` high.

**Now.** The `jump` behavior leaves the ground on the clip's takeoff (the second its last foot leaves the
ground, from the bake's touches) and plays a clip that comes down before its end at the rate that lands it
as the body lands. The rule's `jumpHeld` let go while the body rises keeps kinematics3d's `jump.cut` of
its upward speed. The demo binds the jump key as a hold too, `cut` 0.4.

**Proof.** `demo_motion3d.sim.test.ts`: the axe's jump leaves the ground on the step its playhead reaches the
takeoff and comes down within three steps of the clip's landing; a jump held rises 1.9 m, more than half
again a tapped one; a running jump goes more than 2 m further than a standing one. On screen: the station
`jump: a tap hops, a hold goes high` runs done.

## 3. Clip markers

**Before.** `animate` and `overStep` returned the markers each step crossed, and `motion3d.sim.ts` dropped them.

**Now.** A clip's `markers` are times or windows `[from, to]`, each a time in seconds, `"NN%"`, or a moment
the bake measured (`"peak"`, `"strike"`, `"takeoff"`, `"landing"`), moved by seconds (`"strike-0.08"`).
Each step `drive` writes the row's `markers`, every one crossed by its clips and its upper half's and its
layers', and `windows`, those open now. Every attack clip of the X Bot holds a `blow` window about its
strike; the demo's dummy takes a hit only while it is open.

**Proof.** `motion3d.play.test.ts`: the strike, the takeoff and the landing measured off a body's ends and
touches, and a window's opening and closing crossed. `motion3d.sim.test.ts`: the walk's step marked on
exactly the steps its playhead passes it, the backflip's tuck and strike window, a blow read only while the
window is open, the upper half's marker. On screen: the dummy's station shows `open blow` as the jab lands.

## 4. Additive layers

**Before.** A body was drawn from four slots: its clip, the one it fades from, and the upper half's two.

**Now.** A motion that says `add` is laid on top of whatever plays, at its `weight`, from its `over` bone
up: each bone turned on by the turn its clip makes from its first frame. With a `press` it plays as a
one-shot over anything; with none it is laid on while it fits. The server's `posed` and the page lay it
the same way. A kind's `lean` rolls a body running or walking into its turns by atan(speed · turn rate / g).

**Proof.** `motion3d.play.test.ts`: the chest turned by exactly the layer's share over the pose beneath, and
a layer from the arm leaving the chest as it was. `motion3d.plugin.test.ts`: the page lays it the same, the
same every frame. `motion3d.sim.test.ts`: a flinch over the walk, the legs walking on; breathing laid on
while still and taken off walking; leaning into a turn and upright again. `demo_motion3d.sim.test.ts`: H
while running flinches from the spine up over the run; a hard turn leans the body. On screen: the station
`flinch over a run, lean into a turn` runs done.

## 5. Attacks land on their target

**Before.** A clip was bent onto a point only at a station; an attack went where its clip carried it.

**Now.** A one-shot whose motion gives `warp: { reach, turn, accel }`, begun while the row has a `target`,
turns toward it and goes as much further as its blow falls short, eased in and out over the time to its
strike, no more than `reach` metres nor than `accel` allows before the strike. The demo's player targets the
nearest dummy within its `lock`; every attack gives a warp.

**Proof.** `demo_motion3d.sim.test.ts`: a light attack from a metre and a half off the dummy, from four sides,
turned 40° away, lands its blow within the dummy's reach and the dummy plays its hit; with no target, the
same jab misses. On screen: the dummy's station runs done with no faults.

A jab's strike comes 0.3 s in, so at an `accel` of 60 m/s² (the hips' speed changing no more than the dev
page allows in a step) it closes at most 0.9 m: from two metres it falls short. A longer attack closes more.

## 6. Traversal from the walls themselves

**Before.** Only a space with points placed by hand beside a wall offered a climb or a vault.

**Now.** An activity whose entry gives `solid` is offered by the upright sides of the scene's solid boxes
(shapes3d's `faces` mod): a side whose box stands on the body's ground, its top `over` the feet by a range,
the body `at` a range out of it and facing it. Its space is taken up with no key and at once, its points
standing off the side as the clips measure them. The demo's `vaultover` and `climbup` play on a run into a
box 0.7 to 0.9 m and 2.25 to 2.5 m high.

**Proof.** `demo_motion3d.sim.test.ts`: run at a plain box with no station placed, the body vaults it and
lands beyond it; at a head-high one it jumps up, catches its top and climbs onto it. On screen: the two
`traversal:` stations run done.

## What the page's checks still flag

The dev page's checks (the hips' speed changing more than 1 m/s in a step, a foot under the floor, a pinned
hand short of its point) flag faults on the vault and the mantle onto a plain box; they are the same faults,
to the centimetre, the yard's own vault and ledge stations had on the committed code before this work, which
come from those clips. The run and the jump's jolts are fewer and smaller than on the committed code. A combo's
next swing cutting in at the strike jolts the hips 1.84 m/s in one step: the cut itself.

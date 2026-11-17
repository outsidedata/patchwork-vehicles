---
name: using-motion3d
description: Use in core, or any clone of it, whenever a body animated by motion3d gets a new animation or a new motion - a clip added to a character's rig, a strafe, an aim, a rifle or cup carried, a jump, a hang, a seat, a climb - or when a character's motion3d file (`<character>.motion3d.json`), its rig (`<character>.rig.json`), a clip's sidecar (`<clip>.motion3d.json` beside its FBX) or the bake (`yarn bake <game>`) comes up. Also when a clip does not play, plays the wrong way, or a bake stops on a clip with no sidecar.
---

# Using motion3d

A new thing a body does is a new motion. Every step is a file of the game's or of the library's,
then the bake. Nothing in motion3d's code changes for a new motion.

## The steps

1. **The clip in the rig.** Each clip the motion plays is an entry in the game's
   `assets/<character>.rig.json` `clips`, its FBX in the clip collection (`PATCHWORK_CLIPS`, from the
   shell or `.env`, else `~/troupe-collection`):
   `"riflewalkleft": { "file": "packs/Rifle 8-Way Locomotion Pack 30FPS/walk left.fbx", "loop": true }`.
   A loop says `"loop": true`; a one-shot says nothing. A clip that is another mirrored is
   `{ "mirror": "<clip>" }`.

2. **Its sidecar.** Beside every FBX, `<file>.motion3d.json` in the clip collection, says which
   bones are the clip's spot and how it meets its point. Without it the bake stops, naming the clip.
   - anything on the ground (idle, walk, run, strafe, aim): `{ "spot": ["LeftFoot", "RightFoot"], "on": "both" }`
   - a hang: `{ "spot": ["LeftHand", "RightHand"], "on": "both" }`
   - a sit-down: `{ "spot": ["Hips"], "on": "end" }`
   - a wall run: `{ "spot": ["LeftFoot", "RightFoot"], "on": "face", "facing": "along" }`
   - a climb: `{ "spot": ["LeftHand", "RightHand", "LeftFoot", "RightFoot"], "on": "face", "facing": "into" }`

3. **The motion.** In `assets/<character>.motion3d.json`, under the activity it belongs to
   (`walk` for anything done while walking about), the motion and its clips:
   - `clips`: the clips it plays. A motion of several clips that each go a different way (a strafe:
     forward, left, right, back and the four between) plays the one that goes the way the body is
     moving.
   - `when`: the states that must hold, `!word` for one that must not. kinematics3d's own are `ground`,
     `rest`, `rising`, `falling`, `landed` and `stopped`; motion3d's are `pushed` (the stick held),
     `moving` and `still` (faster or slower than the kind's `move.still`). Any other word, such as
     `fast`, is the game's own, from a `states()` mod named in `world.kinematics3d.mods.states`; a word
     nothing gives throws, naming it. A walk goes on `pushed`, a stand on
     `!pushed`: the body goes as fast as its clip carries it, so a clip that goes nowhere never makes it
     `moving`.
   - `from`: the motions it may follow, the body's or its upper half's. A strafe that plays while
     the rifle is up is `"from": ["aim"]`.
   - `stick`: the way the stick must point, `forward`, `back`, `across` or `none`.
   - `press`: the key that plays it. `then`: the motion after it plays out.
   - `over`: the bone it plays from, over the body (`"Spine"`), for an upper half: an aim, a draw.
   - `carry`: the carry that holds a prop while it plays (`carries` at the top of the file).
   - `target`: `point`, `line`, `spline`, `plane` or `triangles` (the ground, for anything done
     walking about), what it plays against.
   - `behavior`: how kinematics3d moves the body while it plays: `move` (none named) or `jump` (a
     jump, on `"press": "jump"`). A body in the air is moved by kinematics3d's fall, whatever its
     behavior; a motion that plays then says `"when": ["!ground"]`. The jump leaves the ground on its
     clip's takeoff; the rule's `jumpHeld` let go while rising keeps kinematics3d's `jump.cut` of its rise.
   - `then`: a motion of the same activity, or `"<activity>.<motion>"` for one of another (a weapon put
     away, then the next drawn).
   - `add`: laid on top of whatever plays, at its `weight`, from its `over` bone up: a flinch on `"press":
     "hit"` over a run, breathing on `"when": ["!pushed"]`.
   - `warp`: `{ reach, turn }`, an attack bent so its blow lands on the row's `target` (the rule sets it).

   An activity may give `solid` (`{ over, at, facing, points }`) instead of being offered by a station:
   the sides of plain solid boxes offer it, so running into a box vaults it or mantles onto it with no
   space placed. Its `points` stand off the side where the clips measure them (`point { out }`,
   `line { out, down }`, `plane { out }`); the scene names `faces: "shapes3d"` in `world.motion3d.mods`.

   The file's `buffer`, `{ hold, cancel }`, holds keys the rule `queue`s until a move may play them;
   `cancel[<key playing>][<key pressed>]` is when one may cut the one playing: seconds, `"NN%"`, or
   `"strike"`, where the clip's blow lands. A clip of the rig gives `markers`, each a time or a window
   `[from, to]` (`"strike-0.08"`), which `drive` writes to the row's `markers` and `windows`.

   The order matters: ground motions are looked for top to bottom, so a strafe goes above `run` and
   `walk`, and a fast one above the slow one.

4. **Bake.** `yarn bake <game>`. It measures every clip into `<character>.rig.baked.json` and
   writes every clip's offsets into `<character>.motion3d.baked.json`; the bake prints one line per
   clip. Its art goes in the game's commit (committing-a-game).

5. **Look at it.** `yarn dev`, open the game, and do it: press what plays it and move the way it
   goes.

## Example: strafing with the rifle up

- Rig: `rifleidle` (`idle aiming.fbx`), and the eight `walk ...` and eight `run ...` clips of the
  Rifle 8-Way Locomotion pack.
- Sidecars: every one of them `{ "spot": ["LeftFoot", "RightFoot"], "on": "both" }`.
- Motion file, in `walk`:
  - `"aim": { "clips": ["rifleidle"], "over": "Spine", "carry": "rifle" }`: the upper half holds the
    rifle up.
  - `"strafefast"`: the eight run clips, `"target": "triangles", "from": ["aim"], "when": ["ground",
    "pushed", "fast"]`.
  - `"strafe"`: the eight walk clips, `"target": "triangles", "from": ["aim"], "when": ["ground",
    "pushed"]`, above `run` and `walk`.
  - `"strafestand"`: `rifleidle` on the legs too, `"target": "triangles", "from": ["aim"], "when":
    ["ground", "!pushed"]`. A
    clip played over the body from the spine up takes its spine from that clip and its hips from the
    legs' clip. The rifle pack's clips stand with the hips turned about 50° and the spine turned back,
    so the legs under a rifle-pack upper half must play rifle-pack clips too, or the upper body ends up
    turned 50° off.
- Bake.
- The aim limits are the rig's: `"aim": { "across", "up", "down" }`, radians.
- Where the rifle sits: in `demo_motion3d`'s `dev.html`, draw the rifle (G) standing still, open
  `rifle carry`, and press `fit it to the clip's hands`. It puts the rifle's grip where the clip's right
  hand is and turns it until the front grip lines up with the left hand. The readout then says how far
  the spine turns to aim straight ahead (a few degrees is the clip's own sway). Copy the anchor JSON
  into the carry's `anchor`.

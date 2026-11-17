// A place's clips made into what three plays, for world3d's browser half (`world3d.plugin.ts`). Nothing here draws,
// loads or keeps anything: each function is handed what it works on. The place's glb is read and assembled in
// supershader3d's calls by `unpack` and `assemble` (`plugins/supershader3d/supershader3d.glb.ts`), which say how a
// moving thing is skinned and its morph targets laid.
//
// The clips. `played(T, mixer, mesh, unpacked, clips)` makes each clip of the clips file an action on `mixer`, on
// that mesh: a clip of bones made from the glb's animation it names (each channel's keys, linear, onto its bone's
// quaternion or position), a clip of poses made as the morph targets' weights, at each pose's time its target's
// weight 1 and every other 0, so between two poses the two targets blend in a straight line.
//
// A clips file of the wrong shape throws, naming what is wrong: a clip naming an animation the glb has not (a glb
// with no skin has none: an animation moves a joint), posing a target the mesh has not, or with neither an animation
// nor poses.
import type * as THREE from 'three'
import type { Unpacked } from '#plugins/supershader3d/supershader3d.glb.ts'

// The clips file: each moving thing's clips, as its kind wrote them.
export type Clip = {
  about: string; how: string; start: 'on' | 'off'; loop: boolean; seconds: number
  animation?: string; poses?: { time: number; target: number | null }[]
}
export type Clips = { things: { thing: string; kind: string; clips: Record<string, Clip> }[] }

// The effects file's spawns: the effect, and its point and way in the world.
export type Spawn = { effect: string; at: number[]; dir: number[] }

// a clip made: its thing's name, its own, whether it plays from the start, whether it loops, its action
export type Played = { thing: string; clip: string; start: boolean; loop: boolean; action: THREE.AnimationAction }

// Each clip of the clips file on `mixer`, its AnimationClip made from the glb's animation it names or from its poses.
export function played(T: typeof THREE, mixer: THREE.AnimationMixer, mesh: THREE.Mesh, { animations }: Unpacked, clips: Clips): Played[] {
  const bones = (mesh as THREE.SkinnedMesh).skeleton?.bones ?? []
  const targets = mesh.morphTargetInfluences?.length ?? 0
  const out: Played[] = []
  for (const { thing, clips: own } of clips.things) {
    for (const [name, c] of Object.entries(own)) {
      const where = `the clip ${name} of ${thing}`
      const tracks: THREE.KeyframeTrack[] = []
      if (c.animation !== undefined) {
        const a = animations.find(a => a.name === c.animation)
        if (!a) throw new Error(`world3d: ${where} plays the animation ${c.animation}, which the place's glb has not`)
        for (const t of a.tracks) {
          const bone = bones[t.joint].uuid
          if (t.path === 'rotation') tracks.push(new T.QuaternionKeyframeTrack(`${bone}.quaternion`, t.times, t.values))
          else tracks.push(new T.VectorKeyframeTrack(`${bone}.position`, t.times, t.values))
        }
      } else if (c.poses) {
        // each target the poses name: weight 1 at its poses, 0 at every other, a straight line between
        const times = Float32Array.from(c.poses, p => p.time)
        const used = new Set(c.poses.flatMap(p => (p.target === null ? [] : [p.target])))
        for (const i of used) {
          if (i < 0 || i >= targets) throw new Error(`world3d: ${where} poses the target ${i}, and the place's mesh has ${targets}`)
          tracks.push(new T.NumberKeyframeTrack(`.morphTargetInfluences[${i}]`, times, Float32Array.from(c.poses, p => (p.target === i ? 1 : 0))))
        }
      } else {
        throw new Error(`world3d: ${where} has neither an animation nor poses`)
      }
      const clip = new T.AnimationClip(`${thing} ${name}`, c.seconds, tracks)
      out.push({ thing, clip: name, start: c.start === 'on', loop: c.loop, action: mixer.clipAction(clip) })
    }
  }
  return out
}

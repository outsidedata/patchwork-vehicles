# Changelog

## 2026-11-06-b6183dd

- supershader3d — any material can read the extra numbers its model carries on each vertex, not only a wall's.
- yarn workshop — a new command: opens the asset, UI or particle workshop for a game, or the pose lab.

## 2026-11-04-d3098a9

- lod3d — a new plugin: fills a landscape with thousands of trees, grass, rocks and anything else, round the camera, solid to walk, shoot and drive against.
- instances3d — a new plugin: draws many copies of the same thing in one go, from a forest to a pile of crates.
- supershader3d — a new plugin: gives every surface of a scene the library's materials through one shader.
- scatter3d — removed; lod3d takes its place.
- scripts/scatter3d-to-lod3d.ts — moves a game's scenes from scatter3d to lod3d.
- box3dvehicle — cars can have independent suspension, and there is a UTV to drive.
- shapes3d — static shapes can come from files as well as the scene.
- solids — draws shapes from files too, and paints any solid with a library material.
- terrain3d — a ground layer can be painted with a library material.
- nav3d — routes are found many times faster.
- asset workshop — plays a model's own animation clips.
- yarn bake — bakes the library materials a scene uses into the game.
- yarn publish_gh_pages_game — a published game's repo now holds the whole game, including files added later.
- connecting-plugins-using-mods skill — explains how plugins hand each other their work, and checks whether a plugin does it that way.

## 2026-11-01-6c4ac40

- yarn dev — serves every game, with a home page linking each game's pages and scenes.
- yarn serve — runs a game's server beside its pages and restarts it on every change.
- yarn new-game — a new game comes with a dev page and a frame-rate counter.
- benchmarkPage — a page to look at and compare a game's benchmark runs.
- crowd3d — a new plugin: hundreds of animated people walking, standing and holding things, cheap to draw.
- npc3d — a new plugin: characters that see, hear, remember and choose what to do.
- nav3d — a new plugin: pathfinding over a map of the level, across any kind of connection.
- shapes3d — a new plugin: floors, walls, ramps, paths and moving platforms that bodies stand on, walk and collide with.
- kinematics3d — a new plugin: moves a body over the ground, along paths and onto whatever it stands on.
- motion3d — a new plugin: a character plays its animations in place against ledges, walls, seats and anything else in the world.
- melee3d — characters can fight with swords.
- anim — characters hold poses, and a clip can be nudged into place as it is baked.
- walker — big crowds walk cheaply and steer round trees and other fixed things.
- terrain3d — characters find their way across the land.
- scatter3d — boulders and other scattered models sit partly buried, each a little different.
- box3d — shapes stand in the physics world as solid floors, walls and ramps.
- solids — faces can be painted with a picture.
- hitscan3d — shots hit shapes and characters.
- cover3d — characters take cover behind shapes.
- cutscene — a game can add cutscene steps of its own, edit its cutscenes on the dev page, and covers the screen until a shot is ready.
- ui — no flash of a bare frame or wrong font before the HUD first draws, and button labels can be nudged.
- loader — loads fonts.
- player — a gamepad button only counts as pressed past a deadzone.
- ragdoll3d — a scene names which kinds go limp as ragdolls.
- box3dvehicle — cars can start moving, aim and switch their headlights, and throw dust that lands on the ground.
- particle3d — effects can swirl, and speed up or throw harder while they run.
- ocean3d — waves cast shadows, and smoke and spray draw over the sea.
- workshop — tune particles, the HUD and poses live, and check a body's moves against a level.
- asset-workshop skill — covers the workshop's new pages.
- people-in-a-scene skill — a new skill: choosing and setting up characters and crowds in a scene.
- using-motion3d skill — a new skill: making characters move with motion3d.
- using-the-dev-page skill — a new skill: everything a game's dev page can do.
- tuning-particles skill — a new skill: tuning a game's effects.
- numerically-solving-balance skill — a new skill: balancing a game by playing its rules many times.
- patchwork-game-design-flowchart skill — a new skill: how a game's things connect.
- prime-directive skill — says where each new thing a game needs goes.
- building-a-plugin skill — covers where a game's logic goes and how a game adds its own kinds of thing to a plugin.
- connecting-plugins-using-mods skill — covers adding new kinds of thing to a plugin.
- building-a-cutscene-intro skill — covers adding cast members and shots seen through a character's eyes.
- building-the-hud skill — covers the UI workshop.
- benchmarking-a-game skill — shows where every millisecond goes.
- guide-to-smooth-gameplay skill — covers keeping things that ride a moving object smooth.
- using-terrain3d skill — finds the ground's height at any point.
- making-3d-assets-in-blender skill — catches overlapping faces reliably.

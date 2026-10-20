# vehicles

A physics driving game for the browser, built on [Patchwork](https://github.com/outsidedata/patchwork).

Play it: https://outsidedata.github.io/patchwork-vehicles/

- Three cars on Box3D physics with a suspension of their own: a golf cart, a jeep and a monster truck
- Get out and walk, run, and get into any free car
- Places to drive: the plains with a dirt road through firs, grass and boulders, a stylized version
  of the plains in flat colours, rolling desert dunes, and a test track with whoops, a washboard,
  ditches, a bowl, a bank, ramps, a drag strip and patches of grass, mud, gravel and ice
- A ball to knock about
- An intro cutscene and a title in 3D
- Two players together on a server
- Gamepad rumble on landings and crashes

## Controls

| action | keyboard | gamepad |
|---|---|---|
| throttle, and brake or reverse | ↑ ↓ or W S | right and left triggers |
| steer | ← → or A D | d-pad or left stick |
| brake | Space | bottom button |
| walk and turn, on foot | arrows or W A S D | d-pad or left stick |
| run, on foot | Shift | right button |
| get in or out of a car | E or F | top button |
| move to the next free car | V | left button |
| look round | | right stick |
| menu of where to drive | Escape | start |

## Run it

```
yarn install
yarn vite
```

Open `http://localhost:5173/games/vehicles/index.html` to play in one tab.

For two players, run the server from the repo's root:

```
node --experimental-strip-types games/vehicles/vehicles.server.ts
```

and open `http://<your address>:5173/games/vehicles/client.html`, one window a player.

## Build the static site

```
yarn produce_static_site vehicles --base /patchwork-vehicles/
```

writes the playable site to `dist/`. Every push to `master` runs it on GitHub Actions and publishes
`dist/` to GitHub Pages.

## Licence

MIT, Copyright (c) 2026 Outside Data.

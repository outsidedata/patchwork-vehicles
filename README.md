# vehicles

A physics driving game for the browser, built on [Patchwork](https://github.com/outsidedata/patchwork).

Play it: https://outsidedata.github.io/patchwork-vehicles/

- Five cars on Box3D physics with a suspension of their own: a golf cart, a jeep, a monster truck,
  a long-travel UTV on independent suspension, and the Apollo lunar rover, steering all four wheels
- Start in the jeep, and move to any free car
- Places to drive: the plains with a dirt road through firs, grass and boulders, rolling desert dunes, the cratered moon under a black sky at a
  sixth of Earth's gravity, and a test track with whoops, a washboard,
  ditches, a bowl, a bank, ramps, a drag strip and patches of grass, mud, gravel and ice
- Day pads, three glowing columns side by side on the road and the test track, each with a clock showing its hour: drive into one and it sets the time of day and the headlights
- A ball to knock about
- A title in 3D, over a jeep driving the desert
- Two players together on a server
- Gamepad rumble on landings and crashes

## Controls

| action | keyboard | gamepad |
|---|---|---|
| throttle, and brake or reverse | ↑ ↓ or W S | right and left triggers |
| steer | ← → or A D | d-pad or left stick |
| brake | Space | bottom button |
| swap to the next free car, made at its start | Tab | left button |
| headlights | L | |
| back on its wheels | P | |
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

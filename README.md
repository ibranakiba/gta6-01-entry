# Crown Bay — an open-world crime game

**Crown Bay** is a complete open-world crime game in the spirit of GTA 6, built
for the make.fun `gta6-01` bounty. It runs offline in a desktop browser from
static files — no network request, no build step. Open `game/index.html` (or
serve the repo and visit `http://localhost:8080`) and play.

## The game

Rook arrives in Crown Bay with nothing but a name and a debt. The fixer Marla
Voss has five jobs: steal a car, run a package, meet a contact at Club Lumen,
lose a three-star police chase, and rob Meridian Bank before flying out in a
helicopter from the Crown Spire roof.

- **A living city** — Crown Bay is a 10×10 block grid in three districts:
  Meridian Heights (downtown towers), Maplewood (houses and gardens) and
  Harborlight (beach, port, casino strip). 28 named landmarks, from City Hall
  to the Starlight Cinema, each with its own sign and storefront.
- **On foot and by car** — walk, run, jump, or steal any of 20 vehicle types:
  sedan, hatchback, SUV, pickup, van, box truck, taxi, CBPD cruiser, ambulance,
  sports coupe, muscle car, convertible, limousine, city bus, off-road jeep,
  motorbike, sports bike, bicycle — plus a flyable helicopter and prop plane
  (helipad on the Crown Spire roof, runway at Crown Bay Airfield).
- **Traffic and pedestrians** — traffic follows the road grid and stops at red
  lights; pedestrians are all different (build, clothes, walk speed, behaviour:
  strolling, chatting, waiting at crosswalks, fleeing gunfire). Dogs with owners
  and strays, cats, birds that flock and perch, fish that swim and leap in the bay.
- **Wanted system and police** — crime in sight raises your heat; CBPD cruisers
  chase and ram, officers chase on foot, and a slow player who stays close gets
  busted. Lose the heat to drop the stars.
- **Missions and story** — five story missions with live objective markers,
  cash rewards, and a "Crown Bay Legend" ending. Progress and cash save to
  localStorage; a saved game can be continued from the title screen.
- **Combat** — a pistol with ammo and reload, hitscan shooting, muzzle flash,
  and wanted heat for shooting in public.
- **HUD and minimap** — cash, health, wanted stars, clock and weather, mission
  objective, speedometer, and a live minimap drawn from the real street grid
  (press M for a big map).
- **Nightlife** — Club Lumen: a real interior with a dance floor, bar, DJ booth,
  mirror ball, coloured spotlights, dancing NPCs and a procedural club loop.
  The Golden Anchor casino and The Rusty Anchor bar are on the strip too.
- **Realism, everywhere** — traffic lights cycle red/yellow/green, pedestrians
  cross at crosswalks, cars have headlights, brake lights and indicators,
  horns and engine sounds, a full day cycle (morning, midday, evening, night),
  rain with wet, slippery roads, and trees (palm, oak, pine) that sway with
  leaves drifting down.

## Controls

| Key | Action |
| --- | --- |
| W A S D | Walk / drive |
| Mouse | Look around (click to lock) |
| Shift | Run / boost |
| E | Enter / exit vehicle |
| F or Left Click | Shoot |
| R | Reload |
| H | Horn |
| Space | Jump / handbrake |
| M | Big map |
| P / Esc | Pause |

Touch: left half is a virtual joystick, right half drags the camera, with
on-screen E / shoot / horn buttons.

## Sound

All sound is procedural WebAudio — engine hum, sirens, horns, gunshots, cash,
rain, city hum, and the Club Lumen loop. No audio files. Sound starts on the
first click or keypress.

## Files

- `game/index.html` — the game page and HUD
- `game/src/config.js` — tuning, districts, landmarks, vehicles, missions
- `game/src/random.js` — seeded random (one seed = one city)
- `game/src/input.js` — keyboard, mouse and touch
- `game/src/audio.js` — procedural WebAudio
- `game/src/city.js` — the city, landmarks, traffic lights, trees, club interior
- `game/src/vehicles.js` — vehicle factory, arcade driving, traffic AI, flight
- `game/src/peds.js` — pedestrians, animals, birds, fish, club dancers
- `game/src/player.js` — Rook on foot and the pistol
- `game/src/police.js` — wanted levels and the CBPD
- `game/src/missions.js` — the five story jobs
- `game/src/weather.js` — day cycle and rain
- `game/src/effects.js` — particles and screen shake
- `game/src/hud.js` — HUD and live minimap
- `game/src/world.js` — the game: screens, camera, save, club, all systems
- `game/src/render.js` — the three.js renderer and camera
- `game/src/shots.js` — the `?shot=` scenes for the dossier screenshots
- `game/src/main.js` — boot and the fixed-step loop
- `game/vendor/three/` — three.js r187 (MIT), vendored
- `main.ts` — the entry program: copies `game/` and `screenshots/` to
  `/output` and writes `dossier.json`
- `serve.ts` — a tiny static server for local play (`node serve.ts`)

## Screenshots

`shots.json` maps the four dossier screenshots to staged scenes:
`?shot=start`, `?shot=play`, `?shot=chase`, `?shot=club` (each with
`&seed=1`). Every shot plays the real game forward from a fresh world, so
each frame is what actual play looks like.

## Licence

MIT — see `LICENSE`. Everything in Crown Bay is original: the city, names,
characters, story, art and sound. Nothing from Rockstar Games or any other
commercial game.
Crown Bay — README rewritten in recorded session fix7, 18 Nov 2026.

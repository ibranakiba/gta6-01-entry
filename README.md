# Crown Bay

An open-world crime game in the browser: one city, one long night, and
a newcomer called Rook trying to make a name for himself. Steal cars,
outrun the CBPD, take jobs from the fixer Marla Voss, and see the whole
story through — or end up wasted, busted, or a Crown Bay legend.

Everything is original: the city, the names, the story, the art. No
real brands, no borrowed characters. Built with three.js, plain
JavaScript, and no build step — open it and play.

## The city

Crown Bay is a 10×10-block city on the water, in three districts:

- **Meridian Heights** — downtown towers, led by the 150 m Crown Spire.
- **Maplewood** — quiet residential streets, houses, gardens, parks.
- **Harborlight** — the waterfront: the beach, the port, the pier.

Around them: the Harbor Bridge out to Lighthouse Island, Crown Beach
with its umbrellas and lifeguard tower, Crown Pier and its ferris
wheel, the Crown Bay Airfield with a runway, and Club Lumen — the
nightclub where the city's nightlife lives. Sixty cars drive the
streets, 130 pedestrians walk them, and dogs, cats, birds and fish
keep the place feeling alive.

## The story

Rook is new in town and broke. Marla Voss, the fixer, has five jobs
for him — each one a little bigger and a little riskier than the last:

1. **First Wheels** — take a car, any car, and bring it to Crown Motors.
2. **Coffee Run** — a package at The Daily Grind, delivered to Meridian Bank.
3. **Club Lumen** — hear the next job where Marla holds court.
4. **Rooftop Pickup** — a helicopter is waiting on the Crown Spire roof.
5. **The Big Score** — cross the Harbor Bridge and take the shipment at Port Crown.

Finish all five and the Big Score is yours. Get wasted or busted
along the way and you start over — keeping half your cash if the
police catch you.

## Controls

| Key | What it does |
| --- | --- |
| W / A / S / D or arrows | Move / drive / steer |
| Shift | Run (on foot) / boost (driving) |
| Mouse drag | Look around (click to lock the pointer) |
| E | Enter or exit a vehicle (or step into Club Lumen) |
| F or left click | Shoot |
| R | Reload |
| Space | Jump (on foot) / handbrake (driving) |
| H | Horn |
| M | Big map / small map |
| P or Esc | Pause |
| Enter | Start, continue, retry |

Cars, bikes, helicopters and a plane are all stealable and drivable:
walk up to one and press E. Helicopters lift off from rooftops and
the airfield; the plane needs the runway. The red CBPD patrol
helicopter is the exception — it has a pilot, a searchlight, and no
interest in being stolen.

## Wanted

Steal a car in front of witnesses, shoot a pedestrian, or hit an
officer, and the CBPD comes for you. The wanted stars climb, cruisers
chase, and the patrol heli breaks off its loop to hunt you with its
searchlight. Lose them, lay low, and the heat fades — or get busted
and lose half your cash.

## Weather and time

A full day runs from morning to night, with the sky, the street
lights and the headlights following it. Rain comes and goes; when it
rains the roads get slick, the spray rises, and the city looks
different under the headlights. Every window in the towers glows
warm yellow after dark. The minimap in the corner follows the same
city you are driving through — streets, bridge, pier and all — with
a pink dotted line leading you to your next objective.

## How to play

Serve the `game/` folder and open it in a desktop browser:

```sh
node serve.ts
# then open http://localhost:8080
```

Chrome or Safari 16.4+ recommended. The game saves automatically:
cash, missions, health, position and time of day all wait for you
when you come back.

## Screenshots

The entry's pictures are staged from the game itself — add
`?shot=start`, `?shot=play`, `?shot=chase`, `?shot=end` or
`?shot=club` (with `&seed=1`) to the URL to jump straight to a scene.

## License

MIT — see `LICENSE`.

// Crown Bay — the staged scenes for the entry's pictures. The judge
// (and the ?shot= links) ask for one of these by name; each one puts
// the game into a chosen moment — title, a daytime drive, a night
// chase in the rain, the game-over screen, the club — and then the
// harness steps the world forward a little and takes the picture.
//
// Staging only uses the game's public surface (startGame, endGame,
// enterVehicle, the player/police/weather/city objects the game
// returns). Nothing here reaches into a module's internals, so a
// scene keeps working when the systems behind it change.
export const SHOT_NAMES = ['start', 'play', 'chase', 'end', 'club'];

function nearestParkedCar(game, x, z) {
  let best = null;
  let bd = Infinity;
  for (const v of game.vehicles) {
    if (v.police || v.traffic) continue;
    // Stage the player in a real car: bikes, helis and planes are
    // parked around the city too, and a chase staged on a bicycle
    // reads as a bug, not a getaway.
    if (v.def.kind === 'bike' || v.def.kind === 'heli' || v.def.kind === 'plane') continue;
    const d = Math.hypot(v.x - x, v.z - z);
    if (d < bd) { bd = d; best = v; }
  }
  return best;
}

function putPlayerInCar(game, x, z) {
  const car = nearestParkedCar(game, x, z);
  if (!car) return;
  game.player.x = car.x;
  game.player.z = car.z;
  game.enterVehicle(car);
  // Point the car down the street so the settled frame reads as a
  // drive, not a parked car: head along the nearest street line.
  car.heading = 0;
  car.speed = 16;
}

function stageStart(game) {
  // The title screen: a fresh reset, the camera orbiting the city
  // behind the title (the world does that on its own while the
  // screen is the title screen).
  game.reset();
  game.weather.timeHours = 17.2;
}

function stagePlay(game) {
  game.reset();
  game.startGame(false);
  game.weather.timeHours = 13.5;
  game.player.x = -87;
  game.player.z = 122;
  putPlayerInCar(game, game.player.x, game.player.z);
  game.state.camYaw = 0;
}

function stageChase(game) {
  game.reset();
  game.startGame(false);
  // Night, rain, three wanted stars: the police close in on their own
  // once the wanted level is set — no need to place them by hand.
  // Wanted reads off heat (3 stars needs heat 55+), so set the heat,
  // not just the level — the step recomputes the level from heat and
  // would otherwise drop it straight back to zero.
  game.weather.timeHours = 21.6;
  game.weather.weather = 'rain';
  game.weather.raining = true;
  game.police.heat = 70;
  game.police.wanted = 3;
  game.player.x = -58;
  game.player.z = -58;
  putPlayerInCar(game, game.player.x, game.player.z);
  game.state.camYaw = 0;
}

function stageEnd(game) {
  game.reset();
  game.startGame(false);
  game.player.cash = 2450;
  game.missions.done = ['first-wheels', 'coffee-run'];
  game.endGame('wasted');
}

function stageClub(game) {
  game.reset();
  game.startGame(false);
  game.weather.timeHours = 22.4;
  // Walk the player to the club door; the world's own door logic
  // (a few steps away) swings the interior open and wakes the dancers.
  // Stand inside the door's 3.5 m trigger radius so the settle steps
  // walk the player through it on their own.
  const door = game.city.clubDoor;
  if (door) {
    game.player.x = door.x;
    game.player.z = door.z + 2;
    game.state.camYaw = Math.PI;
  }
}

const STAGERS = {
  start: stageStart,
  play: stagePlay,
  chase: stageChase,
  end: stageEnd,
  club: stageClub,
};

export function stageShot(game, name) {
  const stage = STAGERS[name];
  if (!stage) return false;
  stage(game);
  return true;
}

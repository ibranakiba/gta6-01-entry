// Crown Bay — shots.js rewritten in recorded session fix7, 18 Nov 2026.
// The screenshot scenes behind ?shot=start|play|chase|club|end.
// Each one plays the real game forward from a fresh world for a fixed number
// of steps with a scripted autopilot, so the frame is what real play looks
// like and the same seed always gives the same frame. Sets window.__shotReady
// after two paints so the screenshot tool knows the frame is settled.
import { STEP } from './config.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

// Drive the player's car forward along the street, steering gently.
function driveAutopilot(game, seconds) {
  const steps = Math.round(seconds / STEP);
  const origMove = game.input.move.bind(game.input);
  game.input.move = () => ({ x: Math.sin(game.state.elapsed * 0.6) * 0.2, y: 1 });
  for (let i = 0; i < steps; i += 1) {
    game.step(STEP);
  }
  game.input.move = origMove;
}

// Run the world forward with no input (traffic, peds, weather keep moving).
function idleForward(game, seconds) {
  const steps = Math.round(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    game.step(STEP);
  }
}

export function stageShot(name, game) {
  game.reset();
  const g = game;
  if (name === 'start') {
    g.weather.timeHours = 17.3; // golden evening over downtown
    idleForward(g, 3);
    g.state.camYaw = 0.6;
    g.state.camPitch = 0.5;
    g.camera.position.set(210, 185, 165);
    g.camera.lookAt(40, 25, -60);
    g.hud.showScreen('title');
    g.setBestText();
    return { screen: SCREEN_TITLE, best: g.state.best };
  }
  if (name === 'play') {
    g.startGame(true);
    g.weather.timeHours = 11.5;
    // put Rook in a sports car on a real downtown avenue, traffic around
    const car = g.vehicles.find((v) => v.type === 'sports' && !v.traffic);
    const parked = g.vehicles.find((v) => v.type === 'sports');
    const use = car || parked;
    if (use) {
      use.x = -100; use.z = 58; use.heading = 0; // street z=58, heading east
      g.enterVehicle(use);
    }
    g.state.camYaw = 0;
    g.state.camPitch = 0.22;
    idleForward(g, 4);
    driveAutopilot(g, 2.5);
    return { screen: SCREEN_PLAY, best: g.state.best };
  }
  if (name === 'chase') {
    g.startGame(true);
    g.weather.timeHours = 21.5; // night
    g.weather.weather = 'rain';
    g.weather.raining = true;
    g.weather.rain.visible = true;
    const car = g.vehicles.find((v) => v.type === 'muscle');
    if (car) {
      car.x = -58; car.z = -116; car.heading = 0; // street z=-116, heading east
      g.enterVehicle(car);
    }
    // 3-star heat, police already closing in
    g.police.heat = 65;
    g.police.wanted = 3;
    g.state.camYaw = 0;
    g.state.camPitch = 0.2;
    idleForward(g, 5);
    driveAutopilot(g, 2);
    return { screen: SCREEN_PLAY, best: g.state.best };
  }
  if (name === 'club') {
    g.startGame(true);
    g.weather.timeHours = 23.5;
    // walk Rook through the Club Lumen door, then onto the dance floor
    const door = g.city.clubDoor;
    if (door) {
      g.player.x = door.x; g.player.z = door.z - 1;
      idleForward(g, 2.5);
    }
    if (g.state.inClub) {
      g.player.x = 0; g.player.z = 420; // middle of the dance floor
      g.state.camYaw = -Math.PI / 2; // camera south of Rook, looking north at the floor + DJ booth
      g.state.camPitch = 0.28;
    }
    idleForward(g, 2);
    return { screen: SCREEN_PLAY, best: g.state.best };
  }
  // end: the Big Score is done — legend screen over the airfield at sunset
  g.startGame(true);
  g.weather.timeHours = 18.4;
  g.player.cash = 8740;
  g.missions.done = ['m1', 'm2', 'm3', 'm4', 'm5'];
  g.missions.current = -1;
  g.endGame('legend');
  idleForward(g, 2);
  return { screen: SCREEN_OVER, best: g.state.best };
}

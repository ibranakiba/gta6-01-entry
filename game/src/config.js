// fix9
// Crown Bay — the shared tuning table for the whole game. Every system
// reads its numbers from here, so the city, the cars, the missions and the
// player all agree on the same Crown Bay: the same streets, the same
// districts, the same prices. Change a value here and the whole game
// follows — no magic numbers scattered through the modules.

// --- the map ------------------------------------------------------------
export const CITY = {
  half: 290, // the city runs from -290 to +290 on both axes
  seaX: 292, // east of this line the bay begins (the bridge crosses it)
  road: 14, // road surface width; the centre line sits in the middle
  beachX: 290, // where the sand strip starts on the eastern edge
  block: 44, // one city block, edge to edge (road starts past it)
  pitch: 58, // block + road: the distance between street centre lines
};

// Streets run on a 58 m pitch: 14 m of road + 44 m of block. Eleven
// centres make ten blocks a side, which is the whole 10x10 city.
export const STREET_CENTERS = [-290, -232, -174, -116, -58, 0, 58, 116, 174, 232, 290];

// Building heights per district. Downtown towers stretch the tallest;
// waterfront blocks stay lower so the bay stays visible from the streets.
export const DISTRICTS = {
  downtown: { minH: 30, maxH: 90 },
  residential: { minH: 6, maxH: 14 },
  waterfront: { minH: 12, maxH: 38 },
};

// Landmarks are placed by block (bx, bz count 0..9 from the north-west
// corner). `kind` picks the shape the city builder gives the block:
// a spire, a park, a beach, a port, an airfield, a hospital, or one of
// the shops and venues that make the city feel lived in.
export const LANDMARKS = [
  { bx: 5, bz: 4, name: 'Crown Spire', h: 150, kind: 'spire' },
  { bx: 4, bz: 4, name: 'City Hall', h: 24, kind: 'hall' },
  { bx: 6, bz: 3, name: 'CBPD HQ', h: 22, kind: 'police' },
  { bx: 3, bz: 5, name: 'St. Marina General Hospital', h: 20, kind: 'hospital' },
  { bx: 0, bz: 9, name: 'Crown Bay Airfield', h: 10, kind: 'airfield' },
  { bx: 7, bz: 6, name: 'Bayfront Arena', h: 26, kind: 'arena' },
  { bx: 2, bz: 7, name: 'Meridian Park', h: 4, kind: 'park' },
  { bx: 9, bz: 6, name: 'Crown Beach', h: 2, kind: 'beach' },
  { bx: 9, bz: 2, name: 'Port Crown', h: 12, kind: 'port' },
  { bx: 6, bz: 5, name: 'Club Lumen', h: 18, kind: 'club' },
  { bx: 4, bz: 6, name: 'Sunny Side Diner', h: 10, kind: 'diner' },
  { bx: 5, bz: 6, name: 'The Daily Grind Coffee', h: 10, kind: 'coffee' },
  { bx: 3, bz: 3, name: 'Fresh Mart', h: 12, kind: 'mart' },
  { bx: 6, bz: 4, name: 'Slice House Pizza', h: 10, kind: 'pizza' },
  { bx: 4, bz: 3, name: 'Byte & Brew Café', h: 10, kind: 'cafe' },
  { bx: 7, bz: 4, name: 'Crown Bay Galleria', h: 30, kind: 'mall' },
  { bx: 5, bz: 3, name: 'Meridian Bank', h: 26, kind: 'bank' },
  { bx: 2, bz: 4, name: "Wheel Works Auto", h: 10, kind: 'mechanic' },
  { bx: 7, bz: 7, name: 'Crown Motors', h: 12, kind: 'dealer' },
  { bx: 1, bz: 5, name: 'Turbo Fuel', h: 8, kind: 'gas' },
  { bx: 8, bz: 4, name: 'Harborview Hotel', h: 34, kind: 'hotel' },
  { bx: 2, bz: 8, name: 'The Driftwood Motel', h: 10, kind: 'motel' },
  { bx: 6, bz: 6, name: 'Starlight Cinema', h: 14, kind: 'cinema' },
  { bx: 3, bz: 6, name: 'Ink & Iron Tattoo', h: 10, kind: 'tattoo' },
  { bx: 7, bz: 3, name: 'Liberty Firearms', h: 10, kind: 'firearms' },
  { bx: 4, bz: 7, name: 'Crown Bay Museum', h: 20, kind: 'museum' },
  { bx: 1, bz: 7, name: 'Crown Bay University', h: 22, kind: 'university' },
  { bx: 8, bz: 6, name: 'The Rusty Anchor', h: 10, kind: 'bar' },
  { bx: 7, bz: 5, name: 'The Golden Anchor', h: 22, kind: 'casino' },
];

// --- the sky and the streets --------------------------------------------
export const PALETTE = {
  skyDay: 0x87b5d9,
  skyNight: 0x141e35,
  skySunset: 0xef7a6e,
  sunDay: 0xfff2d8,
  fogDay: 0x9db8cc,
  fogNight: 0x141e35,
  grass: 0x4d8a3d,
  road: 0x383d44,
  roadLine: 0xd9c24a,
  sidewalk: 0x9c948a,
  water: 0x147a9e,
};

// Warm yellow only: at night the lit windows glow amber, the way the
// city looked before the brief multicolour experiment.
export const WINDOW_GLOW = ['#ffd98a', '#ffe9b8', '#ffb35a', '#ffcf6e', '#ffd98a', '#ffdf9e'];

// --- vehicles ------------------------------------------------------------
// top is metres per second, accel is m/s^2, len/wid are metres, grip is
// 1.0 on dry asphalt. `kind` drives the physics branch: car, bike, heli
// or plane. Colours are the paint jobs the city spawns for each type.
export const VEHICLE_TYPES = {
  sedan: { kind: 'car', label: 'Sedan', colors: [0x3a3a46, 0x7a2e2e, 0x2e4a6a, 0xc8c8c8, 0x3c5a3c], top: 38, accel: 11, len: 4.6, wid: 1.9, grip: 0.95 },
  hatchback: { kind: 'car', label: 'Hatchback', colors: [0xe86a2e, 0x2e7a6a, 0xd8d8d8, 0x6a4a8a, 0xc23c5a], top: 36, accel: 12, len: 4.0, wid: 1.8, grip: 0.95 },
  suv: { kind: 'car', label: 'SUV', colors: [0x2a2a2e, 0x4a5a2e, 0x8a2e2e, 0xd8d8d8, 0x2e3a5a], top: 35, accel: 10, len: 4.9, wid: 2.0, grip: 0.9 },
  pickup: { kind: 'car', label: 'Pickup', colors: [0x46464f, 0x7a4a2e, 0x2e5a3a, 0x8a8a8a, 0x5a2e2e], top: 34, accel: 10, len: 5.2, wid: 2.0, grip: 0.9 },
  van: { kind: 'car', label: 'Van', colors: [0xd8d8d8, 0x4a6a8a, 0x8a7a4a, 0x5a5a5a, 0x2e4a4a], top: 32, accel: 9, len: 5.0, wid: 2.1, grip: 0.88 },
  truck: { kind: 'car', label: 'Truck', colors: [0x8a2e2e, 0x2e4a6a, 0xd8d8d8, 0x5a5a5a, 0x6a5a2e], top: 28, accel: 7, len: 7.5, wid: 2.4, grip: 0.85 },
  taxi: { kind: 'car', label: 'Taxi', colors: [0xf2c200], top: 38, accel: 11, len: 4.6, wid: 1.9, grip: 0.95 },
  police: { kind: 'car', label: 'CBPD Cruiser', colors: [0x20262f], top: 46, accel: 14, len: 4.8, wid: 2.0, grip: 1.0 },
  ambulance: { kind: 'car', label: 'Ambulance', colors: [0xf2f2f2], top: 42, accel: 12, len: 5.4, wid: 2.1, grip: 0.95 },
  sports: { kind: 'car', label: 'Sports Car', colors: [0xc8102e, 0xe86a10, 0xd83c8a, 0x2ad8a8, 0xf2d200], top: 55, accel: 18, len: 4.4, wid: 1.9, grip: 1.0 },
  muscle: { kind: 'car', label: 'Muscle Car', colors: [0x28282f, 0x8a1a1a, 0x2a4a2a, 0xd8b83c, 0x4a2a6a], top: 50, accel: 16, len: 4.8, wid: 2.0, grip: 0.92 },
  convertible: { kind: 'car', label: 'Convertible', colors: [0xe84a7a, 0x2ab8d8, 0xf2e8c8, 0x8a2a5a, 0x3c8a5a], top: 48, accel: 15, len: 4.4, wid: 1.9, grip: 0.95 },
  limo: { kind: 'car', label: 'Limousine', colors: [0x24242e, 0x2e2e3c], top: 36, accel: 9, len: 7.2, wid: 2.0, grip: 0.9 },
  bus: { kind: 'car', label: 'Bus', colors: [0x2a6a4a, 0xd8a83c, 0x3a5a8a, 0x8a3a3a], top: 30, accel: 7, len: 9.5, wid: 2.5, grip: 0.85 },
  jeep: { kind: 'car', label: 'Jeep', colors: [0x4a5a2e, 0x6a4a2e, 0x3a3a3a, 0x7a7a5a], top: 36, accel: 11, len: 4.3, wid: 1.9, grip: 1.0 },
  sportbike: { kind: 'bike', label: 'Sports Bike', colors: [0xc8102e, 0x2a6ad8, 0xe8e8e8, 0x1a1a1a], top: 60, accel: 22, len: 2.2, wid: 0.7, grip: 0.9 },
  motorbike: { kind: 'bike', label: 'Motorbike', colors: [0x3a3a3a, 0x6a2a2a, 0x2a4a6a, 0x8a6a2a], top: 42, accel: 16, len: 2.1, wid: 0.7, grip: 0.9 },
  bicycle: { kind: 'bike', label: 'Bicycle', colors: [0xd83c3c, 0x3c8ad8, 0x3cd85a, 0xe8d83c], top: 9, accel: 5, len: 1.9, wid: 0.6, grip: 1.0 },
  helicopter: { kind: 'heli', label: 'Helicopter', colors: [0xd8d8d8, 0xc8102e], top: 32, accel: 10, len: 6.5, wid: 2.2, grip: 1.0 },
  plane: { kind: 'plane', label: 'Plane', colors: [0xd8d8d8, 0x3a5a8a], top: 45, accel: 9, len: 9.0, wid: 10.5, grip: 1.0 },
};

export const VEHICLE_TYPE_NAMES = Object.fromEntries(
  Object.entries(VEHICLE_TYPES).map(([key, def]) => [key, def.label]),
);

// --- the player ----------------------------------------------------------
export const PLAYER = {
  health: 100,
  walk: 5.2,
  run: 8.6,
  jump: 7.5,
  ammo: 12,
  ammoReserve: 36,
};

// Fixed simulation step (seconds) and the most a single frame may advance
// the world — headless runs can be slow, and a huge dt would teleport cars.
export const STEP = 1 / 60;
export const MAX_DT = 0.25;

// --- saves ---------------------------------------------------------------
export const SAVE_KEY = 'crown-bay-save-v1';
export const BEST_KEY = 'crown-bay-best-v1';

// --- the story -----------------------------------------------------------
// Five jobs for Marla Voss. Each step is one objective; `type` tells the
// mission runner how to tell when it is done, `at` names a landmark from
// the map (resolved at runtime), and `reward` is paid in cash.
export const MISSIONS = [
  {
    id: 'first-wheels',
    title: 'First Wheels',
    briefing: 'Marla needs wheels. Take any car on the street — try not to get seen.',
    reward: 800,
    steps: [
      { text: 'Get in any vehicle (press E near one)', type: 'vehicle' },
      { text: 'Drive to Crown Motors', type: 'goto', at: 'Crown Motors' },
    ],
  },
  {
    id: 'coffee-run',
    title: 'Coffee Run',
    briefing: 'A package is waiting at The Daily Grind. Pick it up, no questions.',
    reward: 1200,
    steps: [
      { text: 'Drive to The Daily Grind Coffee', type: 'goto', at: 'The Daily Grind Coffee' },
      { text: 'Bring it back to Meridian Bank', type: 'goto', at: 'Meridian Bank' },
    ],
  },
  {
    id: 'club-lumen',
    title: 'Club Lumen',
    briefing: 'Marla is holding court at Club Lumen tonight. Go and hear the next job.',
    reward: 1500,
    steps: [
      { text: 'Drive downtown to Club Lumen', type: 'goto', at: 'Club Lumen' },
      { text: 'Step inside Club Lumen (press E at the door)', type: 'club' },
    ],
  },
  {
    id: 'rooftop-pickup',
    title: 'Rooftop Pickup',
    briefing: 'A heli is waiting on the Crown Spire roof. Get up there and take it.',
    reward: 2500,
    steps: [
      { text: 'Reach the Crown Spire helipad', type: 'helipad' },
      { text: 'Fly the helicopter to Crown Bay Airfield', type: 'goto', at: 'Crown Bay Airfield' },
    ],
  },
  {
    id: 'big-score',
    title: 'The Big Score',
    briefing: 'One last run: the shipment is at Port Crown. Cross the Harbor Bridge and take it.',
    reward: 5000,
    steps: [
      { text: 'Cross the Harbor Bridge', type: 'goto', at: 'Harbor Bridge' },
      { text: 'Reach Port Crown and finish the job', type: 'goto', at: 'Port Crown' },
    ],
  },
];

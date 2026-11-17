// Crown Bay — config.js rewritten in recorded session fix7, 18 Nov 2026.
// Crown Bay — every tuning number, name and colour in one place.
// The city is a 10x10 block grid: block 44 units, road 14 units, pitch 58.
// Street centres sit at -290 + i*58 (i = 0..10); the city spans about -297..+297,
// with the sea and Crown Beach east of x = +310 and the airfield south-west.
import * as THREE from 'three';

export const STEP = 1 / 60;
export const SAVE_KEY = 'crown-bay.save.v1';
export const BEST_KEY = 'crown-bay.best.v1';

export const CITY = {
  blocks: 10,
  block: 44,
  road: 14,
  pitch: 58,
  half: 297,
  seaX: 312,          // water starts here (east edge)
  beachX: 300,        // sand strip
  groundY: 0,
};

export const STREET_CENTERS = Array.from({ length: 11 }, (_, i) => -290 + i * 58);

export const PLAYER = {
  walkSpeed: 6.5,
  runSpeed: 11,
  radius: 0.55,
  height: 1.8,
  health: 100,
  jumpSpeed: 7.5,
  gravity: 22,
};

export const DISTRICTS = {
  downtown: { name: 'Meridian Heights', minH: 34, maxH: 118, color: 0x8fa3b8 },
  residential: { name: 'Maplewood', minH: 7, maxH: 20, color: 0xc9a06a },
  waterfront: { name: 'Harborlight', minH: 12, maxH: 42, color: 0x7fa8a0 },
};

// Landmark list: name, grid block (bx, bz), height, kind. bx/bz in 0..9 block coords.
export const LANDMARKS = [
  { name: 'Crown Spire', bx: 6, bz: 2, h: 150, kind: 'spire', note: 'Tallest tower in Crown Bay' },
  { name: 'City Hall', bx: 5, bz: 3, h: 34, kind: 'hall', note: 'Civic heart of Meridian Heights' },
  { name: 'CBPD HQ', bx: 7, bz: 3, h: 30, kind: 'police', note: 'Crown Bay Police Department' },
  { name: 'St. Marina General Hospital', bx: 4, bz: 2, h: 40, kind: 'hospital', note: 'Trauma centre — you wake up here' },
  { name: 'Crown Bay Galleria', bx: 6, bz: 4, h: 22, kind: 'mall', note: 'Three floors of shops' },
  { name: 'Meridian Bank', bx: 5, bz: 2, h: 46, kind: 'bank', note: 'The Big Score happens here' },
  { name: 'Bayfront Arena', bx: 8, bz: 5, h: 26, kind: 'arena', note: 'Concerts and Crown Bay Sharks games' },
  { name: 'Crown Bay Museum', bx: 3, bz: 3, h: 24, kind: 'museum', note: 'Maritime history of the bay' },
  { name: 'Crown Bay University', bx: 2, bz: 6, h: 26, kind: 'university', note: 'Maplewood campus' },
  { name: 'Harborview Hotel', bx: 8, bz: 6, h: 52, kind: 'hotel', note: 'Waterfront rooms with a bay view' },
  { name: 'Starlight Cinema', bx: 4, bz: 5, h: 16, kind: 'cinema', note: 'Six screens, midnight premieres' },
  { name: 'The Driftwood Motel', bx: 1, bz: 8, h: 10, kind: 'motel', note: 'Pay by the hour, no questions' },
  { name: 'Club Lumen', bx: 7, bz: 5, h: 18, kind: 'club', note: 'Nightlife — dance floor, neon, live DJs' },
  { name: 'The Golden Anchor', bx: 8, bz: 4, h: 20, kind: 'casino', note: 'Slots, tables, high rollers' },
  { name: 'The Rusty Anchor', bx: 8, bz: 7, h: 9, kind: 'bar', note: 'Sailors, dockers and tall tales' },
  { name: 'Crown Motors', bx: 3, bz: 1, h: 14, kind: 'dealer', note: 'New and nearly-new cars' },
  { name: 'Wheel Works Auto', bx: 2, bz: 3, h: 10, kind: 'garage', note: 'Chop shop with a friendly face' },
  { name: 'Turbo Fuel', bx: 1, bz: 4, h: 7, kind: 'gas', note: 'Fuel, snacks, 24 hours' },
  { name: 'Sunny Side Diner', bx: 3, bz: 7, h: 8, kind: 'diner', note: 'Breakfast all day' },
  { name: 'The Daily Grind Coffee', bx: 5, bz: 6, h: 9, kind: 'coffee', note: 'Espresso and free wifi' },
  { name: 'Fresh Mart', bx: 2, bz: 5, h: 10, kind: 'mart', note: 'Groceries till late' },
  { name: 'Slice House Pizza', bx: 6, bz: 7, h: 8, kind: 'pizza', note: 'By the slice, by the box' },
  { name: 'Byte & Brew Café', bx: 4, bz: 4, h: 9, kind: 'cafe', note: 'Laptops welcome' },
  { name: 'Ink & Iron Tattoo', bx: 7, bz: 6, h: 8, kind: 'tattoo', note: 'Walk-ins welcome' },
  { name: 'Liberty Firearms', bx: 6, bz: 1, h: 9, kind: 'gunshop', note: 'Licensed dealer — ammo sold here' },
  { name: 'Meridian Park', bx: 4, bz: 6, h: 0, kind: 'park', note: 'Lawns, ponds and old oaks' },
  { name: 'Crown Beach', bx: 9, bz: 6, h: 0, kind: 'beach', note: 'Sand, surf and sunsets' },
  { name: 'Port Crown', bx: 9, bz: 8, h: 0, kind: 'port', note: 'Container cranes and cargo ships' },
  { name: 'Crown Bay Airfield', bx: 0, bz: 9, h: 0, kind: 'airfield', note: 'Runway 09/27 — planes and helis' },
];

// Vehicle types: every one stealable and drivable. length/width in metres,
// topSpeed in m/s, accel in m/s^2, grip 0..1 (wet roads multiply it).
// Colours are deliberately loud — Crown Bay reads as a sunset city, not a
// grey car park: hot reds, oranges, pinks, mint and taxi yellow.
// No near-black paint: the darkest colours are lifted to dark grey
// (0x24+) so a car never reads as a flat black silhouette — in the user's
// photos even a daytime black car was an unreadable black blob.
export const VEHICLE_TYPES = {
  sedan:       { label: 'Sedan',        kind: 'car',   len: 4.6, wid: 1.9, top: 34, accel: 13, grip: 0.85, colors: [0x2a6bc8, 0xc8102e, 0x00a8a8, 0xe8b800, 0x8a4a8a, 0x3a3a46] },
  hatchback:   { label: 'Hatchback',    kind: 'car',   len: 4.0, wid: 1.8, top: 30, accel: 12, grip: 0.85, colors: [0xff5a00, 0x3a8a5f, 0xff2ad8, 0x2a6bc8, 0xe8b800] },
  suv:         { label: 'SUV',          kind: 'car',   len: 4.9, wid: 2.0, top: 32, accel: 12, grip: 0.8,  colors: [0x1a5c2a, 0x8a2f2f, 0x2a6bc8, 0xe8641a, 0xd8d8d8] },
  pickup:      { label: 'Pickup',       kind: 'car',   len: 5.2, wid: 2.0, top: 32, accel: 12, grip: 0.8,  colors: [0x4a6b3a, 0xc8102e, 0x2a6bc8, 0xe8a800, 0x46464f] },
  van:         { label: 'Van',          kind: 'car',   len: 5.0, wid: 2.0, top: 28, accel: 10, grip: 0.75, colors: [0x00a8a8, 0x3a5a7a, 0xe8641a, 0x7a3cff, 0xd8d8d8] },
  truck:       { label: 'Box Truck',    kind: 'car',   len: 7.2, wid: 2.4, top: 26, accel: 8,  grip: 0.7,  colors: [0x2a6bc8, 0xc8102e, 0xe8a800, 0x3a8a5f] },
  taxi:        { label: 'Taxi',         kind: 'car',   len: 4.6, wid: 1.9, top: 33, accel: 13, grip: 0.85, colors: [0xe8b800], taxi: true },
  police:      { label: 'CBPD Cruiser', kind: 'car',   len: 4.8, wid: 1.95, top: 38, accel: 15, grip: 0.9, colors: [0x20262f], police: true },
  ambulance:   { label: 'Ambulance',    kind: 'car',   len: 5.4, wid: 2.1, top: 33, accel: 11, grip: 0.8, colors: [0xf0f0f0], ambulance: true },
  sports:      { label: 'Sports Coupe', kind: 'car',   len: 4.4, wid: 1.95, top: 46, accel: 19, grip: 0.95, colors: [0xff2a1a, 0xff5a00, 0x00e5a0, 0xff2ad8, 0x2a6bc8, 0xe8b800] },
  muscle:      { label: 'Muscle Car',   kind: 'car',   len: 4.8, wid: 1.95, top: 40, accel: 17, grip: 0.85, colors: [0x1a5c2a, 0xc8102e, 0xff5a00, 0x2a6bc8, 0x28282f] },
  convertible: { label: 'Convertible',  kind: 'car',   len: 4.4, wid: 1.9, top: 38, accel: 16, grip: 0.9,  colors: [0xff2ad8, 0x00e5a0, 0x2a6bc8, 0xe8b800, 0xc8102e] },
  limo:        { label: 'Limousine',    kind: 'car',   len: 7.8, wid: 2.0, top: 30, accel: 10, grip: 0.75, colors: [0x24242e, 0xd8d8d8, 0x2e2e3c] },
  bus:         { label: 'City Bus',     kind: 'car',   len: 10.5, wid: 2.5, top: 26, accel: 8,  grip: 0.7,  colors: [0x2a6bc8, 0x3a8a5f, 0xe8b800] },
  jeep:        { label: 'Off-Road Jeep',kind: 'car',   len: 4.4, wid: 1.95, top: 33, accel: 13, grip: 0.9,  colors: [0x4a5a2a, 0xc8102e, 0x2a6bc8, 0xe8641a] },
  motorbike:   { label: 'Motorbike',    kind: 'bike',  len: 2.2, wid: 0.8, top: 38, accel: 16, grip: 0.8,  colors: [0xc8102e, 0x2a6bc8, 0xff5a00, 0x28282f] },
  sportbike:   { label: 'Sports Bike',  kind: 'bike',  len: 2.1, wid: 0.75, top: 52, accel: 22, grip: 0.85, colors: [0xff2a1a, 0x00e5a0, 0xff2ad8, 0x2a6bc8] },
  bicycle:     { label: 'Bicycle',      kind: 'bike',  len: 1.8, wid: 0.6, top: 12, accel: 6,  grip: 0.95, colors: [0xff2ad8, 0x00e5a0, 0xff5a00, 0x2a6bc8] },
  helicopter:  { label: 'Helicopter',   kind: 'heli',  len: 9.0, wid: 2.6, top: 30, accel: 10, grip: 1,    colors: [0xd8d8d8, 0xc8102e, 0xe8a800] },
  plane:       { label: 'Prop Plane',   kind: 'plane', len: 8.0, wid: 2.2, top: 42, accel: 12, grip: 1,    colors: [0xd8d8d8, 0x2a6bc8, 0xc8102e] },
};

export const VEHICLE_TYPE_NAMES = Object.keys(VEHICLE_TYPES);

// Story missions. Each: id, title, briefing, steps (waypoint + text), reward $.
export const MISSIONS = [
  {
    id: 'm1', title: 'First Wheels', reward: 500,
    briefing: 'Marla Voss needs a driver. Steal any car and bring it to Wheel Works Auto.',
    steps: [
      { text: 'Steal a car (walk up to one and press E)', target: 'anyCar' },
      { text: 'Deliver the car to Wheel Works Auto', target: 'landmark:Wheel Works Auto' },
    ],
  },
  {
    id: 'm2', title: 'Night Run', reward: 900,
    briefing: 'A package is waiting at Port Crown. Pick it up and bring it back — keep it quiet.',
    steps: [
      { text: 'Pick up the package at Port Crown', target: 'landmark:Port Crown' },
      { text: 'Return to the Driftwood Motel', target: 'landmark:The Driftwood Motel' },
    ],
  },
  {
    id: 'm3', title: 'Club Lumen', reward: 1200,
    briefing: 'Meet the contact on the dance floor at Club Lumen. The envelope is yours after.',
    steps: [
      { text: 'Enter Club Lumen (walk through the front door)', target: 'landmark:Club Lumen' },
      { text: 'Meet the contact on the dance floor', target: 'club:contact' },
    ],
  },
  {
    id: 'm4', title: 'Hot Pursuit', reward: 1800,
    briefing: 'The CBPD is onto you. Lose a 3-star wanted level and reach the hideout in Maplewood.',
    steps: [
      { text: 'Get the police on your tail (cause trouble — or they will find you)', target: 'wanted:3' },
      { text: 'Lose the heat, then reach the Maplewood hideout', target: 'landmark:The Driftwood Motel' },
    ],
  },
  {
    id: 'm5', title: 'The Big Score', reward: 5000,
    briefing: 'Meridian Bank. One crew, one vault, one helicopter waiting on the Crown Spire roof.',
    steps: [
      { text: 'Rob Meridian Bank — grab the cash inside', target: 'landmark:Meridian Bank' },
      { text: 'Escape to the Crown Spire helipad', target: 'landmark:Crown Spire' },
      { text: 'Fly the helicopter away from the city', target: 'flyaway' },
    ],
  },
];

export const PALETTE = {
  skyDay: new THREE.Color(0x87b5d9),
  skySunset: new THREE.Color(0xef7a6e), // pink-orange sunset, Solmara-style
  skyNight: new THREE.Color(0x141e35), // lifted from 0x0a1226: night sky stays dark blue, not black
  fogDay: new THREE.Color(0x9db8cc),
  fogNight: new THREE.Color(0x141e35),
  sunDay: new THREE.Color(0xfff2d8),
  sunNight: new THREE.Color(0x8fa8ff),
  road: 0x383d44, // a touch lighter than 0x2e3236 so tyres read against it at night
  roadLine: 0xd8c86a,
  sidewalk: 0x9c948a, // warm stone, not flat grey
  grass: 0x4d8a3d,
  sand: 0xd8c08a,
  water: 0x147a9e, // brighter sea blue for the waterfront
  buildingGlass: 0x2a3a4a,
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

export const CONTROLS_TEXT = [
  'W A S D — walk / drive',
  'Mouse — look around (click to lock)',
  'Shift — run / boost',
  'E — enter / exit vehicle',
  'F or Left Click — shoot',
  'R — reload',
  'H — horn',
  'Space — jump / handbrake',
  'M — map (fullscreen)',
  'Esc / P — pause',
];

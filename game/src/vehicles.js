// Crown Bay — vehicles.js rewritten in recorded session fix9, 18 Nov 2026.
// Every vehicle in Crown Bay: 20 types, all stealable and drivable, built from
// boxes and cylinders with headlights, brake lights and indicators. Arcade
// physics (accelerate / brake / steer / collide), traffic that follows the road
// grid and stops at red lights, plus flyable helicopters and a prop plane.
//
// Looks: stylized low-poly, but each type reads at a glance — sports cars sit
// low with a nose lip and spoiler, muscle cars carry a hood scoop, SUVs wear
// roof rails, taxis a side stripe, cruisers a push bar, jeeps a roof rack,
// pickups a roll bar, buses a side stripe. Wheels are real round cylinders
// (20 segments, axle across the car) with a BIG BRIGHT hub and cap, and they
// roll — the hub is light grey and large (0.68r) so the wheel reads as a
// wheel even at night or on a near-black car, instead of a black blob.
// Every car also carries a warm headlight pool on the road ahead (additive
// plane, night only) so the street reads as lit.
import * as THREE from 'three';
import { CITY, STREET_CENTERS, VEHICLE_TYPES, VEHICLE_TYPE_NAMES } from './config.js';
import { eastMaxX, groundHeightAt } from './city.js';

const vehBox = new THREE.BoxGeometry(1, 1, 1);
const vehCyl = new THREE.CylinderGeometry(1, 1, 1, 10);
const vehWheelGeo = new THREE.CylinderGeometry(1, 1, 1, 20); // round wheels
const vehSph = new THREE.SphereGeometry(1, 10, 8);

function mat(color, rough = 0.45, metal = 0.22) {
  return new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal });
}

// Spin every wheel of a moving vehicle about its axle, at the rolling rate.
function spinWheels(v, dt) {
  const u = v.mesh.userData;
  if (!u.wheels || u.wheels.length === 0) return;
  const spin = (v.speed * dt) / (u.wheelR || 0.44);
  for (const wg of u.wheels) wg.rotation.z -= spin;
}

export function createVehicleMesh(type, colorHex, opts = {}) {
  const def = VEHICLE_TYPES[type];
  const group = new THREE.Group();
  const body = mat(colorHex);
  const glass = new THREE.MeshStandardMaterial({ color: 0x1c2a38, roughness: 0.15, metalness: 0.4 });
  const dark = mat(0x14161a, 0.7, 0.2);
  const tyre = mat(0x1e1e1e, 0.95, 0);
  const hubMat = mat(0xe2e2e2, 0.35, 0.15);
  const headMat = new THREE.MeshStandardMaterial({ color: 0xfff6d8, emissive: 0xffeeb0, emissiveIntensity: 0.3 });
  const brakeMat = new THREE.MeshStandardMaterial({ color: 0x550000, emissive: 0xff2211, emissiveIntensity: 0.3 });
  const indicatorMat = new THREE.MeshStandardMaterial({ color: 0x664400, emissive: 0xffaa00, emissiveIntensity: 0 });

  function bx(m, x, y, z, sx, sy, sz, ry = 0) {
    const mesh = new THREE.Mesh(vehBox, m);
    mesh.position.set(x, y, z);
    mesh.scale.set(sx, sy, sz);
    mesh.rotation.y = ry;
    mesh.castShadow = true;
    group.add(mesh);
    return mesh;
  }
  // Raked windshield: a thin glass slab leaning back over the cabin front.
  function windshield(x, y, w) {
    const m = new THREE.Mesh(vehBox, glass);
    m.scale.set(0.07, 0.85, w);
    m.position.set(x, y, 0);
    m.rotation.z = -0.38;
    m.castShadow = true;
    group.add(m);
    return m;
  }
  // Wheels — ROUND, and they roll. Each wheel is a 20-segment cylinder in
  // its own group: the tyre is rotated about X so its axle lies across the
  // car (z), the hub + cap spin with it, and driveStep/trafficStep turn the
  // group about the axle. (The old code rotated the cylinder about Z, which
  // put the axle along the car's length — the discs faced forwards, so from
  // the side the wheels read as boxes.)
  // The hub is deliberately BIG (0.68 of the wheel radius) and BRIGHT
  // (near-white, low metalness so it catches moon/street light instead of
  // going black like a metal would with no env map): from the side the
  // wheel reads as a dark tyre ring around a light disc, day and night.
  // Wheels are also slightly larger than before (0.44 cars) so more of the
  // hub clears the bottom edge of the body.
  const wheelGroups = [];
  function wheel(x, z, r, w) {
    const g = new THREE.Group();
    g.position.set(x, r, z);
    const tyreMesh = new THREE.Mesh(vehWheelGeo, tyre);
    tyreMesh.rotation.x = Math.PI / 2; // cylinder axis (Y) -> Z (sideways)
    tyreMesh.scale.set(r, w, r);
    tyreMesh.castShadow = true;
    g.add(tyreMesh);
    const hub = new THREE.Mesh(vehWheelGeo, hubMat);
    hub.rotation.x = Math.PI / 2;
    hub.scale.set(r * 0.68, w + 0.04, r * 0.68);
    g.add(hub);
    group.add(g);
    wheelGroups.push(g);
    return g;
  }
  const L = def.len, W = def.wid;

  if (def.kind === 'heli') {
    // Airframe: the cabin is a REAL glasshouse nose — the body box is solid,
    // so a windshield buried inside it would be invisible (that was the old
    // bug). The body stops at x = 1.5 and the cabin is a transparent glass
    // box (1.35..2.85) the pilot sits in, visible from the front and sides.
    // Long tail boom with a fin, landing skids (tubes + struts, not floating
    // posts), rescue-style side stripe. Rotor spins while flying (flyStep)
    // with a faint blur disc; tail rotor spins too.
    bx(body, -0.6, 1.5, 0, 4.2, 1.7, 2.2); // main body (nose is glass)
    const heliGlass = new THREE.MeshStandardMaterial({ color: 0x9ac8e8, metalness: 0.1, roughness: 0.15, transparent: true, opacity: 0.45 });
    const cabin = new THREE.Mesh(vehBox, heliGlass);
    cabin.scale.set(1.5, 1.4, 1.9);
    cabin.position.set(2.1, 1.55, 0);
    group.add(cabin);
    // pilot in the cockpit (opts.pilot — the CBPD patrol heli only): navy
    // uniform, cap, seated on the right with an empty co-pilot seat
    if (opts.pilot) {
      const pilot = new THREE.Group();
      const uniform = new THREE.MeshStandardMaterial({ color: 0x1a2a4a, roughness: 0.85 });
      const skin = new THREE.MeshStandardMaterial({ color: 0xe8b88a, roughness: 0.85 });
      const seatM = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.9 });
      const seat = new THREE.Mesh(vehBox, seatM);
      seat.scale.set(0.5, 0.5, 0.4); seat.position.set(1.55, 1.15, 0.45);
      const seat2 = new THREE.Mesh(vehBox, seatM);
      seat2.scale.set(0.5, 0.5, 0.4); seat2.position.set(1.55, 1.15, -0.45);
      const torso = new THREE.Mesh(vehBox, uniform);
      torso.scale.set(0.45, 0.55, 0.35); torso.position.set(1.9, 1.35, 0.45);
      const head = new THREE.Mesh(vehSph, skin);
      head.scale.setScalar(0.17); head.position.set(1.9, 1.78, 0.45);
      const cap = new THREE.Mesh(vehBox, uniform);
      cap.scale.set(0.34, 0.1, 0.34); cap.position.set(1.9, 1.93, 0.45);
      pilot.add(seat, seat2, torso, head, cap);
      group.add(pilot);
      group.userData.pilot = pilot;
    }
    // police light bar (opts.police — patrol heli): flashes via
    // setVehicleLights exactly like a cruiser (lightR/lightB + glow discs)
    if (opts.police) {
      const barBase = new THREE.Mesh(vehBox, dark);
      barBase.scale.set(0.5, 0.12, 1.4); barBase.position.set(0.9, 2.41, 0);
      group.add(barBase);
      const barR = new THREE.Mesh(vehBox, new THREE.MeshStandardMaterial({ color: 0x220000, emissive: 0xff1111, emissiveIntensity: 3.5 }));
      barR.scale.set(0.4, 0.2, 0.6); barR.position.set(0.9, 2.56, 0.38);
      const barB = new THREE.Mesh(vehBox, new THREE.MeshStandardMaterial({ color: 0x000022, emissive: 0x2244ff, emissiveIntensity: 0.1 }));
      barB.scale.set(0.4, 0.2, 0.6); barB.position.set(0.9, 2.56, -0.38);
      group.add(barR, barB);
      const glowMatR = new THREE.MeshBasicMaterial({ color: 0xff2211, transparent: true, opacity: 0.3, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending });
      const glowMatB = new THREE.MeshBasicMaterial({ color: 0x2244ff, transparent: true, opacity: 0.04, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending });
      const glowR = new THREE.Mesh(new THREE.CircleGeometry(3.5, 20), glowMatR);
      glowR.rotation.x = -Math.PI / 2; glowR.position.y = 0.05;
      const glowB = new THREE.Mesh(new THREE.CircleGeometry(3.5, 20), glowMatB);
      glowB.rotation.x = -Math.PI / 2; glowB.position.y = 0.06;
      group.add(glowR, glowB);
      group.userData.lightR = barR;
      group.userData.lightB = barB;
      group.userData.glowR = glowR;
      group.userData.glowB = glowB;
    }
    // side + tail stripe (livery accent, on the body only)
    const stripeMat = mat(0xc8102e, 0.5, 0.2);
    bx(stripeMat, -0.9, 1.35, 1.12, 3.6, 0.22, 0.05);
    bx(stripeMat, -0.9, 1.35, -1.12, 3.6, 0.22, 0.05);
    bx(body, -3.6, 1.7, 0, 3.4, 0.5, 0.5); // tail boom
    const fin = bx(body, -5.2, 2.0, 0, 0.3, 1.4, 0.2);
    fin.rotation.x = 0;
    bx(stripeMat, -3.6, 1.95, 0.26, 3.2, 0.14, 0.04); // tail stripe
    // rotor mast + hub, main rotor (cross) + faint blur disc when spinning.
    // The rotor sits high (2.9) so its blades clear the roof light bar.
    bx(dark, 0, 2.6, 0, 0.3, 0.5, 0.3); // mast
    const rotor = bx(dark, 0, 2.9, 0, 11, 0.08, 0.5);
    const rotor2 = bx(dark, 0, 2.9, 0, 0.5, 0.08, 11);
    const blur = new THREE.Mesh(new THREE.CircleGeometry(5.5, 28), new THREE.MeshBasicMaterial({ color: 0xdddddd, transparent: true, opacity: 0.10, side: THREE.DoubleSide, depthWrite: false }));
    blur.rotation.x = -Math.PI / 2; blur.position.y = 2.9; blur.visible = false;
    group.add(blur);
    const tailRotor = bx(dark, -5.2, 2.2, 0.35, 0.1, 2.2, 0.1);
    // landing skids: two tubes + four struts
    bx(dark, 0.2, 0.12, 1.0, 4.6, 0.12, 0.12);
    bx(dark, 0.2, 0.12, -1.0, 4.6, 0.12, 0.12);
    bx(dark, -1.4, 0.35, 0.8, 0.2, 0.7, 0.2);
    bx(dark, -1.4, 0.35, -0.8, 0.2, 0.7, 0.2);
    bx(dark, 1.6, 0.35, 0.8, 0.2, 0.7, 0.2);
    bx(dark, 1.6, 0.35, -0.8, 0.2, 0.7, 0.2);
    // nav lights: red port, green starboard, white tail strobe (blinks)
    const navR = new THREE.Mesh(vehBox, new THREE.MeshStandardMaterial({ color: 0x220000, emissive: 0xff1111, emissiveIntensity: 2.5 }));
    navR.scale.set(0.18, 0.18, 0.18); navR.position.set(0.6, 1.5, 1.12);
    group.add(navR);
    const navG = new THREE.Mesh(vehBox, new THREE.MeshStandardMaterial({ color: 0x002200, emissive: 0x22ff66, emissiveIntensity: 2.5 }));
    navG.scale.set(0.18, 0.18, 0.18); navG.position.set(0.6, 1.5, -1.12);
    group.add(navG);
    const strobe = new THREE.Mesh(vehBox, new THREE.MeshStandardMaterial({ color: 0x222222, emissive: 0xffffff, emissiveIntensity: 0.1 }));
    strobe.scale.set(0.16, 0.16, 0.16); strobe.position.set(-5.35, 2.75, 0);
    group.add(strobe);
    group.userData.rotor = rotor;
    group.userData.rotor2 = rotor2;
    group.userData.tailRotor = tailRotor;
    group.userData.rotorBlur = blur;
    group.userData.strobe = strobe;
    group.userData.headMat = headMat;
    group.userData.brakeMat = brakeMat;
    bx(headMat, 2.9, 1.2, 0.8, 0.2, 0.3, 0.3);
    bx(headMat, 2.9, 1.2, -0.8, 0.2, 0.3, 0.3);
    return group;
  }

  if (def.kind === 'plane') {
    const fus = new THREE.Mesh(vehCyl, body);
    fus.rotation.z = Math.PI / 2;
    fus.scale.set(0.9, 7.4, 0.9);
    fus.position.set(0, 1.4, 0);
    fus.castShadow = true;
    group.add(fus);
    bx(glass, 2.4, 1.8, 0, 1.4, 0.9, 1.2);
    bx(body, 0, 1.6, 0, 1.6, 0.16, 9.4); // main wing
    bx(body, -3.4, 1.7, 0, 1.0, 0.14, 3.4); // tailplane
    bx(body, -3.4, 2.1, 0, 0.9, 1.0, 0.14); // fin
    const prop = bx(dark, 3.9, 1.4, 0, 0.12, 4.4, 0.2);
    group.userData.rotor = prop;
    wheel(1.2, 0.9, 0.42, 0.3);
    wheel(1.2, -0.9, 0.42, 0.3);
    wheel(-2.2, 0, 0.35, 0.3);
    group.userData.headMat = headMat;
    group.userData.brakeMat = brakeMat;
    bx(headMat, 3.6, 1.0, 0.7, 0.2, 0.25, 0.25);
    bx(headMat, 3.6, 1.0, -0.7, 0.2, 0.25, 0.25);
    return group;
  }

  if (def.kind === 'bike') {
    const isSport = type === 'sportbike';
    const frameMat = mat(colorHex, 0.4, 0.6);
    wheel(0.75, 0, 0.34, 0.12);
    wheel(-0.75, 0, 0.34, 0.12);
    bx(frameMat, 0, 0.55, 0, 1.5, 0.14, 0.14);
    bx(frameMat, 0.55, 0.75, 0, 0.5, 0.12, 0.12, 0.5);
    bx(dark, -0.15, 0.72, 0, 0.7, 0.1, 0.3); // seat
    if (isSport) {
      bx(frameMat, 0.85, 0.62, 0, 0.5, 0.5, 0.34); // fairing
      bx(glass, 0.95, 0.85, 0, 0.3, 0.3, 0.3);
    } else if (type === 'bicycle') {
      bx(frameMat, 0.75, 0.95, 0, 0.5, 0.08, 0.5); // handlebar
      bx(dark, -0.1, 0.72, 0, 0.6, 0.08, 0.26);
    }
    bx(headMat, 0.95, 0.6, 0, 0.1, 0.15, 0.15);
    bx(brakeMat, -0.95, 0.6, 0, 0.1, 0.15, 0.15);
    group.userData.headMat = headMat;
    group.userData.brakeMat = brakeMat;
    group.userData.wheels = wheelGroups;
    group.userData.wheelR = 0.34;
    return group;
  }

  // ---- cars ----
  const bodyH = type === 'bus' ? 2.2 : type === 'truck' || type === 'van' ? 1.9 : 0.85;
  const bodyY = type === 'bus' || type === 'truck' ? 1.35 : 0.75;
  const cabinH = type === 'bus' ? 0 : type === 'van' || type === 'truck' ? 0.4 : 0.62;
  const wheelR = type === 'bus' || type === 'truck' ? 0.60 : type === 'jeep' ? 0.52 : 0.44;
  // sports / convertible sit lower and sleeker than the rest
  const low = (type === 'sports' || type === 'convertible') ? 0.13 : 0;
  const bY = bodyY - low;
  const bH = bodyH - (type === 'sports' ? 0.15 : 0);

  if (type === 'bus') {
    bx(body, 0, 1.5, 0, L, 2.4, W);
    bx(glass, 0, 1.9, 0, L - 0.6, 0.9, W + 0.02);
    bx(dark, L / 2 - 0.1, 0.9, 0, 0.1, 1.6, W - 0.4);
    // side stripe + destination sign
    const stripe = mat(0xd8d8d8, 0.5, 0.2);
    bx(stripe, 0, 1.5, W / 2 + 0.01, L - 0.8, 0.45, 0.05);
    bx(stripe, 0, 1.5, -W / 2 - 0.01, L - 0.8, 0.45, 0.05);
    bx(dark, L / 2 - 0.05, 2.2, 0, 0.08, 0.35, 1.2);
  } else if (type === 'truck') {
    // cab at the FRONT (+x, where the headlights are) — the old build had
    // the cab at the back and the cargo box up front.
    bx(body, L / 2 - 1.4, 1.5, 0, 2.6, 1.9, W); // cab
    bx(glass, L / 2 - 2.6, 1.9, 0, 0.1, 0.8, W - 0.3); // windshield
    const boxMat = mat(0xd8d8d8, 0.7, 0.1);
    bx(boxMat, -L / 2 + 2.2, 1.7, 0, L - 3.4, 2.2, W - 0.1); // cargo box
  } else if (type === 'limo') {
    bx(body, 0, bY, 0, L, bH, W);
    bx(glass, 0.4, bY + 0.55, 0, L - 2.2, cabinH, W - 0.3);
    bx(dark, 0, bY + 0.05, 0, 0.2, 0.2, W - 0.2);
    bx(glass, 0.6, bY + 0.55, 0, 0.08, cabinH, W - 0.3); // divider
    windshield(3.22, bY + 0.6, W - 0.4);
  } else if (type === 'pickup') {
    bx(body, 0.6, bY, 0, 3.2, bH, W);
    bx(glass, 1.0, bY + 0.55, 0, 1.6, cabinH, W - 0.3);
    bx(dark, -1.2, bY + 0.28, 0, 2.6, 0.55, W - 0.2); // bed
    // roll bar over the bed
    bx(dark, -0.6, bY + 0.95, W / 2 - 0.25, 0.12, 0.7, 0.12);
    bx(dark, -0.6, bY + 0.95, -W / 2 + 0.25, 0.12, 0.7, 0.12);
    bx(dark, -0.6, bY + 1.28, 0, 0.12, 0.12, W - 0.4);
    windshield(1.82, bY + 0.6, W - 0.4);
  } else if (type === 'van' || type === 'ambulance') {
    bx(body, 0, bodyY + 0.3, 0, L, bodyH + 0.5, W);
    bx(glass, L / 2 - 0.7, bodyY + 0.9, 0, 0.1, 0.7, W - 0.3);
    bx(glass, 0.4, bodyY + 0.9, 0, L - 2, 0.6, W + 0.02);
    if (type === 'ambulance') {
      const cross = mat(0xc8102e, 0.6, 0);
      bx(cross, 0, bodyY + 0.9, W / 2 + 0.03, 0.9, 0.9, 0.06);
      bx(cross, 0, bodyY + 0.9, -W / 2 - 0.03, 0.9, 0.9, 0.06);
    }
  } else if (type === 'jeep') {
    bx(body, 0, bY + 0.15, 0, L, bH + 0.25, W);
    bx(glass, 0.3, bY + 0.85, 0, 1.8, cabinH, W - 0.3);
    bx(dark, -L / 2 + 0.2, bY + 0.3, 0, 0.25, 0.7, W - 0.2); // spare wheel
    bx(dark, 0.3, bY + 1.2, 0, 2.2, 0.08, W - 0.6); // roof rack
    windshield(1.22, bY + 0.82, W - 0.4);
  } else {
    // sedan / hatchback / suv / taxi / police / sports / muscle / convertible
    // Silhouettes differ on purpose: the cabin sits back on sports/muscle
    // (long hood), forward on SUVs, and each type gets a sloped hood wedge
    // plus a sloped rear deck, so no two types read as the same box with
    // a different paint job.
    const cabX = type === 'sports' ? -0.55 : type === 'convertible' ? -0.45
      : type === 'muscle' ? -0.35 : type === 'suv' ? 0.15
      : type === 'hatchback' ? 0.1 : -0.2;
    bx(body, 0, bY, 0, L, bH, W);
    const cabLen = type === 'sports' || type === 'convertible' ? 1.8 : type === 'suv' ? 2.6 : 2.1;
    if (type !== 'convertible') bx(glass, cabX, bY + 0.55, 0, cabLen, cabinH, W - 0.3);
    else bx(dark, cabX, bY + 0.45, 0, 1.6, 0.18, W - 0.4);
    windshield(cabX + cabLen / 2 + 0.02, bY + 0.6, W - 0.4);
    // sloped hood wedge (nose dips down) + sloped rear deck
    const hoodLen = type === 'sports' || type === 'muscle' ? 1.7 : type === 'suv' ? 0.9 : 1.3;
    const hood = bx(body, L / 2 - hoodLen / 2 - 0.15, bY + bH / 2 + 0.02, 0, hoodLen, 0.14, W - 0.25);
    hood.rotation.z = -0.16;
    if (type === 'sports' || type === 'muscle' || type === 'sedan') {
      const deck = bx(body, -L / 2 + 0.75, bY + bH / 2 + 0.02, 0, 1.3, 0.14, W - 0.25);
      deck.rotation.z = 0.14;
    }
    if (type === 'suv') {
      // tall flat roof panel over the cabin
      bx(body, cabX, bY + 0.55 + cabinH / 2 + 0.08, 0, cabLen + 0.4, 0.16, W - 0.2);
    }
    if (type === 'sports') {
      bx(body, L / 2 - 0.35, bY - 0.12, 0, 1.3, 0.34, W - 0.15); // nose lip
      bx(dark, -L / 2 + 0.5, bY + 0.45, 0, 0.9, 0.1, W - 0.3); // spoiler
      bx(dark, -L / 2 + 0.6, bY + 0.25, 0, 0.08, 0.4, W - 0.3);
    }
    if (type === 'muscle') {
      bx(dark, 0.9, bY + bH / 2 + 0.08, 0, 1.0, 0.16, 0.9); // hood scoop
      bx(dark, -L / 2 + 0.5, bY + 0.45, 0, 0.9, 0.1, W - 0.3); // spoiler
      bx(dark, -L / 2 + 0.6, bY + 0.25, 0, 0.08, 0.4, W - 0.3);
    }
    if (type === 'suv') {
      // roof rails
      bx(dark, -0.2, bY + 0.91, W / 2 - 0.3, 2.4, 0.07, 0.1);
      bx(dark, -0.2, bY + 0.91, -W / 2 + 0.3, 2.4, 0.07, 0.1);
    }
    if (type === 'taxi') {
      // black side stripe on the yellow body
      bx(dark, 0, bY + 0.05, W / 2 + 0.01, L - 1.2, 0.16, 0.05);
      bx(dark, 0, bY + 0.05, -W / 2 - 0.01, L - 1.2, 0.16, 0.05);
    }
    if (type === 'police') {
      // front push bar
      bx(dark, L / 2 + 0.06, 0.62, 0.62, 0.1, 0.5, 0.1);
      bx(dark, L / 2 + 0.06, 0.62, -0.62, 0.1, 0.5, 0.1);
      bx(dark, L / 2 + 0.06, 0.85, 0, 0.1, 0.12, 1.35);
    }
  }

  // grille + bumpers on every car
  bx(mat(0x0e0e10, 0.6, 0.4), L / 2 + 0.01, bY + 0.05, 0, 0.08, 0.3, W * 0.55);
  bx(dark, L / 2 - 0.06, 0.32, 0, 0.4, 0.3, W + 0.04); // front bumper
  bx(dark, -L / 2 + 0.06, 0.32, 0, 0.4, 0.3, W + 0.04); // rear bumper

  // wheels
  const wx = L / 2 - 0.85;
  const wz = W / 2 - 0.05;
  wheel(wx, wz, wheelR, 0.3);
  wheel(wx, -wz, wheelR, 0.3);
  wheel(-wx, wz, wheelR, 0.3);
  wheel(-wx, -wz, wheelR, 0.3);

  // lights: headlights front (+x), brake lights rear — bigger lenses than
  // before so they read at night from any angle.
  bx(headMat, L / 2 + 0.01, bY + 0.1, W / 2 - 0.45, 0.08, 0.3, 0.5);
  bx(headMat, L / 2 + 0.01, bY + 0.1, -W / 2 + 0.45, 0.08, 0.3, 0.5);
  bx(brakeMat, -L / 2 - 0.01, bY + 0.1, W / 2 - 0.45, 0.08, 0.3, 0.5);
  bx(brakeMat, -L / 2 - 0.01, bY + 0.1, -W / 2 + 0.45, 0.08, 0.3, 0.5);
  bx(indicatorMat, L / 2 + 0.01, bY + 0.1, W / 2 - 0.1, 0.08, 0.18, 0.2);
  bx(indicatorMat, L / 2 + 0.01, bY + 0.1, -W / 2 + 0.1, 0.08, 0.18, 0.2);

  // headlight pool: a warm wash on the road ahead, driven by night01 in
  // setVehicleLights. The player's car also gets a real spotlight (world.js);
  // the pool makes every car's headlights visibly light the street.
  const poolMat = new THREE.MeshBasicMaterial({ color: 0xffe6a8, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const pool = new THREE.Mesh(new THREE.PlaneGeometry(15, 7), poolMat);
  pool.rotation.x = -Math.PI / 2;
  pool.position.set(L / 2 + 7.5, 0.06, 0);
  pool.visible = false;
  group.add(pool);
  group.userData.lightPool = pool;

  if (type === 'taxi') {
    bx(mat(0x111111), 0, bY + 1.05, 0, 1.1, 0.28, 0.5);
    const check = new THREE.Mesh(vehBox, new THREE.MeshStandardMaterial({ color: 0xffd23c, emissive: 0xffd23c, emissiveIntensity: 0.5 }));
    check.scale.set(1.12, 0.3, 0.52); check.position.set(0, bY + 1.05, 0);
    group.add(check);
  }
  if (type === 'police') {
    // Light bar: a dark base across the roof with big red/blue lenses.
    // The lenses flash alternately (setVehicleLights) and two additive
    // glow discs on the ground pulse with them, so the flash spills onto
    // the road and nearby bodywork — visible day and night. Police cars
    // only exist while the player is wanted, so the siren is on whenever
    // one is in the world (i.e. during a chase).
    const barBase = new THREE.Mesh(vehBox, dark);
    barBase.scale.set(1.1, 0.14, 1.3); barBase.position.set(-0.2, bY + 0.98, 0);
    group.add(barBase);
    const barR = new THREE.Mesh(vehBox, new THREE.MeshStandardMaterial({ color: 0x220000, emissive: 0xff1111, emissiveIntensity: 0 }));
    barR.scale.set(0.9, 0.26, 0.55); barR.position.set(-0.2, bY + 1.12, 0.36);
    group.add(barR);
    const barB = new THREE.Mesh(vehBox, new THREE.MeshStandardMaterial({ color: 0x000022, emissive: 0x2244ff, emissiveIntensity: 0 }));
    barB.scale.set(0.9, 0.26, 0.55); barB.position.set(-0.2, bY + 1.12, -0.36);
    group.add(barB);
    group.userData.lightR = barR;
    group.userData.lightB = barB;
    const glowGeo = new THREE.CircleGeometry(5.5, 24);
    const glowR = new THREE.Mesh(glowGeo, new THREE.MeshBasicMaterial({ color: 0xff2222, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    glowR.rotation.x = -Math.PI / 2; glowR.position.y = 0.05;
    group.add(glowR);
    const glowB = new THREE.Mesh(glowGeo, new THREE.MeshBasicMaterial({ color: 0x2244ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    glowB.rotation.x = -Math.PI / 2; glowB.position.y = 0.06;
    group.add(glowB);
    group.userData.glowR = glowR;
    group.userData.glowB = glowB;
    // white doors
    bx(mat(0xe8e8e8, 0.5, 0.3), 0.3, bY + 0.05, W / 2 + 0.01, 1.8, 0.7, 0.04);
    bx(mat(0xe8e8e8, 0.5, 0.3), 0.3, bY + 0.05, -W / 2 - 0.01, 1.8, 0.7, 0.04);
  }
  if (type === 'ambulance') {
    const bar = new THREE.Mesh(vehBox, new THREE.MeshStandardMaterial({ color: 0x220000, emissive: 0xff1111, emissiveIntensity: 0 }));
    bar.scale.set(0.8, 0.18, 0.5); bar.position.set(0, bY + 1.35, 0);
    group.add(bar);
    group.userData.lightR = bar;
  }

  group.userData.headMat = headMat;
  group.userData.brakeMat = brakeMat;
  group.userData.indicatorMat = indicatorMat;
  group.userData.wheels = wheelGroups;
  group.userData.wheelR = wheelR;
  return group;
}

// One vehicle: mesh + arcade state. Heading 0 = +x (east), CCW positive.
export function makeVehicle(scene, type, x, z, heading, colorHex, opts = {}) {
  const def = VEHICLE_TYPES[type];
  const mesh = createVehicleMesh(type, colorHex ?? def.colors[0], opts);
  mesh.position.set(x, opts.y ?? 0, z);
  mesh.rotation.y = -heading;
  scene.add(mesh);
  const v = {
    type, def, mesh,
    x, z, y: opts.y ?? 0,
    heading, speed: 0, steer: 0,
    radius: Math.max(def.len, def.wid) / 2,
    traffic: !!opts.traffic,
    parked: !!opts.parked,
    police: !!opts.police,
    ai: null, // traffic state
    vy: 0, // vertical speed (aircraft)
    airborne: false,
    damage: 0,
    sirenPhase: Math.random() * 2,
    brake: false,
    indicator: 0, // -1 left, 1 right, 0 off
    indicatorTimer: 0,
  };
  if (opts.traffic) {
    v.ai = newTrafficState(x, z);
  }
  return v;
}

function newTrafficState(x, z) {
  // pick the nearest street and a direction along it
  let best = null;
  for (const c of STREET_CENTERS) {
    for (const axis of ['x', 'z']) {
      const d = axis === 'x' ? Math.abs(z - c) : Math.abs(x - c);
      if (!best || d < best.d) best = { d, axis, line: c };
    }
  }
  const along = best.axis === 'x' ? x : z;
  const dir = Math.random() < 0.5 ? 1 : -1;
  // next intersection ahead
  let target = along;
  for (const c of STREET_CENTERS) {
    if (dir > 0 && c > along + 1) { target = c; break; }
    if (dir < 0 && c < along - 1) target = c;
  }
  return {
    axis: best.axis, line: best.line, dir,
    target, speed: 10 + Math.random() * 5,
    wait: 0,
    lane: 3.4,
  };
}

// Arcade driving for the player (or a police chaser): returns collision info.
// Steering sign: heading is CCW-positive and the chase camera sits behind
// the vehicle looking along the heading, so a LARGER heading is a turn to
// the RIGHT of the screen (d(forward)/d(heading) is the screen-right
// vector). D gives move.x = +1, so steer must be POSITIVE for D — the old
// code negated it, which is why right steered left (and why police
// chasers, which pass steer = clamp(dh * 2), steered away from the player).
export function driveStep(v, move, dt, colliders, wet, others) {
  const def = v.def;
  const grip = def.grip * (wet ? 0.72 : 1);
  const accel = def.accel * (move.y > 0 ? 1 : 0.6);
  if (move.y > 0) v.speed += accel * dt;
  else if (move.y < 0) {
    if (v.speed > 0.5) v.speed -= def.accel * 1.6 * dt; // brake
    else v.speed -= accel * 0.5 * dt; // reverse
  } else {
    v.speed -= Math.sign(v.speed) * 4 * dt;
    if (Math.abs(v.speed) < 0.2) v.speed = 0;
  }
  v.speed = Math.max(-def.top * 0.35, Math.min(def.top, v.speed));
  // steering: less at speed, more grip = tighter
  const steerTarget = move.x * 0.55 * grip;
  v.steer += (steerTarget - v.steer) * Math.min(1, dt * 8);
  // turnRate already carries the sign of the speed: reversing with D turns
  // the car the OTHER way (nose swings left, like a real car). Do NOT
  // multiply by sign(speed) here — that made reverse steer the same way as
  // forward, which is backwards.
  const turnRate = v.steer * (v.speed / def.top) * 2.4;
  v.heading += turnRate * dt;
  // brake light + indicator
  v.brake = move.y < 0 && v.speed > 1;
  v.indicatorTimer -= dt;
  if (Math.abs(v.steer) > 0.3 && v.indicatorTimer <= 0) {
    v.indicator = v.steer > 0 ? 1 : -1;
    v.indicatorTimer = 0.5;
  } else if (Math.abs(v.steer) <= 0.1) v.indicator = 0;

  let nx = v.x + Math.cos(v.heading) * v.speed * dt;
  let nz = v.z + Math.sin(v.heading) * v.speed * dt;
  let hit = false;
  // building / prop colliders (circle vs AABB)
  const r = v.radius * 0.82;
  for (const c of colliders) {
    const cx = Math.max(c.x - c.hx, Math.min(nx, c.x + c.hx));
    const cz = Math.max(c.z - c.hz, Math.min(nz, c.z + c.hz));
    const dx = nx - cx, dz = nz - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 < r * r) {
      const d = Math.sqrt(d2) || 0.001;
      nx = cx + (dx / d) * r;
      nz = cz + (dz / d) * r;
      v.speed *= 0.45;
      hit = true;
    }
  }
  // keep inside the drivable area (sea is a wall — except on the bridge
  // road, the island, the pier and the wheel platform, where eastMaxX
  // opens the waterline on the prospective position)
  nx = Math.max(-CITY.half - 6, Math.min(eastMaxX(v.x, v.z, nx, nz), nx));
  nz = Math.max(-CITY.half - 6, Math.min(CITY.half + 6, nz));
  v.x = nx; v.z = nz;
  // vehicle-vehicle bumps (damage throttled: one impact per half second)
  v._dmgCd = Math.max(0, (v._dmgCd || 0) - dt);
  if (others) {
    for (const o of others) {
      if (o === v || o.type === undefined) continue;
      const dx = v.x - o.x, dz = v.z - o.z;
      const rr = v.radius * 0.8 + o.radius * 0.8;
      const d2 = dx * dx + dz * dz;
      if (d2 < rr * rr && d2 > 0.0001) {
        const d = Math.sqrt(d2);
        const push = (rr - d) / 2;
        v.x += (dx / d) * push; v.z += (dz / d) * push;
        o.x -= (dx / d) * push; o.z -= (dz / d) * push;
        if (Math.abs(v.speed) > 8 && v._dmgCd <= 0) {
          v.damage += 5; o.damage = (o.damage || 0) + 5;
          v._dmgCd = 0.5;
        }
        v.speed *= 0.7;
        hit = true;
      }
    }
  }
  // follow the ground: bridge deck, ramps, pier and island sit above y = 0
  const gy = groundHeightAt(v.x, v.z);
  v.y += (gy - v.y) * Math.min(1, dt * 12);
  // pitch to the slope under the car (ramps) so wheels stay on the road
  const hF = groundHeightAt(v.x + Math.cos(v.heading) * 2.2, v.z + Math.sin(v.heading) * 2.2);
  const hB = groundHeightAt(v.x - Math.cos(v.heading) * 2.2, v.z - Math.sin(v.heading) * 2.2);
  const slopePitch = -Math.atan2(hF - hB, 4.4);
  // apply to mesh: lean into the actual turn (turnRate's sign already
  // covers forward and reverse), pitch on accel
  v.mesh.position.set(v.x, v.y, v.z);
  v.mesh.rotation.y = -v.heading;
  v.mesh.rotation.z = Math.max(-0.07, Math.min(0.07, turnRate * 0.05));
  v.mesh.rotation.x = Math.max(-0.2, Math.min(0.2, -v.speed * 0.0006 + slopePitch));
  spinWheels(v, dt);
  return hit;
}

// Helicopter / plane flight: arcade, forgiving.
// Yaw uses the same sign as driveStep: D (move.x = +1) yaws right.
export function flyStep(v, move, dt, run, colliders) {
  const def = v.def;
  if (v.type === 'helicopter') {
    // W/S tilt forward/back, A/D yaw, Shift up, Space down
    const climb = (run ? 9 : 0) - (move.y < 0 ? 0 : 0);
    v.vy += ((run ? 9 : 0) - v.vy) * Math.min(1, dt * 2);
    if (move.y > 0) v.speed = Math.min(def.top, v.speed + def.accel * dt);
    else v.speed = Math.max(0, v.speed - def.accel * dt);
    v.heading += move.x * 1.4 * dt;
    v.y += v.vy * dt;
    if (v.y < 0.7) { v.y = 0.7; v.vy = 0; }
    if (v.y > 220) { v.y = 220; v.vy = 0; }
    v.x += Math.cos(v.heading) * v.speed * dt;
    v.z += Math.sin(v.heading) * v.speed * dt;
    v.x = Math.max(-CITY.half - 40, Math.min(CITY.seaX + 120, v.x));
    v.z = Math.max(-CITY.half - 40, Math.min(CITY.half + 40, v.z));
    v.mesh.position.set(v.x, v.y, v.z);
    v.mesh.rotation.y = -v.heading;
    v.mesh.rotation.z = move.y > 0 ? -0.12 : 0.02;
    v.mesh.rotation.x = 0;
    if (v.mesh.userData.rotor) {
      const u = v.mesh.userData;
      u.rotor.rotation.y += dt * 22;
      u.rotor2.rotation.y += dt * 22;
      if (u.tailRotor) u.tailRotor.rotation.z += dt * 30;
      if (u.rotorBlur) u.rotorBlur.visible = true; // faint disc while spinning
    }
    return;
  }
  // plane: needs runway speed to lift, then pitch with W/S
  if (!v.airborne) {
    if (move.y > 0) v.speed += def.accel * dt;
    else v.speed = Math.max(0, v.speed - def.accel * 1.5 * dt);
    v.heading += move.x * 0.5 * dt * Math.max(0.3, v.speed / def.top);
    v.x += Math.cos(v.heading) * v.speed * dt;
    v.z += Math.sin(v.heading) * v.speed * dt;
    if (v.speed > 26) { v.airborne = true; v.y = 1; v.vy = 4; }
    v.x = Math.max(-CITY.half - 6, Math.min(CITY.seaX + 120, v.x));
    v.z = Math.max(-CITY.half - 6, Math.min(CITY.half + 6, v.z));
  } else {
    v.speed = Math.max(14, Math.min(def.top, v.speed + (move.y > 0 ? 2 : -1) * dt));
    v.heading += move.x * 1.1 * dt;
    v.vy += ((move.y > 0 ? -3 : move.y < 0 ? 3 : 0) - v.vy) * Math.min(1, dt * 1.5);
    v.y += -v.vy * dt * 0.5 + 2.5 * dt; // gentle climb bias, W/S pitches
    if (v.y < 1.2) { v.y = 1.2; v.airborne = false; v.vy = 0; }
    if (v.y > 200) v.y = 200;
    v.x += Math.cos(v.heading) * v.speed * dt;
    v.z += Math.sin(v.heading) * v.speed * dt;
    v.x = Math.max(-CITY.half - 60, Math.min(CITY.seaX + 200, v.x));
    v.z = Math.max(-CITY.half - 60, Math.min(CITY.half + 60, v.z));
  }
  v.mesh.position.set(v.x, v.y, v.z);
  v.mesh.rotation.y = -v.heading;
  v.mesh.rotation.z = move.x * 0.25;
  if (v.mesh.userData.rotor) v.mesh.userData.rotor.rotation.x += dt * 30;
}

// Traffic: follow the grid, stop at red lights, keep distance from the car ahead.
export function trafficStep(v, dt, trafficLights, allVehicles) {
  if (!v.ai || v.parked) return;
  const ai = v.ai;
  // red light ahead? find the light at the target intersection
  let stopped = false;
  const along = ai.axis === 'x' ? v.x : v.z;
  const distToTarget = (ai.target - along) * ai.dir;
  if (distToTarget > 0 && distToTarget < 16) {
    for (const tl of trafficLights) {
      const onAxis = ai.axis === 'x' ? Math.abs(tl.z - ai.line) < 8 : Math.abs(tl.x - ai.line) < 8;
      const atTarget = ai.axis === 'x' ? Math.abs(tl.x - ai.target) < 8 : Math.abs(tl.z - ai.target) < 8;
      if (onAxis && atTarget) {
        const greenForMe = (ai.axis === 'x' && tl.state === 'ew') || (ai.axis === 'z' && tl.state === 'ns');
        if (!greenForMe) stopped = true;
      }
    }
  }
  // car ahead in the same lane
  if (!stopped) {
    for (const o of allVehicles) {
      if (o === v || !o.ai || o.parked) continue;
      if (o.ai.axis !== ai.axis || Math.abs(o.ai.line - ai.line) > 1) continue;
      const oAlong = ai.axis === 'x' ? o.x : o.z;
      const gap = (oAlong - along) * ai.dir;
      if (gap > 0 && gap < 9) { stopped = true; break; }
    }
  }
  if (stopped) {
    v.speed = Math.max(0, v.speed - 18 * dt);
  } else {
    v.speed = Math.min(ai.speed, v.speed + 8 * dt);
  }
  // reached the intersection: pick a new street
  if (distToTarget <= 1.5) {
    const r = Math.random();
    if (r < 0.55) {
      // straight on
      let next = null;
      for (const c of STREET_CENTERS) {
        if (ai.dir > 0 && c > ai.target + 1) { next = c; break; }
        if (ai.dir < 0 && c < ai.target - 1) next = c;
      }
      if (next === null) { ai.dir *= -1; next = ai.target; }
      ai.target = next;
    } else {
      // turn onto the crossing street
      const newAxis = ai.axis === 'x' ? 'z' : 'x';
      const newLine = ai.target;
      const newDir = Math.random() < 0.5 ? 1 : -1;
      let next = null;
      const pos = newAxis === 'x' ? v.x : v.z;
      for (const c of STREET_CENTERS) {
        if (newDir > 0 && c > pos + 1) { next = c; break; }
        if (newDir < 0 && c < pos - 1) next = c;
      }
      if (next === null) { ai.dir *= -1; next = ai.target; }
      ai.axis = newAxis;
      ai.line = newLine;
      ai.dir = newDir;
      ai.target = next;
    }
  }
  // move along the street, in the right-hand lane
  const lane = ai.dir > 0 ? ai.lane : -ai.lane;
  if (ai.axis === 'x') {
    v.x += ai.dir * v.speed * dt;
    v.z += (ai.line + lane - v.z) * Math.min(1, dt * 3);
    v.heading = ai.dir > 0 ? 0 : Math.PI;
  } else {
    v.z += ai.dir * v.speed * dt;
    v.x += (ai.line + lane - v.x) * Math.min(1, dt * 3);
    v.heading = ai.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
  }
  // wrap around the city edges so traffic never runs out
  if (v.x > CITY.half + 4) v.x = -CITY.half - 4;
  if (v.x < -CITY.half - 4) v.x = CITY.half + 4;
  if (v.z > CITY.half + 4) v.z = -CITY.half - 4;
  if (v.z < -CITY.half - 4) v.z = CITY.half + 4;
  v.mesh.position.set(v.x, 0, v.z);
  v.mesh.rotation.y = -v.heading;
  spinWheels(v, dt);
  // brake light when slowing
  v.brake = stopped && v.speed < ai.speed * 0.5;
}

export function setVehicleLights(v, night01, braking, indicatorOn) {
  const u = v.mesh.userData;
  if (u.headMat) u.headMat.emissiveIntensity = 0.3 + night01 * 3.2;
  if (u.brakeMat) u.brakeMat.emissiveIntensity = braking ? 3.2 : 0.3;
  if (u.indicatorMat) u.indicatorMat.emissiveIntensity = indicatorOn ? 2.5 : 0;
  if (u.lightPool) {
    const on = night01 > 0.2;
    u.lightPool.visible = on;
    if (on) u.lightPool.material.opacity = 0.18 * night01;
  }
  if (u.lightR && u.lightB) {
    const t = performance.now() / 1000 + v.sirenPhase;
    const on = Math.sin(t * 9) > 0;
    u.lightR.material.emissiveIntensity = on ? 3.5 : 0.1;
    u.lightB.material.emissiveIntensity = on ? 0.1 : 3.5;
    // ground glow pulses in sync with the bar — red wash, then blue wash
    if (u.glowR) u.glowR.material.opacity = on ? 0.30 : 0.04;
    if (u.glowB) u.glowB.material.opacity = on ? 0.04 : 0.30;
  } else if (u.lightR) {
    const on = Math.sin(performance.now() / 1000 * 7 + v.sirenPhase) > 0;
    u.lightR.material.emissiveIntensity = on ? 3.5 : 0.1;
  }
  // helicopter tail strobe: short white double-blink
  if (u.strobe) {
    const s = Math.sin(performance.now() / 1000 * 7 + v.sirenPhase);
    u.strobe.material.emissiveIntensity = s > 0.7 ? 5 : 0.1;
  }
}

export function randomTrafficType(rng) {
  const pool = ['sedan', 'sedan', 'hatchback', 'suv', 'pickup', 'van', 'taxi', 'taxi', 'sports', 'muscle', 'convertible', 'jeep', 'motorbike', 'bicycle', 'truck', 'bus'];
  return rng.pick(pool);
}

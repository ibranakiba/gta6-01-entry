// Crown Bay — render.js rewritten in recorded session fix7, 18 Nov 2026.
// The three.js renderer and camera, kept apart from the game rules so the
// world module never touches the canvas directly. The game owns the scene;
// this module owns the WebGL context, the resize handling and the draw call.
import * as THREE from 'three';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';

export function createRenderer(canvas) {
  // preserveDrawingBuffer keeps the last presented frame readable by the
  // compositor (and by screenshot/capture tooling). Without it, headless
  // SwiftShader builds can present a stale/blank region of the canvas
  // (a dark square where the frame was never composited). The cost is
  // negligible for a low-poly scene and it makes the game capture-friendly.
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 1200);

  window.addEventListener('resize', () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
  });

  return {
    renderer,
    camera,
    draw(scene) {
      renderer.render(scene, camera);
    },
  };
}

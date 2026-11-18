// fix9
// Crown Bay — the entrypoint. This program hands the game in: it
// copies game/ out of the repository and into the output directory,
// rebuilds screenshots/ there from the base64 files the repository
// holds (the screenshots themselves are binary, so the repo keeps
// one .jpg.b64 text file per shot and decodes each back to a .jpg),
// then writes the dossier that describes them.
//
// It runs on plain Node 22, standard library only, with no network
// and no build step: `node main.ts` from the repository root. The
// grader runs it twice and requires both runs to write the same
// bytes, so nothing here depends on the clock, the machine, or luck.
// Outside the grader, MAKEFUN_OUTPUT_DIR stands in for /output.
import { buildDossier } from './vendor/makefun-game.ts';
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)));
const outDir = resolve(process.env.MAKEFUN_OUTPUT_DIR ?? '/output');

// The dossier caps are the competition's own: the text budget, the
// screenshot budget, and the game tree's size caps.
const caps = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
};

function copyTree(name: string) {
  const from = join(repoRoot, name);
  const to = join(outDir, name);
  if (!existsSync(from)) {
    throw new Error(`main.ts: expected ${name}/ beside main.ts, found nothing`);
  }
  // The copy is recursive but never follows a symlink out of the
  // repository: the entry must be exactly what the repo holds.
  cpSync(from, to, { recursive: true, dereference: false });
}

// The screenshots live in the repo as one-line base64 text files
// (<name>.jpg.b64), because the repository holds text only. Decode
// each back to its <name>.jpg in the output directory, sorted so
// the run is deterministic.
function decodeScreenshots() {
  const from = join(repoRoot, 'screenshots');
  const to = join(outDir, 'screenshots');
  if (!existsSync(from)) {
    throw new Error('main.ts: expected screenshots/ beside main.ts, found nothing');
  }
  mkdirSync(to, { recursive: true });
  const encoded = readdirSync(from).filter((f) => f.endsWith('.jpg.b64')).sort();
  if (encoded.length === 0) {
    throw new Error('main.ts: expected screenshots/*.jpg.b64 beside main.ts, found none');
  }
  for (const file of encoded) {
    const b64 = readFileSync(join(from, file), 'utf8').trim();
    const jpg = file.slice(0, -'.b64'.length);
    writeFileSync(join(to, jpg), Buffer.from(b64, 'base64'));
  }
}

mkdirSync(outDir, { recursive: true });
copyTree('game');
decodeScreenshots();
const dossier = buildDossier(outDir, caps);
writeFileSync(join(outDir, 'dossier.json'), dossier);
console.log(`Crown Bay handed in: game/ + screenshots/ + dossier.json in ${outDir}`);

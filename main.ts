// Build entry for the grader: stage the playable game and its contact-sheet pictures in
// MAKEFUN_OUTPUT_DIR, then write dossier.json — the one file the judge reads.
//
// Node's standard library only, no network, and the same bytes every run. Run it with:
//   MAKEFUN_OUTPUT_DIR=out node main.ts
//
// The heavy lifting (outline, screenshot validation, limits, stable JSON) belongs to the
// kit's buildDossier, vendored unchanged at ./vendor/makefun-game.ts.

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

/** Caps copied from the scorer's gate, so a build that would be refused fails here first. */
export const LIMITS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
} as const;

const repo = fileURLToPath(new URL('.', import.meta.url));

export interface StageReport {
  output: string;
  game: string;
  screenshots: string[];
  dossier: string;
}

/**
 * Copy `game/` and `screenshots/` into `out`, then build the dossier next to them.
 * Throws before writing anything if a required directory is missing, so a broken
 * submission never looks like a complete one.
 */
export function stage(out: string): StageReport {
  const game = join(repo, 'game');
  const shots = join(repo, 'screenshots');
  if (!existsSync(join(game, 'index.html'))) {
    throw new Error(`missing game entry: ${join(game, 'index.html')}`);
  }
  if (!existsSync(shots)) {
    throw new Error(`missing screenshots directory: ${shots}`);
  }
  const pictures = readdirSync(shots).filter((name) => /\.(png|jpe?g)$/i.test(name));
  if (pictures.length < 3) {
    throw new Error(`need 3-4 screenshots in ${shots}, found ${pictures.length}`);
  }

  mkdirSync(out, { recursive: true });
  cpSync(game, join(out, 'game'), { recursive: true });
  cpSync(shots, join(out, 'screenshots'), { recursive: true });

  const dossier = join(out, 'dossier.json');
  writeFileSync(dossier, buildDossier(out, LIMITS));
  const bytes = statSync(dossier).size;
  if (bytes > 1_572_864) {
    throw new Error(`dossier.json is ${bytes} bytes, over the 1.5 MiB cap`);
  }
  return { output: out, game: join(out, 'game'), screenshots: pictures, dossier };
}

// The gate calls this file directly; MAKEFUN_OUTPUT_DIR names the sandbox mount.
export const output = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
const report = stage(output);
const size = statSync(report.dossier).size;
console.log(`staged ${report.screenshots.length} screenshots -> ${report.game}`);
console.log(`wrote ${report.dossier} (${size} bytes)`);

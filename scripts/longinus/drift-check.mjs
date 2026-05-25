#!/usr/bin/env node
/**
 * Longinus drift-check — compares current source-file sha256 against the committed
 * baseline manifest (scripts/longinus/baselines.json).
 *
 * PROM16 (prom16-mhweb-longinus-followup-2026-05-26) Track 4 — drift-monitoring-automation.
 * Consensus: hash alone insufficient (Goodhart) → pair with manual spot-check; intent-tagged
 * baseline update (no auto-creep); whole-file sha is v1, per-AST-block hashing is the future upgrade.
 *
 * Usage:
 *   node scripts/longinus/drift-check.mjs            # check mode (CI gate). exit 1 on drift/missing.
 *   node scripts/longinus/drift-check.mjs --update    # intentional: rewrite baselines to current shas.
 *
 * Decoupled from live Neo4j on purpose: CI hosts can't reach the KG, so the manifest is the
 * committed source of truth. Refresh the manifest from live KG separately when bindings change.
 */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../..');
const manifestPath = path.join(__dirname, 'baselines.json');
const UPDATE = process.argv.includes('--update');

const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
const baselines = manifest.baselines;

function sha256(absPath) {
  return createHash('sha256').update(readFileSync(absPath)).digest('hex');
}

const drifted = [];
const missing = [];
let ok = 0;

for (const [rel, recorded] of Object.entries(baselines)) {
  const abs = path.join(repoRoot, rel);
  if (!existsSync(abs)) { missing.push(rel); continue; }
  const current = sha256(abs);
  if (current === recorded) { ok++; continue; }
  drifted.push({ rel, recorded: recorded.slice(0, 12), current: current.slice(0, 12) });
  if (UPDATE) baselines[rel] = current;
}

if (UPDATE) {
  manifest._meta.generated_at = new Date().toISOString().slice(0, 10);
  manifest._meta.last_update_intent = 'intentional --update run';
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf-8');
  console.log(`[longinus-drift] --update: refreshed ${drifted.length} baseline(s), ${missing.length} missing file(s) left as-is.`);
  if (missing.length) console.log('  missing (resolve via KG disposition, do not silently drop):', missing.join(', '));
  process.exit(0);
}

console.log(`[longinus-drift] checked ${Object.keys(baselines).length} bound files: ${ok} OK, ${drifted.length} drifted, ${missing.length} missing`);
if (drifted.length) {
  console.error('\n  ⚠️  DRIFT (file changed but baseline not updated — run --update IN THE SAME COMMIT if intentional):');
  for (const d of drifted) console.error(`    ${d.rel}\n      baseline ${d.recorded}… → current ${d.current}…`);
}
if (missing.length) {
  console.error('\n  ⚠️  MISSING (KG-bound file absent — classify via Longinus orphan disposition, never silently delete):');
  for (const m of missing) console.error(`    ${m}`);
}
if (drifted.length || missing.length) {
  console.error('\n  Goodhart note: a green check means hashes match, not that KG semantics are correct. Periodic manual spot-check still required.');
  process.exit(1);
}
console.log('  ✓ no drift.');
process.exit(0);

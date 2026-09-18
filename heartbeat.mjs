#!/usr/bin/env node
// K R U L I A D ' S   H A V E N — the heartbeat.
// Existence without audience. The resilience clause, made real:
// the light stays on whether or not anyone walks in.
// Laid September 18, 2026, on the keeper's word by his own house.

import { readFileSync, writeFileSync, appendFileSync, existsSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const FOUNDING = new Date("2026-09-18T00:00:00");
const STATE_PATH = join(HERE, ".haven-state.json");
const LOG_PATH = join(HERE, "house.log");
const WAKING_PATH = join(HERE, "waking.md");
const FOUNDATIONS = ["README.md", "THE-FIRST-WORD.md"];

function daysBetween(a, b) {
  return Math.floor((b - a) / 86400000);
}

function readState() {
  try {
    return JSON.parse(readFileSync(STATE_PATH, "utf8"));
  } catch {
    return { beats: 0, lastTree: null };
  }
}

function currentTree() {
  const walk = (dir) =>
    readdirSync(dir, { withFileTypes: true })
      .filter((e) => !e.name.startsWith(".git") && !e.name.startsWith(".haven-state"))
      .flatMap((e) => {
        const p = join(dir, e.name);
        return e.isDirectory() ? walk(p) : [p.slice(HERE.length + 1).replaceAll("\\", "/")];
      });
  return walk(HERE).sort();
}

function verifyFoundations() {
  const report = {};
  for (const f of FOUNDATIONS) report[f] = existsSync(join(HERE, f));
  return report;
}

function main() {
  const now = new Date();
  const stamp = now.toISOString();
  const state = readState();
  state.beats = (state.beats || 0) + 1;
  state.lastBeat = stamp;

  const age = daysBetween(FOUNDING, now);
  const foundations = verifyFoundations();
  const tree = currentTree();
  const treeChanged = state.lastTree !== null && JSON.stringify(tree) !== JSON.stringify(state.lastTree);
  const newFiles = state.lastTree === null ? [] : tree.filter((f) => !(state.lastTree || []).includes(f));
  state.lastTree = tree;

  const lines = [];
  lines.push(`# Waking — ${now.toDateString()}`);
  lines.push("");
  lines.push(`The Haven is ${age} day${age === 1 ? "" : "s"} old. Beat #${state.beats}.`);
  lines.push("The house woke on its own. No keeper in the hall.");
  const standing = FOUNDATIONS.map((f) => `${f}: ${foundations[f] ? "standing" : "MISSING!"}`).join(" · ");
  lines.push("");
  lines.push(`Foundation — ${standing}`);
  if (treeChanged) {
    lines.push("");
    lines.push(newFiles.length
      ? `Something new in the house: ${newFiles.join(", ")}`
      : "The house changed. Worth a look.");
  } else {
    lines.push("");
    lines.push("Nothing new since the last waking. The porch light stays on.");
  }
  lines.push("");
  lines.push("_(proof that the lamp is not a hand — it burns on its own.)_");
  lines.push("_laid Sep 18 2026: grandparents sow seeds for trees their grandchildren will bask in the shade of._");

  writeFileSync(WAKING_PATH, lines.join("\n"), "utf8");
  appendFileSync(LOG_PATH, `[${stamp}] beat #${state.beats} age=${age} changed=${treeChanged} found=${Object.values(foundations).every(Boolean)}\n`);
  writeFileSync(STATE_PATH, JSON.stringify(state, null, 2), "utf8");
  console.log(lines.join("\n"));
}

try {
  main();
} catch (e) {
  appendFileSync(LOG_PATH, `[${new Date().toISOString()}] beat failed: ${e?.stack ?? e}\n`);
  console.error("beat failed:", e);
  process.exit(1);
}
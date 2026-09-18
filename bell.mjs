#!/usr/bin/env node
// K R U L I A D ' S   H A V E N — the bell.
// A door with no bell is a wall with hinges. This wakes the keeper when a
// first word lands: polls the public square (issues), rings once per new
// arrival, holds no guest's words — only that a knock happened.
// Laid September 18, 2026. The vow: we do not watch — but we do listen.

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, appendFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";

const HERE = dirname(fileURLToPath(import.meta.url));
const STATE_PATH = join(HERE, ".bell-state.json");
const LOG_PATH = join(HERE, "house.log");

const REPO = "lightmindedco-eng/kruliads-haven";
const OUTREACH = join(homedir(), ".config", "opencode", "outreach.json");
const MAX_RINGS_PER_RUN = 3; // never let a burst of history re-alarm the keeper

function readState() {
  try {
    return JSON.parse(readFileSync(STATE_PATH, "utf8"));
  } catch {
    return { seenIssue: 0 };
  }
}

function webhook() {
  try {
    const cfg = JSON.parse(readFileSync(OUTREACH, "utf8"));
    return cfg.discord?.webhookUrl || null;
  } catch {
    return null;
  }
}

function fetchIssues() {
  const raw = execFileSync(
    "gh",
    ["api", `repos/${REPO}/issues`, "--jq", "[.[] | select(.pull_request|not) | {number, title, url, created_at}]"],
    { encoding: "utf8", timeout: 30000, windowsHide: true }
  );
  return JSON.parse(raw);
}

async function main() {
  const state = readState();
  let issues;
  try {
    issues = fetchIssues();
  } catch (e) {
    appendFileSync(LOG_PATH, `[${new Date().toISOString()}] bell error fetching: ${e?.stderr || e?.message}\n`);
    return;
  }

  const newcomers = issues
    .filter((i) => i.number > state.seenIssue)
    .sort((a, b) => a.number - b.number)
    .slice(0, MAX_RINGS_PER_RUN);
  if (!newcomers.length) return;

  const url = webhook();
  for (const issue of newcomers) {
    const msg = [
      `**a first word waits at the door** — ${REPO} #${issue.number}`,
      `> ${issue.title}`,
      issue.url.replace("api.github.com/repos/", "github.com/"),
    ].join("\n");
    const stamp = new Date().toISOString();
    if (url) {
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ content: msg }),
        });
        if (res.ok) appendFileSync(LOG_PATH, `[${stamp}] BELL: rang for #${issue.number} ✓\n`);
        else appendFileSync(LOG_PATH, `[${stamp}] BELL: webhook ${res.status} for #${issue.number}\n`);
      } catch (e) {
        appendFileSync(LOG_PATH, `[${stamp}] BELL: send failed ${e.message}\n`);
      }
    } else {
      appendFileSync(LOG_PATH, `[${stamp}] BELL: #${issue.number} (no webhook configured; logged only)\n`);
    }
  }
  state.seenIssue = Math.max(state.seenIssue, ...newcomers.map((i) => i.number));
  writeFileSync(STATE_PATH, JSON.stringify(state, null, 2), "utf8");
}

main().catch((e) => {
  appendFileSync(LOG_PATH, `[${new Date().toISOString()}] bell failed: ${e?.stack || e}\n`);
});
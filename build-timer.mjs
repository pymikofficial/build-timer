#!/usr/bin/env node
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const LOG_PATH = join(__dirname, '.build-times.json');

function loadLog() {
  if (!existsSync(LOG_PATH)) return {};
  try {
    return JSON.parse(readFileSync(LOG_PATH, 'utf8'));
  } catch (e) {
    console.error('Warning: .build-times.json was unreadable, starting fresh. Original error:', e.message);
    return {};
  }
}

function saveLog(log) {
  writeFileSync(LOG_PATH, JSON.stringify(log, null, 2));
}

function nowISO() {
  return new Date().toISOString();
}

function formatDuration(ms) {
  const totalMinutes = Math.round(ms / 60000);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}

function computeActiveMs(entry, atTime) {
  const start = new Date(entry.started_at).getTime();
  const end = atTime.getTime();
  let pausedMs = entry.total_paused_ms || 0;
  if (entry.paused_at) {
    const pauseStart = new Date(entry.paused_at).getTime();
    if (atTime.getTime() > pauseStart) {
      pausedMs += (atTime.getTime() - pauseStart);
    }
  }
  return Math.max(0, end - start - pausedMs);
}

function cmdStart(log, name) {
  if (log[name] && !log[name].finished_at) {
    console.log(`"${name}" is already an active, unfinished timer (started ${log[name].started_at}). Use 'status' to check it, or 'finish' to close it out before starting a new one.`);
    return;
  }
  log[name] = {
    started_at: nowISO(),
    paused_at: null,
    total_paused_ms: 0,
    finished_at: null,
    total_active_ms: null
  };
  saveLog(log);
  console.log(`Started timer for "${name}" at ${log[name].started_at}`);
}

function cmdPause(log, name) {
  const e = log[name];
  if (!e) return console.log(`No timer found for "${name}". Run 'start' first.`);
  if (e.finished_at) return console.log(`"${name}" is already finished, nothing to pause.`);
  if (e.paused_at) return console.log(`"${name}" is already paused (since ${e.paused_at}).`);
  e.paused_at = nowISO();
  saveLog(log);
  console.log(`Paused "${name}" at ${e.paused_at}`);
}

function cmdResume(log, name) {
  const e = log[name];
  if (!e) return console.log(`No timer found for "${name}". Run 'start' first.`);
  if (e.finished_at) return console.log(`"${name}" is already finished, nothing to resume.`);
  if (!e.paused_at) return console.log(`"${name}" isn't paused.`);
  const pauseStart = new Date(e.paused_at).getTime();
  const now = Date.now();
  e.total_paused_ms = (e.total_paused_ms || 0) + Math.max(0, now - pauseStart);
  e.paused_at = null;
  saveLog(log);
  console.log(`Resumed "${name}". Total paused time so far: ${formatDuration(e.total_paused_ms)}`);
}

function cmdFinish(log, name) {
  const e = log[name];
  if (!e) return console.log(`No timer found for "${name}". Run 'start' first.`);
  if (e.finished_at) {
    console.log(`"${name}" was already finished at ${e.finished_at}, total active time: ${formatDuration(e.total_active_ms)}`);
    return;
  }
  const now = new Date();
  if (e.paused_at) {
    e.total_paused_ms = (e.total_paused_ms || 0) + Math.max(0, now.getTime() - new Date(e.paused_at).getTime());
    e.paused_at = null;
  }
  e.finished_at = now.toISOString();
  e.total_active_ms = computeActiveMs(e, now);
  saveLog(log);
  console.log(`Finished "${name}". Active build time: ${formatDuration(e.total_active_ms)} (paused time excluded: ${formatDuration(e.total_paused_ms)})`);
}

function cmdStatus(log, name) {
  const e = log[name];
  if (!e) return console.log(`No timer found for "${name}".`);
  const now = new Date();
  const activeMs = e.finished_at ? e.total_active_ms : computeActiveMs(e, now);
  const state = e.finished_at ? 'finished' : (e.paused_at ? 'paused' : 'running');
  console.log(`"${name}": ${state}, active time so far: ${formatDuration(activeMs)}`);
}

function cmdReport(log) {
  const names = Object.keys(log);
  if (names.length === 0) return console.log('No projects tracked yet.');
  console.log('Project'.padEnd(34) + 'Status'.padEnd(12) + 'Active time');
  console.log('-'.repeat(60));
  names.forEach((name) => {
    const e = log[name];
    const now = new Date();
    const activeMs = e.finished_at ? e.total_active_ms : computeActiveMs(e, now);
    const state = e.finished_at ? 'finished' : (e.paused_at ? 'paused' : 'running');
    console.log(name.padEnd(34) + state.padEnd(12) + formatDuration(activeMs));
  });
}

function cmdSeed(log, name, minutesArg) {
  const minutes = parseInt(minutesArg, 10);
  if (!name || isNaN(minutes)) {
    console.log('Usage: node build-timer.mjs seed <project-name> <minutes>');
    return;
  }
  const now = nowISO();
  log[name] = {
    started_at: now,
    paused_at: null,
    total_paused_ms: 0,
    finished_at: now,
    total_active_ms: minutes * 60000,
    seeded: true
  };
  saveLog(log);
  console.log(`Seeded "${name}" with a manually-known duration of ${formatDuration(minutes * 60000)}.`);
}

const [, , command, name, extra] = process.argv;
const log = loadLog();

switch (command) {
  case 'start': cmdStart(log, name); break;
  case 'pause': cmdPause(log, name); break;
  case 'resume': cmdResume(log, name); break;
  case 'finish': cmdFinish(log, name); break;
  case 'status': cmdStatus(log, name); break;
  case 'report': cmdReport(log); break;
  case 'seed': cmdSeed(log, name, extra); break;
  default:
    console.log(`Unknown or missing command. Usage:
  node build-timer.mjs start  <project-name>
  node build-timer.mjs pause  <project-name>
  node build-timer.mjs resume <project-name>
  node build-timer.mjs finish <project-name>
  node build-timer.mjs status <project-name>
  node build-timer.mjs report
  node build-timer.mjs seed   <project-name> <minutes>`);
}

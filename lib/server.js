#!/usr/bin/env node
/**
 * harvest serve -- local HTTP server for the harvest retrospective dashboard
 *
 * Sprint analytics: type distribution, evidence quality, velocity, decay alerts.
 * SSE for live updates. Zero npm dependencies (node:http only).
 *
 * Usage:
 *   harvest serve [--port 9096] [--root /path/to/sprints]
 */

import { createServer } from 'node:http';
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, resolve, extname, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const PUBLIC_DIR = join(__dirname, '..', 'public');

// ── CLI args ──────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
function arg(name, fallback) {
  const i = args.indexOf(`--${name}`);
  return i !== -1 && args[i + 1] ? args[i + 1] : fallback;
}

const PORT = parseInt(arg('port', '9096'), 10);
const ROOT = resolve(arg('root', process.cwd()));

// ── Load existing CJS modules via createRequire ──────────────────────────────

const { analyze } = require('./analyzer.js');
const { measureVelocity } = require('./velocity.js');
const { checkDecay } = require('./decay.js');
const { calibrate } = require('./calibration.js');

// ── Sprint discovery ─────────────────────────────────────────────────────────

function discoverSprints(rootDir) {
  const sprints = [];
  if (!existsSync(rootDir)) return sprints;

  // Check if root itself is a sprint
  const directClaims = join(rootDir, 'claims.json');
  if (existsSync(directClaims)) {
    sprints.push(loadSingleSprint(rootDir));
    return sprints;
  }

  // Scan subdirectories
  try {
    const entries = readdirSync(rootDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (entry.name.startsWith('.')) continue;
      const sprintDir = join(rootDir, entry.name);
      const claimsPath = join(sprintDir, 'claims.json');
      if (existsSync(claimsPath)) {
        sprints.push(loadSingleSprint(sprintDir));
      }
    }
  } catch { /* skip if unreadable */ }

  return sprints;
}

function loadSingleSprint(dir) {
  const sprint = {
    name: basename(dir),
    dir,
    claims: [],
    compilation: null,
    gitLog: [],
  };

  const claimsPath = join(dir, 'claims.json');
  try {
    const raw = JSON.parse(readFileSync(claimsPath, 'utf8'));
    sprint.claims = Array.isArray(raw) ? raw : raw.claims || [];
  } catch { /* skip */ }

  const compilationPath = join(dir, 'compilation.json');
  if (existsSync(compilationPath)) {
    try {
      sprint.compilation = JSON.parse(readFileSync(compilationPath, 'utf8'));
    } catch { /* skip */ }
  }

  // Git log for velocity
  try {
    const { execSync } = require('node:child_process');
    sprint.gitLog = execSync(
      `git log --oneline --format="%H|%ai|%s" -- claims.json`,
      { cwd: dir, encoding: 'utf8', timeout: 5000, stdio: ['pipe', 'pipe', 'pipe'] }
    ).trim().split('\n').filter(Boolean).map(line => {
      const [hash, date, ...msg] = line.split('|');
      return { hash, date, message: msg.join('|') };
    });
  } catch {
    sprint.gitLog = [];
  }

  return sprint;
}

// ── State ─────────────────────────────────────────────────────────────────────

let state = {
  sprints: [],
  lastRefresh: null,
};

const sseClients = new Set();

function broadcast(event) {
  const data = `data: ${JSON.stringify(event)}\n\n`;
  for (const res of sseClients) {
    try { res.write(data); } catch { sseClients.delete(res); }
  }
}

function refreshState() {
  state.sprints = discoverSprints(ROOT);
  state.lastRefresh = new Date().toISOString();
  broadcast({ type: 'state', data: { sprintCount: state.sprints.length, lastRefresh: state.lastRefresh } });
}

// ── MIME types ────────────────────────────────────────────────────────────────

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function jsonResponse(res, code, data) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

// ── HTTP server ───────────────────────────────────────────────────────────────

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // ── SSE endpoint ──
  if (req.method === 'GET' && url.pathname === '/events') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });
    res.write(`data: ${JSON.stringify({ type: 'state', data: { sprintCount: state.sprints.length, lastRefresh: state.lastRefresh } })}\n\n`);
    sseClients.add(res);
    req.on('close', () => sseClients.delete(res));
    return;
  }

  // ── API: list sprints ──
  if (req.method === 'GET' && url.pathname === '/api/sprints') {
    refreshState();
    const sprintList = state.sprints.map(s => ({
      name: s.name,
      dir: s.dir,
      claimCount: s.claims.length,
      hasCompilation: !!s.compilation,
      gitCommits: s.gitLog.length,
    }));
    jsonResponse(res, 200, { sprints: sprintList });
    return;
  }

  // ── API: full analysis of a sprint ──
  if (req.method === 'GET' && url.pathname.startsWith('/api/analysis/')) {
    const sprintName = decodeURIComponent(url.pathname.slice('/api/analysis/'.length));
    if (!sprintName) { jsonResponse(res, 400, { error: 'missing sprint name' }); return; }

    // Refresh and find the sprint
    refreshState();
    const sprint = state.sprints.find(s => s.name === sprintName);
    if (!sprint) { jsonResponse(res, 404, { error: `sprint "${sprintName}" not found` }); return; }

    const analysis = analyze([sprint]);
    const velocity = measureVelocity([sprint]);

    jsonResponse(res, 200, {
      sprint: sprintName,
      analysis,
      velocity,
    });
    return;
  }

  // ── API: calibration (all sprints) ──
  if (req.method === 'GET' && url.pathname === '/api/calibration') {
    refreshState();
    if (state.sprints.length === 0) {
      jsonResponse(res, 200, { calibration: { summary: { totalSprints: 0 }, sprints: [] } });
      return;
    }
    const result = calibrate(state.sprints);
    jsonResponse(res, 200, { calibration: result });
    return;
  }

  // ── API: decay detection ──
  if (req.method === 'GET' && url.pathname === '/api/decay') {
    const days = parseInt(url.searchParams.get('days') || '30', 10);
    refreshState();
    if (state.sprints.length === 0) {
      jsonResponse(res, 200, { decay: { summary: { totalClaims: 0 }, stale: [], decaying: [], unresolved: [] } });
      return;
    }
    const result = checkDecay(state.sprints, { thresholdDays: days });
    jsonResponse(res, 200, { decay: result });
    return;
  }

  // ── API: dashboard summary (all sprints combined) ──
  if (req.method === 'GET' && url.pathname === '/api/dashboard') {
    refreshState();
    if (state.sprints.length === 0) {
      jsonResponse(res, 200, {
        sprintCount: 0,
        totalClaims: 0,
        analysis: null,
        velocity: null,
        decay: null,
      });
      return;
    }
    const analysis = analyze(state.sprints);
    const velocity = measureVelocity(state.sprints);
    const decay = checkDecay(state.sprints, { thresholdDays: 30 });

    jsonResponse(res, 200, {
      sprintCount: state.sprints.length,
      totalClaims: state.sprints.reduce((a, s) => a + s.claims.length, 0),
      analysis,
      velocity,
      decay,
    });
    return;
  }

  // ── Static files ──
  let filePath = url.pathname === '/' ? '/index.html' : url.pathname;
  filePath = join(PUBLIC_DIR, filePath);

  if (existsSync(filePath) && !statSync(filePath).isDirectory()) {
    const ext = extname(filePath);
    const mime = MIME[ext] || 'application/octet-stream';
    try {
      const content = readFileSync(filePath);
      res.writeHead(200, { 'Content-Type': mime });
      res.end(content);
    } catch {
      res.writeHead(500);
      res.end('read error');
    }
    return;
  }

  // ── 404 ──
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('not found');
});

// ── Start ─────────────────────────────────────────────────────────────────────

refreshState();

server.listen(PORT, () => {
  console.log(`harvest serve  http://localhost:${PORT}`);
  console.log(`  sprints: ${state.sprints.length} found`);
  console.log(`  root:    ${ROOT}`);
});

export { server, PORT };

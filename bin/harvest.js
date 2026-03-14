#!/usr/bin/env node

'use strict';

const path = require('node:path');
const fs = require('node:fs');

const { analyze } = require('../lib/analyzer.js');
const { calibrate } = require('../lib/calibration.js');
const { detectPatterns } = require('../lib/patterns.js');
const { checkDecay } = require('../lib/decay.js');
const { measureVelocity } = require('../lib/velocity.js');
const { generateReport } = require('../lib/report.js');

const USAGE = `
harvest -- learn from every decision you've made

Usage:
  harvest analyze <sprints-dir>       Cross-sprint claim analysis
  harvest calibrate <sprints-dir>     Score predictions against outcomes
  harvest patterns <sprints-dir>      Detect decision patterns
  harvest decay <sprints-dir>         Find claims that need refreshing
  harvest velocity <sprints-dir>      Sprint timing and phase analysis
  harvest report <sprints-dir> [-o <output>]  Generate retrospective HTML
  harvest trends <sprints-dir>        All analyses in one pass

Options:
  -o, --output <path>   Output file path (default: stdout or ./retrospective.html)
  -h, --help            Show this help
  --json                Output as JSON instead of text
  --days <n>            Decay threshold in days (default: 90)
`.trim();

function parseArgs(argv) {
  const args = argv.slice(2);
  const parsed = { command: null, dir: null, output: null, json: false, days: 90 };

  if (args.length === 0 || args.includes('-h') || args.includes('--help')) {
    console.log(USAGE);
    process.exit(0);
  }

  parsed.command = args[0];
  parsed.dir = args[1] ? path.resolve(args[1]) : null;

  for (let i = 2; i < args.length; i++) {
    if ((args[i] === '-o' || args[i] === '--output') && args[i + 1]) {
      parsed.output = path.resolve(args[++i]);
    } else if (args[i] === '--json') {
      parsed.json = true;
    } else if (args[i] === '--days' && args[i + 1]) {
      parsed.days = parseInt(args[++i], 10);
    }
  }

  return parsed;
}

function loadSprintData(dir) {
  if (!dir || !fs.existsSync(dir)) {
    console.error(`Error: directory not found: ${dir}`);
    process.exit(1);
  }

  const sprints = [];
  const stat = fs.statSync(dir);

  // If dir itself contains claims.json, treat it as a single sprint
  const directClaims = path.join(dir, 'claims.json');
  if (fs.existsSync(directClaims)) {
    sprints.push(loadSingleSprint(dir));
    return sprints;
  }

  // Otherwise scan subdirectories for sprint data
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const sprintDir = path.join(dir, entry.name);
    const claimsPath = path.join(sprintDir, 'claims.json');
    if (fs.existsSync(claimsPath)) {
      sprints.push(loadSingleSprint(sprintDir));
    }
  }

  if (sprints.length === 0) {
    console.error(`Error: no sprint data found in ${dir}`);
    console.error('Expected claims.json in the directory or its subdirectories.');
    process.exit(1);
  }

  return sprints;
}

function loadSingleSprint(dir) {
  const sprint = {
    name: path.basename(dir),
    dir,
    claims: [],
    compilation: null,
    gitLog: null,
  };

  const claimsPath = path.join(dir, 'claims.json');
  try {
    sprint.claims = JSON.parse(fs.readFileSync(claimsPath, 'utf8'));
    if (!Array.isArray(sprint.claims)) {
      // Handle { claims: [...] } wrapper
      sprint.claims = sprint.claims.claims || [];
    }
  } catch (e) {
    console.error(`Warning: could not parse ${claimsPath}: ${e.message}`);
  }

  const compilationPath = path.join(dir, 'compilation.json');
  if (fs.existsSync(compilationPath)) {
    try {
      sprint.compilation = JSON.parse(fs.readFileSync(compilationPath, 'utf8'));
    } catch (e) {
      // skip
    }
  }

  // Try to read git log for the sprint directory
  try {
    const { execSync } = require('node:child_process');
    sprint.gitLog = execSync(
      `git log --oneline --format="%H|%ai|%s" -- claims.json`,
      { cwd: dir, encoding: 'utf8', timeout: 5000 }
    ).trim().split('\n').filter(Boolean).map(line => {
      const [hash, date, ...msg] = line.split('|');
      return { hash, date, message: msg.join('|') };
    });
  } catch (e) {
    sprint.gitLog = [];
  }

  return sprint;
}

function output(result, opts) {
  if (opts.json) {
    console.log(JSON.stringify(result, null, 2));
  } else if (typeof result === 'string') {
    console.log(result);
  } else {
    console.log(JSON.stringify(result, null, 2));
  }
}

async function main() {
  const opts = parseArgs(process.argv);

  const commands = {
    analyze() {
      const sprints = loadSprintData(opts.dir);
      const result = analyze(sprints);
      output(result, opts);
    },
    calibrate() {
      const sprints = loadSprintData(opts.dir);
      const result = calibrate(sprints);
      output(result, opts);
    },
    patterns() {
      const sprints = loadSprintData(opts.dir);
      const result = detectPatterns(sprints);
      output(result, opts);
    },
    decay() {
      const sprints = loadSprintData(opts.dir);
      const result = checkDecay(sprints, { thresholdDays: opts.days });
      output(result, opts);
    },
    velocity() {
      const sprints = loadSprintData(opts.dir);
      const result = measureVelocity(sprints);
      output(result, opts);
    },
    report() {
      const sprints = loadSprintData(opts.dir);
      const html = generateReport(sprints, {
        analyzeFn: analyze,
        calibrateFn: calibrate,
        patternsFn: detectPatterns,
        decayFn: checkDecay,
        velocityFn: measureVelocity,
      });
      const outPath = opts.output || path.join(process.cwd(), 'retrospective.html');
      fs.writeFileSync(outPath, html, 'utf8');
      console.log(`Retrospective written to ${outPath}`);
    },
    trends() {
      const sprints = loadSprintData(opts.dir);
      const result = {
        analysis: analyze(sprints),
        calibration: calibrate(sprints),
        patterns: detectPatterns(sprints),
        decay: checkDecay(sprints, { thresholdDays: opts.days }),
        velocity: measureVelocity(sprints),
      };
      output(result, opts);
    },
  };

  if (!commands[opts.command]) {
    console.error(`Unknown command: ${opts.command}`);
    console.error(`Run "harvest --help" for usage.`);
    process.exit(1);
  }

  commands[opts.command]();
}

main();

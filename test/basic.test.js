'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const { analyze } = require('../lib/analyzer.js');
const { calibrate } = require('../lib/calibration.js');
const { detectPatterns } = require('../lib/patterns.js');
const { checkDecay } = require('../lib/decay.js');
const { measureVelocity } = require('../lib/velocity.js');

// --- Test fixtures ---

function makeSprint(name, claims, gitLog) {
  return { name, dir: `/tmp/${name}`, claims, compilation: null, gitLog: gitLog || [] };
}

const NOW = new Date().toISOString();
const OLD_DATE = new Date(Date.now() - 120 * 24 * 60 * 60 * 1000).toISOString(); // 120 days ago
const RECENT_DATE = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(); // 5 days ago

const SAMPLE_CLAIMS = [
  { id: 'd001', type: 'constraint', evidence: 'stated', status: 'active', text: 'Must use zero deps', created: OLD_DATE },
  { id: 'r001', type: 'factual', evidence: 'documented', status: 'active', text: 'Node fs.watch works on macOS', created: OLD_DATE, tags: ['node', 'fs'] },
  { id: 'r002', type: 'factual', evidence: 'web', status: 'active', text: 'SSE supported in all browsers', created: OLD_DATE, tags: ['sse', 'browser'] },
  { id: 'p001', type: 'estimate', evidence: 'tested', status: 'active', text: 'Prototype handles 100 concurrent connections', created: RECENT_DATE, confidence: 'high', tags: ['perf'] },
  { id: 'p002', type: 'recommendation', evidence: 'tested', status: 'active', text: 'Use SSE for real-time updates', created: RECENT_DATE },
  { id: 'x001', type: 'risk', evidence: 'documented', status: 'contested', text: 'fs.watch may miss events on Linux', created: RECENT_DATE },
  { id: 'e001', type: 'estimate', evidence: 'stated', status: 'active', text: 'Migration takes 2 weeks', created: OLD_DATE, confidence: 0.8, tags: ['perf'] },
  { id: 'cal001', type: 'calibration', evidence: 'production', status: 'active', text: 'Migration actually took 3 weeks', created: NOW, references: ['e001'], accurate: false, delta: 1 },
];

const SAMPLE_SPRINT = makeSprint('test-sprint', SAMPLE_CLAIMS);

// --- Analyzer tests ---

describe('analyzer', () => {
  it('counts claims correctly', () => {
    const result = analyze([SAMPLE_SPRINT]);
    assert.equal(result.summary.totalSprints, 1);
    assert.equal(result.summary.totalClaims, SAMPLE_CLAIMS.length);
  });

  it('computes type distribution', () => {
    const result = analyze([SAMPLE_SPRINT]);
    assert.equal(result.typeDistribution.factual, 2);
    assert.equal(result.typeDistribution.estimate, 2);
    assert.equal(result.typeDistribution.recommendation, 1);
  });

  it('finds weak claims', () => {
    const result = analyze([SAMPLE_SPRINT]);
    const weakIds = result.weakClaims.map(c => c.id);
    assert.ok(weakIds.includes('d001')); // stated
    assert.ok(weakIds.includes('r002')); // web
    assert.ok(weakIds.includes('e001')); // stated
  });

  it('tracks tag frequency', () => {
    const result = analyze([SAMPLE_SPRINT]);
    assert.equal(result.tagFrequency.perf, 2);
    assert.equal(result.tagFrequency.node, 1);
  });

  it('handles empty sprints', () => {
    const empty = makeSprint('empty', []);
    const result = analyze([empty]);
    assert.equal(result.summary.totalClaims, 0);
    assert.equal(result.summary.averageClaimsPerSprint, 0);
  });

  it('handles multiple sprints', () => {
    const sprint2 = makeSprint('sprint-2', [
      { id: 'r010', type: 'factual', evidence: 'tested', status: 'active', text: 'Another fact' },
    ]);
    const result = analyze([SAMPLE_SPRINT, sprint2]);
    assert.equal(result.summary.totalSprints, 2);
    assert.equal(result.summary.totalClaims, SAMPLE_CLAIMS.length + 1);
  });
});

// --- Calibration tests ---

describe('calibration', () => {
  it('matches calibration to estimates', () => {
    const result = calibrate([SAMPLE_SPRINT]);
    assert.equal(result.summary.totalEstimates, 2);
    assert.equal(result.summary.totalCalibrations, 1);
    assert.equal(result.summary.matched, 1);
  });

  it('identifies unmatched estimates', () => {
    const result = calibrate([SAMPLE_SPRINT]);
    assert.equal(result.summary.unmatched, 1);
    assert.equal(result.unmatchedEstimates[0].id, 'p001');
  });

  it('computes accuracy rate', () => {
    const result = calibrate([SAMPLE_SPRINT]);
    assert.equal(result.summary.accuracyRate, 0); // cal001 says accurate: false
  });

  it('handles no estimates', () => {
    const sprint = makeSprint('no-est', [
      { id: 'r001', type: 'factual', evidence: 'tested', status: 'active', text: 'A fact' },
    ]);
    const result = calibrate([sprint]);
    assert.equal(result.summary.totalEstimates, 0);
    assert.equal(result.summary.accuracyRate, null);
  });
});

// --- Patterns tests ---

describe('patterns', () => {
  it('detects prototype-before-recommend', () => {
    const result = detectPatterns([SAMPLE_SPRINT]);
    const protoPattern = result.patterns.find(p => p.pattern === 'prototype-before-recommend');
    assert.ok(protoPattern, 'Should detect prototype-before-recommend pattern');
  });

  it('detects adversarial testing', () => {
    const result = detectPatterns([SAMPLE_SPRINT]);
    const challenge = result.patterns.find(p => p.pattern === 'adversarial-testing');
    assert.ok(challenge, 'Should detect adversarial-testing pattern');
  });

  it('detects recommend-without-research anti-pattern', () => {
    const sprint = makeSprint('no-research', [
      { id: 'p001', type: 'recommendation', evidence: 'stated', status: 'active', text: 'Just do it' },
      { id: 'p002', type: 'recommendation', evidence: 'stated', status: 'active', text: 'And this too' },
    ]);
    const result = detectPatterns([sprint]);
    const antiPattern = result.antiPatterns.find(p => p.pattern === 'recommend-without-research');
    assert.ok(antiPattern, 'Should detect recommend-without-research');
  });

  it('handles empty sprint', () => {
    const result = detectPatterns([makeSprint('empty', [])]);
    assert.equal(result.summary.patternsFound, 0);
    assert.equal(result.summary.antiPatternsFound, 0);
  });
});

// --- Decay tests ---

describe('decay', () => {
  it('finds stale claims with volatile evidence', () => {
    const result = checkDecay([SAMPLE_SPRINT], { thresholdDays: 90 });
    const staleIds = result.stale.map(c => c.id);
    assert.ok(staleIds.includes('d001') || result.decaying.some(c => c.id === 'd001'),
      'Old stated claim should be flagged');
  });

  it('finds unresolved challenged claims', () => {
    const result = checkDecay([SAMPLE_SPRINT]);
    const unresolvedIds = result.unresolved.map(c => c.id);
    assert.ok(unresolvedIds.includes('x001'), 'Contested claim should be unresolved');
  });

  it('respects custom threshold', () => {
    const result = checkDecay([SAMPLE_SPRINT], { thresholdDays: 200 });
    // With 200-day threshold, 120-day-old claims should not be stale
    assert.equal(result.summary.staleCount, 0);
  });

  it('handles claims without dates', () => {
    const sprint = makeSprint('no-dates', [
      { id: 'r001', type: 'factual', evidence: 'web', status: 'active', text: 'No date' },
    ]);
    const result = checkDecay([sprint]);
    assert.equal(result.summary.staleCount, 0);
    assert.equal(result.summary.decayingCount, 0);
  });
});

// --- Velocity tests ---

describe('velocity', () => {
  it('computes sprint duration', () => {
    const result = measureVelocity([SAMPLE_SPRINT]);
    const sprint = result.sprints[0];
    assert.ok(sprint.durationDays > 0, 'Duration should be positive');
  });

  it('computes claims per day', () => {
    const result = measureVelocity([SAMPLE_SPRINT]);
    const sprint = result.sprints[0];
    assert.ok(sprint.claimsPerDay > 0, 'Claims per day should be positive');
  });

  it('extracts phase timings', () => {
    const result = measureVelocity([SAMPLE_SPRINT]);
    const phases = result.sprints[0].phases;
    assert.ok(phases.research, 'Should have research phase');
    assert.ok(phases.prototype, 'Should have prototype phase');
  });

  it('handles sprint with insufficient data', () => {
    const sprint = makeSprint('no-time', [
      { id: 'r001', type: 'factual', evidence: 'tested', status: 'active', text: 'No dates' },
    ]);
    const result = measureVelocity([sprint]);
    assert.equal(result.sprints[0].durationDays, null);
  });

  it('detects stalls', () => {
    const dates = [
      new Date(Date.now() - 30 * 86400000).toISOString(),
      new Date(Date.now() - 25 * 86400000).toISOString(),
      // 20-day gap
      new Date(Date.now() - 5 * 86400000).toISOString(),
    ];
    const sprint = makeSprint('stall-test', [
      { id: 'r001', type: 'factual', evidence: 'tested', status: 'active', text: 'A', created: dates[0] },
      { id: 'r002', type: 'factual', evidence: 'tested', status: 'active', text: 'B', created: dates[1] },
      { id: 'r003', type: 'factual', evidence: 'tested', status: 'active', text: 'C', created: dates[2] },
    ]);
    const result = measureVelocity([sprint]);
    assert.ok(result.sprints[0].stalls.length > 0, 'Should detect a stall');
  });
});

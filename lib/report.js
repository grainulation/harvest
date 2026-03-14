'use strict';

const fs = require('node:fs');
const path = require('node:path');

/**
 * Generate retrospective HTML reports.
 *
 * Combines all analysis modules into a single dark-themed HTML report.
 */

function generateReport(sprints, fns) {
  const analysis = fns.analyzeFn(sprints);
  const calibration = fns.calibrateFn(sprints);
  const patterns = fns.patternsFn(sprints);
  const decay = fns.decayFn(sprints);
  const velocity = fns.velocityFn(sprints);

  // Try to load template
  const templatePath = path.join(__dirname, '..', 'templates', 'retrospective.html');
  let template;
  try {
    template = fs.readFileSync(templatePath, 'utf8');
  } catch {
    template = getDefaultTemplate();
  }

  // Inject data into template
  const html = template
    .replace('{{GENERATED_DATE}}', new Date().toISOString().split('T')[0])
    .replace('{{SPRINT_COUNT}}', String(analysis.summary.totalSprints))
    .replace('{{CLAIM_COUNT}}', String(analysis.summary.totalClaims))
    .replace('{{AVG_CLAIMS}}', String(analysis.summary.averageClaimsPerSprint))
    .replace('{{ACCURACY_RATE}}', calibration.summary.accuracyRate !== null ? calibration.summary.accuracyRate + '%' : 'N/A')
    .replace('{{ESTIMATE_COUNT}}', String(calibration.summary.totalEstimates))
    .replace('{{MATCHED_COUNT}}', String(calibration.summary.matched))
    .replace('{{UNMATCHED_COUNT}}', String(calibration.summary.unmatched))
    .replace('{{CALIBRATION_INSIGHT}}', escapeHtml(calibration.insight))
    .replace('{{PATTERN_COUNT}}', String(patterns.summary.patternsFound))
    .replace('{{ANTI_PATTERN_COUNT}}', String(patterns.summary.antiPatternsFound))
    .replace('{{PATTERN_INSIGHT}}', escapeHtml(patterns.insight))
    .replace('{{PATTERNS_LIST}}', renderPatternsList(patterns))
    .replace('{{ANTI_PATTERNS_LIST}}', renderAntiPatternsList(patterns))
    .replace('{{STALE_COUNT}}', String(decay.summary.staleCount))
    .replace('{{DECAYING_COUNT}}', String(decay.summary.decayingCount))
    .replace('{{UNRESOLVED_COUNT}}', String(decay.summary.unresolvedCount))
    .replace('{{DECAY_INSIGHT}}', escapeHtml(decay.insight))
    .replace('{{AVG_DURATION}}', velocity.summary.avgDurationDays !== null ? velocity.summary.avgDurationDays + ' days' : 'N/A')
    .replace('{{AVG_CLAIMS_PER_DAY}}', velocity.summary.avgClaimsPerDay !== null ? String(velocity.summary.avgClaimsPerDay) : 'N/A')
    .replace('{{TOTAL_STALLS}}', String(velocity.summary.totalStalls))
    .replace('{{VELOCITY_INSIGHT}}', escapeHtml(velocity.insight))
    .replace('{{TYPE_DISTRIBUTION}}', renderDistribution(analysis.typeDistribution))
    .replace('{{EVIDENCE_DISTRIBUTION}}', renderDistribution(analysis.evidenceDistribution))
    .replace('{{WEAK_CLAIMS_TABLE}}', renderWeakClaimsTable(analysis.weakClaims))
    .replace('{{DECAY_TABLE}}', renderDecayTable([...decay.stale, ...decay.decaying]))
    .replace('{{VELOCITY_TABLE}}', renderVelocityTable(velocity.sprints));

  return html;
}

function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderDistribution(dist) {
  return Object.entries(dist)
    .sort((a, b) => b[1] - a[1])
    .map(([key, val]) => `<div class="bar-row"><span class="bar-label">${escapeHtml(key)}</span><div class="bar" style="width: ${Math.min(100, val * 5)}%">${val}</div></div>`)
    .join('\n');
}

function renderPatternsList(patterns) {
  if (patterns.patterns.length === 0) return '<p class="muted">No positive patterns detected yet.</p>';
  return '<ul>' + patterns.patterns.map(p =>
    `<li><strong>${escapeHtml(p.pattern)}</strong> (${escapeHtml(p.sprint)}): ${escapeHtml(p.description)}</li>`
  ).join('') + '</ul>';
}

function renderAntiPatternsList(patterns) {
  if (patterns.antiPatterns.length === 0) return '<p class="muted">No anti-patterns detected.</p>';
  return '<ul>' + patterns.antiPatterns.map(p =>
    `<li class="severity-${p.severity}"><strong>${escapeHtml(p.pattern)}</strong> (${escapeHtml(p.sprint)}): ${escapeHtml(p.description)}</li>`
  ).join('') + '</ul>';
}

function renderWeakClaimsTable(claims) {
  if (claims.length === 0) return '<p class="muted">All claims have solid evidence.</p>';
  const rows = claims.slice(0, 20).map(c =>
    `<tr><td>${escapeHtml(c.id)}</td><td>${escapeHtml(c.sprint)}</td><td>${escapeHtml(c.type)}</td><td>${escapeHtml(c.evidence)}</td><td>${escapeHtml(String(c.text || ''))}</td></tr>`
  ).join('');
  return `<table><thead><tr><th>ID</th><th>Sprint</th><th>Type</th><th>Evidence</th><th>Claim</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function renderDecayTable(items) {
  if (items.length === 0) return '<p class="muted">No knowledge decay detected.</p>';
  const rows = items.slice(0, 20).map(c =>
    `<tr><td>${escapeHtml(c.id)}</td><td>${escapeHtml(c.sprint)}</td><td>${c.ageDays || '?'} days</td><td>${escapeHtml(c.reason)}</td></tr>`
  ).join('');
  return `<table><thead><tr><th>ID</th><th>Sprint</th><th>Age</th><th>Reason</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function renderVelocityTable(sprintResults) {
  if (sprintResults.length === 0) return '<p class="muted">No velocity data available.</p>';
  const rows = sprintResults.map(s =>
    `<tr><td>${escapeHtml(s.sprint)}</td><td>${s.durationDays ?? 'N/A'}</td><td>${s.totalClaims ?? '?'}</td><td>${s.claimsPerDay ?? 'N/A'}</td><td>${s.stalls.length}</td></tr>`
  ).join('');
  return `<table><thead><tr><th>Sprint</th><th>Days</th><th>Claims</th><th>Claims/Day</th><th>Stalls</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function getDefaultTemplate() {
  // Fallback inline template if file not found
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><title>Harvest Retrospective</title>
<style>body{background:#0f0f0f;color:#e5e5e5;font-family:system-ui;padding:2rem;max-width:900px;margin:0 auto}
h1,h2{color:#f97316}.muted{color:#888}</style></head>
<body><h1>Harvest Retrospective</h1><p>Generated: {{GENERATED_DATE}}</p>
<p>{{SPRINT_COUNT}} sprints, {{CLAIM_COUNT}} claims</p></body></html>`;
}

module.exports = { generateReport };

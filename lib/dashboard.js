'use strict';

const fs = require('node:fs');
const path = require('node:path');

/**
 * Slim a claims array for dashboard embedding (compact keys).
 */
function slim(claims) {
  return claims.map(c => ({
    i: c.id, t: c.type, tp: c.topic,
    c: c.content || c.text || c.claim || c.description || '',
    e: c.evidence, s: c.status,
    p: c.phase_added, ts: c.timestamp || c.created || c.date,
    cf: (c.conflicts_with || []).length > 0 ? c.conflicts_with : undefined,
    r: c.resolved_by || undefined,
    tg: (c.tags || []).length > 0 ? c.tags : undefined
  }));
}

/**
 * Load a claims.json file and return parsed data, or null on failure.
 */
function loadClaims(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

/**
 * Scan for claims.json files in target directory, archive/, and sprints/ subdirs.
 * Two levels deep to handle structures like root/sprints/<name>/claims.json.
 */
function findSprintFiles(targetDir) {
  const found = [];

  // Direct claims.json in target dir
  const direct = path.join(targetDir, 'claims.json');
  if (fs.existsSync(direct)) {
    found.push({ file: direct, name: path.basename(targetDir), cat: 'root' });
  }

  // Archive subdir (flat JSON files)
  const archiveDir = path.join(targetDir, 'archive');
  if (fs.existsSync(archiveDir) && fs.statSync(archiveDir).isDirectory()) {
    for (const f of fs.readdirSync(archiveDir)) {
      if (f.endsWith('.json') && f.includes('claims')) {
        found.push({ file: path.join(archiveDir, f), name: f.replace('.json', '').replace(/-/g, ' '), cat: 'archive' });
      }
    }
  }

  // Scan subdirectories (two levels: sprints/<name>/claims.json, examples/<name>/claims.json, etc.)
  try {
    const entries = fs.readdirSync(targetDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (entry.name.startsWith('.') || entry.name === 'archive' || entry.name === 'node_modules') continue;
      const childDir = path.join(targetDir, entry.name);
      const childClaims = path.join(childDir, 'claims.json');
      if (fs.existsSync(childClaims)) {
        found.push({ file: childClaims, name: entry.name, cat: 'active' });
      }
      // Second level
      try {
        const subEntries = fs.readdirSync(childDir, { withFileTypes: true });
        for (const sub of subEntries) {
          if (!sub.isDirectory()) continue;
          if (sub.name.startsWith('.')) continue;
          const subClaims = path.join(childDir, sub.name, 'claims.json');
          if (fs.existsSync(subClaims)) {
            found.push({ file: subClaims, name: sub.name, cat: 'active' });
          }
        }
      } catch { /* skip */ }
    }
  } catch { /* skip */ }

  return found;
}

/**
 * Load all sprint data from a target directory.
 * Returns array of { n, p, q, cat, c } sprint objects ready for template embedding.
 */
function loadSprints(targetDir) {
  const sources = findSprintFiles(targetDir);
  const sprints = [];
  for (const src of sources) {
    const data = loadClaims(src.file);
    if (!data) continue;
    const claims = Array.isArray(data) ? data : data.claims || [];
    if (claims.length === 0) continue;
    sprints.push({
      n: src.name,
      p: data.meta?.phase || 'unknown',
      q: data.meta?.question || '',
      cat: src.cat || 'active',
      c: slim(claims)
    });
  }
  return sprints;
}

/**
 * Build the dashboard HTML string from a sprints array.
 * @param {Array} sprints - Array of { n, p, q, cat, c } sprint objects
 * @returns {string} Complete HTML string
 */
function buildHtml(sprints) {
  const templatePath = path.join(__dirname, '..', 'templates', 'dashboard.html');
  const template = fs.readFileSync(templatePath, 'utf8');
  const jsonData = JSON.stringify(sprints).replace(/<\/script/gi, '<\\/script');
  return template.replace('__SPRINT_DATA__', jsonData);
}

/**
 * Return paths to all claims.json files for watching.
 */
function claimsPaths(targetDir) {
  return findSprintFiles(targetDir).map(s => s.file);
}

module.exports = { loadSprints, buildHtml, claimsPaths, findSprintFiles, slim };

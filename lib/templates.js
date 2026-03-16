'use strict';

/**
 * harvest -> barn edge: template discovery for report formatting.
 *
 * If barn is available (filesystem or HTTP), harvest can offer its
 * templates as alternative report formats. Graceful fallback to
 * harvest's built-in formatting when barn is not reachable.
 */

const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');

const BARN_PORT = 9093;
const BARN_SIBLINGS = [
  path.join(__dirname, '..', '..', 'barn', 'templates'),
  path.join(__dirname, '..', '..', '..', 'barn', 'templates'),
];

/**
 * Probe barn via filesystem (sibling checkout) or localhost API.
 * Returns { available: true, templates: [...] } or { available: false }.
 */
function discoverTemplates() {
  // Strategy 1: filesystem sibling
  for (const dir of BARN_SIBLINGS) {
    if (fs.existsSync(dir)) {
      try {
        const files = fs.readdirSync(dir).filter(f => f.endsWith('.html'));
        const templates = files.map(f => {
          const content = fs.readFileSync(path.join(dir, f), 'utf8');
          const placeholders = [...new Set(content.match(/\{\{[A-Z_]+\}\}/g) || [])];
          const commentMatch = content.match(/<!--\s*(.*?)\s*-->/);
          return {
            name: f.replace('.html', ''),
            placeholders,
            description: commentMatch ? commentMatch[1] : '',
            source: 'filesystem',
          };
        });
        return { available: true, templates, source: dir };
      } catch {
        continue;
      }
    }
  }
  return { available: false, templates: [] };
}

/**
 * Async probe: try barn's HTTP API for template list.
 * Falls back to filesystem discovery if the server is not running.
 */
function discoverTemplatesAsync() {
  return new Promise((resolve) => {
    const req = http.get(`http://127.0.0.1:${BARN_PORT}/api/state`, { timeout: 2000 }, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        try {
          const state = JSON.parse(body);
          const templates = (state.templates || []).map(t => ({
            name: t.name,
            placeholders: t.placeholders || [],
            description: t.description || '',
            source: 'http',
          }));
          resolve({ available: true, templates, source: `http://127.0.0.1:${BARN_PORT}` });
        } catch {
          resolve(discoverTemplates());
        }
      });
    });
    req.on('error', () => resolve(discoverTemplates()));
    req.on('timeout', () => { req.destroy(); resolve(discoverTemplates()); });
  });
}

module.exports = { discoverTemplates, discoverTemplatesAsync, BARN_PORT };

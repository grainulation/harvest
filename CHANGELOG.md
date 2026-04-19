# Changelog

## 1.1.2 -- 2026-04-18

### Added

- `--version` flag support in the harvest CLI

### Changed

- Refactored CLI to use `@grainulation/barn/cli` vlog

### Removed

- Dead code and unused imports flagged by eslint audit
- Dead `lib/templates.js` (zero imports)

### Docs

- Added SECURITY.md
- README honesty pass (production polish), expanded `.gitignore` to cover `.env`, deleted a stale artifact

## 1.1.1 -- 2026-04-11

### Changed

- Landing copy: metrics-from-compiler narrative
- Updated wheat ecosystem chip and added tagline to footer

### Fixed

- DeepWiki docs link (was broken)
- Wheat chip label shortened from "evidence compiler" to "compiler"

### Internal

- Removed JSDoc URLs from `farmer.js`
- Removed `publish.yml` (manual publishing); CI skips publish when the version already exists on npm
- Trimmed npm tarball — removed local-only files from the package

## 1.1.0 -- 2026-04-11

Security hardening release.

### Security

- Path traversal guard added to the static server (Rx-7)
- CSP meta tag added (Rx-6)

### Internal

- Missing runtime files added to `.gitignore` (Rx-10)

## 1.0.4 -- 2026-04-09

### Security

- Bearer token auth added to the `farmer.js` client (P0 blind-spot fix)
- `.farmer-token` and runtime files added to `.gitignore` (Rx-003)

### Fixed

- Node 18 → 20 on the landing page

### Docs

- npm badge now shows the full scoped package name

## 1.0.3 -- 2026-03-22

### Fixed

- CI: reverted `type: module` (broke CJS tests); applied Biome lint fixes

## 1.0.2 -- 2026-03-22

### Added

- Token tracker, wrapped report, and integration into the `report` command

### Changed

- DeepWiki badge, static license badge, and `type: module` consistency pass
- Aligned `engines.node` to `>=20` (removed `.0.0` suffix)

## 1.0.1 -- 2026-03-20

### Changes

- `harvest serve` now serves the web app dashboard (`public/index.html`) instead of server-generated template HTML
- Removed dead code: `SSE_SCRIPT` injection, `injectSSE()`, unused `buildHtml`/`loadDashboardSprints` imports
- Added `harvest serve` and `harvest connect farmer` documentation to README

## 1.0.0 -- 2026-03-16

Initial release.

- Sprint analytics dashboard with bar charts and velocity tracking
- Cross-sprint analysis and comparison views
- Prediction calibration scoring
- Knowledge decay detection
- Claim type distribution and evidence tier breakdown
- SSE live updates

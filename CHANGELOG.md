# Changelog

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

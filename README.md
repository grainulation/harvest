<p align="center">
  <img src="site/wordmark.svg" alt="Harvest" width="400">
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@grainulation/harvest"><img src="https://img.shields.io/npm/v/@grainulation/harvest?label=%40grainulation%2Fharvest" alt="npm version"></a> <a href="https://www.npmjs.com/package/@grainulation/harvest"><img src="https://img.shields.io/npm/dm/@grainulation/harvest" alt="npm downloads"></a> <a href="https://github.com/grainulation/harvest/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-green" alt="license"></a> <a href="https://nodejs.org"><img src="https://img.shields.io/node/v/@grainulation/harvest" alt="node"></a> <a href="https://github.com/grainulation/harvest/actions"><img src="https://github.com/grainulation/harvest/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="https://deepwiki.com/grainulation/harvest"><img src="https://deepwiki.com/badge.svg" alt="Explore on DeepWiki"></a>
</p>

<p align="center"><strong>Are your decisions getting better?</strong></p>

Harvest is the analytics layer for research sprints. It looks across sprints to find patterns, score predictions, and surface knowledge that's gone stale.

## Install

```bash
npm install -g @grainulation/harvest
```

Or use directly:

```bash
npx @grainulation/harvest analyze ./sprints/
```

## What it does

- **Cross-sprint analysis** -- claim type distributions, evidence quality, recurring themes
- **Prediction calibration** -- score past estimates against actual outcomes
- **Decision patterns** -- what research approaches lead to better results?
- **Knowledge decay** -- which old claims need refreshing before they mislead you?
- **Sprint velocity** -- how long do sprints take, where do they stall?
- **Retrospective reports** -- dark-themed HTML reports for the team

## Quick start

```bash
# Cross-sprint claim analysis
harvest analyze ./sprints/

# Score predictions against outcomes
harvest calibrate ./sprints/

# Detect decision patterns and anti-patterns
harvest patterns ./sprints/

# Find stale claims that need refreshing
harvest decay ./sprints/ --days 60

# Sprint timing and phase analysis
harvest velocity ./sprints/

# Generate a full retrospective HTML report
harvest report ./sprints/ -o retrospective.html

# All analyses in one pass
harvest trends ./sprints/ --json

# Start the live dashboard (SSE updates, dark theme)
harvest serve --root ./sprints/ --port 9096

# Connect to farmer for mobile monitoring (farmer's default port is 9090)
harvest connect farmer --url http://localhost:9090
```

## Data format

Harvest reads standard wheat sprint data:

- `claims.json` -- array of typed claims with `id`, `type`, `evidence`, `status`, `text`, `created`
- `compilation.json` -- compiled sprint state (optional, enriches analysis)
- Git history on `claims.json` -- used for velocity and timing analysis

Point harvest at a directory containing sprint subdirectories, or at a single sprint directory.

## Design

- **Reads, never writes** -- harvest is a pure analysis tool; it won't modify your sprint data
- **Git-aware** -- uses git log timestamps for velocity analysis when available
- **Composable** -- each module (analyzer, calibration, patterns, decay, velocity) works independently

## Zero third-party dependencies

Depends only on `@grainulation/barn` (internal ecosystem utilities); no third-party runtime deps. Node built-ins otherwise.

## Part of the grainulation ecosystem

| Tool                                                         | Role                                                        |
| ------------------------------------------------------------ | ----------------------------------------------------------- |
| [wheat](https://github.com/grainulation/wheat)               | Research engine -- grow structured evidence                 |
| [farmer](https://github.com/grainulation/farmer)             | Permission dashboard -- approve AI actions in real time     |
| [barn](https://github.com/grainulation/barn)                 | Shared tools -- templates, validators, sprint detection     |
| [mill](https://github.com/grainulation/mill)                 | Format conversion -- export to PDF, CSV, slides, 26 formats |
| [silo](https://github.com/grainulation/silo)                 | Knowledge storage -- reusable claim libraries and packs     |
| **harvest**                                                  | Analytics -- cross-sprint patterns and prediction scoring   |
| [orchard](https://github.com/grainulation/orchard)           | Orchestration -- multi-sprint coordination and dependencies |
| [grainulation](https://github.com/grainulation/grainulation) | Unified CLI -- single entry point to the ecosystem          |

## Releases

See [CHANGELOG.md](./CHANGELOG.md) for release history.

## License

MIT

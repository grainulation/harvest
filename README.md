# @grainulator/harvest

**Are your decisions getting better?**

Harvest is the analytics and retrospective layer for research sprints. It looks across sprints to find patterns, score predictions, and surface knowledge that's gone stale.

Learn from every decision you've made.

## What it does

- **Cross-sprint analysis** -- claim type distributions, evidence quality, recurring themes
- **Prediction calibration** -- score past estimates against actual outcomes
- **Decision patterns** -- what research approaches lead to better results?
- **Knowledge decay** -- which old claims need refreshing before they mislead you?
- **Sprint velocity** -- how long do sprints take, where do they stall?
- **Retrospective reports** -- dark-themed HTML reports for the team

## Install

```sh
npm install @grainulator/harvest
```

Or run directly:

```sh
npx @grainulator/harvest analyze ./sprints/
```

## Usage

```sh
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
```

## Data format

Harvest reads standard wheat sprint data:

- `claims.json` -- array of typed claims with `id`, `type`, `evidence`, `status`, `text`, `created`, etc.
- `compilation.json` -- compiled sprint state (optional, enriches analysis)
- Git history on `claims.json` -- used for velocity and timing analysis

Point harvest at a directory containing sprint subdirectories, or at a single sprint directory:

```
sprints/
  sprint-alpha/
    claims.json
    compilation.json
  sprint-beta/
    claims.json
```

## Design

- **Zero dependencies** -- Node built-in modules only (fs, path, child_process)
- **Reads, never writes** -- harvest is a pure analysis tool; it won't modify your sprint data
- **Git-aware** -- uses git log timestamps for velocity analysis when available
- **Composable** -- each module (analyzer, calibration, patterns, decay, velocity) works independently

## Claim types it understands

| Type | What it means |
|---|---|
| `constraint` | Hard requirements, non-negotiable |
| `factual` | Verifiable statements |
| `estimate` | Predictions, projections, ranges |
| `risk` | Potential failure modes |
| `recommendation` | Proposed courses of action |
| `feedback` | Stakeholder input |

## Evidence tiers (lowest to highest)

1. `stated` -- someone said it
2. `web` -- found online
3. `documented` -- in source code or official docs
4. `tested` -- verified via prototype or benchmark
5. `production` -- measured from live systems

## License

MIT

'use strict';

/**
 * Prediction vs outcome scoring.
 *
 * Compares estimate claims against calibrate claims (from wheat's /calibrate).
 * Answers: "How often were our estimates right?"
 *
 * Scoring:
 * - Each estimate claim gets matched to calibration claims by ID reference or tag overlap
 * - Calibration claims contain actual outcomes and a confidence delta
 * - We compute accuracy, overconfidence, and underconfidence rates
 */

const EVIDENCE_RANK = {
  stated: 1,
  web: 2,
  documented: 3,
  tested: 4,
  production: 5,
};

function calibrate(sprints) {
  const allClaims = sprints.flatMap(s => s.claims.map(c => ({ ...c, _sprint: s.name })));

  const estimates = allClaims.filter(c => c.type === 'estimate');
  const calibrations = allClaims.filter(c =>
    c.id && (c.id.startsWith('cal') || c.type === 'calibration')
  );

  // Match calibrations to estimates
  const scored = [];
  for (const cal of calibrations) {
    const refs = cal.references || cal.refs || [];
    const matchedEstimates = estimates.filter(e =>
      refs.includes(e.id) ||
      (cal.tags && e.tags && cal.tags.some(t => e.tags.includes(t)))
    );

    for (const est of matchedEstimates) {
      scored.push({
        estimateId: est.id,
        calibrationId: cal.id,
        sprint: est._sprint,
        estimateText: est.text || est.claim || est.description,
        outcomeText: cal.text || cal.claim || cal.description,
        estimateConfidence: est.confidence || null,
        actualOutcome: cal.outcome || cal.actual || null,
        accurate: cal.accurate ?? null,
        delta: cal.delta ?? null,
      });
    }
  }

  // Unmatched estimates -- predictions with no follow-up
  const scoredEstimateIds = new Set(scored.map(s => s.estimateId));
  const unmatched = estimates.filter(e => !scoredEstimateIds.has(e.id));

  // Compute aggregate stats
  const accurateCount = scored.filter(s => s.accurate === true).length;
  const inaccurateCount = scored.filter(s => s.accurate === false).length;
  const unchecked = scored.filter(s => s.accurate === null).length;

  const totalScored = accurateCount + inaccurateCount;
  const accuracyRate = totalScored > 0
    ? Math.round(accurateCount / totalScored * 100)
    : null;

  // Confidence calibration: group by confidence bucket
  const buckets = { high: { total: 0, accurate: 0 }, medium: { total: 0, accurate: 0 }, low: { total: 0, accurate: 0 } };
  for (const s of scored) {
    const conf = s.estimateConfidence;
    let bucket = 'medium';
    if (typeof conf === 'number') {
      bucket = conf >= 0.7 ? 'high' : conf >= 0.4 ? 'medium' : 'low';
    } else if (typeof conf === 'string') {
      bucket = conf.toLowerCase();
    }
    if (buckets[bucket]) {
      buckets[bucket].total++;
      if (s.accurate === true) buckets[bucket].accurate++;
    }
  }

  const calibrationScore = Object.fromEntries(
    Object.entries(buckets)
      .filter(([, v]) => v.total > 0)
      .map(([k, v]) => [k, Math.round(v.accurate / v.total * 100)])
  );

  return {
    summary: {
      totalEstimates: estimates.length,
      totalCalibrations: calibrations.length,
      matched: scored.length,
      unmatched: unmatched.length,
      accuracyRate,
    },
    calibrationByConfidence: calibrationScore,
    scored: scored.map(s => ({
      estimateId: s.estimateId,
      calibrationId: s.calibrationId,
      sprint: s.sprint,
      accurate: s.accurate,
      delta: s.delta,
    })),
    unmatchedEstimates: unmatched.map(e => ({
      id: e.id,
      sprint: e._sprint,
      text: e.text || e.claim || e.description,
      age: e.created ? daysSince(e.created) : null,
    })),
    insight: generateInsight(accuracyRate, calibrationScore, unmatched.length, estimates.length),
  };
}

function generateInsight(accuracy, byConfidence, unmatchedCount, totalEstimates) {
  const parts = [];

  if (accuracy !== null) {
    if (accuracy >= 80) {
      parts.push(`Strong calibration: ${accuracy}% of scored predictions were accurate.`);
    } else if (accuracy >= 50) {
      parts.push(`Moderate calibration: ${accuracy}% accuracy. Room for improvement.`);
    } else {
      parts.push(`Weak calibration: only ${accuracy}% accuracy. Estimates may need more evidence before committing.`);
    }
  }

  if (byConfidence.high !== undefined && byConfidence.low !== undefined) {
    if (byConfidence.high < byConfidence.low) {
      parts.push('Overconfidence detected: high-confidence predictions are less accurate than low-confidence ones.');
    }
  }

  if (totalEstimates > 0 && unmatchedCount / totalEstimates > 0.5) {
    parts.push(`${unmatchedCount} of ${totalEstimates} estimates have no calibration follow-up. Run /calibrate to close the loop.`);
  }

  return parts.length > 0 ? parts.join(' ') : 'Not enough data to generate calibration insights.';
}

function daysSince(dateStr) {
  try {
    const then = new Date(dateStr);
    const now = new Date();
    return Math.floor((now - then) / (1000 * 60 * 60 * 24));
  } catch {
    return null;
  }
}

module.exports = { calibrate };

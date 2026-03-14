'use strict';

/**
 * Knowledge freshness tracking.
 *
 * Identifies claims that may have become stale:
 * - Claims older than a threshold with no revalidation
 * - Claims referencing external tools/APIs that change frequently
 * - Claims with evidence tier "web" that are old (web content changes)
 * - Claims that were challenged but never resolved
 */

const VOLATILE_EVIDENCE = new Set(['stated', 'web']);
const DEFAULT_THRESHOLD_DAYS = 90;

function checkDecay(sprints, opts = {}) {
  const thresholdDays = opts.thresholdDays || DEFAULT_THRESHOLD_DAYS;
  const now = new Date();

  const allClaims = sprints.flatMap(s => s.claims.map(c => ({ ...c, _sprint: s.name })));

  const decaying = [];
  const stale = [];
  const unresolved = [];

  for (const claim of allClaims) {
    const created = claim.created || claim.date || claim.timestamp;
    const age = created ? daysBetween(new Date(created), now) : null;

    // Stale: old claims with volatile evidence
    if (age !== null && age > thresholdDays && VOLATILE_EVIDENCE.has(claim.evidence)) {
      stale.push({
        id: claim.id,
        sprint: claim._sprint,
        type: claim.type,
        evidence: claim.evidence,
        ageDays: age,
        text: truncate(claim.text || claim.claim || claim.description, 120),
        reason: `${claim.evidence}-tier evidence is ${age} days old (threshold: ${thresholdDays}).`,
      });
    }

    // Decaying: any claim past threshold, regardless of evidence
    if (age !== null && age > thresholdDays * 1.5) {
      decaying.push({
        id: claim.id,
        sprint: claim._sprint,
        type: claim.type,
        evidence: claim.evidence,
        ageDays: age,
        text: truncate(claim.text || claim.claim || claim.description, 120),
        reason: `Claim is ${age} days old with no revalidation.`,
      });
    }

    // Unresolved: challenged claims still marked as contested
    if (claim.status === 'contested' || claim.status === 'challenged') {
      unresolved.push({
        id: claim.id,
        sprint: claim._sprint,
        type: claim.type,
        text: truncate(claim.text || claim.claim || claim.description, 120),
        reason: 'Claim was challenged but never resolved.',
      });
    }
  }

  // Deduplicate (a claim might appear in both stale and decaying)
  const decayingIds = new Set(decaying.map(c => c.id));
  const dedupedStale = stale.filter(c => !decayingIds.has(c.id));

  // Sort by age descending
  const sortByAge = (a, b) => (b.ageDays || 0) - (a.ageDays || 0);
  decaying.sort(sortByAge);
  dedupedStale.sort(sortByAge);

  return {
    summary: {
      totalClaims: allClaims.length,
      staleCount: dedupedStale.length,
      decayingCount: decaying.length,
      unresolvedCount: unresolved.length,
      thresholdDays,
    },
    stale: dedupedStale,
    decaying,
    unresolved,
    insight: generateDecayInsight(allClaims.length, dedupedStale, decaying, unresolved),
  };
}

function daysBetween(a, b) {
  return Math.floor(Math.abs(b - a) / (1000 * 60 * 60 * 24));
}

function truncate(str, maxLen) {
  if (!str) return '';
  return str.length > maxLen ? str.slice(0, maxLen - 3) + '...' : str;
}

function generateDecayInsight(total, stale, decaying, unresolved) {
  const parts = [];

  if (decaying.length > 0) {
    parts.push(`${decaying.length} claim(s) are significantly outdated and should be revalidated or archived.`);
  }

  if (stale.length > 0) {
    parts.push(`${stale.length} claim(s) have volatile evidence (stated/web) that may no longer be accurate.`);
  }

  if (unresolved.length > 0) {
    parts.push(`${unresolved.length} challenged claim(s) remain unresolved -- use /resolve to settle them.`);
  }

  const decayRate = total > 0 ? Math.round((stale.length + decaying.length) / total * 100) : 0;
  if (decayRate > 30) {
    parts.push(`Knowledge decay rate is ${decayRate}% -- consider a refresh sprint.`);
  }

  return parts.length > 0 ? parts.join(' ') : 'Knowledge base looks fresh -- no decay detected.';
}

module.exports = { checkDecay };

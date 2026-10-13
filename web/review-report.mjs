/**
 * Pure, testable human-acknowledgement gate for explicit local JSON exports.
 * A checked item means reviewed by the user, NOT a conclusion about legality.
 */
export function buildAcknowledgedReport({
  previous, current, initialPrevious, initialCurrent,
  changes, acknowledged, generatedAt = new Date().toISOString()
}) {
  if (previous !== initialPrevious || current !== initialCurrent)
    throw new Error('Source text changed; run the comparison again before exporting.');
  if (!Array.isArray(changes) || !Array.isArray(acknowledged))
    throw new TypeError('Missing review evidence.');
  const reviewable = changes.filter(x => x?.kind !== 'SIMILAR_TEXT');
  if (reviewable.length === 0)
    throw new Error('There are no review candidates to export.');
  if (acknowledged.length !== reviewable.length || acknowledged.some(v => v !== true))
    throw new Error('Inspect and acknowledge every displayed change first.');
  return {
    schemaVersion:'ruledelta-local-review-v1',
    generatedAt,
    verifiedLegalConclusion:false,
    reviewMeaning:'The user marked each change as inspected. Accuracy and legal impact are NOT confirmed.',
    sourceText:{previous:initialPrevious,current:initialCurrent},
    changes:reviewable.map((d,i)=>({
      sourceOld:d.oldClause ?? null,
      sourceNew:d.newClause ?? null,
      category:d.categories ?? [],
      priority:d.priority,
      modelSimilarity:d.semanticSimilarity ?? null,
      riskReasons:d.reasons ?? [],
      paraphraseAdvisory:d.paraphraseHint??null,
      humanAcknowledged:acknowledged[i]
    }))
  };
}

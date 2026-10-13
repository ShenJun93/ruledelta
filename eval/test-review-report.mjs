import test from 'node:test';
import assert from 'node:assert/strict';
import {buildAcknowledgedReport} from '../web/review-report.mjs';

const changed={kind:'REVIEW_CHANGE',oldClause:'Winner receives $500 cash.',newClause:'Winner receives $500 credits.',categories:['money'],priority:'HIGH_REVIEW',semanticSimilarity:0.75};
const same={kind:'SIMILAR_TEXT',oldClause:'Minimum age is 18.',newClause:'Minimum age is 18.',semanticSimilarity:1};
const input={previous:'Winner receives $500 cash.\nMinimum age is 18.',current:'Winner receives $500 credits.\nMinimum age is 18.',initialPrevious:'Winner receives $500 cash.\nMinimum age is 18.',initialCurrent:'Winner receives $500 credits.\nMinimum age is 18.',changes:[changed,same]};

test('rejects export before explicit review',()=>{
  assert.throws(()=>buildAcknowledgedReport({...input,acknowledged:[false]}),/acknowledge/);
});
test('export keeps exact before/after and does not assert legal validity',()=>{
  const result=buildAcknowledgedReport({...input,acknowledged:[true],generatedAt:'2026-10-13T00:00:00Z'});
  assert.equal(result.schemaVersion,'ruledelta-local-review-v1');
  assert.equal(result.verifiedLegalConclusion,false);
  assert.equal(result.changes.length,1);
  assert.equal(result.changes[0].sourceOld,'Winner receives $500 cash.');
  assert.equal(result.changes[0].sourceNew,'Winner receives $500 credits.');
  assert.equal(result.changes[0].humanAcknowledged,true);
});
test('rejects stale source text changed after analysis',()=>{
  assert.throws(()=>buildAcknowledgedReport({...input,current:'After click, new source text.',acknowledged:[true]}),/changed/);
});
test('rejects missing checkbox and empty evidence',()=>{
  assert.throws(()=>buildAcknowledgedReport({...input,acknowledged:[]}),/acknowledge/);
  assert.throws(()=>buildAcknowledgedReport({...input,changes:[same],acknowledged:[]}),/no review candidates/);
});
test('rejects false or unknown checkbox state',()=>{
  assert.throws(()=>buildAcknowledgedReport({...input,acknowledged:['true']}),/acknowledge/);
});

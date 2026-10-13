/**
 * Regression probes for semantic-collision pairing and cue provenance.
 * Controlled vectors intentionally create maximum cosine ties.
 * These cases are not independent model-accuracy measurements.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {compareRules} from '../compare.mjs';

const tiedEmbed=async lines=>lines.map(()=>[1,0]);

test('unchanged reordered clauses stay unchanged even when every embedding ties',async()=>{
  const old='Winner receives 200 USD cash.\nSubmission closes October 15.\nAI usage is permitted.';
  const newer='AI usage is permitted.\nWinner receives 200 USD cash.\nSubmission closes October 15.';
  const result=await compareRules(old,newer,tiedEmbed);
  assert.equal(result.changedCount,0);
  assert.equal(result.status,'NO_TEXT_CHANGE');
});

test('one changed amount does not dislodge two unchanged clauses under ties',async()=>{
  const old='AI usage is permitted.\nWinner receives 200 USD cash.\nSubmission closes October 15.';
  const newer='Submission closes October 15.\nWinner receives 100 USD cash.\nAI usage is permitted.';
  const result=await compareRules(old,newer,tiedEmbed);
  assert.equal(result.changedCount,1);
  const [change]=result.changes.filter(x=>x.kind==='REVIEW_CHANGE');
  assert.equal(change.oldClause,'Winner receives 200 USD cash.');
  assert.equal(change.newClause,'Winner receives 100 USD cash.');
  assert.equal(change.priority,'HIGH_REVIEW');
});

test('duplicated unchanged lines retain both instances under ties',async()=>{
  const old='Video link required.\nVideo link required.\nEntry closes October 15.';
  const newer='Video link required.\nEntry closes October 22.\nVideo link required.';
  const result=await compareRules(old,newer,tiedEmbed);
  assert.equal(result.changedCount,1);
  const [change]=result.changes.filter(x=>x.kind==='REVIEW_CHANGE');
  assert.equal(change.oldClause,'Entry closes October 15.');
  assert.equal(change.newClause,'Entry closes October 22.');
});

test('permission modal may does not create a spurious deadline category',async()=>{
  const result=await compareRules('Entrants may share their work.','Entrants may not share their work.',tiedEmbed);
  const [change]=result.changes.filter(x=>x.kind==='REVIEW_CHANGE');
  assert.ok(change);
  assert.ok(!change.categories.includes('deadline'));
  assert.equal(change.priority,'HIGH_REVIEW');
});

test('calendar May and bare dollar amounts are correctly categorized',async()=>{
  const date=await compareRules('Entries close May 12.','Entries close May 13.',tiedEmbed);
  const money=await compareRules('Pay $250 now.','Pay $150 now.',tiedEmbed);
  assert.ok(date.changes.find(x=>x.kind==='REVIEW_CHANGE')?.categories.includes('deadline'));
  assert.ok(money.changes.find(x=>x.kind==='REVIEW_CHANGE')?.categories.includes('money'));
});

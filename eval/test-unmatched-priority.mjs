/**
 * Review-priority regression for unmatched structural changes.
 * This probes the priority/UX contract (not actual legal materiality).
 * Equal embeddings are deliberate; exact stable lines anchor first.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {compareRules} from '../compare.mjs';

const tied=async lines=>lines.map(()=>[1,0]);
const compare=(a,b)=>compareRules(a,b,tied);
const added=r=>r.changes.find(x=>x.kind==='UNMATCHED_NEW');
const removed=r=>r.changes.find(x=>x.kind==='UNMATCHED_OLD');

test('new cash registration fee is a HIGH review candidate, not generic review',async()=>{
  const r=await compare('Applicants must register by October 12.',
    'Applicants must register by October 12.\nApplicants must pay a $50 registration fee.');
  assert.equal(r.changedCount,1);
  assert.equal(added(r)?.newClause,'Applicants must pay a $50 registration fee.');
  assert.equal(added(r)?.priority,'HIGH_REVIEW');
  assert.ok(added(r)?.reasons.includes('CRITICAL_UNMATCHED_CLAUSE'));
});

test('deleted eligibility restriction is HIGH, not silently lower priority',async()=>{
  const r=await compare('Submissions require a public repository.\nApplicants must be residents of Vietnam.',
    'Submissions require a public repository.');
  assert.equal(r.changedCount,1);
  assert.equal(removed(r)?.priority,'HIGH_REVIEW');
});

test('new mandatory video requirement is HIGH and never ignored',async()=>{
  const r=await compare('All submissions must include source code.',
    'All submissions must include source code.\nA video demonstration is now mandatory.');
  assert.equal(r.changedCount,1);
  assert.equal(added(r)?.priority,'HIGH_REVIEW');
});

test('removed licensing terms are HIGH priority',async()=>{
  const r=await compare('The organizer receives a non-exclusive license.\nSubmit a demo link.',
    'Submit a demo link.');
  assert.equal(r.changedCount,1);
  assert.equal(removed(r)?.priority,'HIGH_REVIEW');
});

test('unmatched descriptive notice stays HUMAN_REVIEW and is still exportable',async()=>{
  const r=await compare('The organizer is Example Labs.',
    'The organizer is Example Labs.\nThe hall has blue walls.');
  assert.equal(r.changedCount,1);
  assert.equal(added(r)?.priority,'HUMAN_REVIEW');
  assert.ok(!added(r)?.reasons.includes('CRITICAL_UNMATCHED_CLAUSE'));
});

test('missing identical duplicate is tracked and prioritized with its source',async()=>{
  const r=await compare('Payment due in 10 days.\nPayment due in 10 days.',
    'Payment due in 10 days.');
  assert.equal(r.changedCount,1);
  assert.equal(removed(r)?.priority,'HIGH_REVIEW');
  assert.equal(removed(r)?.oldClause,'Payment due in 10 days.');
});

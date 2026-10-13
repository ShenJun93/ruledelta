/**
 * Safety regressions: punctuation that changes a statement into a question,
 * and English contraction-negations in eligibility/payment obligations.
 *
 * These tests use controlled embeddings; they prove deterministic handling,
 * not real-model accuracy, legal semantics, or external validation.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {compareRules} from '../compare.mjs';

const sameVectors=async x=>x.map(()=>[1,0]);
const inspect=async(a,b)=>{
  const result=await compareRules(a,b,sameVectors);
  return {result,change:result.changes.find(x=>x.kind==='REVIEW_CHANGE')};
};

test('assertion becoming a question about a payout is never silently ignored',async()=>{
  const {result,change}=await inspect('Winner receives $500.','Winner receives $500?');
  assert.equal(result.status,'REVIEW_REQUIRED');
  assert.equal(result.changedCount,1);
  assert.equal(change?.priority,'HIGH_REVIEW');
  assert.ok(change?.reasons.includes('INTERROGATIVE_STATUS_CHANGED'));
});

test('question becoming an assertion changes payment review state too',async()=>{
  const {result,change}=await inspect('Winner receives $500?','Winner receives $500.');
  assert.equal(result.changedCount,1);
  assert.equal(change?.priority,'HIGH_REVIEW');
});

test('exclamation vs period is cosmetic when the underlying words agree',async()=>{
  const {result}=await inspect('Applications close October 12!','Applications close October 12.');
  assert.equal(result.changedCount,0);
});

test('can versus cannot contraction raises a high restriction cue',async()=>{
  const {change}=await inspect('Applicants can submit remotely.','Applicants can\'t submit remotely.');
  assert.equal(change?.priority,'HIGH_REVIEW');
  assert.ok(change?.reasons.includes('PERMISSION_PAYMENT_OR_OBLIGATION_CUE_CHANGED'));
});

test('must versus must-not contraction raises a high obligation cue',async()=>{
  const {change}=await inspect('Participants must upload receipts.','Participants mustn\'t upload receipts.');
  assert.equal(change?.priority,'HIGH_REVIEW');
});

test('unchanged apostrophe contraction does not invent a risk event',async()=>{
  const {result}=await inspect('The participant can\'t resubmit.','The participant can\'t resubmit.');
  assert.equal(result.changedCount,0);
});

test('contracted negation of required obligation raises high review',async()=>{
  const {change}=await inspect('The recording is required.','The recording isn\'t required.');
  assert.equal(change?.priority,'HIGH_REVIEW');
});

test('payment question with no numeric change still flags the changed speech act',async()=>{
  const {change}=await inspect('No fees are payable.','No fees are payable?');
  assert.equal(change?.priority,'HIGH_REVIEW');
});

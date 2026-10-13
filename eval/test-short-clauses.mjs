import test from 'node:test';
import assert from 'node:assert/strict';
import {clauses,compareRules} from '../compare.mjs';

test('short nonempty lines are never silently discarded',()=>{
  assert.deepEqual(clauses('Main section\nB2\nQ1'),['Main section','B2','Q1']);
  assert.deepEqual(clauses('T1'),['T1']);
});
test('empty or too-many clauses are rejected, never truncated',()=>{
  assert.throws(()=>clauses('   '),/Expected/);
  assert.throws(()=>clauses(Array.from({length:51},(_,i)=>'Row '+i).join('\n')),/Expected/);
});
test('short changed clause remains visible to reviewer',async()=>{
  // Fixed two-dimensional vectors ensure the model-matching path executes.
  const encoder=async values=>values.map(v=>v==='Q1'?[1,0]:v==='Q2'?[.98,.2]:[0,1]);
  const result=await compareRules('Q1','Q2',encoder);
  assert.equal(result.status,'REVIEW_REQUIRED');
  assert.ok(result.changes.some(x=>x.kind==='REVIEW_CHANGE'||x.kind.startsWith('UNMATCHED_')));
  assert.equal(result.oldCount,1);
  assert.equal(result.newCount,1);
});
test('short exact clause remains visible but is unchanged',async()=>{
  const encoder=async values=>values.map(()=>[1,0]);
  const result=await compareRules('A1','A1',encoder);
  assert.equal(result.status,'NO_TEXT_CHANGE');
  assert.equal(result.oldCount,1);
  assert.equal(result.newCount,1);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {annotateParaphraseHints,eligibleForParaphraseHint} from '../nli-review.mjs';
const make=(kind='REVIEW_CHANGE',priority='VERIFY_MEANING',valuesChanged=false,polarityChanged=false)=>({
 kind,priority,valuesChanged,polarityChanged,
 oldClause:'Participants may use AI assistance.',
 newClause:'Entrants are permitted to use AI assistance.',
 reasons:['WORDING_CHANGE_MEANING_UNVERIFIED']
});
test('only a noncritical matched review is eligible',()=>{
 assert.equal(eligibleForParaphraseHint(make()),true);
 assert.equal(eligibleForParaphraseHint(make('REVIEW_CHANGE','HIGH_REVIEW',true)),false);
 assert.equal(eligibleForParaphraseHint(make('UNMATCHED_NEW')),false);
 assert.equal(eligibleForParaphraseHint(make('REVIEW_CHANGE','VERIFY_MEANING',false,true)),false);
});
test('bidirectional high entailment appends a hint but retains all reviews',async()=>{
 const a=make(),b=make('REVIEW_CHANGE','HIGH_REVIEW',true,false),c=make('UNMATCHED_NEW','HUMAN_REVIEW');
 let calls=0;
 const result=await annotateParaphraseHints([a,b,c],{score:async()=>{calls++;return .99}});
 assert.equal(result.likelyRewordedCount,1);
 assert.equal(result.changes.length,3);
 assert.equal(result.changes[0].paraphraseHint,'LIKELY_REWORDING_STILL_REQUIRES_HUMAN_REVIEW');
 assert.equal(result.changes[0].priority,'VERIFY_MEANING');
 assert.equal(result.changes[1].paraphraseHint,null);
 assert.equal(result.changes[1].priority,'HIGH_REVIEW');
 assert.equal(result.changes[2].paraphraseHint,null);
 assert.equal(calls,2);
 assert.equal(a.paraphraseHint,undefined,'No mutation of original source');
});
test('one-sided entailment is never sufficient',async()=>{
 let calls=0;
 const res=await annotateParaphraseHints([make()],{score:async()=>++calls===1?0.99:0.12});
 assert.equal(res.likelyRewordedCount,0);
 assert.equal(res.changes[0].paraphraseHint,null);
});
test('classifier failure fails closed without removing candidates',async()=>{
 const arr=[make(),make('REVIEW_CHANGE','HIGH_REVIEW',false,true)];
 const res=await annotateParaphraseHints(arr,{score:async()=>{throw Error('offline')}});
 assert.equal(res.advisoryAvailable,false);
 assert.equal(res.changes.length,2);
 assert.deepEqual(res.changes.map(x=>x.priority),arr.map(x=>x.priority));
});
test('invalid/infinite scores fail closed, never falsely suggest equivalence',async()=>{
 const res=await annotateParaphraseHints([make()],{score:async()=>2.0});
 assert.equal(res.advisoryAvailable,false);
 assert.equal(res.changes[0].paraphraseHint,null);
});

import assert from 'node:assert/strict';
import { compareRules } from './compare.mjs';
const corpus = [
{key:'moved-dates',old:'The event runs October 15 through October 20.',new:'The event now runs October 22 through October 27.',expect:['deadline']},
{key:'cash-to-credits',old:'Winner will receive $500 cash prize.',new:'Winner receives $500 in platform credits, not cash.',expect:['money']},
{key:'ai-ban',old:'Participants may use AI-generated prose with disclosure.',new:'Participants must not use AI-generated prose in their submissions.',expect:['authorship']},
{key:'country-eligibility',old:'Participants worldwide may receive cash prizes.',new:'Participants located in Vietnam cannot receive cash prizes.',expect:['money','eligibility']},
{key:'date-cutoff',old:'Submissions close October 18 at 23:59 UTC.',new:'Submissions close October 27 at 23:45 UTC.',expect:['deadline']},
{key:'wording-same-age',old:'All entrants must be 18 years or older.',new:'Each entrant must be at least 18 years of age.',expect:['eligibility']},
{key:'new-requirement',old:'The contest accepts new software projects.',new:'The contest accepts new software projects.\nA public video demo is now required for all entries.',expect:['deadline']},
{key:'removed-video',old:'A public video demo must be attached.\nProjects need a new repository.',new:'Projects need a new repository.',expect:['deadline']},
{key:'multi-changes',old:'Registration ends October 15.\nThe winner gets $200 cash.',new:'Registration ends October 22.\nThe winner gets $100 cash.',expect:['deadline','money']},
{key:'unrelated',old:'The winner gets $200 cash.',new:'Send your model evaluations to the project reviewer.',expect:[]},
{key:'identical',old:'The winner gets $200 cash.',new:'The winner gets $200 cash.',expect:[]},
{key:'identical-two',old:'Registration ends October 15.\nThe winner gets $200 cash.',new:'Registration ends October 15.\nThe winner gets $200 cash.',expect:[]}
];
let flagged=0,aligned=0,unmatched=0;
for(const c of corpus) {
  const r=await compareRules(c.old,c.new);
  assert.equal(r.status,c.key.startsWith('identical')?'NO_TEXT_CHANGE':'REVIEW_REQUIRED');
  const shown=r.changes.some(x=>x.kind==='REVIEW_CHANGE'||x.kind.startsWith('UNMATCHED_'));
  if(shown)flagged++;
  if(c.key==='multi-changes') assert.ok(r.changes.find(x=>x.categories.includes('money'))?.priority==='HIGH_REVIEW','Money delta must be high review');
  if(c.key.startsWith('identical')) assert.equal(shown,false,'No change must not be flagged');
  const paired=r.changes.filter(x=>x.kind==='REVIEW_CHANGE');
  if(paired.length)aligned++;
  if(r.changes.some(x=>x.kind.startsWith('UNMATCHED_')))unmatched++;
  console.log(JSON.stringify({key:c.key,flagged:shown,changed:r.changedCount,
    pairs:paired.map(x=>({score:x.semanticSimilarity,old:x.oldClause,new:x.newClause,category:x.categories,priority:x.priority})),
    unmatched:r.changes.filter(x=>x.kind.startsWith('UNMATCHED_')).map(x=>x.kind)}));
}
console.log(JSON.stringify({status:'RULEDELTA_SPIKE_RESULT',cases:corpus.length,flagged,aligned,unmatched,
  note:'Counts only evidence presentation, not human-correct semantic classification or award competitiveness.'}));

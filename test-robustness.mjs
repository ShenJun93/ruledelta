import assert from 'node:assert/strict';
import {compareRules} from './compare.mjs';
const cases=[
  {name:'reorder-unchanged',old:'Winners receive $200 cash.\nRegistration ends October 15.\nAll participants must be age 18.',cur:'All participants must be age 18.\nWinners receive $200 cash.\nRegistration ends October 15.',maxChanged:0},
  {name:'reorder-amount-changed',old:'Winners receive $200 cash.\nRegistration ends October 15.\nAll participants must be age 18.',cur:'Registration ends October 15.\nAll participants must be age 18.\nWinners receive $100 cash.',changed:1,minHigh:1},
  {name:'two-edits-across-reorder',old:'Registration ends October 15.\nWinners receive $200 cash.\nAll participants must be age 18.',cur:'All participants must be age 18.\nWinners receive $100 cash.\nRegistration ends October 22.',changed:2,minHigh:2},
  {name:'one-added',old:'All entrants must be at least 18 years old.\nProject must be open source.',cur:'Project must be open source.\nAll entrants must be at least 18 years old.\nVideo demonstration is now mandatory.',changed:1},
  {name:'one-removed',old:'A cash prize of $100 is awarded.\nAll entries need a public demo.\nEntrants must be at least age 18.',cur:'Entrants must be at least age 18.\nA cash prize of $100 is awarded.',changed:1},
  {name:'date-word-paraphrase',old:'Project submissions must be uploaded by October 15.',cur:'The cutoff for project entry uploads is October 22.',changed:1,minHigh:1},
  {name:'reward-type-shift',old:'Top entrant earns $500 USD in cash.\nRegistration ends October 20.',cur:'Registration ends October 20.\nTop entrant earns $500 worth of platform credits.',changed:1,minHigh:1},
  {name:'no-edit-paragraph',old:'Contest open for teams of up to 3 people.\nPrize is paid in US dollars.',cur:'Contest open for teams of up to 3 people.\nPrize is paid in US dollars.',maxChanged:0},
  {name:'multi-year-year-changed',old:'The final video must be uploaded by October 19, 2026.\nSubmit the source repository.',cur:'The final video must be uploaded by October 19, 2027.\nSubmit the source repository.',changed:1,minHigh:1},
  {name:'independent-policy-line',old:'The use of AI tools is optional.\nOnly new software projects are eligible.',cur:'Only new software projects are eligible.\nThe use of AI tools is mandatory.',changed:1,minHigh:1}
];
let passed=0;
for (const c of cases) {
  const r=await compareRules(c.old,c.cur);
  const highs=r.changes.filter(x=>x.kind==='REVIEW_CHANGE'&&x.priority==='HIGH_REVIEW').length;
  const good=(c.changed===undefined||r.changedCount===c.changed)&&
    (c.maxChanged===undefined||r.changedCount<=c.maxChanged)&&
    (c.minHigh===undefined||highs>=c.minHigh);
  if(good)passed++;
  console.log(JSON.stringify({name:c.name,pass:good,expectChanges:c.changed??c.maxChanged,got:r.changedCount,highs,issues:r.changes.filter(x=>x.kind!=='SIMILAR_TEXT').map(x=>({kind:x.kind,priority:x.priority,old:x.oldClause,new:x.newClause}))}));
}
console.log(JSON.stringify({status:'ALIGNMENT_ROBUSTNESS_EVAL',passed,total:cases.length,
  caveat:'Small synthetic scenarios. No guarantee of legal or business correctness.'}));
if(passed!==cases.length)process.exitCode=1;

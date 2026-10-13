import assert from 'node:assert/strict';
import {compareRules} from '../compare.mjs';
import {embedWithMiniLM} from '../src/embed.mjs';
const checks=[
  {id:'renumber-only',old:'7. Teams must stop hacking when the contest ends.',
   current:'6. Teams must stop hacking when the contest ends.',changed:0,high:0},
  {id:'real-time-shift',old:'Entries close at 13:00 UTC on October 18.',
   current:'Entries close at 12:00 UTC on October 18.',changed:1,high:1},
  {id:'timezone-shift',old:'Submissions close at 17:00 UTC on November 5.',
   current:'Submissions close at 17:00 PDT on November 5.',changed:1,high:1},
  {id:'season-shift',old:'# CruzHacks 2025 Hackathon Rules',
   current:'# CruzHacks 2026 Hackathon Rules',changed:1,high:1},
  // Intentionally updated expectation: a change in month spelling is cosmetic.
  {id:'month-abbreviation-only',old:'Contest closes October 15 at 19:00 UTC.',
   current:'Contest closes Oct 15 at 19:00 UTC.',changed:0,high:0},
  {id:'punctuation-only',old:'Submissions close on the stated date.',
   current:'Submissions close on the stated date!',changed:0,high:0}
];
let pass=0;
for(const test of checks) {
 const r=await compareRules(test.old,test.current,embedWithMiniLM);
 const high=r.changes.filter(x=>x.kind==='REVIEW_CHANGE'&&x.priority==='HIGH_REVIEW').length;
 const ok=r.changedCount===test.changed&&high===test.high;
 if(ok)pass++;
 console.log(JSON.stringify({test:test.id,pass:ok,expected:{changed:test.changed,high:test.high},actual:{changed:r.changedCount,high}}));
}
console.log('NORMALIZATION_REGRESSION',pass,'/',checks.length,'PASS');
if(pass!==checks.length)process.exitCode=1;

/**
 * Experimental RuleDelta comparator — do not confuse with legal adjudication.
 * All displayed source clauses are verbatim; embedding model only aligns
 * clauses across document versions. Changed meaning is NOT guaranteed.
 */
import { embedWithMiniLM } from './src/embed.mjs';
import { cosine } from './src/cosine.mjs';

const riskRegex = {
  // Calendar months are normalized to month-N only when adjacent to a date;
  // the modal verb "may" must never be labelled as a deadline by itself.
  deadline: /\b(?:deadline|date|month-\d{1,2}|october|november|january|february|march|april|june|july|august|september|december|submit|submission|close|open|start|run|begin|end|utc|pdt)\b/i,
  // A currency symbol is not a word boundary, so it needs a separate branch.
  money: /\b(?:cash|credit|credits|usd|dollars|prize|reward|payout|receive|payment|fund|fee)\b|\$\s*\d/i,
  eligibility: /\b(?:eligible|eligibility|resident|residency|worldwide|vietnam|countries|nationalities|region|restrict|age|years old|disqualified)\b/i,
  authorship: /\b(?:ai-generated|ai-assisted|model|artificial intelligence|writing assistance|written|authorship|human-written)\b/i,
  rights: /\b(?:license|licence|exclusive|non-exclusive|nonexclusive|copyright|reproduce|distribute|royalty|ownership)\b/i
};

export function clauses(source) {
  if (typeof source !== 'string' || source.length < 1 || source.length > 16000) throw new RangeError('Each version must be nonempty and at most 16000 characters');
  // Never silently omit short clauses: amounts, age limits or dates may be short.
  const lines = source.replace(/\r\n/g, '\n').split(/\n+/).map(x => x.trim()).filter(x => x.length > 0);
  if (!lines.length || lines.length > 50) throw new RangeError('Expected 1–50 clauses per version');
  return lines;
}
function normalizedClause(text) {
  // Exclude presentation-only list numbering, not quantities within rules.
  const normalized = text.trim().replace(/^\d{1,3}[.)]\s+/, '').replace(/\s+/g,' ').trim().toLowerCase();
  // Only month names immediately preceding a numeric date are canonicalized.
  // "may" as a modal permission verb is deliberately not transformed.
  return normalized
    .replace(/\b(january|february|march|april|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec|may)\b(?=\s+\d{1,4}\b)/g, name=>normalizedMonth(name))
    // Strict modal equivalent: "are required to" and "must" impose the same duty.
    .replace(/\b(?:are|is) required to\b/g,'must');
}
function normalizedMonth(word) {
  const months=['january','february','march','april','may','june','july','august','september','october','november','december'];
  const at=months.findIndex(m=>m.startsWith(word.toLowerCase()));
  return at>=0?'month-'+String(at+1):word.toLowerCase();
}
function signals(text) {
  const normalized = normalizedClause(text);
  const category = Object.entries(riskRegex).filter(([_,r])=>r.test(normalized)).map(([k])=>k);
  // Capture *all* numeric literals, not just 1–2 digits: $200 -> $100 matters.
  // Source text itself remains untouched and is always returned verbatim.
  // Compare numeric terms, date-tied month mentions, and time zones.
  // Previous global "may" matching was unsafe: permission "may" is not the month May.
  const numbers = normalized.match(/\b\d+(?:[.,:]\d+)*\b/g) ?? [];
  const datedMonths = [...normalized.matchAll(/\b(month-\d{1,2}|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec|may)\b(?=\s+\d{1,4}\b)/g)].map(x=>normalizedMonth(x[1]));
  const timeZones = normalized.match(/\b(?:utc|pdt|pst|gmt|est|edt|cst|cdt)\b/g) ?? [];
  // Word-based explicit quantities can affect team limits or payout windows.
  // Only count numeral words tied to measurable units, not generic "one of".
  const numericWords={one:'1',two:'2',three:'3',four:'4',five:'5',six:'6',seven:'7',eight:'8',nine:'9',ten:'10',eleven:'11',twelve:'12',thirteen:'13',fourteen:'14',fifteen:'15',sixteen:'16',seventeen:'17',eighteen:'18',nineteen:'19',twenty:'20'};
  const writtenNumbers=[...normalized.matchAll(/\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty)\s+(?:persons?|people|participants?|teams?|days?|weeks?|months?|years?|hours?|minutes?|dollars?|entries|submissions?|revisions?|words?)\b/g)].map(x=>numericWords[x[1]]);
  const dates = [...numbers,...writtenNumbers,...datedMonths,...timeZones];
  const direction = [
    /\b(?:not|no|never|prohibited|cannot|must not|disallowed|excluded|(?:can|won|isn|aren|wasn|weren|doesn|don|didn|mustn|shouldn|wouldn|couldn|hasn|haven|hadn|needn)[’']t)\b/i.test(text),
    /\b(?:cash)\b/i.test(text),
    /\b(?:credits?)\b/i.test(text),
    /\b(?:may|allowed|permitted|can)\b/i.test(text),
    /\b(?:must|required|mandatory|shall)\b/i.test(text),
    /\b(?:optional|voluntary|not required)\b/i.test(text),
    /\b(?:non-exclusive|nonexclusive)\b/i.test(text)
  ];
  return {category, dates, direction};
}
function criticalDelta(oldText, newText) {
  const a=signals(oldText),b=signals(newText);
  const categories=[...new Set([...a.category,...b.category])];
  const valuesChanged=JSON.stringify(a.dates)!==JSON.stringify(b.dates);
  const polarityChanged=JSON.stringify(a.direction)!==JSON.stringify(b.direction);
  // A question is not an assertion. Preserve '?' when removing cosmetic
  // sentence punctuation: turning an award promise into a question needs review.
  const interrogativeChanged=/\?\s*$/.test(oldText)!==/\?\s*$/.test(newText);
  const exactChange=normalizedClause(oldText).replace(/[.!]+$/,'')!==normalizedClause(newText).replace(/[.!]+$/,'');
  const reasons = [];
  if (valuesChanged) reasons.push('EXPLICIT_NUMBER_DATE_OR_TIMEZONE_CUE_CHANGED');
  if (polarityChanged) reasons.push('PERMISSION_PAYMENT_OR_OBLIGATION_CUE_CHANGED');
  if (interrogativeChanged) reasons.push('INTERROGATIVE_STATUS_CHANGED');
  if (exactChange && reasons.length===0) reasons.push('WORDING_CHANGE_MEANING_UNVERIFIED');
  return {categories,valuesChanged,polarityChanged,
    critical:valuesChanged||polarityChanged||interrogativeChanged,exactChange,reasons};
}

/** Calls the real open model. It never fabricates eligibility or legal conclusions. */
export async function compareRules(oldText,newText,embed=embedWithMiniLM,{matchThreshold=0.32}={}) {
  const previous=clauses(oldText), current=clauses(newText);
  const vectors=await embed([...previous,...current]);
  if(vectors.length!==previous.length+current.length)throw new Error('Embedding shape mismatch');
  const pairs=[];
  for(let i=0;i<previous.length;i++)for(let j=0;j<current.length;j++) {
    pairs.push({oldIndex:i,newIndex:j,similarity:cosine(vectors[i],vectors[previous.length+j])});
  }
  pairs.sort((a,b)=>b.similarity-a.similarity);
  const oldUsed=new Set(),newUsed=new Set(),changes=[];
  const recordPair=(pair,matchBasis)=>{
    oldUsed.add(pair.oldIndex);newUsed.add(pair.newIndex);
    const oldClause=previous[pair.oldIndex], newClause=current[pair.newIndex];
    const delta=criticalDelta(oldClause,newClause);
    changes.push({kind:delta.exactChange?'REVIEW_CHANGE':'SIMILAR_TEXT',oldIndex:pair.oldIndex,newIndex:pair.newIndex,
      oldClause,newClause,semanticSimilarity:Number(pair.similarity.toFixed(3)),matchBasis,
      categories:delta.categories,priority:delta.critical?'HIGH_REVIEW':'VERIFY_MEANING',
      valuesChanged:delta.valuesChanged,polarityChanged:delta.polarityChanged,
      reasons:delta.reasons});
  };
  // Anchor normalized-identical clauses BEFORE approximate pairing. Generic or
  // very short clauses can have indistinguishable vectors; otherwise greedy
  // cosine ties can convert an unchanged reorder into false change alerts.
  // Queue duplicates deterministically so every occurrence is accounted for.
  const exactKey=text=>normalizedClause(text).replace(/[.!]+$/,'');
  const currentExact=new Map();
  for(let j=0;j<current.length;j++){
    const key=exactKey(current[j]);
    if(!currentExact.has(key))currentExact.set(key,[]);
    currentExact.get(key).push(j);
  }
  for(let i=0;i<previous.length;i++){
    const queue=currentExact.get(exactKey(previous[i]));
    if(!queue?.length)continue;
    const j=queue.shift();
    const similarity=cosine(vectors[i],vectors[previous.length+j]);
    recordPair({oldIndex:i,newIndex:j,similarity},'NORMALIZED_EXACT');
  }
  for(const pair of pairs) {
    if(pair.similarity < matchThreshold)break;
    if(oldUsed.has(pair.oldIndex)||newUsed.has(pair.newIndex))continue;
    recordPair(pair,'SEMANTIC_MINILM');
  }
  // Added/removed clauses are already mandatory human-review items. Some
  // contain explicit fee, deadline, eligibility, rights or obligation cues:
  // surface them as HIGH without pretending their legal effect is known.
  // This does not delete, merge or waive any unmatched candidate.
  const unmatchedRisk=(text)=>{
    const cues=signals(text);
    const high=cues.category.some(x=>['money','deadline','eligibility','rights'].includes(x))||
      /\b(?:must|required|mandatory|shall|prohibited|forbidden|disallowed|excluded|cannot|not allowed)\b/i.test(text);
    return {priority:high?'HIGH_REVIEW':'HUMAN_REVIEW',categories:cues.category,
      extraReasons:high?['CRITICAL_UNMATCHED_CLAUSE']:[]};
  };
  for(let i=0;i<previous.length;i++)if(!oldUsed.has(i)){
    const risk=unmatchedRisk(previous[i]);
    changes.push({kind:'UNMATCHED_OLD',oldIndex:i,oldClause:previous[i],newClause:null,
      priority:risk.priority,semanticSimilarity:null,categories:risk.categories,
      reasons:['CLAUSE_NOT_PAIRED_IN_NEW_VERSION',...risk.extraReasons]});
  }
  for(let j=0;j<current.length;j++)if(!newUsed.has(j)){
    const risk=unmatchedRisk(current[j]);
    changes.push({kind:'UNMATCHED_NEW',newIndex:j,oldClause:null,newClause:current[j],
      priority:risk.priority,semanticSimilarity:null,categories:risk.categories,
      reasons:['NEW_CLAUSE_NOT_PAIRED_IN_OLD_VERSION',...risk.extraReasons]});
  }
  const trueChanges=changes.filter(x=>x.kind!=='SIMILAR_TEXT');
  return {
    status:trueChanges.length?'REVIEW_REQUIRED':'NO_TEXT_CHANGE',
    engine:'REAL_CPU_MINILM_SEMANTIC_CLAUSE_ALIGNMENT',
    message:'Candidate changes only. Semantics, enforceability, dates and award eligibility require checking official originals with a human.',
    oldCount:previous.length,newCount:current.length,
    changedCount:trueChanges.length,
    changes:changes.sort((a,b)=>(a.oldIndex??999)-(b.oldIndex??999))
  };
}

/**
 * Optional CPU-only natural language inference review assistance.
 *
 * NLI can only ADD an advisory to an existing VERIFY_MEANING record.
 * It NEVER discards clauses, lowers mandatory human review, changes
 * HIGH_REVIEW risk signals, or asserts legal equivalence.
 *
 * Pair API is tokenizer(premise,{text_pair:hypothesis,...}); DO NOT pass
 * {text,text_pair} to TextClassificationPipeline._call (silently incorrect).
 */
import {env,pipeline} from '@huggingface/transformers';
import {resolve} from 'node:path';
const MODEL='schift-io/schift-nli';
const CUE='LIKELY_REWORDING_STILL_REQUIRES_HUMAN_REVIEW';
let modelPromise;
async function scorer(a,b){
  if(!modelPromise){
    modelPromise=(async()=>{
      env.cacheDir=resolve('.cache');
      return pipeline('text-classification',MODEL,{device:'cpu',dtype:'q8'});
    })();
  }
  const p=await modelPromise;
  const encoded=p.tokenizer(a,{text_pair:b,padding:true,truncation:true});
  const logits=(await p.model(encoded)).logits.tolist()[0];
  const maximum=Math.max(...logits);
  const exp=logits.map(x=>Math.exp(x-maximum));
  const total=exp.reduce((a,b)=>a+b,0);
  const labels=p.model.config.id2label;
  const byLabel=Object.fromEntries(exp.map((x,i)=>[String(labels[i]).toLowerCase(),x/total]));
  const score=byLabel.entailment;
  if(!Number.isFinite(score)||score<0||score>1)throw new Error('Invalid NLI output');
  return score;
}
export function eligibleForParaphraseHint(record){
  return record?.kind==='REVIEW_CHANGE'&&record?.priority==='VERIFY_MEANING'&&
    record?.valuesChanged===false&&record?.polarityChanged===false&&
    typeof record.oldClause==='string'&&typeof record.newClause==='string';
}
export async function annotateParaphraseHints(changes,{
  score=scorer,threshold=0.9
}={}){
  if(!Array.isArray(changes))throw new TypeError('Changes array required');
  if(typeof score!=='function'||!Number.isFinite(threshold)||threshold<=0||threshold>=1)
    throw new TypeError('Invalid conservative classifier');
  const out=changes.map(c=>({...c,paraphraseHint:null}));
  let unavailable=false;
  for(const record of out){
    if(!eligibleForParaphraseHint(record))continue;
    if(unavailable)continue;
    try {
      // Model entails in BOTH directions, a stronger condition than one-sided entailment.
      const forward=await score(record.oldClause,record.newClause);
      const reverse=await score(record.newClause,record.oldClause);
      if(!Number.isFinite(forward)||!Number.isFinite(reverse)||
        forward<0||reverse<0||forward>1||reverse>1)throw new Error('Invalid inference scores');
      const symmetric=Math.min(forward,reverse);
      if(Number.isFinite(symmetric)&&symmetric>=threshold) {
        record.paraphraseHint=CUE;
        // Score is diagnostic, not a calibrated probability of equivalence.
        record.nliMutualEntailment=Number(symmetric.toFixed(4));
      }
    }catch{
      // Safe failure: preserve the original review candidate and its risk level.
      unavailable=true;
    }
  }
  return {
    changes:out,
    advisoryModel:MODEL,
    advisoryAvailable:!unavailable,
    likelyRewordedCount:out.filter(c=>c.paraphraseHint===CUE).length,
    disclaimer:'Advisory NLI score is not an assessed legal equivalence probability. Every change still requires human inspection.'
  };
}

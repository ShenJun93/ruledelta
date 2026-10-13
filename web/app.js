import { buildAcknowledgedReport } from '/review-report.mjs';

const oldEl=document.getElementById('previous');
const newEl=document.getElementById('current');
const btn=document.getElementById('go');
const status=document.getElementById('status');
const results=document.getElementById('results');
let activeExportGate=null;
// Export must visibly lock as soon as either source is edited, rather than
// relying only on the fail-closed JSON helper when a stale button is clicked.
for(const field of [oldEl,newEl])field.addEventListener('input',()=>{
  if(!activeExportGate)return;
  if(oldEl.value!==activeExportGate.previous||newEl.value!==activeExportGate.current){
    activeExportGate.button.disabled=true;
    status.textContent='Source text changed; run Compare again before exporting.';
  }
});
const el=(tag,content='',cls='')=>{
  const node=document.createElement(tag);
  node.textContent=String(content);
  if(cls)node.className=cls;
  return node;
};
function sourceLine(parent,title,text) {
  const section=el('div','','source');
  section.append(el('div',title,'mini'),el('blockquote',text??'No matching clause'));
  parent.append(section);
}
btn.addEventListener('click',async()=>{
  // A new analysis invalidates the previous export decision immediately.
  activeExportGate=null;
  const input={previous:oldEl.value,current:newEl.value};
  btn.disabled=true;
  status.textContent='Running local MiniLM + cautious NLI review + Mastra…';
  results.replaceChildren(el('p','Analyzing both versions…','waiting'));
  try{
    const response=await fetch('/api/compare',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify(input)
    });
    const data=await response.json();
    if(!response.ok)throw new Error(data.detail??data.error??'Local inference failed');
    results.replaceChildren();
    const reviewable=data.changes.filter(x=>x.kind!=='SIMILAR_TEXT');
    results.append(el('div',
      reviewable.length?'Changes that need your inspection':'No review candidates after cosmetic normalization',
      'result-head'));
    results.append(el('p',
      reviewable.length+' candidate change(s) · '+data.highPriorityCount+
      ' high priority. Embedding similarity is not legal certainty.','fine'));
    if(data.nliStatus==='UNAVAILABLE'){
      results.append(el('p','Optional local NLI comparison was unavailable. Every clause remains flagged for human review.','warning'));
    }else if(data.nliStatus==='COMPLETE'){
      results.append(el('p','A second local model checked low-risk rewordings only. All review obligations remain in force.','fine'));
    }
    const checked=Array(reviewable.length).fill(false);
    const exportButton=el('button','Export acknowledged review JSON','export');
    exportButton.disabled=true;
    exportButton.type='button';
    const progress=el('p','0 / '+reviewable.length+' reviewed','fine');
    reviewable.forEach((change,index)=>{
      const card=el('article','','change');
      const heading=el('div','','line');
      heading.append(
        el('span',change.priority,'tag'),
        el('span',(change.categories??[]).join(' · ')||'Review clause','mini'));
      card.append(heading);
      sourceLine(card,'BEFORE · exact source text',change.oldClause);
      sourceLine(card,'AFTER · exact source text',change.newClause);
      card.append(el('p',change.semanticSimilarity==null?
        'Unmatched clause': 'Embedding similarity '+Number(change.semanticSimilarity).toFixed(3),'fine'));
      const why=(change.reasons??[]).map(code=>({
        EXPLICIT_NUMBER_DATE_OR_TIMEZONE_CUE_CHANGED:'Numeric, date, or timezone tokens differ.',
        PERMISSION_PAYMENT_OR_OBLIGATION_CUE_CHANGED:'Payment, permission, or duty wording triggers differ.',
        INTERROGATIVE_STATUS_CHANGED:'A question and a stated rule or promise are different; verify which version is authoritative.',
        WORDING_CHANGE_MEANING_UNVERIFIED:'The wording differs; meaning is not verified.',
        CLAUSE_NOT_PAIRED_IN_NEW_VERSION:'Old clause has no sufficiently close new match.',
        NEW_CLAUSE_NOT_PAIRED_IN_OLD_VERSION:'New clause has no sufficiently close previous match.',
        CRITICAL_UNMATCHED_CLAUSE:'An added or removed clause mentions an explicit deadline, payment, eligibility, rights or obligation cue. Inspect the original text; importance is not legally verified.'
      })[code]??'Review signal: '+code);
      card.append(el('p','Why flagged: '+(why.join(' ')||'Review the original sources.'),'reason'));
      if(change.paraphraseHint==='LIKELY_REWORDING_STILL_REQUIRES_HUMAN_REVIEW'){
        card.append(el('p','Possible equivalent rewording (CPU NLI suggestion only). The original source and human review remain required.','nli-hint'));
      }
      const label=el('label','','review-check');
      const tick=document.createElement('input');
      tick.type='checkbox';
      tick.setAttribute('aria-label','Inspected change '+(index+1));
      label.append(tick,el('span','I checked this pair against the original terms (not legal approval).'));
      tick.addEventListener('change',()=>{
        checked[index]=tick.checked;
        const count=checked.filter(Boolean).length;
        progress.textContent=count+' / '+checked.length+' reviewed';
        exportButton.disabled=count!==checked.length ||
          oldEl.value!==input.previous || newEl.value!==input.current;
      });
      card.append(label);
      results.append(card);
    });
    if(!reviewable.length){
      results.append(el('p',
        'No differences were found after limited cosmetic normalization. Wording can still differ; verify the originals before acting.','waiting'));
    }else{
      activeExportGate={button:exportButton,previous:input.previous,current:input.current};
      const controls=el('div','','toolbar');
      controls.append(exportButton,progress);
      results.append(controls);
      exportButton.addEventListener('click',()=>{
        try {
          const report=buildAcknowledgedReport({
            previous:oldEl.value,current:newEl.value,
            initialPrevious:input.previous,initialCurrent:input.current,
            changes:data.changes,acknowledged:checked
          });
          // This explicit click is the only export. Input is never autosaved.
          const blob=new Blob([JSON.stringify(report,null,2)+'\n'],{type:'application/json'});
          const href=URL.createObjectURL(blob);
          const link=document.createElement('a');
          link.href=href;
          link.download='ruledelta-local-review.json';
          link.click();
          URL.revokeObjectURL(href);
          status.textContent='Report exported locally by your explicit action.';
        } catch(error) {
          status.textContent=error.message;
          exportButton.disabled=true;
        }
      });
    }
    results.append(el('p',
      'Verify official original sources before acting. A checked item means inspected only. No eligibility, contract, or payment decision is made automatically.','warning'));
    status.textContent=oldEl.value===input.previous&&newEl.value===input.current
      ?'Comparison complete · brief was not stored or sent to a hosted AI service.'
      :'Source text changed during analysis; run Compare again before exporting.';
  }catch(error){
    results.replaceChildren(el('p','No reliable comparison: '+error.message,'warning'));
    status.textContent='Analysis unavailable. No decision or export created.';
  }finally{btn.disabled=false;}
});

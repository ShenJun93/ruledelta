import {createStep,createWorkflow} from '@mastra/core/workflows';
import {z} from 'zod';
import {compareRules,clauses} from './compare.mjs';
import {annotateParaphraseHints,eligibleForParaphraseHint} from './nli-review.mjs';

/** Actual Mastra pipeline over a real local open-weight inference step. */
const inputSchema=z.object({previous:z.string(),current:z.string()});
const analysisSchema=z.object({
  status:z.string(),changedCount:z.number(),oldCount:z.number(),newCount:z.number(),
  changes:z.array(z.any()),nliStatus:z.enum(['COMPLETE','UNAVAILABLE','NOT_NEEDED']).optional()
});
const outputSchema=z.object({
  outcome:z.enum(['NO_TEXT_CHANGE','HUMAN_REVIEW_REQUIRED']),
  needsHumanApproval:z.boolean(),
  highPriorityCount:z.number().int(),
  nliStatus:z.enum(['COMPLETE','UNAVAILABLE','NOT_NEEDED']),
  changes:z.array(z.any())
});
const validate=createStep({
  id:'validate-local-documents',inputSchema,outputSchema:inputSchema,
  execute:async({inputData})=>{
    clauses(inputData.previous);clauses(inputData.current);
    return inputData;
  }
});
const align=createStep({
  id:'real-mini-lm-semantic-diff',inputSchema,outputSchema:analysisSchema,
  execute:async({inputData})=>{
    const r=await compareRules(inputData.previous,inputData.current);
    return {status:r.status,changedCount:r.changedCount,
      oldCount:r.oldCount,newCount:r.newCount,changes:r.changes};
  }
});
const advisory=createStep({
  id:'local-nli-paraphrase-advisory',inputSchema:analysisSchema,outputSchema:analysisSchema,
  execute:async({inputData})=>{
    const needed=inputData.changes.some(eligibleForParaphraseHint);
    const nli=await annotateParaphraseHints(inputData.changes);
    // All original review records and numeric/polarity priorities are preserved.
    const nliStatus=!needed?'NOT_NEEDED':nli.advisoryAvailable?'COMPLETE':'UNAVAILABLE';
    return {...inputData,changes:nli.changes,nliStatus};
  }
});
const requireHuman=createStep({
  id:'fail-closed-review-gate',inputSchema:analysisSchema,outputSchema,
  execute:async({inputData})=>({
    outcome:inputData.changedCount?'HUMAN_REVIEW_REQUIRED':'NO_TEXT_CHANGE',
    needsHumanApproval:Boolean(inputData.changedCount),
    highPriorityCount:inputData.changes.filter(x=>x.priority==='HIGH_REVIEW').length,
    nliStatus:inputData.nliStatus??'UNAVAILABLE',
    changes:inputData.changes
  })
});
export const ruleDeltaWorkflow=createWorkflow({
  id:'rule-delta-local-open-weight-review',
  inputSchema,outputSchema
}).then(validate).then(align).then(advisory).then(requireHuman).commit();

if(process.argv[1]?.endsWith('mastra-workflow.mjs')){
  const run=await ruleDeltaWorkflow.createRun();
  const result=await run.start({
    inputData:{
      previous:'Hackathon runs October 15 through October 20.\nWinner gets $500 cash.',
      current:'Hackathon runs October 22 through October 27.\nWinner gets $500 in platform credits, not cash.'
    }
  });
  const output=result.status==='success'?result.result:null;
  if(!output||!output.needsHumanApproval||output.changes.length<2)
    throw new Error('Mastra workflow or model result was not verified');
  console.log(JSON.stringify({workflow:'REAL_MASTRA_WORKFLOW_PASS',steps:[
    'validate-local-documents','real-mini-lm-semantic-diff',
    'local-nli-paraphrase-advisory','fail-closed-review-gate'
  ],runStatus:result.status,outcome:output.outcome,highPriorityCount:output.highPriorityCount,
  changes:output.changes.map(x=>({priority:x.priority,old:x.oldClause,new:x.newClause,score:x.semanticSimilarity}))},null,2));
}

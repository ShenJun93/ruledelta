/** Standalone release candidate HTTP acceptance. Real MiniLM + Mastra, no browser bypass. */
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {setTimeout as delay} from 'node:timers/promises';
const server=spawn(process.execPath,['server.mjs'],{stdio:['ignore','pipe','pipe'],windowsHide:true});
let stdout='',stderr='';
server.stdout.on('data',x=>stdout+=x.toString());
server.stderr.on('data',x=>stderr+=x.toString());
try{
 let ready=false;
 for(let attempt=0;attempt<90;attempt++){
   if(server.exitCode!==null)throw new Error('Local server stopped: '+stderr.slice(-450));
   if(stdout.includes('RULEDELTA_LOCAL_READY')){
     try{if((await fetch('http://127.0.0.1:4318/')).ok){ready=true;break}}catch{}
   }
   await delay(100);
 }
 assert.ok(ready,'Local server did not report ready '+stderr.slice(-450));
 const previous='A winner receives $500 cash.\nEntries close October 15.';
 const current='A winner receives $500 platform credits.\nEntries close October 22.';
 const response=await fetch('http://127.0.0.1:4318/api/compare',{
  method:'POST',headers:{'Content-Type':'application/json'},
  body:JSON.stringify({previous,current})
 });
 assert.equal(response.status,200);
 const result=await response.json();
 assert.equal(result.outcome,'HUMAN_REVIEW_REQUIRED');
 assert.equal(result.highPriorityCount,2);
 assert.equal(result.changes.filter(x=>x.kind==='REVIEW_CHANGE').length,2);
 const blocked=await fetch('http://127.0.0.1:4318/api/compare',{
  method:'POST',headers:{'Content-Type':'application/json','Origin':'https://external.invalid'},
  body:JSON.stringify({previous,current})
 });
 assert.equal(blocked.status,403);
 console.log('RULEDELTA_STANDALONE_REAL_HTTP_PASS',JSON.stringify({alerts:result.highPriorityCount,originDenied:blocked.status}));
}catch(e){
 console.error('RULEDELTA_STANDALONE_REAL_HTTP_FAIL',e.message);
 process.exitCode=1;
}finally{server.kill();}

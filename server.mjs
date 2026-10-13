import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {ruleDeltaWorkflow} from './mastra-workflow.mjs';

const port=4318, host='127.0.0.1';
const trustedHosts=new Set(['127.0.0.1:4318','localhost:4318']);
const trustedOrigins=new Set(['http://127.0.0.1:4318','http://localhost:4318']);
const assets=new Map([
  ['/', ['./web/index.html','text/html; charset=utf-8']],
  ['/app.js',['./web/app.js','text/javascript; charset=utf-8']],
  ['/review-report.mjs',['./web/review-report.mjs','text/javascript; charset=utf-8']],
  ['/style.css',['./web/style.css','text/css; charset=utf-8']]
]);
http.createServer(async(req,res)=>{
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Content-Security-Policy',"default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'");
  if(!trustedHosts.has(req.headers.host)||(req.headers.origin&&!trustedOrigins.has(req.headers.origin))) {
    res.writeHead(403).end('Forbidden origin');return;
  }
  if(req.method==='GET'&&assets.has(req.url)){
    const [source,type]=assets.get(req.url);
    try{res.writeHead(200,{'Content-Type':type});res.end(await readFile(new URL(source,import.meta.url)));}
    catch{res.writeHead(500).end('Static asset unavailable');}
    return;
  }
  if(req.method==='POST'&&req.url==='/api/compare'){
    if(!req.headers['content-type']?.toLowerCase().startsWith('application/json')){
      res.writeHead(415).end('Expected application/json');return;
    }
    let body='',oversized=false;
    req.on('data',chunk=>{
      if(oversized)return;
      body+=chunk.toString();
      if(Buffer.byteLength(body,'utf8')>34000){
        oversized=true;body='';
        res.writeHead(413).end('Input too long');
      }
    });
    req.on('end',async()=>{
      if(oversized)return;
      try{
        const data=JSON.parse(body);
        if(typeof data.previous!=='string'||typeof data.current!=='string')
          throw new TypeError('Two text versions required');
        const run=await ruleDeltaWorkflow.createRun();
        const result=await run.start({inputData:{previous:data.previous,current:data.current}});
        if(result.status!=='success')throw new Error('Mastra workflow not completed');
        res.writeHead(200,{'Content-Type':'application/json; charset=utf-8'});
        res.end(JSON.stringify(result.result));
      }catch(e){
        res.writeHead(422,{'Content-Type':'application/json; charset=utf-8'});
        res.end(JSON.stringify({error:'Local analysis unavailable',detail:String(e.message).slice(0,140)}));
      }
    });
    return;
  }
  res.writeHead(404).end('Not found');
}).listen(port,host,()=>console.log('RULEDELTA_LOCAL_READY http://127.0.0.1:'+port));

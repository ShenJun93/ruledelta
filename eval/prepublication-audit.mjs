/**
 * Private, read-only release readiness audit.
 * Scans only Git-tracked files, never prints token contents.
 * npm audit sends package metadata to npm's public advisory API; no source
 * document, model input, or private account content is uploaded.
 */
import {spawnSync} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import {dirname,join,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';

// A source-only export may be nested under a different Git repository.
// Never scan that parent's files and report the result as a RuleDelta audit.
const repo=spawnSync('git',['rev-parse','--show-toplevel'],{encoding:'utf8',timeout:5000});
assert.equal(repo.status,0,'Audit requires an independent RuleDelta Git checkout');
assert.equal(resolve(repo.stdout.trim()).toLowerCase(),resolve('.').toLowerCase(),
  'REFUSED: audit must run at its OWN Git root, not an enclosing unrelated repo');
const git=spawnSync('git',['ls-files','-z'],{encoding:'utf8',timeout:5000});
assert.equal(git.status,0,'Git tracked file inventory unavailable');
const paths=git.stdout.split('\0').filter(Boolean);
const prohibitedPaths=paths.filter(p=>/(?:^|\/)(?:node_modules|\.cache|\.env(?:\.|$)|\.git|output|credentials|id_rsa|id_ed25519)(?:\/|$)/i.test(p));
const secretPatterns=[
  ['PEM_PRIVATE_KEY',/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ['AWS_ACCESS_KEY',/\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/],
  ['GITHUB_TOKEN',/\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{30,}\b|\bgithub_pat_[A-Za-z0-9_]{25,}\b/],
  ['OPENAI_TOKEN',/\bsk-(?:proj-)?[A-Za-z0-9_-]{25,}\b/],
  ['SLACK_TOKEN',/\bxox[baprs]-[A-Za-z0-9-]{20,}\b/],
  ['DATABASE_URI_CREDENTIALS',/\b(?:postgres|mysql|mongodb(?:\+srv)?):\/\/[^\/\s:@]+:[^\/\s@]+@/],
  ['AUTH_HEADER_LITERAL',/\bAuthorization:\s*Bearer\s+[A-Za-z0-9._~-]{30,}/i]
];
const exposures=[];
for(const p of paths){
  if(p==='package-lock.json')continue;
  const data=await readFile(p,'utf8');
  for(const [kind,regex] of secretPatterns){
    if(regex.test(data))exposures.push({file:p,type:kind});
  }
}
const pkg=JSON.parse(await readFile('package.json','utf8'));
const lock=JSON.parse(await readFile('package-lock.json','utf8'));
const dependencyDiffs=Object.entries(pkg.dependencies??{}).filter(([key,val])=>lock.packages?.['']?.dependencies?.[key]!==val);
const npmCli=join(dirname(process.execPath),'node_modules','npm','bin','npm-cli.js');
const audit=spawnSync(process.execPath,[npmCli,'audit','--omit=dev','--json'],{
  encoding:'utf8',timeout:30000,maxBuffer:10*1024*1024,windowsHide:true
});
let auditJson=null,auditError=null;
try{auditJson=JSON.parse(audit.stdout);}
catch{auditError='Advisory response unavailable: '+String(audit.error?.message??audit.stderr??'non-JSON').slice(0,160);}
const vulns=Object.entries(auditJson?.vulnerabilities??{}).map(([name,x])=>({
  name,severity:x.severity,isDirect:x.isDirect,
  causes:(x.via??[]).filter(k=>typeof k==='string'),
  advisories:(x.via??[]).filter(k=>typeof k==='object').map(k=>({
    title:k.title,range:k.range,url:k.url,severity:k.severity
  })).slice(0,5),
  fix:x.fixAvailable
})).sort((a,b)=>{
  const order={critical:0,high:1,moderate:2,low:3};
  return (order[a.severity]??4)-(order[b.severity]??4)||a.name.localeCompare(b.name);
});
const report={
  scannedTrackedFiles:paths.length,
  unsafeTrackedPaths:prohibitedPaths,
  secretPatternMatches:exposures,
  packageLockDependencyMismatches:dependencyDiffs,
  packageLockSha256:createHash('sha256').update(await readFile('package-lock.json')).digest('hex'),
  auditStatus:audit.status,
  auditError,
  vulnerabilityCounts:auditJson?.metadata?.vulnerabilities??null,
  remainingModerateAdvisoriesNeedHumanReview:vulns.some(x=>x.severity==='moderate'),
  releaseGate:'CONDITIONAL_HUMAN_REVIEW_NOT_PUBLIC_APPROVAL',
  vulnerabilities:vulns,
  note:'Pattern-based preflight is not a complete security audit. Dependency findings may not be exploitable in the local-only usage, but must not be hidden or assumed safe.'
};
console.log('RULEDELTA_PREPUBLICATION_AUDIT',JSON.stringify(report,null,2));
if(prohibitedPaths.length||exposures.length||dependencyDiffs.length||auditError||vulns.some(x=>['critical','high'].includes(x.severity)))process.exitCode=1;

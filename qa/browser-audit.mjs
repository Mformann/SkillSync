import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import {readFile, mkdir, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {accessibilityMetrics,keyboardSmoke} from './accessibility-checks.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const require=createRequire(path.join(root,'frontend/package.json'));
const {chromium}=require('@playwright/test');
const env=await readFile(path.join(root,'frontend/.env'),'utf8').catch(()=>'');
const project=process.env.VITE_SUPABASE_URL||env.match(/^VITE_SUPABASE_URL\s*=\s*["']?([^\s"']+)/m)?.[1];
if(!project)throw new Error('Set VITE_SUPABASE_URL for the browser fixture.');
const api=(process.env.QA_API||env.match(/^VITE_API_BASE_URL\s*=\s*["']?([^\s"']+)/m)?.[1]||'http://localhost:8000').replace(/\/$/,'');
const dist=path.join(root,'frontend',process.env.QA_DIST||'dist');
const mime={'.js':'text/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.html':'text/html'};
const server=createServer(async(req,res)=>{
  const name=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname);
  let file=path.resolve(dist,'.'+name);
  if(!file.startsWith(dist+path.sep)){file=path.join(dist,'index.html');}
  try{const data=await readFile(file);res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');res.end(data);}
  catch{res.setHeader('Content-Type','text/html');res.end(await readFile(path.join(dist,'index.html')));}
});
await new Promise(resolve=>server.listen(8012,'127.0.0.1',resolve));
await mkdir(path.join(root,'qa/screenshots'),{recursive:true});
const browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||(process.platform==='win32'?'msedge':undefined),headless:true});
const user={id:'qa-browser-user',aud:'authenticated',role:'authenticated',email:'qa@example.com',app_metadata:{provider:'email',providers:['email']},user_metadata:{full_name:'QA Candidate'},created_at:new Date().toISOString()};
const token=[Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url'),Buffer.from(JSON.stringify({sub:user.id,aud:'authenticated',iss:project+'/auth/v1',exp:Math.floor(Date.now()/1000)+3600,iat:Math.floor(Date.now()/1000)})).toString('base64url'),'c2lnbmF0dXJl'].join('.');
const session={access_token:token,refresh_token:'synthetic-qa-refresh',token_type:'bearer',expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,user};
const key='sb-'+new URL(project).hostname.split('.')[0]+'-auth-token';
const flowMode=process.argv.includes('--flow');
const pages=flowMode?[]:['/dashboard','/upload','/workspaces','/analysis/1','/gap-report/1','/roadmap/1','/resume-studio/1','/career','/career/vault','/career/package/1','/privacy',...['assessments','planner','jobs','interview','passport','contacts'].map(tab=>'/career/growth?workspace=1&tab='+tab)];
const phase5=process.argv.includes('--phase5');
const results=[];
try{
 for(const theme of ['light','dark']){
  for(const viewport of (phase5?[{width:375,height:812},{width:812,height:375},{width:1440,height:900}]:[{width:375,height:812},{width:1440,height:900}])){
   const context=await browser.newContext({viewport,reducedMotion:'reduce'});
   await context.addInitScript(({key,session,theme})=>{localStorage.setItem(key,JSON.stringify(session));localStorage.setItem('skillsync-theme',theme);localStorage.setItem('theme',theme);},{key,session,theme});
   await context.route('**/*',async route=>{
    const url=route.request().url();
    if(url.startsWith(project+'/auth/v1/'))return route.fulfill({json:url.includes('/user')?user:session});
    if(url.startsWith(api+'/')){
     if(api==='http://127.0.0.1:8011')return route.continue();
     const response=await route.fetch({url:'http://127.0.0.1:8011'+url.slice(api.length)});
     return route.fulfill({response});
    }
    if(!url.startsWith('http://127.0.0.1:8012/'))return route.abort();
    return route.continue();
   });
   const page=await context.newPage();
   for(const pathname of pages){
    const errors=[];const badResponses=[];
    const onError=e=>errors.push(e.message);
    const onResponse=r=>{if(r.status()>=500)badResponses.push({url:new URL(r.url()).pathname,status:r.status()});};
    page.on('pageerror',onError);page.on('response',onResponse);
    const start=Date.now();
    await page.goto('http://127.0.0.1:8012'+pathname);
    await page.waitForLoadState('networkidle');
    try { await page.locator('h1').first().waitFor({timeout:10000}); }
    catch(error) {
     const failure={path:pathname,theme,width:viewport.width,errors,badResponses,body:(await page.locator('body').innerText()).slice(0,2000),failure:'No visible main after ten seconds'};
     results.push(failure);console.log(JSON.stringify(failure));
     await page.screenshot({path:path.join(root,'qa/screenshots','failed-bootstrap.png'),fullPage:true});
     throw error;
    }
    // Inspect steady colors after finite entrance animations have finished.
    await page.evaluate(()=>Promise.all(document.getAnimations().filter(a=>a.effect?.getTiming().iterations!==Infinity).map(a=>a.finished.catch(()=>{}))));
    const metrics=await page.evaluate(()=>{
     const visible=e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0&&getComputedStyle(e).visibility!=='hidden';};
     const controls=[...document.querySelectorAll('input:not([type=hidden]),textarea,select')].filter(visible);
     return {mainCount:document.querySelectorAll('main,[role=main]').length,overflow:document.documentElement.scrollWidth>innerWidth+1,scrollWidth:document.documentElement.scrollWidth,theme:document.documentElement.className,mainMissing:!document.querySelector('main,[role=main]'),headings:[...document.querySelectorAll('h1,h2')].map(e=>e.textContent),unlabeled:controls.filter(e=>!e.labels?.length&&!e.getAttribute('aria-label')&&!e.getAttribute('aria-labelledby')).map(e=>({tag:e.tagName,type:e.type})),smallButtons:[...document.querySelectorAll('#root button')].filter(visible).filter(e=>{const r=e.getBoundingClientRect();return r.height<43||r.width<43;}).map(e=>({text:e.textContent.trim(),width:Math.round(e.getBoundingClientRect().width),height:Math.round(e.getBoundingClientRect().height)}))};
    });
    if(phase5)Object.assign(metrics,await accessibilityMetrics(page));
    const name=(phase5?'phase05-':'')+pathname.replace(/[^a-z0-9]/gi,'_')+'-'+theme+'-'+viewport.width;
    await page.screenshot({path:path.join(root,'qa/screenshots',name+'.png'),fullPage:true,animations:'disabled'});
    results.push({path:pathname,theme,width:viewport.width,elapsed_ms:Date.now()-start,...metrics,errors,badResponses});
    page.off('pageerror',onError);page.off('response',onResponse);
   }
   if(phase5&&viewport.width===375){
    const keyboardSteps=await keyboardSmoke(page,'http://127.0.0.1:8012');
    await writeFile(path.join(root,`qa/phase-05-keyboard-${theme}.json`),JSON.stringify({ok:true,steps:keyboardSteps},null,2));
   }
   if(flowMode&&theme==='light'&&viewport.width===375){
    const steps=[];const errors=[];const responses=[];const runRequests=[];
    page.on('request',r=>{if(r.method()==='POST'&&r.url().startsWith(api+'/')&&new URL(r.url()).pathname.endsWith('/run'))runRequests.push(new URL(r.url()).pathname);});
    page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.url().startsWith(api+'/'))responses.push({path:new URL(r.url()).pathname,status:r.status()});});
    try{
     await page.goto('http://127.0.0.1:8012/upload');
     await page.getByLabel('Job title',{exact:true}).fill('QA browser flow');
     await page.getByLabel('Company',{exact:false}).fill('Synthetic employer');
     await page.getByLabel('Job description',{exact:true}).fill('We require Python, Docker and Kubernetes expertise to build reliable backend APIs and automated tests.');
     await page.locator('#resume-file').setInputFiles(path.join(root,process.argv.includes('--phase4')?'qa/phase04-table-resume.docx':'qa/synthetic-resume.docx'));
     await page.getByRole('button',{name:'Create workspace',exact:true}).click();
     await page.waitForURL(/\/analysis\/\d+$/);
     const aid=new URL(page.url()).pathname.split('/').pop();
     await page.getByRole('link',{name:'Build learning roadmap'}).waitFor();steps.push('Uploaded a DOCX and completed consent-off analysis through the browser');
     await page.getByRole('link',{name:'Build learning roadmap'}).click();
     await page.getByRole('button',{name:'Generate learning plan'}).click();
     await page.getByRole('heading',{name:'Learning roadmap',exact:true}).waitFor();steps.push('Generated a persistent learning plan');
     await page.getByRole('link',{name:'View full analysis'}).click();
     await page.getByRole('link',{name:'Tailor verified resume'}).click();
     await page.getByLabel(/^name$/i).fill('Synthetic QA Candidate');
     await page.getByLabel(/^email$/i).fill('qa@example.com');
     const saved=page.waitForResponse(r=>r.url().includes('/resume-studio/versions/')&&r.request().method()==='PATCH');
     await page.getByRole('button',{name:'Save',exact:true}).click();
     if((await saved).status()!==200)throw new Error('Resume save failed');steps.push('Edited and saved a tailored resume');
     const downloaded=page.waitForEvent('download');
     await page.getByRole('button',{name:'DOCX',exact:true}).click();
     const download=await downloaded;await download.saveAs(path.join(root,'qa/browser-export.docx'));steps.push('Downloaded the tailored DOCX');
     await page.reload();await page.getByLabel(/^email$/i).waitFor();
     if(await page.getByLabel(/^email$/i).inputValue()!=='qa@example.com')throw new Error('Saved contact did not survive reload');steps.push('Verified saved changes after reload');
     await page.emulateMedia({media:'print'});
     await page.pdf({path:path.join(root,'qa/phase-06-resume-print.pdf'),format:'A4',printBackground:true});
     await page.emulateMedia({media:'screen'});
     steps.push('Rendered the saved tailored resume through Chromium print media to an A4 PDF');
     const analysisRunRequests=runRequests.filter(r=>r===`/resume/analysis/${aid}/run`).length;
     if(analysisRunRequests!==1)throw new Error(`One upload initiated ${analysisRunRequests} analysis requests`);
     if(process.argv.includes('--phase3')){
      const existing=await(await page.request.get(`${api}/resume/analysis/${aid}/explainable`)).json();
      const updated=await page.request.patch(`${api}/workspaces/${existing.workspace_id}`,{data:{description:'We require Kubernetes expertise to operate reliable distributed production platforms.'}});
      if(!updated.ok())throw new Error('Synthetic workspace edit failed');
      await page.goto(`http://127.0.0.1:8012/analysis/${aid}`);
      await page.getByRole('button',{name:'Run current analysis',exact:true}).waitFor();
      if(runRequests.length!==1)throw new Error('A stale analysis was automatically resubmitted');
      await page.getByRole('button',{name:'Run current analysis',exact:true}).click();
      await page.getByRole('link',{name:'Build learning roadmap'}).waitFor();
      await page.goto(`http://127.0.0.1:8012/roadmap/${aid}`);
      await page.getByText(/This plan is based on an older analysis/).waitFor();
      await page.goto(`http://127.0.0.1:8012/resume-studio/${aid}`);
      await page.getByText(/This version is based on an older analysis/).waitFor();
      if(await page.getByLabel(/^email$/i).inputValue()!=='qa@example.com')throw new Error('Refreshing analysis overwrote saved contact');
      if(runRequests.length!==2)throw new Error('Explicit refresh did not initiate exactly one additional run');
      steps.push('Edited the job, refreshed analysis explicitly, and verified stale plan/version notices with saved edits preserved');
     }
     if(process.argv.includes('--phase4')){
      await page.goto(`http://127.0.0.1:8012/gap-report/${aid}`);
      await page.getByText('0% Match',{exact:true}).waitFor();
      if(await page.getByText('Expert',{exact:true}).count())throw new Error('Gap report invented expertise');
      await page.goto('http://127.0.0.1:8012/dashboard');
      const latest=page.getByText('Latest Score',{exact:true}).locator('..');
      await latest.waitFor();
      if(!/^Latest Score\s+0(?:\s|$)/.test(await latest.innerText()))throw new Error('Dashboard lost a genuine zero');
      const current=await(await page.request.get(`${api}/resume/analysis/${aid}/explainable`)).json();
      await page.goto('http://127.0.0.1:8012/career');
      await page.getByText('Preparation progress',{exact:true}).waitFor();
      if(!(await page.getByText('job match',{exact:true}).locator('..').innerText()).includes('0%'))throw new Error('Career page disagrees with zero job match');
      const pending=await page.request.post(`${api}/resume/upload`,{multipart:{workspace_id:String(current.workspace_id),file:{name:'table.docx',mimeType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',buffer:await readFile(path.join(root,'qa/phase04-table-resume.docx'))}}});
      if(!pending.ok())throw new Error('Saved-job table upload failed');
      const pendingId=(await pending.json()).analysis_id;
      await page.goto('http://127.0.0.1:8012/dashboard');
      await page.getByText(/Run this job analysis to calculate a match\./).waitFor();
      if(!(await page.getByText('Latest Score',{exact:true}).locator('..').innerText()).includes('Unavailable'))throw new Error('Pending analysis became zero');
      await page.goto(`http://127.0.0.1:8012/gap-report/${pendingId}`);
      await page.getByRole('link',{name:'Open analysis',exact:true}).waitFor();
      if(await page.getByText('0% Match',{exact:true}).count())throw new Error('Pending gap report became a zero match');
      await page.goto('http://127.0.0.1:8012/career');
      await page.getByText('Preparation progress',{exact:true}).waitFor();
      if(!(await page.getByText('job match',{exact:true}).locator('..').innerText()).includes('Unavailable'))throw new Error('Career page converted pending match to zero');
      steps.push('Read a table-only DOCX through the browser; verified a true zero across gap report and dashboard, then pending/unavailable state after a saved-job upload');
     }
     await writeFile(path.join(root,'qa/browser-flow-results.json'),JSON.stringify({ok:true,analysis_id:aid,steps,errors,responses,analysisRunRequests,totalRunRequests:runRequests.length},null,2));
     console.log(JSON.stringify({flow:'passed',steps,errors,analysisRunRequests}));
    }catch(error){await page.screenshot({path:path.join(root,'qa/screenshots/browser-flow-failure.png'),fullPage:true});const body=(await page.locator('body').innerText()).slice(0,4000);await writeFile(path.join(root,'qa/browser-flow-results.json'),JSON.stringify({ok:false,steps,errors,responses,body,failure:String(error)},null,2));console.log(JSON.stringify({body,responses,errors}));throw error;}
   }
   await context.close();
  }
 }
}finally{await browser.close();server.close();if(!flowMode)await writeFile(path.join(root,process.env.QA_RESULTS||(phase5?'qa/phase-05-browser-results.json':'qa/browser-results.json')),JSON.stringify(results,null,2));}
console.log(JSON.stringify({pages:results.length,overflow:results.filter(r=>r.overflow).map(r=>({path:r.path,theme:r.theme,width:r.width})),runtimeErrors:results.filter(r=>r.errors.length),serverErrors:results.filter(r=>r.badResponses.length),unlabeled:results.filter(r=>r.unlabeled?.length).map(r=>({path:r.path,width:r.width,controls:r.unlabeled})),smallTargets:results.filter(r=>r.smallButtons?.length).map(r=>({path:r.path,width:r.width,buttons:r.smallButtons}))},null,2));
if(phase5&&!flowMode){
 const failures=results.filter(r=>r.overflow||r.errors.length||r.badResponses.length||r.unlabeled?.length||r.smallButtons?.length||r.mainCount!==1||r.axMainCount!==1||r.contrast?.failures.length);
 if(failures.length||results.length!==102)throw new Error(`Phase 5 accessibility sweep failed: ${failures.length} pages; ${results.length}/102 checked. See phase-05-browser-results.json.`);
}

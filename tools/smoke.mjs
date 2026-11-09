// Browser smoke test: drives the app in headless Edge/Chrome over the DevTools protocol, no dependencies.
// Usage: node tools/smoke.mjs [url] [shotDir]   (expects the app served at url; default http://127.0.0.1:8765/index.html)
import {spawn} from 'node:child_process';import {existsSync,writeFileSync,mkdirSync} from 'node:fs';
const url=process.argv[2]||'http://127.0.0.1:8765/index.html',shots=process.argv[3]||'.';mkdirSync(shots,{recursive:true});
const bin=['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','C:/Program Files/Microsoft/Edge/Application/msedge.exe','C:/Program Files/Google/Chrome/Application/chrome.exe'].find(existsSync);
const port=9333,prof=process.env.TEMP+'/kcal-smoke-profile';
const br=spawn(bin,[`--headless=new`,`--remote-debugging-port=${port}`,`--user-data-dir=${prof}`,'--no-first-run','--disable-gpu','--window-size=390,844','--use-fake-ui-for-media-stream','about:blank'],{stdio:'ignore'});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));let ws,id=0,pending={},errors=[];
for(let i=0;i<40&&!ws;i++){try{const t=(await (await fetch(`http://127.0.0.1:${port}/json`,{signal:AbortSignal.timeout(2000)})).json()).find(t=>t.type==='page');if(t)ws=new WebSocket(t.webSocketDebuggerUrl)}catch(e){await sleep(250)}}
await new Promise(r=>ws.onopen=r);
ws.onmessage=m=>{const j=JSON.parse(m.data);if(j.id&&pending[j.id]){pending[j.id](j);delete pending[j.id]}if(j.method==='Runtime.exceptionThrown')errors.push(j.params.exceptionDetails.exception?.description||j.params.exceptionDetails.text);if(j.method==='Runtime.consoleAPICalled'&&j.params.type==='error')errors.push(j.params.args.map(a=>a.value||a.description).join(' '))};
const send=(method,params={})=>new Promise(r=>{const i=++id;pending[i]=r;ws.send(JSON.stringify({id:i,method,params}))});
const ev=async expr=>{const r=await send('Runtime.evaluate',{expression:expr,awaitPromise:true,returnByValue:true});if(r.result.exceptionDetails)throw new Error('eval failed: '+expr+' -> '+(r.result.exceptionDetails.exception?.description||r.result.exceptionDetails.text));return r.result.result.value};
const shot=async name=>{const r=await send('Page.captureScreenshot',{format:'png'});writeFileSync(`${shots}/${name}.png`,Buffer.from(r.result.data,'base64'))};
const click=sel=>ev(`(()=>{const e=document.querySelector(${JSON.stringify(sel)});if(!e)throw new Error('no element '+${JSON.stringify(sel)});e.click();return true})()`);
const set=(sel,v)=>ev(`(()=>{const e=document.querySelector(${JSON.stringify(sel)});e.value=${JSON.stringify(String(v))};e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));return true})()`);
const text=sel=>ev(`document.querySelector(${JSON.stringify(sel)})?.textContent||''`);
const ok=(c,m)=>{if(!c)throw new Error('FAIL: '+m);console.log('ok  ',m)};
try{
await send('Runtime.enable');await send('Page.enable');await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:2,mobile:true});
await send('Page.navigate',{url});await sleep(800);
// Seed Lifts data as the gym app stores it, then reload so the bridge picks it up.
const now=Date.now(),DAY=864e5;
await ev(`localStorage.setItem('mikelifts.v1',JSON.stringify({sessions:[{id:1,date:${now},name:'Push',dur:3600,kcal:320,exercises:[]}],body:[{date:${now-14*DAY},weight:81.2},{date:${now-7*DAY},weight:80.8},{date:${now-DAY},weight:80.4}]}));localStorage.removeItem('kcal.v1');true`);
await send('Page.reload');await sleep(800);
ok((await text('#main')).includes('+320 gym'),'today target shows gym kcal from Lifts');
ok((await text('#main')).includes('80.4 kg'),'latest weight comes from Lifts');
await shot('01-today-empty');
// Search Fineli and add ruisleipä
await click('[data-act="search"]');await sleep(900);ok((await text('#sres')).includes('Lunch today'),'student lunch menu shown in search');await set('#sq','ruisleip');await sleep(1500);
const n=await ev(`document.querySelectorAll('#sres .res').length`);ok(n>5,`Fineli search returns results (${n})`);
ok((await text('#sres')).includes('Ruisleipä'),'Finnish name shown');await shot('02-search');
await click('#sres .res');await sleep(200);ok((await text('.sheet h3')).startsWith('Ruisleipä'),'food sheet opens');
const per=+(await text('.sheet p.small')).match(/([0-9]+) kcal/)[1];await set('#fu','35');await set('#fg','2');await sleep(100);ok((await text('#fk')).startsWith(Math.round(per*70/100)+' kcal'),'2 x 35 g uses per-100 g math ('+per+' kcal/100 g)');await shot('03-food');
await set('#fm','b');await click('[data-act="food-add"]');await sleep(200);ok((await text('#main')).includes('Ruisleipä'),'entry added to today');
// Quick add to breakfast
await click('[data-act="quick"][data-meal="b"]');await sleep(200);await set('#qk','300');await set('#qp','20');await click('[data-act="quick-go"]');await sleep(200);
ok((await text('#main')).includes(String(Math.round(per*70/100)+300)),'eaten total adds up');
// Edit entry: open and delete the quick add
await ev(`[...document.querySelectorAll('.ent')].find(e=>e.textContent.includes('Quick add')).click()`);await sleep(200);ok(!!(await ev(`!!document.querySelector('[data-act="ent-del"]')`)),'edit sheet has delete');
await click('[data-act="ent-del"]');await sleep(200);ok(!(await text('#main')).includes('Quick add'),'entry deleted');
// Water and weight
await click('[data-act="water"][data-ml="250"]');await click('[data-act="water"][data-ml="250"]');await sleep(100);ok((await text('#main')).includes('0.5 L'),'water 0.5 L');
await set('#wkg','80.1');await click('[data-act="weigh"]');await sleep(200);ok((await text('#main')).includes('Last 80.1 kg'),'weight logged');
await shot('04-today-filled');
// Copy yesterday: move to yesterday, add, come back
await click('[data-act="day"][data-n="-1"]');await sleep(200);ok((await text('h1')).includes('Yesterday'),'navigated to yesterday');
await click('[data-act="quick"][data-meal="l"]');await sleep(100);await set('#qk','650');await click('[data-act="quick-go"]');await sleep(200);
await click('[data-act="day"][data-n="1"]');await sleep(200);await click('[data-act="copy"][data-meal="l"]');await sleep(200);ok((await text('#main')).includes('650'),'copied yesterday lunch');
// Describe without key -> friendly error; scan without camera -> message, no crash
await click('[data-act="describe"]');await sleep(100);await set('#desc','2 karjalanpiirakkaa');await click('[data-act="describe-go"]');await sleep(500);ok((await text('.sheet')).includes('Gemini API key'),'AI without key explains what to do');
await click('[data-act="scan"]');await sleep(2500);await shot('05-scan');ok(!!(await ev(`!!document.querySelector('#code')`)),'scan sheet has manual code entry');
await set('#code','0000000000000');await click('[data-act="code-go"]');await sleep(4000);const sc=await text('.sheet');ok(/Not found|Looking up/.test(sc),'unknown barcode handled: '+sc.slice(0,40).replace(/\s+/g,' '));
await ev(`document.querySelectorAll('.modal').forEach(m=>m.remove());true`);
// Tabs
await click('[data-tab="diary"]');await sleep(200);ok((await text('#main')).includes('Week of'),'diary groups by week');await shot('06-diary');
await click('[data-tab="stats"]');await sleep(200);ok((await text('#main')).includes('Connected · 1 sessions'),'stats shows Lifts link');ok(!!(await ev(`!!document.querySelector('#main polyline')`)),'weight chart drawn');await shot('07-stats');
await click('[data-tab="set"]');await sleep(200);await set('[data-set="rate"]','-0.5');await sleep(200);ok((await text('#main')).includes('Lose 0.5'),'settings persist');await shot('08-settings');
await click('[data-tab="today"]');await sleep(200);const t2=await text('#main');ok(/target \d+/.test(t2),'target recalculated: '+t2.match(/target \d+/)[0]);
// Lifts storage untouched
ok(JSON.parse(await ev(`localStorage.getItem('mikelifts.v1')`)).sessions.length===1,'Lifts data untouched');
if(errors.length){console.log('console errors:',errors);process.exitCode=1}else console.log('no console errors');
}catch(e){console.log(String(e));try{await shot('99-failure')}catch(_){}process.exitCode=1}
ws.close();br.kill();

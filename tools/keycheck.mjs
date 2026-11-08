// Checks a Gemini key against the exact request the app sends. Never prints the key.
// Usage: node tools/keycheck.mjs [vertex|studio] [model]   (key read from ./.key or GEMINI_KEY)
import {readFileSync,existsSync} from 'node:fs';
const api=process.argv[2]||'vertex',model=process.argv[3]||'gemini-3-flash-preview';
const key=(process.env.GEMINI_KEY||(existsSync('.key')?readFileSync('.key','utf8'):'')).trim();
if(!key){console.log('no key: create a file named .key in this folder containing only the key');process.exit(1)}
console.log(`key: ${key.length} chars, starts with ${key.slice(0,3)}… · api: ${api} · model: ${model}`);
const h=readFileSync('index.html','utf8'),grab=n=>new Function("return "+h.match(new RegExp(`const ${n}=(\{.*?\});\n`,"s"))[1])();
const SYS=h.match(/const SYS=`([\s\S]*?)`;/)[1],SCHEMA=grab('SCHEMA');
const base=api==='vertex'?'https://aiplatform.googleapis.com/v1/publishers/google/models/':'https://generativelanguage.googleapis.com/v1beta/models/';
const r=await fetch(`${base}${model}:generateContent`,{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':key},
 body:JSON.stringify({system_instruction:{parts:[{text:SYS}]},contents:[{role:'user',parts:[{text:'2 karjalanpiirakkaa with munavoi and a glass of milk'}]}],generationConfig:{response_mime_type:'application/json',response_schema:SCHEMA,temperature:.2}})});
const j=await r.json();
if(!r.ok){console.log(`HTTP ${r.status}: ${j.error?.message||JSON.stringify(j).slice(0,300)}`);process.exit(1)}
const txt=j.candidates?.[0]?.content?.parts?.map(p=>p.text).join('')||'';
try{const o=JSON.parse(txt);console.log('OK. Items:',o.items.map(i=>`${i.name} ${i.grams} g ≈ ${Math.round(i.kcal100*i.grams/100)} kcal`).join(' · '));if(o.question)console.log('question:',o.question);console.log('usage:',JSON.stringify(j.usageMetadata||{}))}
catch(e){console.log('call worked but the answer was not the JSON the app expects:',txt.slice(0,300))}

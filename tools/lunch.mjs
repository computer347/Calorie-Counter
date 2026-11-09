// Builds lunch.json: today's menus at the Aalto student restaurants (Kanttiinit), plus per-100 g nutrients where the
// kitchen publishes them (Sodexo feeds). Runs daily in GitHub Actions; the app reads lunch.json from its own origin,
// which sidesteps the CORS limits of the upstream APIs. Usage: node tools/lunch.mjs [YYYY-MM-DD] > lunch.json
import {readFileSync} from 'node:fs';
const UA='Kcal lunch fetcher (github.com/computer347/Calorie-Counter)';
const day=process.argv[2]||new Date(Date.now()+2*3600e3).toISOString().slice(0,10); // Helsinki date, good enough for a 05:00 UTC run
const REST=[1,2,3,5,7,45,73,84]; // Kvarkki, Tietotekniikantalo, Täffä, Alvari, TUAS, Dipoli, Mau-kas Nova, Menssa
const FI_DAYS=['Sunnuntai','Maanantai','Tiistai','Keskiviikko','Torstai','Perjantai','Lauantai'];
const get=async u=>{const r=await fetch(u,{headers:{'User-Agent':UA},signal:AbortSignal.timeout(20000)});if(!r.ok)throw new Error(`${r.status} ${u}`);return r.json()};
const rests=await get('https://kitchen.kanttiinit.fi/restaurants?lang=fi');
const menus=await get(`https://kitchen.kanttiinit.fi/menus?lang=fi&restaurants=${REST.join(',')}&days=${day}`);
// Sodexo weekly feeds carry nutrients per 100 g for each recipe of a course; match courses to Kanttiinit titles.
const kcal=s=>{const m=/Energia kj[^:]*:\s*([\d.]+)/.exec(s||'');return m?Math.round(+m[1]/4.184):null};
const num=(s,k)=>{const m=new RegExp(k+'[^:]*:\\s*([\\d.]+)').exec(s||'');return m?+m[1]:null};
async function sodexo(url){try{const j=await get(url);const d=j.mealdates.find(x=>x.date===FI_DAYS[new Date(day+'T12:00:00').getDay()]);if(!d)return{};
 const out={};for(const c of Object.values(d.courses)){out[(c.title_fi||'').trim()]=Object.values(c.recipes||{}).map(r=>({name:r.name,per:{k:kcal(r.nutrients),p:num(r.nutrients,'Proteiini'),c:num(r.nutrients,'Hiilihydraatit'),f:num(r.nutrients,'Rasva/Rasva'),fi:num(r.nutrients,'Ravintokuitu'),sa:num(r.nutrients,'Suola')}})).filter(r=>r.per.k!=null)}return out}catch(e){return{}}}
const result={date:day,restaurants:[]};
for(const id of REST){const r=rests.find(x=>x.id===id);if(!r)continue;const dishes=(menus[id]?.[day]||[]).map(d=>({title:d.title.replace(/\s+/g,' ').trim(),props:d.properties||[]}));if(!dishes.length)continue;
 const nut=/sodexo\.fi/.test(r.menuUrl||'')?await sodexo(r.menuUrl):{};
 for(const d of dishes){const parts=nut[d.title];if(parts&&parts.length)d.parts=parts}
 result.restaurants.push({id,name:r.name,dishes})}
process.stdout.write(JSON.stringify(result));
console.error(`${day}: ${result.restaurants.length} restaurants, ${result.restaurants.reduce((a,r)=>a+r.dishes.length,0)} dishes, ${result.restaurants.reduce((a,r)=>a+r.dishes.filter(d=>d.parts).length,0)} with kitchen nutrients`);

// Self-check of the pure logic in index.html (targets, adaptive TDEE, Open Food Facts parsing, Lifts bridge). Usage: node tools/test.mjs
import {readFileSync} from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
const h=readFileSync(new URL('../index.html',import.meta.url),'utf8');const js=h.slice(h.indexOf('<script>')+8,h.lastIndexOf('</script>')).replace(/\nrender\(\);\s*$/,'\n');
const store={};const el={innerHTML:'',addEventListener(){},click(){},value:'',focus(){}};
const ctx={localStorage:{getItem:k=>store[k]??null,setItem:(k,v)=>store[k]=v,removeItem:k=>delete store[k]},document:{querySelector:()=>el,querySelectorAll:()=>[],addEventListener(){},createElement:()=>({...el,style:{},remove(){},getContext:()=>({drawImage(){}})}),body:{appendChild(){}}},window:{},navigator:{},location:{origin:'http://x'},scrollTo(){},setTimeout,clearTimeout,setInterval,clearInterval,console,Math,Date,JSON,URL,fetch:async()=>({ok:true,json:async()=>({})})};
ctx.window=ctx;vm.createContext(ctx);
// Seed Lifts data the way the gym app stores it; the calorie app must only read it.
const now=Date.now(),DAY=864e5,iso=ms=>{const d=new Date(ms);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')};
const lifts={sessions:[{date:now,kcal:300}],body:[{date:now-40*DAY,weight:82},{date:now-27*DAY,weight:81.5},{date:now-20*DAY,weight:81},{date:now-10*DAY,weight:80.5},{date:now-1*DAY,weight:80}]};store['mikelifts.v1']=JSON.stringify(lifts);
vm.runInContext(js,ctx);
const {target,formulaTdee,bmr,adaptive,offFood,allWeights,liftsKcal,S,save,today,addD,totals}=vm.runInContext("({target,formulaTdee,bmr,adaptive,offFood,allWeights,liftsKcal,S,save,today,addD,totals})",ctx);
// Mifflin-St Jeor, male 30y 180cm 80kg -> 1780 BMR; light 1.375 -> 2447.5 + 300 gym today
assert.equal(Math.round(bmr()),1780);assert.equal(Math.round(formulaTdee(today())),2748);assert.equal(liftsKcal(today()),300);
assert.equal(allWeights().length,5);assert.equal(adaptive(),null,'adaptive needs 14 logged days');
let T=target(today());assert.equal(T.k,2748);assert.equal(T.p,144);assert.equal(T.f,Math.round(2748*.3/9));assert.equal(T.adaptive,false);
S.settings.rate=-0.5;assert.equal(target(today()).k,2748-550);
// Adaptive: eat 2500/day for 28 days, lose 1 kg in 20 days -> expenditure ~ 2500 + 7700/20 = 2885
for(let i=1;i<=28;i++)S.log[addD(today(),-i)]=[{id:i,t:0,meal:'l',name:'x',g:1000,per:{k:250,p:10,c:10,f:10,fi:0,sa:0,su:0}}];
const a=adaptive();assert.ok(a,'adaptive active');assert.equal(a.days,28);assert.ok(a.tdee>2500&&a.tdee<3300,"tdee "+a.tdee);
assert.equal(target(today()).adaptive,true);assert.equal(target(today()).k,a.tdee-550);
assert.equal(totals(addD(today(),-1)).k,2500);
// Open Food Facts: kcal missing but kJ present; Finnish name preferred; serving unit
const f=offFood({product_name:'Milk',product_name_fi:'Maito',brands:'Valio, Arla',nutriments:{energy_100g:195,proteins_100g:3.4,carbohydrates_100g:4.7,fat_100g:1.5,salt_100g:0.1},serving_quantity:'200'},'123');
assert.equal(f.name,'Maito');assert.equal(f.brand,'Valio');assert.equal(f.per.k,47);assert.equal(JSON.stringify(f.units),'[["annos",200]]');
assert.equal(offFood({nutriments:{}},'1'),null);
// Lifts storage untouched after saving our own state
save();assert.equal(store['mikelifts.v1'],JSON.stringify(lifts));assert.ok(store['kcal.v1']);
console.log('all checks passed');

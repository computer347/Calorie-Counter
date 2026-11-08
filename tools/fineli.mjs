// Converts a Fineli open-data CSV release (ISO-8859-1, ';'-separated) into fineli.json for the app.
// Usage: node tools/fineli.mjs data/fineli_rel18 > fineli.json
import {readFileSync} from 'node:fs';
const dir=process.argv[2]||'data/fineli_rel18';
const csv=f=>readFileSync(`${dir}/${f}`,'latin1').trim().split(/\r?\n/).slice(1).map(l=>l.split(';'));
const num=s=>+String(s).replace(',','.');
const foods={};
for(const [id,name,type] of csv('food.csv'))if(type!=='SUPPLE')foods[id]={id:+id,fi:name,en:'',c:{},u:[]};
for(const [id,name] of csv('foodname_EN.csv'))if(foods[id])foods[id].en=name;
const want={ENERC:1,PROT:1,FAT:1,CHOAVL:1,FIBC:1,NACL:1,SUGAR:1,FASAT:1};
for(const [id,cmp,val] of csv('component_value.csv'))if(foods[id]&&want[cmp])foods[id].c[cmp]=num(val);
// Portion units: a few everyday ones, Finnish label; the app shows grams next to it.
const UNITS={KPL_S:'pieni kpl',KPL_M:'kpl',KPL_L:'iso kpl',PORTS:'pieni annos',PORTM:'annos',PORTL:'iso annos',DL:'dl',RKL:'rkl',TL:'tl'};
for(const [id,unit,mass] of csv('foodaddunit.csv'))if(foods[id]&&UNITS[unit]&&num(mass)>0)foods[id].u.push([UNITS[unit],num(mass)]);
const r1=x=>Math.round((x||0)*10)/10;
// Row: [id, nameFI, nameEN, kcal, protein, fat, carbs, fibre, salt g, sugar, sat fat, [[unit, grams]...]] per 100 g
const rows=Object.values(foods).filter(f=>f.c.ENERC!=null).map(f=>[f.id,f.fi,f.en,Math.round(f.c.ENERC/4.184),r1(f.c.PROT),r1(f.c.FAT),r1(f.c.CHOAVL),r1(f.c.FIBC),r1((f.c.NACL||0)/1000),r1(f.c.SUGAR),r1(f.c.FASAT),f.u]);
process.stdout.write(JSON.stringify(rows));
console.error(`${rows.length} foods`);

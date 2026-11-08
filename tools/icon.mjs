// Generates icon-180.png and icon-512.png (dark square, green ring, no deps). Usage: node tools/icon.mjs
import {writeFileSync} from 'node:fs';import {deflateSync} from 'node:zlib';
const crcT=[...Array(256)].map((_,n)=>{for(let k=0;k<8;k++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0});
const crc=b=>{let c=~0;for(const x of b)c=crcT[(c^x)&255]^(c>>>8);return(~c)>>>0};
const be=n=>Buffer.from([n>>>24,n>>>16&255,n>>>8&255,n&255]);
const chunk=(t,d)=>Buffer.concat([be(d.length),Buffer.from(t),d,be(crc(Buffer.concat([Buffer.from(t),d])))]);
function png(N){const raw=Buffer.alloc((N*3+1)*N);const cx=N/2,R=N*.34,W=N*.075;
 for(let y=0;y<N;y++){raw[y*(N*3+1)]=0;for(let x=0;x<N;x++){const d=Math.hypot(x+.5-cx,y+.5-cx),a=Math.max(0,Math.min(1,1-(Math.abs(d-R)-W)/1.5));
  const on=a>0&&Math.atan2(y-cx,x-cx)<Math.PI*.55; const t=on?a:0; const o=y*(N*3+1)+1+x*3;raw[o]=14+(90-14)*t;raw[o+1]=15+(214-15)*t;raw[o+2]=18+(125-18)*t}}
 return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',Buffer.concat([be(N),be(N),Buffer.from([8,2,0,0,0])])),chunk('IDAT',deflateSync(raw)),chunk('IEND',Buffer.alloc(0))])}
for(const n of[180,512])writeFileSync(`icon-${n}.png`,png(n));

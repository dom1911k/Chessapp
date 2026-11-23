// @ts-nocheck — a verbatim port of the prototype's world renderer (docs/puzzle-path-prototype.html,
// "THE PATH WORLD"), kept as written so it stays identical to the reference.
// The Puzzle Path world: an isometric illustrated diorama, chess.com style. Every tier is a
// "board": an iso chessboard ground (grass, stone, sand…) with 20 level tiles zig-zagging up it,
// props beside the path (seeded, so the world never changes), clouds at the border and the next
// board beyond. Pure: it builds SVG markup strings from the path state; <PathWorld> mounts them.
// API: ISO.build(width, { b, lvl, w0, w1, mt, uid, span }) → { html, G, … }; ISO.cell(w, i);
// ISO.sp(G, gx, gy); ISO.geom; ISO.tileSVG; ISO.pawnSVG; ISO.badge; ISO.defs; ISO.TH; ISO.CELLS.
const ISO={};
(()=>{
/* route: 19 moves inside a world (9 up-right "x", 10 up-left "y"), then an "x" step into the next world.
   Even worlds use PAT, odd worlds its reverse, so no two boards look alike and the path stays centred. */
const PAT="yyxxxyyxxyyyxxyyxyx".split("");
const CELLS=[];(()=>{let gx=0,gy=0;for(let w=0;w<8;w++){const p=w%2?[...PAT].reverse():PAT;for(let i=0;i<20;i++){CELLS.push({w,i,gx,gy});if(i<19){if(p[i]==="x")gx++;else gy++;}}gx++;}})();
ISO.CELLS=CELLS;ISO.cell=(w,i)=>CELLS[w*20+i];
/* per-board look: ground checker, level tiles, props */
const TH=[
 {n:"Wood",g:["#2f6a2b","#2a6127"],line:"#24541f",tile:"stump",nx:["#f6d98f","#e3bb6a","#c9974a"],fu:["#b7773f","#9a5f2e","#7d4a22"],side:"#6b3e1c",num:"#5a3414",numL:"#fff3d6",props:["apple","tree","cypress","bush","bush","tree","flowers","flowers"],feat:["pond","cabin","table"]},
 {n:"Stone",g:["#b9bdc1","#aab0b5"],line:"#9aa1a7",tile:"slab",nx:["#f1f3f5","#d9dde1"],fu:["#c4c9ce","#a8aeb4"],side:"#7d848b",num:"#4f565c",numL:"#ffffff",props:["rock","rock","pine","bush2","rock","flowersW"],feat:["tower","statue","ruin"]},
 {n:"Bronze",g:["#e2bd82","#d6ae72"],line:"#c99f63",tile:"slab",nx:["#f5c58a","#e3a565"],fu:["#d8955a","#b8743d"],side:"#8a4f22",num:"#fff3e0",numL:"#fff3e0",props:["cactus","cactus","rockS","palm","rockS"],feat:["pyramid","obelisk","oasis"]},
 {n:"Silver",g:["#eef3f7","#e1e8ee"],line:"#d3dce4",tile:"slab",nx:["#ffffff","#e6ecf1"],fu:["#d7dee5","#b9c3cc"],side:"#8e99a4",num:"#4c5862",numL:"#4c5862",props:["pineS","pineS","rockI","pineS","bushS"],feat:["snowman","igloo","pond2"]},
 {n:"Crystal",g:["#c6eef7","#b4e5f1"],line:"#a2dbe9",tile:"slab",nx:["#e9fbff","#b9eef9"],fu:["#8fdcef","#5cc3df"],side:"#2f8fb0",num:"#ffffff",numL:"#1f6f8a",props:["crystal","crystal","spike","rockI","crystal"],feat:["crystalBig","spire","pond2"]},
 {n:"Elite",g:["#4b2b7a","#43276e"],line:"#3a2161",tile:"slab",nx:["#e2ccff","#c3a2f4"],fu:["#a77ee6","#8558cf"],side:"#4c2690",num:"#ffffff",numL:"#4c2690",props:["mushroom","mushroom","lantern","crystalP","mushroom"],feat:["magetower","bigmush","lanterns"]},
 {n:"Champion",g:["#5c2222","#511d1d"],line:"#461818",tile:"slab",nx:["#ffb3b3","#f07f7f"],fu:["#e05858","#bd3237"],side:"#7e1419",num:"#ffffff",numL:"#7e1419",props:["obsidian","obsidian","banner","ember","obsidian"],feat:["volcano","lava","fort"]},
 {n:"Legend",g:["#ecd486","#e2c774"],line:"#d4b660",tile:"slab",nx:["#fff3c2","#ffe08a"],fu:["#f5cc58","#dfaa2a"],side:"#9b6a08",num:"#6b4500",numL:"#6b4500",props:["column","goldTree","column","goldTree","flowersG"],feat:["temple","fountain","statueG"]},
];TH.forEach((t,i)=>t.i=i);ISO.TH=TH;
function rng(seed){let a=seed>>>0;return()=>{a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
const f1=v=>Math.round(v*10)/10;
/* rounded iso diamond as points */
function rdia(w,h,r=.22,n=5){const V=[[0,-h],[w,0],[0,h],[-w,0]],pts=[];for(let k=0;k<4;k++){const P=V[(k+3)%4],C=V[k],N=V[(k+1)%4],a=[C[0]+(P[0]-C[0])*r,C[1]+(P[1]-C[1])*r],b=[C[0]+(N[0]-C[0])*r,C[1]+(N[1]-C[1])*r];for(let s=0;s<=n;s++){const t=s/n,x=(1-t)*(1-t)*a[0]+2*(1-t)*t*C[0]+t*t*b[0],y=(1-t)*(1-t)*a[1]+2*(1-t)*t*C[1]+t*t*b[1];pts.push([x,y]);}}return pts;}
const P2=pts=>pts.map(p=>f1(p[0])+","+f1(p[1])).join(" ");
function block(w,h,t,top,side,extra=""){const pts=rdia(w,h);const lo=pts.filter(p=>p[1]>=-0.01).sort((a,b)=>a[0]-b[0]);const sideP=[...lo,...lo.slice().reverse().map(p=>[p[0],p[1]+t])];
 return `<polygon points="${P2(sideP)}" fill="${side}"/><polygon points="${P2(pts)}" fill="${top}"/>${extra}`;}
/* ----- level tiles ----- */
/* leafy masses: a scalloped silhouette, a mid tone, sunlit dapples from the top left, leaf marks and glints */
function wob(cx,cy,rx,ry,n,r,amp=.1){const a0=r()*6.28,f=2+((r()*3)|0),pts=[];for(let k=0;k<n;k++){const a=k/n*Math.PI*2,m=1+amp*Math.sin(a*f+a0);pts.push([cx+Math.cos(a)*rx*m,cy+Math.sin(a)*ry*m]);}return pts;}
const PL=pts=>`points="${pts.map(p=>f1(p[0])+","+f1(p[1])).join(" ")}"`;
function leafMass(pts,r,P,rb,marks=5){let cx=0,cy=0;pts.forEach(p=>{cx+=p[0];cy+=p[1];});cx/=pts.length;cy/=pts.length;
 const lit=(nx,ny)=>(-nx*.55-ny*.83)/(Math.hypot(nx,ny)||1),sc=(k,dy)=>pts.map(p=>[cx+(p[0]-cx)*k,cy+(p[1]-cy)*k+dy]);
 let o=`<polygon ${PL(pts)} fill="${P[0]}"/>`,m=`<polygon ${PL(sc(.86,-rb*.1))} fill="${P[1]}"/>`,l="",d="",h="";
 pts.forEach(p=>{const nx=p[0]-cx,ny=p[1]-cy,L=lit(nx,ny),j=()=>(r()-.5)*rb*.35;o+=cir(p[0]+j(),p[1]+j(),rb*(.95+r()*.25),P[0]);
  m+=cir(cx+nx*.86+j(),cy+ny*.86-rb*.1+j(),rb*(.86+r()*.2),P[1]);
  if(P[4]&&L<-.3){m+=cir(cx+nx*.8,cy+ny*.8,rb*(.75+r()*.2),P[4]);}
  if(L>-.1){const t=.68+r()*.12;l+=cir(cx+nx*t,cy+ny*t-rb*.16,rb*(.5+.38*Math.max(0,L))*(.9+r()*.2),P[2]);}});
 for(let k=0;k<Math.max(2,pts.length/4);k++){const p=pts[(r()*pts.length)|0],nx=p[0]-cx,ny=p[1]-cy;if(lit(nx,ny)<0)continue;const t=.25+r()*.35;l+=cir(cx+nx*t,cy+ny*t,rb*(.42+r()*.3),P[2]);}
 for(let k=0;k<marks;k++){const p=pts[(r()*pts.length)|0],t=.2+r()*.55,x=cx+(p[0]-cx)*t,y=cy+(p[1]-cy)*t,q=rb*(.32+r()*.22);d+=`<path d="M${f1(x-q)},${f1(y)} q${f1(q)},${f1(-q*.9)} ${f1(q*2)},0" stroke="${P[0]}" stroke-width="${f1(Math.max(.8,rb*.15))}" fill="none" stroke-linecap="round" opacity=".5"/>`;}
 for(let k=0;k<3;k++){const p=pts[(r()*pts.length)|0],nx=p[0]-cx,ny=p[1]-cy;if(lit(nx,ny)<.25)continue;h+=cir(cx+nx*.6,cy+ny*.6-rb*.2,rb*.2,P[3],.95);}
 return o+m+l+d+h;}
const TW=G=>({w:G.sx*.68,h:G.sy*.68,t:G.sy*.42});
/* a foliage clump drawn the way chess.com paints trees: a bumpy dark silhouette, a mid tone shifted up-left, sunlit lobes, a glint */
function clump(cx,cy,R,r,P){let s=cir(cx,cy,R,P[0]);const nb=8,a0=r()*6.28;for(let k=0;k<nb;k++){const a=a0+k/nb*6.283;s+=cir(cx+Math.cos(a)*R*.78,cy+Math.sin(a)*R*.68,R*(.34+r()*.06),P[0]);}
 s+=cir(cx-R*.07,cy-R*.1,R*.84,P[1]);for(let k=0;k<5;k++){const a=Math.PI*(1.0+k/4)+(r()-.5)*.2;s+=cir(cx-R*.07+Math.cos(a)*R*.64,cy-R*.1+Math.sin(a)*R*.56,R*.3,P[1]);}
 s+=cir(cx-R*.28,cy-R*.34,R*.44,P[2])+cir(cx+R*.04,cy-R*.5,R*.3,P[2])+cir(cx-R*.52,cy-R*.06,R*.24,P[2]);
 return s+cir(cx-R*.36,cy-R*.46,R*.11,P[3],.9);}
const TREEP=["#3a8a2c","#56aa3a","#80cc52","#d2f5a0"],CYPP=["#2a6b20","#3c8a2c","#62b443","#c4ef8c"];
function tileShadow(G){const {w,h,t}=TW(G);return `<ellipse cx="${f1(G.sx*.07)}" cy="${f1(h*.35+t)}" rx="${f1(w*1.12)}" ry="${f1(h*.95)}" fill="url(#shG)" opacity=".6"/>`;}
function sideOf(w,h,t){const lo=rdia(w,h).filter(p=>p[1]>=-0.01).sort((a,b)=>a[0]-b[0]);return[...lo,...lo.slice().reverse().map(p=>[p[0],p[1]+t])];}
/* the done tile: a clipped hedge, leafy on top, scalloped at the foot */
function hedgeBody(G){/* a clipped hedge: a smooth bright top with a softly bumpy rim, a darker leafy side with a scalloped foot */
 const {w,h,t}=TW(G),r=rng(4242);let s=tileShadow(G)+`<polygon ${PL(sideOf(w,h,t))} fill="url(#hedgeSide)"/>`;
 const n=18;for(let k=0;k<=n;k++){const x=-w*.97+1.94*w*k/n,y=h*(1-Math.abs(x)/w)+t;s+=cir(x,y-t*.1,t*.17,"#2f6d16");}
 for(let k=0;k<5;k++){const x=(r()*2-1)*w*.8,y=h*(1-Math.abs(x)/w)+t*(.35+r()*.3);s+=cir(x,y,t*.13,x<0?"#5fa832":"#3f8a1e",.8);}
 const rim=rdia(w*.95,h*.95,.32,9);rim.forEach(p=>{const L=(-p[0]*.55-p[1]*.83)/(Math.hypot(p[0],p[1])||1);s+=cir(p[0],p[1]+h*.02,h*.11,L>0?"#4f9a24":"#3f8a1e");});
 s+=`<polygon ${PL(rdia(w*.95,h*.95,.32,9))} fill="url(#hedgeTop)"/>`;
 rim.forEach(p=>{const L=(-p[0]*.55-p[1]*.83)/(Math.hypot(p[0],p[1])||1);if(L>.15)s+=cir(p[0]*.97,p[1]*.97,h*.085,"#a8e06a",.9);else if(L<-.2)s+=cir(p[0]*.97,p[1]*.97,h*.08,"#5fae2e");});
 for(let k=0;k<6;k++){const a=Math.PI*(1.05+r()*.9),q=.25+r()*.45;s+=cir(Math.cos(a)*w*q*.9,Math.sin(a)*h*q*.9,h*(.1+r()*.06),"#b2e57a",.55);}
 s+=cir(-w*.36,-h*.38,h*.07,"#e4fbb4",.85);return s;}
function checkSVG(G){const {w,h}=TW(G),d=`M${f1(-w*.34)},${f1(h*.02)} L${f1(-w*.08)},${f1(h*.3)} L${f1(w*.38)},${f1(-h*.32)}`;
 return `<g class="chk"><g transform="translate(0,${f1(-h*.06)})"><path d="${d}" fill="none" stroke="#2f6d16" stroke-opacity=".55" stroke-width="${f1(w*.22)}" stroke-linecap="round" stroke-linejoin="round" transform="translate(${f1(w*.03)},${f1(h*.13)})"/><path d="${d}" fill="none" stroke="#fff" stroke-width="${f1(w*.2)}" stroke-linecap="round" stroke-linejoin="round"/></g></g>`;}
/* stumps (Wood) and slabs (the other boards): shadow, bark or bevel, rings or texture */
function tileBody(G,th,state){const {w,h}=TW(G),t=th.tile==="stump"?TW(G).t:TW(G).t*.72,C=state==="next"?th.nx:th.fu,r=rng(th.i*131+(state==="next"?7:3));let s=tileShadow(G);const side=sideOf(w,h,t);
 if(th.tile==="stump"){s+=`<polygon ${PL(side)} fill="${th.side}"/>`;
  for(let k=0;k<13;k++){const x=-w*.94+1.88*w*k/12+(r()-.5)*w*.04,y0=h*(1-Math.abs(x)/w);s+=`<path d="M${f1(x)},${f1(y0+1)} q${f1((r()-.5)*2)},${f1(t*.5)} 0,${f1(t*(.85+r()*.15))}" stroke="${k%2?"#4f2c12":"#8a5428"}" stroke-width="${k%2?1.3:.9}" fill="none" opacity="${k%2?.55:.5}"/>`;}
  s+=`<polygon ${PL(side.filter(p=>p[1]>h*.0).map(p=>p))} fill="#000" opacity="0"/>`;
  s+=`<polygon ${PL(rdia(w,h,.3))} fill="${C[1]}"/><polygon ${PL(rdia(w*.9,h*.9,.3))} fill="${C[0]}"/>`+[.7,.52,.34].map(q=>`<polygon ${PL(rdia(w*q,h*q,.34))} fill="none" stroke="${C[2]}" stroke-width="${f1(w*.04)}" opacity=".7"/>`).join("")+`<polygon ${PL(rdia(w*.12,h*.12,.4))} fill="${C[2]}"/>`;
  s+=`<path d="M${f1(w*.08)},${f1(-h*.05)} l${f1(w*.42)},${f1(-h*.32)}" stroke="${C[2]}" stroke-width="1.2" opacity=".55" stroke-linecap="round"/><polyline points="${f1(-w*.9)},${f1(-h*.05)} ${f1(0)},${f1(-h*.92)} ${f1(w*.6)},${f1(-h*.38)}" fill="none" stroke="#fff" stroke-opacity=".35" stroke-width="1.4" stroke-linecap="round"/>`;
  for(const sx of[-1,1])s+=`<ellipse cx="${f1(sx*w*.86)}" cy="${f1(t*.92)}" rx="${f1(w*.16)}" ry="${f1(t*.28)}" fill="${th.side}"/>`;}
 else{s+=`<polygon ${PL(side)} fill="${th.side}"/><polygon ${PL(sideOf(w,h,t).map((p,k,a)=>k<a.length/2?[p[0],p[1]+t*.55]:p))} fill="#000" opacity=".16"/>`;
  s+=`<polygon ${PL(rdia(w,h))} fill="${C[1]}"/><polygon ${PL(rdia(w*.86,h*.86))} fill="${C[0]}"/><polyline points="${P2(rdia(w*.93,h*.93).filter(p=>p[0]<=.01&&p[1]<=.01))}" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width="1.5" stroke-linecap="round"/>`;
  for(let k=0;k<3;k++){const a=r()*6.28,q=.3+r()*.45;s+=cir(Math.cos(a)*w*q,Math.sin(a)*h*q,w*(.02+r()*.02),C[1],.6);}

  if(th.n==="Stone")for(let k=0;k<3;k++){const x=(r()-.5)*w*1.6,y=h*(1-Math.abs(x)/w)-1;s+=cir(x,y,w*.06,"#7f9a5a",.9)+cir(x-w*.04,y-1,w*.04,"#9fbc72",.9);}}
 return s;}
function tileSVG(G,th,state,num){const U=G.uid,{w,h}=TW(G);
 if(state==="done")return `<use href="#${U}_hedge"/>${checkSVG(G)}`;
 const isNext=state==="next";let s=`<use href="#${U}_t${th.i}_${isNext?"next":"fut"}"/>`;
 if(isNext)s+=`<polygon class="nring" ${PL(rdia(w*.98,h*.98))}/>`;
 if(state!=="cur")s+=`<text x="0" y="${f1(h*.3)}" text-anchor="middle" font-size="${f1(w*.62)}" font-weight="800" fill="${isNext?th.num:th.numL}" stroke="${isNext?"rgba(255,255,255,.6)":"rgba(0,0,0,.38)"}" stroke-width="${f1(w*.08)}" paint-order="stroke" font-family="Plus Jakarta Sans,system-ui,sans-serif">${num}</text>`;
 return s;}
ISO.tileSVG=tileSVG;
/* ----- props: a small cartoon library, base point at (0,0) on the cell centre ----- */
const sh=(G,rx=.5,ry=.32,o=.28)=>`<ellipse cx="${f1(G.sx*.08)}" cy="${f1(G.sy*.1)}" rx="${f1(G.sx*rx*1.3)}" ry="${f1(G.sy*ry*1.3)}" fill="url(#shG)" opacity="${Math.min(1,o*2.6).toFixed(2)}"/>`;
const cir=(x,y,r,c,o)=>`<circle cx="${f1(x)}" cy="${f1(y)}" r="${f1(r)}" fill="${c}"${o!=null?` opacity="${o}"`:""}/>`;
function blob(G,cx,cy,R,cols,r){let s="";const n=6;for(let k=0;k<n;k++){const a=k/n*Math.PI*2+r()*.6,d=R*.55;s+=cir(cx+Math.cos(a)*d,cy+Math.sin(a)*d*.8,R*(.55+r()*.15),cols[0]);}s+=cir(cx,cy,R*.75,cols[0]);
 for(let k=0;k<5;k++){const a=-Math.PI*.75+k*.35,d=R*.45;s+=cir(cx+Math.cos(a)*d,cy+Math.sin(a)*d*.8,R*(.38+r()*.1),cols[1]);}s+=cir(cx-R*.25,cy-R*.35,R*.3,cols[2],.9);return s;}
function tuft(G,r,c=["#2f7a24","#4fa53a","#6cc040"]){const S=G.sx;let s="";const n=3+((r()*3)|0);for(let k=0;k<n;k++){const a=(k/(n-1)-.5)*1.4+(r()-.5)*.3,L=S*(.1+r()*.08),x=(r()-.5)*S*.06;s+=`<path d="M${f1(x)},0 q${f1(Math.sin(a)*L*.3)},${f1(-L*.6)} ${f1(Math.sin(a)*L)},${f1(-L)}" stroke="${c[k%2?1:k%3?2:0]}" stroke-width="${f1(S*.028)}" fill="none" stroke-linecap="round"/>`;}return s;}
function flowerClump(G,r,cols){const S=G.sx;let s=tuft(G,r);for(let k=0;k<3;k++){const x=(r()-.5)*S*.5,y=(r()-.5)*S*.22,st=S*(.08+r()*.06),c=cols[(r()*cols.length)|0],pr=S*.026;s+=`<path d="M${f1(x)},${f1(y)} l0,${f1(-st)}" stroke="#3f8f2c" stroke-width="1.1"/>`;for(let p=0;p<5;p++){const a=p/5*6.28;s+=cir(x+Math.cos(a)*pr,y-st+Math.sin(a)*pr*.8,pr*.75,c);}s+=cir(x,y-st,pr*.55,"#f2b51c");}return s;}
function pebble(G,r,c){const S=G.sx,w=S*(.05+r()*.05);return `<ellipse cx="${f1(w*.2)}" cy="${f1(w*.25)}" rx="${f1(w)}" ry="${f1(w*.55)}" fill="#000" opacity=".12"/><ellipse cx="0" cy="0" rx="${f1(w)}" ry="${f1(w*.6)}" fill="${c[0]}"/><ellipse cx="${f1(-w*.25)}" cy="${f1(-w*.2)}" rx="${f1(w*.45)}" ry="${f1(w*.25)}" fill="${c[1]}"/>`;}
const PROPS={
 tree:(G,r,big)=>{const S=G.sx*(big?1.2:1.06);let s=sh(G,.5,.3)+`<path d="M${f1(-S*.15)},${f1(S*.02)} Q${f1(-S*.06)},${f1(-S*.05)} ${f1(-S*.06)},${f1(-S*.22)} L${f1(-S*.045)},${f1(-S*.7)} L${f1(S*.045)},${f1(-S*.7)} L${f1(S*.06)},${f1(-S*.22)} Q${f1(S*.06)},${f1(-S*.05)} ${f1(S*.15)},${f1(S*.02)} Z" fill="#8a5730"/><path d="M${f1(S*.005)},${f1(-S*.7)} L${f1(S*.045)},${f1(-S*.7)} L${f1(S*.06)},${f1(-S*.22)} Q${f1(S*.06)},${f1(-S*.05)} ${f1(S*.15)},${f1(S*.02)} L${f1(S*.03)},${f1(S*.02)} Z" fill="#5f3a1c"/>`;
  s+=clump(0,-S*1.12,S*.4,r,TREEP)+clump(-S*.27,-S*.86,S*.31,r,TREEP)+clump(S*.26,-S*.84,S*.31,r,TREEP)+clump(S*.02,-S*.74,S*.25,r,TREEP);return s;},
 apple:(G,r)=>{const S=G.sx*1.2;let s=PROPS.tree(G,r,true);for(let k=0;k<10;k++){const x=(r()-.5)*S*.9,y=-S*(.7+r()*.6);s+=cir(x+S*.012,y+S*.016,S*.06,"#9e1b22")+cir(x,y,S*.057,"#e8443a")+cir(x-S*.018,y-S*.02,S*.02,"#ffd6cf",.9);}return s;},
 cypress:(G,r)=>{const S=G.sx*1.05;return sh(G,.32,.2)+`<rect x="${f1(-S*.035)}" y="${f1(-S*.18)}" width="${f1(S*.07)}" height="${f1(S*.2)}" fill="#6b4524"/>`+clump(0,-S*.34,S*.22,r,CYPP)+clump(0,-S*.6,S*.23,r,CYPP)+clump(0,-S*.86,S*.2,r,CYPP)+clump(0,-S*1.08,S*.15,r,CYPP);},
 bush:(G,r)=>{const S=G.sx*1.05;return sh(G,.42,.25)+clump(S*.15,-S*.17,S*.19,r,TREEP)+clump(-S*.14,-S*.18,S*.21,r,TREEP)+clump(S*.01,-S*.3,S*.21,r,TREEP);},
 bush2:(G,r)=>{const S=G.sx;return sh(G,.38,.22)+leafMass(wob(0,-S*.22,S*.3,S*.22,12,r,.1),r,["#5d7a4d","#7f9c69","#a5c08e","#dbe8cc"],S*.075,3);},
 bushS:(G,r)=>{const S=G.sx;return sh(G,.36,.22,.15)+leafMass(wob(0,-S*.22,S*.3,S*.22,12,r,.1),r,["#b9cad8","#dfe9f1","#f7fbfe","#ffffff"],S*.075,2);},
 flowers:(G,r)=>flowerClump(G,r,["#ffffff","#f7d23e","#ff8fb1"]),
 flowersW:(G,r)=>flowerClump(G,r,["#ffffff","#eef4f8"]),
 flowersG:(G,r)=>flowerClump(G,r,["#fff7d6","#e8a91c"]),
 rock:(G,r,c=["#d6d9dc","#a9afb4","#80878d"])=>{const S=G.sx*(.5+r()*.25);return sh(G,.34,.2,.22)+`<path d="M${f1(-S*.55)},0 L${f1(-S*.4)},${f1(-S*.45)} L${f1(S*.05)},${f1(-S*.62)} L${f1(S*.5)},${f1(-S*.3)} L${f1(S*.55)},0 Z" fill="${c[1]}"/><path d="M${f1(-S*.4)},${f1(-S*.45)} L${f1(S*.05)},${f1(-S*.62)} L${f1(S*.5)},${f1(-S*.3)} L${f1(S*.02)},${f1(-S*.2)} Z" fill="${c[0]}"/><path d="M${f1(S*.02)},${f1(-S*.2)} L${f1(S*.5)},${f1(-S*.3)} L${f1(S*.55)},0 L${f1(S*.1)},0 Z" fill="${c[2]}"/>`;},
 rockS:(G,r)=>PROPS.rock(G,r,["#f1d6a5","#d4ad74","#b08752"]),
 rockI:(G,r)=>PROPS.rock(G,r,["#ffffff","#d5e6f0","#a9c6d8"]),
 obsidian:(G,r)=>PROPS.rock(G,r,["#5a4a52","#2e2428","#1a1416"])+`<path d="M${f1(-G.sx*.1)},${f1(-G.sx*.05)} l${f1(G.sx*.12)},${f1(-G.sx*.12)}" stroke="#ff7a2e" stroke-width="2" stroke-linecap="round"/>`,
 pine:(G,r,snow)=>{const S=G.sx;let s=sh(G,.34,.2)+`<rect x="${f1(-S*.06)}" y="${f1(-S*.25)}" width="${f1(S*.12)}" height="${f1(S*.25)}" fill="#6b4524"/>`;[[.95,.5],[.72,.4],[.5,.3]].forEach(([y,wd],k)=>{s+=`<path d="M0,${f1(-S*(y+.42))} L${f1(S*wd)},${f1(-S*(y-.08))} L${f1(-S*wd)},${f1(-S*(y-.08))} Z" fill="${k%2?"#2f7a3a":"#3a8c44"}"/><path d="M0,${f1(-S*(y+.42))} L${f1(-S*wd)},${f1(-S*(y-.08))} L${f1(-S*wd*.2)},${f1(-S*(y-.08))} Z" fill="#56a85e" opacity=".8"/>`;if(snow)s+=`<path d="M0,${f1(-S*(y+.42))} L${f1(S*wd*.45)},${f1(-S*(y+.15))} Q0,${f1(-S*(y+.08))} ${f1(-S*wd*.45)},${f1(-S*(y+.15))} Z" fill="#fff"/>`;});return s;},
 pineS:(G,r)=>PROPS.pine(G,r,true),
 cactus:(G,r)=>{const S=G.sx;return sh(G,.26,.16)+`<rect x="${f1(-S*.1)}" y="${f1(-S*.85)}" width="${f1(S*.2)}" height="${f1(S*.85)}" rx="${f1(S*.1)}" fill="#4f9a45"/><path d="M${f1(-S*.1)},${f1(-S*.45)} h${f1(-S*.16)} v${f1(-S*.22)}" stroke="#4f9a45" stroke-width="${f1(S*.12)}" fill="none" stroke-linecap="round"/><path d="M${f1(S*.1)},${f1(-S*.55)} h${f1(S*.14)} v${f1(-S*.25)}" stroke="#4f9a45" stroke-width="${f1(S*.12)}" fill="none" stroke-linecap="round"/><rect x="${f1(-S*.06)}" y="${f1(-S*.82)}" width="${f1(S*.05)}" height="${f1(S*.75)}" rx="2" fill="#7cc56a" opacity=".7"/>`;},
 palm:(G,r)=>{const S=G.sx;let s=sh(G,.4,.22)+`<path d="M0,0 Q${f1(S*.1)},${f1(-S*.6)} ${f1(-S*.05)},${f1(-S*1.15)}" stroke="#9a6a3a" stroke-width="${f1(S*.12)}" fill="none" stroke-linecap="round"/>`;for(let k=0;k<6;k++){const a=k/6*Math.PI*2;s+=`<path d="M${f1(-S*.05)},${f1(-S*1.15)} q${f1(Math.cos(a)*S*.3)},${f1(-S*.25)} ${f1(Math.cos(a)*S*.55)},${f1(Math.sin(a)*S*.18+S*.08)}" stroke="${k%2?"#3e9a3e":"#5ab84e"}" stroke-width="${f1(S*.1)}" fill="none" stroke-linecap="round"/>`;}return s;},
 crystal:(G,r,c=["#bff4ff","#5fd0ec","#2a9cc0"])=>{const S=G.sx;let s=sh(G,.32,.2,.18);[[-.18,.55,.12],[.12,.8,.15],[.32,.45,.1]].forEach(([x,hh,wd])=>{s+=`<path d="M${f1(S*x)},${f1(-S*hh)} L${f1(S*(x+wd))},${f1(-S*(hh-.15))} L${f1(S*(x+wd))},0 L${f1(S*(x-wd))},0 L${f1(S*(x-wd))},${f1(-S*(hh-.15))} Z" fill="${c[1]}"/><path d="M${f1(S*x)},${f1(-S*hh)} L${f1(S*(x-wd))},${f1(-S*(hh-.15))} L${f1(S*(x-wd))},0 L${f1(S*x)},0 Z" fill="${c[0]}"/>`;});return s+`<circle cx="0" cy="${f1(-S*.5)}" r="${f1(S*.5)}" fill="${c[1]}" opacity=".12"/>`;},
 crystalP:(G,r)=>PROPS.crystal(G,r,["#ead6ff","#b07cf2","#7a3fd0"]),
 spike:(G,r)=>{const S=G.sx;return sh(G,.24,.14,.15)+`<path d="M0,${f1(-S*1.0)} L${f1(S*.2)},0 L${f1(-S*.2)},0 Z" fill="#8fdcef"/><path d="M0,${f1(-S*1.0)} L${f1(-S*.2)},0 L0,0 Z" fill="#e3fbff"/>`;},
 mushroom:(G,r)=>{const S=G.sx*(.7+r()*.3);return sh(G,.3,.18)+`<path d="M${f1(-S*.12)},0 Q${f1(-S*.1)},${f1(-S*.35)} ${f1(-S*.08)},${f1(-S*.45)} L${f1(S*.08)},${f1(-S*.45)} Q${f1(S*.1)},${f1(-S*.35)} ${f1(S*.12)},0 Z" fill="#f0e6d8"/><path d="M${f1(-S*.45)},${f1(-S*.42)} Q0,${f1(-S*1.0)} ${f1(S*.45)},${f1(-S*.42)} Z" fill="#c050e8"/><path d="M${f1(-S*.45)},${f1(-S*.42)} Q${f1(-S*.2)},${f1(-S*.85)} 0,${f1(-S*.71)} Q${f1(-S*.25)},${f1(-S*.6)} ${f1(-S*.3)},${f1(-S*.42)} Z" fill="#e08cff"/>${cir(-S*.12,-S*.62,S*.06,"#fff")}${cir(S*.15,-S*.55,S*.05,"#fff")}${cir(0,-S*.78,S*.045,"#fff")}`;},
 lantern:(G,r)=>{const S=G.sx;return sh(G,.2,.12)+`<rect x="${f1(-S*.03)}" y="${f1(-S*.9)}" width="${f1(S*.06)}" height="${f1(S*.9)}" fill="#3a2a4a"/><rect x="${f1(-S*.12)}" y="${f1(-S*1.15)}" width="${f1(S*.24)}" height="${f1(S*.28)}" rx="4" fill="#ffd56a"/><circle cx="0" cy="${f1(-S*1.0)}" r="${f1(S*.45)}" fill="#ffd56a" opacity=".2"/>`;},
 banner:(G,r,c="#e0383e")=>{const S=G.sx;return sh(G,.18,.1)+`<rect x="${f1(-S*.03)}" y="${f1(-S*1.2)}" width="${f1(S*.06)}" height="${f1(S*1.2)}" fill="#5a3a24"/><path class="wave" d="M${f1(S*.03)},${f1(-S*1.15)} q${f1(S*.25)},${f1(-S*.08)} ${f1(S*.5)},0 v${f1(S*.35)} q${f1(-S*.25)},${f1(S*.08)} ${f1(-S*.5)},0 Z" fill="${c}"/>`;},
 ember:(G,r)=>PROPS.rock(G,r,["#7a3a2a","#4a1f17","#2a110c"])+`<circle cx="0" cy="${f1(-G.sx*.3)}" r="${f1(G.sx*.08)}" fill="#ffb03a"/>`,
 column:(G,r)=>{const S=G.sx;return sh(G,.26,.16)+`<rect x="${f1(-S*.2)}" y="${f1(-S*.12)}" width="${f1(S*.4)}" height="${f1(S*.12)}" fill="#e9d08a"/><rect x="${f1(-S*.14)}" y="${f1(-S*1.0)}" width="${f1(S*.28)}" height="${f1(S*.9)}" fill="#fff4cf"/><rect x="${f1(S*.04)}" y="${f1(-S*1.0)}" width="${f1(S*.1)}" height="${f1(S*.9)}" fill="#e7cf8a"/><rect x="${f1(-S*.2)}" y="${f1(-S*1.1)}" width="${f1(S*.4)}" height="${f1(S*.12)}" fill="#f2b51c"/>`;},
 goldTree:(G,r)=>{const S=G.sx;return sh(G,.4,.24)+`<path d="M${f1(-S*.07)},0 L${f1(-S*.04)},${f1(-S*.65)} L${f1(S*.04)},${f1(-S*.65)} L${f1(S*.07)},0 Z" fill="#8a5a24"/>`+blob(G,0,-S*.95,S*.45,["#e8a91c","#f7c631","#fff1a8"],r);},
 /* features */
 pond:(G,r)=>{const S=G.sx;let s=`<ellipse cx="0" cy="0" rx="${f1(S*.9)}" ry="${f1(G.sy*.75)}" fill="#3e8a2c"/><ellipse cx="0" cy="${f1(-G.sy*.02)}" rx="${f1(S*.78)}" ry="${f1(G.sy*.62)}" fill="#1f8fd6"/><ellipse cx="${f1(-S*.12)}" cy="${f1(-G.sy*.12)}" rx="${f1(S*.55)}" ry="${f1(G.sy*.38)}" fill="#3fb0f0"/>`;[[-.35,.05,.16],[.2,.18,.2],[.3,-.2,.12]].forEach(([x,y,rr])=>{s+=`<path d="M${f1(S*x)},${f1(G.sy*y)} m${f1(-S*rr)},0 a${f1(S*rr)},${f1(G.sy*rr*.8)} 0 1,0 ${f1(S*rr*2)},0 L${f1(S*x)},${f1(G.sy*y)} Z" fill="#5fb43a"/>`;});s+=cir(S*.05,-G.sy*.25,S*.07,"#ff5fa2")+cir(S*.08,-G.sy*.28,S*.035,"#ffd0e4");for(let k=0;k<10;k++){const a=Math.PI*(.85+k*.13);s+=`<path d="M${f1(Math.cos(a)*S*.85)},${f1(Math.sin(a)*G.sy*.7)} l${f1(-S*.04)},${f1(-S*.2)} l${f1(S*.08)},${f1(S*.12)}" fill="#6cc040"/>`;}return s+PROPS.rock({sx:S*.5,sy:G.sy*.5},r,["#ffffff","#d9dcde","#b5babe"]).replace(/<ellipse[^>]*>/,"").replace(/^/,`<g transform="translate(${f1(S*.6)},${f1(-G.sy*.15)})">`)+"</g>";},
 pond2:(G,r)=>PROPS.pond(G,r).replace(/#1f8fd6/g,"#8fd0e8").replace(/#3fb0f0/g,"#c9eef8").replace(/#3e8a2c/g,"#dfe8ee").replace(/#5fb43a/g,"#ffffff").replace(/#6cc040/g,"#eef4f8"),
 cabin:(G,r)=>{const S=G.sx*1.22,w=S*.62,h=G.sy*1.22*.62,Hh=S*.62,R=S*.62,L=[-w,0],F=[0,h],Rt=[w,0],up=(p,d)=>[p[0],p[1]-d],P=a=>a.map(q=>f1(q[0])+","+f1(q[1])).join(" ");
  const lw=[L,F,up(F,Hh),up(L,Hh)],rw=[F,Rt,up(Rt,Hh),up(F,Hh)],k=1.18,Lr=[-w*k,-Hh+G.sy*.06],Fr=[0,h*k-Hh+G.sy*.06],Rr=[w*k,-Hh+G.sy*.06],ap=[0,-Hh-R];
  let logs="";for(let i=1;i<5;i++){const y=Hh*i/5;logs+=`<path d="M${f1(-w)},${f1(-y)} L0,${f1(h-y)}" stroke="#8a5126" stroke-width="1.2"/><path d="M0,${f1(h-y)} L${f1(w)},${f1(-y)}" stroke="#6a3a1a" stroke-width="1.2"/>`;}
  const dt=.62,dx0=L[0]+(F[0]-L[0])*dt,dy0=L[1]+(F[1]-L[1])*dt,dx1=L[0]+(F[0]-L[0])*(dt+.22),dy1=L[1]+(F[1]-L[1])*(dt+.22);
  const wt=.32,wx0=F[0]+(Rt[0]-F[0])*wt,wy0=F[1]+(Rt[1]-F[1])*wt,wx1=F[0]+(Rt[0]-F[0])*(wt+.26),wy1=F[1]+(Rt[1]-F[1])*(wt+.26);
  return sh(G,.8,.55,.3)+`<polygon points="${P(lw)}" fill="#c98544"/><polygon points="${P(rw)}" fill="#a2602c"/>${logs}<polygon points="${f1(dx0)},${f1(dy0)} ${f1(dx1)},${f1(dy1)} ${f1(dx1)},${f1(dy1-Hh*.62)} ${f1(dx0)},${f1(dy0-Hh*.62)}" fill="#5a3214"/><circle cx="${f1(dx1-S*.04)}" cy="${f1(dy1-Hh*.3)}" r="1.4" fill="#f2c14e"/><polygon points="${f1(wx0)},${f1(wy0-Hh*.38)} ${f1(wx1)},${f1(wy1-Hh*.38)} ${f1(wx1)},${f1(wy1-Hh*.74)} ${f1(wx0)},${f1(wy0-Hh*.74)}" fill="#ffd97a" stroke="#5a3214" stroke-width="1.5"/><rect x="${f1(S*.2)}" y="${f1(-Hh-R*.95)}" width="${f1(S*.14)}" height="${f1(R*.6)}" fill="#8f979c"/><rect x="${f1(S*.18)}" y="${f1(-Hh-R*1.0)}" width="${f1(S*.18)}" height="${f1(S*.06)}" fill="#6f777c"/><polygon points="${P([Lr,Fr,ap])}" fill="#8b3f22"/><polygon points="${P([Fr,Rr,ap])}" fill="#6b2d17"/>${[.18,.34,.5,.66,.82].map(t=>{const L2=(a,b)=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t],a1=L2(Lr,ap),b1=L2(Fr,ap),c1=L2(Rr,ap);return `<path d="M${f1(a1[0])},${f1(a1[1])} L${f1(b1[0])},${f1(b1[1])}" stroke="#6e2f17" stroke-width="1.3" opacity=".7"/><path d="M${f1(b1[0])},${f1(b1[1])} L${f1(c1[0])},${f1(c1[1])}" stroke="#4f2010" stroke-width="1.3" opacity=".7"/>`;}).join("")}<path d="M${f1(Fr[0])},${f1(Fr[1])} L${f1(ap[0])},${f1(ap[1])}" stroke="#c0643a" stroke-width="1.6" stroke-linecap="round"/><path d="M${f1(Lr[0])},${f1(Lr[1])} L${f1(ap[0])},${f1(ap[1])}" stroke="#b25a32" stroke-width="1.2" opacity=".8" stroke-linecap="round"/><path d="M${f1(Lr[0])},${f1(Lr[1])} L${f1(Fr[0])},${f1(Fr[1])} L${f1(Rr[0])},${f1(Rr[1])}" stroke="#5a2412" stroke-width="2" fill="none"/><g class="smoke">${cir(S*.27,-Hh-R*1.15,S*.09,"#f2f2f2",.75)}${cir(S*.33,-Hh-R*1.38,S*.12,"#f2f2f2",.55)}${cir(S*.27,-Hh-R*1.64,S*.15,"#f2f2f2",.35)}</g>`;},
 table:(G,r)=>{const S=G.sx,H=G.sy;let s=sh(G,.6,.4,.25)+`<path d="M${f1(-S*.45)},${f1(-S*.3)} L0,${f1(-S*.3+H*.34)} L${f1(S*.45)},${f1(-S*.3)} L0,${f1(-S*.3-H*.34)} Z" fill="#a8693a"/><path d="M${f1(-S*.45)},${f1(-S*.3)} L0,${f1(-S*.3+H*.34)} L0,${f1(-S*.24+H*.34)} L${f1(-S*.45)},${f1(-S*.24)} Z" fill="#7d4a22"/><path d="M0,${f1(-S*.3+H*.34)} L${f1(S*.45)},${f1(-S*.3)} L${f1(S*.45)},${f1(-S*.24)} L0,${f1(-S*.24+H*.34)} Z" fill="#6a3d1c"/>`;
  for(const[x,y]of[[-.36,-.24],[.36,-.24],[0,-.24+H/S*.3]])s+=`<rect x="${f1(S*x-1.5)}" y="${f1(S*y)}" width="3" height="${f1(S*.24)}" fill="#5a3418"/>`;
  for(let a=0;a<4;a++)for(let b=0;b<4;b++)if((a+b)%2){const cx=(a-b)*S*.06,cy=-S*.3+(a+b-3)*H*.06;s+=`<path d="M${f1(cx)},${f1(cy-H*.06)} L${f1(cx+S*.06)},${f1(cy)} L${f1(cx)},${f1(cy+H*.06)} L${f1(cx-S*.06)},${f1(cy)} Z" fill="#3a2a1a" opacity=".55"/>`;}
  return s+`<g transform="translate(${f1(S*.15)},${f1(-S*.36)})"><ellipse cx="0" cy="0" rx="${f1(S*.1)}" ry="${f1(S*.05)}" fill="#e9e6e0"/><path d="M${f1(-S*.07)},0 Q${f1(-S*.04)},${f1(-S*.18)} ${f1(-S*.04)},${f1(-S*.22)} L${f1(S*.04)},${f1(-S*.22)} Q${f1(S*.04)},${f1(-S*.18)} ${f1(S*.07)},0 Z" fill="#fafafa"/>${cir(0,-S*.28,S*.07,"#ffffff")}</g>`;},
 tower:(G,r,c=["#c9cdd1","#9aa1a7","#7d848b"])=>{const S=G.sx;let s=sh(G,.45,.28,.25)+`<rect x="${f1(-S*.35)}" y="${f1(-S*1.25)}" width="${f1(S*.7)}" height="${f1(S*1.25)}" fill="${c[1]}"/><rect x="${f1(-S*.35)}" y="${f1(-S*1.25)}" width="${f1(S*.3)}" height="${f1(S*1.25)}" fill="${c[0]}"/><ellipse cx="0" cy="0" rx="${f1(S*.35)}" ry="${f1(S*.12)}" fill="${c[1]}"/><ellipse cx="0" cy="${f1(-S*1.25)}" rx="${f1(S*.4)}" ry="${f1(S*.14)}" fill="${c[0]}"/>`;for(let k=0;k<5;k++){const x=-S*.36+k*S*.18;s+=`<rect x="${f1(x)}" y="${f1(-S*1.42)}" width="${f1(S*.1)}" height="${f1(S*.16)}" fill="${k<2?c[0]:c[1]}"/>`;}return s+`<rect x="${f1(-S*.07)}" y="${f1(-S*.85)}" width="${f1(S*.12)}" height="${f1(S*.2)}" rx="${f1(S*.06)}" fill="#3a3f44"/><rect x="${f1(-S*.1)}" y="${f1(-S*.3)}" width="${f1(S*.2)}" height="${f1(S*.3)}" rx="${f1(S*.1)}" fill="#4a3220"/>`;},
 magetower:(G,r)=>PROPS.tower(G,r,["#b48ae8","#7a4ec4","#5a33a0"]).replace(/<rect x="[^"]*" y="[^"]*" width="[^"]*" height="[^"]*" fill="(#b48ae8|#7a4ec4)"\/>(?=<rect x="[^"]*" y="[^"]*" width="[^"]*" height="[^"]*" fill="(#b48ae8|#7a4ec4)"\/><rect x="[^"]*" y="[^"]*" width="[^"]*" height="[^"]*" rx)/,"")+`<path d="M${f1(-G.sx*.45)},${f1(-G.sx*1.3)} L0,${f1(-G.sx*2.0)} L${f1(G.sx*.45)},${f1(-G.sx*1.3)} Z" fill="#c050e8"/><circle cx="0" cy="${f1(-G.sx*2.05)}" r="${f1(G.sx*.08)}" fill="#ffd56a"/>`,
 fort:(G,r)=>PROPS.tower(G,r,["#7a5a5a","#4a3434","#2e2020"])+PROPS.banner({sx:G.sx*.8,sy:G.sy},r,"#e0383e").replace(/<ellipse[^>]*>/,"").replace(/^/,`<g transform="translate(0,${f1(-G.sx*1.35)})">`)+"</g>",
 ruin:(G,r)=>{const S=G.sx;return sh(G,.5,.3,.2)+PROPS.column({sx:S*.9,sy:G.sy},r).replace(/#fff4cf/g,"#d6d9dc").replace(/#e7cf8a/g,"#b3b9be").replace(/#e9d08a/g,"#9aa1a7").replace(/#f2b51c/g,"#c4c9ce").replace(/<ellipse[^>]*>/,"")+`<g transform="translate(${f1(S*.35)},${f1(S*.05)}) rotate(70)"><rect x="${f1(-S*.12)}" y="${f1(-S*.4)}" width="${f1(S*.24)}" height="${f1(S*.4)}" fill="#c4c9ce"/></g>`;},
 statue:(G,r,c=["#d6d9dc","#a9afb4"])=>{const S=G.sx;return sh(G,.36,.22)+`<rect x="${f1(-S*.3)}" y="${f1(-S*.3)}" width="${f1(S*.6)}" height="${f1(S*.3)}" fill="${c[1]}"/><rect x="${f1(-S*.3)}" y="${f1(-S*.3)}" width="${f1(S*.28)}" height="${f1(S*.3)}" fill="${c[0]}"/><g transform="translate(0,${f1(-S*.3)})"><ellipse cx="0" cy="0" rx="${f1(S*.22)}" ry="${f1(S*.08)}" fill="${c[1]}"/><path d="M${f1(-S*.16)},0 Q${f1(-S*.1)},${f1(-S*.38)} ${f1(-S*.07)},${f1(-S*.45)} L${f1(S*.07)},${f1(-S*.45)} Q${f1(S*.1)},${f1(-S*.38)} ${f1(S*.16)},0 Z" fill="${c[0]}"/>${cir(0,-S*.55,S*.13,c[0])}${cir(-S*.04,-S*.59,S*.05,"#fff",.6)}</g>`;},
 statueG:(G,r)=>PROPS.statue(G,r,["#ffe07a","#e0a21c"]),
 pyramid:(G,r)=>{const S=G.sx;return sh(G,.8,.45,.25)+`<path d="M${f1(-S*.8)},0 L0,${f1(-S*1.15)} L0,${f1(G.sy*.45)} Z" fill="#f0c98a"/><path d="M0,${f1(G.sy*.45)} L0,${f1(-S*1.15)} L${f1(S*.8)},0 Z" fill="#c99a5a"/>`;},
 obelisk:(G,r)=>{const S=G.sx;return sh(G,.24,.14)+`<path d="M${f1(-S*.14)},0 L${f1(-S*.1)},${f1(-S*1.2)} L0,${f1(-S*1.4)} L${f1(S*.1)},${f1(-S*1.2)} L${f1(S*.14)},0 Z" fill="#d4a46a"/><path d="M0,${f1(-S*1.4)} L${f1(S*.1)},${f1(-S*1.2)} L${f1(S*.14)},0 L0,0 Z" fill="#b07f45"/><path d="M0,${f1(-S*1.4)} L${f1(-S*.04)},${f1(-S*1.26)} L${f1(S*.04)},${f1(-S*1.26)} Z" fill="#ffd56a"/>`;},
 oasis:(G,r)=>PROPS.pond(G,r).replace(/#3e8a2c/g,"#8fbf5a").replace(/#6cc040/g,"#8fbf5a")+PROPS.palm({sx:G.sx*.8,sy:G.sy},r).replace(/<ellipse[^>]*>/,"").replace(/^/,`<g transform="translate(${f1(-G.sx*.55)},${f1(-G.sy*.2)})">`)+"</g>",
 snowman:(G,r)=>{const S=G.sx;return sh(G,.32,.2,.15)+cir(0,-S*.28,S*.3,"#f4f8fb")+cir(-S*.08,-S*.36,S*.12,"#ffffff")+cir(0,-S*.75,S*.21,"#f4f8fb")+cir(-S*.06,-S*.8,S*.08,"#ffffff")+`<path d="M0,${f1(-S*.74)} l${f1(S*.16)},${f1(S*.03)} l${f1(-S*.16)},${f1(S*.03)} Z" fill="#ff8a2a"/>${cir(-S*.07,-S*.82,S*.025,"#2a2a2a")}${cir(S*.05,-S*.82,S*.025,"#2a2a2a")}<rect x="${f1(-S*.17)}" y="${f1(-S*1.05)}" width="${f1(S*.34)}" height="${f1(S*.06)}" fill="#2a2a2a"/><rect x="${f1(-S*.11)}" y="${f1(-S*1.25)}" width="${f1(S*.22)}" height="${f1(S*.22)}" fill="#2a2a2a"/>`;},
 igloo:(G,r)=>{const S=G.sx;return sh(G,.6,.36,.15)+`<path d="M${f1(-S*.6)},0 A${f1(S*.6)},${f1(S*.62)} 0 0,1 ${f1(S*.6)},0 Z" fill="#eef4f8"/><path d="M${f1(-S*.6)},0 A${f1(S*.6)},${f1(S*.62)} 0 0,1 ${f1(-S*.05)},${f1(-S*.62)} Q${f1(-S*.35)},${f1(-S*.3)} ${f1(-S*.3)},0 Z" fill="#ffffff"/><path d="M${f1(-S*.5)},${f1(-S*.25)} H${f1(S*.5)} M${f1(-S*.35)},${f1(-S*.45)} H${f1(S*.35)}" stroke="#cfdbe4" stroke-width="1.5"/><path d="M${f1(S*.12)},0 a${f1(S*.18)},${f1(S*.2)} 0 0,1 ${f1(S*.36)},0 Z" fill="#7d93a3"/>`;},
 crystalBig:(G,r)=>PROPS.crystal({sx:G.sx*1.5,sy:G.sy},r),
 spire:(G,r)=>PROPS.spike({sx:G.sx*1.4,sy:G.sy},r)+PROPS.spike({sx:G.sx*.9,sy:G.sy},r).replace(/^/,`<g transform="translate(${f1(G.sx*.35)},${f1(G.sy*.1)})">`)+"</g>",
 bigmush:(G,r)=>PROPS.mushroom({sx:G.sx*1.6,sy:G.sy},()=>.9),
 lanterns:(G,r)=>PROPS.lantern(G,r)+`<g transform="translate(${f1(G.sx*.4)},${f1(G.sy*.2)})">${PROPS.lantern(G,r)}</g>`,
 volcano:(G,r)=>{const S=G.sx;return sh(G,.85,.5,.3)+`<path d="M${f1(-S*.9)},0 L${f1(-S*.25)},${f1(-S*1.1)} L${f1(S*.25)},${f1(-S*1.1)} L${f1(S*.9)},0 Z" fill="#4a2424"/><path d="M${f1(-S*.9)},0 L${f1(-S*.25)},${f1(-S*1.1)} L0,${f1(-S*1.05)} L${f1(-S*.2)},0 Z" fill="#6a3434"/><ellipse cx="0" cy="${f1(-S*1.1)}" rx="${f1(S*.25)}" ry="${f1(S*.08)}" fill="#ff7a2e"/><path d="M${f1(-S*.1)},${f1(-S*1.08)} q${f1(-S*.1)},${f1(S*.4)} ${f1(-S*.3)},${f1(S*.6)}" stroke="#ff7a2e" stroke-width="${f1(S*.08)}" fill="none" stroke-linecap="round"/>${cir(0,-S*1.35,S*.16,"#6b6b6b",.5)}${cir(S*.1,-S*1.55,S*.2,"#6b6b6b",.35)}`;},
 lava:(G,r)=>PROPS.pond(G,r).replace(/#1f8fd6/g,"#e8541c").replace(/#3fb0f0/g,"#ffb03a").replace(/#3e8a2c/g,"#2e1414").replace(/#5fb43a/g,"#3a1a1a").replace(/#6cc040/g,"#2e1414").replace(/#ff5fa2/g,"#ffe08a").replace(/#ffd0e4/g,"#ffffff"),
 temple:(G,r)=>{const S=G.sx;let s=sh(G,.85,.5,.25)+`<rect x="${f1(-S*.75)}" y="${f1(-S*.15)}" width="${f1(S*1.5)}" height="${f1(S*.15)}" fill="#e2c774"/>`;for(let k=0;k<4;k++){const x=-S*.6+k*S*.4;s+=`<rect x="${f1(x-S*.08)}" y="${f1(-S*.95)}" width="${f1(S*.16)}" height="${f1(S*.8)}" fill="#fff4cf"/><rect x="${f1(x+S*.02)}" y="${f1(-S*.95)}" width="${f1(S*.06)}" height="${f1(S*.8)}" fill="#e7cf8a"/>`;}return s+`<rect x="${f1(-S*.8)}" y="${f1(-S*1.08)}" width="${f1(S*1.6)}" height="${f1(S*.14)}" fill="#f2b51c"/><path d="M${f1(-S*.82)},${f1(-S*1.08)} L0,${f1(-S*1.5)} L${f1(S*.82)},${f1(-S*1.08)} Z" fill="#ffe08a"/><path d="M0,${f1(-S*1.5)} L${f1(S*.82)},${f1(-S*1.08)} L0,${f1(-S*1.08)} Z" fill="#f2b51c"/>`;},
 fountain:(G,r)=>{const S=G.sx;return sh(G,.6,.36,.2)+`<ellipse cx="0" cy="0" rx="${f1(S*.6)}" ry="${f1(G.sy*.45)}" fill="#e2c774"/><ellipse cx="0" cy="${f1(-S*.06)}" rx="${f1(S*.5)}" ry="${f1(G.sy*.36)}" fill="#7fd4f0"/><rect x="${f1(-S*.06)}" y="${f1(-S*.6)}" width="${f1(S*.12)}" height="${f1(S*.55)}" fill="#f2b51c"/><ellipse cx="0" cy="${f1(-S*.6)}" rx="${f1(S*.22)}" ry="${f1(S*.08)}" fill="#ffe08a"/><path class="spray" d="M0,${f1(-S*.62)} q${f1(-S*.2)},${f1(-S*.35)} ${f1(-S*.35)},${f1(S*.1)} M0,${f1(-S*.62)} q${f1(S*.2)},${f1(-S*.35)} ${f1(S*.35)},${f1(S*.1)}" stroke="#bfefff" stroke-width="2.5" fill="none" stroke-linecap="round"/>`;},
};
ISO.PROPS=PROPS;
/* puzzle-piece badge in tier material (chess.com's level badge) */
const PZ="M14,14 H23 C22,10 24,6.5 28.5,6.5 C33,6.5 35,10 34,14 H42 Q46,14 46,18 V25 C50,24 53.5,26 53.5,30.5 C53.5,35 50,37 46,36 V46 Q46,50 42,50 H14 Q10,50 10,46 V18 Q10,14 14,14 Z";
const MAT=[["#e3b27a","#b8773f","#7d4a22","wood"],["#eef0f2","#b3b9be","#7d848b"],["#f7c48c","#c97a3c","#7a3f16"],["#ffffff","#c6d0d9","#7e8b97"],["#e6fbff","#5cc8e6","#1a7e9e"],["#e2c8ff","#9b5de5","#4a1d8a"],["#ffb3b3","#e0383e","#7a1018"],["#fff3b0","#f2b51c","#8a5a05"]];
let bid=0;
ISO.badge=(tier,num,size,tilt=-14)=>{const [a,b,c,kind]=MAT[Math.min(7,tier)],id="pz"+(bid++);
 const grain=kind==="wood"?`<g clip-path="url(#${id}c)" opacity=".38">${[10,16,22,28,34,40,46].map((y,k)=>`<path d="M8,${y} q12,${k%2?-3:3} 24,0 t24,0" stroke="#6b3a14" stroke-width="1.2" fill="none"/>`).join("")}</g>`:`<path d="M12,16 L30,16 L16,40 Z" fill="#fff" opacity=".22" clip-path="url(#${id}c)"/>`;
 return `<svg class="pzb" width="${size}" height="${size}" viewBox="0 0 60 60" aria-label="${TH[Math.min(7,tier)].n} level ${num}"><defs><linearGradient id="${id}g" x1="0" y1="0" x2=".8" y2="1"><stop offset="0" stop-color="${a}"/><stop offset=".55" stop-color="${b}"/><stop offset="1" stop-color="${c}"/></linearGradient><clipPath id="${id}c"><path d="${PZ}"/></clipPath></defs><g transform="rotate(${tilt} 30 30)"><path d="${PZ}" fill="${c}" transform="translate(0,4)"/><path d="${PZ}" fill="url(#${id}g)"/>${grain}<path d="${PZ}" fill="none" stroke="#fff" stroke-opacity=".35" stroke-width="1.2"/><text x="28" y="${num>99?36:37.5}" text-anchor="middle" font-size="${num>99?14:num>9?17:19}" font-weight="800" fill="#fff8ec" stroke="${c}" stroke-width="3.2" paint-order="stroke" font-family="Plus Jakarta Sans,system-ui,sans-serif">${num}</text></g></svg>`;};
ISO.PZ=PZ;
/* ---------- the scene ---------- */
function geom(W,span=11.2){const sx=Math.round(W/span*10)/10,sy=Math.round(sx*.8*10)/10;return{W,sx,sy};}
ISO.geom=geom;
/* screen position of a grid point; Y0 is the screen y of grid (0,0) */
function sp(G,gx,gy){return{x:G.W/2+(gx-gy)*G.sx,y:G.Y0-(gx+gy)*G.sy};}
ISO.sp=sp;
function cloud(x,y,s,r,w){/* a soft cumulus: rows of shaded puffs (each a little sphere), a blue-grey underside, light on top; no outline */
 const P=[];[[6,0,.25],[5,.25,.26],[4,.49,.25],[2,.72,.23]].forEach(([n,hf,rf],t)=>{const span=[.31,.32,.3,.32][t];for(let k=0;k<n;k++)P.push({x:(k-(n-1)/2)*s*span+(r()-.5)*s*.08,y:-hf*s+(r()-.5)*s*.04,r:s*(rf+r()*.06)});});
 let sh=`<ellipse cx="${f1(s*.04)}" cy="${f1(s*.2)}" rx="${f1(s*1.02)}" ry="${f1(s*.2)}" fill="#a9c6d3" opacity=".55"/>`,bd="",hl="";
 P.forEach(p=>{sh+=cir(p.x+s*.05,p.y+s*.1,p.r,"#a7c2d1");});P.forEach(p=>{sh+=cir(p.x+s*.025,p.y+s*.05,p.r,"#c3d9e4");});
 P.slice().sort((a,b)=>b.y-a.y).forEach(p=>{bd+=`<circle cx="${f1(p.x)}" cy="${f1(p.y)}" r="${f1(p.r)}" fill="url(#cldB)"/>`;});
 P.filter(p=>p.y<-s*.3).forEach(p=>{hl+=cir(p.x-p.r*.3,p.y-p.r*.36,p.r*.3,"#ffffff",.55);});
 return `<g class="cloudW" data-w="${w}" data-x="${f1(x)}" transform="translate(${f1(x)},${f1(y)})"><g class="cloud" style="--dx:${f1((r()-.5)*s*.2)}px;animation-delay:${f1(-r()*8)}s">${sh}${bd}${hl}</g></g>`;}
/* build: worlds [w0..w1] (inclusive), state {b (current world), lvl (current level index 0..19)} */
const SYMK=new Set(["tree","apple","cypress","bush","bush2","bushS","rock","rockS","rockI","obsidian","pine","pineS","cactus","palm","crystal","crystalP","spike","mushroom","column","goldTree","flowers","flowersW","flowersG"]);
const hs=t=>{let h=7;for(const c of t)h=(h*31+c.charCodeAt(0))>>>0;return h;};
ISO.build=(W,opt)=>{const G=geom(W,opt.span||8.6),cur=opt.b,lvl=opt.lvl,w0=opt.w0??0,w1=opt.w1??7,mt=opt.mt??90,U=G.uid=(opt.uid||"w")+"x";
 const SYM=new Map(),useP=(kind,v)=>{const key=kind+v;if(!SYM.has(key))SYM.set(key,PROPS[kind](G,rng(hs(kind)+v*977)));return `<use href="#${U}_p_${key}"/>`;};
 const first=ISO.cell(w0,0),last=ISO.cell(w1,19),sMin=first.gx+first.gy-3,sMax=last.gx+last.gy+(w1<7?9:5);
 G.Y0=mt+sMax*G.sy;const H=Math.ceil(G.Y0-sMin*G.sy+30);G.H=H;
 const D=9;let ground="",items=[],over="",fog="";
 for(let w=w0;w<=Math.min(7,w1+1);w++){const th=TH[w],A=w*10-.5,B=w*10+9.5,locked=w>cur,far=w>cur+1;
  const C=[[A,A+D],[A,A-D],[B,B-D],[B,B+D]].map(([gx,gy])=>sp(G,gx,gy));
  ground+=`<pattern id="chk${w}_${opt.uid||""}" patternUnits="userSpaceOnUse" width="2" height="2" patternTransform="matrix(${G.sx},${-G.sy},${-G.sx},${-G.sy},${f1(sp(G,-.5,-.5).x)},${f1(sp(G,-.5,-.5).y)})"><rect width="2" height="2" fill="${th.g[0]}"/><rect width="1" height="1" fill="${th.g[1]}"/><rect x="1" y="1" width="1" height="1" fill="${th.g[1]}"/></pattern><polygon class="gnd" data-w="${w}" points="${C.map(p=>f1(p.x)+","+f1(p.y)).join(" ")}" fill="url(#chk${w}_${opt.uid||""})"/>`;
  if(w>w1)continue;
  /* tiles */
  for(let i=0;i<20;i++){const c=ISO.cell(w,i),p=sp(G,c.gx,c.gy),st=w<cur||(w===cur&&i<lvl)?"done":w===cur&&i===lvl?"cur":(w===cur&&i===lvl+1)||(w===cur+1&&i===0&&lvl>=19)?"next":"fut";
   items.push({y:p.y,s:`<g class="tile" data-w="${w}" data-i="${i}" transform="translate(${f1(p.x)},${f1(p.y)})"><g class="tin">${tileSVG(G,th,st,i+1)}</g></g>`});}
  /* props: features at fixed slots, then scattered */
  const r=rng(w*7331+17),path=new Set(),near=new Set();for(let i=0;i<20;i++){const c=ISO.cell(w,i);path.add(c.gx+","+c.gy);for(const[dx,dy]of[[1,0],[-1,0],[0,1],[0,-1]])near.add((c.gx+dx)+","+(c.gy+dy));}
  const taken=new Set(path);const place=(gx,gy,kind)=>{const k=gx+","+gy;if(taken.has(k))return false;taken.add(k);const p=sp(G,gx,gy),jx=(r()-.5)*G.sx*.25,jy=(r()-.5)*G.sy*.2;const v=(r()*3)|0,flip=r()<.5&&kind!=="cabin";items.push({y:p.y+jy,s:`<g class="prop" transform="translate(${f1(p.x+jx)},${f1(p.y+jy)})${flip&&SYMK.has(kind)?" scale(-1,1)":""}">${SYMK.has(kind)?useP(kind,v):PROPS[kind](G,r)}</g>`});return true;};
  th.feat.forEach((f,k)=>{const i=[4,10,15][k],c=ISO.cell(w,i),side=(k%2?1:-1)*(w%2?-1:1);for(let t=2;t<=3;t++){if(place(c.gx+(side>0?t:0),c.gy+(side<0?t:0),f))break;}});
  for(let gx=w*10-1;gx<=w*10+10;gx++)for(let gy=gx-6;gy<=gx+6;gy++){const k=gx+","+gy,d=gx-gy;if(taken.has(k)||Math.abs(d)>5)continue;if(gx<w*10||gx>w*10+9)continue;if(r()<(near.has(k)?.15:.25)*(locked?.55:1))place(gx,gy,th.props[(r()*th.props.length)|0]);}
  /* ground detail: grass tufts and flowers on Wood, pebbles elsewhere; pollen drifting over the boards you can see */
  const dr=rng(w*913+3),DEC=w===0?["tuft","tuft","fl"]:["peb"];for(let gx=w*10;gx<=w*10+9;gx++)for(let gy=gx-6;gy<=gx+6;gy++){const k=gx+","+gy;if(locked||path.has(k)||Math.abs(gx-gy)>5)continue;const n=dr()<(w===0?.38:.18)?1:0;for(let q=0;q<n;q++){const p=sp(G,gx+(dr()-.5)*.8,gy+(dr()-.5)*.8),kd=DEC[(dr()*DEC.length)|0],v=(dr()*3)|0;ground+=`<use href="#${U}_d_${kd}${w===0?"":th.i}${v}" x="${f1(p.x)}" y="${f1(p.y)}"/>`;SYM.set("__d_"+kd+(w===0?"":th.i)+v,[kd,th,v]);}}
  if(!locked)for(let q=0;q<10;q++){const p=sp(G,w*10+dr()*10,w*10+dr()*10+(dr()-.5)*6);over+=`<circle class="pollen" cx="${f1(p.x)}" cy="${f1(p.y)}" r="${f1(1+dr()*1.2)}" style="--px:${f1((dr()-.5)*30)}px;animation-delay:${f1(-dr()*7)}s;animation-duration:${f1(6+dr()*4)}s"/>`;}
  if(locked){/* haze over a locked board, clouds along its border */
   const hz=[[A,A+D],[A,A-D],[B,B-D],[B,B+D]].map(([gx,gy])=>sp(G,gx,gy));over+=`<polygon class="haze" data-w="${w}" points="${hz.map(p=>f1(p.x)+","+f1(p.y)).join(" ")}" fill="${far?"#e4f1f5":"#f4fafc"}" opacity="${far?.92:.3}"/>`;}
  if(w===cur+1||(far&&w===cur+2)){}
 }
 /* clouds at the border into the first locked board, a sea of clouds beyond */
 const cr=rng(cur*99+5);for(let w=Math.max(w0,cur+1);w<=Math.min(7,w1);w++){const A=w*10-.5,next=w===cur+1;
  /* big heaps beside the route, never on it: the next board's first tiles stay readable through the gaps */
  const keep=[];for(let i=0;i<20;i++){keep.push(ISO.cell(w,i));if(w>0)keep.push(ISO.cell(w-1,i));}
  const cl=[];for(let t=0;t<260&&cl.length<(next?6:6);t++){const gx=A+.4+cr()*(next?6.5:9.5),d=(cr()-.5)*11.5,gy=gx-d,sz=G.sx*(1.75+cr()*.9),wd=sz*.98/G.sx,hd=(sz*1.15)/(G.sy*2);
   const bs=gx+gy;if(keep.some(c=>Math.abs((c.gx-c.gy)-d)<wd*.95+.55&&(c.gx+c.gy)-bs>-.8&&(c.gx+c.gy)-bs<hd*2+.6))continue;if(cl.some(c=>Math.abs(c.d-d)<wd*.9&&Math.abs(c.s-bs)<1.6))continue;cl.push({gx,gy,d,s:bs,sz});}
  cl.sort((p,q)=>q.s-p.s).forEach(c=>{const p=sp(G,c.gx,c.gy);over+=cloud(p.x,p.y,c.sz,cr,w);});
  if(w>cur+1){const th=TH[w],mid=sp(G,w*10+4.5,w*10+4.5);over+=`<g class="lockTag" data-w="${w}" transform="translate(${f1(mid.x)},${f1(mid.y)})"><rect x="-74" y="-17" width="148" height="34" rx="17" fill="rgba(30,26,22,.78)"/><text x="0" y="6" text-anchor="middle" font-size="14" font-weight="800" fill="#fff" font-family="Plus Jakarta Sans,system-ui,sans-serif">🔒 ${th.n} board</text></g>`;}}
 /* world name signs at each board's start */
 for(let w=w0;w<=Math.min(cur+1,w1);w++){const c=ISO.cell(w,0),p=w>cur?sp(G,c.gx+1.2,c.gy+3.2):sp(G,c.gx-1.6,c.gy+.4);over+=`<g class="sign" data-w="${w}" transform="translate(${f1(p.x)},${f1(p.y)})"><rect x="-2" y="-34" width="4" height="34" fill="#6b4524"/><rect x="-36" y="-50" width="72" height="22" rx="5" fill="${w>cur?"rgba(40,36,32,.7)":"#fff8ec"}" stroke="${w>cur?"none":"#c9974a"}" stroke-width="2"/><text x="0" y="-34" text-anchor="middle" font-size="12" font-weight="800" fill="${w>cur?"#fff":"#6b3e1c"}" font-family="Plus Jakarta Sans,system-ui,sans-serif">${w>cur?"🔒 ":""}${TH[w].n}</text></g>`;}
 items.sort((a,b)=>a.y-b.y);
 /* the pawn, inserted at its depth */
 let pawnAt=null;if(cur>=w0&&cur<=w1){const c=ISO.cell(cur,Math.min(19,lvl)),p=sp(G,c.gx,c.gy);pawnAt={x:p.x,y:p.y};const idx=items.findIndex(it=>it.y>p.y+.5);const pg=`<g id="${opt.uid||""}pawn" class="pawn" transform="translate(${f1(p.x)},${f1(p.y-G.sy*.05)})"><ellipse class="psh" cx="${f1(G.sx*.04)}" cy="${f1(G.sy*.08)}" rx="${f1(G.sx*.52)}" ry="${f1(G.sx*.25)}" fill="url(#shG)" opacity="1"/><g class="pj"><g class="ps">${pawnSVG(G)}</g></g>${tagSVG(G)}</g>`;items.splice(idx<0?items.length:idx,0,{y:p.y,s:pg});}
 let defs=`<g id="${U}_hedge">${hedgeBody(G)}</g>`;for(let w=w0;w<=w1;w++)for(const st of["next","fut"])defs+=`<g id="${U}_t${w}_${st}">${tileBody(G,TH[w],st)}</g>`;
 for(const[key,val]of SYM){if(key.startsWith("__d_")){const[kd,th,v]=val,dr=rng(hs(key));const body=kd==="tuft"?tuft(G,dr):kd==="fl"?flowerClump(G,dr,["#ffffff","#f7d23e","#ff8fb1"]):pebble(G,dr,[th.line,th.g[0]]);defs+=`<g id="${U}_d_${key.slice(4)}">${body}</g>`;}else defs+=`<g id="${U}_p_${key}">${val}</g>`;}
 const svg=`<svg class="isoW" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><defs>${defs}</defs>${ground}${items.map(i=>i.s).join("")}${over}</svg>`;
 return{svg,G,pawnAt,H};};
function pawnSVG(G){const S=G.sx*1.06,r=rng(777),P=["#2f7a17","#68ba36","#92d758","#e4fbb4","#4f9c28"],rb=S*.042;
 const body=[];for(let k=0;k<=9;k++){const t=k/9,y=-S*(.2+t*.5),x=S*(.24-.13*Math.pow(t,.75));body.push([x,y]);}for(let k=9;k>=0;k--){const t=k/9,y=-S*(.2+t*.5),x=S*(.24-.13*Math.pow(t,.75));body.push([-x,y]);}
 return `<g class="pb">`+leafMass(wob(0,-S*.12,S*.35,S*.135,22,r,.03),r,P,rb,1)+leafMass(body,r,P,rb*.9,1)+leafMass(wob(0,-S*.73,S*.2,S*.07,16,r,.02),r,P,rb*.8,0)+leafMass(wob(0,-S*.97,S*.21,S*.2,22,r,.02),r,P,rb,1)+`<ellipse cx="${f1(-S*.07)}" cy="${f1(-S*1.06)}" rx="${f1(S*.06)}" ry="${f1(S*.035)}" fill="#fff" opacity=".35" transform="rotate(-30 ${f1(-S*.07)} ${f1(-S*1.06)})"/></g>`;}
function tagSVG(G){const S=G.sx*1.02,z=S*.36,y=-S*1.5;return `<g class="ptag" transform="translate(${f1(S*.56)},${f1(y)})"><g class="tb"><path d="M${f1(-S*.06)},${f1(z*.5-1)} L0,${f1(z*.5+S*.07)} L${f1(S*.06)},${f1(z*.5-1)} Z" fill="#fff"/><rect x="${f1(-z/2-2)}" y="${f1(-z/2-2)}" width="${f1(z+4)}" height="${f1(z+4)}" rx="3" fill="#fff"/><rect x="${f1(-z/2)}" y="${f1(-z/2)}" width="${f1(z)}" height="${f1(z)}" rx="2" fill="#5d7f9e"/><circle cx="0" cy="${f1(-z*.1)}" r="${f1(z*.2)}" fill="#e9eef2"/><path d="M${f1(-z*.36)},${f1(z/2)} Q${f1(-z*.34)},${f1(z*.14)} 0,${f1(z*.14)} Q${f1(z*.34)},${f1(z*.14)} ${f1(z*.36)},${f1(z/2)} Z" fill="#e9eef2"/></g></g>`;}
ISO.pawnSVG=pawnSVG;ISO.defs=defs;
function defs(){return `<radialGradient id="cldB" cx=".36" cy=".28" r=".8"><stop offset="0" stop-color="#ffffff"/><stop offset=".45" stop-color="#f6fafc"/><stop offset=".78" stop-color="#dbe9f0"/><stop offset="1" stop-color="#bdd4df"/></radialGradient><radialGradient id="shG"><stop offset="0" stop-color="#000" stop-opacity=".42"/><stop offset=".6" stop-color="#000" stop-opacity=".2"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient><linearGradient id="hedgeTop" x1="0" y1="0" x2=".7" y2="1"><stop offset="0" stop-color="#8fd04e"/><stop offset="1" stop-color="#5fae2e"/></linearGradient><linearGradient id="hedgeSide" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4f9a24"/><stop offset="1" stop-color="#3a7a18"/></linearGradient><linearGradient id="pwB" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#9ee35e"/><stop offset=".45" stop-color="#6fc23a"/><stop offset="1" stop-color="#3f8a1c"/></linearGradient><linearGradient id="pwC" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#b5ec7c"/><stop offset="1" stop-color="#4f9a24"/></linearGradient><radialGradient id="pwH" cx=".35" cy=".3" r=".75"><stop offset="0" stop-color="#c8f593"/><stop offset=".5" stop-color="#78c840"/><stop offset="1" stop-color="#3f8a1c"/></radialGradient>`;}
})();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ISOX: any = ISO;
export { ISOX as ISO };

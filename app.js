/* Life Board — app
   Views: Inbox · Timeline · Goals. One bottom sheet creates and edits everything.
   Data shapes (kept compatible with the first version):
     tasks/<id>    {title, icon, area, kind:"day"|"goal"|"big", due, schedDate, schedStart, schedDur, est,
                    done, doneAt, priority, progress, parent, notes, subtasks:[{id,t,done}], createdAt}
     routines/<id> {title, icon, area, freq:"daily"|"weekly"|"monthly"(+legacy "weekdays"|"fortnightly"),
                    interval, days:[0-6 Mon..Sun], start(-1 = anytime), dur, from, until,
                    done:{date:true}, skip:{date:true}, subtasks:[{id,t}], subDone:{date:[ids]}, notes, createdAt} */
(function(){
"use strict";
const $=id=>document.getElementById(id);
const esc=s=>String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const H=window.haptic;

/* ---------- dates & formatting ---------- */
const pad=n=>String(n).padStart(2,"0");
const iso=d=>d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate());
const parse=s=>{const [y,m,d]=s.split("-").map(Number);return new Date(y,m-1,d)};
const today=()=>{const d=new Date();d.setHours(0,0,0,0);return d};
const addDays=(d,n)=>{const x=new Date(d);x.setDate(x.getDate()+n);return x};
const dow=d=>(d.getDay()+6)%7;                      /* Mon=0 … Sun=6 */
const weekOf=d=>addDays(d,-dow(d));
const dayDiff=(a,b)=>Math.round((parse(b)-parse(a))/864e5);
const nowMin=()=>{const n=new Date();return n.getHours()*60+n.getMinutes()};
const DOW=["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
const DOWL=["M","T","W","T","F","S","S"];
function fmtTime(m,withAp=true){m=((m%1440)+1440)%1440;const h=Math.floor(m/60),mm=m%60;return (h%12||12)+":"+pad(mm)+(withAp?(h<12?" am":" pm"):"")}
function fmtRange(s,d){const e=s+d;const ap=x=>Math.floor(((x%1440)+1440)%1440/60)<12?"am":"pm";
  return ap(s)===ap(e)?fmtTime(s,false)+" – "+fmtTime(e):fmtTime(s)+" – "+fmtTime(e)}
function fmtDur(m){if(!m)return"";const h=Math.floor(m/60),r=m%60;return h&&r?`${h}h ${r}m`:h?`${h}h`:`${r}m`}
function relDay(k){const n=dayDiff(iso(today()),k);
  return n===0?"Today":n===1?"Tomorrow":n===-1?"Yesterday":n>1&&n<7?parse(k).toLocaleDateString("en-AU",{weekday:"long"}):parse(k).toLocaleDateString("en-AU",{weekday:"short",day:"numeric",month:"short"})}
const newId=p=>p+Date.now().toString(36)+Math.random().toString(36).slice(2,7);

/* ---------- areas, icons ---------- */
const AREAS=[{id:"uni",name:"Uni"},{id:"work",name:"Work"},{id:"personal",name:"Personal"},{id:"health",name:"Health"},{id:"errands",name:"Errands"}];
const areaName=id=>(AREAS.find(a=>a.id===id)||AREAS[2]).name;
const areaVar=id=>`var(--a-${AREAS.some(a=>a.id===id)?id:"personal"})`;
const AREA_ICON={uni:"🎓",work:"💼",personal:"✨",health:"💪",errands:"🧾"};
const ICON_RULES=[
  [/\b(gym|workout|weights|lift|training)\b/,"🏋️"],[/\b(run|jog|5k|10k)\b/,"🏃"],[/\b(walk|hike)\b/,"🚶"],[/\b(yoga|meditat|breath|stretch|movement|mobility)\w*/,"🧘"],
  [/\b(swim|pool)\b/,"🏊"],[/\b(bike|cycle|cycling)\b/,"🚴"],[/\b(read|book|chapter)\w*/,"📖"],[/\b(e-?mail|inbox|reply)\w*/,"✉️"],[/\b(call|phone|ring)\b/,"📞"],
  [/\b(meet|meeting|standup|sync|catch ?up)\w*/,"👥"],[/\b(lecture|class|tutorial|tute|uni|seminar|lab)\b/,"🎓"],[/\b(study|revise|revision|assignment|essay|exam|quiz|homework|capstone|report)\w*/,"📚"],
  [/\b(code|coding|dev|build|deploy|website|app)\b/,"💻"],[/\b(design|figma|sketch|draw|illustrat)\w*/,"🎨"],[/\b(edit|video|film|animation|animate)\w*/,"🎬"],[/\b(photo|shoot|camera)\w*/,"📷"],
  [/\b(shop|shopping|groceries|grocery|supermarket)\b/,"🛒"],[/\b(cook|bake|meal prep)\w*/,"🍳"],[/\b(breakfast|lunch|dinner|eat|brunch)\b/,"🍽️"],[/\b(coffee|cafe|café)\b/,"☕"],
  [/\b(sleep|bed|wind down|nap)\b/,"🌙"],[/\b(wake|rise|morning)\b/,"☀️"],[/\b(clean|tidy|vacuum|dishes)\b/,"🧽"],[/\b(laundry|washing|clothes)\b/,"🧺"],
  [/\b(car|wash car|petrol|fuel|drive)\b/,"🚗"],[/\b(train|bus|commute|tram|ferry)\b/,"🚆"],[/\b(flight|fly|airport|travel|trip)\b/,"✈️"],
  [/\b(doctor|dentist|gp|physio|appointment)\b/,"🩺"],[/\b(shower|bath)\b/,"🚿"],[/\b(guitar|piano|music|practice|band)\b/,"🎸"],[/\b(movie|cinema|netflix|show)\b/,"🍿"],
  [/\b(pay|bill|bills|rent|bank|invoice|budget)\b/,"💳"],[/\b(work|shift|job)\b/,"💼"],[/\b(party|birthday|celebrat|drinks)\w*/,"🎉"],[/\b(friend|mate|date|family|mum|dad)\b/,"💬"],
  [/\b(write|journal|blog|draft)\w*/,"✍️"],[/\b(plan|review|organi[sz]e)\w*/,"🗒️"],[/\b(plant|garden|water)\b/,"🪴"],[/\b(dog|cat|pet|vet)\b/,"🐾"],
  [/\b(pitch|present|presentation|slides|deck)\w*/,"📊"],[/\b(interview|apply|application|cv|resume)\b/,"🗂️"],[/\b(game|gaming)\b/,"🎮"],[/\b(haircut|barber)\b/,"💈"],[/\b(gift|present for)\b/,"🎁"]
];
function suggestIcon(title,area){const t=(title||"").toLowerCase();for(const [re,ic] of ICON_RULES)if(re.test(t))return ic;return AREA_ICON[area]||"🗒️"}
const ICON_SET=["🗒️","✨","🎓","📚","✍️","💻","🎨","🎬","📷","📊","🗂️","💼","👥","📞","✉️","💬","🏋️","🏃","🚶","🧘","🏊","🚴","💪","🥗","🍳","🍽️","☕","🛒","🧾","💳","🧽","🧺","🚗","🚆","✈️","🩺","💊","🚿","🌙","☀️","📖","🎸","🍿","🎮","🎉","🎁","🪴","🐾","💈","🧠","❤️","⭐","🔥","🎯","⏰","📌"];

/* ---------- routines ---------- */
function rtDays(r){return Array.isArray(r.days)&&r.days.length?r.days:[dow(parse(r.from||iso(today())))]}
function rtRule(r){ /* normalise legacy shapes */
  if(r.freq==="weekdays")return {freq:"weekly",interval:1,days:[0,1,2,3,4]};
  if(r.freq==="fortnightly")return {freq:"weekly",interval:2,days:rtDays(r)};
  return {freq:r.freq||"daily",interval:Math.max(1,r.interval||1),days:rtDays(r)};
}
function occurs(r,k){
  if(!r.from||k<r.from)return false;if(r.until&&k>r.until)return false;
  const R=rtRule(r),d=parse(k),f=parse(r.from);
  if(R.freq==="daily")return dayDiff(r.from,k)%R.interval===0;
  if(R.freq==="weekly"){if(!R.days.includes(dow(d)))return false;const w=Math.round((weekOf(d)-weekOf(f))/(7*864e5));return w%R.interval===0}
  if(R.freq==="monthly"){const months=(d.getFullYear()-f.getFullYear())*12+d.getMonth()-f.getMonth();if(months%R.interval)return false;
    const last=new Date(d.getFullYear(),d.getMonth()+1,0).getDate();return d.getDate()===Math.min(f.getDate(),last)}
  return false;
}
const rtTimed=r=>typeof r.start==="number"&&r.start>=0&&r.dur>0;
function ordinal(n){const s=["th","st","nd","rd"],v=n%100;return n+(s[(v-20)%10]||s[v]||s[0])}
function rtSummary(r){
  const R=rtRule(r),n=R.interval;
  const days=R.days.slice().sort((a,b)=>a-b);
  const dtxt=days.length===5&&days.every((x,i)=>x===i)?"weekdays":days.length===7?"every day":days.map(i=>DOW[i]).join(", ");
  let s=R.freq==="daily"?(n===1?"Every day":`Every ${n} days`):R.freq==="weekly"?(n===1?`Weekly · ${dtxt}`:`Every ${n} weeks · ${dtxt}`):
    (n===1?`Monthly on the ${ordinal(parse(r.from).getDate())}`:`Every ${n} months on the ${ordinal(parse(r.from).getDate())}`);
  if(r.until)s+=` · until ${parse(r.until).toLocaleDateString("en-AU",{day:"numeric",month:"short"})}`;
  return s;
}
function keepRecent(m,key,on){const o={},cut=iso(addDays(today(),-90));for(const [x,v] of Object.entries(m||{}))if(x>=cut&&x!==key)o[x]=v;if(on!==undefined&&on!==false)o[key]=on;return o}

/* ---------- what's on a day ---------- */
function dayItems(k){
  const td=iso(today()),timed=[],anytime=[];
  for(const [id,t] of Store.tasks()){
    if(t.kind==="goal"||t.kind==="big"){ if(t.schedDate===k&&t.schedDur>0)timed.push(taskItem(id,t,k)); continue }
    if(t.schedDate===k&&t.schedDur>0)timed.push(taskItem(id,t,k));
    else if(t.due===k&&!(t.schedDate&&t.schedDur))anytime.push(taskItem(id,t,k));
    else if(k===td&&!t.done&&t.due&&t.due<td&&!t.schedDate)anytime.push(Object.assign(taskItem(id,t,k),{overdue:true}));
  }
  for(const [id,r] of Store.routines()){
    if(!occurs(r,k)||(r.skip||{})[k])continue;
    const it=rtItem(id,r,k);(rtTimed(r)?timed:anytime).push(it);
  }
  timed.sort((a,b)=>a.start-b.start||b.dur-a.dur);
  anytime.sort((a,b)=>(a.done-b.done)||((b.overdue?1:0)-(a.overdue?1:0))||a.title.localeCompare(b.title));
  return {timed,anytime};
}
function taskItem(id,t,k){
  const subs=Array.isArray(t.subtasks)?t.subtasks:[];
  return {type:"task",id,key:"t:"+id,k,title:t.title||"Untitled",icon:t.icon||suggestIcon(t.title,t.area),area:t.area||"personal",
    start:t.schedStart||0,dur:t.schedDur||0,done:!!t.done,subs:subs.length,subsDone:subs.filter(s=>s.done).length,notes:!!(t.notes||"").trim(),rep:false,due:t.due};
}
function rtItem(id,r,k){
  const subs=Array.isArray(r.subtasks)?r.subtasks:[],sd=((r.subDone||{})[k])||[];
  return {type:"rt",id,key:"r:"+id+":"+k,k,title:r.title||"Untitled",icon:r.icon||suggestIcon(r.title,r.area),area:r.area||"personal",
    start:rtTimed(r)?r.start:0,dur:rtTimed(r)?r.dur:0,done:!!(r.done||{})[k],subs:subs.length,subsDone:subs.filter(s=>sd.includes(s.id)).length,notes:!!(r.notes||"").trim(),rep:true};
}
function toggleItem(it){
  if(it.type==="task"){const t=Store.get("tasks",it.id);if(!t)return;Store.set("tasks",it.id,{...t,done:!t.done,doneAt:t.done?0:Date.now(),...(t.kind!=="day"&&!t.done?{progress:100}:{})})}
  else{const r=Store.get("routines",it.id);if(!r)return;Store.set("routines",it.id,{...r,done:keepRecent(r.done,it.k,!it.done)})}
}

/* ================= STATE ================= */
let view="timeline",sel=iso(today()),dragging=null,lastDoneCount=null;

/* ================= HEADER + WEEK STRIP ================= */
function renderHeader(){
  const d=parse(sel);
  $("monthLbl").innerHTML=esc(d.toLocaleDateString("en-AU",{month:"long"}))+" <em>"+d.getFullYear()+"</em>";
  $("todayBtn").hidden=sel===iso(today())||view!=="timeline";
  $("weekStrip").hidden=view!=="timeline";
  $("monthBtn").disabled=view!=="timeline";
  if(view!=="timeline")return;
  const w0=weekOf(d),td=iso(today());
  let h="";
  for(let i=0;i<7;i++){
    const day=addDays(w0,i),k=iso(day),{timed,anytime}=dayItems(k);
    const all=[...timed,...anytime],areas=[...new Set(all.map(x=>x.area))].slice(0,3);
    const doneAll=all.length&&all.every(x=>x.done);
    h+=`<button type="button" class="wd${k===sel?" sel":""}${k===td?" today":""}${doneAll?" alldone":""}" data-day="${k}" aria-label="${esc(day.toLocaleDateString("en-AU",{weekday:"long",day:"numeric",month:"long"}))}${all.length?", "+all.length+" planned":""}" aria-pressed="${k===sel}">
      <span class="wd-l">${DOWL[i]}</span><span class="wd-n">${day.getDate()}</span>
      <span class="wd-dots">${areas.map(a=>`<i style="--c:${areaVar(a)}"></i>`).join("")}</span></button>`;
  }
  $("weekStrip").innerHTML=h;
}

/* ================= TIMELINE ================= */
const pillH=d=>Math.round(Math.max(46,Math.min(176,40+d*1.05)));
/* gaps that offer an "Add task" button get enough room for it */
const gapH=m=>m>=30?Math.round(Math.max(92,Math.min(150,m*.5))):Math.round(Math.max(44,Math.min(80,m*.9)));
const CLOCK=`<svg class="gapclock" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="13" r="8"/><path d="M12 9v4.2l2.6 1.6M9.5 2.8h5"/></svg>`;
const GAP_SHORT=[d=>`A quick ${d} to breathe.`,d=>`${d} spare. Stretch your legs?`,d=>`Just ${d} between things.`,d=>`${d} for a cup of tea.`];
const GAP_LONG=[d=>`${d} of open page.`,d=>`${d} free to make something.`,d=>`Room for something good: ${d}.`,d=>`${d} to chip away at a goal.`,d=>`${d} with nothing planned.`];
function gapLine(s,m){const d=`<b class="gapdur">${fmtDur(m)}</b>`;const L=m>=45?GAP_LONG:GAP_SHORT;return L[(s/5|0)%L.length](d)}
function renderTimeline(){
  const k=sel,td=iso(today()),isToday=k===td,now=nowMin();
  const {timed,anytime}=dayItems(k);
  $("dayRel").textContent=relDay(k)===parse(k).toLocaleDateString("en-AU",{weekday:"long"})?parse(k).toLocaleDateString("en-AU",{weekday:"long"}):relDay(k);
  $("dayTitle").textContent=parse(k).toLocaleDateString("en-AU",{weekday:"long",day:"numeric",month:"long"});
  $("dayRel").hidden=!["Today","Tomorrow","Yesterday"].includes(relDay(k));
  /* progress ring */
  const all=[...timed,...anytime],done=all.filter(x=>x.done).length;
  const pct=all.length?done/all.length:0,C=2*Math.PI*17;
  $("dayRing").innerHTML=all.length?`<svg viewBox="0 0 40 40" aria-hidden="true"><circle class="rt-bg" cx="20" cy="20" r="17"/><circle class="rt-fg" cx="20" cy="20" r="17" stroke-dasharray="${C}" stroke-dashoffset="${C*(1-pct)}"/></svg><span>${done}/${all.length}</span>`:"";
  $("dayRing").className="ring"+(all.length&&done===all.length?" full":"");
  $("dayRing").setAttribute("aria-label",all.length?`${done} of ${all.length} done`:"");
  /* anytime row */
  $("anytime").innerHTML=anytime.length?`<div class="any-lbl">Anytime</div><div class="any-list">${anytime.map(it=>
    `<div class="any${it.done?" done":""}${it.overdue?" overdue":""}" data-key="${esc(it.key)}" style="--c:${areaVar(it.area)}">
      <button type="button" class="chk sm" data-act="toggle" aria-pressed="${it.done}" aria-label="${it.done?"Mark not done":"Mark done"}: ${esc(it.title)}">${CHECK}</button>
      <button type="button" class="any-t" data-act="open"><span class="ico">${esc(it.icon)}</span>${esc(it.title)}${it.overdue?`<em>from ${esc(relDay(it.due))}</em>`:""}${it.rep?`<span class="rep" aria-label="repeats">↻</span>`:""}</button></div>`).join("")}</div>`:"";
  /* timed list with gaps */
  let h="",prevEnd=null,first=true;
  const gapRow=(s,e,cls)=>{const m=e-s;if(m<10)return "";const nowIn=isToday&&now>=s&&now<e;
    const fillMin=Math.min(m,60),from=nowIn?Math.ceil(now/5)*5:s;
    return `<li class="tl-gap${cls?" "+cls:""}${nowIn?" now":""}${m>=30?" big":""}" style="--h:${gapH(m)}px">
      <div class="tl-time">${nowIn?`<b>${fmtTime(now,false)}</b>`:""}</div><div class="tl-rail">${nowIn?`<span class="nowdot" style="top:${Math.round((now-s)/m*100)}%"></span>`:""}</div>
      <div class="gapcol"><button type="button" class="gapbtn" data-gap="${from},${Math.min(fillMin,e-from)}">${CLOCK}<span>${gapLine(s,m)}</span></button>
      ${m>=30?`<button type="button" class="gapadd" data-gap="${from},${Math.min(fillMin,e-from)}"><span class="gapplus" aria-hidden="true">+</span>Add task</button>`:""}</div></li>`};
  if(isToday&&timed.length&&now<timed[0].start&&timed[0].start-now>=10){h+=gapRow(Math.ceil(now/5)*5,timed[0].start,"lead")}
  for(const it of timed){
    if(prevEnd!==null&&it.start>prevEnd)h+=gapRow(prevEnd,it.start);
    const overlap=prevEnd!==null&&it.start<prevEnd;
    const end=it.start+it.dur,live=isToday&&now>=it.start&&now<end&&!it.done;
    const fill=it.done?100:isToday&&now>=end?100:live?Math.round((now-it.start)/it.dur*100):0;
    const past=isToday&&now>=end&&!it.done;
    h+=`<li class="tl-item${it.done?" done":""}${live?" live":""}${past?" past":""}${overlap?" overlap":""}" data-key="${esc(it.key)}" style="--c:${areaVar(it.area)};--ph:${pillH(it.dur)}px">
      <div class="tl-time">${fmtTime(it.start,false)}<small>${it.start<720?"am":"pm"}</small></div>
      <div class="tl-rail"><div class="pill"><span class="pfill" style="height:${fill}%"></span><span class="ico">${esc(it.icon)}</span></div></div>
      <button type="button" class="tl-body" data-act="open">
        <span class="tl-range">${fmtRange(it.start,it.dur)} <i>(${fmtDur(it.dur)})</i>${live?` <b class="left">${fmtDur(end-now)} left</b>`:""}${overlap?` <b class="ov">overlaps</b>`:""}</span>
        <span class="tl-title">${esc(it.title)}</span>
        ${it.subs||it.notes||it.rep?`<span class="tl-meta">${it.subs?`<span>☑ ${it.subsDone}/${it.subs}</span>`:""}${it.notes?`<span>✎ note</span>`:""}${it.rep?`<span>↻ repeats</span>`:""}</span>`:""}
      </button>
      <button type="button" class="chk" data-act="toggle" aria-pressed="${it.done}" aria-label="${it.done?"Mark not done":"Mark done"}: ${esc(it.title)}">${CHECK}</button>
    </li>`;
    prevEnd=Math.max(prevEnd||0,end);first=false;
  }
  if(timed.length){
    const tailStart=isToday?Math.max(prevEnd,Math.ceil(now/15)*15):prevEnd;
    h+=`<li class="tl-tail"><div class="tl-time"></div><div class="tl-rail"></div><div class="gapcol"><button type="button" class="gapadd" data-gap="${Math.min(tailStart,1410)},30"><span class="gapplus" aria-hidden="true">+</span>${isToday&&now>prevEnd?"Add task for later":"Add task after this"}</button></div></li>`;
  }
  $("timeline").innerHTML=h;
  $("dayEmpty").hidden=!!(timed.length||anytime.length);
  const inboxN=[...Store.tasks().values()].filter(isInbox).filter(t=>!t.done).length;
  $("emptyInbox").textContent=inboxN?`Or pull one of your ${inboxN} Inbox task${inboxN>1?"s":""} in.`:"";
  /* celebrate when the last thing is ticked */
  if(lastDoneCount&&lastDoneCount.k===k&&all.length&&done===all.length&&lastDoneCount.done<all.length){celebrate()}
  lastDoneCount={k,done};
}
const CHECK=`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 12.5l4 4L18 8"/></svg>`;
function celebrate(){
  H("success");const r=$("dayRing");r.classList.remove("pop");void r.offsetWidth;r.classList.add("pop");
  const b=$("burst");b.innerHTML=Array.from({length:14},(_,i)=>`<i style="--a:${i*360/14}deg;--d:${40+(i%3)*14}px"></i>`).join("");
  b.classList.remove("go");void b.offsetWidth;b.classList.add("go");
  toast("Day complete. Well done.");
}

/* ================= INBOX ================= */
const isInbox=t=>(t.kind||"day")==="day"&&!t.due&&!t.schedDate;
function renderInbox(){
  const all=[...Store.tasks()].filter(([,t])=>isInbox(t));
  const open=all.filter(([,t])=>!t.done).sort((a,b)=>(a[1].order??a[1].createdAt??0)-(b[1].order??b[1].createdAt??0));
  const done=all.filter(([,t])=>t.done).sort((a,b)=>(b[1].doneAt||0)-(a[1].doneAt||0));
  $("inboxCount").textContent=open.length?`${open.length} to sort`:"";
  $("tabInboxN").textContent=open.length||"";
  const row=([id,t])=>`<li class="ib${t.done?" done":""}" data-id="${id}" style="--c:${areaVar(t.area)}">
      <div class="ib-bg l" aria-hidden="true">Done</div><div class="ib-bg r" aria-hidden="true">Delete</div>
      <div class="ib-fg">
        <button type="button" class="chk sm" data-act="ibtoggle" aria-pressed="${!!t.done}" aria-label="${t.done?"Mark not done":"Mark done"}: ${esc(t.title)}">${CHECK}</button>
        <button type="button" class="ib-main" data-act="ibopen"><span class="ico">${esc(t.icon||suggestIcon(t.title,t.area))}</span>
          <span class="ib-t">${esc(t.title)}<small>${esc(areaName(t.area))}${t.est?` · ${fmtDur(t.est)}`:""}${t.parent&&Store.get("tasks",t.parent)?` · → ${esc(Store.get("tasks",t.parent).title)}`:""}</small></span></button>
        ${t.done?"":`<button type="button" class="ib-plan" data-act="ibplan" aria-label="Schedule ${esc(t.title)}">Plan</button>`}
      </div></li>`;
  $("inboxList").innerHTML=open.map(row).join("")||`<li class="ib-empty">Nothing waiting. Type above to drop a thought here, then plan it later.</li>`;
  $("inboxDone").hidden=!done.length;
  $("inboxDoneN").textContent=done.length;
  $("inboxDoneList").innerHTML=done.slice(0,30).map(row).join("");
}

/* ================= GOALS ================= */
function renderGoals(){
  const all=[...Store.tasks()].filter(([,t])=>t.kind==="goal"||t.kind==="big");
  const sortG=(a,b)=>(a[1].done-b[1].done)||((a[1].due||"9")<(b[1].due||"9")?-1:1);
  const goals=all.filter(([,t])=>t.kind==="goal").sort(sortG),bigs=all.filter(([,t])=>t.kind==="big").sort(sortG);
  const card=([id,t])=>{
    const steps=[...Store.tasks()].filter(([,x])=>x.parent===id),sd=steps.filter(([,x])=>x.done).length;
    const p=Math.max(0,Math.min(100,t.progress||0));
    let cd="";
    if(t.kind==="big"){
      if(t.due){const n=dayDiff(iso(today()),t.due);
        cd=`<div class="cd${n<0||n===0?" late":n<=7?" soon":""}"><b>${n<0?-n:n===0?"Today":n}</b><span>${n<0?`day${n===-1?"":"s"} overdue`:n===0?"":`day${n===1?"":"s"} to go`} · ${esc(parse(t.due).toLocaleDateString("en-AU",{weekday:"short",day:"numeric",month:"short"}))}</span></div>`}
      else cd=`<div class="cd"><span>No date set</span></div>`;
    }
    return `<article class="gc${t.done?" done":""}" data-id="${id}" style="--c:${areaVar(t.area)}">
      <button type="button" class="gc-head" data-act="gopen"><span class="ico">${esc(t.icon||suggestIcon(t.title,t.area))}</span><span class="gc-t">${esc(t.title)}<small>${esc(areaName(t.area))}${t.kind==="goal"&&t.due?` · by ${esc(relDay(t.due))}`:""}</small></span></button>
      ${cd}
      <label class="gc-prog"><span>Progress <b>${p}%</b></span><input type="range" min="0" max="100" step="5" value="${p}" data-prog="${id}" aria-label="Progress for ${esc(t.title)}"></label>
      ${steps.length?`<div class="gc-steps">${sd} of ${steps.length} steps done</div>`:""}
      ${t.done?"":`<div class="gc-act"><button type="button" class="link" data-act="gstep">+ Step for today</button><button type="button" class="link" data-act="gplan">Block out time</button></div>`}
    </article>`};
  $("goalList").innerHTML=goals.map(card).join("")||`<p class="g-empty">Something you chip away at, like a portfolio or a skill. Tap + to add one.</p>`;
  $("bigList").innerHTML=bigs.map(card).join("")||`<p class="g-empty">Major deadlines with a countdown. Tap + and choose “Deadline”.</p>`;
}

/* ================= RENDER ALL ================= */
function render(){
  renderHeader();
  if(view==="timeline")renderTimeline();
  renderInbox();
  if(view==="goals")renderGoals();
  if(sheetOpen()==="taskSheet"&&S.mode==="edit")refreshSubs();
}
function setView(v,feel){
  view=["inbox","timeline","goals"].includes(v)?v:"timeline";
  for(const x of ["inbox","timeline","goals"]){$("v-"+x).hidden=x!==view;const t=$("tab-"+x);t.setAttribute("aria-selected",x===view)}
  if(feel)H("select");
  document.body.dataset.view=view;render();
  if(view==="timeline")requestAnimationFrame(scrollToNow);
}
function scrollToNow(){
  if(sel!==iso(today()))return;const el=document.querySelector(".tl-item.live,.tl-gap.now");
  if(el){const r=el.getBoundingClientRect();if(r.top>innerHeight*.7||r.top<0)window.scrollTo({top:scrollY+r.top-innerHeight*.35,behavior:"smooth"})}
}
function goDay(k,feel){if(k===sel)return;sel=k;if(feel)H("select");
  const tl=$("v-timeline");tl.classList.remove("slide-l","slide-r");void tl.offsetWidth;
  render();}

/* ================= TOAST ================= */
let toastT=null;
function toast(msg,undo){
  const t=$("toast");t.innerHTML=`<span>${esc(msg)}</span>${undo?`<button type="button" id="toastUndo">Undo</button>`:""}`;
  t.classList.add("on");clearTimeout(toastT);toastT=setTimeout(()=>t.classList.remove("on"),undo?5200:2600);
  if(undo)$("toastUndo").onclick=()=>{undo();H("light");t.classList.remove("on")};
}
function deleteWithUndo(coll,id,label){
  const before=Store.get(coll,id);if(!before)return;Store.del(coll,id);H("heavy");
  toast(`Deleted “${label||before.title}”`,()=>Store.set(coll,id,before));
}

/* ================= SHEETS (generic) ================= */
const sheetStack=[];
function openSheet(id){
  const s=$(id);if(!s)return;s.hidden=false;s.setAttribute("aria-hidden","false");
  requestAnimationFrame(()=>{s.classList.add("open");$("scrim").classList.add("on")});
  sheetStack.push(id);document.body.classList.add("sheet-open");
}
function closeSheet(id){
  id=id||sheetStack[sheetStack.length-1];const s=$(id);if(!s)return;
  s.classList.remove("open");s.style.transform="";s.setAttribute("aria-hidden","true");
  const i=sheetStack.lastIndexOf(id);if(i>=0)sheetStack.splice(i,1);
  if(!sheetStack.length){$("scrim").classList.remove("on");document.body.classList.remove("sheet-open")}
  setTimeout(()=>{if(!s.classList.contains("open"))s.hidden=true},320);
  if(document.activeElement&&s.contains(document.activeElement))document.activeElement.blur();
}
const sheetOpen=()=>sheetStack[sheetStack.length-1];
$("scrim").addEventListener("click",()=>{if(sheetOpen()){closeSheet();H("light")}});
document.addEventListener("keydown",e=>{if(e.key==="Escape"&&sheetOpen()){closeSheet()}});
/* drag a sheet down by its handle/header to dismiss */
document.querySelectorAll(".sheet").forEach(s=>{
  const grab=s.querySelector(".sh-grab-zone");if(!grab)return;
  let y0=null,dy=0,armed=false,t0=0;
  grab.addEventListener("pointerdown",e=>{if(e.target.closest("button,input,textarea"))return;y0=e.clientY;dy=0;armed=false;t0=performance.now();grab.setPointerCapture(e.pointerId);s.style.transition="none"});
  grab.addEventListener("pointermove",e=>{if(y0===null)return;dy=Math.max(0,e.clientY-y0);s.style.transform=`translateY(${dy}px)`;
    const a=dy>110;if(a!==armed){armed=a;H("tick")}});
  const up=()=>{if(y0===null)return;y0=null;s.style.transition="";const fast=dy>40&&performance.now()-t0<220;
    if(armed||fast){closeSheet(s.id)}else s.style.transform=""};
  grab.addEventListener("pointerup",up);grab.addEventListener("pointercancel",up);
});

/* ================= TASK SHEET ================= */
let S={};
/* 5-minute steps up to 2h, then 15-minute steps to 4h, then 30-minute steps to 8h */
const DUR_VALUES=[...Array.from({length:24},(_,i)=>(i+1)*5),...Array.from({length:8},(_,i)=>135+i*15),...Array.from({length:8},(_,i)=>270+i*30)];
const DUR_CHIPS=[15,30,45,60,90,120];
let wHour,wMin,wAp,wDur;
function initWheels(){
  wHour=new Wheel($("wHour"),{values:[12,1,2,3,4,5,6,7,8,9,10,11],format:v=>String(v),label:"Hour",onChange:()=>readTime()});
  wMin=new Wheel($("wMin"),{values:Array.from({length:12},(_,i)=>i*5),format:v=>pad(v),label:"Minutes",onChange:()=>readTime()});
  wAp=new Wheel($("wAp"),{values:["am","pm"],format:v=>v,label:"Morning or afternoon",onChange:()=>readTime()});
  wDur=new Wheel($("wDur"),{values:DUR_VALUES,axis:"x",itemSize:52,format:v=>v<60?v+"m":Math.floor(v/60)+"h"+(v%60?pad(v%60):""),label:"Duration",
    onChange:v=>{S.dur=v;S.durTouched=true;syncDur()}});
}
function readTime(){
  const h=wHour.value,m=wMin.value,ap=wAp.value;
  S.start=((h%12)+(ap==="pm"?12:0))*60+m;S.timeTouched=true;syncRange();
}
function setTimeWheels(min,animate){
  min=Math.round(min/5)*5;const h=Math.floor(min/60)%24,m=min%60;
  wHour.setValue(h%12===0?12:h%12,animate);wMin.setValue(m,animate);wAp.setValue(h<12?"am":"pm",animate);
}
function syncRange(){
  $("tsRange").textContent=S.anytime?"":fmtRange(S.start,S.dur);
  $("tsWhenSum").textContent=S.anytime?relDay(S.date)+" · anytime":relDay(S.date)+" · "+fmtRange(S.start,S.dur);
}
function syncDur(){
  document.querySelectorAll("#tsDurChips button").forEach(b=>b.setAttribute("aria-pressed",+b.dataset.dur===S.dur));
  $("tsDurLbl").textContent=fmtDur(S.dur);syncRange();
}
function buildDateChips(){
  const t=today();let h="";
  for(let i=0;i<8;i++){const d=addDays(t,i),k=iso(d);
    h+=`<button type="button" class="dchip" data-date="${k}" aria-pressed="${k===S.date}"><b>${i===0?"Today":i===1?"Tmrw":DOW[dow(d)]}</b><span>${d.getDate()}</span></button>`}
  const inRange=dayDiff(iso(t),S.date)>=0&&dayDiff(iso(t),S.date)<8;
  h+=`<label class="dchip pick${inRange?"":" on"}"><b>${inRange?"Pick":esc(parse(S.date).toLocaleDateString("en-AU",{day:"numeric",month:"short"}))}</b><span>📅</span><input type="date" id="tsDateIn" value="${S.date}" aria-label="Pick a date"></label>`;
  $("tsDates").innerHTML=h;
  $("tsDateIn").addEventListener("change",e=>{if(e.target.value){S.date=e.target.value;S.dateTouched=true;H("select");buildDateChips();syncRange();syncRepeat()}});
}
function buildAreaChips(){
  $("tsAreas").innerHTML=AREAS.map(a=>`<button type="button" class="achip" data-area="${a.id}" style="--c:var(--a-${a.id})" aria-pressed="${a.id===S.area}"><i></i>${a.name}</button>`).join("");
}
function syncDest(){
  document.querySelectorAll("#tsDest button").forEach(b=>b.setAttribute("aria-pressed",b.dataset.dest===S.dest));
  $("tsTimelineF").hidden=S.dest!=="timeline";$("tsInboxF").hidden=S.dest!=="inbox";$("tsGoalF").hidden=S.dest!=="goal";
  if(S.dest==="goal"){document.querySelectorAll("#tsGoalKind button").forEach(b=>b.setAttribute("aria-pressed",b.dataset.gk===S.goalKind));$("tsGoalDate").value=S.goalDate||"";
    $("tsGoalDateLbl").textContent=S.goalKind==="big"?"Deadline":"Aim to finish by (optional)"}
  if(S.dest==="inbox")document.querySelectorAll("#tsEst button").forEach(b=>b.setAttribute("aria-pressed",+b.dataset.est===(S.est||0)));
  syncSave();
}
function syncAnytime(){
  document.querySelectorAll("#tsTimeMode button").forEach(b=>b.setAttribute("aria-pressed",(b.dataset.tm==="any")===S.anytime));
  $("tsTimeBlock").hidden=S.anytime;syncRange();
}
function syncRepeat(){
  document.querySelectorAll("#tsRepeat button").forEach(b=>b.setAttribute("aria-pressed",b.dataset.rep===S.repeat));
  const rep=S.repeat!=="once";$("tsRepOpts").hidden=!rep;
  if(!rep){syncSave();return}
  $("tsDays").hidden=S.repeat!=="weekly";
  $("tsDays").innerHTML=DOW.map((d,i)=>`<button type="button" data-dw="${i}" aria-pressed="${S.days.includes(i)}">${d[0]}<span class="sr">${d}</span></button>`).join("");
  const unit=S.repeat==="daily"?"day":S.repeat==="weekly"?"week":"month";
  $("tsEveryN").textContent=S.interval;$("tsEveryU").textContent=unit+(S.interval>1?"s":"");
  $("tsMonthNote").hidden=S.repeat!=="monthly";
  $("tsMonthNote").textContent=`On the ${ordinal(parse(S.date).getDate())} of the month (or the last day if shorter).`;
  document.querySelectorAll("#tsEnds button").forEach(b=>b.setAttribute("aria-pressed",(b.dataset.end==="on")===!!S.until));
  $("tsUntil").hidden=!S.until;$("tsUntil").value=S.until||"";
  syncSave();
}
function syncIcon(){$("tsIcon").textContent=S.icon;$("tsIcon").style.setProperty("--c",areaVar(S.area))}
function syncSave(){
  const ok=!!(S.cleanTitle||S.title||"").trim();
  $("tsSave").disabled=!ok;
  const lbl=S.mode==="edit"?"Save changes":S.dest==="inbox"?"Add to Inbox":S.dest==="goal"?(S.goalKind==="big"?"Add deadline":"Add goal"):S.repeat!=="once"?"Create routine":"Create task";
  $("tsSave").textContent=lbl;
}
function refreshSubs(){
  $("tsSubs").innerHTML=S.subs.map((s,i)=>`<li data-i="${i}"><button type="button" class="chk xs" data-act="subtoggle" aria-pressed="${!!s.done}" aria-label="${s.done?"Undo":"Done"}: ${esc(s.t)}">${CHECK}</button>
    <input type="text" value="${esc(s.t)}" data-sub="${i}" aria-label="Subtask"><button type="button" class="x" data-act="subdel" aria-label="Remove subtask">×</button></li>`).join("");
}

/* open the sheet: opts = {dest, date, start, dur, edit:{type,id,k}, parent, title} */
function openTaskSheet(opts){
  opts=opts||{};
  const td=iso(today()),isTodaySel=(opts.date||sel)===td;
  const defStart=isTodaySel?Math.min(1410,Math.ceil((nowMin()+5)/15)*15):9*60;
  S={mode:"new",dest:opts.dest||(view==="inbox"?"inbox":view==="goals"?"goal":"timeline"),title:opts.title||"",cleanTitle:"",icon:"🗒️",iconAuto:true,area:"personal",
    date:opts.date||sel,anytime:false,start:opts.start!=null?opts.start:defStart,dur:opts.dur||30,repeat:"once",interval:1,days:[dow(parse(opts.date||sel))],until:"",
    goalKind:"goal",goalDate:"",subs:[],notes:"",parent:opts.parent||"",est:0,nlp:{},src:null};
  if(opts.edit)loadForEdit(opts.edit);
  $("tsHead").textContent=S.mode==="edit"?(S.src.type==="rt"?"Edit routine":"Edit task"):"New task";
  $("tsTitle").value=S.title;$("tsNotes").value=S.notes;
  if(S.mode==="new"&&opts.title)S.icon=suggestIcon(opts.title,S.area);
  buildAreaChips();syncIcon();buildDateChips();syncDest();syncAnytime();syncRepeat();refreshSubs();renderNlp();
  $("tsEditActs").hidden=S.mode!=="edit";
  $("tsToInbox").hidden=!(S.mode==="edit"&&S.src.type==="task"&&S.dest==="timeline");
  openSheet("taskSheet");
  requestAnimationFrame(()=>{setTimeWheels(S.start,false);wDur.setValue(S.dur,false);syncDur();S.timeTouched=false;S.durTouched=false});
  if(S.mode==="new")setTimeout(()=>{$("tsTitle").focus()},280);
  autoGrow();
}
function loadForEdit(e){
  S.mode="edit";S.src=e;
  if(e.type==="task"){
    const t=Store.get("tasks",e.id);if(!t)return;
    Object.assign(S,{title:t.title||"",icon:t.icon||suggestIcon(t.title,t.area),iconAuto:!t.icon,area:t.area||"personal",notes:t.notes||"",parent:t.parent||"",
      subs:(t.subtasks||[]).map(s=>({...s})),est:t.est||0});
    if(t.kind==="goal"||t.kind==="big"){S.dest="goal";S.goalKind=t.kind;S.goalDate=t.due||"";if(t.schedDate&&t.schedDur){S.date=t.schedDate;S.start=t.schedStart;S.dur=t.schedDur}}
    else if(isInbox(t)){S.dest="inbox";if(t.est)S.dur=t.est}
    else{S.dest="timeline";S.date=t.schedDate||t.due||sel;S.anytime=!(t.schedDate&&t.schedDur);if(!S.anytime){S.start=t.schedStart;S.dur=t.schedDur}}
  }else{
    const r=Store.get("routines",e.id);if(!r)return;const R=rtRule(r);
    Object.assign(S,{title:r.title||"",icon:r.icon||suggestIcon(r.title,r.area),iconAuto:!r.icon,area:r.area||"personal",notes:r.notes||"",dest:"timeline",
      date:e.k||sel,anytime:!rtTimed(r),start:rtTimed(r)?r.start:9*60,dur:rtTimed(r)?r.dur:30,repeat:R.freq,interval:R.interval,days:R.days.slice(),until:r.until||"",
      subs:(r.subtasks||[]).map(s=>({...s,done:((r.subDone||{})[e.k]||[]).includes(s.id)}))});
  }
}

/* --- natural language in the title: "Gym tomorrow at 6pm for 1h", "Read every weekday 9:30pm 20 min" --- */
const WD=["mon","tue","wed","thu","fri","sat","sun"];
function parseNL(raw){
  let s=" "+raw+" ";const out={};const take=re=>{const m=s.match(re);if(m){s=s.replace(m[0]," ");}return m};
  const hm=(h,m,ap)=>{h=+h;m=+(m||0);if(h>23||m>59)return null;if(ap){ap=ap[0].toLowerCase();if(h===12)h=0;if(ap==="p")h+=12}else if(h<=12){if(h>=1&&h<=6)h+=12}return h*60+m};
  let m;
  if((m=take(/\s(?:from\s+)?(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm)?\s*(?:-|–|to)\s*(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm)\b/i))){
    const e=hm(m[4],m[5],m[6]);let st=hm(m[1],m[2],m[3]||m[6]);if(st!=null&&e!=null){if(st>e&&!m[3])st-=720;if(e>st){out.time=st;out.dur=e-st;out.tTxt=fmtRange(st,e-st)}}}
  if(out.time==null&&(m=take(/\s(?:at|@)\s*(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)?(?=\s)/i))){const t=hm(m[1],m[2],m[3]);if(t!=null){out.time=t;out.tTxt=fmtTime(t)}}
  if(out.time==null&&(m=take(/\s(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm)(?=\s)/i))){const t=hm(m[1],m[2],m[3]);if(t!=null){out.time=t;out.tTxt=fmtTime(t)}}
  if(out.time==null&&(m=take(/\s(noon|midday|midnight)(?=\s)/i))){out.time=/mid(night)/i.test(m[1])?0:720;out.tTxt=fmtTime(out.time)}
  if(out.dur==null&&(m=take(/\s(?:for\s+)?(\d+(?:\.\d+)?)\s*(?:h|hr|hrs|hour|hours)(?:\s*(?:and\s*)?(\d{1,2})\s*(?:m|min|mins|minutes)?)?(?=\s)/i))){out.dur=Math.round(parseFloat(m[1])*60)+(+(m[2]||0))}
  if(out.dur==null&&(m=take(/\s(?:for\s+)?(\d{1,3})\s*(?:m|min|mins|minute|minutes)(?=\s)/i))){out.dur=+m[1]}
  if(out.dur!=null&&(out.dur<5||out.dur>720))delete out.dur;
  const td=today();
  if((m=take(/\s(every\s*day|daily|each\s+day)(?=\s)/i)))out.rep={freq:"daily",days:[]};
  else if((m=take(/\s(every\s+weekday|weekdays)(?=\s)/i)))out.rep={freq:"weekly",days:[0,1,2,3,4]};
  else if((m=take(/\s(every\s+weekend|weekends)(?=\s)/i)))out.rep={freq:"weekly",days:[5,6]};
  else if((m=take(/\severy\s+((?:(?:mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun)[a-z]*(?:\s*(?:,|and|&)\s*)?)+)(?=\s)/i))){
    const days=[...m[1].toLowerCase().matchAll(/(mon|tue|wed|thu|fri|sat|sun)/g)].map(x=>WD.indexOf(x[1]));out.rep={freq:"weekly",days:[...new Set(days)]}}
  else if((m=take(/\s(weekly|every\s+week)(?=\s)/i)))out.rep={freq:"weekly",days:null};
  else if((m=take(/\s(monthly|every\s+month)(?=\s)/i)))out.rep={freq:"monthly",days:[]};
  if((m=take(/\s(today|tonight)(?=\s)/i))){out.date=iso(td);if(/tonight/i.test(m[1])&&out.time==null){out.time=19*60;out.tTxt=fmtTime(out.time)}}
  else if((m=take(/\s(tomorrow|tmrw|tmr)(?=\s)/i)))out.date=iso(addDays(td,1));
  else if(!out.rep&&(m=take(/\s(?:on\s+|next\s+)?(mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun)[a-z]*(?=\s)/i))){
    const want=WD.indexOf(m[1].slice(0,3).toLowerCase());let n=(want-dow(td)+7)%7;if(n===0)n=7;out.date=iso(addDays(td,n))}
  else if((m=take(/\s(?:on\s+)?(?:the\s+)?(\d{1,2})(?:st|nd|rd|th)(?=\s)/i))){const n=+m[1];if(n>=1&&n<=31){let d=new Date(td.getFullYear(),td.getMonth(),n);if(d<td)d=new Date(td.getFullYear(),td.getMonth()+1,n);out.date=iso(d)}}
  out.clean=s.replace(/\s+(at|on|for|from|every|by)\s*$/i," ").replace(/\s{2,}/g," ").trim();
  return out;
}
function applyNlp(){
  const p=parseNL(S.title),prev=S.nlp||{};S.nlp=p;S.cleanTitle=p.clean;
  if(p.time!=null&&p.time!==prev.time){S.start=p.time;S.anytime=false;if(S.dest==="inbox")S.dest="timeline";setTimeWheels(p.time,true);syncAnytime();syncDest()}
  if(p.dur!=null&&p.dur!==prev.dur){S.dur=p.dur;wDur.setValue(p.dur,true);syncDur()}
  if(p.date&&p.date!==prev.date){S.date=p.date;if(S.dest==="inbox")S.dest="timeline";buildDateChips();syncDest()}
  if(p.rep&&JSON.stringify(p.rep)!==JSON.stringify(prev.rep)){S.repeat=p.rep.freq;S.days=p.rep.days&&p.rep.days.length?p.rep.days:[dow(parse(S.date))];if(S.dest!=="timeline")S.dest="timeline";syncDest();syncRepeat()}
  if((p.time!=null&&p.time!==prev.time)||(p.date&&p.date!==prev.date)||(p.rep&&!prev.rep)||(p.dur!=null&&p.dur!==prev.dur))H("light");
  if(S.iconAuto){S.icon=suggestIcon(p.clean||S.title,S.area);syncIcon()}
  renderNlp();syncRange();syncSave();
}
function renderNlp(){
  const p=S.nlp||{},chips=[];
  if(p.date)chips.push(relDay(p.date));if(p.tTxt)chips.push(p.tTxt);if(p.dur)chips.push(fmtDur(p.dur));
  if(p.rep)chips.push(p.rep.freq==="daily"?"every day":p.rep.freq==="monthly"?"monthly":p.rep.days&&p.rep.days.length?"every "+p.rep.days.map(i=>DOW[i]).join(", "):"weekly");
  $("tsNlp").innerHTML=chips.length?`<span class="nlp-lbl">Understood</span>${chips.map(c=>`<span class="nlp-chip">${esc(c)}</span>`).join("")}${p.clean&&p.clean!==S.title.trim()?`<span class="nlp-as">Saves as <b>${esc(p.clean)}</b></span>`:""}`:"";
  $("tsNlp").hidden=!chips.length;
}
function autoGrow(){const t=$("tsTitle");t.style.height="auto";t.style.height=Math.min(120,t.scrollHeight)+"px"}

/* --- save --- */
function buildTaskData(base){
  const title=(S.cleanTitle||S.title).trim();
  const common={title,icon:S.icon,area:S.area,notes:S.notes.trim(),subtasks:S.subs.filter(s=>s.t.trim()).map(s=>({id:s.id||newId("s"),t:s.t.trim(),done:!!s.done})),parent:S.parent||""};
  const b=Object.assign({kind:"day",due:"",schedDate:"",schedStart:0,schedDur:0,est:0,done:false,doneAt:0,priority:"med",progress:0,createdAt:Date.now()},base||{},common);
  if(S.dest==="inbox"){Object.assign(b,{kind:"day",due:"",schedDate:"",schedStart:0,schedDur:0,est:S.est||0})}
  else if(S.dest==="goal"){Object.assign(b,{kind:S.goalKind,due:S.goalDate||""});if(!(base&&base.kind===S.goalKind))b.progress=b.progress||0}
  else{Object.assign(b,{kind:base&&(base.kind==="goal"||base.kind==="big")?base.kind:"day",due:S.date,schedDate:S.anytime?"":S.date,schedStart:S.anytime?0:S.start,schedDur:S.anytime?0:S.dur})}
  return b;
}
function buildRoutineData(base){
  const title=(S.cleanTitle||S.title).trim();
  const r=Object.assign({done:{},skip:{},subDone:{},createdAt:Date.now()},base||{},{
    title,icon:S.icon,area:S.area,notes:S.notes.trim(),freq:S.repeat,interval:S.interval,
    days:S.repeat==="weekly"?S.days.slice().sort((a,b)=>a-b):[dow(parse(S.date))],
    start:S.anytime?-1:S.start,dur:S.anytime?0:S.dur,from:(base&&base.from&&S.scope==="all")?base.from:S.date,until:S.until||"",
    subtasks:S.subs.filter(s=>s.t.trim()).map(s=>({id:s.id||newId("s"),t:s.t.trim()}))});
  return r;
}
function save(){
  if($("tsSave").disabled)return;
  const isRep=S.dest==="timeline"&&S.repeat!=="once";
  if(S.mode==="new"){
    if(isRep){const id=newId("r");Store.set("routines",id,buildRoutineData())}
    else{const id=newId("t");Store.set("tasks",id,buildTaskData())}
    H("success");closeSheet("taskSheet");
    const where=S.dest==="inbox"?"Inbox":S.dest==="goal"?"Goals":relDay(S.date);
    toast(isRep?`Routine added · ${rtSummary(buildRoutineData())}`:`Added to ${where}`);
    if(S.dest==="timeline"&&!isRep&&S.date!==sel&&view==="timeline"){sel=S.date;render()}
    return;
  }
  /* editing */
  if(S.src.type==="task"){
    const t=Store.get("tasks",S.src.id);if(!t){closeSheet("taskSheet");return}
    if(isRep){Store.del("tasks",S.src.id);Store.set("routines",newId("r"),buildRoutineData());toast("Turned into a routine")}
    else Store.set("tasks",S.src.id,buildTaskData(t));
    H("success");closeSheet("taskSheet");return;
  }
  /* a routine: ask which occurrences */
  askScope("Save changes to", scope=>{applyRoutineEdit(scope,false);H("success");closeSheet("taskSheet")});
}
function applyRoutineEdit(scope,del){
  const id=S.src.id,k=S.src.k,r=Store.get("routines",id);if(!r)return;
  if(scope==="one"){
    const skip=keepRecent(r.skip,k,true);Store.set("routines",id,{...r,skip});
    if(!del){S.date=k;const isRep=S.repeat!=="once";
      if(isRep){S.scope="one"}
      const t=buildTaskData({});t.due=S.date;Store.set("tasks",newId("t"),t)}
    toast(del?"Skipped this one":"Changed this one only");return;
  }
  if(scope==="future"){
    if(k<=r.from){scope="all"}else{
      Store.set("routines",id,{...r,until:iso(addDays(parse(k),-1))});
      if(!del){S.scope="future";const nr=buildRoutineData({done:Object.fromEntries(Object.entries(r.done||{}).filter(([x])=>x>=k)),skip:{},subDone:{}});nr.from=k;Store.set("routines",newId("r"),nr)}
      toast(del?"Stopped from this day on":"Changed from this day on");return;
    }
  }
  if(del){Store.del("routines",id);toast(`Deleted “${r.title}”`,()=>Store.set("routines",id,r));return}
  S.scope="all";
  if(S.repeat==="once"){ /* routine turned back into a one-off on the selected day */
    Store.del("routines",id);const t=buildTaskData({});t.due=S.date;Store.set("tasks",newId("t"),t);toast("Now a one-off task");return}
  Store.set("routines",id,buildRoutineData(r));toast("Updated every repeat");
}
let scopeCb=null;
function askScope(title,cb){$("scopeTitle").textContent=title;scopeCb=cb;openSheet("scopeSheet");H("light")}
$("scopeSheet").addEventListener("click",e=>{const b=e.target.closest("[data-scope]");if(!b)return;const sc=b.dataset.scope;closeSheet("scopeSheet");if(sc!=="cancel"&&scopeCb)scopeCb(sc);scopeCb=null});

/* sheet events */
$("tsTitle").addEventListener("input",()=>{S.title=$("tsTitle").value.replace(/\n/g," ");if($("tsTitle").value!==S.title)$("tsTitle").value=S.title;autoGrow();applyNlp()});
$("tsTitle").addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();if(!$("tsSave").disabled)save()}});
$("tsNotes").addEventListener("input",e=>{S.notes=e.target.value});
$("tsSave").addEventListener("click",save);
$("tsCancel").addEventListener("click",()=>{closeSheet("taskSheet");H("light")});
$("tsIcon").addEventListener("click",()=>{openIconSheet();H("select")});
$("taskSheet").addEventListener("click",e=>{
  const a=e.target.closest("[data-area]");if(a){S.area=a.dataset.area;if(S.iconAuto)S.icon=suggestIcon(S.cleanTitle||S.title,S.area);buildAreaChips();syncIcon();H("select");return}
  const d=e.target.closest("[data-dest]");if(d){S.dest=d.dataset.dest;syncDest();H("select");return}
  const dc=e.target.closest("[data-date]");if(dc){S.date=dc.dataset.date;S.dateTouched=true;if(S.repeat==="weekly"&&S.days.length===1)S.days=[dow(parse(S.date))];buildDateChips();syncRange();syncRepeat();H("select");return}
  const tm=e.target.closest("[data-tm]");if(tm){S.anytime=tm.dataset.tm==="any";syncAnytime();H("select");if(!S.anytime)requestAnimationFrame(()=>{setTimeWheels(S.start,false);wDur.setValue(S.dur,false)});return}
  const dch=e.target.closest("[data-dur]");if(dch){S.dur=+dch.dataset.dur;wDur.setValue(S.dur,true);syncDur();H("select");return}
  const rep=e.target.closest("[data-rep]");if(rep){S.repeat=rep.dataset.rep;if(S.repeat==="weekly"&&!S.days.length)S.days=[dow(parse(S.date))];syncRepeat();H("select");return}
  const dw=e.target.closest("[data-dw]");if(dw){const i=+dw.dataset.dw;S.days=S.days.includes(i)?(S.days.length>1?S.days.filter(x=>x!==i):S.days):[...S.days,i];syncRepeat();H("tick");return}
  const st=e.target.closest("[data-step]");if(st){S.interval=Math.max(1,Math.min(12,S.interval+ +st.dataset.step));syncRepeat();H("tick");return}
  const en=e.target.closest("[data-end]");if(en){S.until=en.dataset.end==="on"?(S.until||iso(addDays(parse(S.date),28))):"";syncRepeat();H("select");return}
  const gk=e.target.closest("[data-gk]");if(gk){S.goalKind=gk.dataset.gk;syncDest();H("select");return}
  const es=e.target.closest("[data-est]");if(es){S.est=+es.dataset.est;syncDest();H("select");return}
  const act=e.target.closest("[data-act]");if(!act)return;
  const li=act.closest("li[data-i]"),i=li?+li.dataset.i:-1;
  if(act.dataset.act==="subtoggle"){S.subs[i].done=!S.subs[i].done;refreshSubs();H(S.subs[i].done?"light":"tick");
    if(S.mode==="edit")persistSubs();}
  else if(act.dataset.act==="subdel"){S.subs.splice(i,1);refreshSubs();H("light")}
});
$("tsUntil").addEventListener("change",e=>{S.until=e.target.value;syncRepeat()});
$("tsGoalDate").addEventListener("change",e=>{S.goalDate=e.target.value});
$("tsSubs").addEventListener("input",e=>{const i=e.target.dataset.sub;if(i!=null)S.subs[+i].t=e.target.value});
$("tsSubAdd").addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();const v=e.target.value.trim();if(!v)return;S.subs.push({id:newId("s"),t:v,done:false});e.target.value="";refreshSubs();H("tick")}});
$("tsSubAddBtn").addEventListener("click",()=>{const inp=$("tsSubAdd"),v=inp.value.trim();if(!v){inp.focus();return}S.subs.push({id:newId("s"),t:v,done:false});inp.value="";refreshSubs();H("tick");inp.focus()});
/* ticking a subtask while editing saves straight away, like a checklist */
function persistSubs(){
  if(S.src.type==="task"){const t=Store.get("tasks",S.src.id);if(t)Store.set("tasks",S.src.id,{...t,subtasks:S.subs.map(s=>({id:s.id,t:s.t,done:!!s.done}))})}
  else{const r=Store.get("routines",S.src.id);if(!r)return;const sd=Object.assign({},r.subDone||{});sd[S.src.k]=S.subs.filter(s=>s.done).map(s=>s.id);
    Store.set("routines",S.src.id,{...r,subDone:keepRecentArr(sd)})}
}
function keepRecentArr(m){const o={},cut=iso(addDays(today(),-90));for(const [x,v] of Object.entries(m))if(x>=cut&&v&&v.length)o[x]=v;return o}
$("tsDelete").addEventListener("click",()=>{
  if(S.src.type==="task"){const t=Store.get("tasks",S.src.id);closeSheet("taskSheet");deleteWithUndo("tasks",S.src.id,t&&t.title);return}
  askScope("Delete",sc=>{applyRoutineEdit(sc,true);H("heavy");closeSheet("taskSheet")});
});
$("tsDup").addEventListener("click",()=>{
  if(S.src.type==="task"){const t=Store.get("tasks",S.src.id);if(t){Store.set("tasks",newId("t"),{...t,done:false,doneAt:0,createdAt:Date.now()});toast("Duplicated")}}
  else{const r=Store.get("routines",S.src.id);if(r){Store.set("routines",newId("r"),{...r,done:{},skip:{},subDone:{},createdAt:Date.now()});toast("Duplicated")}}
  H("success");closeSheet("taskSheet");
});
$("tsToInbox").addEventListener("click",()=>{const t=Store.get("tasks",S.src.id);if(!t)return;
  Store.set("tasks",S.src.id,{...t,due:"",schedDate:"",schedStart:0,schedDur:0,est:t.schedDur||t.est||0});H("success");closeSheet("taskSheet");toast("Moved to Inbox",()=>Store.set("tasks",S.src.id,t))});

/* ================= ICON SHEET ================= */
function openIconSheet(){
  const sug=[...new Set([suggestIcon(S.cleanTitle||S.title,S.area),AREA_ICON[S.area],...ICON_SET])];
  $("iconGrid").innerHTML=sug.map(ic=>`<button type="button" data-ic="${esc(ic)}" aria-pressed="${ic===S.icon}" aria-label="${esc(ic)}">${esc(ic)}</button>`).join("");
  openSheet("iconSheet");
}
$("iconGrid").addEventListener("click",e=>{const b=e.target.closest("[data-ic]");if(!b)return;S.icon=b.dataset.ic;S.iconAuto=false;syncIcon();H("select");closeSheet("iconSheet")});

/* ================= TIMELINE INTERACTIONS ================= */
function itemFromKey(key){
  if(key.startsWith("t:"))return {type:"task",id:key.slice(2),k:sel};
  const [,id,k]=key.split(":");return {type:"rt",id,k};
}
function liveItem(key){const {timed,anytime}=dayItems(sel);return [...timed,...anytime].find(x=>x.key===key)}
document.getElementById("v-timeline").addEventListener("click",e=>{
  if(dragging||suppressClick)return;
  const g=e.target.closest("[data-gap]");if(g){const [s,d]=g.dataset.gap.split(",").map(Number);H("select");openTaskSheet({dest:"timeline",date:sel,start:s,dur:Math.max(15,d)});return}
  const act=e.target.closest("[data-act]");if(!act)return;
  const host=act.closest("[data-key]");if(!host)return;const key=host.dataset.key;
  if(act.dataset.act==="toggle"){const it=liveItem(key);if(!it)return;
    H(it.done?"light":"success");host.classList.toggle("done",!it.done);host.classList.add("just");toggleItem(it);return}
  if(act.dataset.act==="open"){H("select");openTaskSheet({edit:itemFromKey(key)})}
});
$("emptyAdd").addEventListener("click",()=>{H("select");openTaskSheet({dest:"timeline",date:sel})});
$("emptyInbox").addEventListener("click",()=>setView("inbox",true));

/* long-press to pick up, drag up/down to move in 5-minute steps, drop on the bin to delete */
let suppressClick=false;
(function(){
  const PX_PER_5=10,HOLD=360;
  let hold=null,cand=null;
  function begin(li,x,y){
    const key=li.dataset.key,it=liveItem(key);if(!it)return;
    dragging={li,key,it,x0:x,y0:y,delta:0,overBin:false};
    li.classList.add("lifted");document.body.classList.add("dragging");H("medium");
    $("fab").classList.add("bin");$("dragTip").hidden=false;moveTip(y);
  }
  function moveTip(y){const t=$("dragTip"),it=dragging.it,s=Math.max(0,Math.min(1435-it.dur,it.start+dragging.delta));
    t.textContent=dragging.overBin?"Release to delete":fmtRange(s,it.dur);t.style.top=(y-64)+"px";t.classList.toggle("bin",dragging.overBin)}
  function move(x,y){
    const dy=y-dragging.y0;dragging.li.style.transform=`translateY(${dy}px) scale(1.02)`;
    const d=Math.round(dy/PX_PER_5)*5;
    if(d!==dragging.delta){dragging.delta=d;H("tick")}
    const b=$("fab").getBoundingClientRect(),over=x>b.left-24&&x<b.right+24&&y>b.top-24&&y<b.bottom+24;
    if(over!==dragging.overBin){dragging.overBin=over;$("fab").classList.toggle("hot",over);H(over?"warn":"tick")}
    moveTip(y);
  }
  function finish(){
    const d=dragging;dragging=null;suppressClick=true;setTimeout(()=>suppressClick=false,80);
    d.li.classList.remove("lifted");d.li.style.transform="";document.body.classList.remove("dragging");
    $("fab").classList.remove("bin","hot");$("dragTip").hidden=true;
    if(d.overBin){
      if(d.it.type==="task")deleteWithUndo("tasks",d.it.id,d.it.title);
      else{S={mode:"edit",nlp:{},cleanTitle:"",subs:[],notes:"",src:{type:"rt",id:d.it.id,k:d.it.k}};askScope("Delete",sc=>{applyRoutineEdit(sc,true);H("heavy")})}
      return;
    }
    if(!d.delta){H("light");return}
    const ns=Math.max(0,Math.min(1435-d.it.dur,d.it.start+d.delta));
    if(d.it.type==="task"){const t=Store.get("tasks",d.it.id);const before={...t};Store.set("tasks",d.it.id,{...t,schedStart:ns});H("success");
      toast(`Moved to ${fmtTime(ns)}`,()=>Store.set("tasks",d.it.id,before))}
    else{const r=Store.get("routines",d.it.id);
      S={mode:"edit",dest:"timeline",nlp:{},cleanTitle:"",subs:[],notes:"",parent:"",est:0,repeat:"weekly",interval:1,days:[],until:""};
      loadForEdit({type:"rt",id:d.it.id,k:d.it.k});S.start=ns;
      askScope(`Move “${r.title}” to ${fmtTime(ns)} for`,sc=>{applyRoutineEdit(sc,false);H("success")})}
  }
  const tl=$("timeline");
  /* touch */
  tl.addEventListener("touchstart",e=>{
    const li=e.target.closest(".tl-item");if(!li||e.target.closest(".chk")||e.touches.length>1)return;
    const t=e.touches[0];cand={li,x:t.clientX,y:t.clientY};
    hold=setTimeout(()=>{if(cand){begin(cand.li,cand.x,cand.y);cand=null}},HOLD);
  },{passive:true});
  document.addEventListener("touchmove",e=>{
    const t=e.touches[0];
    if(cand&&(Math.abs(t.clientX-cand.x)>8||Math.abs(t.clientY-cand.y)>8)){clearTimeout(hold);cand=null}
    if(dragging){e.preventDefault();move(t.clientX,t.clientY)}
  },{passive:false});
  const tEnd=()=>{clearTimeout(hold);cand=null;if(dragging)finish()};
  document.addEventListener("touchend",tEnd);document.addEventListener("touchcancel",tEnd);
  tl.addEventListener("contextmenu",e=>{if(e.target.closest(".tl-item"))e.preventDefault()});
  /* mouse */
  tl.addEventListener("mousedown",e=>{
    const li=e.target.closest(".tl-item");if(!li||e.button!==0||e.target.closest(".chk"))return;
    cand={li,x:e.clientX,y:e.clientY};hold=setTimeout(()=>{if(cand){begin(cand.li,cand.x,cand.y);cand=null}},HOLD);
  });
  document.addEventListener("mousemove",e=>{
    if(cand&&(Math.abs(e.clientX-cand.x)>6||Math.abs(e.clientY-cand.y)>6)){clearTimeout(hold);cand=null}
    if(dragging){e.preventDefault();move(e.clientX,e.clientY)}
  });
  document.addEventListener("mouseup",()=>{clearTimeout(hold);cand=null;if(dragging)finish()});
})();

/* swipe sideways: on the week strip = change week; on the day = change day */
function swipe(el,onL,onR,guard){
  let x0=null,y0=0,t0=0;
  el.addEventListener("touchstart",e=>{if(e.touches.length!==1||(guard&&guard(e))){x0=null;return}x0=e.touches[0].clientX;y0=e.touches[0].clientY;t0=Date.now()},{passive:true});
  el.addEventListener("touchend",e=>{if(x0===null||dragging)return;const t=e.changedTouches[0],dx=t.clientX-x0,dy=t.clientY-y0;x0=null;
    if(Date.now()-t0>650||Math.abs(dx)<60||Math.abs(dx)<Math.abs(dy)*1.7)return;(dx<0?onL:onR)()},{passive:true});
}
swipe($("weekStrip"),()=>{goDay(iso(addDays(parse(sel),7)),true);slide("l")},()=>{goDay(iso(addDays(parse(sel),-7)),true);slide("r")});
swipe($("v-timeline"),()=>{goDay(iso(addDays(parse(sel),1)),true);slide("l")},()=>{goDay(iso(addDays(parse(sel),-1)),true);slide("r")},e=>!!e.target.closest(".any-list"));
function slide(dir){const el=$("dayWrap");el.classList.remove("slide-l","slide-r");void el.offsetWidth;el.classList.add("slide-"+dir)}
$("weekStrip").addEventListener("click",e=>{const b=e.target.closest("[data-day]");if(!b)return;const k=b.dataset.day;if(k===sel)return;slide(k>sel?"l":"r");goDay(k,true)});
$("todayBtn").addEventListener("click",()=>{const k=iso(today());slide(k>sel?"l":"r");goDay(k,true);requestAnimationFrame(scrollToNow)});
$("monthBtn").addEventListener("click",()=>{const i=$("jumpDate");i.value=sel;try{i.showPicker()}catch(e){i.focus();i.click()}});
$("jumpDate").addEventListener("change",e=>{if(e.target.value){goDay(e.target.value,true)}});

/* ================= INBOX INTERACTIONS ================= */
$("inboxAdd").addEventListener("submit",e=>{
  e.preventDefault();const inp=$("inboxIn"),v=inp.value.trim();if(!v)return;
  const p=parseNL(v),title=p.clean||v;
  const t={kind:"day",title,icon:suggestIcon(title,"personal"),area:"personal",due:"",schedDate:"",schedStart:0,schedDur:0,est:p.dur||0,done:false,doneAt:0,priority:"med",progress:0,parent:"",notes:"",subtasks:[],createdAt:Date.now()};
  if(p.date||p.time!=null){t.due=p.date||sel;if(p.time!=null){t.schedDate=t.due;t.schedStart=p.time;t.schedDur=p.dur||30}}
  Store.set("tasks",newId("t"),t);inp.value="";H("light");
  if(t.due)toast(`Planned for ${relDay(t.due)}${p.time!=null?" at "+fmtTime(p.time):""}`);
});
$("v-inbox").addEventListener("click",e=>{
  if(ibSwiped)return;
  const act=e.target.closest("[data-act]");if(!act)return;const li=act.closest("[data-id]");if(!li)return;const id=li.dataset.id,t=Store.get("tasks",id);if(!t)return;
  if(act.dataset.act==="ibtoggle"){H(t.done?"light":"success");Store.set("tasks",id,{...t,done:!t.done,doneAt:t.done?0:Date.now()})}
  else if(act.dataset.act==="ibopen"){H("select");openTaskSheet({edit:{type:"task",id}})}
  else if(act.dataset.act==="ibplan"){H("select");openTaskSheet({edit:{type:"task",id}});S.dest="timeline";S.date=sel;S.anytime=false;if(t.est)S.dur=t.est;
    buildDateChips();syncDest();syncAnytime();requestAnimationFrame(()=>{setTimeWheels(S.start,false);wDur.setValue(S.dur,false);syncDur()});$("tsHead").textContent="Plan it"}
});
$("inboxClear").addEventListener("click",()=>{
  const done=[...Store.tasks()].filter(([,t])=>isInbox(t)&&t.done);if(!done.length)return;
  done.forEach(([id])=>Store.del("tasks",id));H("heavy");toast(`Cleared ${done.length} done`,()=>done.forEach(([id,t])=>Store.set("tasks",id,t)));
});
/* swipe right = done, swipe left = delete */
let ibSwiped=false;
(function(){
  let row=null,x0=0,y0=0,dx=0,mode=null,armed=false;const TH=84;
  const lists=[$("inboxList"),$("inboxDoneList")];
  lists.forEach(list=>{
    list.addEventListener("touchstart",e=>{const li=e.target.closest(".ib");if(!li||e.touches.length>1)return;row=li;x0=e.touches[0].clientX;y0=e.touches[0].clientY;dx=0;mode=null;armed=false},{passive:true});
    list.addEventListener("touchmove",e=>{
      if(!row)return;const t=e.touches[0],ddx=t.clientX-x0,ddy=t.clientY-y0;
      if(!mode){if(Math.abs(ddx)>10&&Math.abs(ddx)>Math.abs(ddy)*1.3)mode="swipe";else if(Math.abs(ddy)>10){mode="scroll";row=null;return}else return}
      e.preventDefault();dx=ddx;row.querySelector(".ib-fg").style.transform=`translateX(${dx}px)`;
      row.classList.toggle("sw-l",dx>0);row.classList.toggle("sw-r",dx<0);
      const a=Math.abs(dx)>TH;if(a!==armed){armed=a;row.classList.toggle("armed",a);H(a?"select":"tick")}
    },{passive:false});
    list.addEventListener("touchend",()=>{
      if(!row||mode!=="swipe"){row=null;return}
      const r=row,fg=r.querySelector(".ib-fg"),id=r.dataset.id,t=Store.get("tasks",id);row=null;ibSwiped=true;setTimeout(()=>ibSwiped=false,60);
      if(armed&&t){
        fg.style.transition="transform .2s";fg.style.transform=`translateX(${dx>0?"110%":"-110%"})`;
        setTimeout(()=>{if(dx>0){H("success");Store.set("tasks",id,{...t,done:!t.done,doneAt:t.done?0:Date.now()});toast(t.done?"Back in Inbox":"Done",()=>Store.set("tasks",id,t))}
          else deleteWithUndo("tasks",id,t.title)},180);
      }else{fg.style.transition="transform .2s";fg.style.transform="";setTimeout(()=>{fg.style.transition="";r.classList.remove("sw-l","sw-r","armed")},200)}
    });
  });
})();

/* ================= GOALS INTERACTIONS ================= */
$("v-goals").addEventListener("input",e=>{const r=e.target.closest("[data-prog]");if(!r)return;H("tick");r.closest(".gc-prog").querySelector("b").textContent=r.value+"%"});
$("v-goals").addEventListener("change",e=>{const r=e.target.closest("[data-prog]");if(!r)return;const t=Store.get("tasks",r.dataset.prog);if(t){Store.set("tasks",r.dataset.prog,{...t,progress:+r.value});if(+r.value===100)H("success")}});
$("v-goals").addEventListener("click",e=>{
  const act=e.target.closest("[data-act]");if(!act)return;const card=act.closest("[data-id]");if(!card)return;const id=card.dataset.id;
  if(act.dataset.act==="gopen"){H("select");openTaskSheet({edit:{type:"task",id}})}
  else if(act.dataset.act==="gstep"){H("select");openTaskSheet({dest:"timeline",date:iso(today()),parent:id});S.anytime=true;syncAnytime();$("tsHead").textContent="Next step"}
  else if(act.dataset.act==="gplan"){const t=Store.get("tasks",id);H("select");openTaskSheet({dest:"timeline",date:sel,parent:id,title:t?t.title:""});S.title=t.title;applyNlp();$("tsHead").textContent="Block out time"}
});

/* ================= TABS + FAB ================= */
document.querySelectorAll("[data-tab]").forEach(b=>b.addEventListener("click",()=>{if(b.dataset.tab===view){if(view==="timeline"){window.scrollTo({top:0,behavior:"smooth"})}return}
  history.replaceState(null,"","#"+b.dataset.tab);setView(b.dataset.tab,true)}));
$("fab").addEventListener("click",()=>{if(dragging)return;H("medium");openTaskSheet({})});

/* ================= SETTINGS ================= */
function effectiveDark(){const a=document.documentElement.getAttribute("data-theme");if(a)return a==="dark";return matchMedia("(prefers-color-scheme: dark)").matches}
function applyTheme(t){if(t==="auto")document.documentElement.removeAttribute("data-theme");else document.documentElement.setAttribute("data-theme",t);
  try{localStorage.setItem("life-board-theme",t)}catch(e){}syncThemeColor();syncSettings()}
function syncThemeColor(){const m=document.querySelector('meta[name="theme-color"]');if(m)m.content=getComputedStyle(document.body).backgroundColor}
function syncSettings(){
  let t="auto";try{t=localStorage.getItem("life-board-theme")||"auto"}catch(e){}
  document.querySelectorAll("#setTheme button").forEach(b=>b.setAttribute("aria-pressed",b.dataset.theme===t));
  $("setHaptics").checked=H.isEnabled();$("setEmail").textContent=Store.email||"";
}
(function(){let t=null;try{t=localStorage.getItem("life-board-theme")}catch(e){}if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t)})();
$("gearBtn").addEventListener("click",()=>{syncSettings();openSheet("settingsSheet");H("select")});
$("setTheme").addEventListener("click",e=>{const b=e.target.closest("[data-theme]");if(!b)return;applyTheme(b.dataset.theme);H("select")});
$("setHaptics").addEventListener("change",e=>{H.setEnabled(e.target.checked);if(e.target.checked)H("success")});
$("setSignOut").addEventListener("click",()=>Store.signOut());
try{matchMedia("(prefers-color-scheme: dark)").addEventListener("change",syncThemeColor)}catch(e){}

/* ================= SIGN-IN ================= */
let authMode="signin",started=false;
const MODES={
  signin:{sub:"Sign in to open your diary.",go:"Sign in",pw:true,pa:"current-password",sw:"New here? Create an account",fg:true},
  signup:{sub:"Create your account. You'll confirm your email once.",go:"Create account",pw:true,pa:"new-password",sw:"Already have an account? Sign in",fg:false},
  forgot:{sub:"We'll email you a link to set a new password.",go:"Send reset link",pw:false,sw:"Back to sign in",fg:false},
  reset:{sub:"Choose a new password.",go:"Save new password",pw:true,pa:"new-password",sw:"",fg:false,noEmail:true}
};
const amsg=(t,c)=>{const m=$("authMsg");m.textContent=t||"";m.className="authmsg"+(c?" "+c:"")};
function showAuth(mode){authMode=mode;const M=MODES[mode];document.body.classList.add("signed-out");$("auth").hidden=false;
  $("authSub").textContent=M.sub;$("authGo").textContent=M.go;$("pwWrap").hidden=!M.pw;$("authPw").autocomplete=M.pa||"off";
  $("emailWrap").hidden=!!M.noEmail;$("authSwitch").hidden=!M.sw;$("authSwitch").textContent=M.sw;$("authForgot").hidden=!M.fg;amsg("")}
$("authSwitch").addEventListener("click",()=>showAuth(authMode==="signin"?"signup":"signin"));
$("authForgot").addEventListener("click",()=>showAuth("forgot"));
$("authForm").addEventListener("submit",async e=>{
  e.preventDefault();const sb=Store.sb,email=$("authEmail").value.trim(),pw=$("authPw").value,go=$("authGo");
  go.disabled=true;amsg("One moment…");
  try{
    if(authMode==="signin"){const {error}=await sb.auth.signInWithPassword({email,password:pw});if(error)throw error;amsg("")}
    else if(authMode==="signup"){const {data,error}=await sb.auth.signUp({email,password:pw,options:{emailRedirectTo:Store.APP_URL}});if(error)throw error;
      if(data.user&&Array.isArray(data.user.identities)&&!data.user.identities.length){showAuth("signin");amsg("That email already has an account. Sign in instead.","err")}
      else if(!data.session){showAuth("signin");$("authEmail").value=email;amsg("Check your inbox for a confirmation email, tap the link, then sign in here.","ok")}}
    else if(authMode==="forgot"){const {error}=await sb.auth.resetPasswordForEmail(email,{redirectTo:Store.APP_URL});if(error)throw error;amsg("If that email has an account, a reset link is on its way.","ok")}
    else{const {error}=await sb.auth.updateUser({password:pw});if(error)throw error;amsg("Password saved.","ok");const {data:s}=await sb.auth.getSession();if(s.session)signedIn(s.session)}
  }catch(err){const t=String(err&&err.message||err);H("error");
    amsg(/invalid login/i.test(t)?"That email and password don't match.":/not confirmed/i.test(t)?"Confirm your email first using the link we sent.":/rate limit|too many/i.test(t)?"Too many attempts. Wait a few minutes.":/fetch|network/i.test(t)?"Can't reach the server. Check your connection.":t,"err")}
  finally{go.disabled=false}
});
function signedIn(session){$("auth").hidden=true;document.body.classList.remove("signed-out");if(started)return;started=true;Store.start(session)}
Store.sb.auth.onAuthStateChange((ev,session)=>{setTimeout(()=>{
  if(ev==="PASSWORD_RECOVERY"){showAuth("reset");return}
  if(authMode==="reset"&&!$("auth").hidden)return;
  if(session&&(ev==="INITIAL_SESSION"||ev==="SIGNED_IN"))signedIn(session);
  else if(!session&&ev==="INITIAL_SESSION")showAuth("signin");
},0)});

/* ================= BOOT ================= */
Store.onChange(render);
Store.onStatus(s=>{const el=$("syncState");el.dataset.s=s;el.textContent=s==="saving"?"Saving…":s==="offline"?"Offline · will sync":s==="error"?"Couldn't save one change":"";});
initWheels();
document.querySelectorAll("#tsDurChips button").forEach(b=>b.textContent=fmtDur(+b.dataset.dur));
setView((location.hash||"").slice(1)||"timeline");
syncThemeColor();
/* keep the "now" line and live task honest */
setInterval(()=>{if(view==="timeline"&&!dragging&&!sheetOpen()){if(iso(today())!==lastDay){lastDay=iso(today())}renderTimeline()}},60000);
let lastDay=iso(today());
if("serviceWorker" in navigator)window.addEventListener("load",()=>navigator.serviceWorker.register("sw.js").catch(()=>{}));
window.LB={parseNL,occurs,rtSummary,fmtRange}; /* handy for testing */
})();

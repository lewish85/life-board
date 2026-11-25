/* Life Board — data + sign-in (Supabase)
   Every entry is one row in public.docs: (user_id, coll, id, data jsonb).
   Row-level security limits every read and write to the signed-in owner.
   Writes are applied locally first, then sent; if the phone is offline they
   wait in an outbox and are sent when the connection returns. */
(function(){
  const SB_URL="https://htgwcfukqchrickkotfc.supabase.co";
  const SB_KEY="sb_publishable_d_mK48O1Vpfkq8ox17sJ6Q_TJFZkat3";
  const APP_URL=location.origin+location.pathname.replace(/index\.html$/,"");
  const sb=window.supabase.createClient(SB_URL,SB_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,flowType:"implicit"}});
  const COLLS=["tasks","routines"];
  const data={tasks:new Map(),routines:new Map()};
  const listeners=new Set();
  let uid=null,email="",loaded=false,outbox=[],flushing=false,statusFn=()=>{};

  const k=s=>"lb2-"+uid+"-"+s;
  const save=()=>{try{for(const c of COLLS)localStorage.setItem(k(c),JSON.stringify([...data[c]]));localStorage.setItem(k("outbox"),JSON.stringify(outbox))}catch(e){}};
  const restore=()=>{try{for(const c of COLLS){const v=JSON.parse(localStorage.getItem(k(c))||"null");if(Array.isArray(v))data[c]=new Map(v)}
    /* carry over the first app's cache so the first open is instant */
    for(const c of COLLS){if(data[c].size)continue;const v=JSON.parse(localStorage.getItem("lb-cache-"+uid+"-"+c)||"null");if(Array.isArray(v))data[c]=new Map(v)}
    outbox=JSON.parse(localStorage.getItem(k("outbox"))||"[]")}catch(e){}};
  let emitT=null;
  const emit=()=>{clearTimeout(emitT);emitT=setTimeout(()=>{save();listeners.forEach(f=>{try{f()}catch(e){console.error(e)}})},0)};

  async function load(){
    const {data:rows,error}=await sb.from("docs").select("coll,id,data");
    if(error)throw error;
    const fresh={tasks:new Map(),routines:new Map()};
    for(const r of rows)if(fresh[r.coll])fresh[r.coll].set(r.id,r.data);
    /* keep local edits that haven't reached the server yet */
    for(const w of outbox){if(w.op==="set")fresh[w.coll].set(w.id,w.data);else fresh[w.coll].delete(w.id)}
    data.tasks=fresh.tasks;data.routines=fresh.routines;loaded=true;emit();
  }
  async function flush(){
    if(flushing||!uid)return;flushing=true;
    try{
      while(outbox.length){
        const w=outbox[0];let res;
        if(w.op==="set")res=await sb.from("docs").upsert({user_id:uid,coll:w.coll,id:w.id,data:w.data,updated_at:new Date().toISOString()});
        else res=await sb.from("docs").delete().eq("coll",w.coll).eq("id",w.id);
        if(res.error){
          if(/fetch|network|Failed/i.test(res.error.message||"")){statusFn("offline");break}
          console.error(res.error);statusFn("error");outbox.shift();continue; /* a rejected write is dropped; reload will correct the view */
        }
        outbox.shift();save();
      }
      if(!outbox.length)statusFn("synced");
    }catch(e){statusFn("offline")}
    finally{flushing=false}
  }
  function write(op,coll,id,d){
    if(op==="set")data[coll].set(id,d);else data[coll].delete(id);
    outbox=outbox.filter(w=>!(w.coll===coll&&w.id===id));outbox.push({op,coll,id,data:d});
    emit();statusFn("saving");flush();
  }
  function realtime(){
    sb.channel("docs-"+uid).on("postgres_changes",{event:"*",schema:"public",table:"docs",filter:"user_id=eq."+uid},p=>{
      const row=(p.eventType==="DELETE"?p.old:p.new)||{};if(!data[row.coll]||!row.id)return;
      if(outbox.some(w=>w.coll===row.coll&&w.id===row.id))return; /* our own pending write wins */
      if(p.eventType==="DELETE")data[row.coll].delete(row.id);else data[row.coll].set(row.id,row.data);
      emit();
    }).subscribe();
  }
  const refresh=()=>{if(!uid)return;flush().then(()=>load()).catch(()=>statusFn("offline"))};
  document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible")refresh()});
  window.addEventListener("online",refresh);

  window.Store={
    sb,APP_URL,
    get uid(){return uid},get email(){return email},get loaded(){return loaded},
    tasks:()=>data.tasks,routines:()=>data.routines,
    get:(c,id)=>data[c].get(id),
    set:(c,id,d)=>write("set",c,id,d),
    del:(c,id)=>write("del",c,id),
    onChange:f=>listeners.add(f),
    onStatus:f=>{statusFn=f},
    async start(session){
      uid=session.user.id;email=session.user.email||"";restore();emit();
      try{await sb.rpc("claim_import")}catch(e){}
      realtime();flush();
      try{await load();statusFn(outbox.length?"saving":"synced")}catch(e){statusFn("offline")}
    },
    async signOut(){
      try{Object.keys(localStorage).filter(x=>x.startsWith("lb2-")||x.startsWith("lb-cache-")).forEach(x=>localStorage.removeItem(x))}catch(e){}
      await sb.auth.signOut();location.reload();
    },
    pending:()=>outbox.length
  };
})();

/* Life Board — haptics + wheel pickers
   ------------------------------------------------------------
   Haptics
   - Android / Chrome: navigator.vibrate with very short pulses.
   - iPhone (iOS 18+): Safari has no vibrate API, but toggling a hidden
     <input type="checkbox" switch> plays the system "selection" tap.
     We click a hidden label for it. It reliably fires inside touch/click
     handlers; during free momentum (after you let go) iOS may skip ticks.
   ------------------------------------------------------------ */
(function(){
  const PATTERN={tick:4,select:8,light:10,medium:16,heavy:24,success:[10,60,18],warn:[18,50,18],error:[30,40,30,40,30]};
  const IOS_TAPS={tick:1,select:1,light:1,medium:1,heavy:2,success:2,warn:2,error:3};
  let enabled=true,lbl=null,lastAt=0;
  try{enabled=localStorage.getItem("lb-haptics")!=="off"}catch(e){}
  function iosTap(){
    if(!lbl){
      const id="lb-haptic-switch";
      const i=document.createElement("input");i.type="checkbox";i.id=id;i.setAttribute("switch","");
      i.tabIndex=-1;i.setAttribute("aria-hidden","true");
      lbl=document.createElement("label");lbl.htmlFor=id;lbl.setAttribute("aria-hidden","true");
      for(const el of [i,lbl])Object.assign(el.style,{position:"fixed",width:"1px",height:"1px",opacity:"0",pointerEvents:"none",left:"-10px",top:"0"});
      document.body.append(i,lbl);
    }
    lbl.click();
  }
  function haptic(kind){
    if(!enabled)return;
    kind=kind||"tick";
    const now=performance.now();
    if(kind==="tick"&&now-lastAt<28)return; /* don't buzz faster than the finger can feel */
    lastAt=now;
    try{
      if(typeof navigator.vibrate==="function"){navigator.vibrate(PATTERN[kind]||8);return}
      const n=IOS_TAPS[kind]||1;
      iosTap();for(let k=1;k<n;k++)setTimeout(iosTap,k*70);
    }catch(e){}
  }
  haptic.setEnabled=v=>{enabled=!!v;try{localStorage.setItem("lb-haptics",v?"on":"off")}catch(e){}};
  haptic.isEnabled=()=>enabled;
  window.haptic=haptic;

  /* ---------- Wheel picker ----------
     new Wheel(el,{values:[...], format:v=>label, index:0, axis:"y"|"x", itemSize:38, onChange(v,i), onSettle(v,i)})
     - Drag with finger or mouse; flick for momentum; settles on the nearest value.
     - Every time a new value crosses the centre line: haptic("tick").
     - Mouse wheel / trackpad and arrow keys step one value at a time.
  */
  class Wheel{
    constructor(el,o){
      this.el=el;this.o=Object.assign({axis:"y",itemSize:38,visible:5,format:v=>String(v),loop:false},o);
      this.values=o.values;this.axis=this.o.axis;this.S=this.o.itemSize;
      this.pos=(o.index||0)*this.S;this.idx=o.index||0;this.anim=null;
      el.classList.add("wheel","wheel-"+this.axis);
      el.tabIndex=0;el.setAttribute("role","spinbutton");
      if(o.label)el.setAttribute("aria-label",o.label);
      this.track=document.createElement("div");this.track.className="wheel-track";
      this.band=document.createElement("div");this.band.className="wheel-band";
      el.append(this.band,this.track);
      this.items=this.values.map((v,i)=>{const d=document.createElement("div");d.className="wheel-item";d.textContent=this.o.format(v,i);d.dataset.i=i;this.track.appendChild(d);return d});
      this._bind();requestAnimationFrame(()=>this.render());
    }
    get value(){return this.values[this.idx]}
    size(){const r=this.el.getBoundingClientRect();return this.axis==="y"?r.height:r.width}
    max(){return (this.values.length-1)*this.S}
    setIndex(i,animate){
      i=Math.max(0,Math.min(this.values.length-1,i));
      if(animate){this.animateTo(i*this.S,220,true);return}
      this.stop();this.pos=i*this.S;this._index(i,false);this.render();
    }
    setValue(v,animate){let i=this.values.indexOf(v);if(i<0){let best=0,d=Infinity;this.values.forEach((x,j)=>{const dd=Math.abs(+x-+v);if(dd<d){d=dd;best=j}});i=best}this.setIndex(i,animate)}
    _index(i,feel){
      if(i===this.idx)return;this.idx=i;
      if(feel)haptic("tick");
      this.el.setAttribute("aria-valuetext",this.o.format(this.values[i],i));
      this.o.onChange&&this.o.onChange(this.values[i],i);
    }
    render(){
      const half=this.size()/2,S=this.S,y=this.axis==="y";
      const p=this.pos;
      for(let i=0;i<this.items.length;i++){
        const it=this.items[i],d=(i*S-p)/S; /* distance from centre in items */
        if(Math.abs(d)>(y?3.4:7)){it.style.visibility="hidden";continue}
        it.style.visibility="visible";
        if(y){
          const ang=Math.max(-80,Math.min(80,d*20));
          const off=Math.sin(ang*Math.PI/180)*S*2.9;
          it.style.transform=`translateY(${half-S/2+off}px) rotateX(${-ang}deg)`;
          it.style.opacity=String(Math.max(.12,1-Math.abs(d)*.27));
        }else{
          it.style.transform=`translateX(${half-S/2+d*S}px)`;
          it.style.opacity=String(Math.max(.18,1-Math.abs(d)*.13));
        }
        it.classList.toggle("on",Math.abs(d)<.5);
      }
      const ni=Math.round(p/S);this._index(Math.max(0,Math.min(this.values.length-1,ni)),this._live);
    }
    stop(){if(this.anim){cancelAnimationFrame(this.anim);this.anim=null}}
    animateTo(target,ms,feel){
      this.stop();const from=this.pos,t0=performance.now();this._live=feel;
      const ease=t=>1-Math.pow(1-t,3);
      const step=now=>{const t=Math.min(1,(now-t0)/ms);this.pos=from+(target-from)*ease(t);this.render();
        if(t<1)this.anim=requestAnimationFrame(step);else{this.anim=null;this._live=false;this.o.onSettle&&this.o.onSettle(this.value,this.idx)}};
      this.anim=requestAnimationFrame(step);
    }
    settle(v){
      /* v: px per ms at release. Project forward with friction, then snap. */
      const proj=this.pos+v*260;
      const i=Math.max(0,Math.min(this.values.length-1,Math.round(proj/this.S)));
      const dist=Math.abs(i*this.S-this.pos);
      this.animateTo(i*this.S,Math.max(160,Math.min(700,dist*2.2)),true);
    }
    _bind(){
      const el=this.el,y=this.axis==="y";
      let start=null,last=null,samples=[],moved=false;
      const coord=e=>y?e.clientY:e.clientX;
      el.addEventListener("pointerdown",e=>{
        if(e.button!==undefined&&e.button!==0)return;
        this.stop();el.setPointerCapture&&el.setPointerCapture(e.pointerId);
        start={c:coord(e),p:this.pos};last=coord(e);samples=[{t:performance.now(),c:last}];moved=false;this._live=true;
        el.classList.add("grabbing");
      });
      el.addEventListener("pointermove",e=>{
        if(!start)return;const c=coord(e);
        if(Math.abs(c-start.c)>3)moved=true;
        let p=start.p-(c-start.c);
        const mx=this.max();if(p<0)p=p*.35;else if(p>mx)p=mx+(p-mx)*.35; /* rubber band at the ends */
        this.pos=p;this.render();last=c;
        samples.push({t:performance.now(),c});if(samples.length>6)samples.shift();
      });
      const end=e=>{
        if(!start)return;el.classList.remove("grabbing");
        if(!moved){ /* a tap: jump to the item that was tapped */
          const it=e.target.closest&&e.target.closest(".wheel-item");start=null;
          if(it){this.animateTo(+it.dataset.i*this.S,240,true);haptic("tick")}else this.settle(0);
          return;
        }
        const a=samples[0],b=samples[samples.length-1];const dt=Math.max(1,b.t-a.t);
        const v=-(b.c-a.c)/dt;start=null;
        if(this.pos<0||this.pos>this.max())this.settle(0);else this.settle(Math.max(-3,Math.min(3,v)));
      };
      el.addEventListener("pointerup",end);el.addEventListener("pointercancel",end);
      let acc=0,wt=null;
      el.addEventListener("wheel",e=>{
        e.preventDefault();acc+=y?e.deltaY:(Math.abs(e.deltaX)>Math.abs(e.deltaY)?e.deltaX:e.deltaY);
        if(Math.abs(acc)>=24){const n=Math.sign(acc);acc=0;this._live=true;this.setIndex(this.idx+n,true)}
        clearTimeout(wt);wt=setTimeout(()=>acc=0,160);
      },{passive:false});
      el.addEventListener("keydown",e=>{
        const k=e.key,f=y?{ArrowUp:-1,ArrowDown:1}:{ArrowLeft:-1,ArrowRight:1};
        if(f[k]){e.preventDefault();this._live=true;this.setIndex(this.idx+f[k],true)}
        else if(k==="Home"){e.preventDefault();this.setIndex(0,true)}
        else if(k==="End"){e.preventDefault();this.setIndex(this.values.length-1,true)}
      });
      new ResizeObserver(()=>this.render()).observe(el);
    }
  }
  window.Wheel=Wheel;
})();

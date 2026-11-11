import {sample,decode,encode,presets} from './core.mjs';
import {makePainter} from './painter.mjs';
import {propose,evaluateFrames,chooseGallery,normalizeConfig} from './discovery.mjs';
export function mountDiscovery({parent,getCurrent,getSeeds,loadConfig,onStart,isExporting}){
  parent.innerHTML=`<summary>Find a moving loop</summary>
  <p>Explore motion on known seeds, then make variations around a favorite. These sampled previews are screening tools, not final renders.</p>
  <div class="actions"><button id="loopBroad">Broad loop search</button><button id="loopNear">Near current loop</button></div>
  <div class="actions"><button id="loopStop" disabled>Stop</button><button id="loopSave">Save current loop ★</button></div>
  <label>View<select id="loopView"><option value="curated">Motion-diverse selection</option><option value="random">Unfiltered random comparison</option><option value="saved">Saved loops</option></select></label>
  <p id="loopStatus" role="status">32 configurations per search; 9 shown. Favorites keep the seed, motion, camera and easing.</p><div id="loopResults"></div>`;
  const $=id=>parent.querySelector('#'+id),key='wild-silk-loops-v1';let favorites=[],evaluated=[],busy=false,token=0,cards=[];
  try{favorites=JSON.parse(localStorage.getItem(key)||'[]').map(normalizeConfig).slice(-40);}catch{}
  function status(t){$('loopStatus').textContent=t;}
  function save(config){
    const c=normalizeConfig(config),id=JSON.stringify(c);if(!favorites.some(f=>JSON.stringify(f)===id))favorites.push(c);favorites=favorites.slice(-40);
    try{localStorage.setItem(key,JSON.stringify(favorites));status('Loop saved in this browser. Load it and use Copy scene URL for a portable copy.');}catch{status('Storage unavailable. Load the loop and copy its scene URL to keep it.');}
  }
  function cancel(){token++;busy=false;$('loopStop').disabled=true;status('Search stopped. Completed candidates remain available.');show();}
  function button(label,fn){const b=document.createElement('button');b.textContent=label;b.onclick=fn;return b;}
  function show(){
    cards=[];$('loopResults').replaceChildren();
    const mode=$('loopView').value;
    const selected=mode==='saved'?favorites.map(config=>({config})):mode==='random'?evaluated.slice(0,9):chooseGallery(evaluated);
    for(const item of selected){
      const card=document.createElement('article'),c=document.createElement('canvas');c.width=c.height=96;
      c.setAttribute('aria-label','Sampled loop preview');if(item.frames)card.append(c);
      if(item.frames){c.getContext('2d').putImageData(item.frames[0],0,0);cards.push({c,item,start:performance.now()});}
      const label=document.createElement('p');label.textContent=item.metrics?`Deformation ${item.metrics.deformation.toFixed(3)} · coverage change ${item.metrics.change.toFixed(3)}${item.metrics.reasons.length?' · '+item.metrics.reasons.join(', '):''}`:`Seed …${item.config.seed.slice(-12)} · wave ${item.config.settings.wave} · zoom ${item.config.tracks.zoom?.min ?? item.config.settings.zoom}–${item.config.tracks.zoom?.max ?? item.config.settings.zoom} · ${item.config.settings.duration}s · load to play`;card.append(label);
      card.append(button('Load loop',()=>{if(isExporting())return;cancel();loadConfig(item.config);}),button('Variations',()=>search(true,item.config)),button('Save ★',()=>save(item.config)));
      $('loopResults').append(card);
    }
  }
  async function search(near,base=getCurrent()){
    if(isExporting())return;
    token++;const own=token;busy=true;onStart();$('loopStop').disabled=false;evaluated=[];cards=[];$('loopResults').replaceChildren();$('loopView').value='curated';
    const seeds=[...new Set([base.seed,...getSeeds(),...presets.map(p=>encode(p[1]))])].slice(0,8),randomSeed=crypto.getRandomValues(new Uint32Array(1))[0];
    const proposals=propose(base,seeds,randomSeed,near),orbits=new Map(),yieldUI=()=>new Promise(r=>setTimeout(r,0));
    const canvas=document.createElement('canvas');canvas.width=canvas.height=96;const ctx=canvas.getContext('2d',{willReadFrequently:true});
    const render=(p,phase)=>{p(canvas,phase);return ctx.getImageData(0,0,96,96);};
    try{
      for(let i=0;i<proposals.length;i++){
        if(own!==token)return;
        const config=proposals[i];status(`Sampling loop ${i+1}/${proposals.length} · batch ${randomSeed} · main playback paused`);await yieldUI();if(own!==token)return;
        let orbit=orbits.get(config.seed);
        if(orbit===false)continue;
        if(!orbit){try{orbit=sample(decode(config.seed),120000);orbits.set(config.seed,orbit);}catch{orbits.set(config.seed,false);continue;}}
        const painter=makePainter(orbit,config.settings,config.tracks);
        // Fixed camera AND fixed light isolate the display wave from presentation motion.
        const fixed=makePainter(orbit,{...config.settings,zoom:.8,rotation:0,motion:0},{});
        const frames=[],intrinsic=[];
        for(let frame=0;frame<24;frame++){
          if(own!==token)return;frames.push(render(painter,frame/24));intrinsic.push(render(fixed,frame/24));await yieldUI();
        }
        if(own!==token)return;
        const metrics=evaluateFrames(frames,intrinsic,render(painter,1));evaluated.push({config,metrics,frames});
      }
      if(own!==token)return;
      busy=false;$('loopStop').disabled=true;show();
      status(`${evaluated.length} evaluated · ${evaluated.filter(x=>x.metrics.accepted).length} pass screening · batch ${randomSeed}. Compare the same batch with Unfiltered random. Low-resolution checks are not judgments of beauty; inspect full resolution before export.`);
    }catch(e){if(own===token){busy=false;$('loopStop').disabled=true;show();status('Loop search failed: '+e.message);}}
  }
  $('loopBroad').onclick=()=>search(false);$('loopNear').onclick=()=>search(true);$('loopStop').onclick=cancel;$('loopSave').onclick=()=>save(getCurrent());$('loopView').onchange=show;
  let timer;const startTimer=()=>timer=setInterval(()=>{if(document.hidden||busy||!parent.open||isExporting())return;for(const {c,item,start}of cards){const phase=((performance.now()-start)/1000/item.config.settings.duration)%1;c.getContext('2d').putImageData(item.frames[Math.floor(phase*item.frames.length)],0,0);}},100);
  startTimer();
  addEventListener('pagehide',()=>{token++;busy=false;$('loopStop').disabled=true;clearInterval(timer);});
  addEventListener('pageshow',()=>{clearInterval(timer);startTimer();});
  return {stop:()=>{if(busy)cancel();}};
}

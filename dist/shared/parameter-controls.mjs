// Small DOM adapter for opt-in scalar parameter tracks. Math/state stay in
// parameter-tracks.mjs; scenes choose their own safe parameter definitions.
const easingLabels={linear:'Linear',sine:'Sine · soft',smoothstep:'Smoothstep',smootherstep:'Smootherstep'};
export function createParameterControl({parent,key,label,definition,value,track,onValue,onTrack}) {
 const document=parent.ownerDocument,root=document.createElement('div');root.className='parameter-control';
 const heading=document.createElement('label');heading.htmlFor=key;heading.textContent=label;
 const output=document.createElement('output');output.id=key+'Value';output.htmlFor=key;heading.append(output);
 const slider=document.createElement('input');Object.assign(slider,{id:key,type:'range',min:definition.min,max:definition.max,step:definition.step,value});slider.setAttribute('aria-label',label);
 root.append(heading,slider);
 let lastDraft='',draft={enabled:true,min:definition.min,max:definition.max,easing:'sine'},toggle,fields,lower,upper,lowerOutput,upperOutput,easing;
 if(definition.animatable!==false){
  const mode=document.createElement('label');mode.className='parameter-mode';toggle=document.createElement('input');Object.assign(toggle,{id:key+'Cyclic',type:'checkbox'});toggle.setAttribute('aria-label',label+' cyclic');
  mode.append(toggle,document.createTextNode('Cyclic'));
  fields=document.createElement('div');fields.id=key+'Track';fields.className='parameter-track';toggle.setAttribute('aria-controls',fields.id);
  const bound=(name,title)=>{
   const l=document.createElement('label');l.className='parameter-bound';l.textContent=title;
   const out=document.createElement('output');out.id=key+name+'Value';out.htmlFor=key+name;l.append(out);
   const input=document.createElement('input');Object.assign(input,{id:key+name,type:'range',min:definition.min,max:definition.max,step:definition.step});input.setAttribute('aria-label',label+' '+title.toLowerCase());
   l.append(input);fields.append(l);return [input,out];
  };
  [lower,lowerOutput]=bound('Min','Lower');[upper,upperOutput]=bound('Max','Upper');
  const easingLabel=document.createElement('label');easingLabel.className='parameter-easing';easingLabel.textContent='Easing';easing=document.createElement('select');easing.id=key+'Easing';easing.setAttribute('aria-label',label+' easing');
  for(const [name,title] of Object.entries(easingLabels)){const option=document.createElement('option');option.value=name;option.textContent=title;easing.append(option);}
  easingLabel.append(easing);fields.append(easingLabel);
  const note=document.createElement('p');note.className='note parameter-note';note.textContent='Lower → upper → lower in one loop.';fields.append(note);root.append(mode,fields);
  toggle.onchange=()=>onTrack(toggle.checked?{...draft}:null);
  // Full-domain native sliders remain directly draggable and keyboard/touch
  // accessible, even for equal bounds. Clamp the moving edge; never swap handles.
  const edit=change=>{lastDraft='';onTrack({...draft,...change});};
  lower.oninput=()=>{if(Number.isFinite(lower.valueAsNumber))edit({min:Math.min(lower.valueAsNumber,draft.max)});};
  upper.oninput=()=>{if(Number.isFinite(upper.valueAsNumber))edit({max:Math.max(upper.valueAsNumber,draft.min)});};
  easing.onchange=()=>edit({easing:easing.value});
 }else if(definition.note){const note=document.createElement('p');note.className='note parameter-note';note.textContent=definition.note;root.append(note);}
 slider.oninput=()=>onValue(Number(slider.value));parent.append(root);
 const decimals=definition.step===1?0:Math.max(2,String(definition.step).split('.')[1]?.length||0);
 function sync({value,track,resolved=value,disabled=false}){
  const active=!!track?.enabled;slider.value=value;slider.disabled=disabled||active;output.value=Number(resolved).toFixed(decimals);root.classList.toggle('is-cyclic',active);
  slider.title=active?`Static value ${value} is retained. Turn off Cyclic to edit.`:'';
  if(toggle){if(active)draft={...track};toggle.checked=active;toggle.disabled=disabled;fields.hidden=!active;const token=JSON.stringify(draft);if(token!==lastDraft){lower.value=draft.min;upper.value=draft.max;easing.value=draft.easing;lowerOutput.value=draft.min.toFixed(decimals);upperOutput.value=draft.max.toFixed(decimals);lower.setAttribute('aria-valuemax',draft.max);upper.setAttribute('aria-valuemin',draft.min);const span=definition.max-definition.min;fields.style.setProperty('--range-low',`${span?(draft.min-definition.min)/span*100:0}%`);fields.style.setProperty('--range-high',`${span?(draft.max-definition.min)/span*100:0}%`);lastDraft=token;}for(const field of [lower,upper,easing])field.disabled=disabled;output.setAttribute('aria-label',`${label} ${active?'current':'static'} value`);}
 }
 sync({value,track});
 return {sync,reset(){draft={enabled:true,min:definition.min,max:definition.max,easing:'sine'};},element:root};
}

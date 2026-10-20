(function () {
  'use strict';
  const objects = {
    test_tube: {name:'Test tube', width:544, height:2873, note:'Grasp, handover and right-hand reorientation.', regions:[
      {id:'shaft', label:'Shaft', x:.49,y:.55,side:'left'},
      {id:'transfer', label:'Handover',x:.58,y:.31,side:'right'},
      {id:'right_grip',label:'Right grip',x:.43,y:.77,side:'right'}]},
    bottle: {name:'Bottle',width:1083,height:3890,note:'Bottle-body stabilization and cap manipulation.',regions:[
      {id:'body',label:'Body',x:.5,y:.60,side:'left'}, {id:'cap',label:'Cap',x:.56,y:.075,side:'right'}]},
    blocks: {name:'Blocks',width:2585,height:2201,note:'Red and green contacts during separation.',regions:[
      {id:'red',label:'Red',x:.67,y:.27,side:'right'}, {id:'green',label:'Green',x:.21,y:.70,side:'left'},
      {id:'join',label:'Separation',x:.53,y:.54,side:'right'}]},
    cube: {name:"Rubik's Cube",width:1922,height:1994,note:'Grasp configurations across cube turns.',regions:[
      {id:'grip_a',label:'Grip A',x:.23,y:.60,side:'left'}, {id:'grip_b',label:'Grip B',x:.80,y:.55,side:'right'},
      {id:'turn',label:'Turn',x:.50,y:.17,side:'right'}]},
  };
  const actions = {grasp:['Grasp','fa-hand'],hold:['Hold','fa-hand'],transfer:['Handover','fa-right-left'],rotate:['Rotate','fa-rotate'],pull:['Separate','fa-arrows-left-right'],release:['Release','fa-hand']};

  function chooseClip(clips, task, region, action, hand) {
    const candidates = clips.filter(c => c.task === task && c.region === region);
    return candidates.find(c => c.action === action && c.hand === hand) || candidates.find(c => c.action === action) || candidates[0];
  }
  function frameAt(time, clip) { return Math.max(0,Math.min(clip.frames-1,Math.floor(time*clip.fps+1e-4))); }
  function arrowVector(reference, delta, gain, width, height) {
    return {x:reference[0]*width,y:reference[1]*height,dx:delta[0]*gain*width,dy:delta[1]*gain*height};
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = {objects,actions,chooseClip,frameAt,arrowVector};
  if (typeof document === 'undefined') return;
  const root = document.getElementById('contact-explorer');
  if (!root) return;
  const byId = id => document.getElementById('pc-'+id);
  const status = byId('media-status');
  const data = window.PHYS_CONTACT_DATA;
  if (!data || !data.clips.length) { status.textContent='Recordings could not be loaded. Please reload the page.'; status.dataset.error='true'; return; }
  const video=byId('source-video'), wrist=byId('wrist'), pads=[byId('pad-0'),byId('pad-1')];
  const contexts=[wrist.getContext('2d'),...pads.map(c=>c.getContext('2d'))];
  const trace=byId('response'), traceCtx=trace.getContext('2d');
  const play=byId('play'), timeline=byId('timeline'), image=byId('object-image'), arm=byId('ghost-arm');
  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
  const state={clip:data.clips.find(c=>c.id==='blocks-join-pull-right') || data.clips[0],mode:'overlay',loaded:false,detailsLoaded:false,wantsPlay:false,visible:false,raf:0,version:0,poster:null};
  const maxResponse=Math.max(...data.clips.flatMap(c=>c.response).filter(Number.isFinite))*1.08;

  function setStatus(message,error=false) { status.textContent=message;status.dataset.error=String(error); }
  function setPlayButton() {
    const playing=!video.paused;
    play.innerHTML='<i class="fa-solid '+(playing?'fa-pause':'fa-play')+'" aria-hidden="true"></i>';
    play.title=playing?'Pause recording':'Play recording'; play.setAttribute('aria-label',play.title);
  }
  function stopFrames() { if(state.raf) cancelAnimationFrame(state.raf);state.raf=0; }
  function tryPlay() {
    if (!state.wantsPlay || !state.loaded || !state.visible || document.hidden) return;
    const version=state.version;
    video.play().then(()=>{ if(version!==state.version)return;setStatus('');setPlayButton();animate(); }).catch(error=>{
      if(version!==state.version || error.name==='AbortError')return;
      state.wantsPlay=false;setStatus('Playback paused. Use the play button.');setPlayButton();
    });
  }
  function drawArrow(ctx, v) {
    ctx.beginPath();ctx.arc(v.x,v.y,1.15,0,Math.PI*2);ctx.fillStyle='#708579';ctx.fill();
    const length=Math.hypot(v.dx,v.dy); if(length<.6)return;
    const x=v.x+v.dx,y=v.y+v.dy,angle=Math.atan2(v.dy,v.dx),head=Math.min(4,length*.4);
    ctx.strokeStyle='#41cc87';ctx.lineWidth=1.2;ctx.beginPath();ctx.moveTo(v.x,v.y);ctx.lineTo(x,y);
    ctx.moveTo(x-head*Math.cos(angle-.48),y-head*Math.sin(angle-.48));ctx.lineTo(x,y);ctx.lineTo(x-head*Math.cos(angle+.48),y-head*Math.sin(angle+.48));ctx.stroke();
  }
  function drawTrace(frame) {
    const series=state.clip.response,w=trace.width,h=trace.height,base=h-12;
    traceCtx.clearRect(0,0,w,h);traceCtx.strokeStyle='#e2e9e4';traceCtx.lineWidth=1;
    traceCtx.beginPath();traceCtx.moveTo(0,base);traceCtx.lineTo(w,base);traceCtx.stroke();
    traceCtx.strokeStyle='#6b9982';traceCtx.lineWidth=2;traceCtx.beginPath();
    let connected=false;
    series.forEach((value,i)=>{if(!Number.isFinite(value)){connected=false;return;} const x=4+i/(series.length-1)*(w-8),y=base-value/maxResponse*(h-20);if(connected)traceCtx.lineTo(x,y);else traceCtx.moveTo(x,y);connected=true;});
    traceCtx.stroke();const x=4+frame/(series.length-1)*(w-8);
    traceCtx.strokeStyle='#95a79a';traceCtx.lineWidth=1;traceCtx.beginPath();traceCtx.moveTo(x,5);traceCtx.lineTo(x,base);traceCtx.stroke();
    byId('response-value').textContent=Number.isFinite(series[frame])?series[frame].toFixed(4):'N/A';
  }
  function drawPose(frame) {
    const phase=frame/(state.clip.frames-1),swing=Math.sin(phase*Math.PI),sign=state.clip.hand==='left'?1:-1;
    let angle=0,dx=0,dy=0;
    switch(state.clip.action){case 'rotate':angle=(phase-.5)*28;break;case 'pull':dx=-phase*22;break;case 'release':dx=-phase*18;dy=-phase*8;break;case 'transfer':dx=swing*18;angle=swing*6;break;case 'grasp':dx=swing*12;dy=swing*4;break;default:break;}
    arm.style.transform=reduced.matches?'none':`translate(${sign*dx}px,${dy}px) rotate(${sign*angle}deg) scaleX(${sign})`;
  }
  function draw() {
    const clip=state.clip;
    const source=state.loaded && video.readyState>=2 ? video : state.poster;
    const frame=state.loaded?frameAt(video.currentTime,clip):0;
    if(source){
      contexts[0].drawImage(source,0,0,400,400,0,0,400,400);
      pads.forEach((pad,s)=>{
        const ctx=contexts[s+1];ctx.clearRect(0,0,224,392);
        if(state.mode!=='flow')ctx.drawImage(source,432+s*232,4,224,392,0,0,224,392);
        else {ctx.fillStyle='#f1f5f2';ctx.fillRect(0,0,224,392);}
        if(state.mode!=='diff' && state.detailsLoaded){
          clip.flow[frame][s].forEach((delta,i)=>{if(delta)drawArrow(ctx,arrowVector(clip.reference[s][i],delta,data.display_gain,224,392));});
        }
      });
    }
    timeline.value=String(frame);timeline.setAttribute('aria-valuetext',`${(frame/clip.fps).toFixed(1)} seconds`);
    byId('time').textContent=`${(frame/clip.fps).toFixed(1)} / ${clip.duration.toFixed(1)} s`;
    drawTrace(frame);drawPose(frame);
  }
  function animate() {stopFrames();draw();if(!video.paused && state.visible && !document.hidden)state.raf=requestAnimationFrame(animate);}
  function button(text, pressed, onClick) {
    const b=document.createElement('button');b.type='button';b.setAttribute('aria-pressed',String(pressed));b.textContent=text;b.addEventListener('click',onClick);return b;
  }
  function renderSelection() {
    const clip=state.clip,obj=objects[clip.task];
    root.querySelectorAll('[data-object]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.object===clip.task)));
    image.src=`assets/contact/objects/${clip.task}.webp`;image.alt=`Representative ${obj.name.toLowerCase()}, isolated from its background`;
    image.width=obj.width;image.height=obj.height;
    const wrap=byId('object-wrap');wrap.style.setProperty('--pc-object-ratio',String(obj.width/obj.height));
    const spots=byId('hotspots');spots.replaceChildren();
    obj.regions.forEach(r=>{
      const b=button('',r.id===clip.region,()=>select(chooseClip(data.clips,clip.task,r.id,state.clip.action,state.clip.hand),true));
      b.className='pc-hotspot';b.style.left=`${r.x*100}%`;b.style.top=`${r.y*100}%`;b.dataset.labelSide=r.side;
      b.setAttribute('aria-label',r.label+' recordings');b.title=r.label;
      const label=document.createElement('span');label.textContent=r.label;b.append(label);spots.append(b);
    });
    byId('region-title').textContent=obj.regions.find(r=>r.id===clip.region).label;
    const group=byId('actions');group.replaceChildren();
    [...new Set(data.clips.filter(c=>c.task===clip.task && c.region===clip.region).map(c=>c.action))].forEach(action=>{
      const b=button('',action===clip.action,()=>select(chooseClip(data.clips,clip.task,clip.region,action,state.clip.hand),true));
      const icon=document.createElement('i');icon.className='fa-solid '+actions[action][1];icon.setAttribute('aria-hidden','true');
      const label=document.createElement('span');label.textContent=actions[action][0];b.append(icon,label);b.title=actions[action][0];group.append(b);
    });
    byId('task-note').textContent=obj.note;byId('hand-label').textContent=clip.hand==='left'?'Left hand':'Right hand';
    byId('clip-label').textContent=clip.label;
    arm.style.left=clip.hand==='left'?'0':'32%';
    timeline.max=String(clip.frames-1);
  }
  function ensureLoaded() {if(state.detailsLoaded && !video.getAttribute('src')){video.src=state.clip.video;video.load();}}
  async function select(clip,autoplay) {
    if(!clip)return;
    stopFrames();video.pause();state.version++;state.clip=clip;state.loaded=false;state.detailsLoaded=false;state.poster=null;state.wantsPlay=autoplay;
    video.removeAttribute('src');video.load();renderSelection();setPlayButton();
    contexts.forEach((ctx,i)=>{ctx.fillStyle='#f1f4f2';ctx.fillRect(0,0,i?224:400,i?392:400);});
    const version=state.version,poster=new Image();
    poster.onload=()=>{if(version!==state.version)return;state.poster=poster;draw();};
    poster.onerror=()=>{if(version===state.version)setStatus('Preview unavailable. The recording may still play.',true);};
    poster.src=clip.poster;setStatus('Loading recording…');draw();
    try {
      await window.PhysCanvasAssets.loadScript(clip.dataScript);
      if(version!==state.version)return;
      const details=window.PHYS_CONTACT_CLIPS[clip.id];
      if(!details)throw new Error('Contact details unavailable');
      state.clip={...clip,...details};state.detailsLoaded=true;draw();
      if(state.visible)ensureLoaded();
    } catch(error) {
      if(version===state.version)setStatus('Recording unavailable. Select another example to retry.',true);
      console.error(error);
    }
  }
  root.querySelectorAll('[data-object]').forEach(b=>b.addEventListener('click',()=>{
    const task=b.dataset.object;select(chooseClip(data.clips,task,objects[task].regions[0].id,'grasp','left'),true);
  }));
  root.querySelectorAll('[data-mode]').forEach(b=>b.addEventListener('click',()=>{
    state.mode=b.dataset.mode;root.querySelectorAll('[data-mode]').forEach(n=>n.setAttribute('aria-pressed',String(n===b)));
    byId('flow-note').textContent=state.mode==='diff'?'Tactile Image':'Sensor-plane marker arrows · display scale ×5';draw();
  }));
  play.addEventListener('click',()=>{
    if(video.paused){state.wantsPlay=true;ensureLoaded();tryPlay();}else{state.wantsPlay=false;video.pause();}
  });
  byId('replay').addEventListener('click',()=>{state.wantsPlay=true;if(state.loaded)video.currentTime=0;ensureLoaded();tryPlay();draw();});
  timeline.addEventListener('input',()=>{if(state.loaded){video.currentTime=Number(timeline.value)/state.clip.fps;draw();}});
  byId('speed').addEventListener('change',e=>{video.playbackRate=Number(e.target.value);});
  video.addEventListener('loadeddata',()=>{
    if(!video.getAttribute('src'))return;
    state.loaded=true;video.playbackRate=Number(byId('speed').value);draw();setStatus('Recorded GT · ready');tryPlay();
  });
  video.addEventListener('seeked',draw);video.addEventListener('timeupdate',draw);
  video.addEventListener('pause',()=>{stopFrames();setPlayButton();if(state.loaded)setStatus('Recorded GT · paused');});
  video.addEventListener('playing',()=>{setStatus('');setPlayButton();animate();});
  video.addEventListener('waiting',()=>{if(state.wantsPlay)setStatus('Buffering recording…');});
  video.addEventListener('error',()=>{if(!video.getAttribute('src'))return;state.loaded=false;state.wantsPlay=false;stopFrames();setPlayButton();setStatus('Recording unavailable. Select another example or reload.',true);});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)video.pause();else tryPlay();});
  if(reduced.addEventListener)reduced.addEventListener('change',()=>{if(reduced.matches){state.wantsPlay=false;video.pause();draw();}});
  select(state.clip,!reduced.matches);
  if('IntersectionObserver' in window){
    const observer=new IntersectionObserver(entries=>{state.visible=entries[0].isIntersecting;if(state.visible){ensureLoaded();tryPlay();}else video.pause();},{threshold:0});observer.observe(root);
  }else{state.visible=true;ensureLoaded();}
})();

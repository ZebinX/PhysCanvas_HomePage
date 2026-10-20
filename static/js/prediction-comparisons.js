(function(){
  'use strict';
  const taskNames={bottle:'Bottle',blocks:'Blocks',test_tube:'Test tube',cube:"Rubik's Cube"};
  const viewNames={overhead:'Overhead camera',left_wrist:'Left wrist camera',right_wrist:'Right wrist camera',left_touch:'Left tactile',right_touch:'Right tactile'};
  function revealAt(x,left,width){return Math.max(0,Math.min(1,(x-left)/Math.max(1,width)));}
  function frameAt(time,frames,fps){return Math.max(0,Math.min(frames-1,Math.floor(time*fps+1e-4)));}
  function tactileOverlayRects(width,height){
    const faceWidth=width/2,padding=faceWidth*20/168;
    return [0,1].map(face=>({sx:face*faceWidth,sy:height,sw:faceWidth,sh:height,
      dx:face*faceWidth+padding,dy:0,dw:faceWidth-2*padding,dh:height}));
  }
  if(typeof module!=='undefined'&&module.exports)module.exports={revealAt,frameAt,tactileOverlayRects,taskNames,viewNames};
  if(typeof document==='undefined')return;
  const root=document.getElementById('prediction-comparisons');if(!root)return;
  const grid=document.getElementById('pc-comparison-grid'),status=document.getElementById('pc-compare-status');
  const data=window.PHYS_COMPARISONS;
  if(!data||!data.length){status.textContent='Comparison data unavailable. Please reload the page.';return;}
  const motion=window.matchMedia('(prefers-reduced-motion: reduce)');
  const state={task:'bottle',view:'overhead',speed:1,paused:motion.matches,players:[],times:{}};
  function element(tag,className,text){const e=document.createElement(tag);if(className)e.className=className;if(text)e.textContent=text;return e;}
  function iconButton(icon,label){const b=element('button');b.type='button';b.title=label;b.setAttribute('aria-label',label);b.innerHTML=`<i class="fa-solid ${icon}" aria-hidden="true"></i>`;return b;}
  class Comparison{
    constructor(row,view,index){
      this.row=row;this.view=view;this.media=row.views[view];this.visible=false;this.ready=false;this.dead=false;this.position=.5;this.wantsPlay=!state.paused;this.callback=0;
      this.node=element('article','pc-comparison-example');
      const header=element('div','pc-comparison-example-header');header.append(element('strong','',`Example ${String(index+1).padStart(2,'0')}`));this.node.append(header);
      this.overlay=view.endsWith('touch');this.displayHeight=this.overlay?this.media.height/2:this.media.height;
      this.surface=element('div','pc-comparison-surface');this.surface.style.aspectRatio=`${this.media.width}/${this.displayHeight}`;
      this.surface.tabIndex=0;this.surface.setAttribute('role','slider');this.surface.setAttribute('aria-label',`${taskNames[row.task]}, example ${index+1}, ${viewNames[view]}: GT reveal`);this.surface.setAttribute('aria-valuemin','0');this.surface.setAttribute('aria-valuemax','100');
      this.pred=element('canvas','pc-comparison-pred');this.gt=element('canvas','pc-comparison-gt');
      for(const canvas of [this.pred,this.gt]){canvas.width=this.media.width;canvas.height=this.displayHeight;canvas.setAttribute('aria-hidden','true');this.surface.append(canvas);}
      this.contexts=[this.gt.getContext('2d'),this.pred.getContext('2d')];
      this.divider=element('div','pc-comparison-divider');this.divider.innerHTML='<i class="fa-solid fa-arrows-left-right" aria-hidden="true"></i>';
      this.gtLabel=element('span','pc-comparison-side-label is-gt','GT');this.predLabel=element('span','pc-comparison-side-label is-pred','Pred');
      this.surface.append(this.divider,this.gtLabel,this.predLabel);
      this.node.append(this.surface);
      const controls=element('div','pc-comparison-controls');
      this.play=iconButton('fa-play','Play example');this.replay=iconButton('fa-rotate-left','Replay example');
      this.seek=element('input');this.seek.type='range';this.seek.min=0;this.seek.max=row.frames-1;this.seek.step=1;this.seek.value=0;this.seek.disabled=true;this.seek.setAttribute('aria-label',`Example ${index+1} frame`);
      this.time=element('output','','Preview');
      controls.append(this.play,this.replay,this.seek,this.time);this.node.append(controls);
      this.message=element('p','pc-comparison-clip-status');this.message.setAttribute('role','status');this.node.append(this.message);
      this.video=element('video','pc-comparison-source');this.video.muted=true;this.video.loop=true;this.video.playsInline=true;this.video.preload='none';this.video.setAttribute('aria-hidden','true');this.node.append(this.video);
      this.poster=new Image();this.poster.onload=()=>{if(!this.dead&&!this.ready)this.paint(this.poster);};
      this.reveal(.5);this.events();
    }
    reveal(value){this.position=Math.max(0,Math.min(1,value));const pct=this.position*100;this.gt.style.clipPath=`inset(0 ${100-pct}% 0 0)`;this.divider.style.left=`${pct}%`;this.surface.setAttribute('aria-valuenow',String(Math.round(pct)));this.surface.setAttribute('aria-valuetext',`${Math.round(pct)} percent ground truth`);this.gtLabel.style.visibility=pct<12?'hidden':'visible';this.predLabel.style.visibility=pct>88?'hidden':'visible';}
    paint(source){
      const {width:w}=this.media,h=this.displayHeight;
      this.contexts.forEach((ctx,index)=>{
        ctx.globalCompositeOperation='source-over';
        ctx.drawImage(source,index*w,0,w,h,0,0,w,h);
        if(this.overlay){
          // Diff is letterboxed: map each 168px flow face into its 128px image region.
          ctx.globalCompositeOperation='multiply';
          tactileOverlayRects(w,h).forEach(r=>{
            ctx.drawImage(source,index*w+r.sx,r.sy,r.sw,r.sh,r.dx,r.dy,r.dw,r.dh);
          });
          ctx.globalCompositeOperation='source-over';
        }
      });
    }
    draw(){if(this.dead||!this.ready||this.video.readyState<2)return;this.paint(this.video);const frame=frameAt(this.video.currentTime,this.row.frames,this.row.fps);this.seek.value=frame;this.time.textContent=`${(frame/this.row.fps).toFixed(1)} / ${(this.row.frames/this.row.fps).toFixed(1)} s`;}
    stop(){if(this.callback){if(this.video.cancelVideoFrameCallback)this.video.cancelVideoFrameCallback(this.callback);else cancelAnimationFrame(this.callback);}this.callback=0;}
    tick(){this.stop();this.draw();if(this.dead||this.video.paused||!this.visible||document.hidden)return;this.callback=this.video.requestVideoFrameCallback?this.video.requestVideoFrameCallback(()=>this.tick()):requestAnimationFrame(()=>this.tick());}
    button(){const playing=!this.video.paused;this.play.innerHTML=`<i class="fa-solid ${playing?'fa-pause':'fa-play'}" aria-hidden="true"></i>`;this.play.title=playing?'Pause example':'Play example';this.play.setAttribute('aria-label',this.play.title);}
    load(){if(!this.poster.getAttribute('src'))this.poster.src=this.media.poster;if(!this.video.getAttribute('src')){this.message.textContent='Loading…';this.video.src=this.media.video;this.video.load();}}
    resume(){if(this.dead||!this.visible||!this.ready||!this.wantsPlay||document.hidden)return;this.video.playbackRate=state.speed;this.video.play().catch(error=>{if(this.dead||error.name==='AbortError')return;this.wantsPlay=false;this.button();this.message.textContent='Paused. Press play to resume.';});}
    events(){
      this.surface.addEventListener('pointerdown',e=>{if(e.button!==undefined&&e.button!==0)return;this.surface.setPointerCapture(e.pointerId);if(e.pointerType==='mouse')e.preventDefault();const r=this.surface.getBoundingClientRect();this.reveal(revealAt(e.clientX,r.left,r.width));});
      this.surface.addEventListener('pointermove',e=>{if(e.pointerType==='mouse'||this.surface.hasPointerCapture(e.pointerId)){const r=this.surface.getBoundingClientRect();this.reveal(revealAt(e.clientX,r.left,r.width));}});
      this.surface.addEventListener('pointerup',e=>{if(this.surface.hasPointerCapture(e.pointerId))this.surface.releasePointerCapture(e.pointerId);});
      this.surface.addEventListener('pointercancel',e=>{if(this.surface.hasPointerCapture(e.pointerId))this.surface.releasePointerCapture(e.pointerId);});
      this.surface.addEventListener('keydown',e=>{let value=this.position;if(e.key==='ArrowLeft')value-=.05;else if(e.key==='ArrowRight')value+=.05;else if(e.key==='Home')value=0;else if(e.key==='End')value=1;else return;e.preventDefault();this.reveal(value);});
      this.play.addEventListener('click',()=>{this.wantsPlay=this.video.paused;if(this.wantsPlay){this.load();this.resume();}else this.video.pause();});
      this.replay.addEventListener('click',()=>{this.wantsPlay=true;if(this.ready)this.video.currentTime=0;this.load();this.resume();});
      this.seek.addEventListener('input',()=>{if(this.ready)this.video.currentTime=Number(this.seek.value)/this.row.fps;});
      this.video.addEventListener('loadedmetadata',()=>{const saved=state.times[this.row.id]||0;if(saved>0)this.video.currentTime=Math.min(saved,(this.row.frames-1)/this.row.fps);});
      this.video.addEventListener('loadeddata',()=>{if(this.dead)return;this.ready=true;this.seek.disabled=false;this.message.textContent='';this.draw();this.resume();});
      this.video.addEventListener('playing',()=>{this.message.textContent='';this.button();this.tick();});
      this.video.addEventListener('pause',()=>{this.stop();this.button();});
      this.video.addEventListener('seeked',()=>this.draw());
      this.video.addEventListener('timeupdate',()=>this.draw());
      this.video.addEventListener('error',()=>{if(this.dead)return;this.ready=false;this.seek.disabled=true;this.wantsPlay=false;this.stop();this.message.textContent='Video unavailable. Try another view.';});
    }
    destroy(){if(this.ready)state.times[this.row.id]=this.video.currentTime;this.dead=true;this.stop();this.video.pause();this.video.removeAttribute('src');this.video.load();}
  }
  const observer='IntersectionObserver'in window?new IntersectionObserver(entries=>{entries.forEach(entry=>{const player=state.players.find(p=>p.node===entry.target);if(!player)return;player.visible=entry.isIntersecting;if(player.visible){player.load();player.resume();}else player.video.pause();});},{threshold:.05}):null;
  function globalButton(){const b=document.getElementById('pc-compare-toggle');b.title=state.paused?'Play all comparisons':'Pause all comparisons';b.setAttribute('aria-label',b.title);b.innerHTML=`<i class="fa-solid ${state.paused?'fa-play':'fa-pause'}" aria-hidden="true"></i>`;}
  function render(){
    state.players.forEach(p=>{if(observer)observer.unobserve(p.node);p.destroy();});state.players=[];grid.replaceChildren();
    root.querySelectorAll('[data-compare-task]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.compareTask===state.task)));
    root.querySelectorAll('[data-compare-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.compareView===state.view)));
    data.filter(r=>r.task===state.task).forEach((row,index)=>{const p=new Comparison(row,state.view,index);state.players.push(p);grid.append(p.node);if(observer)observer.observe(p.node);else{p.visible=true;p.load();}});
    status.textContent='';globalButton();
  }
  root.querySelectorAll('[data-compare-task]').forEach(b=>b.addEventListener('click',()=>{state.task=b.dataset.compareTask;render();}));
  root.querySelectorAll('[data-compare-view]').forEach(b=>b.addEventListener('click',()=>{state.view=b.dataset.compareView;render();}));
  document.getElementById('pc-compare-toggle').addEventListener('click',()=>{state.paused=!state.paused;state.players.forEach(p=>{p.wantsPlay=!state.paused;if(state.paused)p.video.pause();else p.resume();});globalButton();});
  document.getElementById('pc-compare-speed').addEventListener('change',e=>{state.speed=Number(e.target.value);state.players.forEach(p=>p.video.playbackRate=state.speed);});
  document.addEventListener('visibilitychange',()=>state.players.forEach(p=>document.hidden?p.video.pause():p.resume()));
  if(motion.addEventListener)motion.addEventListener('change',()=>{if(motion.matches){state.paused=true;state.players.forEach(p=>{p.wantsPlay=false;p.video.pause();});globalButton();}});
  render();
})();

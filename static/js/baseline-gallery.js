(() => {
  'use strict';
  const root=document.getElementById('baseline-comparisons');
  if(!root)return;
  const videos=Array.from(root.querySelectorAll('video'));
  const visible=new Set();
  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
  const start=v=>{
    if(!v.getAttribute('src')){v.src=v.dataset.src;v.load();}
    v.muted=true;
    if(!document.hidden&&!reduced.matches){const p=v.play();if(p&&p.catch)p.catch(()=>{});}
  };
  if('IntersectionObserver' in window){
    const observer=new IntersectionObserver(entries=>entries.forEach(e=>{
      if(e.isIntersecting){visible.add(e.target);start(e.target);}
      else{visible.delete(e.target);e.target.pause();}
    }),{threshold:0.15});
    videos.forEach(v=>observer.observe(v));
  }else videos.forEach(v=>{visible.add(v);start(v);});
  document.addEventListener('visibilitychange',()=>{
    if(document.hidden)videos.forEach(v=>v.pause());else visible.forEach(start);
  });
})();

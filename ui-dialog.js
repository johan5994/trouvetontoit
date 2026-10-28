/* Trouve Ton Toit — fenêtres de dialogue intégrées au site (remplacent alert / confirm / prompt du navigateur) */
(function(){
  if(window.uiConfirm)return;
  const css=`.uid-ov{position:fixed;inset:0;z-index:2147483000;background:rgba(10,14,25,.45);display:flex;align-items:center;justify-content:center;padding:16px;animation:uidf .15s ease}
.uid-box{width:100%;max-width:440px;background:var(--s,var(--card,#fff));color:var(--txt,var(--tm,#1C1A17));border:1px solid var(--b2,rgba(0,0,0,.12));border-radius:16px;box-shadow:0 20px 60px rgba(0,0,0,.25);padding:1.3rem 1.35rem 1.1rem;font-family:inherit;animation:uidp .16s ease}
.uid-msg{font-size:.94rem;line-height:1.55;white-space:pre-line;margin:0 0 1rem;overflow-wrap:anywhere}
.uid-in{width:100%;box-sizing:border-box;padding:.6rem .75rem;border:1px solid var(--b2,#D1D5DB);border-radius:10px;font:inherit;font-size:.92rem;background:var(--s2,#fff);color:inherit;margin:0 0 1rem}
.uid-acts{display:flex;justify-content:flex-end;gap:.5rem;flex-wrap:wrap}
.uid-btn{border:none;border-radius:10px;padding:.6rem 1.1rem;font:inherit;font-weight:700;font-size:.88rem;cursor:pointer;background:var(--bleu,#1B4FD8);color:#fff}
.uid-btn.sec{background:transparent;color:inherit;border:1px solid var(--b2,#D1D5DB)}
.uid-btn:focus-visible,.uid-in:focus-visible{outline:2px solid var(--bleu,#1B4FD8);outline-offset:2px}
@keyframes uidf{from{opacity:0}to{opacity:1}}@keyframes uidp{from{transform:translateY(6px) scale(.98);opacity:0}to{transform:none;opacity:1}}
@media (prefers-reduced-motion:reduce){.uid-ov,.uid-box{animation:none}}`;
  const st=document.createElement('style');st.textContent=css;(document.head||document.documentElement).appendChild(st);
  function ouvrir({msg,input,def,ok,cancel}){
    return new Promise(res=>{
      const prev=document.activeElement;
      const ov=document.createElement('div');ov.className='uid-ov';ov.setAttribute('role','dialog');ov.setAttribute('aria-modal','true');
      const box=document.createElement('div');box.className='uid-box';
      const p=document.createElement('p');p.className='uid-msg';p.textContent=String(msg??'');box.appendChild(p);
      let inp=null;
      if(input){inp=document.createElement('input');inp.className='uid-in';inp.type='text';inp.value=def??'';box.appendChild(inp);}
      const acts=document.createElement('div');acts.className='uid-acts';
      let bc=null;
      if(cancel!==false){bc=document.createElement('button');bc.type='button';bc.className='uid-btn sec';bc.textContent=cancel||'Annuler';acts.appendChild(bc);}
      const bo=document.createElement('button');bo.type='button';bo.className='uid-btn';bo.textContent=ok||'OK';acts.appendChild(bo);
      box.appendChild(acts);ov.appendChild(box);document.body.appendChild(ov);
      const fin=v=>{document.removeEventListener('keydown',kd,true);ov.remove();try{prev&&prev.focus&&prev.focus();}catch(e){}res(v);};
      const valider=()=>fin(input?inp.value:true);
      const annuler=()=>fin(input?null:(cancel===false?true:false));
      bo.onclick=valider;if(bc)bc.onclick=annuler;
      ov.addEventListener('click',e=>{if(e.target===ov)annuler();});
      const kd=e=>{if(e.key==='Escape'){e.preventDefault();annuler();}else if(e.key==='Enter'&&(input||document.activeElement!==bc)){e.preventDefault();valider();}};
      document.addEventListener('keydown',kd,true);
      setTimeout(()=>(inp||bo).focus(),20);
    });
  }
  window.uiAlert=(msg,opt)=>ouvrir({msg,ok:(opt&&opt.ok)||'OK',cancel:false});
  window.uiConfirm=(msg,opt)=>ouvrir({msg,ok:(opt&&opt.ok)||'Confirmer',cancel:(opt&&opt.cancel)||'Annuler'});
  window.uiPrompt=(msg,def,opt)=>ouvrir({msg,input:true,def,ok:(opt&&opt.ok)||'Valider',cancel:'Annuler'});
  // Plus jamais la fenêtre du navigateur pour les messages
  window.alert=m=>{window.uiAlert(m);};
})();

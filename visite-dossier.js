// Demande de visite (fiche annonce + espace locataire) :
// date, nombre de personnes, autres occupants, et proposition de joindre le(s) dossier(s).
(function(){
  const BOOST='jusqu’à 80 % de chances en plus d’être choisis';
  const esc=s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');
  const nbFaits=d=>[0,1,2,3,4,5].filter(i=>d?.[i]?.type&&(d[i].type!=='garant_personne'||(d[i].garants||[]).length)).length;
  const emailOk=e=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

  function css(){
    if(document.getElementById('vd-css'))return;
    const st=document.createElement('style');st.id='vd-css';
    st.textContent=`
:root{--vd-bg:#fff;--vd-bg2:#F3F5FA;--vd-line:rgba(14,21,38,.1);--vd-line2:rgba(14,21,38,.18);--vd-txt:#141A2B;--vd-mut:#5B6478;--vd-bleu:#1B4FD8;--vd-bleu-rgb:27,79,216;--vd-ok:#2F8A5B;--vd-ok-rgb:47,138,91;--vd-err:#C2412D;--vd-err-rgb:194,65,45}
html.dark{--vd-bg:#181C28;--vd-bg2:#202535;--vd-line:rgba(255,255,255,.08);--vd-line2:rgba(255,255,255,.15);--vd-txt:#ECEAE6;--vd-mut:rgba(236,234,230,.66);--vd-bleu:#4A78F5;--vd-bleu-rgb:74,120,245;--vd-ok:#4CC08A;--vd-ok-rgb:76,192,138;--vd-err:#EE6B5B;--vd-err-rgb:238,107,91}
.vd-ov{position:fixed;inset:0;background:rgba(10,16,32,.62);backdrop-filter:blur(3px);z-index:9999;display:flex;align-items:center;justify-content:center;padding:1rem}
.vd-card{background:var(--vd-bg);color:var(--vd-txt);border:1px solid var(--vd-line);border-radius:20px;width:100%;max-width:470px;max-height:92vh;display:flex;flex-direction:column;box-shadow:0 24px 60px rgba(0,0,0,.25);overflow:hidden;font-family:inherit}
.vd-hd{padding:1.15rem 1.3rem .85rem;border-bottom:1px solid var(--vd-line);display:flex;justify-content:space-between;gap:.75rem;align-items:flex-start}
.vd-k{font-size:.72rem;font-weight:700;color:var(--vd-bleu);overflow-wrap:anywhere}
.vd-t{font-size:1.08rem;font-weight:800;margin-top:.1rem}
.vd-x{background:none;border:1px solid var(--vd-line);border-radius:10px;width:34px;height:34px;color:var(--vd-mut);cursor:pointer;font-size:1.1rem;line-height:1;flex-shrink:0}
.vd-body{padding:1.1rem 1.3rem;overflow-y:auto;display:flex;flex-direction:column;gap:1.05rem}
.vd-sec>.vd-l{display:block;font-size:.82rem;font-weight:800;margin-bottom:.45rem}
.vd-row{display:grid;grid-template-columns:1.4fr 1fr;gap:.6rem}
.vd-in{width:100%;box-sizing:border-box;padding:.7rem .85rem;background:var(--vd-bg2);border:1.5px solid var(--vd-line);border-radius:11px;color:var(--vd-txt);font-size:.92rem;font-family:inherit}
.vd-in:focus{outline:none;border-color:var(--vd-bleu)}
.vd-seg{display:flex;gap:.4rem}
.vd-seg button{flex:1;padding:.6rem 0;border:1.5px solid var(--vd-line);background:var(--vd-bg);color:var(--vd-txt);border-radius:11px;font-size:.92rem;font-weight:800;cursor:pointer;font-family:inherit}
.vd-seg button.on{border-color:var(--vd-bleu);background:var(--vd-bleu);color:#fff}
.vd-help{font-size:.75rem;color:var(--vd-mut);line-height:1.5;margin-top:.4rem}
.vd-pers{display:flex;flex-direction:column;gap:.45rem;margin-top:.6rem}
.vd-p{display:flex;gap:.6rem;align-items:center;border:1px solid var(--vd-line);border-radius:11px;padding:.55rem .7rem}
.vd-p .vd-in{padding:.55rem .7rem;font-size:.85rem}
.vd-av{width:30px;height:30px;border-radius:50%;background:rgba(var(--vd-bleu-rgb),.12);color:var(--vd-bleu);display:flex;align-items:center;justify-content:center;font-size:.75rem;font-weight:800;flex-shrink:0}
.vd-p strong{display:block;font-size:.85rem}.vd-p small{display:block;font-size:.73rem;color:var(--vd-mut)}
.vd-astuce{font-size:.76rem;line-height:1.5;background:rgba(var(--vd-bleu-rgb),.06);border-radius:10px;padding:.55rem .7rem;margin-top:.55rem}
.vd-astuce a{color:var(--vd-bleu);font-weight:700;cursor:pointer}
.vd-dos{display:flex;gap:.7rem;align-items:flex-start;border:1.5px solid rgba(var(--vd-bleu-rgb),.35);background:rgba(var(--vd-bleu-rgb),.06);border-radius:14px;padding:.85rem .9rem;cursor:pointer}
.vd-dos:has(input:checked){border-color:var(--vd-bleu);background:rgba(var(--vd-bleu-rgb),.1)}
.vd-dos input{width:18px;height:18px;accent-color:var(--vd-bleu);flex-shrink:0;margin-top:.15rem}
.vd-dos-t{font-size:.9rem;font-weight:800}
.vd-dos-s{font-size:.78rem;color:var(--vd-mut);line-height:1.5;margin-top:.2rem}
.vd-dos-s b{color:var(--vd-bleu)}
.vd-dos-l{list-style:none;padding:0;margin:.45rem 0 0;display:flex;flex-direction:column;gap:.2rem;font-size:.76rem}
.vd-dos-l li{display:flex;justify-content:space-between;gap:.5rem}
.vd-ok{color:var(--vd-ok);font-weight:700}.vd-mid{color:var(--vd-mut);font-weight:700}
.vd-inc{border:1.5px dashed rgba(var(--vd-bleu-rgb),.4);background:rgba(var(--vd-bleu-rgb),.04);border-radius:14px;padding:.85rem .9rem}
.vd-bar{height:6px;border-radius:99px;background:var(--vd-line);overflow:hidden;margin:.5rem 0 .65rem}.vd-bar span{display:block;height:100%;background:var(--vd-bleu);border-radius:99px}
.vd-btn{display:inline-flex;align-items:center;justify-content:center;gap:.35rem;border-radius:10px;padding:.5rem .85rem;font-size:.8rem;font-weight:700;cursor:pointer;font-family:inherit;border:1.5px solid transparent;text-decoration:none}
.vd-bp{background:var(--vd-bleu);color:#fff}.vd-bg{background:var(--vd-bg);border-color:var(--vd-line2);color:var(--vd-txt)}
.vd-err{margin:0 1.3rem;background:rgba(var(--vd-err-rgb),.08);border:1px solid rgba(var(--vd-err-rgb),.35);color:var(--vd-err);font-size:.8rem;border-radius:10px;padding:.55rem .75rem}
.vd-ft{display:flex;gap:.6rem;padding:.9rem 1.3rem;border-top:1px solid var(--vd-line)}
.vd-ft .vd-btn{padding:.75rem 1rem;font-size:.88rem}
.vd-ft .vd-bp{flex:1}
@media (max-width:520px){.vd-ov{padding:0;align-items:flex-end}.vd-card{border-radius:20px 20px 0 0;max-height:96vh}.vd-row{grid-template-columns:1fr 1fr}}
`;
    document.head.appendChild(st);
  }

  // o = {sb,U,P,dossier,listingId,landlordId,title,zone,toast,goDossier(kind),onSent()}
  window.vdDemanderVisite=function(o){
    css();
    const D=o.dossier||{};
    const conj=D.situation==='couple'&&D.conjoint?.prenom?D.conjoint:null;
    const moiN=nbFaits(D),moiDF=!!(D.df?.files?.length),moiOk=moiN>=6||moiDF;
    const cjN=conj?nbFaits(conj.dossier):0;
    let nb=conj?2:1;
    const autres=[]; // e-mails saisis (hors conjoint)
    const ov=document.createElement('div');ov.className='vd-ov';ov.id='visite-request-modal-overlay';
    const minD=new Date().toISOString().slice(0,10);
    ov.innerHTML=`<div class="vd-card" role="dialog" aria-modal="true" aria-labelledby="vd-titre">
      <div class="vd-hd"><div><div class="vd-k">${esc(o.title||'Ce logement')}</div><div class="vd-t" id="vd-titre">Demander une visite</div></div><button type="button" class="vd-x" aria-label="Fermer">×</button></div>
      <div class="vd-body">
        <div class="vd-sec"><span class="vd-l">Quand souhaitez-vous visiter ?</span>
          <div class="vd-row"><input class="vd-in" type="date" id="vr-date" min="${minD}" aria-label="Date souhaitée"><input class="vd-in" type="time" id="vr-time" value="14:00" aria-label="Heure souhaitée"></div></div>
        <div class="vd-sec"><span class="vd-l">Combien serez-vous à habiter le logement ?</span>
          <div class="vd-seg" id="vd-nb">${[1,2,3,4,5].map(n=>`<button type="button" data-n="${n}">${n===5?'5+':n}</button>`).join('')}</div>
          <div id="vd-pers"></div></div>
        <div class="vd-sec" id="vd-dos"></div>
      </div>
      <div id="vd-err" class="vd-err" role="alert" style="display:none"></div>
      <div class="vd-ft"><button type="button" class="vd-btn vd-bg" id="vd-annuler">Annuler</button><button type="button" class="vd-btn vd-bp" id="vr-send-btn">Envoyer la demande →</button></div>
    </div>`;
    document.body.appendChild(ov);
    const $=s=>ov.querySelector(s);
    const fermer=()=>ov.remove();
    $('.vd-x').onclick=fermer;$('#vd-annuler').onclick=fermer;
    ov.addEventListener('click',e=>{if(e.target===ov)fermer();});
    const err=m=>{const e=$('#vd-err');e.textContent=m||'';e.style.display=m?'block':'none';};
    const lireAutres=()=>{ov.querySelectorAll('[data-autre]').forEach(i=>{autres[+i.dataset.autre]=i.value.trim();});};

    const renderPers=()=>{
      const el=$('#vd-pers');
      ov.querySelectorAll('#vd-nb button').forEach(b=>b.classList.toggle('on',+b.dataset.n===nb));
      if(nb<2){el.innerHTML='';return;}
      const rows=[];
      if(conj)rows.push(`<div class="vd-p"><span class="vd-av">${esc((conj.prenom[0]||'?').toUpperCase())}</span><div style="flex:1;min-width:0"><strong>${esc(conj.prenom)} ${esc(conj.nom)}</strong><small>Votre conjoint · son dossier est dans le vôtre</small></div></div>`);
      const nAutres=nb-1-(conj?1:0);
      for(let k=0;k<nAutres;k++)rows.push(`<div class="vd-p"><span class="vd-av">${(conj?2:1)+k+1}</span><input class="vd-in" type="email" data-autre="${k}" value="${esc(autres[k]||'')}" placeholder="E-mail de la personne ${(conj?2:1)+k+1} (facultatif)" autocomplete="off"></div>`);
      el.innerHTML=`<div class="vd-pers">${rows.join('')}</div>
        ${nAutres>0?`<div class="vd-help">S’ils ont un compte Trouve Ton Toit, leur dossier est joint avec le vôtre. Garants et bail se règlent au moment de la candidature.</div>`:''}
        ${!conj&&nb===2?`<div class="vd-astuce">Vous emménagez en couple ? <a data-go="couple">Créez un dossier en couple</a> dans votre profil : les pièces de votre conjoint partent avec les vôtres, comme sur DossierFacile.</div>`:''}`;
      el.querySelectorAll('[data-autre]').forEach(i=>i.addEventListener('input',lireAutres));
      el.querySelector('[data-go]')?.addEventListener('click',()=>{fermer();o.goDossier&&o.goDossier('couple');});
    };
    const renderDos=()=>{
      const el=$('#vd-dos');const coche=!!$('#vr-dossier')?.checked;
      if(moiOk){
        const titre=conj?`Joindre notre dossier (vous + ${esc(conj.prenom)})`:nb>1?'Joindre mon dossier et celui des autres':'Joindre mon dossier à la demande';
        const liste=conj||nb>1?`<ul class="vd-dos-l"><li><span>Votre dossier</span><span class="vd-ok">${moiDF?'DossierFacile':'Complet'}</span></li>${conj?`<li><span>Dossier de ${esc(conj.prenom)}</span><span class="${cjN>=6?'vd-ok':'vd-mid'}">${cjN>=6?'Complet':cjN+'/6'}</span></li>`:''}${nb-1-(conj?1:0)>0?`<li><span>Autres personnes</span><span class="vd-mid">si elles ont un compte</span></li>`:''}</ul>`:'';
        el.innerHTML=`<label class="vd-dos" for="vr-dossier"><input type="checkbox" id="vr-dossier" ${coche?'checked':''}><span style="flex:1;min-width:0"><span class="vd-dos-t">${titre}</span>
          <span class="vd-dos-s" style="display:block">Les locataires qui envoient leur dossier dès la visite ont <b>${BOOST}</b>. Le propriétaire voit tout de suite les pièces et les garants.</span>${liste}</span></label>`;
      }else{
        el.innerHTML=`<div class="vd-inc"><div class="vd-dos-t">Envoyez votre dossier avec la demande</div>
          <div class="vd-dos-s">Les locataires qui envoient leur dossier dès la visite ont <b>${BOOST}</b>. Le vôtre est rempli à ${moiN}/6.</div>
          <div class="vd-bar"><span style="width:${Math.round(moiN/6*100)}%"></span></div>
          <div style="display:flex;gap:.45rem;flex-wrap:wrap"><button type="button" class="vd-btn vd-bp" data-go="completer">Compléter mon dossier →</button><button type="button" class="vd-btn vd-bg" data-go="df">J’ai un DossierFacile</button></div></div>`;
        el.querySelectorAll('[data-go]').forEach(b=>b.addEventListener('click',()=>{fermer();o.goDossier&&o.goDossier(b.dataset.go);}));
      }
    };
    ov.querySelectorAll('#vd-nb button').forEach(b=>b.addEventListener('click',()=>{lireAutres();nb=+b.dataset.n;renderPers();renderDos();}));
    renderPers();renderDos();

    $('#vr-send-btn').onclick=async()=>{
      err('');lireAutres();
      const visitDate=$('#vr-date').value,visitTime=$('#vr-time').value||'14:00';
      if(!visitDate)return err('Choisissez la date de visite souhaitée.');
      const today=new Date();today.setHours(0,0,0,0);
      if(new Date(visitDate+'T12:00:00')<today)return err('Choisissez une date à venir.');
      const nAutres=Math.max(0,nb-1-(conj?1:0));
      const ems=autres.slice(0,nAutres).filter(Boolean);
      const bad=ems.find(e=>!emailOk(e));if(bad)return err('Adresse e-mail invalide : '+bad);
      const avecDossier=!!$('#vr-dossier')?.checked;
      const btn=$('#vr-send-btn');btn.disabled=true;btn.textContent='Envoi…';
      const co=[];
      if(conj&&nb>=2)co.push({nom:[conj.prenom,conj.nom].filter(Boolean).join(' '),email:conj.email||null,conjoint:true});
      for(const em of ems){
        let pr=null;try{const{data}=await o.sb.from('profiles').select('clerk_id,full_name').ilike('email',em).limit(1);pr=(data||[])[0]||null;}catch(e){}
        co.push({email:em,id:pr?.clerk_id||null,nom:pr?.full_name||null});
      }
      const row={listing_id:o.listingId,tenant_id:o.U.id,landlord_id:o.landlordId,tenant_name:o.P?.full_name||'',tenant_email:o.P?.email||o.U.email||'',
        visit_date:visitDate,visit_time:visitTime,zone:o.zone||'',status:'pending',dossier_joint:avecDossier,nb_personnes:nb,co_visiteurs:co};
      let{error}=await o.sb.from('visits').insert(row);
      // Colonnes pas encore créées en base (migration) : on réessaie sans elles
      if(error&&/dossier_joint|nb_personnes|co_visiteurs/i.test(error.message||'')){['dossier_joint','nb_personnes','co_visiteurs'].forEach(k=>delete row[k]);({error}=await o.sb.from('visits').insert(row));}
      if(error){btn.disabled=false;btn.textContent='Envoyer la demande →';return err(error.message);}
      try{
        const ds=new Date(visitDate+'T12:00:00').toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long'});
        const qui=nb>1?`\nPour ${nb===5?'5 personnes ou plus':nb+' personnes'}`+(co.length?' : '+[o.P?.full_name,...co.map(c=>c.nom||c.email)].filter(Boolean).join(', '):''):'';
        await o.sb.from('messages').insert({listing_id:o.listingId,sender_id:'system',receiver_id:o.landlordId,
          content:(o.P?.full_name||'Un locataire')+' demande une visite\n\n'+(o.title||'Logement')+'\nLe '+ds+' à '+visitTime+qui+(avecDossier?'\n\nLe dossier locataire est joint à la demande : consultez-le dans vos visites.':'')+'\n\nConfirmez la visite depuis votre page Visites.',
          type:'visit_request'});
      }catch(e){}
      fermer();
      o.toast&&o.toast('<i data-lucide=check-circle-2 class=ic></i> Demande de visite envoyée'+(avecDossier?(conj||co.length?' avec vos dossiers':' avec votre dossier'):'')+' !');
      o.onSent&&o.onSent();
    };
  };
})();

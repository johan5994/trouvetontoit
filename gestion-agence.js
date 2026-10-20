// ════════════════════════════════════════════════════════════════════
// Trouve Ton Toit — Gestion locative pour le compte des propriétaires
// (portail agence). Chargé par agency-dashboard.html (utilise sb, U,
// agencyData, toast définis par la page).
//
// Mandats · encaissements & quittances · rapprochement bancaire ·
// recouvrement (relances, garant, mise en demeure, GLI, commandement) ·
// reversements & comptes rendus de gestion (CRG) · interventions ·
// conformité (assurance, chaudière, diagnostics) · fins de bail & dépôts ·
// révision IRL · récapitulatif fiscal des propriétaires.
// ════════════════════════════════════════════════════════════════════

const GA={tab:'pilotage',mois:null,annee:null,loaded:false,
  mandats:[],ops:[],inter:[],ech:[],crg:[],leases:[],pays:[],listings:[],tickets:[],profiles:{}};

// IRL (Insee) — trimestre de référence → valeur
const GA_IRL={'2023-1':138.61,'2023-2':140.59,'2023-3':141.03,'2023-4':142.06,'2024-1':143.46,'2024-2':145.17,'2024-3':144.51,'2024-4':144.64,'2025-1':145.47,'2025-2':146.68,'2025-3':145.77,'2025-4':145.78,'2026-1':146.60,'2026-2':148.37,'2026-3':148.06};
const GA_FISC={micro_foncier:{plafond:15000,abatt:0.30,case:'4BE (2042)'},micro_bic:{plafond:77700,abatt:0.50,case:'5ND (2042-C-PRO)'}};

// Documents et échéances suivis pour chaque bien géré
const GA_DOCS={
  assurance_habitation:{l:'Assurance habitation (locataire)',court:'Assurance loc.',mois:12,qui:'locataire',oblig:true},
  entretien_chaudiere:{l:'Entretien de la chaudière',court:'Chaudière',mois:12,qui:'locataire',si:'chaudiere'},
  pno:{l:'Assurance propriétaire non occupant (PNO)',court:'PNO',mois:12,qui:'proprietaire',oblig:true},
  dpe:{l:'Diagnostic de performance énergétique (DPE)',court:'DPE',mois:120,qui:'proprietaire',oblig:true},
  diag_elec:{l:'Diagnostic électricité (installation > 15 ans)',court:'Électricité',mois:72,qui:'proprietaire'},
  diag_gaz:{l:'Diagnostic gaz (installation > 15 ans)',court:'Gaz',mois:72,qui:'proprietaire'},
  crep:{l:'Constat de risque d’exposition au plomb (avant 1949)',court:'Plomb',mois:72,qui:'proprietaire',si:'av1949'},
  amiante:{l:'Repérage amiante (permis avant 1997)',court:'Amiante',mois:0,qui:'proprietaire',si:'av1997'},
  erp:{l:'État des risques et pollutions (ERP, < 6 mois au bail)',court:'ERP',mois:6,qui:'proprietaire'},
  detecteur_fumee:{l:'Détecteur de fumée',court:'Détecteur',mois:0,qui:'proprietaire'},
};

const gaE=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const gaQ=s=>String(s??'').replace(/\\/g,'\\\\').replace(/'/g,"\\'").replace(/\n/g,' ');
const gaR=n=>Math.round((Number(n)||0)*100)/100;
const gaEur=n=>(gaR(n)).toLocaleString('fr-FR',{minimumFractionDigits:2,maximumFractionDigits:2})+' €';
const gaIso=d=>{const x=new Date(d);return isNaN(x)?'':new Date(x.getTime()-x.getTimezoneOffset()*6e4).toISOString().slice(0,10);};
const gaToday=()=>gaIso(new Date());
const gaYm=d=>gaIso(d).slice(0,7);
const gaFr=d=>d?new Date(String(d).length===10?d+'T12:00:00':d).toLocaleDateString('fr-FR',{day:'numeric',month:'long',year:'numeric'}):'—';
const gaFrC=d=>d?new Date(String(d).length===10?d+'T12:00:00':d).toLocaleDateString('fr-FR'):'—';
const gaDays=(a,b)=>Math.floor((new Date(gaIso(b)+'T12:00:00')-new Date(gaIso(a)+'T12:00:00'))/864e5);
const gaAddM=(d,n)=>{const x=new Date(gaIso(d)+'T12:00:00');const day=x.getDate();x.setDate(1);x.setMonth(x.getMonth()+n);x.setDate(Math.min(day,new Date(x.getFullYear(),x.getMonth()+1,0).getDate()));return gaIso(x);};
const gaMoisLbl=ym=>{const[y,m]=ym.split('-');return new Date(+y,+m-1,15).toLocaleDateString('fr-FR',{month:'long',year:'numeric'});};
const gaDue=(ym,jour)=>{const[y,m]=ym.split('-').map(Number);const dim=new Date(y,m,0).getDate();return`${ym}-${String(Math.min(Math.max(+jour||1,1),dim)).padStart(2,'0')}`;};

// ── Données ─────────────────────────────────────────────────────────
async function gaLoad(){
  const q=t=>sb.from(t).select('*').eq('agency_id',U.id);
  const[m,o,i,e,c,l,p,ls,tk]=await Promise.all([q('gestion_mandats'),q('gestion_operations'),q('gestion_interventions'),q('gestion_echeances'),q('gestion_crg'),
    sb.from('leases').select('*').eq('landlord_id',U.id),
    sb.from('payments').select('*').eq('landlord_id',U.id),
    sb.from('listings').select('*').eq('agent_id',U.id),
    sb.from('tickets').select('*').eq('landlord_id',U.id)]);
  if(m.error)throw new Error(m.error.message);
  GA.mandats=(m.data||[]).sort((a,b)=>(a.numero||0)-(b.numero||0));
  GA.ops=o.data||[];GA.inter=i.data||[];GA.ech=e.data||[];GA.crg=c.data||[];
  GA.leases=l.data||[];GA.pays=p.data||[];GA.listings=ls.data||[];GA.tickets=tk.data||[];
  const ids=[...new Set(GA.leases.map(x=>x.tenant_id).filter(Boolean))];
  GA.profiles={};
  if(ids.length){const{data}=await sb.from('profiles').select('clerk_id,full_name,email,phone,dossier_data').in('clerk_id',ids);(data||[]).forEach(x=>GA.profiles[x.clerk_id]=x);}
  GA.loaded=true;
  await gaAttachPayments();
  await gaEnsureSchedule();
}
const gaMandat=id=>GA.mandats.find(m=>m.id===id);
const gaListing=id=>GA.listings.find(l=>l.id===id);
const gaLease=id=>GA.leases.find(l=>l.id===id);
const gaOwnerKey=m=>String(m.owner_email||m.owner_name||'sans-proprietaire').trim().toLowerCase();
const gaBien=m=>m.bien_label||gaListing(m.listing_id)?.title||m.bien_adresse||'Bien';
const gaAdresse=m=>m.bien_adresse||gaListing(m.listing_id)?.full_address||gaBien(m);
const gaActifs=()=>GA.mandats.filter(m=>m.statut!=='resilie');

// Location en cours d'un mandat : bail Trouve Ton Toit ou locataire déjà en place
function gaTen(m){
  if(!m)return null;
  const fin=m.fin_bail||{};
  if(fin.sortie_effective&&gaDays(fin.sortie_effective,gaToday())>0&&!fin.relocation)return null;
  const L=m.lease_id?gaLease(m.lease_id):null;
  if(L){
    const p=GA.profiles[L.tenant_id]||{};
    let gar=null;try{let dd=p.dossier_data;dd=typeof dd==='string'?JSON.parse(dd):dd;gar=dd?.[5]||null;}catch(e){}
    const g0=gar?.garants?.[0]?.garant_name||{};
    const li=gaListing(L.listing_id)||gaListing(m.listing_id);
    return{src:'ttt',lease:L,nom:p.full_name||L.tenant_name||'Locataire',email:p.email||'',tel:p.phone||'',tenant_id:L.tenant_id,
      hc:+L.rent||0,ch:+L.charges||0,depot:+L.deposit||0,debut:L.start_date,fin:L.end_date,jour:+(L.payment_due_day||1)||1,
      meuble:L.type_bail?L.type_bail!=='vide':(m.bien_meuble??li?.['meublé']??li?.furnished??true),
      garantie:gar?.type||'',garant_nom:[g0.prenom,g0.nom].filter(Boolean).join(' '),garant_email:g0.email||'',visale:gar?.type==='garant_visale',
      zone_tendue:L.zone_tendue===true};
  }
  if(m.loc_nom)return{src:'ext',lease:null,nom:m.loc_nom,email:m.loc_email||'',tel:m.loc_phone||'',tenant_id:null,
    hc:+m.loc_loyer_hc||0,ch:+m.loc_charges||0,depot:+m.loc_depot||0,debut:m.loc_debut,fin:null,jour:+m.loc_jour||1,
    meuble:m.bien_meuble!==false,garantie:m.loc_garantie||'',garant_nom:m.loc_garant_nom||'',garant_email:m.loc_garant_email||'',visale:/visale/i.test(m.loc_garantie||''),zone_tendue:false};
  return null;
}
const GA_RENT=['rent','first_rent','loyer'];
function gaPays(m){
  const t=gaTen(m);const L=t?.lease;
  return GA.pays.filter(p=>GA_RENT.includes(p.type)&&(p.mandat_id===m.id||(L&&!p.mandat_id&&(p.lease_id===L.id||(L.booking_id&&p.booking_id===L.booking_id&&!p.lease_id)))));
}
const gaPaid=p=>p.status==='paid'?Number(p.amount_paid??p.amount)||0:Number(p.amount_paid)||0;
const gaReste=p=>p.status==='paid'?0:Math.max(0,(Number(p.amount)||0)-(Number(p.amount_paid)||0));
const gaUnpaid=p=>p.status!=='paid'&&p.status!=='cancelled'&&gaReste(p)>0.009;

// Rattacher au mandat les loyers des baux Trouve Ton Toit (pour l'automatisation)
async function gaAttachPayments(){
  for(const m of GA.mandats){
    const L=m.lease_id?gaLease(m.lease_id):null;if(!L)continue;
    const ids=GA.pays.filter(p=>!p.mandat_id&&(p.lease_id===L.id||(L.booking_id&&p.booking_id===L.booking_id))).map(p=>p.id);
    if(!ids.length)continue;
    const{error}=await sb.from('payments').update({mandat_id:m.id}).in('id',ids);
    if(!error)GA.pays.forEach(p=>{if(ids.includes(p.id))p.mandat_id=m.id;});
  }
}
// Échéancier automatique : loyers du mois en cours + 2 mois
async function gaEnsureSchedule(){
  const rows=[];const cur=gaYm(new Date());
  for(const m of gaActifs()){
    const t=gaTen(m);if(!t||!(t.hc+t.ch))continue;
    const exist=new Set(gaPays(m).map(p=>String(p.due_date||'').slice(0,7)));
    const debutYm=t.debut?String(t.debut).slice(0,7):cur;
    // Pas de loyer appelé avant la prise en gestion (mandat) ni avant le début du bail
    const cutoff=[t.debut,m.date_signature||String(m.created_at||'').slice(0,10)].filter(Boolean).sort().pop()||'';
    for(let k=0;k<3;k++){
      const ym=gaAddM(cur+'-15',k).slice(0,7);
      if(ym<debutYm||exist.has(ym))continue;
      if(m.fin_bail?.date_fin&&ym>String(m.fin_bail.date_fin).slice(0,7))continue;
      if(gaDue(ym,t.jour)<cutoff)continue;
      rows.push({landlord_id:U.id,tenant_id:t.tenant_id,listing_id:m.listing_id||t.lease?.listing_id||null,lease_id:t.lease?.id||null,booking_id:t.lease?.booking_id||null,
        mandat_id:m.id,tenant_name:t.nom,tenant_email:t.email,amount:gaR(t.hc+t.ch),type:'rent',status:'pending',due_date:gaDue(ym,t.jour)});
    }
  }
  if(!rows.length)return;
  const{data,error}=await sb.from('payments').insert(rows).select();
  if(error){console.warn('Échéancier :',error.message);return;}
  GA.pays.push(...(data||[]));
}

// ── Comptabilité propriétaire ───────────────────────────────────────
function gaHonor(m,p,montant){
  const t=gaTen(m);const tot=(t?.hc||0)+(t?.ch||0);
  const base=m.base_honoraires==='hc'&&tot?montant*(t.hc/tot):montant;
  return{hon:gaR(base*(Number(m.taux_honoraires)||0)/100),gli:m.gli?gaR(montant*(Number(m.gli_taux)||0)/100):0};
}
// Mouvements du compte d'un propriétaire entre deux dates [from, to[
function gaCompte(ownerKey,from,to){
  const ms=GA.mandats.filter(m=>gaOwnerKey(m)===ownerKey);
  const inP=d=>d&&(!from||gaIso(d)>=from)&&(!to||gaIso(d)<to);
  const lignes=[];let enc=0,hon=0,gli=0,frais=0,ops=0,rev=0;
  for(const m of ms){
    for(const p of gaPays(m)){
      const v=gaPaid(p);if(!v||!inP(p.paid_at))continue;
      const h=gaHonor(m,p,v);
      enc+=v;hon+=h.hon;gli+=h.gli;
      lignes.push({date:gaIso(p.paid_at),bien:gaBien(m),lib:`Loyer ${gaMoisLbl(String(p.due_date).slice(0,7))} — ${p.tenant_name||gaTen(m)?.nom||''}`,cr:v,db:0});
      if(h.hon)lignes.push({date:gaIso(p.paid_at),bien:gaBien(m),lib:`Honoraires de gestion (${m.taux_honoraires} % TTC)`,cr:0,db:h.hon});
      if(h.gli)lignes.push({date:gaIso(p.paid_at),bien:gaBien(m),lib:`Assurance loyers impayés (${m.gli_taux} %)`,cr:0,db:h.gli});
    }
    if(Number(m.frais_fixes)>0&&from&&to){
      for(let ym=from.slice(0,7);ym<to.slice(0,7);ym=gaAddM(ym+'-15',1).slice(0,7)){
        const st=String(m.date_signature||m.created_at||'').slice(0,7);if(st&&ym<st)continue;
        frais+=Number(m.frais_fixes);lignes.push({date:ym+'-01',bien:gaBien(m),lib:'Frais de gestion forfaitaires',cr:0,db:Number(m.frais_fixes)});
      }
    }
    for(const o of GA.ops.filter(o=>o.mandat_id===m.id&&inP(o.date)&&!String(o.type||'').startsWith('depot_'))){
      const v=Number(o.montant)||0;
      if(o.type==='reversement')rev+=-v;else ops+=v;
      lignes.push({date:gaIso(o.date),bien:gaBien(m),lib:o.libelle||o.type,cr:v>0?v:0,db:v<0?-v:0,type:o.type});
    }
  }
  lignes.sort((a,b)=>a.date.localeCompare(b.date));
  const net=gaR(enc-hon-gli-frais+ops);
  return{ms,lignes,enc:gaR(enc),hon:gaR(hon),gli:gaR(gli),frais:gaR(frais),ops:gaR(ops),rev:gaR(rev),net,mouvement:gaR(net-rev)};
}
function gaOwners(){
  const map={};
  for(const m of GA.mandats){const k=gaOwnerKey(m);(map[k]=map[k]||{key:k,name:m.owner_name||m.owner_email||'Propriétaire',email:m.owner_email,iban:m.owner_iban,address:m.owner_address,clerk:m.owner_clerk_id,ms:[]}).ms.push(m);}
  return Object.values(map);
}
// Solde du compte propriétaire à une date (tout l'historique)
const gaNextMonth=()=>gaAddM(gaYm(new Date())+'-01',1);
const gaSolde=(k,to)=>gaCompte(k,'2015-01-01',to||gaNextMonth()).mouvement;

// ── Envois ──────────────────────────────────────────────────────────
async function gaMail(to,subject,title,html,cta){
  if(!to)return false;
  try{
    const r=await fetch('/.netlify/functions/send-email',{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({template:'gestion_generic',to,data:{subject,title,html,agence:agencyData?.agency_name||'Votre agence',cta_url:cta?.url,cta_label:cta?.label}})});
    return r.ok;
  }catch(e){return false;}
}
async function gaMsg(to,listingId,content){
  if(!to)return;
  try{await sb.from('messages').insert({listing_id:listingId||null,sender_id:U.id,receiver_id:to,content,type:'message'});}catch(e){}
}
const gaAgence=()=>({nom:agencyData?.agency_name||'Agence',adresse:agencyData?.address||'',tel:agencyData?.phone||'',carte:agencyData?.license_number||'',cci:agencyData?.cci_delivrance||'',garantie:agencyData?.garantie_financiere||'',web:agencyData?.website||''});

// ── PDF (jsPDF) ─────────────────────────────────────────────────────
function gaPdf(cb){
  if(window.jspdf)return cb(window.jspdf.jsPDF);
  const s=document.createElement('script');
  s.src='https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
  s.onload=()=>cb(window.jspdf.jsPDF);s.onerror=()=>toast('Impossible de charger le générateur PDF');
  document.head.appendChild(s);
}
// Document type courrier : en-tête agence, destinataire, objet, paragraphes, tableau, signature
function gaDoc(o){
  gaPdf(jsPDF=>{
    const d=new jsPDF({unit:'mm',format:'a4'});const W=210,M=18;let y=18;
    const A=gaAgence();
    const t=(s)=>String(s??'').replace(/[  ]/g,' ').replace(/[’]/g,"'").replace(/[«»]/g,'"').replace(/[—–]/g,'-').replace(/…/g,'...').replace(/€/g,'EUR').replace(/œ/g,'oe');
    const need=h=>{if(y+h>282){d.addPage();y=18;}};
    d.setFont('helvetica','bold');d.setFontSize(13);d.text(t(A.nom),M,y);y+=5;
    d.setFont('helvetica','normal');d.setFontSize(8.5);
    [A.adresse,A.tel,A.carte?`Carte professionnelle n° ${A.carte}${A.cci?' - '+A.cci:''}`:'',A.garantie?`Garantie financière : ${A.garantie}`:''].filter(Boolean).forEach(l=>{d.splitTextToSize(t(l),92).forEach(x=>{d.text(x,M,y);y+=3.8;});});
    if(o.dest){let yy=30;d.setFontSize(10);d.setFont('helvetica','bold');d.text(t(o.dest[0]),120,yy);d.setFont('helvetica','normal');o.dest.slice(1).filter(Boolean).forEach(l=>{yy+=4.6;d.splitTextToSize(t(l),75).forEach(x=>{d.text(x,120,yy);});});y=Math.max(y,yy)+8;}
    else y+=6;
    d.setFontSize(9.5);d.text(t(`${(A.adresse.split(',').pop()||'').replace(/\d{5}/,'').trim()||'Le'} ${A.adresse?'le ':''}${gaFr(gaToday())}`),120,y);y+=8;
    if(o.mention){d.setFont('helvetica','bold');d.setFontSize(9);d.text(t(o.mention),M,y);y+=6;}
    if(o.titre){d.setFont('helvetica','bold');d.setFontSize(12.5);d.splitTextToSize(t(o.titre),W-2*M).forEach(x=>{d.text(x,M,y);y+=6;});y+=1;}
    if(o.objet){d.setFont('helvetica','bold');d.setFontSize(10);d.splitTextToSize(t('Objet : '+o.objet),W-2*M).forEach(x=>{d.text(x,M,y);y+=5;});y+=3;}
    d.setFont('helvetica','normal');d.setFontSize(10);
    const para=(p)=>{const bold=p.startsWith('**');const s=bold?p.slice(2).replace(/\*\*$/,''):p;d.setFont('helvetica',bold?'bold':'normal');d.splitTextToSize(t(s),W-2*M).forEach(x=>{need(5);d.text(x,M,y);y+=5;});y+=2.5;d.setFont('helvetica','normal');};
    (o.avant||[]).forEach(para);
    if(o.table){
      const{head,rows,widths,align,foot}=o.table;const cw=widths||head.map(()=> (W-2*M)/head.length);
      const row=(cells,bold,fill)=>{
        const lines=cells.map((c,i)=>d.splitTextToSize(t(c),cw[i]-2));const h=Math.max(...lines.map(l=>l.length))*4.2+2.4;
        need(h);if(fill){d.setFillColor(238,240,248);d.rect(M,y-3.6,W-2*M,h,'F');}
        d.setFont('helvetica',bold?'bold':'normal');let x=M;
        lines.forEach((l,i)=>{const r=(align||[])[i]==='r';l.forEach((s,k)=>d.text(s,r?x+cw[i]-1:x+1,y+k*4.2,{align:r?'right':'left'}));x+=cw[i];});
        y+=h;d.setDrawColor(220);d.line(M,y-3.4,W-M,y-3.4);
      };
      d.setFontSize(9);row(head,true,true);rows.forEach(r=>row(r,false,false));(foot||[]).forEach(r=>row(r,true,true));d.setFontSize(10);y+=3;
    }
    (o.apres||[]).forEach(para);
    need(26);y+=4;
    d.text(t(o.signature||`Pour ${A.nom},`),120,y);y+=5;d.text(t(o.signataire||'Le service gestion'),120,y);
    if(o.pied){d.setFontSize(7.5);d.setTextColor(120);d.splitTextToSize(t(o.pied),W-2*M).forEach((x,k)=>d.text(x,M,288+k*3.2-((d.splitTextToSize(t(o.pied),W-2*M).length-1)*3.2)));d.setTextColor(0);}
    if(o.retour)return o.retour(d);
    d.save((o.fichier||'document')+'.pdf');
  });
}

// ── Ouverture / navigation ──────────────────────────────────────────
async function loadGestionAgence(force){
  const body=document.getElementById('ga-body');if(!body)return;
  if(!GA.mois)GA.mois=gaYm(new Date());
  if(!GA.annee)GA.annee=new Date().getFullYear()-(new Date().getMonth()<6?1:0);
  if(!GA.loaded||force){
    body.innerHTML='<div style="text-align:center;padding:2.5rem"><div class="sp"></div><div style="font-size:.78rem;color:var(--td);margin-top:.6rem">Chargement du portefeuille…</div></div>';
    try{await gaLoad();}
    catch(e){body.innerHTML=`<div class="card"><div class="cb" style="font-size:.85rem;line-height:1.6"><strong><i data-lucide=database class=ic></i> Base à mettre à jour</strong><br>Exécutez <strong>supabase-migration-gestion-agence.sql</strong> dans Supabase (SQL Editor) puis rechargez la page.<div style="font-size:.72rem;color:var(--td);margin-top:.4rem">${gaE(e.message)}</div></div></div>`;return;}
  }
  gaRender();
}
const GA_TABS=[['pilotage','Pilotage','gauge'],['mandats','Mandats','file-signature'],['encaissements','Encaissements','wallet'],['recouvrement','Impayés','alert-triangle'],
  ['reversements','Reversements & CRG','send'],['interventions','Interventions','wrench'],['conformite','Conformité','shield-check'],['fins','Fins de bail','door-open'],
  ['irl','Révision IRL','trending-up'],['fiscal','Fiscalité','landmark'],['outils','Charges & outils','sliders-horizontal']];
// Fenêtre modale générique
function gaModal(html,wide){
  gaCloseModal();
  const ov=document.createElement('div');ov.id='ga-modal';
  ov.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.65);z-index:9999;display:flex;align-items:flex-start;justify-content:center;padding:3vh 1rem;overflow-y:auto';
  ov.innerHTML=`<div style="background:var(--s);border:1px solid var(--b);border-radius:16px;padding:1.4rem;width:100%;max-width:${wide?'860px':'560px'};position:relative">
    <button onclick="gaCloseModal()" style="position:absolute;top:.8rem;right:.9rem;background:none;border:none;color:var(--td);font-size:1.2rem;cursor:pointer" aria-label="Fermer">✕</button>${html}</div>`;
  ov.addEventListener('mousedown',e=>{if(e.target===ov)gaCloseModal();});
  document.body.appendChild(ov);if(window.lucide)lucide.createIcons();
}
function gaCloseModal(){document.getElementById('ga-modal')?.remove();}
const gaV=id=>document.getElementById(id)?.value?.trim()??'';
const gaN=id=>{const v=gaV(id).replace(',','.');return v===''?null:Number(v);};
const gaC=id=>!!document.getElementById(id)?.checked;
const gaKpi=(l,v,s,c)=>`<div class="kcard ${c||''}"><div class="klabel">${l}</div><div class="kval" style="font-size:1.35rem">${v}</div>${s?`<div class="ksub">${s}</div>`:''}</div>`;
const gaBadge=(txt,c)=>`<span class="badge ${c}" style="font-size:.64rem">${txt}</span>`;
const gaEmpty=(icon,txt,btn)=>`<div class="empty"><div class="em"><i data-lucide=${icon} class=ic></i></div><p>${txt}</p>${btn||''}</div>`;

// ════════════════════ Moteur de tâches (pilotage) ════════════════════
// Chaque règle produit une tâche : p (1 urgent, 2 important, 3 à prévoir),
// cat, titre, détail et actions en un clic.
function gaStage(m,p){
  const t=gaTen(m);const d=gaDays(p.due_date,gaToday());
  const unpaidCount=gaPays(m).filter(x=>gaUnpaid(x)&&gaDays(x.due_date,gaToday())>0).length;
  const st=[];
  // Étape suivante de la procédure (on ne propose pas une relance amiable à J+60)
  if(d>=30&&!p.mise_en_demeure_at)st.push({k:'med',p:1,l:'Mise en demeure (recommandé AR)',a:`gaMiseEnDemeure('${p.id}')`});
  else if(d>=15&&d<30&&!p.relance2_at&&!p.mise_en_demeure_at)st.push({k:'r2',p:2,l:p.relance_at?'Deuxième relance':'Relance (retard de plus de 15 jours)',a:`gaRelance('${p.id}',2)`});
  else if(d>=5&&d<15&&!p.relance_at)st.push({k:'r1',p:2,l:'Relance amiable',a:`gaRelance('${p.id}',1)`});
  if(d>=20&&t?.garant_nom&&!t.visale&&!p.garant_informe_at)st.push({k:'g',p:1,l:'Informer le garant (avant la fin du mois d’exigibilité)',a:`gaInfoGarant('${p.id}')`});
  if(m.gli&&!p.gli_declare_at&&d>=Math.max(0,(+m.gli_delai_jours||30)-10))st.push({k:'gli',p:1,l:`Déclarer l’impayé à l’assurance GLI${m.gli_assureur?' ('+m.gli_assureur+')':''} — délai ${m.gli_delai_jours||30} j`,a:`gaDeclareGarantie('${p.id}','gli')`});
  if(t?.visale&&!p.gli_declare_at&&unpaidCount>=2)st.push({k:'visale',p:1,l:'Déclarer l’impayé sur Visale (impayé constitué à la 2ᵉ échéance)',a:`gaDeclareGarantie('${p.id}','visale')`});
  if(p.mise_en_demeure_at&&!p.commandement_at&&gaDays(p.mise_en_demeure_at,gaToday())>=15)st.push({k:'cmd',p:1,l:'Commandement de payer par commissaire de justice (le locataire aura 6 semaines)',a:`gaCommandement('${p.id}')`});
  return st;
}
function gaTasks(){
  if(!GA.loaded)return[];
  const T=[];const today=gaToday();let curMid=null,curLid=null;const add=(o)=>T.push({mid:curMid,lid:curLid,...o});
  for(const m of gaActifs()){
    curMid=m.id;curLid=m.listing_id||null;
    const t=gaTen(m);const bien=gaBien(m);const fin=m.fin_bail||{};
    // Impayés
    for(const p of gaPays(m).filter(gaUnpaid)){
      const d=gaDays(p.due_date,today);if(d<1)continue;
      const st=gaStage(m,p);
      if(!st.length&&d<5)add({p:3,cat:'Encaissements',ic:'clock',t:`Loyer en attente — ${t?.nom||p.tenant_name||''}`,d:`${bien} · ${gaEur(gaReste(p))} dû le ${gaFrC(p.due_date)} (J+${d})`,a:[['Encaissé',`gaEncaisser('${p.id}')`]]});
      st.forEach(s=>add({p:s.p,cat:'Impayés',ic:'alert-triangle',t:`${s.l} — ${t?.nom||p.tenant_name||''}`,d:`${bien} · ${gaEur(gaReste(p))} dû le ${gaFrC(p.due_date)} (J+${d})`,a:[[s.k==='r1'||s.k==='r2'?'Envoyer':'Faire',s.a],['Encaissé',`gaEncaisser('${p.id}')`]]}));
    }
    // Avis d'échéance (si l'envoi automatique est coupé)
    if(!m.auto_avis)for(const p of gaPays(m).filter(x=>gaUnpaid(x)&&!x.avis_sent_at)){const d=gaDays(today,p.due_date);if(d>=0&&d<=7)add({p:3,cat:'Encaissements',ic:'file-text',t:`Avis d’échéance à envoyer — ${t?.nom||''}`,d:`${bien} · ${gaEur(p.amount)} au ${gaFrC(p.due_date)}`,a:[['Envoyer',`gaAvis('${p.id}',true)`]]});}
    // Quittances
    if(!m.auto_quittance)for(const p of gaPays(m).filter(x=>x.status==='paid'&&!x.quittance_sent_at&&gaDays(x.paid_at,today)<=45))
      add({p:3,cat:'Encaissements',ic:'receipt',t:`Quittance à envoyer — ${t?.nom||''}`,d:`${bien} · ${gaMoisLbl(String(p.due_date).slice(0,7))}`,a:[['Envoyer',`gaQuittance('${p.id}',true)`],['PDF',`gaQuittance('${p.id}')`]]});
    // Conformité
    for(const[k,def]of Object.entries(GA_DOCS)){
      if(!gaDocApplies(m,k))continue;
      const e=GA.ech.find(x=>x.mandat_id===m.id&&x.type===k);
      if(def.qui==='locataire'&&!t)continue;
      if(!e){if(def.oblig||k==='entretien_chaudiere')add({p:k==='assurance_habitation'?2:3,cat:'Conformité',ic:'shield-alert',t:`${def.l} : aucun justificatif`,d:bien,a:[['Renseigner',`gaEditEch('${m.id}','${k}')`],...(def.qui==='locataire'?[['Demander au locataire',`gaDemandeDoc('${m.id}','${k}')`]]:[])]});continue;}
      if(!e.date_expiration)continue;
      const r=gaDays(today,e.date_expiration);
      if(r<0)add({p:k==='assurance_habitation'||k==='dpe'?1:2,cat:'Conformité',ic:'shield-x',t:`${def.l} expiré${r<-1?' depuis '+(-r)+' j':''}`,d:`${bien} · échéance ${gaFrC(e.date_expiration)}`,a:[['Mettre à jour',`gaEditEch('${m.id}','${k}')`],...(def.qui==='locataire'?[['Demander',`gaDemandeDoc('${m.id}','${k}')`]]:[])]});
      else if(r<=30)add({p:3,cat:'Conformité',ic:'shield',t:`${def.l} à renouveler dans ${r} j`,d:`${bien} · échéance ${gaFrC(e.date_expiration)}`,a:[['Mettre à jour',`gaEditEch('${m.id}','${k}')`],...(def.qui==='locataire'?[['Demander',`gaDemandeDoc('${m.id}','${k}')`]]:[])]});
      if(k==='dpe'&&['F','G'].includes(String(e.resultat||'').toUpperCase()))add({p:2,cat:'Conformité',ic:'thermometer',t:`DPE ${e.resultat.toUpperCase()} : loyer gelé${e.resultat.toUpperCase()==='G'?', bien interdit à la location pour tout nouveau bail':', interdit à la location en 2028'}`,d:`${bien} — prévoir des travaux avec le propriétaire`,a:[['Créer une intervention',`gaNewInter('${m.id}','Travaux de rénovation énergétique (DPE ${e.resultat})')`]]});
    }
    // IRL
    const irl=t?gaIrlInfo(m):null;
    if(irl?.due)add({p:2,cat:'Loyers',ic:'trending-up',t:`Révision IRL possible — ${t.nom}`,d:`${bien} · ${gaEur(irl.ancien)} → ${gaEur(irl.nouveau)} HC (${irl.ref})`,a:[['Appliquer',`gaApplyIrl('${m.id}')`]]});
    // Fin de bail
    if(fin.preavis_recu&&!fin.edl_sortie)add({p:fin.date_fin&&gaDays(today,fin.date_fin)<=15?1:2,cat:'Fin de bail',ic:'door-open',t:`Préavis — sortie le ${gaFrC(fin.date_fin)}`,d:`${bien} · ${t?.nom||''} — planifier l’état des lieux de sortie et la relocation`,a:[['Ouvrir',`gaEditFin('${m.id}')`]]});
    if(fin.edl_sortie&&!fin.depot_restitue){const lim=gaAddM(fin.edl_sortie,fin.edl_conforme?1:2);const r=gaDays(today,lim);
      add({p:r<=7?1:2,cat:'Fin de bail',ic:'piggy-bank',t:r<0?`Dépôt de garantie en retard de ${-r} j (pénalité 10 % du loyer par mois commencé)`:`Restituer le dépôt de garantie avant le ${gaFrC(lim)}`,d:`${bien} · ${fin.locataire||t?.nom||''}`,a:[['Calculer',`gaDepotModal('${m.id}')`]]});}
    const _fb=gaProchaineEcheance(t);if(t&&!fin.preavis_recu&&_fb){const r=gaDays(today,_fb);const pre=t.meuble?3:6;if(r>0&&r<=pre*31+15)add({p:3,cat:'Fin de bail',ic:'calendar-clock',t:`Bail à échéance le ${gaFrC(_fb)}`,d:`${bien} — congé du bailleur possible jusqu’au ${gaFrC(gaAddM(_fb,-pre))} (${pre} mois avant). Sinon reconduction tacite.`,a:[['Informer le propriétaire',`gaInfoEcheanceBail('${m.id}')`]]});}
    if(!t&&!fin.preavis_recu)add({p:3,cat:'Location',ic:'home',t:'Bien vacant',d:`${bien} — chaque mois sans locataire coûte ${gaEur((+m.loc_loyer_hc||+gaListing(m.listing_id)?.price||0))} au propriétaire`,a:[['Créer l’annonce',`sp('new-listing')`],['Ajouter le locataire',`gaEditMandat('${m.id}')`]]});
    // Mandat à échéance
    if(m.date_signature&&!m.tacite){const fm=gaAddM(m.date_signature,+m.duree_mois||12);const r=gaDays(today,fm);if(r<=60&&r>=-30)add({p:2,cat:'Mandats',ic:'file-signature',t:`Mandat n° ${m.numero} à échéance le ${gaFrC(fm)}`,d:`${m.owner_name||''} — ${bien}`,a:[['Ouvrir',`gaEditMandat('${m.id}')`]]});}
    // Régularisation des charges (1er semestre)
    if(t&&t.ch>0&&!GA.ops.some(o=>o.mandat_id===m.id&&o.type==='regul_charges'&&String(o.libelle||'').includes(String(new Date().getFullYear()-1))))
      add({p:3,cat:'Loyers',ic:'calculator',t:`Régularisation des charges ${new Date().getFullYear()-1}`,d:`${bien} · provisions ${gaEur(t.ch)}/mois — à faire une fois par an`,a:[['Régulariser',`gaRegulModal('${m.id}')`]]});
    // TEOM à refacturer (octobre → décembre)
    if(t&&new Date().getMonth()>=9&&!GA.ops.some(o=>o.mandat_id===m.id&&o.type==='teom'&&String(o.date).startsWith(String(new Date().getFullYear()))))
      add({p:3,cat:'Loyers',ic:'trash-2',t:`TEOM ${new Date().getFullYear()} à refacturer au locataire`,d:`${bien} — montant sur l’avis de taxe foncière du propriétaire`,a:[['Saisir',`gaTeomModal('${m.id}')`]]});
  }
  curMid=null;curLid=null;
  // Baux de la plateforme sans mandat
  const linked=new Set(GA.mandats.map(m=>m.lease_id).filter(Boolean));
  for(const L of GA.leases.filter(l=>!linked.has(l.id)&&!l.parent_booking_id&&['signed','agreed'].includes(l.negotiation_status))){
    curLid=L.listing_id||null;add({p:2,cat:'Mandats',ic:'file-plus',t:'Bail signé sans mandat de gestion',d:`${L.listing_title||'Bien'} — ${GA.profiles[L.tenant_id]?.full_name||''}`,a:[['Créer le mandat',`gaNewMandatFromLease('${L.id}')`]]});}
  // Signalements des locataires non traités
  const tk=new Set(GA.inter.map(i=>i.ticket_id).filter(Boolean));
  for(const k of GA.tickets.filter(x=>!tk.has(x.id)&&!['resolved','closed'].includes(x.status||x.statut))){
    curLid=k.listing_id||null;curMid=GA.mandats.find(m=>m.listing_id&&m.listing_id===k.listing_id)?.id||null;add({p:k.priority==='urgent'||k.priority==='high'?1:2,cat:'Interventions',ic:'message-square-warning',t:`Signalement du locataire : ${k.title||'problème'}`,d:(gaListing(k.listing_id)?.title||'')+' · '+gaFrC(k.created_at),a:[['Créer l’intervention',`gaInterFromTicket('${k.id}')`]]});
  }
  // Interventions
  for(const i of GA.inter.filter(i=>!['facture','annule'].includes(i.statut))){
    const m=gaMandat(i.mandat_id);const age=gaDays(i.created_at,today);curMid=i.mandat_id;curLid=m?.listing_id||null;
    if(i.statut==='devis'&&m&&Number(i.devis_montant)>Number(m.seuil_travaux??300))add({p:2,cat:'Interventions',ic:'hand',t:`Accord du propriétaire requis — ${i.titre}`,d:`${gaBien(m)} · devis ${gaEur(i.devis_montant)} (seuil ${gaEur(m.seuil_travaux??300)})`,a:[['Demander l’accord',`gaDemandeAccord('${i.id}')`]]});
    else if(i.statut==='accord_demande'&&gaDays(i.accord_demande_at,today)>=3)add({p:2,cat:'Interventions',ic:'hand',t:`Relancer le propriétaire — ${i.titre}`,d:`${m?gaBien(m):''} · accord demandé il y a ${gaDays(i.accord_demande_at,today)} j`,a:[['Ouvrir',`gaEditInter('${i.id}')`]]});
    else if(i.statut==='termine')add({p:2,cat:'Interventions',ic:'receipt',t:`Facture à imputer — ${i.titre}`,d:`${m?gaBien(m):''}`,a:[['Imputer',`gaEditInter('${i.id}')`]]});
    else if(i.urgence==='urgente'&&!['planifie','termine'].includes(i.statut))add({p:1,cat:'Interventions',ic:'siren',t:`Intervention urgente — ${i.titre}`,d:`${m?gaBien(m):''} · ouverte depuis ${age} j`,a:[['Ouvrir',`gaEditInter('${i.id}')`]]});
    else if(age>=10&&['signale','devis'].includes(i.statut))add({p:3,cat:'Interventions',ic:'wrench',t:`Intervention en attente depuis ${age} j — ${i.titre}`,d:m?gaBien(m):'',a:[['Ouvrir',`gaEditInter('${i.id}')`]]});
  }
  // Reversements & CRG
  const day=new Date().getDate();const prev=gaAddM(gaYm(new Date())+'-01',-1).slice(0,7);
  for(const o of gaOwners()){
    curMid=o.ms[0].id;curLid=o.ms[0].listing_id||null;
    const s=gaSolde(o.key);const jr=Math.min(...o.ms.map(m=>+m.reversement_jour||10));
    if(s>0.5&&day>=jr)add({p:2,cat:'Reversements',ic:'send',t:`Reverser ${gaEur(s)} à ${o.name}`,d:o.iban?`IBAN ${o.iban}`:'IBAN du propriétaire manquant',a:[['Reverser',`gaReverser('${gaQ(o.key)}')`]]});
    const sent=GA.crg.some(c=>c.owner_key===o.key&&c.periode===prev&&c.envoye_at);
    if(!sent&&o.ms.some(m=>!m.auto_crg)&&day>=5&&gaCompte(o.key,prev+'-01',gaYm(new Date())+'-01').lignes.length)
      add({p:3,cat:'Reversements',ic:'file-bar-chart',t:`Compte rendu de gestion ${gaMoisLbl(prev)} — ${o.name}`,d:'À envoyer au propriétaire',a:[['Envoyer',`gaEnvoyerCrg('${gaQ(o.key)}','${prev}')`]]});
  }
  return T.sort((a,b)=>a.p-b.p);
}
function gaDocApplies(m,k){
  const def=GA_DOCS[k];if(!def?.si)return true;
  if(def.si==='chaudiere')return !!m.chaudiere;
  if(def.si==='av1949')return m.annee_construction?+m.annee_construction<1949:false;
  if(def.si==='av1997')return m.annee_construction?+m.annee_construction<1997:false;
  return true;
}

function gaRenderPilotage(){
  const today=gaToday();const cur=gaYm(new Date());
  const act=gaActifs();const loues=act.filter(m=>gaTen(m));
  const dus=act.flatMap(m=>gaPays(m).filter(p=>String(p.due_date).slice(0,7)===cur));
  const att=dus.reduce((s,p)=>s+(+p.amount||0),0),enc=dus.reduce((s,p)=>s+gaPaid(p),0);
  const imp=act.flatMap(m=>gaPays(m).filter(p=>gaUnpaid(p)&&gaDays(p.due_date,today)>0)).reduce((s,p)=>s+gaReste(p),0);
  const owners=gaOwners();const aRev=owners.reduce((s,o)=>s+Math.max(0,gaSolde(o.key)),0);
  const honM=owners.reduce((s,o)=>{const c=gaCompte(o.key,cur+'-01',gaNextMonth());return s+c.hon+c.frais;},0);
  const T=gaTasks();
  const cats=[...new Set(T.map(x=>x.cat))];
  const pc=['','b-red','b-gold','b-dim'],pl=['','Urgent','Important','À prévoir'];
  if(!GA.mandats.length)return`<div class="card"><div class="cb" style="text-align:center;padding:2rem 1rem">
    <div style="font-size:1.05rem;font-weight:700;margin-bottom:.4rem"><i data-lucide=briefcase class=ic></i> Démarrez votre activité de gestion</div>
    <div style="font-size:.82rem;color:var(--td);max-width:520px;margin:0 auto 1rem;line-height:1.6">Créez un mandat par bien géré. Le module s’occupe ensuite des appels de loyer, quittances, relances, comptes rendus de gestion, reversements, révisions IRL, échéances d’assurance et de diagnostics, fins de bail et du récapitulatif fiscal des propriétaires.</div>
    <button class="btn bp" onclick="gaEditMandat()"><i data-lucide=plus class=ic></i> Créer un mandat de gestion</button>
    ${GA.leases.filter(l=>['signed','agreed'].includes(l.negotiation_status)).length?`<div style="font-size:.75rem;color:var(--td);margin-top:.8rem">Vous avez des baux signés sur Trouve Ton Toit : ils apparaîtront ici pour créer leur mandat en un clic.</div>`:''}
  </div></div>${T.length?gaTaskList(T,pc,pl):''}`;
  return`<div class="kgrid" style="margin-bottom:1rem">
    ${gaKpi('Biens gérés',act.length,`${loues.length} loué${loues.length>1?'s':''} · ${act.length-loues.length} vacant${act.length-loues.length>1?'s':''}`)}
    ${gaKpi(`Loyers ${gaMoisLbl(cur)}`,gaEur(enc),`sur ${gaEur(att)} attendus${att?' · '+Math.round(enc/att*100)+' %':''}`,'green')}
    ${gaKpi('Impayés',gaEur(imp),imp?'à recouvrer':'aucun retard',imp?'terra':'')}
    ${gaKpi('À reverser',gaEur(aRev),`Honoraires du mois : ${gaEur(honM)}`)}
  </div>
  <div style="display:flex;gap:.5rem;flex-wrap:wrap;margin-bottom:1rem">
    <button class="btn bp bsm" onclick="gaEditMandat()"><i data-lucide=plus class=ic></i> Mandat</button>
    <button class="btn bg bsm" onclick="gaRapprochement()"><i data-lucide=landmark class=ic></i> Importer un relevé bancaire</button>
    <button class="btn bg bsm" onclick="gaNewInter()"><i data-lucide=wrench class=ic></i> Intervention</button>
    <button class="btn bg bsm" onclick="gaTab('reversements')"><i data-lucide=send class=ic></i> Reversements</button>
    <button class="btn bg bsm" onclick="loadGestionAgence(true)"><i data-lucide=refresh-cw class=ic></i> Actualiser</button>
  </div>
  <div class="card" style="margin-bottom:1rem"><div class="cb" style="font-size:.76rem;color:var(--td);line-height:1.55">
    <strong style="color:var(--txt)"><i data-lucide=bot class=ic></i> Automatique chaque jour :</strong> échéancier des loyers, avis d’échéance (J-7), relances (J+5, J+15), quittances par e-mail (si le locataire l’a accepté), alertes d’assurance et de diagnostics, comptes rendus de gestion mensuels. Réglage par mandat.
  </div></div>
  ${T.length?gaTaskList(T,pc,pl):gaEmpty('check-circle-2','Tout est à jour. Rien à faire aujourd’hui.')}`;
}
function gaTaskList(T,pc,pl){
  return`<div class="card"><div class="ch"><div class="ct"><i data-lucide=list-checks class=ic></i> À faire (${T.length})</div></div><div class="cb" style="padding:.4rem .9rem">
  ${T.map(x=>`<div style="display:flex;gap:.7rem;align-items:flex-start;padding:.65rem 0;border-bottom:1px solid var(--b)">
    <div style="width:30px;height:30px;border-radius:8px;background:var(--s2);display:flex;align-items:center;justify-content:center;flex-shrink:0"><i data-lucide=${x.ic} class=ic></i></div>
    <div style="flex:1;min-width:0"><div style="font-size:.84rem;font-weight:600">${gaE(x.t)}</div>
      <div style="font-size:.72rem;color:var(--td);margin-top:.15rem">${gaBadge(pl[x.p],pc[x.p])} <span style="margin-left:.3rem">${gaE(x.cat)} · ${gaE(x.d)}</span></div></div>
    <div style="display:flex;gap:.3rem;flex-wrap:wrap;justify-content:flex-end">${x.a.map(([l,f],k)=>`<button class="btn ${k?'bg':'bp'} bsm" onclick="${f}">${gaE(l)}</button>`).join('')}</div>
  </div>`).join('')}</div></div>`;
}

// ════════════════════ Mandats (registre) ════════════════════
function gaRenderMandats(){
  const ms=GA.mandats;
  return`<div style="display:flex;gap:.5rem;flex-wrap:wrap;margin-bottom:1rem">
    <button class="btn bp bsm" onclick="gaEditMandat()"><i data-lucide=plus class=ic></i> Nouveau mandat</button>
    <button class="btn bg bsm" onclick="gaRegistreCsv()"><i data-lucide=download class=ic></i> Registre des mandats (CSV)</button>
  </div>
  ${ms.length?`<div class="card"><div style="overflow-x:auto"><table class="tbl"><thead><tr><th>N°</th><th>Propriétaire</th><th>Bien</th><th>Locataire</th><th>Loyer CC</th><th>Honoraires</th><th>Solde</th><th></th></tr></thead><tbody>
  ${ms.map(m=>{const t=gaTen(m);const s=gaSolde(gaOwnerKey(m));return`<tr style="${m.statut==='resilie'?'opacity:.5':''}">
    <td><strong>${m.numero||'—'}</strong><div style="font-size:.66rem;color:var(--td)">${gaFrC(m.date_signature)}</div></td>
    <td>${gaE(m.owner_name||'—')}<div style="font-size:.68rem;color:var(--td)">${gaE(m.owner_email||'')}</div></td>
    <td>${gaE(gaBien(m))}<div style="font-size:.68rem;color:var(--td)">${m.bien_meuble===false?'Vide':'Meublé'}${m.gli?' · GLI':''}</div></td>
    <td>${t?gaE(t.nom)+(t.src==='ttt'?' '+gaBadge('Bail TTT','b-sea'):''):gaBadge('Vacant','b-gold')}</td>
    <td>${t?gaEur(t.hc+t.ch):'—'}</td>
    <td>${m.taux_honoraires||0} %${Number(m.frais_fixes)?' + '+gaEur(m.frais_fixes):''}</td>
    <td style="font-weight:600">${gaEur(s)}</td>
    <td style="white-space:nowrap"><button class="btn bg bsm" onclick="gaEditMandat('${m.id}')">Ouvrir</button></td></tr>`;}).join('')}
  </tbody></table></div></div>`:gaEmpty('file-signature','Aucun mandat de gestion.','<button class="btn bp bsm" onclick="gaEditMandat()">Créer le premier mandat</button>')}
  <div style="font-size:.72rem;color:var(--td);margin-top:.8rem;line-height:1.5">Loi Hoguet : chaque mandat est inscrit au registre des mandats avec un numéro d’ordre continu, reporté sur l’exemplaire remis au propriétaire. Les fonds encaissés pour le compte des propriétaires doivent transiter par un compte couvert par votre garantie financière.</div>`;
}
function gaNextNumero(){return Math.max(0,...GA.mandats.map(m=>+m.numero||0))+1;}
function gaEditMandat(id,pre){
  const m=id?gaMandat(id):{numero:gaNextNumero(),date_signature:gaToday(),duree_mois:12,tacite:true,taux_honoraires:7,base_honoraires:'cc',frais_fixes:0,gli:false,gli_taux:2.5,gli_delai_jours:30,
    seuil_travaux:300,reversement_jour:10,depot_detenu_par:'agence',auto_avis:true,auto_relances:true,auto_quittance:false,auto_crg:true,auto_conformite:true,loc_jour:1,bien_meuble:true,...(pre||{})};
  const leases=GA.leases.filter(l=>!l.parent_booking_id||l.id===m.lease_id);
  const v=k=>gaE(m[k]??'');const ck=k=>m[k]?'checked':'';
  const f=(id,l,inner,full)=>`<div class="fg"${full?' style="grid-column:1/-1"':''}><label class="fl">${l}</label>${inner}</div>`;
  const inp=(k,l,type,ph,full)=>f('',l,`<input class="fi" id="gm-${k}" ${type?`type="${type}"`:''} value="${v(k)}" placeholder="${ph||''}">`,full);
  const sec=t=>`<div style="grid-column:1/-1;font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--agencybright);margin-top:.6rem">${t}</div>`;
  const chk=(k,l)=>`<label style="display:flex;gap:.5rem;align-items:flex-start;font-size:.8rem;cursor:pointer;grid-column:1/-1"><input type="checkbox" id="gm-${k}" ${ck(k)} style="margin-top:.15rem"> <span>${l}</span></label>`;
  gaModal(`<div style="font-size:1.05rem;font-weight:700;margin-bottom:.2rem"><i data-lucide=file-signature class=ic></i> ${id?'Mandat n° '+m.numero:'Nouveau mandat de gestion'}</div>
  <div style="font-size:.75rem;color:var(--td);margin-bottom:.8rem">Tout se règle ici : conditions, location en cours et automatismes.</div>
  <div class="fgrid2">
    ${sec('Mandat')}
    ${inp('numero','N° au registre','number')}
    ${inp('date_signature','Date de signature','date')}
    ${inp('duree_mois','Durée (mois)','number')}
    ${f('','Statut',`<select class="fsel" id="gm-statut"><option value="actif" ${m.statut!=='resilie'?'selected':''}>Actif</option><option value="resilie" ${m.statut==='resilie'?'selected':''}>Résilié</option></select>`)}
    ${chk('tacite','Reconduction tacite')}
    ${sec('Propriétaire (mandant)')}
    ${inp('owner_name','Nom complet *','','',true)}
    ${inp('owner_email','E-mail','email')}
    ${inp('owner_phone','Téléphone')}
    ${inp('owner_address','Adresse','','',true)}
    ${inp('owner_iban','IBAN (reversements)','','FR76 …',true)}
    ${sec('Bien géré')}
    ${f('','Annonce Trouve Ton Toit',`<select class="fsel" id="gm-listing_id"><option value="">— Aucune (bien hors plateforme) —</option>${GA.listings.map(l=>`<option value="${l.id}" ${l.id===m.listing_id?'selected':''}>${gaE(l.title||l.full_address||l.id)}</option>`).join('')}</select>`,true)}
    ${inp('bien_label','Nom du bien','','Appartement T2 — Lyon 3e')}
    ${inp('bien_surface','Surface (m²)','number')}
    ${inp('bien_adresse','Adresse du bien','','',true)}
    ${f('','Type',`<select class="fsel" id="gm-bien_meuble"><option value="1" ${m.bien_meuble!==false?'selected':''}>Meublé</option><option value="0" ${m.bien_meuble===false?'selected':''}>Vide</option></select>`)}
    ${inp('annee_construction','Année de construction','number','pour plomb / amiante')}
    ${chk('chaudiere','Chaudière individuelle (entretien annuel à suivre)')}
    ${sec('Honoraires et conditions')}
    ${inp('taux_honoraires','Honoraires de gestion (% TTC)','number')}
    ${f('','Calculés sur',`<select class="fsel" id="gm-base_honoraires"><option value="cc" ${m.base_honoraires!=='hc'?'selected':''}>Loyer + charges encaissés</option><option value="hc" ${m.base_honoraires==='hc'?'selected':''}>Loyer hors charges encaissé</option></select>`)}
    ${inp('frais_fixes','Frais fixes (€ TTC / mois)','number')}
    ${inp('seuil_travaux','Travaux sans accord jusqu’à (€)','number')}
    ${inp('reversement_jour','Jour de reversement','number')}
    ${f('','Dépôt de garantie conservé par',`<select class="fsel" id="gm-depot_detenu_par"><option value="agence" ${m.depot_detenu_par!=='proprietaire'?'selected':''}>L’agence (compte mandant)</option><option value="proprietaire" ${m.depot_detenu_par==='proprietaire'?'selected':''}>Le propriétaire</option></select>`)}
    ${chk('gli','Assurance loyers impayés (GLI)')}
    ${inp('gli_taux','Taux GLI (% du loyer CC)','number')}
    ${inp('gli_assureur','Assureur GLI')}
    ${inp('gli_delai_jours','Délai de déclaration GLI (jours)','number')}
    ${sec('Location en cours')}
    ${f('','Bail signé sur Trouve Ton Toit',`<select class="fsel" id="gm-lease_id" onchange="document.getElementById('gm-ext').style.display=this.value?'none':'grid'"><option value="">— Aucun —</option>${leases.map(l=>`<option value="${l.id}" ${l.id===m.lease_id?'selected':''}>${gaE((l.listing_title||'Bail')+' — '+(GA.profiles[l.tenant_id]?.full_name||'')+(l.lot_label?' ('+l.lot_label+')':''))}</option>`).join('')}</select>`,true)}
    <div id="gm-ext" class="fgrid2" style="grid-column:1/-1;display:${m.lease_id?'none':'grid'}">
      <div style="grid-column:1/-1;font-size:.72rem;color:var(--td)">Ou locataire déjà en place (bail signé ailleurs) :</div>
      ${inp('loc_nom','Locataire')}
      ${inp('loc_email','E-mail du locataire','email')}
      ${inp('loc_phone','Téléphone')}
      ${inp('loc_debut','Début du bail','date')}
      ${inp('loc_loyer_hc','Loyer hors charges (€)','number')}
      ${inp('loc_charges','Provision sur charges (€)','number')}
      ${inp('loc_depot','Dépôt de garantie (€)','number')}
      ${inp('loc_jour','Jour de paiement','number')}
      ${f('','Garantie',`<select class="fsel" id="gm-loc_garantie"><option value="">Aucune</option>${['Caution personne physique','Visale','GLI','Autre'].map(g=>`<option ${m.loc_garantie===g?'selected':''}>${g}</option>`).join('')}</select>`)}
      ${inp('loc_garant_nom','Nom du garant')}
      ${inp('loc_garant_email','E-mail du garant','email')}
    </div>
    ${sec('Automatismes')}
    ${chk('auto_avis','Envoyer l’avis d’échéance au locataire 7 jours avant chaque loyer')}
    ${chk('auto_relances','Relancer automatiquement les retards (J+5 puis J+15)')}
    ${chk('auto_quittance','Envoyer la quittance par e-mail dès l’encaissement (le locataire doit l’avoir accepté)')}
    ${chk('auto_crg','Envoyer le compte rendu de gestion au propriétaire chaque mois')}
    ${chk('auto_conformite','Rappeler au locataire l’assurance habitation et l’entretien de chaudière avant échéance')}
    ${f('','Notes',`<textarea class="fi" id="gm-notes" rows="2">${v('notes')}</textarea>`,true)}
  </div>
  <div style="display:flex;gap:.5rem;justify-content:space-between;margin-top:1rem;flex-wrap:wrap">
    <div style="display:flex;gap:.4rem">${id?`<button class="btn bg bsm" onclick="gaMandatPdf('${id}')"><i data-lucide=file-text class=ic></i> Fiche mandat PDF</button><button class="btn bg bsm" onclick="gaEditFin('${id}')"><i data-lucide=door-open class=ic></i> Fin de bail</button>`:''}</div>
    <div style="display:flex;gap:.4rem"><button class="btn bg" onclick="gaCloseModal()">Annuler</button><button class="btn bp" onclick="gaSaveMandat(${id?`'${id}'`:'null'})">Enregistrer</button></div>
  </div>`,true);
}
async function gaSaveMandat(id){
  const row={agency_id:U.id,numero:gaN('gm-numero'),date_signature:gaV('gm-date_signature')||null,duree_mois:gaN('gm-duree_mois')||12,statut:gaV('gm-statut'),tacite:gaC('gm-tacite'),
    owner_name:gaV('gm-owner_name'),owner_email:gaV('gm-owner_email').toLowerCase()||null,owner_phone:gaV('gm-owner_phone')||null,owner_address:gaV('gm-owner_address')||null,owner_iban:gaV('gm-owner_iban').replace(/\s+/g,' ')||null,
    listing_id:gaV('gm-listing_id')||null,bien_label:gaV('gm-bien_label')||null,bien_adresse:gaV('gm-bien_adresse')||null,bien_surface:gaN('gm-bien_surface'),bien_meuble:gaV('gm-bien_meuble')==='1',
    annee_construction:gaN('gm-annee_construction'),chaudiere:gaC('gm-chaudiere'),
    taux_honoraires:gaN('gm-taux_honoraires')??0,base_honoraires:gaV('gm-base_honoraires'),frais_fixes:gaN('gm-frais_fixes')??0,seuil_travaux:gaN('gm-seuil_travaux')??0,reversement_jour:gaN('gm-reversement_jour')||10,
    depot_detenu_par:gaV('gm-depot_detenu_par'),gli:gaC('gm-gli'),gli_taux:gaN('gm-gli_taux')??0,gli_assureur:gaV('gm-gli_assureur')||null,gli_delai_jours:gaN('gm-gli_delai_jours')||30,
    lease_id:gaV('gm-lease_id')||null,
    loc_nom:gaV('gm-loc_nom')||null,loc_email:gaV('gm-loc_email').toLowerCase()||null,loc_phone:gaV('gm-loc_phone')||null,loc_debut:gaV('gm-loc_debut')||null,
    loc_loyer_hc:gaN('gm-loc_loyer_hc'),loc_charges:gaN('gm-loc_charges'),loc_depot:gaN('gm-loc_depot'),loc_jour:gaN('gm-loc_jour')||1,
    loc_garantie:gaV('gm-loc_garantie')||null,loc_garant_nom:gaV('gm-loc_garant_nom')||null,loc_garant_email:gaV('gm-loc_garant_email').toLowerCase()||null,
    auto_avis:gaC('gm-auto_avis'),auto_relances:gaC('gm-auto_relances'),auto_quittance:gaC('gm-auto_quittance'),auto_crg:gaC('gm-auto_crg'),auto_conformite:gaC('gm-auto_conformite'),
    notes:gaV('gm-notes')||null,updated_at:new Date().toISOString()};
  if(!row.owner_name){toast('Indiquez le nom du propriétaire');return;}
  if(!row.listing_id&&!row.bien_label&&!row.bien_adresse){toast('Indiquez le bien géré');return;}
  if(row.lease_id){row.loc_nom=null;}
  if(!row.bien_label&&row.listing_id)row.bien_label=gaListing(row.listing_id)?.title||null;
  if(!row.bien_adresse&&row.listing_id)row.bien_adresse=gaListing(row.listing_id)?.full_address||null;
  if(row.numero&&GA.mandats.some(x=>x.id!==id&&+x.numero===+row.numero)){toast('Ce numéro existe déjà au registre');return;}
  // Lier le compte Trouve Ton Toit du propriétaire s'il existe
  if(row.owner_email){try{const{data:p}=await sb.from('profiles').select('clerk_id').ilike('email',row.owner_email).maybeSingle();if(p?.clerk_id)row.owner_clerk_id=p.clerk_id;}catch(e){}}
  const q=id?sb.from('gestion_mandats').update(row).eq('id',id).select().single():sb.from('gestion_mandats').insert(row).select().single();
  const{data,error}=await q;
  if(error){toast('<i data-lucide=x-circle class=ic></i> '+error.message);return;}
  if(id)GA.mandats=GA.mandats.map(x=>x.id===id?data:x);else GA.mandats.push(data);
  gaCloseModal();toast('<i data-lucide=check-circle-2 class=ic></i> Mandat enregistré');
  await gaAttachPayments();await gaEnsureSchedule();gaRender();
}
function gaRegistreCsv(){
  const head=['N°','Date','Mandant','Adresse du mandant','Bien','Nature','Durée (mois)','Reconduction','Honoraires','Statut'];
  const rows=GA.mandats.map(m=>[m.numero,m.date_signature||'',m.owner_name||'',m.owner_address||'',gaAdresse(m),'Gestion locative',m.duree_mois,m.tacite?'tacite':'non',`${m.taux_honoraires} % TTC des encaissements`+(Number(m.frais_fixes)?` + ${m.frais_fixes} €/mois`:''),m.statut==='resilie'?'Résilié':'Actif']);
  gaCsv('registre-mandats-gestion',head,rows);
}
function gaCsv(name,head,rows){
  const c=v=>'"'+String(v??'').replace(/"/g,'""')+'"';
  const txt='﻿'+[head,...rows].map(r=>r.map(c).join(';')).join('\r\n');
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([txt],{type:'text/csv;charset=utf-8'}));a.download=name+'.csv';document.body.appendChild(a);a.click();a.remove();
}
function gaMandatPdf(id){
  const m=gaMandat(id);const t=gaTen(m);
  gaDoc({titre:`Fiche du mandat de gestion n° ${m.numero}`,dest:[m.owner_name,m.owner_address],fichier:`mandat-${m.numero}`,
    table:{head:['Rubrique','Détail'],widths:[60,114],rows:[
      ['Mandant',`${m.owner_name||''} — ${m.owner_email||''} ${m.owner_phone||''}`],['Bien géré',`${gaBien(m)} — ${gaAdresse(m)}`],
      ['Type de location',m.bien_meuble===false?'Vide':'Meublée'],['Date / durée',`${gaFrC(m.date_signature)} — ${m.duree_mois} mois${m.tacite?', reconduction tacite':''}`],
      ['Honoraires de gestion',`${m.taux_honoraires} % TTC des sommes encaissées (${m.base_honoraires==='hc'?'loyer hors charges':'loyer charges comprises'})${Number(m.frais_fixes)?` + ${gaEur(m.frais_fixes)} / mois`:''}`],
      ['Assurance loyers impayés',m.gli?`Oui — ${m.gli_taux} %${m.gli_assureur?' — '+m.gli_assureur:''}`:'Non'],
      ['Travaux sans accord préalable',`jusqu’à ${gaEur(m.seuil_travaux)}`],['Reversement',`le ${m.reversement_jour} de chaque mois${m.owner_iban?' sur '+m.owner_iban:''}`],
      ['Location en cours',t?`${t.nom} — ${gaEur(t.hc)} + ${gaEur(t.ch)} de charges, depuis le ${gaFrC(t.debut)}`:'Bien vacant'],
    ]},apres:['Document de synthèse établi à partir du mandat signé, qui seul fait foi.']});
}

// ════════════════════ Encaissements ════════════════════
function gaPayCtx(id){const p=GA.pays.find(x=>x.id===id);if(!p)return{};const m=gaMandat(p.mandat_id)||GA.mandats.find(mm=>gaPays(mm).includes(p));return{p,m,t:gaTen(m)};}
function gaMois(delta){GA.mois=gaAddM(GA.mois+'-15',delta).slice(0,7);gaRender();}
function gaRenderEnc(){
  const ym=GA.mois;
  const rows=gaActifs().flatMap(m=>gaPays(m).filter(p=>String(p.due_date).slice(0,7)===ym).map(p=>({m,p,t:gaTen(m)}))).sort((a,b)=>String(a.p.due_date).localeCompare(b.p.due_date));
  const att=rows.reduce((s,x)=>s+(+x.p.amount||0),0),enc=rows.reduce((s,x)=>s+gaPaid(x.p),0);
  const stat=x=>{const p=x.p;if(p.status==='paid')return gaBadge('Encaissé '+gaFrC(p.paid_at),'b-green');const d=gaDays(p.due_date,gaToday());
    if(+p.amount_paid>0)return gaBadge(`Partiel ${gaEur(p.amount_paid)}`,'b-gold');if(d>0)return gaBadge(`Retard J+${d}`,'b-red');return gaBadge(p.avis_sent_at?'Avis envoyé':'À venir','b-dim');};
  return`<div style="display:flex;gap:.5rem;align-items:center;flex-wrap:wrap;margin-bottom:1rem">
    <button class="btn bg bsm" onclick="gaMois(-1)">‹</button><strong style="min-width:130px;text-align:center;text-transform:capitalize">${gaMoisLbl(ym)}</strong><button class="btn bg bsm" onclick="gaMois(1)">›</button>
    <span style="flex:1"></span>
    <button class="btn bg bsm" onclick="gaRapprochement()"><i data-lucide=landmark class=ic></i> Rapprochement bancaire</button>
    <button class="btn bg bsm" onclick="gaAvisMois()"><i data-lucide=mail class=ic></i> Envoyer les avis du mois</button>
  </div>
  <div class="kgrid" style="margin-bottom:1rem">${gaKpi('Attendu',gaEur(att))}${gaKpi('Encaissé',gaEur(enc),att?Math.round(enc/att*100)+' % recouvré':'','green')}${gaKpi('Reste',gaEur(att-enc),'',att-enc>0?'terra':'')}</div>
  ${rows.length?`<div class="card"><div style="overflow-x:auto"><table class="tbl"><thead><tr><th>Échéance</th><th>Bien / locataire</th><th>Montant</th><th>Statut</th><th></th></tr></thead><tbody>
  ${rows.map(x=>`<tr><td>${gaFrC(x.p.due_date)}</td><td>${gaE(gaBien(x.m))}<div style="font-size:.7rem;color:var(--td)">${gaE(x.t?.nom||x.p.tenant_name||'')}</div></td>
    <td>${gaEur(x.p.amount)}${+x.p.amount_paid>0&&x.p.status!=='paid'?`<div style="font-size:.68rem;color:var(--td)">reste ${gaEur(gaReste(x.p))}</div>`:''}</td><td>${stat(x)}</td>
    <td style="white-space:nowrap;text-align:right">${x.p.status!=='paid'?`<button class="btn bp bsm" onclick="gaEncaisser('${x.p.id}')">Encaisser</button> <button class="btn bg bsm" onclick="gaAvis('${x.p.id}')" title="Avis d’échéance PDF"><i data-lucide=file-text class=ic></i></button>`
      :`<button class="btn bg bsm" onclick="gaQuittance('${x.p.id}')" title="Quittance PDF"><i data-lucide=receipt class=ic></i> Quittance</button> <button class="btn bg bsm" onclick="gaQuittance('${x.p.id}',true)" title="Envoyer la quittance"><i data-lucide=send class=ic></i></button> <button class="btn bg bsm" onclick="gaAnnulerEnc('${x.p.id}')" title="Annuler l’encaissement"><i data-lucide=undo-2 class=ic></i></button>`}</td></tr>`).join('')}
  </tbody></table></div></div>`:gaEmpty('wallet','Aucun loyer attendu ce mois-ci.')}`;
}
function gaEncaisser(id){
  const{p,t}=gaPayCtx(id);if(!p)return;
  gaModal(`<div style="font-size:1rem;font-weight:700;margin-bottom:.6rem"><i data-lucide=wallet class=ic></i> Encaisser le loyer</div>
  <div style="font-size:.8rem;color:var(--td);margin-bottom:.8rem">${gaE(t?.nom||p.tenant_name||'')} — échéance du ${gaFrC(p.due_date)} — ${gaEur(p.amount)}${+p.amount_paid?` (déjà reçu ${gaEur(p.amount_paid)})`:''}</div>
  <div class="fgrid2">
    <div class="fg"><label class="fl">Montant reçu (€)</label><input class="fi" id="ge-mt" type="number" step="0.01" value="${gaR(gaReste(p))}"></div>
    <div class="fg"><label class="fl">Date de réception</label><input class="fi" id="ge-dt" type="date" value="${gaToday()}"></div>
    <div class="fg" style="grid-column:1/-1"><label class="fl">Mode</label><select class="fsel" id="ge-mode"><option>Virement</option><option>Prélèvement</option><option>Chèque</option><option>Espèces</option><option>CAF / APL (tiers payant)</option><option>Garant / assurance</option></select></div>
  </div>
  <div style="display:flex;justify-content:flex-end;gap:.5rem;margin-top:1rem"><button class="btn bg" onclick="gaCloseModal()">Annuler</button><button class="btn bp" onclick="gaSaveEnc('${id}')">Enregistrer</button></div>`);
}
async function gaSaveEnc(id,montant,date,mode){
  const{p,m}=gaPayCtx(id);if(!p)return;
  const mt=montant??gaN('ge-mt');const dt=date||gaV('ge-dt')||gaToday();const md=mode||gaV('ge-mode')||'Virement';
  if(!mt||mt<=0){toast('Montant invalide');return;}
  const tot=gaR((+p.amount_paid||0)+mt);const full=tot>=(+p.amount||0)-0.01;
  const upd={amount_paid:tot,paid_at:new Date(dt+'T12:00:00').toISOString(),payment_method:md,status:full?'paid':(gaDays(p.due_date,gaToday())>0?'late':'pending')};
  const{error}=await sb.from('payments').update(upd).eq('id',id);
  if(error){toast('<i data-lucide=x-circle class=ic></i> '+error.message);return;}
  Object.assign(p,upd);gaCloseModal();
  toast(`<i data-lucide=check-circle-2 class=ic></i> ${full?'Loyer encaissé':'Paiement partiel enregistré'}`);
  if(full&&m?.auto_quittance)await gaQuittance(id,true,true);
  gaRender();
}
async function gaAnnulerEnc(id){
  if(!confirm('Annuler cet encaissement ? Le loyer repassera en attente.'))return;
  const{p}=gaPayCtx(id);const upd={status:gaDays(p.due_date,gaToday())>0?'late':'pending',amount_paid:null,paid_at:null};
  const{error}=await sb.from('payments').update(upd).eq('id',id);if(error){toast(error.message);return;}
  Object.assign(p,upd);gaRender();
}
// Montants du loyer (part hors charges / charges) au prorata de l'échéance
function gaSplit(p,t){const tot=(t?.hc||0)+(t?.ch||0);const amt=+p.amount||0;if(!tot)return{hc:amt,ch:0};const hc=gaR(amt*t.hc/tot);return{hc,ch:gaR(amt-hc)};}
function gaAvis(id,send){
  const{p,m,t}=gaPayCtx(id);if(!p)return;const s=gaSplit(p,t);const per=gaMoisLbl(String(p.due_date).slice(0,7));
  const arr=gaPays(m).filter(x=>x.id!==p.id&&gaUnpaid(x)&&x.due_date<p.due_date).reduce((a,x)=>a+gaReste(x),0);
  if(send){
    const html=`<p>Bonjour ${gaE(t?.nom||'')},</p><p>Voici votre avis d’échéance pour <strong>${gaE(gaBien(m))}</strong> — période de <strong>${per}</strong> :</p>
      <table style="border-collapse:collapse;font-size:14px"><tr><td style="padding:4px 12px 4px 0">Loyer</td><td style="text-align:right">${gaEur(s.hc)}</td></tr><tr><td style="padding:4px 12px 4px 0">Provision sur charges</td><td style="text-align:right">${gaEur(s.ch)}</td></tr>${arr?`<tr><td style="padding:4px 12px 4px 0">Arriéré</td><td style="text-align:right">${gaEur(arr)}</td></tr>`:''}<tr><td style="padding:6px 12px 4px 0"><strong>Total à régler</strong></td><td style="text-align:right"><strong>${gaEur(+p.amount+arr)}</strong></td></tr></table>
      <p>À régler au plus tard le <strong>${gaFr(p.due_date)}</strong>.</p>`;
    return(async()=>{const ok=await gaMail(t?.email||p.tenant_email,`Avis d’échéance ${per} — ${gaBien(m)}`,`Avis d’échéance — ${per}`,html);
      if(t?.tenant_id)await gaMsg(t.tenant_id,m.listing_id,`Avis d’échéance ${per} : ${gaEur(+p.amount+arr)} à régler avant le ${gaFrC(p.due_date)}.`);
      await sb.from('payments').update({avis_sent_at:new Date().toISOString()}).eq('id',id);p.avis_sent_at=new Date().toISOString();
      toast(ok?'<i data-lucide=send class=ic></i> Avis envoyé':'Avis enregistré (e-mail non envoyé : adresse ou service e-mail manquant)');gaRender();})();
  }
  gaDoc({titre:'Avis d’échéance',dest:[t?.nom||p.tenant_name||'',gaAdresse(m)],fichier:`avis-echeance-${String(p.due_date).slice(0,7)}`,
    avant:[`Bien loué : ${gaBien(m)} — ${gaAdresse(m)}`,`Bailleur : ${m.owner_name||''}, représenté par ${gaAgence().nom}, mandataire.`,`Période : ${per}`],
    table:{head:['Désignation','Montant'],widths:[124,50],align:['l','r'],rows:[['Loyer',gaEur(s.hc)],['Provision sur charges',gaEur(s.ch)],...(arr?[['Arriéré à régulariser',gaEur(arr)]]:[])],foot:[['Total à régler',gaEur(+p.amount+arr)]]},
    apres:[`**À régler au plus tard le ${gaFr(p.due_date)}.**`,'Cet avis ne vaut pas quittance.']});
}
async function gaAvisMois(){
  const ym=GA.mois;const ps=gaActifs().flatMap(m=>gaPays(m).filter(p=>String(p.due_date).slice(0,7)===ym&&gaUnpaid(p)&&!p.avis_sent_at));
  if(!ps.length){toast('Tous les avis de ce mois sont déjà envoyés');return;}
  if(!confirm(`Envoyer ${ps.length} avis d’échéance par e-mail ?`))return;
  for(const p of ps)await gaAvis(p.id,true);
}
async function gaQuittance(id,send,silent){
  const{p,m,t}=gaPayCtx(id);if(!p)return;const s=gaSplit(p,t);const ym=String(p.due_date).slice(0,7);const per=gaMoisLbl(ym);
  const[y,mo]=ym.split('-').map(Number);const du=`01/${String(mo).padStart(2,'0')}/${y}`,au=`${new Date(y,mo,0).getDate()}/${String(mo).padStart(2,'0')}/${y}`;
  const txt=`Je soussigné(e), ${gaAgence().nom}, mandataire de ${m.owner_name||'le bailleur'}, bailleur du logement désigné ci-dessus, déclare avoir reçu de ${t?.nom||p.tenant_name||'le locataire'} la somme de ${gaEur(gaPaid(p))} au titre du loyer et des charges pour la période du ${du} au ${au}, et lui en donne quittance, sous réserve de tous mes droits.`;
  if(send){
    const html=`<p>Bonjour ${gaE(t?.nom||'')},</p><p><strong>Quittance de loyer — ${per}</strong><br>${gaE(gaBien(m))} — ${gaE(gaAdresse(m))}</p>
      <table style="border-collapse:collapse;font-size:14px"><tr><td style="padding:4px 12px 4px 0">Loyer</td><td style="text-align:right">${gaEur(s.hc)}</td></tr><tr><td style="padding:4px 12px 4px 0">Charges</td><td style="text-align:right">${gaEur(s.ch)}</td></tr><tr><td style="padding:6px 12px 4px 0"><strong>Total reçu le ${gaFrC(p.paid_at)}</strong></td><td style="text-align:right"><strong>${gaEur(gaPaid(p))}</strong></td></tr></table>
      <p style="font-size:13px">${gaE(txt)}</p>`;
    const ok=await gaMail(t?.email||p.tenant_email,`Quittance de loyer ${per} — ${gaBien(m)}`,`Quittance de loyer — ${per}`,html);
    if(t?.tenant_id)await gaMsg(t.tenant_id,m.listing_id,`Quittance de loyer ${per} : ${gaEur(gaPaid(p))} reçus le ${gaFrC(p.paid_at)}. Merci !`);
    await sb.from('payments').update({quittance_sent_at:new Date().toISOString()}).eq('id',id);p.quittance_sent_at=new Date().toISOString();
    if(!silent)toast(ok?'<i data-lucide=send class=ic></i> Quittance envoyée':'Quittance enregistrée (e-mail non envoyé)');
    if(!silent)gaRender();return;
  }
  gaDoc({titre:`Quittance de loyer — ${per}`,dest:[t?.nom||p.tenant_name||'',gaAdresse(m)],fichier:`quittance-${ym}`,
    avant:[`Bien loué : ${gaBien(m)} — ${gaAdresse(m)}`],
    table:{head:['Désignation','Montant'],widths:[124,50],align:['l','r'],rows:[['Loyer',gaEur(s.hc)],['Provision sur charges',gaEur(s.ch)]],foot:[[`Total reçu le ${gaFrC(p.paid_at)}`,gaEur(gaPaid(p))]]},
    apres:[txt,'Le paiement de la présente quittance n’emporte pas présomption de paiement des termes antérieurs.']});
}

// ── Rapprochement bancaire (relevé CSV) ─────────────────────────────
function gaRapprochement(){
  gaModal(`<div style="font-size:1rem;font-weight:700;margin-bottom:.3rem"><i data-lucide=landmark class=ic></i> Rapprochement bancaire</div>
  <div style="font-size:.78rem;color:var(--td);margin-bottom:.8rem;line-height:1.5">Exportez le relevé de votre compte mandant en CSV depuis votre banque, puis déposez-le ici. Chaque virement reçu est associé automatiquement au loyer correspondant (montant, nom du locataire, date). Vous validez avant enregistrement.</div>
  <input type="file" id="ga-csv" accept=".csv,.txt" class="fi" onchange="gaParseReleve(this.files[0])">
  <div id="ga-rapp" style="margin-top:1rem"></div>`,true);
}
function gaCsvParse(txt){
  const lines=txt.replace(/\r/g,'').split('\n').filter(l=>l.trim());
  const sep=[';',',','\t'].sort((a,b)=>(lines[0].split(b).length)-(lines[0].split(a).length))[0];
  const split=l=>{const out=[];let cur='',q=false;for(const ch of l){if(ch==='"'){q=!q;continue;}if(ch===sep&&!q){out.push(cur);cur='';}else cur+=ch;}out.push(cur);return out.map(x=>x.trim());};
  return lines.map(split);
}
const gaNum=s=>{if(s==null)return null;let v=String(s).replace(/[\s €]/g,'');if(!v)return null;if(/,\d{1,2}$/.test(v))v=v.replace(/\./g,'').replace(',','.');else v=v.replace(/,/g,'');const n=parseFloat(v);return isNaN(n)?null:n;};
const gaDateFr=s=>{const m=String(s||'').match(/(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})/);if(m)return`${m[3].length===2?'20'+m[3]:m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;const i=String(s||'').match(/(\d{4})-(\d{2})-(\d{2})/);return i?i[0]:null;};
let GA_RAPP=[];
async function gaParseReleve(file){
  if(!file)return;const txt=await file.text();const rows=gaCsvParse(txt);
  // Trouver l'en-tête et les colonnes date / libellé / crédit / montant
  let hi=rows.findIndex(r=>r.some(c=>/date/i.test(c))&&r.some(c=>/libell|label|d[ée]signation|op[ée]ration|description/i.test(c)));if(hi<0)hi=0;
  const h=rows[hi].map(c=>c.toLowerCase());
  const ci=re=>h.findIndex(c=>re.test(c));
  const cD=ci(/date/),cL=ci(/libell|label|d[ée]signation|op[ée]ration|description|motif/),cC=ci(/cr[ée]dit/),cM=ci(/montant|amount|somme/);
  const cand=gaActifs().flatMap(m=>gaPays(m).filter(gaUnpaid).map(p=>({p,m,t:gaTen(m)})));
  const used=new Set();GA_RAPP=[];
  for(const r of rows.slice(hi+1)){
    const amt=cC>=0&&gaNum(r[cC])?gaNum(r[cC]):gaNum(r[cM]);if(!amt||amt<=0)continue;
    const date=gaDateFr(r[cD])||gaToday();const lib=(r[cL]||r.join(' ')).toUpperCase();
    let best=null,score=0;
    for(const c of cand){if(used.has(c.p.id))continue;
      let s=0;const reste=gaReste(c.p);
      if(Math.abs(amt-reste)<0.01)s+=5;else if(Math.abs(amt-(+c.p.amount))<0.01)s+=4;else if(amt<reste)s+=1;
      const toks=String(c.t?.nom||c.p.tenant_name||'').toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g,'').split(/[\s-]+/).filter(x=>x.length>2);
      const libN=lib.normalize('NFD').replace(/[̀-ͯ]/g,'');
      s+=toks.filter(x=>libN.includes(x)).length*3;
      const dd=Math.abs(gaDays(c.p.due_date,date));s+=dd<=10?2:dd<=35?1:-2;
      if(s>score){score=s;best=c;}}
    if(best&&score>=5){used.add(best.p.id);GA_RAPP.push({date,lib,amt,c:best,score});}
    else GA_RAPP.push({date,lib,amt,c:null,score:0});
  }
  const ok=GA_RAPP.filter(x=>x.c);
  document.getElementById('ga-rapp').innerHTML=`<div style="font-size:.8rem;margin-bottom:.5rem"><strong>${ok.length}</strong> loyer${ok.length>1?'s':''} reconnu${ok.length>1?'s':''} sur ${GA_RAPP.length} crédit${GA_RAPP.length>1?'s':''}.</div>
  <div style="max-height:50vh;overflow:auto"><table class="tbl"><thead><tr><th></th><th>Date</th><th>Libellé bancaire</th><th>Montant</th><th>Loyer associé</th></tr></thead><tbody>
  ${GA_RAPP.map((x,i)=>`<tr style="${x.c?'':'opacity:.55'}"><td>${x.c?`<input type="checkbox" id="gr-${i}" checked>`:''}</td><td>${gaFrC(x.date)}</td><td style="font-size:.72rem">${gaE(x.lib.slice(0,70))}</td><td>${gaEur(x.amt)}</td>
    <td style="font-size:.75rem">${x.c?`${gaE(x.c.t?.nom||x.c.p.tenant_name||'')} — ${gaE(gaBien(x.c.m))}<div style="color:var(--td)">échéance ${gaFrC(x.c.p.due_date)} · ${gaEur(gaReste(x.c.p))}${x.score>=8?' · '+gaBadge('sûr','b-green'):' · '+gaBadge('à vérifier','b-gold')}</div>`:'Non reconnu'}</td></tr>`).join('')}
  </tbody></table></div>
  ${ok.length?`<div style="display:flex;justify-content:flex-end;margin-top:.8rem"><button class="btn bp" onclick="gaValiderRapp()">Enregistrer les encaissements cochés</button></div>`:''}`;
}
async function gaValiderRapp(){
  const sel=GA_RAPP.filter((x,i)=>x.c&&document.getElementById('gr-'+i)?.checked);let n=0;
  for(const x of sel){await gaSaveEnc(x.c.p.id,x.amt,x.date,'Virement');n++;}
  gaCloseModal();toast(`<i data-lucide=check-circle-2 class=ic></i> ${n} encaissement${n>1?'s':''} enregistré${n>1?'s':''}`);gaRender();
}

// ════════════════════ Impayés & recouvrement ════════════════════
function gaRenderRecouv(){
  const today=gaToday();
  const dos=gaActifs().map(m=>{const ps=gaPays(m).filter(p=>gaUnpaid(p)&&gaDays(p.due_date,today)>0).sort((a,b)=>a.due_date.localeCompare(b.due_date));return{m,t:gaTen(m),ps,tot:ps.reduce((s,p)=>s+gaReste(p),0)};}).filter(x=>x.ps.length).sort((a,b)=>b.tot-a.tot);
  const step=(ok,l)=>`<span style="display:inline-flex;align-items:center;gap:.25rem;font-size:.7rem;padding:.15rem .5rem;border-radius:100px;background:${ok?'var(--grdim, rgba(76,175,125,.12))':'var(--s2)'};color:${ok?'var(--green)':'var(--td)'}">${ok?'✓':'○'} ${l}</span>`;
  return`<div class="card" style="margin-bottom:1rem"><div class="cb" style="font-size:.76rem;color:var(--td);line-height:1.6">
    <strong style="color:var(--txt)">Procédure appliquée :</strong> J+5 relance amiable · J+15 deuxième relance · avant la fin du mois d’exigibilité : information du garant (art. 2303 du Code civil) · J+30 mise en demeure en recommandé · déclaration GLI dans le délai du contrat, Visale dès la 2ᵉ échéance impayée · 15 jours sans régularisation après la mise en demeure : commandement de payer par commissaire de justice (le locataire dispose alors de 6 semaines). Un plan d’apurement amiable peut être proposé à tout moment.
  </div></div>
  ${dos.length?dos.map(x=>`<div class="card" style="margin-bottom:.85rem"><div class="cb">
    <div style="display:flex;justify-content:space-between;gap:.6rem;flex-wrap:wrap;margin-bottom:.6rem">
      <div><div style="font-weight:700">${gaE(x.t?.nom||x.ps[0].tenant_name||'Locataire')} <span style="color:var(--red)">— ${gaEur(x.tot)}</span></div>
      <div style="font-size:.74rem;color:var(--td)">${gaE(gaBien(x.m))} · ${x.ps.length} échéance${x.ps.length>1?'s':''} · garantie : ${gaE(x.t?.visale?'Visale':x.t?.garant_nom?'caution '+x.t.garant_nom:x.m.gli?'GLI':'aucune')} · propriétaire : ${gaE(x.m.owner_name||'')}</div></div>
      <div style="display:flex;gap:.3rem;flex-wrap:wrap"><button class="btn bg bsm" onclick="gaApurement('${x.m.id}')"><i data-lucide=calendar-range class=ic></i> Plan d’apurement</button><button class="btn bg bsm" onclick="gaInfoProprioImpaye('${x.m.id}')"><i data-lucide=user class=ic></i> Informer le propriétaire</button></div>
    </div>
    ${x.ps.map(p=>{const st=gaStage(x.m,p);const d=gaDays(p.due_date,today);return`<div style="background:var(--s2);border-radius:10px;padding:.6rem .75rem;margin-bottom:.4rem">
      <div style="display:flex;justify-content:space-between;gap:.5rem;flex-wrap:wrap;align-items:center"><div style="font-size:.82rem"><strong>${gaMoisLbl(String(p.due_date).slice(0,7))}</strong> — ${gaEur(gaReste(p))} <span style="color:var(--td)">(J+${d})</span></div>
      <button class="btn bp bsm" onclick="gaEncaisser('${p.id}')">Encaisser</button></div>
      <div style="display:flex;gap:.3rem;flex-wrap:wrap;margin-top:.45rem">${step(p.relance_at,'Relance 1')}${step(p.relance2_at,'Relance 2')}${x.t?.garant_nom&&!x.t.visale?step(p.garant_informe_at,'Garant informé'):''}${step(p.mise_en_demeure_at,'Mise en demeure')}${x.m.gli||x.t?.visale?step(p.gli_declare_at,x.t?.visale?'Visale':'GLI'):''}${step(p.commandement_at,'Commandement')}</div>
      ${st.length?`<div style="display:flex;gap:.3rem;flex-wrap:wrap;margin-top:.45rem">${st.map(s=>`<button class="btn bg bsm" onclick="${s.a}">${gaE(s.l)}</button>`).join('')}</div>`:''}
      <div style="display:flex;gap:.3rem;flex-wrap:wrap;margin-top:.35rem;font-size:.7rem"><a style="color:var(--agencybright)" href="#" onclick="gaLettreRelance('${p.id}',1);return false">Lettre relance</a> · <a style="color:var(--agencybright)" href="#" onclick="gaLettreMED('${p.id}');return false">Lettre mise en demeure</a>${x.t?.garant_nom?` · <a style="color:var(--agencybright)" href="#" onclick="gaLettreGarant('${p.id}');return false">Lettre garant</a>`:''}</div>
    </div>`;}).join('')}
  </div></div>`).join(''):gaEmpty('smile','Aucun impayé. Bravo !')}`;
}
async function gaMarkPay(id,col){const v=new Date().toISOString();const upd={[col]:v};if(col!=='gli_declare_at'&&col!=='commandement_at')upd.status='late';
  const{error}=await sb.from('payments').update(upd).eq('id',id);if(error){toast(error.message);return false;}Object.assign(GA.pays.find(p=>p.id===id)||{},upd);return true;}
async function gaRelance(id,n,silent){
  const{p,m,t}=gaPayCtx(id);if(!p)return;
  const html=n===1?`<p>Bonjour ${gaE(t?.nom||'')},</p><p>Sauf erreur de notre part, le loyer de <strong>${gaEur(gaReste(p))}</strong> dû le <strong>${gaFr(p.due_date)}</strong> pour ${gaE(gaBien(m))} ne nous est pas parvenu.</p><p>Si le règlement est en cours, merci de ne pas tenir compte de ce message. En cas de difficulté, contactez-nous rapidement : des solutions existent (échelonnement, aides au logement, FSL).</p>`
    :`<p>Bonjour ${gaE(t?.nom||'')},</p><p>Malgré notre premier rappel, le loyer de <strong>${gaEur(gaReste(p))}</strong> dû le <strong>${gaFr(p.due_date)}</strong> reste impayé.</p><p>Nous vous remercions de régulariser sous 8 jours. À défaut, nous serons contraints d’engager la procédure de recouvrement (mise en demeure${t?.garant_nom?', information de votre garant':''}).</p>`;
  const ok=await gaMail(t?.email||p.tenant_email,`${n===1?'Rappel':'Deuxième rappel'} : loyer du ${gaFrC(p.due_date)} — ${gaBien(m)}`,n===1?'Rappel de loyer':'Deuxième rappel de loyer',html);
  if(t?.tenant_id)await gaMsg(t.tenant_id,m.listing_id,`${n===1?'Rappel':'Deuxième rappel'} : le loyer de ${gaEur(gaReste(p))} dû le ${gaFrC(p.due_date)} n’a pas été reçu. Merci de régulariser rapidement ou de nous contacter.`);
  await gaMarkPay(id,n===1?'relance_at':'relance2_at');
  if(silent)return ok;
  toast(ok?'<i data-lucide=send class=ic></i> Relance envoyée':'Relance enregistrée — e-mail non envoyé (adresse manquante ?). Téléchargez la lettre.');gaRender();
}
function gaLettreRelance(id,n){
  const{p,m,t}=gaPayCtx(id);
  gaDoc({dest:[t?.nom||p.tenant_name||'',gaAdresse(m)],objet:`Loyer impayé — échéance du ${gaFr(p.due_date)}`,fichier:'relance-loyer',
    avant:[`${t?.nom?'Madame, Monsieur '+t.nom:'Madame, Monsieur'},`,`Sauf erreur de notre part, nous n’avons pas reçu le règlement du loyer et des charges de ${gaEur(gaReste(p))}, exigible le ${gaFr(p.due_date)}, pour le logement situé ${gaAdresse(m)}, que nous gérons pour le compte de ${m.owner_name||'votre bailleur'}.`,
      'Nous vous remercions de bien vouloir procéder à ce règlement dans les meilleurs délais. Si vous rencontrez des difficultés, prenez contact avec nous : un échéancier peut être envisagé, et vous pouvez solliciter la CAF ou le Fonds de solidarité pour le logement (FSL) de votre département.',
      'Veuillez agréer, Madame, Monsieur, nos salutations distinguées.']});
}
function gaLettreMED(id){
  const{p,m,t}=gaPayCtx(id);const tot=gaPays(m).filter(gaUnpaid).filter(x=>x.due_date<=gaToday()).reduce((s,x)=>s+gaReste(x),0);
  gaDoc({mention:'LETTRE RECOMMANDÉE AVEC ACCUSÉ DE RÉCEPTION',dest:[t?.nom||p.tenant_name||'',gaAdresse(m)],objet:'Mise en demeure de payer',fichier:'mise-en-demeure',
    avant:[`${t?.nom?'Madame, Monsieur '+t.nom:'Madame, Monsieur'},`,`En notre qualité de mandataire de ${m.owner_name||'votre bailleur'}, nous constatons qu’à ce jour, malgré nos relances, vous restez redevable de la somme de ${gaEur(tot)} au titre des loyers et charges du logement situé ${gaAdresse(m)}, détaillée ci-dessous.`],
    table:{head:['Échéance','Montant restant dû'],widths:[124,50],align:['l','r'],rows:gaPays(m).filter(gaUnpaid).filter(x=>x.due_date<=gaToday()).map(x=>[`${gaMoisLbl(String(x.due_date).slice(0,7))} (exigible le ${gaFrC(x.due_date)})`,gaEur(gaReste(x))]),foot:[['Total',gaEur(tot)]]},
    apres:['Nous vous mettons en demeure de régler cette somme dans un délai de huit jours à compter de la réception de la présente.',
      'À défaut, nous engagerons sans autre avis la procédure de recouvrement, notamment la délivrance d’un commandement de payer visant la clause résolutoire du bail par commissaire de justice, dont les frais resteront à votre charge'+(t?.garant_nom?', et nous ferons appel à votre garant.':'.'),
      'Si vous rencontrez des difficultés, contactez-nous sans attendre : un plan d’apurement peut être étudié. Vous pouvez également saisir le Fonds de solidarité pour le logement (FSL) et l’ADIL de votre département.',
      'Veuillez agréer, Madame, Monsieur, nos salutations distinguées.']});
}
async function gaMiseEnDemeure(id){gaLettreMED(id);if(await gaMarkPay(id,'mise_en_demeure_at')){toast('Lettre téléchargée : envoyez-la en recommandé AR. Étape marquée comme faite.');gaRender();}}
function gaLettreGarant(id){
  const{p,m,t}=gaPayCtx(id);
  gaDoc({mention:'LETTRE RECOMMANDÉE AVEC ACCUSÉ DE RÉCEPTION',dest:[t?.garant_nom||'Le garant',''],objet:`Information de la caution — défaillance du locataire ${t?.nom||''}`,fichier:'information-garant',
    avant:['Madame, Monsieur,',`Vous vous êtes porté(e) caution des engagements de ${t?.nom||'votre locataire'} pour le logement situé ${gaAdresse(m)}.`,
      `Conformément à l’article 2303 du Code civil, nous vous informons que le loyer et les charges exigibles le ${gaFr(p.due_date)}, d’un montant de ${gaEur(gaReste(p))}, n’ont pas été réglés à ce jour.`,
      'Nous vous invitons à vous rapprocher de votre proche pour qu’il régularise sa situation. À défaut de régularisation, nous serons amenés à vous demander le règlement des sommes dues dans les limites de votre engagement.',
      'Veuillez agréer, Madame, Monsieur, nos salutations distinguées.']});
}
async function gaInfoGarant(id){
  const{p,m,t}=gaPayCtx(id);gaLettreGarant(id);
  if(t?.garant_email)await gaMail(t.garant_email,`Information de la caution — loyer impayé de ${t.nom}`,'Information de la caution',
    `<p>Madame, Monsieur,</p><p>Vous vous êtes porté(e) caution de <strong>${gaE(t.nom)}</strong> pour le logement ${gaE(gaAdresse(m))}. Conformément à l’article 2303 du Code civil, nous vous informons que le loyer exigible le <strong>${gaFr(p.due_date)}</strong> (${gaEur(gaReste(p))}) n’a pas été réglé.</p><p>Un courrier recommandé suit.</p>`);
  if(await gaMarkPay(id,'garant_informe_at')){toast('Garant informé (e-mail si disponible + lettre à envoyer en recommandé)');gaRender();}
}
async function gaDeclareGarantie(id,kind){
  const{m}=gaPayCtx(id);
  if(kind==='visale')window.open('https://www.visale.fr','_blank');
  const lbl=kind==='visale'?'Visale':'l’assurance loyers impayés'+(m?.gli_assureur?' ('+m.gli_assureur+')':'');
  if(!confirm(`Confirmez-vous avoir déclaré l’impayé auprès de ${lbl} ? Pièces habituelles : bail, décompte des sommes dues, relances et mise en demeure.`))return;
  if(await gaMarkPay(id,'gli_declare_at')){toast('Déclaration enregistrée');gaRender();}
}
async function gaCommandement(id){
  const{p,m,t}=gaPayCtx(id);
  const tot=gaPays(m).filter(gaUnpaid).filter(x=>x.due_date<=gaToday()).reduce((s,x)=>s+gaReste(x),0);
  gaDoc({dest:['Commissaire de justice',''],objet:`Demande de commandement de payer — ${t?.nom||''}`,fichier:'demande-commandement',
    avant:['Maître,',`En notre qualité de mandataire de ${m.owner_name||'le bailleur'}, nous vous confions la délivrance d’un commandement de payer visant la clause résolutoire du bail à l’encontre de ${t?.nom||'notre locataire'}, occupant le logement situé ${gaAdresse(m)}${t?.debut?', bail du '+gaFr(t.debut):''}.`,
      `Montant des sommes dues à ce jour : ${gaEur(tot)} (décompte ci-joint). Une mise en demeure a été adressée le ${gaFr(p.mise_en_demeure_at)}.`+(t?.garant_nom?` Le commandement devra être dénoncé à la caution, ${t.garant_nom}.`:''),
      'Vous trouverez ci-joints : le bail, le décompte, les relances et la mise en demeure avec son accusé de réception.','Nous vous prions d’agréer, Maître, nos salutations distinguées.']});
  if(await gaMarkPay(id,'commandement_at')){toast('Demande générée. Le locataire disposera de 6 semaines après le commandement.');gaRender();}
}
async function gaInfoProprioImpaye(mid){
  const m=gaMandat(mid);const t=gaTen(m);const ps=gaPays(m).filter(p=>gaUnpaid(p)&&gaDays(p.due_date,gaToday())>0);const tot=ps.reduce((s,p)=>s+gaReste(p),0);
  const html=`<p>Bonjour ${gaE(m.owner_name||'')},</p><p>Nous vous informons d’un retard de paiement pour <strong>${gaE(gaBien(m))}</strong> : <strong>${gaEur(tot)}</strong> (${ps.length} échéance${ps.length>1?'s':''}) restent dus par ${gaE(t?.nom||'le locataire')}.</p>
    <p>Démarches en cours : ${ps.some(p=>p.mise_en_demeure_at)?'mise en demeure envoyée':ps.some(p=>p.relance_at)?'relances envoyées':'premier rappel en préparation'}${ps.some(p=>p.gli_declare_at)?', déclaration à la garantie effectuée':''}. Nous vous tiendrons informé(e).</p>`;
  const ok=await gaMail(m.owner_email,`Retard de loyer — ${gaBien(m)}`,'Information sur un retard de loyer',html);
  if(m.owner_clerk_id)await gaMsg(m.owner_clerk_id,m.listing_id,`Retard de loyer pour ${gaBien(m)} : ${gaEur(tot)} dus par ${t?.nom||'le locataire'}. Procédure de recouvrement en cours.`);
  toast(ok||m.owner_clerk_id?'Propriétaire informé':'Adresse e-mail du propriétaire manquante');
}
function gaApurement(mid){
  const m=gaMandat(mid);const t=gaTen(m);const ps=gaPays(m).filter(p=>gaUnpaid(p)&&gaDays(p.due_date,gaToday())>0);const tot=gaR(ps.reduce((s,p)=>s+gaReste(p),0));
  gaModal(`<div style="font-size:1rem;font-weight:700;margin-bottom:.4rem"><i data-lucide=calendar-range class=ic></i> Plan d’apurement — ${gaE(t?.nom||'')}</div>
  <div style="font-size:.78rem;color:var(--td);margin-bottom:.8rem">Dette actuelle : <strong>${gaEur(tot)}</strong>. Le locataire paie son loyer courant + une mensualité supplémentaire.</div>
  <div class="fgrid2"><div class="fg"><label class="fl">Nombre de mensualités</label><input class="fi" id="ga-ap-n" type="number" value="${Math.min(12,Math.max(2,Math.ceil(tot/150)))}" oninput="document.getElementById('ga-ap-mt').textContent=(${tot}/Math.max(1,+this.value||1)).toFixed(2)+' €'"></div>
  <div class="fg"><label class="fl">Première mensualité le</label><input class="fi" id="ga-ap-d" type="date" value="${gaAddM(gaToday(),1)}"></div></div>
  <div style="font-size:.85rem;margin:.6rem 0">Mensualité : <strong id="ga-ap-mt">${(tot/Math.min(12,Math.max(2,Math.ceil(tot/150)))).toFixed(2)} €</strong></div>
  <div style="display:flex;justify-content:flex-end;gap:.5rem"><button class="btn bg" onclick="gaCloseModal()">Annuler</button><button class="btn bp" onclick="gaApurementPdf('${mid}',${tot})">Générer le protocole</button></div>`);
}
function gaApurementPdf(mid,tot){
  const m=gaMandat(mid);const t=gaTen(m);const n=Math.max(1,gaN('ga-ap-n')||1);const d0=gaV('ga-ap-d')||gaAddM(gaToday(),1);const mt=gaR(tot/n);
  const rows=[...Array(n)].map((_,k)=>[`Mensualité ${k+1}`,gaFrC(gaAddM(d0,k)),gaEur(k===n-1?gaR(tot-mt*(n-1)):mt)]);
  gaCloseModal();
  gaDoc({titre:'Protocole d’accord — plan d’apurement',dest:[t?.nom||'',gaAdresse(m)],fichier:'plan-apurement',
    avant:[`Entre ${m.owner_name||'le bailleur'}, représenté par ${gaAgence().nom}, mandataire, et ${t?.nom||'le locataire'}, occupant le logement situé ${gaAdresse(m)}.`,
      `Le locataire reconnaît devoir la somme de ${gaEur(tot)} au titre des loyers et charges impayés à ce jour. Il s’engage à la régler selon l’échéancier ci-dessous, en plus du loyer et des charges courants :`],
    table:{head:['Échéance','Date','Montant'],widths:[74,50,50],align:['l','l','r'],rows,foot:[['Total','',gaEur(tot)]]},
    apres:['Le non-respect d’une seule échéance du présent plan ou du loyer courant rendra immédiatement exigible la totalité du solde restant dû, et le bailleur pourra reprendre la procédure de recouvrement.',
      'Fait en deux exemplaires.','Le locataire (« lu et approuvé ») :                                     Pour le bailleur :'],signature:' ',signataire:' '});
}

// ════════════════════ Reversements & comptes rendus de gestion ════════════════════
function gaRenderRev(){
  const ym=GA.mois;const from=ym+'-01',to=gaAddM(from,1);
  const owners=gaOwners();
  const tot=owners.reduce((s,o)=>s+Math.max(0,gaSolde(o.key)),0);
  return`<div style="display:flex;gap:.5rem;align-items:center;flex-wrap:wrap;margin-bottom:1rem">
    <button class="btn bg bsm" onclick="gaMois(-1)">‹</button><strong style="min-width:130px;text-align:center;text-transform:capitalize">${gaMoisLbl(ym)}</strong><button class="btn bg bsm" onclick="gaMois(1)">›</button>
    <span style="flex:1"></span>
    <button class="btn bg bsm" onclick="gaVirementsCsv()"><i data-lucide=download class=ic></i> Fichier des virements (${gaEur(tot)})</button>
  </div>
  ${owners.length?owners.map(o=>{const c=gaCompte(o.key,from,to);const sd=gaSolde(o.key,from);const sf=gaSolde(o.key);const crg=GA.crg.find(x=>x.owner_key===o.key&&x.periode===ym);
    return`<div class="card" style="margin-bottom:.85rem"><div class="cb">
      <div style="display:flex;justify-content:space-between;gap:.6rem;flex-wrap:wrap;margin-bottom:.6rem">
        <div><div style="font-weight:700">${gaE(o.name)}</div><div style="font-size:.72rem;color:var(--td)">${o.ms.length} bien${o.ms.length>1?'s':''} · ${gaE(o.iban||'IBAN manquant')}</div></div>
        <div style="text-align:right"><div style="font-size:.66rem;color:var(--td);text-transform:uppercase">Solde à reverser</div><div style="font-size:1.15rem;font-weight:700;color:${sf>0?'var(--green)':sf<0?'var(--red)':'var(--txt)'}">${gaEur(sf)}</div></div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:.4rem;font-size:.74rem;margin-bottom:.6rem">
        <div style="background:var(--s2);border-radius:8px;padding:.45rem .6rem">Report<br><strong>${gaEur(sd)}</strong></div>
        <div style="background:var(--s2);border-radius:8px;padding:.45rem .6rem">Loyers encaissés<br><strong>${gaEur(c.enc)}</strong></div>
        <div style="background:var(--s2);border-radius:8px;padding:.45rem .6rem">Honoraires + frais<br><strong>− ${gaEur(c.hon+c.frais)}</strong></div>
        ${c.gli?`<div style="background:var(--s2);border-radius:8px;padding:.45rem .6rem">GLI<br><strong>− ${gaEur(c.gli)}</strong></div>`:''}
        <div style="background:var(--s2);border-radius:8px;padding:.45rem .6rem">Travaux / divers<br><strong>${gaEur(c.ops)}</strong></div>
        <div style="background:var(--s2);border-radius:8px;padding:.45rem .6rem">Reversé<br><strong>− ${gaEur(c.rev)}</strong></div>
      </div>
      <div style="display:flex;gap:.35rem;flex-wrap:wrap">
        <button class="btn bp bsm" onclick="gaReverser('${gaQ(o.key)}')" ${sf>0.009?'':'disabled'}><i data-lucide=send class=ic></i> Reverser</button>
        <button class="btn bg bsm" onclick="gaCrgPdf('${gaQ(o.key)}','${ym}')"><i data-lucide=file-text class=ic></i> CRG PDF</button>
        <button class="btn bg bsm" onclick="gaEnvoyerCrg('${gaQ(o.key)}','${ym}')"><i data-lucide=mail class=ic></i> ${crg?.envoye_at?'Renvoyer':'Envoyer'} le CRG</button>
        <button class="btn bg bsm" onclick="gaOpModal('${o.ms[0].id}')"><i data-lucide=plus class=ic></i> Écriture</button>
        ${crg?.envoye_at?`<span style="font-size:.7rem;color:var(--td);align-self:center">CRG envoyé le ${gaFrC(crg.envoye_at)}</span>`:''}
      </div>
      ${c.lignes.length?`<details style="margin-top:.6rem"><summary style="font-size:.74rem;cursor:pointer;color:var(--td)">Détail des ${c.lignes.length} écritures du mois</summary>
        <div style="overflow-x:auto"><table class="tbl" style="margin-top:.4rem"><thead><tr><th>Date</th><th>Bien</th><th>Libellé</th><th style="text-align:right">Crédit</th><th style="text-align:right">Débit</th></tr></thead><tbody>
        ${c.lignes.map(l=>`<tr><td style="font-size:.74rem">${gaFrC(l.date)}</td><td style="font-size:.74rem">${gaE(l.bien)}</td><td style="font-size:.74rem">${gaE(l.lib)}</td><td style="text-align:right;font-size:.74rem">${l.cr?gaEur(l.cr):''}</td><td style="text-align:right;font-size:.74rem">${l.db?gaEur(l.db):''}</td></tr>`).join('')}
        </tbody></table></div></details>`:''}
    </div></div>`;}).join(''):gaEmpty('send','Aucun propriétaire. Créez un mandat pour commencer.')}`;
}
function gaReverser(key){
  const o=gaOwners().find(x=>x.key===key);if(!o)return;const s=gaSolde(key);
  gaModal(`<div style="font-size:1rem;font-weight:700;margin-bottom:.5rem"><i data-lucide=send class=ic></i> Reversement à ${gaE(o.name)}</div>
  <div style="font-size:.78rem;color:var(--td);margin-bottom:.8rem">${o.iban?'IBAN : <strong>'+gaE(o.iban)+'</strong>':'IBAN manquant — complétez le mandat.'}</div>
  <div class="fgrid2"><div class="fg"><label class="fl">Montant viré (€)</label><input class="fi" id="gr-mt" type="number" step="0.01" value="${gaR(s)}"></div>
  <div class="fg"><label class="fl">Date du virement</label><input class="fi" id="gr-dt" type="date" value="${gaToday()}"></div></div>
  <label style="display:flex;gap:.5rem;font-size:.8rem;margin-top:.6rem"><input type="checkbox" id="gr-crg" checked> Envoyer le compte rendu de gestion du mois avec le reversement</label>
  <div style="display:flex;justify-content:flex-end;gap:.5rem;margin-top:1rem"><button class="btn bg" onclick="gaCloseModal()">Annuler</button><button class="btn bp" onclick="gaSaveRev('${gaQ(key)}')">Enregistrer le reversement</button></div>`);
}
async function gaSaveRev(key){
  const o=gaOwners().find(x=>x.key===key);const mt=gaN('gr-mt');const dt=gaV('gr-dt')||gaToday();const crg=gaC('gr-crg');
  if(!mt||mt<=0){toast('Montant invalide');return;}
  const{data,error}=await sb.from('gestion_operations').insert({agency_id:U.id,mandat_id:o.ms[0].id,date:dt,type:'reversement',libelle:`Reversement au propriétaire${o.iban?' — '+o.iban:''}`,montant:-mt}).select().single();
  if(error){toast(error.message);return;}
  GA.ops.push(data);gaCloseModal();toast('<i data-lucide=check-circle-2 class=ic></i> Reversement enregistré');
  if(crg)await gaEnvoyerCrg(key,dt.slice(0,7),true);
  gaRender();
}
function gaVirementsCsv(){
  const rows=gaOwners().map(o=>[o.name,o.iban||'',gaR(Math.max(0,gaSolde(o.key))).toFixed(2).replace('.',','),`Gestion ${gaMoisLbl(GA.mois)} - ${gaAgence().nom}`]).filter(r=>r[2]!=='0,00');
  if(!rows.length){toast('Aucun montant à reverser');return;}
  gaCsv('virements-proprietaires-'+GA.mois,['Bénéficiaire','IBAN','Montant','Libellé'],rows);
}
function gaOpModal(mid){
  gaModal(`<div style="font-size:1rem;font-weight:700;margin-bottom:.6rem"><i data-lucide=plus class=ic></i> Écriture sur le compte propriétaire</div>
  <div class="fgrid2">
    <div class="fg" style="grid-column:1/-1"><label class="fl">Bien</label><select class="fsel" id="go-m">${GA.mandats.map(m=>`<option value="${m.id}" ${m.id===mid?'selected':''}>${gaE(gaBien(m)+' — '+(m.owner_name||''))}</option>`).join('')}</select></div>
    <div class="fg"><label class="fl">Type</label><select class="fsel" id="go-t"><option value="travaux">Travaux / facture payée pour le propriétaire</option><option value="frais">Frais (courrier, commissaire de justice…)</option><option value="assurance">Assurance (PNO…)</option><option value="teom">TEOM refacturée au locataire</option><option value="regul_charges">Régularisation de charges</option><option value="divers">Divers</option></select></div>
    <div class="fg"><label class="fl">Sens</label><select class="fsel" id="go-s"><option value="-1">Débit (à la charge du propriétaire)</option><option value="1">Crédit (en faveur du propriétaire)</option></select></div>
    <div class="fg"><label class="fl">Montant (€)</label><input class="fi" id="go-mt" type="number" step="0.01"></div>
    <div class="fg"><label class="fl">Date</label><input class="fi" id="go-d" type="date" value="${gaToday()}"></div>
    <div class="fg" style="grid-column:1/-1"><label class="fl">Libellé</label><input class="fi" id="go-l" placeholder="Facture plombier n° 1234"></div>
  </div>
  <div style="display:flex;justify-content:flex-end;gap:.5rem;margin-top:1rem"><button class="btn bg" onclick="gaCloseModal()">Annuler</button><button class="btn bp" onclick="gaSaveOp()">Enregistrer</button></div>`);
}
async function gaSaveOp(){
  const mt=gaN('go-mt');if(!mt){toast('Montant requis');return;}
  const row={agency_id:U.id,mandat_id:gaV('go-m'),type:gaV('go-t'),date:gaV('go-d')||gaToday(),libelle:gaV('go-l')||gaV('go-t'),montant:gaR(Math.abs(mt)*Number(gaV('go-s')))};
  const{data,error}=await sb.from('gestion_operations').insert(row).select().single();if(error){toast(error.message);return;}
  GA.ops.push(data);gaCloseModal();toast('Écriture enregistrée');gaRender();
}
function gaCrgData(key,ym){
  const o=gaOwners().find(x=>x.key===key);const from=ym+'-01',to=gaAddM(from,1);
  return{o,c:gaCompte(key,from,to),sd:gaSolde(key,from),sf:gaSolde(key,to)};
}
function gaCrgPdf(key,ym,retour){
  const{o,c,sd,sf}=gaCrgData(key,ym);if(!o)return;
  const rows=c.lignes.map(l=>[gaFrC(l.date),l.bien,l.lib,l.cr?gaEur(l.cr):'',l.db?gaEur(l.db):'']);
  const situ=o.ms.map(m=>{const t=gaTen(m);const imp=gaPays(m).filter(p=>gaUnpaid(p)&&gaDays(p.due_date,gaToday())>0).reduce((s,p)=>s+gaReste(p),0);
    return`${gaBien(m)} : ${t?`loué à ${t.nom} (${gaEur(t.hc+t.ch)}/mois)`:'vacant'}${imp?` — impayé ${gaEur(imp)}`:''}`;});
  gaDoc({titre:`Compte rendu de gestion — ${gaMoisLbl(ym)}`,dest:[o.name,o.address],fichier:`CRG-${ym}-${o.name.replace(/\W+/g,'-')}`,retour,
    avant:[`Solde reporté au 1er ${gaMoisLbl(ym)} : ${gaEur(sd)}`],
    table:{head:['Date','Bien','Libellé','Crédit','Débit'],widths:[22,38,72,21,21],align:['l','l','l','r','r'],rows:rows.length?rows:[['','','Aucun mouvement sur la période','','']],
      foot:[['','','Total du mois',gaEur(c.lignes.reduce((s,l)=>s+l.cr,0)),gaEur(c.lignes.reduce((s,l)=>s+l.db,0))],['','','Solde en votre faveur en fin de période','',gaEur(sf)]]},
    apres:['**Situation de vos biens**',...situ,`Honoraires de gestion du mois : ${gaEur(c.hon+c.frais)} TTC${c.gli?` — assurance loyers impayés : ${gaEur(c.gli)}`:''}.`]});
}
async function gaEnvoyerCrg(key,ym,silent){
  const{o,c,sd,sf}=gaCrgData(key,ym);if(!o)return;
  const html=`<p>Bonjour ${gaE(o.name)},</p><p>Voici votre compte rendu de gestion pour <strong>${gaMoisLbl(ym)}</strong>.</p>
    <table style="border-collapse:collapse;font-size:14px;min-width:320px">
    <tr><td style="padding:3px 14px 3px 0">Solde reporté</td><td style="text-align:right">${gaEur(sd)}</td></tr>
    <tr><td style="padding:3px 14px 3px 0">Loyers encaissés</td><td style="text-align:right">${gaEur(c.enc)}</td></tr>
    <tr><td style="padding:3px 14px 3px 0">Honoraires de gestion et frais</td><td style="text-align:right">− ${gaEur(c.hon+c.frais)}</td></tr>
    ${c.gli?`<tr><td style="padding:3px 14px 3px 0">Assurance loyers impayés</td><td style="text-align:right">− ${gaEur(c.gli)}</td></tr>`:''}
    ${c.ops?`<tr><td style="padding:3px 14px 3px 0">Travaux et opérations diverses</td><td style="text-align:right">${gaEur(c.ops)}</td></tr>`:''}
    ${c.rev?`<tr><td style="padding:3px 14px 3px 0">Reversé</td><td style="text-align:right">− ${gaEur(c.rev)}</td></tr>`:''}
    <tr><td style="padding:6px 14px 3px 0"><strong>Solde en votre faveur</strong></td><td style="text-align:right"><strong>${gaEur(sf)}</strong></td></tr></table>
    <ul style="font-size:13px">${o.ms.map(m=>{const t=gaTen(m);return`<li>${gaE(gaBien(m))} : ${t?'loué — '+gaE(t.nom):'vacant'}</li>`;}).join('')}</ul>
    <p style="font-size:13px">Le détail ligne par ligne est disponible sur simple demande.</p>`;
  const ok=await gaMail(o.email,`Compte rendu de gestion — ${gaMoisLbl(ym)}`,`Compte rendu de gestion — ${gaMoisLbl(ym)}`,html);
  if(o.clerk)await gaMsg(o.clerk,o.ms[0].listing_id,`Compte rendu de gestion ${gaMoisLbl(ym)} : ${gaEur(c.enc)} encaissés, solde en votre faveur ${gaEur(sf)}.`);
  const row={agency_id:U.id,owner_key:key,periode:ym,detail:{enc:c.enc,hon:c.hon,frais:c.frais,gli:c.gli,ops:c.ops,rev:c.rev,sd,sf},net:sf,envoye_at:new Date().toISOString()};
  const{data}=await sb.from('gestion_crg').upsert(row,{onConflict:'agency_id,owner_key,periode'}).select().single();
  if(data){GA.crg=GA.crg.filter(x=>!(x.owner_key===key&&x.periode===ym));GA.crg.push(data);}
  if(!silent){toast(ok||o.clerk?'<i data-lucide=send class=ic></i> CRG envoyé':'CRG enregistré — e-mail du propriétaire manquant');gaRender();}
}

// ════════════════════ Fiscalité des propriétaires ════════════════════
function gaAnnee(d){GA.annee+=d;gaRender();}
function gaFiscal(o,an){
  const c=gaCompte(o.key,`${an}-01-01`,`${an+1}-01-01`);
  let hc=0,ch=0;
  for(const m of o.ms){const t=gaTen(m);for(const p of gaPays(m)){const v=gaPaid(p);if(!v||!String(p.paid_at||'').startsWith(String(an)))continue;const tot=(t?.hc||0)+(t?.ch||0);const part=tot?v*t.hc/tot:v;hc+=part;ch+=v-part;}}
  const travaux=-GA.ops.filter(x=>o.ms.some(m=>m.id===x.mandat_id)&&x.type==='travaux'&&String(x.date).startsWith(String(an))).reduce((s,x)=>s+(+x.montant||0),0);
  const assur=-GA.ops.filter(x=>o.ms.some(m=>m.id===x.mandat_id)&&x.type==='assurance'&&String(x.date).startsWith(String(an))).reduce((s,x)=>s+(+x.montant||0),0);
  const meuble=o.ms.some(m=>gaTen(m)?.meuble??m.bien_meuble!==false);
  const R=meuble?GA_FISC.micro_bic:GA_FISC.micro_foncier;const brut=meuble?hc+ch:hc;
  const reel=brut-c.hon-c.frais-c.gli-travaux-assur;
  return{c,hc:gaR(hc),ch:gaR(ch),travaux:gaR(travaux),assur:gaR(assur),meuble,R,brut:gaR(brut),micro:brut<=R.plafond?gaR(brut*(1-R.abatt)):null,reel:gaR(reel)};
}
function gaRenderFiscal(){
  const an=GA.annee;const owners=gaOwners();
  return`<div style="display:flex;gap:.5rem;align-items:center;flex-wrap:wrap;margin-bottom:1rem">
    <button class="btn bg bsm" onclick="gaAnnee(-1)">‹</button><strong style="min-width:110px;text-align:center">Revenus ${an}</strong><button class="btn bg bsm" onclick="gaAnnee(1)">›</button>
    <span style="flex:1"></span><button class="btn bg bsm" onclick="gaFiscalCsv()"><i data-lucide=download class=ic></i> Export comptable (CSV)</button></div>
  <div class="card" style="margin-bottom:1rem"><div class="cb" style="font-size:.75rem;color:var(--td);line-height:1.55">Récapitulatif annuel à remettre à chaque propriétaire pour sa déclaration de revenus (location vide : 2044 ou micro-foncier ; meublée : LMNP micro-BIC ou réel). Les montants sont ceux encaissés et payés par l’agence ; les autres charges (taxe foncière, intérêts d’emprunt…) sont à ajouter par le propriétaire.</div></div>
  ${owners.map(o=>{const f=gaFiscal(o,an);return`<div class="card" style="margin-bottom:.8rem"><div class="cb">
    <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:.5rem;margin-bottom:.5rem"><div style="font-weight:700">${gaE(o.name)} <span style="font-size:.72rem;color:var(--td);font-weight:400">${f.meuble?'Location meublée (LMNP)':'Location vide (revenus fonciers)'}</span></div>
    <div style="display:flex;gap:.3rem"><button class="btn bg bsm" onclick="gaFiscalPdf('${gaQ(o.key)}')"><i data-lucide=file-text class=ic></i> Récapitulatif PDF</button><button class="btn bg bsm" onclick="gaFiscalMail('${gaQ(o.key)}')"><i data-lucide=mail class=ic></i> Envoyer</button></div></div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:.4rem;font-size:.74rem">
      <div style="background:var(--s2);border-radius:8px;padding:.45rem .6rem">Loyers HC<br><strong>${gaEur(f.hc)}</strong></div>
      <div style="background:var(--s2);border-radius:8px;padding:.45rem .6rem">Charges encaissées<br><strong>${gaEur(f.ch)}</strong></div>
      <div style="background:var(--s2);border-radius:8px;padding:.45rem .6rem">Honoraires & frais<br><strong>${gaEur(f.c.hon+f.c.frais)}</strong></div>
      <div style="background:var(--s2);border-radius:8px;padding:.45rem .6rem">GLI / assurances<br><strong>${gaEur(f.c.gli+f.assur)}</strong></div>
      <div style="background:var(--s2);border-radius:8px;padding:.45rem .6rem">Travaux payés<br><strong>${gaEur(f.travaux)}</strong></div>
      <div style="background:var(--s2);border-radius:8px;padding:.45rem .6rem">${f.micro!=null?`Régime micro (${Math.round(f.R.abatt*100)} %)<br><strong>${gaEur(f.micro)}</strong> imposable`:`Au-delà du plafond micro<br><strong>régime réel</strong>`}</div>
    </div></div></div>`;}).join('')||gaEmpty('landmark','Aucun propriétaire.')}`;
}
function gaFiscalPdf(key){
  const o=gaOwners().find(x=>x.key===key);const an=GA.annee;const f=gaFiscal(o,an);
  gaDoc({titre:`Récapitulatif annuel de gestion — revenus ${an}`,dest:[o.name,o.address],fichier:`recap-fiscal-${an}-${o.name.replace(/\W+/g,'-')}`,
    avant:[`Biens gérés : ${o.ms.map(m=>gaBien(m)+' ('+gaAdresse(m)+')').join(' ; ')}.`,`Nature : ${f.meuble?'location meublée non professionnelle (BIC)':'location nue (revenus fonciers)'}.`],
    table:{head:['Rubrique','Montant'],widths:[124,50],align:['l','r'],rows:[
      ['Loyers bruts encaissés (hors charges)',gaEur(f.hc)],['Provisions sur charges encaissées',gaEur(f.ch)],
      ['Honoraires de gestion et frais d’agence',gaEur(f.c.hon+f.c.frais)],['Assurance loyers impayés',gaEur(f.c.gli)],['Autres assurances payées',gaEur(f.assur)],['Travaux et réparations payés',gaEur(f.travaux)],
      ['Reversé au propriétaire sur l’année',gaEur(f.c.rev)]]},
    apres:[f.micro!=null?`Régime micro possible (recettes ≤ ${gaEur(f.R.plafond)}) : revenu imposable après abattement de ${Math.round(f.R.abatt*100)} % = ${gaEur(f.micro)} — case ${f.R.case}.`:`Recettes supérieures au plafond du régime micro (${gaEur(f.R.plafond)}) : régime réel obligatoire.`,
      `Au régime réel, résultat avant autres charges (taxe foncière, intérêts, amortissements…) : ${gaEur(f.reel)}.`,
      'Document d’information établi à partir des opérations enregistrées par l’agence ; il ne remplace pas les conseils d’un expert-comptable.']});
}
async function gaFiscalMail(key){
  const o=gaOwners().find(x=>x.key===key);const an=GA.annee;const f=gaFiscal(o,an);
  const ok=await gaMail(o.email,`Récapitulatif de gestion ${an} pour votre déclaration de revenus`,`Récapitulatif annuel ${an}`,
    `<p>Bonjour ${gaE(o.name)},</p><p>Pour votre déclaration de revenus ${an} :</p><ul><li>Loyers encaissés (HC) : <strong>${gaEur(f.hc)}</strong></li><li>Charges encaissées : ${gaEur(f.ch)}</li><li>Honoraires et frais de gestion : ${gaEur(f.c.hon+f.c.frais)}</li><li>Assurance loyers impayés : ${gaEur(f.c.gli)}</li><li>Travaux payés : ${gaEur(f.travaux)}</li></ul>
    <p>${f.micro!=null?`Au régime micro (${f.meuble?'micro-BIC':'micro-foncier'}), revenu imposable estimé : <strong>${gaEur(f.micro)}</strong> (case ${f.R.case}).`:'Vos recettes dépassent le plafond du régime micro : régime réel.'}</p><p style="font-size:12px;color:#666">Document d’information, à vérifier avec votre conseiller.</p>`);
  toast(ok?'Récapitulatif envoyé':'E-mail du propriétaire manquant');
}
function gaFiscalCsv(){
  const an=GA.annee;const rows=[];
  for(const o of gaOwners()){const c=gaCompte(o.key,`${an}-01-01`,`${an+1}-01-01`);c.lignes.forEach(l=>rows.push([l.date,o.name,l.bien,l.lib,String(l.cr||'').replace('.',','),String(l.db||'').replace('.',',')]));}
  gaCsv('ecritures-gestion-'+an,['Date','Propriétaire','Bien','Libellé','Crédit','Débit'],rows);
}

// ════════════════════ Interventions & travaux ════════════════════
const GA_IST={signale:['Signalée','b-dim'],devis:['Devis reçu','b-sea'],accord_demande:['Accord demandé','b-gold'],accord:['Accord reçu','b-green'],planifie:['Planifiée','b-sea'],termine:['Terminée — à facturer','b-gold'],facture:['Facturée','b-green'],annule:['Annulée','b-dim']};
function gaRenderInter(){
  const open=GA.inter.filter(i=>!['facture','annule'].includes(i.statut)).sort((a,b)=>(a.urgence==='urgente'?-1:0)-(b.urgence==='urgente'?-1:0));
  const done=GA.inter.filter(i=>['facture','annule'].includes(i.statut)).slice(-15).reverse();
  const tk=new Set(GA.inter.map(i=>i.ticket_id).filter(Boolean));
  const tickets=GA.tickets.filter(x=>!tk.has(x.id)&&!['resolved','closed'].includes(x.status||x.statut));
  const card=i=>{const m=gaMandat(i.mandat_id);const[l,c]=GA_IST[i.statut]||[i.statut,'b-dim'];return`<div class="card" style="margin-bottom:.6rem"><div class="cb" style="display:flex;justify-content:space-between;gap:.6rem;flex-wrap:wrap">
    <div style="min-width:0"><div style="font-weight:600;font-size:.88rem">${i.urgence==='urgente'?'<span style="color:var(--red)">● </span>':''}${gaE(i.titre)}</div>
    <div style="font-size:.72rem;color:var(--td)">${gaE(m?gaBien(m):'')} · ${gaBadge(l,c)} ${i.prestataire_nom?' · '+gaE(i.prestataire_nom):''}${i.devis_montant?' · devis '+gaEur(i.devis_montant):''}${i.montant_final?' · facture '+gaEur(i.montant_final):''}${i.date_intervention?' · le '+gaFrC(i.date_intervention):''}</div></div>
    <button class="btn bg bsm" onclick="gaEditInter('${i.id}')">Ouvrir</button></div></div>`;};
  return`<div style="display:flex;gap:.5rem;flex-wrap:wrap;margin-bottom:1rem"><button class="btn bp bsm" onclick="gaNewInter()"><i data-lucide=plus class=ic></i> Nouvelle intervention</button></div>
  ${tickets.length?`<div class="card" style="margin-bottom:1rem"><div class="ch"><div class="ct"><i data-lucide=message-square-warning class=ic></i> Signalements des locataires (${tickets.length})</div></div><div class="cb">
    ${tickets.map(k=>`<div style="display:flex;justify-content:space-between;gap:.5rem;padding:.4rem 0;border-bottom:1px solid var(--b)"><div style="font-size:.8rem"><strong>${gaE(k.title||'Problème')}</strong><div style="font-size:.72rem;color:var(--td)">${gaE(gaListing(k.listing_id)?.title||'')} · ${gaFrC(k.created_at)} · ${gaE(String(k.description||'').slice(0,120))}</div></div><button class="btn bp bsm" onclick="gaInterFromTicket('${k.id}')">Traiter</button></div>`).join('')}
  </div></div>`:''}
  <div style="font-size:.78rem;font-weight:700;color:var(--td);text-transform:uppercase;letter-spacing:.04em;margin-bottom:.5rem">En cours (${open.length})</div>
  ${open.length?open.map(card).join(''):gaEmpty('wrench','Aucune intervention en cours.')}
  ${done.length?`<div style="font-size:.78rem;font-weight:700;color:var(--td);text-transform:uppercase;letter-spacing:.04em;margin:1rem 0 .5rem">Terminées</div>${done.map(card).join('')}`:''}
  <div style="font-size:.72rem;color:var(--td);margin-top:.8rem;line-height:1.5">Rappel : les réparations locatives et l’entretien courant sont à la charge du locataire (décret n° 87-712) ; les grosses réparations, la vétusté et les équipements défaillants restent à la charge du propriétaire.</div>`;
}
function gaInterFromTicket(tid){
  const k=GA.tickets.find(x=>x.id===tid);const m=GA.mandats.find(x=>x.listing_id===k?.listing_id);
  gaNewInter(m?.id,k?.title,{ticket_id:tid,description:k?.description||'',urgence:['urgent','high'].includes(k?.priority)?'urgente':'normale',listing_id:k?.listing_id});
}
function gaNewInter(mid,titre,pre){gaEditInter(null,{mandat_id:mid||GA.mandats[0]?.id,titre:titre||'',statut:'signale',urgence:'normale',imputation:'proprietaire',...(pre||{})});}
function gaEditInter(id,pre){
  const i=id?GA.inter.find(x=>x.id===id):pre;const m=gaMandat(i.mandat_id);
  const hist=(i.historique||[]).slice().reverse();
  gaModal(`<div style="font-size:1rem;font-weight:700;margin-bottom:.7rem"><i data-lucide=wrench class=ic></i> ${id?'Intervention':'Nouvelle intervention'}</div>
  <div class="fgrid2">
    <div class="fg" style="grid-column:1/-1"><label class="fl">Bien</label><select class="fsel" id="gi-m">${GA.mandats.map(x=>`<option value="${x.id}" ${x.id===i.mandat_id?'selected':''}>${gaE(gaBien(x)+' — '+(x.owner_name||''))}</option>`).join('')}</select></div>
    <div class="fg" style="grid-column:1/-1"><label class="fl">Objet</label><input class="fi" id="gi-t" value="${gaE(i.titre||'')}" placeholder="Fuite sous l’évier"></div>
    <div class="fg" style="grid-column:1/-1"><label class="fl">Description</label><textarea class="fi" id="gi-d" rows="2">${gaE(i.description||'')}</textarea></div>
    <div class="fg"><label class="fl">Urgence</label><select class="fsel" id="gi-u">${['urgente','normale','faible'].map(u=>`<option ${i.urgence===u?'selected':''}>${u}</option>`).join('')}</select></div>
    <div class="fg"><label class="fl">Statut</label><select class="fsel" id="gi-s">${Object.entries(GA_IST).map(([k,[l]])=>`<option value="${k}" ${i.statut===k?'selected':''}>${l}</option>`).join('')}</select></div>
    <div class="fg"><label class="fl">Prestataire</label><input class="fi" id="gi-pn" value="${gaE(i.prestataire_nom||'')}"></div>
    <div class="fg"><label class="fl">Contact prestataire</label><input class="fi" id="gi-pc" value="${gaE(i.prestataire_contact||'')}"></div>
    <div class="fg"><label class="fl">Devis (€ TTC)</label><input class="fi" id="gi-dv" type="number" step="0.01" value="${i.devis_montant??''}"></div>
    <div class="fg"><label class="fl">Date d’intervention</label><input class="fi" id="gi-di" type="date" value="${i.date_intervention||''}"></div>
    <div class="fg"><label class="fl">Montant facturé (€ TTC)</label><input class="fi" id="gi-mf" type="number" step="0.01" value="${i.montant_final??''}"></div>
    <div class="fg"><label class="fl">À la charge de</label><select class="fsel" id="gi-im"><option value="proprietaire" ${i.imputation!=='locataire'&&i.imputation!=='agence'?'selected':''}>Propriétaire (déduit du reversement)</option><option value="locataire" ${i.imputation==='locataire'?'selected':''}>Locataire (réparation locative)</option><option value="agence" ${i.imputation==='agence'?'selected':''}>Agence / assurance</option></select></div>
  </div>
  ${m&&Number(i.devis_montant)>Number(m.seuil_travaux||0)&&!i.accord_at?`<div style="font-size:.75rem;color:var(--gold);margin-top:.6rem"><i data-lucide=hand class=ic></i> Devis au-dessus du seuil du mandat (${gaEur(m.seuil_travaux)}) : l’accord du propriétaire est nécessaire.</div>`:''}
  ${hist.length?`<details style="margin-top:.6rem"><summary style="font-size:.74rem;color:var(--td);cursor:pointer">Historique</summary>${hist.map(h=>`<div style="font-size:.72rem;color:var(--td);padding:.15rem 0">${gaFrC(h.d)} — ${gaE(h.t)}</div>`).join('')}</details>`:''}
  <div style="display:flex;gap:.4rem;justify-content:space-between;flex-wrap:wrap;margin-top:1rem">
    <div style="display:flex;gap:.3rem;flex-wrap:wrap">${id?`<button class="btn bg bsm" onclick="gaDemandeAccord('${id}')"><i data-lucide=hand class=ic></i> Demander l’accord</button><button class="btn bg bsm" onclick="gaAccordRecu('${id}')"><i data-lucide=check class=ic></i> Accord reçu</button><button class="btn bg bsm" onclick="gaBonIntervention('${id}')"><i data-lucide=file-text class=ic></i> Bon d’intervention</button>`:''}</div>
    <div style="display:flex;gap:.4rem"><button class="btn bg" onclick="gaCloseModal()">Fermer</button><button class="btn bp" onclick="gaSaveInter(${id?`'${id}'`:'null'},'${gaQ(pre?.ticket_id||'')}')">Enregistrer</button></div>
  </div>`,true);
}
async function gaSaveInter(id,ticketId){
  const old=id?GA.inter.find(x=>x.id===id):{};
  const row={agency_id:U.id,mandat_id:gaV('gi-m')||null,titre:gaV('gi-t'),description:gaV('gi-d'),urgence:gaV('gi-u'),statut:gaV('gi-s'),prestataire_nom:gaV('gi-pn')||null,prestataire_contact:gaV('gi-pc')||null,
    devis_montant:gaN('gi-dv'),date_intervention:gaV('gi-di')||null,montant_final:gaN('gi-mf'),imputation:gaV('gi-im')};
  if(!row.titre){toast('Indiquez l’objet');return;}
  if(!id&&ticketId)row.ticket_id=ticketId;
  if(row.devis_montant&&row.statut==='signale')row.statut='devis';
  if(row.montant_final&&['termine','planifie','accord','devis','signale'].includes(row.statut)&&row.statut!=='facture')row.statut='facture';
  if(row.statut==='termine'&&!old.termine_at)row.termine_at=new Date().toISOString();
  row.mandat_id=row.mandat_id||null;row.listing_id=gaMandat(row.mandat_id)?.listing_id||old.listing_id||null;
  row.historique=[...(old.historique||[]),{d:new Date().toISOString(),t:(GA_IST[row.statut]||[row.statut])[0]+(row.montant_final?` — ${gaEur(row.montant_final)}`:row.devis_montant?` — devis ${gaEur(row.devis_montant)}`:'')}];
  const q=id?sb.from('gestion_interventions').update(row).eq('id',id).select().single():sb.from('gestion_interventions').insert(row).select().single();
  const{data,error}=await q;if(error){toast(error.message);return;}
  if(id)GA.inter=GA.inter.map(x=>x.id===id?data:x);else GA.inter.push(data);
  // Facturée → écriture sur le compte du propriétaire (une seule fois)
  if(data.statut==='facture'&&data.montant_final&&data.imputation==='proprietaire'&&!GA.ops.some(o=>o.intervention_id===data.id)){
    const{data:op}=await sb.from('gestion_operations').insert({agency_id:U.id,mandat_id:data.mandat_id,date:gaToday(),type:'travaux',libelle:`${data.titre}${data.prestataire_nom?' — '+data.prestataire_nom:''}`,montant:-Number(data.montant_final),intervention_id:data.id}).select().single();
    if(op)GA.ops.push(op);toast('Facture imputée au compte du propriétaire');
  }
  if(data.ticket_id&&['termine','facture'].includes(data.statut))try{await sb.from('tickets').update({status:'resolved'}).eq('id',data.ticket_id);}catch(e){}
  // Prévenir le locataire de la date d'intervention
  if(data.date_intervention&&data.date_intervention!==old.date_intervention){const t=gaTen(gaMandat(data.mandat_id));
    if(t?.tenant_id)await gaMsg(t.tenant_id,data.listing_id,`Intervention « ${data.titre} » prévue le ${gaFrC(data.date_intervention)}${data.prestataire_nom?' par '+data.prestataire_nom:''}${data.prestataire_contact?' ('+data.prestataire_contact+')':''}.`);
    if(t?.email)await gaMail(t.email,`Intervention prévue le ${gaFrC(data.date_intervention)}`,'Intervention dans votre logement',`<p>Bonjour ${gaE(t.nom)},</p><p>L’intervention « <strong>${gaE(data.titre)}</strong> » est prévue le <strong>${gaFr(data.date_intervention)}</strong>${data.prestataire_nom?' par '+gaE(data.prestataire_nom):''}${data.prestataire_contact?' ('+gaE(data.prestataire_contact)+')':''}. Merci d’assurer l’accès au logement.</p>`);}
  gaCloseModal();toast('Intervention enregistrée');gaRender();
}
async function gaDemandeAccord(id){
  const i=GA.inter.find(x=>x.id===id);const m=gaMandat(i.mandat_id);if(!m)return;
  const ok=await gaMail(m.owner_email,`Accord travaux — ${gaBien(m)}`,'Demande d’accord pour des travaux',
    `<p>Bonjour ${gaE(m.owner_name||'')},</p><p>Une intervention est nécessaire dans votre bien <strong>${gaE(gaBien(m))}</strong> :</p><p><strong>${gaE(i.titre)}</strong><br>${gaE(i.description||'')}</p><p>${i.prestataire_nom?'Prestataire : '+gaE(i.prestataire_nom)+'<br>':''}Montant du devis : <strong>${gaEur(i.devis_montant||0)} TTC</strong></p><p>Merci de nous confirmer votre accord par retour d’e-mail. Le montant sera déduit de votre prochain reversement.</p>`);
  if(m.owner_clerk_id)await gaMsg(m.owner_clerk_id,m.listing_id,`Demande d’accord travaux pour ${gaBien(m)} : ${i.titre} — devis ${gaEur(i.devis_montant||0)}. Répondez-nous pour valider.`);
  const h=[...(i.historique||[]),{d:new Date().toISOString(),t:'Accord demandé au propriétaire'}];
  const{data}=await sb.from('gestion_interventions').update({statut:'accord_demande',accord_demande_at:new Date().toISOString(),historique:h}).eq('id',id).select().single();
  if(data)GA.inter=GA.inter.map(x=>x.id===id?data:x);
  gaCloseModal();toast(ok||m.owner_clerk_id?'Demande d’accord envoyée':'E-mail du propriétaire manquant');gaRender();
}
async function gaAccordRecu(id){
  const i=GA.inter.find(x=>x.id===id);const h=[...(i.historique||[]),{d:new Date().toISOString(),t:'Accord du propriétaire reçu'}];
  const{data}=await sb.from('gestion_interventions').update({statut:'accord',accord_at:new Date().toISOString(),historique:h}).eq('id',id).select().single();
  if(data)GA.inter=GA.inter.map(x=>x.id===id?data:x);gaCloseModal();toast('Accord enregistré');gaRender();
}
function gaBonIntervention(id){
  const i=GA.inter.find(x=>x.id===id);const m=gaMandat(i.mandat_id);const t=gaTen(m);
  gaDoc({titre:'Bon d’intervention',dest:[i.prestataire_nom||'Prestataire',i.prestataire_contact||''],fichier:'bon-intervention',
    table:{head:['Rubrique','Détail'],widths:[50,124],rows:[['Adresse',gaAdresse(m)],['Occupant',t?`${t.nom}${t.tel?' — '+t.tel:''}`:'Logement vacant (clés à l’agence)'],['Objet',i.titre],['Description',i.description||'—'],['Urgence',i.urgence],['Date souhaitée',i.date_intervention?gaFr(i.date_intervention):'à convenir avec l’occupant'],['Montant accepté',i.devis_montant?gaEur(i.devis_montant)+' TTC':'sur devis préalable']]},
    apres:[`Facture à établir au nom de ${m.owner_name||'le propriétaire'}, à adresser à ${gaAgence().nom}. Tout dépassement doit être validé au préalable par l’agence.`]});
}

// ════════════════════ Conformité ════════════════════
function gaDocState(m,k){
  const e=GA.ech.find(x=>x.mandat_id===m.id&&x.type===k);const def=GA_DOCS[k];
  if(!gaDocApplies(m,k))return{c:'b-dim',l:'n/a',e};
  if(def.qui==='locataire'&&!gaTen(m))return{c:'b-dim',l:'—',e};
  if(!e)return{c:def.oblig?'b-red':'b-dim',l:'manquant',e};
  if(!e.date_expiration)return{c:'b-green',l:'ok',e};
  const r=gaDays(gaToday(),e.date_expiration);
  return r<0?{c:'b-red',l:'expiré',e}:r<=30?{c:'b-gold',l:gaFrC(e.date_expiration),e}:{c:'b-green',l:gaFrC(e.date_expiration),e};
}
function gaRenderConf(){
  const ms=gaActifs();const keys=Object.keys(GA_DOCS);
  return`<div class="card" style="margin-bottom:1rem"><div class="cb" style="font-size:.75rem;color:var(--td);line-height:1.55">Validités prises en compte : assurance habitation et entretien de chaudière 1 an · PNO 1 an · DPE 10 ans (les DPE réalisés avant le 1er juillet 2021 ne sont plus valables) · électricité et gaz 6 ans pour une location · plomb 6 ans si positif · ERP de moins de 6 mois à la signature du bail. DPE F ou G : loyer gelé ; G interdit à la location pour tout nouveau bail, F à partir de 2028.</div></div>
  ${ms.length?`<div class="card"><div style="overflow-x:auto"><table class="tbl"><thead><tr><th>Bien</th>${keys.map(k=>`<th style="font-size:.6rem">${GA_DOCS[k].court}</th>`).join('')}</tr></thead><tbody>
  ${ms.map(m=>`<tr><td style="font-size:.78rem">${gaE(gaBien(m))}<div style="font-size:.66rem;color:var(--td)">${gaE(gaTen(m)?.nom||'vacant')}</div></td>${keys.map(k=>{const s=gaDocState(m,k);return`<td><span class="badge ${s.c}" style="font-size:.6rem;cursor:pointer;white-space:nowrap" onclick="gaEditEch('${m.id}','${k}')">${s.e?.resultat&&k==='dpe'?s.e.resultat.toUpperCase()+' · ':''}${s.l}</span></td>`;}).join('')}</tr>`).join('')}
  </tbody></table></div></div>`:gaEmpty('shield-check','Aucun bien géré.')}`;
}
function gaEditEch(mid,k){
  const m=gaMandat(mid);const def=GA_DOCS[k];const e=GA.ech.find(x=>x.mandat_id===mid&&x.type===k)||{};
  gaModal(`<div style="font-size:1rem;font-weight:700;margin-bottom:.3rem">${def.l}</div><div style="font-size:.76rem;color:var(--td);margin-bottom:.8rem">${gaE(gaBien(m))}</div>
  <div class="fgrid2">
    <div class="fg"><label class="fl">Date du document</label><input class="fi" id="gx-dd" type="date" value="${e.date_document||''}" onchange="if(${def.mois||0}){const d=new Date(this.value+'T12:00:00');d.setMonth(d.getMonth()+${def.mois||0});document.getElementById('gx-de').value=d.toISOString().slice(0,10);}"></div>
    <div class="fg"><label class="fl">Valable jusqu’au</label><input class="fi" id="gx-de" type="date" value="${e.date_expiration||''}"></div>
    ${k==='dpe'?`<div class="fg"><label class="fl">Classe énergie</label><select class="fsel" id="gx-r"><option value="">—</option>${'ABCDEFG'.split('').map(c=>`<option ${String(e.resultat||'').toUpperCase()===c?'selected':''}>${c}</option>`).join('')}</select></div>`:`<div class="fg"><label class="fl">Résultat / remarque</label><input class="fi" id="gx-r" value="${gaE(e.resultat||'')}"></div>`}
    <div class="fg"><label class="fl">Lien vers le document</label><input class="fi" id="gx-u" value="${gaE(e.fichier_url||'')}" placeholder="https://…"></div>
  </div>
  <div style="display:flex;justify-content:space-between;gap:.5rem;margin-top:1rem;flex-wrap:wrap"><div>${def.qui==='locataire'?`<button class="btn bg bsm" onclick="gaDemandeDoc('${mid}','${k}')"><i data-lucide=mail class=ic></i> Demander au locataire</button>`:''}</div>
  <div style="display:flex;gap:.5rem"><button class="btn bg" onclick="gaCloseModal()">Annuler</button><button class="btn bp" onclick="gaSaveEch('${mid}','${k}')">Enregistrer</button></div></div>`);
}
async function gaSaveEch(mid,k){
  const row={agency_id:U.id,mandat_id:mid,type:k,date_document:gaV('gx-dd')||null,date_expiration:gaV('gx-de')||null,resultat:gaV('gx-r')||null,fichier_url:gaV('gx-u')||null,relance_at:null};
  const{data,error}=await sb.from('gestion_echeances').upsert(row,{onConflict:'mandat_id,type'}).select().single();if(error){toast(error.message);return;}
  GA.ech=GA.ech.filter(x=>!(x.mandat_id===mid&&x.type===k));GA.ech.push(data);gaCloseModal();toast('Enregistré');gaRender();
}
async function gaDemandeDoc(mid,k){
  const m=gaMandat(mid);const t=gaTen(m);const def=GA_DOCS[k];if(!t){toast('Pas de locataire');return;}
  const txt=k==='assurance_habitation'?'Comme le prévoit votre bail (article 7 de la loi du 6 juillet 1989), merci de nous transmettre votre attestation d’assurance habitation en cours de validité. Sans justificatif dans un délai d’un mois, le bailleur peut souscrire une assurance pour votre compte et vous en refacturer le coût.'
    :k==='entretien_chaudiere'?'L’entretien annuel de la chaudière est obligatoire et à la charge du locataire (décret du 9 juin 2009). Merci de nous transmettre l’attestation d’entretien de l’année.'
    :`Merci de nous transmettre le justificatif : ${def.l}.`;
  const ok=await gaMail(t.email,`${def.l} — justificatif à transmettre`,def.l,`<p>Bonjour ${gaE(t.nom)},</p><p>${txt}</p><p>Logement : ${gaE(gaAdresse(m))}</p>`);
  if(t.tenant_id)await gaMsg(t.tenant_id,m.listing_id,`${def.l} : ${txt}`);
  const{data}=await sb.from('gestion_echeances').upsert({agency_id:U.id,mandat_id:mid,type:k,relance_at:new Date().toISOString(),...(GA.ech.find(x=>x.mandat_id===mid&&x.type===k)?{}:{date_expiration:null})},{onConflict:'mandat_id,type'}).select().single();
  if(data){GA.ech=GA.ech.filter(x=>!(x.mandat_id===mid&&x.type===k));GA.ech.push(data);}
  toast(ok||t.tenant_id?'Demande envoyée au locataire':'E-mail du locataire manquant');
}

// ════════════════════ Fins de bail & dépôts ════════════════════
function gaRenderFins(){
  const ms=GA.mandats.filter(m=>gaTen(m)||m.fin_bail?.preavis_recu);
  return`<div class="card" style="margin-bottom:1rem"><div class="cb" style="font-size:.75rem;color:var(--td);line-height:1.55">Préavis du locataire : 1 mois en meublé ; 3 mois en vide (1 mois en zone tendue, mutation, perte d’emploi, RSA/AAH, santé). Congé du bailleur : 3 mois avant l’échéance en meublé, 6 mois en vide (vente, reprise ou motif légitime et sérieux). Dépôt de garantie : à restituer sous 1 mois si l’état des lieux de sortie est conforme, 2 mois sinon ; au-delà, pénalité de 10 % du loyer hors charges par mois de retard commencé. Jusqu’à 20 % peuvent être conservés en attendant l’arrêté des comptes de copropriété.</div></div>
  ${ms.length?ms.map(m=>{const t=gaTen(m);const f=m.fin_bail||{};
    const etape=f.depot_restitue?gaBadge('Clôturé','b-green'):f.edl_sortie?gaBadge('Dépôt à restituer','b-gold'):f.preavis_recu?gaBadge(`Préavis — sortie ${gaFrC(f.date_fin)}`,'b-sea'):gaBadge('En cours','b-dim');
    return`<div class="card" style="margin-bottom:.6rem"><div class="cb" style="display:flex;justify-content:space-between;gap:.6rem;flex-wrap:wrap;align-items:center">
      <div><div style="font-weight:600;font-size:.88rem">${gaE(gaBien(m))}</div><div style="font-size:.72rem;color:var(--td)">${gaE(t?.nom||f.locataire||'')} · ${etape}${t?.fin?' · échéance du bail '+gaFrC(t.fin):''}</div></div>
      <div style="display:flex;gap:.3rem;flex-wrap:wrap"><button class="btn bg bsm" onclick="gaEditFin('${m.id}')">Préavis / sortie</button>${f.edl_sortie&&!f.depot_restitue?`<button class="btn bp bsm" onclick="gaDepotModal('${m.id}')">Dépôt de garantie</button>`:''}</div>
    </div></div>`;}).join(''):gaEmpty('door-open','Aucune location en cours.')}`;
}
function gaPreavisFin(m,recu,par,reduit){
  const t=gaTen(m);if(!recu)return'';
  if(par==='bailleur')return t?.fin||'';
  return gaAddM(recu,t?.meuble||reduit?1:3);
}
function gaEditFin(mid){
  const m=gaMandat(mid);const t=gaTen(m);const f=m.fin_bail||{};
  gaModal(`<div style="font-size:1rem;font-weight:700;margin-bottom:.3rem"><i data-lucide=door-open class=ic></i> Fin de bail — ${gaE(gaBien(m))}</div><div style="font-size:.76rem;color:var(--td);margin-bottom:.8rem">${gaE(t?.nom||f.locataire||'')} · ${t?.meuble?'meublé':'vide'}</div>
  <div class="fgrid2">
    <div class="fg"><label class="fl">Congé donné par</label><select class="fsel" id="gf-par"><option value="locataire" ${f.par!=='bailleur'?'selected':''}>Le locataire</option><option value="bailleur" ${f.par==='bailleur'?'selected':''}>Le bailleur</option></select></div>
    <div class="fg"><label class="fl">Reçu le</label><input class="fi" id="gf-recu" type="date" value="${f.preavis_recu||''}" onchange="gaFinCalc('${mid}')"></div>
    <label style="display:flex;gap:.5rem;font-size:.78rem;grid-column:1/-1"><input type="checkbox" id="gf-red" ${f.reduit?'checked':''} onchange="gaFinCalc('${mid}')"> Préavis réduit à 1 mois (zone tendue ou motif légal)</label>
    <div class="fg"><label class="fl">Date de fin (libération)</label><input class="fi" id="gf-fin" type="date" value="${f.date_fin||''}"></div>
    <div class="fg"><label class="fl">Motif</label><input class="fi" id="gf-motif" value="${gaE(f.motif||'')}"></div>
    <div class="fg"><label class="fl">État des lieux de sortie le</label><input class="fi" id="gf-edl" type="date" value="${f.edl_sortie||''}"></div>
    <div class="fg"><label class="fl">Conforme à l’entrée ?</label><select class="fsel" id="gf-conf"><option value="1" ${f.edl_conforme!==false?'selected':''}>Oui (restitution sous 1 mois)</option><option value="0" ${f.edl_conforme===false?'selected':''}>Non (2 mois, retenues)</option></select></div>
    <div class="fg"><label class="fl">Nouvelle adresse du locataire</label><input class="fi" id="gf-adr" value="${gaE(f.adresse_sortie||'')}"></div>
  </div>
  <div style="font-size:.74rem;color:var(--td);margin-top:.5rem">Après la sortie, les loyers ne sont plus appelés et le bien repasse en « vacant » : pensez à remettre l’annonce en ligne.</div>
  <div style="display:flex;justify-content:flex-end;gap:.5rem;margin-top:1rem"><button class="btn bg" onclick="gaCloseModal()">Annuler</button><button class="btn bp" onclick="gaSaveFin('${mid}')">Enregistrer</button></div>`);
}
function gaFinCalc(mid){const m=gaMandat(mid);const v=gaPreavisFin(m,gaV('gf-recu'),gaV('gf-par'),gaC('gf-red'));if(v)document.getElementById('gf-fin').value=v;}
async function gaSaveFin(mid){
  const m=gaMandat(mid);const t=gaTen(m);const f={...(m.fin_bail||{})};
  Object.assign(f,{par:gaV('gf-par'),preavis_recu:gaV('gf-recu')||null,reduit:gaC('gf-red'),date_fin:gaV('gf-fin')||null,motif:gaV('gf-motif')||null,edl_sortie:gaV('gf-edl')||null,edl_conforme:gaV('gf-conf')==='1',adresse_sortie:gaV('gf-adr')||null});
  if(t){f.locataire=t.nom;f.locataire_email=t.email;f.depot=t.depot;f.hc=t.hc;}
  if(f.edl_sortie)f.sortie_effective=f.date_fin||f.edl_sortie;
  const{data,error}=await sb.from('gestion_mandats').update({fin_bail:f,updated_at:new Date().toISOString()}).eq('id',mid).select().single();if(error){toast(error.message);return;}
  GA.mandats=GA.mandats.map(x=>x.id===mid?data:x);
  // Loyers après la date de fin : annulés
  if(f.date_fin){const fut=gaPays(m).filter(p=>p.status!=='paid'&&p.due_date>f.date_fin).map(p=>p.id);
    if(fut.length){await sb.from('payments').update({status:'cancelled'}).in('id',fut);GA.pays.forEach(p=>{if(fut.includes(p.id))p.status='cancelled';});}}
  gaCloseModal();toast('Fin de bail enregistrée');gaRender();
}
function gaDepotModal(mid){
  const m=gaMandat(mid);const f=m.fin_bail||{};const depot=+f.depot||+gaTen(m)?.depot||+m.loc_depot||0;
  const lim0=f.date_fin&&f.date_fin<gaToday()?f.date_fin:gaToday();const arr=gaPays(m).filter(gaUnpaid).filter(p=>p.due_date<=lim0).reduce((s,p)=>s+gaReste(p),0);
  const ret=f.retenues||[];const lim=f.edl_sortie?gaAddM(f.edl_sortie,f.edl_conforme===false?2:1):null;const late=lim?gaDays(lim,gaToday()):0;
  gaModal(`<div style="font-size:1rem;font-weight:700;margin-bottom:.3rem"><i data-lucide=piggy-bank class=ic></i> Restitution du dépôt de garantie</div>
  <div style="font-size:.76rem;color:var(--td);margin-bottom:.8rem">${gaE(gaBien(m))} · ${gaE(f.locataire||'')} · à restituer avant le <strong>${gaFrC(lim)}</strong>${late>0?` — <span style="color:var(--red)">en retard : pénalité ${gaEur((+f.hc||0)*0.1*Math.ceil(late/30))}</span>`:''}</div>
  <div class="fgrid2"><div class="fg"><label class="fl">Dépôt versé (€)</label><input class="fi" id="gd-dep" type="number" step="0.01" value="${depot}" oninput="gaDepCalc()"></div>
  <div class="fg"><label class="fl">Loyers et charges impayés (€)</label><input class="fi" id="gd-arr" type="number" step="0.01" value="${gaR(arr)}" oninput="gaDepCalc()"></div></div>
  <div style="font-size:.74rem;font-weight:700;margin:.6rem 0 .3rem">Retenues justifiées (devis / factures, vétusté déduite)</div>
  <div id="gd-rets">${(ret.length?ret:[{l:'',m:''}]).map(r=>`<div class="gd-r" style="display:flex;gap:.4rem;margin-bottom:.3rem"><input class="fi" placeholder="Remise en état peinture chambre" value="${gaE(r.l)}" style="flex:3"><input class="fi" type="number" step="0.01" placeholder="€" value="${r.m??''}" style="flex:1" oninput="gaDepCalc()"></div>`).join('')}</div>
  <button class="btn bg bsm" onclick="document.getElementById('gd-rets').insertAdjacentHTML('beforeend',document.querySelector('.gd-r').outerHTML.replace(/value=&quot;[^&]*&quot;/g,''));document.querySelectorAll('.gd-r:last-child input').forEach(i=>i.value='')">+ Retenue</button>
  <div class="fg" style="margin-top:.5rem"><label class="fl">Provision régularisation de charges (max 20 % du dépôt)</label><input class="fi" id="gd-prov" type="number" step="0.01" value="${f.provision_charges||0}" oninput="gaDepCalc()"></div>
  <div style="font-size:.95rem;margin:.7rem 0">À restituer : <strong id="gd-solde">—</strong></div>
  <div style="display:flex;justify-content:flex-end;gap:.5rem;flex-wrap:wrap"><button class="btn bg" onclick="gaCloseModal()">Fermer</button><button class="btn bg" onclick="gaDepotSave('${mid}',false)">Enregistrer + lettre PDF</button><button class="btn bp" onclick="gaDepotSave('${mid}',true)">Marquer restitué</button></div>`);
  gaDepCalc();
}
function gaDepRets(){return[...document.querySelectorAll('.gd-r')].map(d=>{const i=d.querySelectorAll('input');return{l:i[0].value.trim(),m:Number(String(i[1].value).replace(',','.'))||0};}).filter(r=>r.l||r.m);}
function gaDepCalc(){
  const dep=gaN('gd-dep')||0,arr=gaN('gd-arr')||0,prov=Math.min(gaN('gd-prov')||0,dep*0.2);
  const s=gaR(dep-arr-prov-gaDepRets().reduce((a,r)=>a+r.m,0));const el=document.getElementById('gd-solde');
  if(el)el.textContent=s>=0?gaEur(s):`${gaEur(0)} — reste dû par le locataire : ${gaEur(-s)}`;return s;
}
async function gaDepotSave(mid,done){
  const m=gaMandat(mid);const f={...(m.fin_bail||{})};const dep=gaN('gd-dep')||0,arr=gaN('gd-arr')||0,prov=Math.min(gaN('gd-prov')||0,dep*0.2);const rets=gaDepRets();const solde=gaDepCalc();
  Object.assign(f,{depot:dep,arrieres:arr,retenues:rets,provision_charges:prov,solde_restitue:Math.max(0,solde)});
  if(done){f.depot_restitue=gaToday();
    if(m.depot_detenu_par!=='proprietaire'){await sb.from('gestion_operations').insert({agency_id:U.id,mandat_id:mid,date:gaToday(),type:'depot_restitue',libelle:`Dépôt restitué à ${f.locataire||'locataire'}`,montant:-Math.max(0,solde)});}
    // Arriérés couverts par le dépôt : les loyers passent en payés (ils arrivent ainsi sur le compte du propriétaire) ;
    // les retenues pour remise en état sont créditées au propriétaire. La provision charges reste conservée.
    const lim0=f.date_fin&&f.date_fin<gaToday()?f.date_fin:gaToday();
    const cover=Math.min(dep,arr);const credRets=gaR(Math.max(0,Math.min(rets.reduce((a,r)=>a+r.m,0),dep-cover)));
    if(m.depot_detenu_par!=='proprietaire'&&credRets>0){const{data:op}=await sb.from('gestion_operations').insert({agency_id:U.id,mandat_id:mid,date:gaToday(),type:'divers',libelle:'Retenues sur dépôt de garantie (remise en état)',montant:credRets}).select().single();if(op)GA.ops.push(op);}
    if(arr>0&&cover>=arr-0.01){const ids=gaPays(m).filter(gaUnpaid).filter(p=>p.due_date<=lim0).map(p=>p.id);if(ids.length){await sb.from('payments').update({status:'paid',payment_method:'Imputé sur dépôt de garantie',paid_at:new Date().toISOString()}).in('id',ids);GA.pays.forEach(p=>{if(ids.includes(p.id)){p.status='paid';p.paid_at=new Date().toISOString();}});}}
  }
  const{data,error}=await sb.from('gestion_mandats').update({fin_bail:f}).eq('id',mid).select().single();if(error){toast(error.message);return;}
  GA.mandats=GA.mandats.map(x=>x.id===mid?data:x);
  gaDoc({mention:'LETTRE RECOMMANDÉE AVEC ACCUSÉ DE RÉCEPTION',dest:[f.locataire||'',f.adresse_sortie||''],objet:'Restitution du dépôt de garantie',fichier:'restitution-depot',
    avant:['Madame, Monsieur,',`Suite à votre départ du logement situé ${gaAdresse(m)} et à l’état des lieux de sortie du ${gaFr(f.edl_sortie)}, voici le décompte de votre dépôt de garantie :`],
    table:{head:['Désignation','Montant'],widths:[124,50],align:['l','r'],rows:[['Dépôt de garantie versé',gaEur(dep)],...(arr?[['Loyers et charges restant dus','− '+gaEur(arr)]]:[]),...rets.map(r=>[r.l||'Retenue','− '+gaEur(r.m)]),...(prov?[['Provision dans l’attente de la régularisation annuelle des charges (art. 22)','− '+gaEur(prov)]]:[])],foot:[['Montant restitué',gaEur(Math.max(0,solde))]]},
    apres:[solde<0?`Le décompte fait apparaître un solde de ${gaEur(-solde)} restant à votre charge, que nous vous remercions de régler sous quinze jours.`:'Le montant restitué vous est adressé par virement.',...(rets.length?['Les justificatifs des retenues (devis, factures) sont à votre disposition.']:[]),'Veuillez agréer, Madame, Monsieur, nos salutations distinguées.']});
  gaCloseModal();toast(done?'Dépôt marqué restitué':'Décompte enregistré');gaRender();
}
async function gaInfoEcheanceBail(mid){
  const m=gaMandat(mid);const t=gaTen(m);const pre=t?.meuble?3:6;
  const ok=await gaMail(m.owner_email,`Échéance du bail — ${gaBien(m)}`,'Échéance du bail de votre locataire',
    `<p>Bonjour ${gaE(m.owner_name||'')},</p><p>Le bail de <strong>${gaE(t?.nom||'')}</strong> pour <strong>${gaE(gaBien(m))}</strong> arrive à échéance le <strong>${gaFr(t?.fin)}</strong>.</p><p>Sans action de votre part, il sera reconduit tacitement. Si vous souhaitez donner congé (vente, reprise pour habiter, motif légitime et sérieux), le congé doit être reçu par le locataire au plus tard le <strong>${gaFr(gaAddM(t?.fin,-pre))}</strong> (${pre} mois avant). Indiquez-nous vos intentions.</p>`);
  toast(ok?'Propriétaire informé':'E-mail du propriétaire manquant');
}
async function gaTeomModal(mid){
  const v=prompt('Montant de la TEOM (taxe d’enlèvement des ordures ménagères) figurant sur l’avis de taxe foncière, en € :');const n=Number(String(v||'').replace(',','.'));if(!n)return;
  const m=gaMandat(mid);const t=gaTen(m);
  const{data,error}=await sb.from('gestion_operations').insert({agency_id:U.id,mandat_id:mid,date:gaToday(),type:'teom',libelle:`TEOM ${new Date().getFullYear()} refacturée au locataire`,montant:0}).select().single();
  if(error){toast(error.message);return;}GA.ops.push(data);
  // Ajoutée à la prochaine échéance de loyer
  const next=gaPays(m).filter(p=>gaUnpaid(p)&&p.due_date>=gaToday()).sort((a,b)=>a.due_date.localeCompare(b.due_date))[0];
  if(next){const amt=gaR(+next.amount+n);await sb.from('payments').update({amount:amt}).eq('id',next.id);next.amount=amt;}
  if(t?.tenant_id)await gaMsg(t.tenant_id,m.listing_id,`Taxe d’enlèvement des ordures ménagères ${new Date().getFullYear()} : ${gaEur(n)}, ajoutée à votre prochaine échéance (charge récupérable).`);
  toast(next?`TEOM ajoutée à l’échéance du ${gaFrC(next.due_date)}`:'TEOM enregistrée');gaRender();
}

// ════════════════════ Révision IRL ════════════════════
const gaIrlPub=(y,q)=>q===4?`${y+1}-01-15`:`${y}-${['04','07','10'][q-1]}-15`;
// Dernier IRL publié à une date donnée, pour un trimestre donné (ou tous trimestres)
function gaIrlAt(date,tri){
  let best=null;
  for(const k of Object.keys(GA_IRL)){const[y,q]=k.split('-').map(Number);if(tri&&q!==tri)continue;if(gaIrlPub(y,q)<=date&&(!best||gaIrlPub(y,q)>gaIrlPub(best.y,best.q)))best={y,q,v:GA_IRL[k]};}
  return best;
}
function gaIrlInfo(m){
  const t=gaTen(m);if(!t?.debut||!t.hc)return null;
  const L=t.lease;const today=gaToday();
  const deb=new Date(t.debut+'T12:00:00');const now=new Date();
  let anniv=new Date(now.getFullYear(),deb.getMonth(),deb.getDate(),12);if(anniv>now)anniv.setFullYear(anniv.getFullYear()-1);
  if(anniv<=deb)return null;
  const an=gaIso(anniv);
  const last=L?.irl_last_revision||m.fin_bail?.irl_last;
  if(last&&String(last.date||'')>=an)return{due:false};
  const dpe=GA.ech.find(x=>x.mandat_id===m.id&&x.type==='dpe');
  if(['F','G'].includes(String(dpe?.resultat||'').toUpperCase()))return{due:false,gel:true};
  if(gaDays(an,today)>365)return null;
  const tri=+(L?.irl_ref_trimestre||m.fin_bail?.irl_trimestre||gaIrlAt(t.debut)?.q||0);if(!tri)return null;
  const nw=gaIrlAt(an,tri);if(!nw)return null;
  const old=GA_IRL[`${nw.y-1}-${tri}`];if(!old)return null;
  const nouveau=gaR(t.hc*nw.v/old);
  return{due:nouveau>t.hc,ancien:t.hc,nouveau,ref:`IRL T${tri} ${nw.y-1} → ${nw.y} : ${old} → ${nw.v}`,anniv:an,refNew:nw.v,refOld:old,tri};
}
function gaRenderIRL(){
  const rows=gaActifs().map(m=>({m,t:gaTen(m),i:gaIrlInfo(m)})).filter(x=>x.t);
  return`<div class="card" style="margin-bottom:1rem"><div class="cb" style="font-size:.75rem;color:var(--td);line-height:1.55">La révision s’applique à la date anniversaire si le bail contient une clause de révision. Elle doit être demandée dans l’année qui suit (sans effet rétroactif). Nouveau loyer = loyer × IRL du trimestre de référence de l’année ÷ IRL du même trimestre de l’année précédente. Logements classés F ou G : aucune révision possible. Dernier indice connu : T3 2026 = 148,06.</div></div>
  ${rows.length?`<div class="card"><div style="overflow-x:auto"><table class="tbl"><thead><tr><th>Bien</th><th>Locataire</th><th>Loyer HC</th><th>Révision</th><th></th></tr></thead><tbody>
  ${rows.map(x=>`<tr><td>${gaE(gaBien(x.m))}</td><td>${gaE(x.t.nom)}</td><td>${gaEur(x.t.hc)}</td>
    <td style="font-size:.76rem">${x.i?.gel?gaBadge('Gel (DPE F/G)','b-red'):x.i?.due?`${gaEur(x.i.ancien)} → <strong>${gaEur(x.i.nouveau)}</strong><div style="color:var(--td)">${x.i.ref} · anniversaire ${gaFrC(x.i.anniv)}</div>`:x.i?gaBadge('À jour','b-green'):gaBadge('Pas encore','b-dim')}</td>
    <td>${x.i?.due?`<button class="btn bp bsm" onclick="gaApplyIrl('${x.m.id}')">Appliquer</button>`:''}</td></tr>`).join('')}
  </tbody></table></div></div>`:gaEmpty('trending-up','Aucune location en cours.')}`;
}
async function gaApplyIrl(mid){
  const m=gaMandat(mid);const t=gaTen(m);const i=gaIrlInfo(m);if(!i?.due)return;
  if(!confirm(`Réviser le loyer de ${t.nom} : ${gaEur(i.ancien)} → ${gaEur(i.nouveau)} HC à compter de la prochaine échéance ?`))return;
  const rev={date:gaToday(),ancien:i.ancien,nouveau:i.nouveau,irl_old:i.refOld,irl_new:i.refNew,trimestre:i.tri};
  if(t.lease){const{error}=await sb.from('leases').update({rent:i.nouveau,irl_last_revision:rev}).eq('id',t.lease.id);if(error){toast(error.message);return;}Object.assign(t.lease,{rent:i.nouveau,irl_last_revision:rev});}
  else{const f={...(m.fin_bail||{}),irl_last:rev,irl_trimestre:i.tri};const{data}=await sb.from('gestion_mandats').update({loc_loyer_hc:i.nouveau,fin_bail:f}).eq('id',mid).select().single();if(data)GA.mandats=GA.mandats.map(x=>x.id===mid?data:x);}
  const fut=gaPays(m).filter(p=>p.status==='pending'&&!(+p.amount_paid)&&p.due_date>=gaToday());
  for(const p of fut){const amt=gaR(i.nouveau+t.ch);await sb.from('payments').update({amount:amt}).eq('id',p.id);p.amount=amt;}
  await gaMail(t.email,`Révision annuelle de votre loyer — ${gaBien(m)}`,'Révision annuelle du loyer',`<p>Bonjour ${gaE(t.nom)},</p><p>Conformément à la clause de révision de votre bail, votre loyer hors charges est révisé selon l’indice de référence des loyers (${i.ref}) : <strong>${gaEur(i.ancien)} → ${gaEur(i.nouveau)}</strong>, à compter de la prochaine échéance. Les charges restent inchangées.</p>`);
  if(t.tenant_id)await gaMsg(t.tenant_id,m.listing_id,`Révision annuelle du loyer (IRL) : ${gaEur(i.ancien)} → ${gaEur(i.nouveau)} hors charges à compter de la prochaine échéance.`);
  toast('Loyer révisé, locataire prévenu');gaRender();
}

// ════════════════════ Charges & outils (page du parcours propriétaire) ════════════════════
function gaRenderOutils(){
  setTimeout(()=>{const f=document.getElementById('ga-llf');if(f&&!f.src)f.src='/landlord-dashboard.html?embed=agence&page=gestion';},50);
  return`<div style="font-size:.76rem;color:var(--td);margin-bottom:.6rem">Régularisation annuelle des charges, TEOM, lettres types et récapitulatifs par bail (baux signés sur Trouve Ton Toit).</div>
  <iframe id="ga-llf" class="llf" title="Charges et outils"></iframe>`;
}

// ════════════════════════════════════════════════════════════════════
// Interface « par bien » : une carte par logement, une fiche par bien,
// et en haut quelques actions groupées en un clic.
// (Remplace l'ancien affichage en 11 onglets ; les fonctions métier restent.)
// ════════════════════════════════════════════════════════════════════
GA.view={t:'home'};
function gaGo(v){GA.view=v;gaRender();const mn=document.getElementById('main');if(mn)mn.scrollTop=0;window.scrollTo(0,0);}
function gaTab(t){gaGo({t:{reversements:'owners',fiscal:'fiscal',outils:'outils',encaissements:'enc',fins:'home',conformite:'home',irl:'home',interventions:'home',recouvrement:'home',mandats:'home'}[t]||'home'});}
function gaRender(){
  const nav=document.getElementById('ga-tabs');if(nav)nav.style.display='none';
  const body=document.getElementById('ga-body');if(!body)return;
  const v=GA.view||{t:'home'};
  const back=(lbl)=>`<button class="btn bg bsm" onclick="gaGo({t:'home'})" style="margin-bottom:1rem"><i data-lucide=arrow-left class=ic></i> ${lbl||'Mes biens gérés'}</button>`;
  try{
    body.innerHTML=v.t==='bien'?gaRenderFiche(v.id,v.s||'suivi')
      :v.t==='owners'?back()+`<div style="font-size:1.05rem;font-weight:700;margin-bottom:.8rem">Propriétaires & reversements</div>`+gaRenderRev()
      :v.t==='fiscal'?back()+`<div style="font-size:1.05rem;font-weight:700;margin-bottom:.8rem">Récapitulatifs fiscaux des propriétaires</div>`+gaRenderFiscal()
      :v.t==='enc'?back()+`<div style="font-size:1.05rem;font-weight:700;margin-bottom:.8rem">Tous les loyers du mois</div>`+gaRenderEnc()
      :v.t==='outils'?back()+gaRenderOutils()
      :gaRenderHome();
  }catch(e){console.error(e);body.innerHTML=`<div style="color:var(--red);padding:1rem">Erreur d’affichage : ${gaE(e.message)}</div>`;}
  const n=gaBulkCount();const sbNb=document.getElementById('nb-gestion');if(sbNb){sbNb.textContent=n;sbNb.style.display=n?'inline':'none';}
  if(window.lucide)lucide.createIcons();
}

// ── Ce qu'il y a à faire, regroupé par type d'action ────────────────
function gaBulk(){
  const today=gaToday();const B={relances:[],med:[],garanties:[],quitt:[],avis:[],irl:[],docs:[],rev:[],devis:[],factures:[],tickets:[],sansMandat:[],depots:[]};
  if(!GA.loaded)return B;
  for(const m of gaActifs()){
    const t=gaTen(m);const f=m.fin_bail||{};
    for(const p of gaPays(m).filter(gaUnpaid)){
      if(gaDays(p.due_date,today)<1)continue;
      for(const s of gaStage(m,p)){
        if(s.k==='r1'||s.k==='r2')B.relances.push({p,m,n:s.k==='r1'?1:2});
        else if(s.k==='med')B.med.push({p,m,s});
        else B.garanties.push({p,m,s});
      }
    }
    if(!m.auto_quittance)gaPays(m).filter(x=>x.status==='paid'&&!x.quittance_sent_at&&gaDays(x.paid_at,today)<=45).forEach(p=>B.quitt.push({p,m}));
    if(!m.auto_avis)gaPays(m).filter(x=>gaUnpaid(x)&&!x.avis_sent_at).forEach(p=>{const d=gaDays(today,p.due_date);if(d>=0&&d<=7)B.avis.push({p,m});});
    if(t){const i=gaIrlInfo(m);if(i?.due)B.irl.push({m,i});}
    if(t)for(const k of ['assurance_habitation','entretien_chaudiere']){
      if(!gaDocApplies(m,k))continue;const e=GA.ech.find(x=>x.mandat_id===m.id&&x.type===k);
      if(e?.relance_at&&gaDays(e.relance_at,today)<30)continue;
      if(!e?.date_expiration||gaDays(today,e.date_expiration)<=15)B.docs.push({m,k});
    }
    if(f.edl_sortie&&!f.depot_restitue)B.depots.push({m});
  }
  const day=new Date().getDate();
  for(const o of gaOwners()){const s=gaSolde(o.key);const jr=Math.min(...o.ms.map(m=>+m.reversement_jour||10));if(s>0.5&&day>=jr)B.rev.push({o,s});}
  for(const i of GA.inter){const m=gaMandat(i.mandat_id);
    if(i.statut==='devis'&&m&&Number(i.devis_montant)>Number(m.seuil_travaux??300))B.devis.push({i,m});
    if(i.statut==='termine')B.factures.push({i,m});}
  const tk=new Set(GA.inter.map(i=>i.ticket_id).filter(Boolean));
  GA.tickets.filter(x=>!tk.has(x.id)&&!['resolved','closed'].includes(x.status||x.statut)).forEach(k=>B.tickets.push({k}));
  const linked=new Set(GA.mandats.map(m=>m.lease_id).filter(Boolean));
  GA.leases.filter(l=>!linked.has(l.id)&&!l.parent_booking_id&&['signed','agreed'].includes(l.negotiation_status)).forEach(L=>B.sansMandat.push({L}));
  return B;
}
function gaBulkCount(){const B=gaBulk();return Object.values(B).reduce((s,a)=>s+a.length,0);}

// ── Accueil : une carte par bien (biens en gestion + annonces pas encore en gestion) ──
function gaTasksOf(m){return gaTasks().filter(x=>x.mid===m.id||(!x.mid&&x.lid&&x.lid===m.listing_id&&x.cat==='Interventions'));}
function gaRenderHome(){
  const act=gaActifs();const all=gaTasks();
  const tk=m=>all.filter(x=>x.mid===m.id||(!x.mid&&x.lid&&x.lid===m.listing_id&&x.cat==='Interventions'));
  const score=m=>{const t=tk(m);return (gaImpayes(m).length?10000+gaImpayes(m).reduce((s,p)=>s+gaReste(p),0):0)+t.filter(x=>x.p===1).length*100+t.filter(x=>x.p===2).length*10+t.length;};
  const sorted=[...act].sort((a,b)=>score(b)-score(a));
  const managed=new Set(GA.mandats.map(m=>m.listing_id).filter(Boolean));
  const libres=GA.listings.filter(l=>!managed.has(l.id)&&l.type!=='for_sale');
  const pl=(n,a,b)=>n>1?b:a;
  const cur=gaYm(new Date());
  const dus=act.flatMap(m=>gaPays(m).filter(p=>String(p.due_date).slice(0,7)===cur));
  const att=dus.reduce((s,p)=>s+(+p.amount||0),0),enc=dus.reduce((s,p)=>s+gaPaid(p),0);
  return`<div style="display:flex;justify-content:space-between;align-items:center;gap:.6rem;flex-wrap:wrap;margin-bottom:1rem">
    <div><div style="font-size:1.15rem;font-weight:700">Mes biens gérés</div>
      <div style="font-size:.76rem;color:var(--td)">${act.length} bien${pl(act.length,'','s')} en gestion${att?` · loyers de ${gaMoisLbl(cur)} : ${gaEur(enc)} reçus sur ${gaEur(att)}`:''}</div></div>
    <button class="btn bp bsm" onclick="gaQuickAdd()"><i data-lucide=plus class=ic></i> Ajouter un bien</button>
  </div>
  ${act.length||libres.length?`<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(270px,1fr));gap:.8rem">${sorted.map(m=>gaCard(m,tk(m))).join('')}${libres.map(gaCardLibre).join('')}</div>`
    :`<div class="card"><div class="cb" style="text-align:center;padding:2rem 1rem">
      <div style="font-size:1rem;font-weight:700;margin-bottom:.4rem">Ajoutez votre premier bien en gestion</div>
      <div style="font-size:.8rem;color:var(--td);max-width:460px;margin:0 auto 1rem;line-height:1.55">Propriétaire, bien, locataire : c’est tout. Ensuite, les avis d’échéance, quittances, relances et comptes rendus partent tout seuls.</div>
      <button class="btn bp" onclick="gaQuickAdd()"><i data-lucide=plus class=ic></i> Ajouter un bien</button></div></div>`}`;
}
// Annonce de l'agence pas encore en gestion
function gaCardLibre(l){
  const L=GA.leases.find(x=>x.listing_id===l.id&&!x.parent_booking_id&&['signed','agreed'].includes(x.negotiation_status));
  const tn=L?GA.profiles[L.tenant_id]?.full_name:'';
  return`<div class="card" style="border-style:dashed"><div class="cb" style="display:flex;flex-direction:column;gap:.35rem;height:100%">
    <div style="font-weight:700;font-size:.92rem;line-height:1.3">${gaE(l.title||l.full_address||'Annonce')}</div>
    <div style="font-size:.78rem;color:var(--tm)">${L?`${gaE(tn||'Locataire')} · bail signé`:gaE(l.full_address||'')}</div>
    <div style="font-size:.78rem;color:var(--td)">Pas encore en gestion</div>
    <div style="margin-top:auto;padding-top:.5rem"><button class="btn ${L?'bp':'bg'} bsm" onclick="gaQuickAdd({listing_id:'${l.id}'${L?`,lease_id:'${L.id}'`:''},owner_name:'${gaQ(l.manual_landlord_name||'')}',owner_email:'${gaQ(l.manual_landlord_email||'')}'})"><i data-lucide=plus class=ic></i> Mettre en gestion</button></div>
  </div></div>`;
}
// ── Carte d'un bien ─────────────────────────────────────────────────
function gaMoisStatut(m){
  const t=gaTen(m);if(!t)return{c:'var(--td)',ic:'home',l:'Vacant'};
  const cur=gaYm(new Date());const ML=(x=>x.charAt(0).toUpperCase()+x.slice(1))(gaMoisLbl(cur).split(' ')[0]);const p=gaPays(m).find(x=>String(x.due_date).slice(0,7)===cur&&x.status!=='cancelled');
  if(!p){const nx=gaPays(m).filter(gaUnpaid).sort((a,b)=>a.due_date.localeCompare(b.due_date))[0];return{c:'var(--td)',ic:'clock',l:nx?`Prochain loyer le ${gaFrC(nx.due_date)}`:'Aucune échéance programmée'};}
  if(p.status==='paid')return{c:'var(--green)',ic:'check-circle-2',l:`${ML} : reçu le ${new Date(p.paid_at).getDate()}`};
  const d=gaDays(p.due_date,gaToday());
  if(+p.amount_paid>0)return{c:'var(--gold)',ic:'circle-dashed',l:`Partiel : ${gaEur(p.amount_paid)} / ${gaEur(p.amount)}`};
  if(d>0)return{c:'var(--red)',ic:'x-circle',l:`${ML} : retard J+${d}`};
  return{c:'var(--td)',ic:'clock',l:`Échéance le ${gaFrC(p.due_date)}`};
}
function gaAlerts(m){
  const A=[];const t=gaTen(m);const f=m.fin_bail||{};const today=gaToday();
  const imp=gaPays(m).filter(p=>gaUnpaid(p)&&gaDays(p.due_date,today)>0);const it=imp.reduce((s,p)=>s+gaReste(p),0);
  if(imp.length>1||(imp.length&&gaDays(imp[0].due_date,today)>=30))A.push({r:1,ic:'alert-triangle',l:`Impayé ${gaEur(it)}`});
  if(f.edl_sortie&&!f.depot_restitue){const lim=gaAddM(f.edl_sortie,f.edl_conforme===false?2:1);A.push({r:gaDays(today,lim)<7?1:0,ic:'piggy-bank',l:`Dépôt à restituer avant le ${gaFrC(lim)}`});}
  else if(f.preavis_recu&&!f.edl_sortie)A.push({r:0,ic:'door-open',l:`Départ le ${gaFrC(f.date_fin)}`});
  const dpe=GA.ech.find(x=>x.mandat_id===m.id&&x.type==='dpe');if(['F','G'].includes(String(dpe?.resultat||'').toUpperCase()))A.push({r:1,ic:'thermometer',l:`DPE ${dpe.resultat.toUpperCase()}`});
  if(t){const e=GA.ech.find(x=>x.mandat_id===m.id&&x.type==='assurance_habitation');
    if(!e)A.push({r:0,ic:'shield-alert',l:'Attestation d’assurance manquante'});
    else if(e.date_expiration&&gaDays(today,e.date_expiration)<0)A.push({r:1,ic:'shield-x',l:'Assurance habitation expirée'});}
  for(const i of GA.inter.filter(i=>i.mandat_id===m.id&&!['facture','annule'].includes(i.statut)))A.push({r:i.urgence==='urgente'?1:0,ic:'wrench',l:`${i.titre} (${(GA_IST[i.statut]||[i.statut])[0].toLowerCase()})`});
  if(t){const i=gaIrlInfo(m);if(i?.due)A.push({r:0,ic:'trending-up',l:`Révision IRL : ${gaEur(i.nouveau)}`});}
  return A.sort((a,b)=>b.r-a.r);
}
function gaCard(m,tasks){
  const t=gaTen(m);const st=gaMoisStatut(m);const al=gaAlerts(m).filter(a=>!/^Impayé/.test(a.l));tasks=tasks||gaTasksOf(m);const urg=tasks.some(x=>x.p===1);
  const imp=gaImpayes(m);const red=imp.length>0;const der=red?gaDerniereRelance(imp):null;const nx=red?gaProchaineRelance(m,imp):null;
  const bd=red?'rgba(224,90,90,.6)':'';
  return`<div class="card" onclick="gaGo({t:'bien',id:'${m.id}'})" style="cursor:pointer;transition:border-color .15s;overflow:hidden;display:flex;flex-direction:column;${red?'border-color:'+bd+';background:linear-gradient(180deg,rgba(224,90,90,.10),transparent 55%),var(--s)':''}" onmouseover="this.style.borderColor='var(--agencybright)'" onmouseout="this.style.borderColor='${bd}'">
    ${red?`<div style="background:var(--red);color:#fff;font-size:.72rem;font-weight:700;padding:.4rem 1rem;display:flex;justify-content:space-between;gap:.5rem;flex-wrap:wrap"><span><i data-lucide=alert-triangle class=ic></i> Impayé ${gaEur(imp.reduce((s,p)=>s+gaReste(p),0))}</span><span style="font-weight:500;opacity:.92">${der?der.l+' le '+gaFrC(der.d):nx?'relance auto le '+gaFrC(nx.d<gaToday()?gaAddDays(gaToday(),1):nx.d):''}</span></div>`:''}
    <div class="cb" style="display:flex;flex-direction:column;gap:.35rem;flex:1">
      <div style="display:flex;justify-content:space-between;gap:.5rem;align-items:flex-start"><div style="font-weight:700;font-size:.92rem;line-height:1.3">${gaE(gaBien(m))}</div>${tasks.length?`<span class="badge ${urg?'b-red':'b-gold'}" style="font-size:.62rem;white-space:nowrap">${tasks.length} à faire</span>`:''}</div>
      <div style="font-size:.78rem;color:var(--tm)">${t?`${gaE(t.nom)} · ${gaEur(t.hc+t.ch)}`:'<span style="color:var(--gold)">Sans locataire</span>'}</div>
      <div style="font-size:.8rem;font-weight:600;color:${st.c};display:flex;align-items:center;gap:.35rem"><i data-lucide=${st.ic} class=ic></i> ${st.l}</div>
      ${al.slice(0,3).map(a=>`<div style="font-size:.74rem;color:${a.r?'var(--red)':'var(--gold)'};display:flex;align-items:center;gap:.35rem"><i data-lucide=${a.ic} class=ic></i> ${gaE(a.l)}</div>`).join('')}
      ${al.length>3?`<div style="font-size:.7rem;color:var(--td)">+ ${al.length-3} autre${al.length>4?'s':''}</div>`:''}
      <div style="font-size:.72rem;color:var(--td);margin-top:auto;padding-top:.35rem;border-top:1px solid var(--b)">Propriétaire : ${gaE(m.owner_name||'—')}</div>
    </div></div>`;
}

// ── Fiche d'un bien ─────────────────────────────────────────────────
function gaFicheTab(id,s){GA.view={t:'bien',id,s};gaRender();}
function gaRenderFiche(id,sub){
  const m=gaMandat(id);if(!m){GA.view={t:'home'};return gaRenderHome();}
  const t=gaTen(m);const st=gaMoisStatut(m);
  const cur=gaPays(m).filter(p=>p.status!=='cancelled').sort((a,b)=>a.due_date.localeCompare(b.due_date));
  const next=cur.find(p=>gaUnpaid(p));const lastPaid=[...cur].reverse().find(p=>p.status==='paid');
  const tabs=[['suivi','Suivi','activity'],['loc','Locataire','user'],['loyers','Loyers','wallet'],['docs','Documents','folder'],['travaux','Travaux','wrench'],['proprio','Propriétaire','briefcase']];
  const body={suivi:gaFSuivi,loc:gaFLoc,loyers:gaFLoyers,docs:gaFDocs,travaux:gaFTravaux,proprio:gaFProprio}[sub]||gaFSuivi;
  return`<button class="btn bg bsm" onclick="gaGo({t:'home'})" style="margin-bottom:.9rem"><i data-lucide=arrow-left class=ic></i> Mes biens gérés</button>
  <div class="card" style="margin-bottom:.9rem"><div class="cb">
    <div style="display:flex;justify-content:space-between;gap:.8rem;flex-wrap:wrap">
      <div><div style="font-size:1.1rem;font-weight:700">${gaE(gaBien(m))}</div>
        <div style="font-size:.76rem;color:var(--td)">${gaE(gaAdresse(m))} · mandat n° ${m.numero||'—'} · ${gaE(m.owner_name||'')}</div>
        <div style="font-size:.84rem;font-weight:600;color:${st.c};margin-top:.4rem;display:flex;align-items:center;gap:.35rem"><i data-lucide=${st.ic} class=ic></i> ${st.l}</div></div>
      <div style="display:flex;gap:.35rem;flex-wrap:wrap;align-items:flex-start">
        ${next?`<button class="btn bp bsm" onclick="gaEncaisser('${next.id}')"><i data-lucide=wallet class=ic></i> Loyer reçu</button>`:''}
        ${lastPaid?`<button class="btn bg bsm" onclick="gaQuittance('${lastPaid.id}',true)"><i data-lucide=receipt class=ic></i> Quittance</button>`:''}
        <button class="btn bg bsm" onclick="gaNewInter('${m.id}')"><i data-lucide=wrench class=ic></i> Travaux</button>
        <button class="btn bg bsm" onclick="gaEditMandat('${m.id}')" title="Réglages"><i data-lucide=settings class=ic></i></button>
      </div>
    </div></div></div>
  ${gaBandeauImpaye(m)}
  <div class="tabs" style="flex-wrap:wrap">${tabs.map(([k,l,i])=>`<button class="tab ${sub===k?'act':''}" onclick="gaFicheTab('${m.id}','${k}')"><i data-lucide=${i} class=ic></i> ${l}</button>`).join('')}</div>
  ${body(m,t)}`;
}
const gaRow=(l,v)=>`<div style="display:flex;justify-content:space-between;gap:1rem;padding:.45rem 0;border-bottom:1px solid var(--b);font-size:.82rem"><span style="color:var(--td)">${l}</span><span style="text-align:right">${v}</span></div>`;
function gaFLoc(m,t){
  const f=m.fin_bail||{};
  if(!t)return`<div class="card"><div class="cb" style="text-align:center;padding:1.5rem">
    <div style="font-size:.9rem;font-weight:600;margin-bottom:.3rem">Pas de locataire en ce moment</div>
    <div style="font-size:.78rem;color:var(--td);margin-bottom:.9rem">Mettez l’annonce en ligne : la candidature, le bail et l’état des lieux se font sur Trouve Ton Toit, puis le bail se rattache ici.</div>
    <div style="display:flex;gap:.4rem;justify-content:center;flex-wrap:wrap"><button class="btn bp bsm" onclick="sp('new-listing')">Créer l’annonce</button><button class="btn bg bsm" onclick="gaEditMandat('${m.id}')">Ajouter un locataire déjà en place</button></div>
    ${f.edl_sortie&&!f.depot_restitue?`<div style="margin-top:1rem"><button class="btn bp bsm" onclick="gaDepotModal('${m.id}')">Restituer le dépôt de ${gaE(f.locataire||'l’ancien locataire')}</button></div>`:''}
  </div></div>`;
  const irl=gaIrlInfo(m);
  const gar=t.visale?'Visale':t.garant_nom?`Caution : ${gaE(t.garant_nom)}`:m.gli?'Assurance loyers impayés':'Aucune';
  return`<div class="card" style="margin-bottom:.8rem"><div class="cb">
    ${gaRow('Locataire',`<strong>${gaE(t.nom)}</strong>${t.src==='ttt'?' '+gaBadge('Bail Trouve Ton Toit','b-sea'):''}`)}
    ${gaRow('Contact',[t.email,t.tel].filter(Boolean).map(gaE).join(' · ')||'—')}
    ${gaRow('Loyer',`${gaEur(t.hc)} + ${gaEur(t.ch)} de charges = <strong>${gaEur(t.hc+t.ch)}</strong>, le ${t.jour} du mois`)}
    ${gaRow('Dépôt de garantie',gaEur(t.depot))}
    ${gaRow('Bail',`${t.meuble?'Meublé':'Vide'} · depuis le ${gaFrC(t.debut)}${t.fin?' · échéance '+gaFrC(t.fin):''}`)}
    ${gaRow('Garantie',gar)}
    ${gaRow('Révision IRL',irl?.gel?'Gelée (DPE F/G)':irl?.due?`${gaEur(irl.ancien)} → <strong>${gaEur(irl.nouveau)}</strong> <button class="btn bp bsm" onclick="gaApplyIrl('${m.id}')">Appliquer</button>`:'À jour')}
    ${t.src==='ttt'&&t.lease?gaRow('Documents du bail',`<a href="/bail-meuble.html?lease_id=${t.lease.id}&role=landlord" target="_blank" style="color:var(--agencybright)">Bail</a>${t.lease.booking_id?` · <a href="/edl-meuble.html?booking_id=${t.lease.booking_id}" target="_blank" style="color:var(--agencybright)">État des lieux</a>`:''}`):''}
  </div></div>
  <div class="card"><div class="cb">
    <div style="font-size:.78rem;font-weight:700;margin-bottom:.5rem"><i data-lucide=door-open class=ic></i> Départ du locataire</div>
    ${f.preavis_recu?`<div style="font-size:.8rem;margin-bottom:.6rem">Préavis reçu le ${gaFrC(f.preavis_recu)} — départ le <strong>${gaFrC(f.date_fin)}</strong>${f.edl_sortie?` · état des lieux de sortie le ${gaFrC(f.edl_sortie)}`:''}${f.depot_restitue?` · dépôt restitué le ${gaFrC(f.depot_restitue)}`:''}</div>`:`<div style="font-size:.78rem;color:var(--td);margin-bottom:.6rem">Le locataire part ? Indiquez la date de réception du préavis : la date de départ, l’arrêt des loyers et le délai de restitution du dépôt sont calculés pour vous.</div>`}
    <div style="display:flex;gap:.4rem;flex-wrap:wrap"><button class="btn bg bsm" onclick="gaEditFin('${m.id}')">${f.preavis_recu?'Modifier':'Enregistrer un préavis'}</button>${f.edl_sortie&&!f.depot_restitue?`<button class="btn bp bsm" onclick="gaDepotModal('${m.id}')">Restituer le dépôt</button>`:''}${t.fin?`<button class="btn bg bsm" onclick="gaInfoEcheanceBail('${m.id}')">Prévenir le propriétaire de l’échéance</button>`:''}</div>
  </div></div>`;
}
function gaFLoyers(m,t){
  t=t||gaTen(m);
  const today=gaToday();
  const ps=gaPays(m).filter(p=>p.status!=='cancelled').sort((a,b)=>b.due_date.localeCompare(a.due_date)).slice(0,15);
  const imp=gaPays(m).filter(p=>gaUnpaid(p)&&gaDays(p.due_date,today)>0);
  const auto=[m.auto_avis&&'avis d’échéance',m.auto_relances&&'relances',m.auto_quittance&&'quittances'].filter(Boolean);
  const outils=`<div style="display:flex;gap:.4rem;flex-wrap:wrap;margin-bottom:.8rem">
    <button class="btn bg bsm" onclick="gaRapprochement()"><i data-lucide=landmark class=ic></i> Importer un relevé bancaire</button>
    ${t?.ch>0?`<button class="btn bg bsm" onclick="gaRegulModal('${m.id}')"><i data-lucide=calculator class=ic></i> Régulariser les charges</button>`:''}
    ${t?`<button class="btn bg bsm" onclick="gaTeomModal('${m.id}')"><i data-lucide=trash-2 class=ic></i> Refacturer la TEOM</button>`:''}
  </div>`;
  return outils+`${imp.length?`<div class="card" style="margin-bottom:.8rem;border-color:rgba(224,90,90,.35)"><div class="cb">
      <div style="display:flex;justify-content:space-between;gap:.5rem;flex-wrap:wrap;align-items:center"><div style="font-weight:700;color:var(--red)">Impayé : ${gaEur(imp.reduce((s,p)=>s+gaReste(p),0))}</div>
      <div style="display:flex;gap:.3rem;flex-wrap:wrap"><button class="btn bg bsm" onclick="gaApurement('${m.id}')">Plan d’apurement</button><button class="btn bg bsm" onclick="gaInfoProprioImpaye('${m.id}')">Prévenir le propriétaire</button></div></div>
      ${imp.map(p=>{const st=gaStage(m,p);return`<div style="margin-top:.55rem;font-size:.8rem"><strong>${gaMoisLbl(String(p.due_date).slice(0,7))}</strong> — ${gaEur(gaReste(p))} (J+${gaDays(p.due_date,today)})
        <span style="color:var(--td)">${[p.relance_at&&'relancé',p.relance2_at&&'2ᵉ relance',p.garant_informe_at&&'garant informé',p.mise_en_demeure_at&&'mise en demeure',p.gli_declare_at&&'garantie déclarée',p.commandement_at&&'commandement'].filter(Boolean).join(' · ')}</span>
        ${st.length?`<div style="display:flex;gap:.3rem;flex-wrap:wrap;margin-top:.35rem">${st.map(s=>`<button class="btn bp bsm" onclick="${s.a}">${gaE(s.l)}</button>`).join('')}</div>`:''}</div>`;}).join('')}
    </div></div>`:''}
  <div class="card"><div style="overflow-x:auto"><table class="tbl"><thead><tr><th>Mois</th><th>Montant</th><th>Statut</th><th></th></tr></thead><tbody>
  ${ps.length?ps.map(p=>{const d=gaDays(p.due_date,today);const s=p.status==='paid'?gaBadge('Reçu le '+gaFrC(p.paid_at),'b-green'):+p.amount_paid>0?gaBadge('Partiel '+gaEur(p.amount_paid),'b-gold'):d>0?gaBadge('Retard J+'+d,'b-red'):gaBadge('Le '+gaFrC(p.due_date),'b-dim');
    return`<tr><td style="text-transform:capitalize">${gaMoisLbl(String(p.due_date).slice(0,7))}</td><td>${gaEur(p.amount)}</td><td>${s}</td><td style="text-align:right;white-space:nowrap">${p.status==='paid'
      ?`<button class="btn bg bsm" onclick="gaQuittance('${p.id}')" title="Quittance PDF"><i data-lucide=download class=ic></i></button> <button class="btn bg bsm" onclick="gaQuittance('${p.id}',true)" title="Envoyer la quittance"><i data-lucide=send class=ic></i></button>`
      :`<button class="btn bp bsm" onclick="gaEncaisser('${p.id}')">Reçu</button> <button class="btn bg bsm" onclick="gaAvis('${p.id}')" title="Avis d’échéance PDF"><i data-lucide=file-text class=ic></i></button>`}</td></tr>`;}).join(''):`<tr><td colspan="4" style="color:var(--td)">Aucun loyer pour l’instant.</td></tr>`}
  </tbody></table></div></div>
  <div style="font-size:.72rem;color:var(--td);margin-top:.6rem">${auto.length?`Envoyé automatiquement : ${auto.join(', ')}.`:'Aucun envoi automatique sur ce bien.'} <a href="#" onclick="gaEditMandat('${m.id}');return false" style="color:var(--agencybright)">Modifier</a></div>`;
}
function gaFDocs(m,t){
  const keys=Object.keys(GA_DOCS).filter(k=>gaDocApplies(m,k)&&(GA_DOCS[k].qui!=='locataire'||t));
  return`<div class="card"><div class="cb" style="padding:.4rem 1rem">
  ${keys.map(k=>{const s=gaDocState(m,k);const def=GA_DOCS[k];return`<div style="display:flex;justify-content:space-between;align-items:center;gap:.6rem;padding:.6rem 0;border-bottom:1px solid var(--b)">
    <div style="min-width:0"><div style="font-size:.82rem;font-weight:600">${def.l}</div><div style="font-size:.72rem;color:var(--td)">${s.e?.date_document?'du '+gaFrC(s.e.date_document):''}${s.e?.resultat?' · '+gaE(s.e.resultat):''}${s.e?.fichier_url?` · <a href="${gaE(s.e.fichier_url)}" target="_blank" style="color:var(--agencybright)">voir</a>`:''}</div></div>
    <div style="display:flex;gap:.3rem;align-items:center;flex-shrink:0">${gaBadge(s.l==='ok'?'à jour':s.l,s.c)}
      ${def.qui==='locataire'&&s.c!=='b-green'?`<button class="btn bg bsm" onclick="gaDemandeDoc('${m.id}','${k}')">Demander</button>`:''}
      <button class="btn bg bsm" onclick="gaEditEch('${m.id}','${k}')"><i data-lucide=pencil class=ic></i></button></div></div>`;}).join('')}
  </div></div>`;
}
function gaFTravaux(m){
  const list=GA.inter.filter(i=>i.mandat_id===m.id).sort((a,b)=>String(b.created_at).localeCompare(String(a.created_at)));
  const tk=new Set(GA.inter.map(i=>i.ticket_id).filter(Boolean));
  const tickets=GA.tickets.filter(x=>x.listing_id&&x.listing_id===m.listing_id&&!tk.has(x.id)&&!['resolved','closed'].includes(x.status||x.statut));
  return`<div style="margin-bottom:.7rem"><button class="btn bp bsm" onclick="gaNewInter('${m.id}')"><i data-lucide=plus class=ic></i> Nouvelle intervention</button></div>
  ${tickets.map(k=>`<div class="card" style="margin-bottom:.5rem;border-color:rgba(224,90,90,.35)"><div class="cb" style="display:flex;justify-content:space-between;gap:.5rem"><div style="font-size:.8rem"><strong>Signalé par le locataire : ${gaE(k.title||'')}</strong><div style="font-size:.72rem;color:var(--td)">${gaFrC(k.created_at)} · ${gaE(String(k.description||'').slice(0,140))}</div></div><button class="btn bp bsm" onclick="gaInterFromTicket('${k.id}')">Traiter</button></div></div>`).join('')}
  ${list.length?list.map(i=>{const[l,c]=GA_IST[i.statut]||[i.statut,'b-dim'];return`<div class="card" style="margin-bottom:.5rem;cursor:pointer" onclick="gaEditInter('${i.id}')"><div class="cb" style="display:flex;justify-content:space-between;gap:.5rem;align-items:center">
    <div><div style="font-size:.84rem;font-weight:600">${gaE(i.titre)}</div><div style="font-size:.72rem;color:var(--td)">${gaFrC(i.created_at)}${i.prestataire_nom?' · '+gaE(i.prestataire_nom):''}${i.devis_montant?' · devis '+gaEur(i.devis_montant):''}${i.montant_final?' · facturé '+gaEur(i.montant_final):''}</div></div>${gaBadge(l,c)}</div></div>`;}).join('')
    :tickets.length?'':gaEmpty('wrench','Aucuns travaux sur ce bien.')}`;
}
function gaFProprio(m){
  const k=gaOwnerKey(m);const s=gaSolde(k);const prev=gaAddM(gaYm(new Date())+'-01',-1).slice(0,7);const crg=GA.crg.find(x=>x.owner_key===k&&x.periode===prev);
  const autres=GA.mandats.filter(x=>x.id!==m.id&&gaOwnerKey(x)===k);
  return`<div class="card" style="margin-bottom:.8rem"><div class="cb">
    ${gaRow('Propriétaire',`<strong>${gaE(m.owner_name||'—')}</strong>`)}
    ${gaRow('Contact',[m.owner_email,m.owner_phone].filter(Boolean).map(gaE).join(' · ')||'—')}
    ${gaRow('IBAN',gaE(m.owner_iban||'à compléter'))}
    ${gaRow('Honoraires de gestion',`${m.taux_honoraires||0} % TTC des encaissements${Number(m.frais_fixes)?' + '+gaEur(m.frais_fixes)+'/mois':''}${m.gli?` · GLI ${m.gli_taux} %`:''}`)}
    ${gaRow('Solde à lui reverser',`<strong style="color:${s>0?'var(--green)':'var(--txt)'}">${gaEur(s)}</strong>`)}
    ${autres.length?gaRow('Ses autres biens',autres.map(x=>`<a href="#" onclick="gaGo({t:'bien',id:'${x.id}'});return false" style="color:var(--agencybright)">${gaE(gaBien(x))}</a>`).join(', ')):''}
    <div style="display:flex;gap:.35rem;flex-wrap:wrap;margin-top:.8rem">
      <button class="btn bp bsm" onclick="gaReverser('${gaQ(k)}')" ${s>0.009?'':'disabled'}><i data-lucide=send class=ic></i> Reverser</button>
      <button class="btn bg bsm" onclick="gaEnvoyerCrg('${gaQ(k)}','${prev}')"><i data-lucide=mail class=ic></i> ${crg?.envoye_at?'Renvoyer':'Envoyer'} le compte rendu de ${gaMoisLbl(prev).split(' ')[0]}</button>
      <button class="btn bg bsm" onclick="gaCrgPdf('${gaQ(k)}','${prev}')"><i data-lucide=download class=ic></i> PDF</button>
      <button class="btn bg bsm" onclick="gaOpModal('${m.id}')"><i data-lucide=plus class=ic></i> Dépense / écriture</button>
      <button class="btn bg bsm" onclick="GA.annee=new Date().getFullYear()-(new Date().getMonth()<6?1:0);gaFiscalPdf('${gaQ(k)}')"><i data-lucide=landmark class=ic></i> Récap fiscal</button>
      <button class="btn bg bsm" onclick="GA.annee=new Date().getFullYear()-(new Date().getMonth()<6?1:0);gaFiscalMail('${gaQ(k)}')"><i data-lucide=mail class=ic></i> Envoyer le récap fiscal</button>
      <button class="btn bg bsm" onclick="gaMandatPdf('${m.id}')"><i data-lucide=file-text class=ic></i> Fiche mandat</button>
      <button class="btn bg bsm" onclick="gaEditMandat('${m.id}')"><i data-lucide=settings class=ic></i> Réglages du mandat</button>
      <button class="btn bg bsm" onclick="gaRegistreCsv()"><i data-lucide=download class=ic></i> Registre des mandats</button>
    </div>
    ${(()=>{const c=gaCompte(k,gaYm(new Date())+'-01',gaNextMonth());return c.lignes.length?`<details style="margin-top:.7rem"><summary style="font-size:.74rem;cursor:pointer;color:var(--td)">Écritures du mois (${c.lignes.length})</summary>${c.lignes.map(l=>`<div style="display:flex;justify-content:space-between;gap:.6rem;font-size:.74rem;padding:.25rem 0;border-bottom:1px solid var(--b)"><span>${gaFrC(l.date)} · ${gaE(l.lib)}</span><span style="color:${l.cr?'var(--green)':'var(--txt)'}">${l.cr?'+ '+gaEur(l.cr):'− '+gaEur(l.db)}</span></div>`).join('')}</details>`:'';})()}
    ${crg?.envoye_at?`<div style="font-size:.7rem;color:var(--td);margin-top:.4rem">Compte rendu de ${gaMoisLbl(prev)} envoyé le ${gaFrC(crg.envoye_at)}.</div>`:''}
  </div></div>`;
}

// ── Ajout rapide d'un bien ──────────────────────────────────────────
function gaQuickAdd(pre){
  pre=pre||{};
  const linked=new Set(GA.mandats.map(m=>m.lease_id).filter(Boolean));
  const leases=GA.leases.filter(l=>!l.parent_booking_id&&!linked.has(l.id)&&['signed','agreed'].includes(l.negotiation_status));
  gaModal(`<div style="font-size:1.05rem;font-weight:700;margin-bottom:.2rem"><i data-lucide=home class=ic></i> Ajouter un bien en gestion</div>
  <div style="font-size:.76rem;color:var(--td);margin-bottom:.9rem">Le reste se règle par défaut (honoraires, envois automatiques…) et se modifie plus tard dans la fiche du bien.</div>
  <div class="fgrid2">
    <div class="fg" style="grid-column:1/-1"><label class="fl">Logement</label><select class="fsel" id="gq-bien" onchange="gaQAToggle()">
      ${GA.listings.map(l=>`<option value="${l.id}" ${pre.listing_id===l.id?'selected':''}>${gaE(l.title||l.full_address)}</option>`).join('')}
      <option value="" ${!GA.listings.length||pre.listing_id===''?'selected':''}>Autre logement (saisir l’adresse)</option></select></div>
    <div class="fg" id="gq-adr-w" style="grid-column:1/-1;display:none"><label class="fl">Adresse du logement</label><input class="fi" id="gq-adr" placeholder="12 rue de la Paix, 69002 Lyon"></div>
    <div class="fg"><label class="fl">Propriétaire *</label><input class="fi" id="gq-on" value="${gaE(pre.owner_name||'')}" placeholder="Prénom Nom"></div>
    <div class="fg"><label class="fl">Son e-mail</label><input class="fi" id="gq-oe" type="email" value="${gaE(pre.owner_email||'')}" placeholder="pour les comptes rendus"></div>
    <div class="fg" style="grid-column:1/-1"><label class="fl">Locataire</label><select class="fsel" id="gq-loc" onchange="gaQAToggle()">
      ${leases.map(l=>`<option value="${l.id}" ${pre.lease_id===l.id?'selected':''}>${gaE((GA.profiles[l.tenant_id]?.full_name||'Locataire')+' — bail signé sur Trouve Ton Toit ('+(l.listing_title||'')+')')}</option>`).join('')}
      <option value="ext">Locataire déjà en place (bail signé ailleurs)</option>
      <option value="" ${!leases.length?'selected':''}>Aucun pour l’instant</option></select></div>
    <div id="gq-ext" class="fgrid2" style="grid-column:1/-1;display:none">
      <div class="fg"><label class="fl">Nom du locataire</label><input class="fi" id="gq-ln"></div>
      <div class="fg"><label class="fl">Son e-mail</label><input class="fi" id="gq-le" type="email"></div>
      <div class="fg"><label class="fl">Loyer hors charges (€)</label><input class="fi" id="gq-hc" type="number" step="0.01"></div>
      <div class="fg"><label class="fl">Charges (€/mois)</label><input class="fi" id="gq-ch" type="number" step="0.01" value="0"></div>
      <div class="fg"><label class="fl">Payé le … du mois</label><input class="fi" id="gq-j" type="number" value="1" min="1" max="28"></div>
      <div class="fg"><label class="fl">Dépôt de garantie (€)</label><input class="fi" id="gq-dep" type="number" step="0.01"></div>
    </div>
    <div class="fg"><label class="fl">Honoraires de gestion (% TTC)</label><input class="fi" id="gq-hon" type="number" step="0.1" value="7"></div>
  </div>
  <div style="display:flex;justify-content:flex-end;gap:.5rem;margin-top:1rem"><button class="btn bg" onclick="gaCloseModal()">Annuler</button><button class="btn bp" onclick="gaQuickSave()">Ajouter</button></div>`);
  gaQAToggle();
}
function gaQAToggle(){
  const b=gaV('gq-bien'),l=gaV('gq-loc');
  const w=document.getElementById('gq-adr-w');if(w)w.style.display=b?'none':'block';
  const e=document.getElementById('gq-ext');if(e)e.style.display=l==='ext'?'grid':'none';
  // Pré-remplir le propriétaire depuis l'annonce
  const li=gaListing(b);if(li&&!gaV('gq-on')&&li.manual_landlord_name){document.getElementById('gq-on').value=li.manual_landlord_name;if(li.manual_landlord_email)document.getElementById('gq-oe').value=li.manual_landlord_email;}
}
async function gaQuickSave(){
  const b=gaV('gq-bien'),l=gaV('gq-loc');const li=gaListing(b);const L=l&&l!=='ext'?gaLease(l):null;
  const row={agency_id:U.id,numero:gaNextNumero(),date_signature:gaToday(),duree_mois:12,tacite:true,statut:'actif',
    owner_name:gaV('gq-on'),owner_email:gaV('gq-oe').toLowerCase()||null,owner_phone:li?.manual_landlord_phone||null,owner_address:li?.manual_landlord_address||null,
    listing_id:b||L?.listing_id||null,bien_label:li?.title||L?.listing_title||null,bien_adresse:li?.full_address||gaV('gq-adr')||null,bien_surface:li?.sqm||null,
    bien_meuble:L?.type_bail?L.type_bail!=='vide':(li?.['meublé']??li?.furnished??true),
    taux_honoraires:gaN('gq-hon')??7,base_honoraires:'cc',frais_fixes:0,seuil_travaux:300,reversement_jour:10,gli:false,gli_taux:2.5,gli_delai_jours:30,depot_detenu_par:'agence',
    auto_avis:true,auto_relances:true,auto_quittance:false,auto_crg:true,auto_conformite:true,
    lease_id:L?.id||null};
  if(l==='ext')Object.assign(row,{loc_nom:gaV('gq-ln')||null,loc_email:gaV('gq-le').toLowerCase()||null,loc_loyer_hc:gaN('gq-hc'),loc_charges:gaN('gq-ch')??0,loc_jour:gaN('gq-j')||1,loc_depot:gaN('gq-dep'),loc_debut:gaToday()});
  if(!row.owner_name){toast('Indiquez le propriétaire');return;}
  if(!row.listing_id&&!row.bien_adresse){toast('Indiquez le logement');return;}
  if(l==='ext'&&(!row.loc_nom||!row.loc_loyer_hc)){toast('Indiquez le nom du locataire et le loyer');return;}
  if(!row.bien_label)row.bien_label=(row.bien_adresse||'').split(',')[0]||null;
  if(row.owner_email){try{const{data:p}=await sb.from('profiles').select('clerk_id').ilike('email',row.owner_email).maybeSingle();if(p?.clerk_id)row.owner_clerk_id=p.clerk_id;}catch(e){}}
  const{data,error}=await sb.from('gestion_mandats').insert(row).select().single();
  if(error){toast('<i data-lucide=x-circle class=ic></i> '+error.message);return;}
  GA.mandats.push(data);gaCloseModal();await gaAttachPayments();await gaEnsureSchedule();
  toast('<i data-lucide=check-circle-2 class=ic></i> Bien ajouté — les loyers sont programmés');gaGo({t:'bien',id:data.id});
}
// Raccourcis existants → nouvel ajout rapide
function gaNewMandatFromLease(leaseId){const L=gaLease(leaseId);const li=gaListing(L?.listing_id);gaQuickAdd({lease_id:leaseId,listing_id:L?.listing_id||'',owner_name:li?.manual_landlord_name||L?.landlord_name||'',owner_email:li?.manual_landlord_email||L?.landlord_email||''});}

// ── Actions groupées ────────────────────────────────────────────────
function gaListModal(title,intro,rows,foot){
  gaModal(`<div style="font-size:1rem;font-weight:700;margin-bottom:.3rem">${title}</div>${intro?`<div style="font-size:.76rem;color:var(--td);margin-bottom:.7rem;line-height:1.5">${intro}</div>`:''}
  <div>${rows.map(r=>`<div style="display:flex;justify-content:space-between;align-items:center;gap:.6rem;padding:.6rem 0;border-bottom:1px solid var(--b)">
    <div style="min-width:0;font-size:.82rem"><strong>${r.t}</strong>${r.d?`<div style="font-size:.72rem;color:var(--td)">${r.d}</div>`:''}</div>
    <div style="display:flex;gap:.3rem;flex-wrap:wrap;justify-content:flex-end">${(r.b||[]).map(([l,f],k)=>`<button class="btn ${k?'bg':'bp'} bsm" onclick="${f}">${l}</button>`).join('')}</div></div>`).join('')}</div>${foot||''}`,true);
}
async function gaRunAll(label,items,fn){
  gaCloseModal();let n=0;for(const x of items){try{await fn(x);n++;}catch(e){console.error(e);}}
  toast(`<i data-lucide=check-circle-2 class=ic></i> ${n} ${label}`);gaRender();
}
async function gaBulkRelances(){const B=gaBulk();if(!confirm(`Envoyer ${B.relances.length} relance(s) par e-mail et messagerie ?\n\n`+B.relances.map(x=>`• ${gaTen(x.m)?.nom||''} — ${gaEur(gaReste(x.p))} (${gaBien(x.m)})`).join('\n')))return;
  await gaRunAll('relance(s) envoyée(s)',B.relances,x=>gaRelance(x.p.id,x.n,true));}
function gaBulkMed(){const B=gaBulk();gaListModal('Mises en demeure à envoyer','Retard de plus de 30 jours. Téléchargez la lettre et envoyez-la en recommandé avec accusé de réception : l’étape est alors notée comme faite.',
  B.med.map(x=>({t:`${gaE(gaTen(x.m)?.nom||'')} — ${gaEur(gaReste(x.p))}`,d:`${gaE(gaBien(x.m))} · échéance du ${gaFrC(x.p.due_date)}`,b:[['Lettre + noter envoyée',`gaMiseEnDemeure('${x.p.id}');this.closest('div[style*=border-bottom]').style.opacity=.4`],['Voir le bien',`gaCloseModal();gaGo({t:'bien',id:'${x.m.id}',s:'loyers'})`]]})));}
function gaBulkGaranties(){const B=gaBulk();gaListModal('Démarches garant / assurance','Information du garant, déclaration à l’assurance loyers impayés ou à Visale, commandement de payer.',
  B.garanties.map(x=>({t:gaE(x.s.l),d:`${gaE(gaTen(x.m)?.nom||'')} · ${gaE(gaBien(x.m))} · ${gaEur(gaReste(x.p))}`,b:[['Faire',`gaCloseModal();${x.s.a}`]]})));}
function gaBulkRev(){
  const B=gaBulk();
  gaModal(`<div style="font-size:1rem;font-weight:700;margin-bottom:.3rem"><i data-lucide=send class=ic></i> Reversements aux propriétaires</div>
  <div style="font-size:.76rem;color:var(--td);margin-bottom:.7rem">Faites les virements depuis votre banque (fichier CSV ci-dessous), puis validez : les reversements sont enregistrés et chaque propriétaire reçoit son compte rendu.</div>
  ${B.rev.map((x,i)=>`<label style="display:flex;justify-content:space-between;align-items:center;gap:.6rem;padding:.55rem 0;border-bottom:1px solid var(--b);font-size:.82rem;cursor:pointer">
    <span><input type="checkbox" id="gbr-${i}" checked> <strong>${gaE(x.o.name)}</strong><span style="display:block;font-size:.72rem;color:var(--td);margin-left:1.3rem">${gaE(x.o.iban||'IBAN manquant')}</span></span><strong>${gaEur(x.s)}</strong></label>`).join('')}
  <div style="display:flex;justify-content:space-between;gap:.5rem;margin-top:1rem;flex-wrap:wrap"><button class="btn bg bsm" onclick="gaVirementsCsv()"><i data-lucide=download class=ic></i> Fichier des virements</button>
  <button class="btn bp" onclick="gaBulkRevSave()">Valider les reversements cochés</button></div>`);
}
async function gaBulkRevSave(){
  const B=gaBulk();const sel=B.rev.filter((x,i)=>document.getElementById('gbr-'+i)?.checked);
  await gaRunAll('reversement(s) enregistré(s)',sel,async x=>{
    const{data}=await sb.from('gestion_operations').insert({agency_id:U.id,mandat_id:x.o.ms[0].id,date:gaToday(),type:'reversement',libelle:`Reversement au propriétaire${x.o.iban?' — '+x.o.iban:''}`,montant:-gaR(x.s)}).select().single();
    if(data)GA.ops.push(data);await gaEnvoyerCrg(x.o.key,gaYm(new Date()),true);});
}
async function gaBulkQuitt(){const B=gaBulk();if(!confirm(`Envoyer ${B.quitt.length} quittance(s) par e-mail ?`))return;await gaRunAll('quittance(s) envoyée(s)',B.quitt,x=>gaQuittance(x.p.id,true,true));}
async function gaBulkAvis(){const B=gaBulk();if(!confirm(`Envoyer ${B.avis.length} avis d’échéance par e-mail ?`))return;await gaRunAll('avis envoyé(s)',B.avis,x=>gaAvis(x.p.id,true));}
function gaBulkIrl(){const B=gaBulk();gaListModal('Révisions de loyer (IRL)','Le nouveau loyer s’applique à partir de la prochaine échéance ; le locataire est prévenu automatiquement.',
  B.irl.map(x=>({t:`${gaE(gaTen(x.m)?.nom||'')} : ${gaEur(x.i.ancien)} → ${gaEur(x.i.nouveau)}`,d:`${gaE(gaBien(x.m))} · ${gaE(x.i.ref)}`,b:[['Appliquer',`gaCloseModal();gaApplyIrl('${x.m.id}')`]]})));}
async function gaBulkDocs(){const B=gaBulk();if(!confirm(`Demander ${B.docs.length} attestation(s) aux locataires ?\n\n`+B.docs.map(x=>`• ${GA_DOCS[x.k].l} — ${gaTen(x.m)?.nom||''}`).join('\n')))return;
  await gaRunAll('demande(s) envoyée(s)',B.docs,x=>gaDemandeDoc(x.m.id,x.k));}
function gaBulkTickets(){const B=gaBulk();gaListModal('Signalements des locataires','',B.tickets.map(x=>({t:gaE(x.k.title||'Problème'),d:`${gaE(gaListing(x.k.listing_id)?.title||'')} · ${gaFrC(x.k.created_at)} · ${gaE(String(x.k.description||'').slice(0,100))}`,b:[['Traiter',`gaCloseModal();gaInterFromTicket('${x.k.id}')`]]})));}
function gaBulkDevis(){const B=gaBulk();gaListModal('Devis à faire valider par le propriétaire','Au-dessus du seuil prévu au mandat, l’accord du propriétaire est nécessaire.',B.devis.map(x=>({t:`${gaE(x.i.titre)} — ${gaEur(x.i.devis_montant)}`,d:`${gaE(gaBien(x.m))} · ${gaE(x.m.owner_name||'')}`,b:[['Demander l’accord',`gaDemandeAccord('${x.i.id}')`],['Ouvrir',`gaCloseModal();gaEditInter('${x.i.id}')`]]})));}
function gaBulkFactures(){const B=gaBulk();gaListModal('Factures de travaux à imputer','Saisissez le montant facturé : il est déduit du prochain reversement au propriétaire.',B.factures.map(x=>({t:gaE(x.i.titre),d:x.m?gaE(gaBien(x.m)):'',b:[['Saisir la facture',`gaCloseModal();gaEditInter('${x.i.id}')`]]})));}
function gaBulkDepots(){const B=gaBulk();gaListModal('Dépôts de garantie à restituer','1 mois après la sortie si l’état des lieux est conforme, 2 mois sinon. Au-delà : pénalité de 10 % du loyer par mois de retard.',B.depots.map(x=>({t:gaE(x.m.fin_bail?.locataire||''),d:gaE(gaBien(x.m)),b:[['Calculer',`gaCloseModal();gaDepotModal('${x.m.id}')`]]})));}
function gaBulkSansMandat(){const B=gaBulk();gaListModal('Baux signés à mettre en gestion','',B.sansMandat.map(x=>({t:gaE(GA.profiles[x.L.tenant_id]?.full_name||'Locataire'),d:gaE(x.L.listing_title||''),b:[['Ajouter',`gaCloseModal();gaNewMandatFromLease('${x.L.id}')`]]})));}

// ── Régularisation annuelle des charges (par bien) ──────────────────
const GA_CH_POSTES=['Eau froide / eau chaude','Chauffage collectif','Entretien des parties communes','Électricité des parties communes','Ascenseur','Taxe d’enlèvement des ordures ménagères (TEOM)','Espaces verts','Autres charges récupérables'];
function gaRegulModal(mid,an){
  const m=gaMandat(mid);const t=gaTen(m);if(!t){toast('Pas de locataire sur ce bien');return;}
  an=an||new Date().getFullYear()-1;
  const prov=gaR(gaPays(m).filter(p=>p.status==='paid'&&String(p.due_date).startsWith(String(an))).reduce((s,p)=>s+gaSplit({amount:gaPaid(p)},t).ch,0));
  const deja=GA.ops.find(o=>o.mandat_id===mid&&o.type==='regul_charges'&&String(o.libelle||'').includes(String(an)));
  gaModal(`<div style="font-size:1rem;font-weight:700;margin-bottom:.2rem"><i data-lucide=calculator class=ic></i> Régularisation des charges ${an}</div>
  <div style="font-size:.76rem;color:var(--td);margin-bottom:.8rem">${gaE(gaBien(m))} · ${gaE(t.nom)}${deja?` · <span style="color:var(--gold)">déjà faite le ${gaFrC(deja.date)}</span>`:''}</div>
  <div class="fgrid2">
    <div class="fg"><label class="fl">Année</label><select class="fsel" id="grg-an" onchange="gaRegulModal('${mid}',+this.value)">${[0,1,2].map(k=>new Date().getFullYear()-k).map(y=>`<option ${y===an?'selected':''}>${y}</option>`).join('')}</select></div>
    <div class="fg"><label class="fl">Provisions encaissées (€)</label><input class="fi" id="grg-prov" type="number" step="0.01" value="${prov}" oninput="gaRegulCalc()"></div>
  </div>
  <div style="font-size:.74rem;font-weight:700;margin:.6rem 0 .3rem">Charges réelles récupérables (décompte du syndic, factures)</div>
  ${GA_CH_POSTES.map((p,i)=>`<div style="display:flex;gap:.5rem;align-items:center;margin-bottom:.3rem"><span style="flex:3;font-size:.78rem">${p}</span><input class="fi grg-d" data-l="${gaE(p)}" type="number" step="0.01" placeholder="0" style="flex:1" oninput="gaRegulCalc()"></div>`).join('')}
  <div id="grg-res" style="font-size:.9rem;margin:.8rem 0;line-height:1.5"></div>
  <label style="display:flex;gap:.5rem;font-size:.78rem;margin-bottom:.4rem"><input type="checkbox" id="grg-maj" checked> Ajuster la provision mensuelle à <strong id="grg-np" style="margin-left:.25rem">—</strong></label>
  <div style="font-size:.7rem;color:var(--td);margin-bottom:.8rem">Le décompte est envoyé au locataire ; les justificatifs doivent rester à sa disposition pendant 6 mois. Le solde s’ajoute à (ou se déduit de) la prochaine échéance.</div>
  <div style="display:flex;justify-content:flex-end;gap:.5rem"><button class="btn bg" onclick="gaCloseModal()">Annuler</button><button class="btn bp" onclick="gaRegulSave('${mid}',${an})">Valider et prévenir le locataire</button></div>`);
  gaRegulCalc();
}
function gaRegulCalc(){
  const prov=gaN('grg-prov')||0;const dep=[...document.querySelectorAll('.grg-d')].reduce((s,i)=>s+(Number(String(i.value).replace(',','.'))||0),0);
  const solde=gaR(dep-prov);const el=document.getElementById('grg-res');
  if(el)el.innerHTML=`Charges réelles <strong>${gaEur(dep)}</strong> − provisions <strong>${gaEur(prov)}</strong> = ${solde>0?`<strong style="color:var(--red)">${gaEur(solde)} à payer par le locataire</strong>`:solde<0?`<strong style="color:var(--green)">${gaEur(-solde)} à rembourser au locataire</strong>`:'<strong>équilibré</strong>'}`;
  const np=document.getElementById('grg-np');if(np)np.textContent=dep?gaEur(Math.ceil(dep/12)):'—';
  return{prov,dep:gaR(dep),solde};
}
async function gaRegulSave(mid,an){
  const m=gaMandat(mid);const t=gaTen(m);const{prov,dep,solde}=gaRegulCalc();
  if(!dep){toast('Saisissez les charges réelles');return;}
  const lignes=[...document.querySelectorAll('.grg-d')].map(i=>({l:i.dataset.l,v:Number(String(i.value).replace(',','.'))||0})).filter(x=>x.v);
  const maj=gaC('grg-maj');const newCh=Math.ceil(dep/12);
  // Solde sur la prochaine échéance
  const next=gaPays(m).filter(p=>gaUnpaid(p)&&p.due_date>=gaToday()).sort((a,b)=>a.due_date.localeCompare(b.due_date))[0];
  if(next&&solde){const amt=gaR(Math.max(0,+next.amount+solde));await sb.from('payments').update({amount:amt}).eq('id',next.id);next.amount=amt;}
  // Nouvelle provision mensuelle (échéances à venir)
  if(maj&&newCh!==t.ch){
    if(t.lease){await sb.from('leases').update({charges:newCh}).eq('id',t.lease.id);t.lease.charges=newCh;}
    else{const{data}=await sb.from('gestion_mandats').update({loc_charges:newCh}).eq('id',mid).select().single();if(data)GA.mandats=GA.mandats.map(x=>x.id===mid?data:x);}
    for(const p of gaPays(m).filter(p=>p.status==='pending'&&!(+p.amount_paid)&&p.due_date>=gaToday()&&p!==next)){const amt=gaR(t.hc+newCh);await sb.from('payments').update({amount:amt}).eq('id',p.id);p.amount=amt;}
  }
  const{data:op}=await sb.from('gestion_operations').insert({agency_id:U.id,mandat_id:mid,date:gaToday(),type:'regul_charges',libelle:`Régularisation des charges ${an} : ${solde>=0?'+':''}${gaEur(solde)} (réel ${gaEur(dep)} / provisions ${gaEur(prov)})`,montant:0}).select().single();
  if(op)GA.ops.push(op);
  const msg=`Régularisation des charges ${an} : charges réelles ${gaEur(dep)}, provisions versées ${gaEur(prov)}. ${solde>0?`Reste à payer : ${gaEur(solde)}, ajouté à votre prochaine échéance`:solde<0?`Trop-perçu de ${gaEur(-solde)} déduit de votre prochaine échéance`:'Aucun solde'}.${maj&&newCh!==t.ch?` Nouvelle provision mensuelle : ${gaEur(newCh)}.`:''}`;
  await gaMail(t.email,`Régularisation des charges ${an} — ${gaBien(m)}`,`Régularisation des charges ${an}`,`<p>Bonjour ${gaE(t.nom)},</p><p>${gaE(msg)}</p><ul>${lignes.map(x=>`<li>${gaE(x.l)} : ${gaEur(x.v)}</li>`).join('')}</ul><p style="font-size:13px">Les justificatifs sont à votre disposition sur simple demande pendant 6 mois.</p>`);
  if(t.tenant_id)await gaMsg(t.tenant_id,m.listing_id,msg);
  gaDoc({dest:[t.nom,gaAdresse(m)],objet:`Régularisation annuelle des charges ${an}`,fichier:`regul-charges-${an}`,
    avant:['Madame, Monsieur,',`Voici le décompte des charges récupérables de l’année ${an} pour le logement situé ${gaAdresse(m)} (article 23 de la loi du 6 juillet 1989).`],
    table:{head:['Poste','Montant'],widths:[124,50],align:['l','r'],rows:lignes.map(x=>[x.l,gaEur(x.v)]),foot:[['Total des charges réelles',gaEur(dep)],['Provisions versées',gaEur(prov)],[solde>=0?'Solde à votre charge':'Trop-perçu en votre faveur',gaEur(Math.abs(solde))]]},
    apres:[solde>0?'Ce montant sera ajouté à votre prochaine échéance.':solde<0?'Ce montant sera déduit de votre prochaine échéance.':'',maj&&newCh!==t.ch?`À compter de la prochaine échéance, la provision mensuelle sur charges est portée à ${gaEur(newCh)}.`:'','Les pièces justificatives sont tenues à votre disposition pendant six mois.','Veuillez agréer, Madame, Monsieur, nos salutations distinguées.'].filter(Boolean)});
  gaCloseModal();toast('Régularisation enregistrée, locataire prévenu');gaRender();
}

// ════════════════════ Suivi du bien : historique + à venir ════════════════════
function gaImpayes(m){const today=gaToday();return gaPays(m).filter(p=>gaUnpaid(p)&&gaDays(p.due_date,today)>0).sort((a,b)=>a.due_date.localeCompare(b.due_date));}
// Dernière démarche de relance sur un loyer impayé
function gaDerniereRelance(ps){
  const ev=[];ps.forEach(p=>[['commandement_at','Commandement de payer'],['mise_en_demeure_at','Mise en demeure'],['garant_informe_at','Garant informé'],['relance2_at','2ᵉ relance'],['relance_at','Relance']].forEach(([k,l])=>{if(p[k])ev.push({d:p[k],l});}));
  return ev.sort((a,b)=>String(b.d).localeCompare(String(a.d)))[0]||null;
}
// Prochaine relance automatique prévue
function gaProchaineRelance(m,ps){
  if(!m.auto_relances)return null;
  for(const p of ps){
    if(!p.relance_at)return{d:gaAddDays(p.due_date,5),l:'Relance automatique par e-mail'};
    if(!p.relance2_at)return{d:gaAddDays(p.due_date,15),l:'2ᵉ relance automatique par e-mail'};
  }
  return null;
}
const gaAddDays=(d,n)=>{const x=new Date(gaIso(d)+'T12:00:00');x.setDate(x.getDate()+n);return gaIso(x);};

function gaTimeline(m){
  const t=gaTen(m);const today=gaToday();const F=[],P=[];const f=m.fin_bail||{};
  const fut=(date,ic,tone,titre,det,auto,act)=>F.push({date:gaIso(date)<today?today:gaIso(date),ic,tone,t:titre,d:det,auto,act,late:gaIso(date)<today});
  const pas=(date,ic,tone,titre,det)=>{if(date)P.push({date:String(date),ic,tone,t:titre,d:det});};
  const ps=gaPays(m).filter(p=>p.status!=='cancelled');
  // ── Loyers ──
  for(const p of ps){
    const mois=gaMoisLbl(String(p.due_date).slice(0,7));
    if(p.status==='paid')pas(p.paid_at,'check-circle-2','g',`Loyer de ${mois} reçu`,`${gaEur(gaPaid(p))}${p.payment_method?' · '+p.payment_method:''}`);
    else if(+p.amount_paid>0)pas(p.paid_at,'circle-dashed','o',`Paiement partiel — ${mois}`,`${gaEur(p.amount_paid)} reçus sur ${gaEur(p.amount)}`);
    if(p.avis_sent_at)pas(p.avis_sent_at,'file-text','n',`Avis d’échéance de ${mois} envoyé`,gaEur(p.amount));
    if(p.quittance_sent_at)pas(p.quittance_sent_at,'receipt','n',`Quittance de ${mois} envoyée`,'par e-mail');
    if(p.relance_at)pas(p.relance_at,'mail','r',`Relance envoyée — loyer de ${mois}`,'e-mail + messagerie');
    if(p.relance2_at)pas(p.relance2_at,'mail-warning','r',`2ᵉ relance envoyée — loyer de ${mois}`,'e-mail + messagerie');
    if(p.garant_informe_at)pas(p.garant_informe_at,'user-check','r','Garant informé de l’impayé',mois);
    if(p.mise_en_demeure_at)pas(p.mise_en_demeure_at,'gavel','r','Mise en demeure envoyée',`${mois} · recommandé AR`);
    if(p.gli_declare_at)pas(p.gli_declare_at,'shield','r','Impayé déclaré à la garantie',mois);
    if(p.commandement_at)pas(p.commandement_at,'scale','r','Commandement de payer demandé',mois);
    if(gaUnpaid(p)){
      const d=gaDays(p.due_date,today);
      if(d>0)fut(today,'alert-triangle','r',`Loyer de ${mois} impayé (J+${d})`,`${gaEur(gaReste(p))} attendus depuis le ${gaFrC(p.due_date)}`,false,`gaEncaisser('${p.id}')`);
      else{
        fut(p.due_date,'calendar','n',`Loyer de ${mois}`,`${gaEur(p.amount)} attendus le ${gaFrC(p.due_date)}`,false,null);
        if(m.auto_avis&&!p.avis_sent_at)fut(gaAddDays(p.due_date,-7),'send','a','Avis d’échéance envoyé automatiquement',`au locataire, 7 jours avant`,true);
      }
    }
  }
  const imp=ps.filter(p=>gaUnpaid(p)&&gaDays(p.due_date,today)>0);
  const nx=gaProchaineRelance(m,imp);if(nx)fut(nx.d>today?nx.d:gaAddDays(today,1),'mail','a',nx.l,'envoyée toute seule si le loyer n’est toujours pas payé',true);
  for(const p of imp)for(const s of gaStage(m,p))if(!['r1','r2'].includes(s.k)||!m.auto_relances)fut(today,'gavel','r',s.l,`loyer de ${gaMoisLbl(String(p.due_date).slice(0,7))}`,false,s.a);
  // ── Bail & loyer ──
  if(t){
    if(t.debut)pas(t.debut,'key-round','g','Début du bail',`${t.nom} · ${gaEur(t.hc+t.ch)}/mois`);
    const irl=gaIrlInfo(m);
    if(irl?.due)fut(today,'trending-up','o',`Révision IRL à appliquer : ${gaEur(irl.ancien)} → ${gaEur(irl.nouveau)}`,irl.ref,false,`gaApplyIrl('${m.id}')`);
    else if(t.debut){const deb=new Date(t.debut+'T12:00:00');let an=new Date(new Date().getFullYear(),deb.getMonth(),deb.getDate(),12);if(gaIso(an)<=today)an.setFullYear(an.getFullYear()+1);
      if(!irl?.gel)fut(an,'trending-up','n','Révision annuelle du loyer (IRL)','date anniversaire du bail',false);}
    const last=t.lease?.irl_last_revision||f.irl_last;if(last?.date)pas(last.date,'trending-up','n','Loyer révisé (IRL)',`${gaEur(last.ancien)} → ${gaEur(last.nouveau)}`);
    const finB=gaProchaineEcheance(t);
    if(finB&&!f.preavis_recu){fut(finB,'calendar-clock','n','Échéance du bail','reconduction tacite sauf congé',false);const pre=t.meuble?3:6;const lim=gaAddM(finB,-pre);if(lim>=today)fut(lim,'calendar-x','o','Date limite de congé du bailleur',`${pre} mois avant l’échéance`,false);}
    // TEOM
    const y=new Date().getFullYear();const teom=GA.ops.find(o=>o.mandat_id===m.id&&o.type==='teom'&&String(o.date).startsWith(String(y)));
    if(!teom)fut(`${y}-10-15`,'trash-2',new Date().getMonth()>=9?'o':'n',`TEOM ${y} à refacturer au locataire`,'montant sur l’avis de taxe foncière (octobre)',false,`gaTeomModal('${m.id}')`);
    else fut(`${y+1}-10-15`,'trash-2','n',`TEOM ${y+1} à refacturer`,'avis de taxe foncière',false);
    // Régularisation des charges
    if(t.ch>0){const reg=GA.ops.find(o=>o.mandat_id===m.id&&o.type==='regul_charges'&&String(o.libelle||'').includes(String(y-1)));
      if(!reg)fut(new Date().getMonth()<6?today:`${y}-06-30`,'calculator',new Date().getMonth()<6?'o':'n',`Régularisation des charges ${y-1}`,'comparer les provisions aux charges réelles',false,`gaRegulModal('${m.id}',${y-1})`);
      else fut(`${y+1}-03-31`,'calculator','n',`Régularisation des charges ${y}`,'',false);}
  }
  // ── Documents ──
  for(const[k,def]of Object.entries(GA_DOCS)){
    if(!gaDocApplies(m,k)||(def.qui==='locataire'&&!t))continue;
    const e=GA.ech.find(x=>x.mandat_id===m.id&&x.type===k);
    if(e?.date_document)pas(e.date_document,'file-check','n',`${def.court} enregistré`,e.resultat?String(e.resultat):'');
    if(e?.relance_at)pas(e.relance_at,'mail','n',`${def.court} : justificatif demandé au locataire`,'');
    if(e?.date_expiration){const r=gaDays(today,e.date_expiration);
      if(r<0)fut(today,'shield-x','r',`${def.l} expiré`,`depuis le ${gaFrC(e.date_expiration)}`,false,def.qui==='locataire'?`gaDemandeDoc('${m.id}','${k}')`:`gaEditEch('${m.id}','${k}')`);
      else if(r<=400){fut(e.date_expiration,'shield','n',`${def.l} à renouveler`,'',false);
        if(m.auto_conformite&&def.qui==='locataire'&&['assurance_habitation','entretien_chaudiere'].includes(k))fut(gaAddDays(e.date_expiration,-15),'send','a','Rappel automatique au locataire','attestation à renouveler',true);}}
  }
  // ── Travaux ──
  for(const i of GA.inter.filter(i=>i.mandat_id===m.id)){
    pas(i.created_at,'wrench','n',`Intervention ouverte : ${i.titre}`,i.prestataire_nom||'');
    if(i.date_intervention&&!['termine','facture','annule'].includes(i.statut))fut(i.date_intervention,'wrench','o',`Intervention prévue : ${i.titre}`,i.prestataire_nom||'',false,`gaEditInter('${i.id}')`);
    if(i.termine_at)pas(i.termine_at,'check','g',`Travaux terminés : ${i.titre}`,i.montant_final?gaEur(i.montant_final):'');
  }
  // ── Compte propriétaire ──
  for(const o of GA.ops.filter(o=>o.mandat_id===m.id))
    pas(o.date,o.type==='reversement'?'send':o.type==='travaux'?'receipt':'circle-dollar-sign',o.type==='reversement'?'g':'n',
      o.type==='reversement'?`Reversé au propriétaire : ${gaEur(-o.montant)}`:(o.libelle||o.type),o.type!=='reversement'&&+o.montant?gaEur(o.montant):'');
  const k=gaOwnerKey(m);
  for(const c of GA.crg.filter(c=>c.owner_key===k&&c.envoye_at))pas(c.envoye_at,'file-bar-chart','n',`Compte rendu de ${gaMoisLbl(c.periode)} envoyé au propriétaire`,`solde ${gaEur(c.net)}`);
  if(m.auto_crg){const n5=new Date();n5.setDate(5);if(gaIso(n5)<=today)n5.setMonth(n5.getMonth()+1);fut(n5,'file-bar-chart','a','Compte rendu de gestion envoyé au propriétaire',`activité de ${gaMoisLbl(gaAddM(gaIso(n5),-1).slice(0,7))}`,true);}
  const s=gaSolde(k);const r0=new Date();r0.setDate(+m.reversement_jour||10);if(s>0.5&&gaIso(r0)>today){const r=r0;fut(r,'send','o',`Reverser ${gaEur(s)} au propriétaire`,m.owner_iban||'IBAN à compléter',false,`gaReverser('${gaQ(k)}')`);}
  // ── Fin de bail ──
  if(f.preavis_recu)pas(f.preavis_recu,'door-open','o','Préavis reçu',`départ le ${gaFrC(f.date_fin)}`);
  if(f.date_fin&&!f.edl_sortie)fut(f.date_fin,'door-open','o','Départ du locataire','état des lieux de sortie',false,`gaEditFin('${m.id}')`);
  if(f.edl_sortie)pas(f.edl_sortie,'clipboard-check','n','État des lieux de sortie',f.edl_conforme===false?'non conforme':'conforme');
  if(f.edl_sortie&&!f.depot_restitue)fut(gaAddM(f.edl_sortie,f.edl_conforme===false?2:1),'piggy-bank','r','Date limite de restitution du dépôt','',false,`gaDepotModal('${m.id}')`);
  if(f.depot_restitue)pas(f.depot_restitue,'piggy-bank','g','Dépôt de garantie restitué',gaEur(f.solde_restitue||0));
  pas(String(m.created_at||m.date_signature||'').slice(0,10),'file-signature','n',`Mise en gestion (mandat n° ${m.numero||'—'})`,m.owner_name||'');
  // « Aujourd'hui » = les tâches du bien (hors impayés, déjà dans le bandeau rouge) ; ensuite seulement ce qui est à venir
  const tasks=gaTasksOf(m).filter(x=>x.cat!=='Impayés'&&x.cat!=='Encaissements').map(x=>({date:today,ic:x.ic,tone:x.p===1?'r':x.p===2?'o':'n',t:x.t,d:x.d.split(gaBien(m)+' · ').join('').split(gaBien(m)+' — ').join('').split(gaBien(m)).join('').replace(/^\s*[·—]\s*/,''),act:x.a[0]?.[1],actl:x.a[0]?.[0],act2:x.a[1]}));
  const fut2=F.filter(x=>x.date>today);
  F.length=0;F.push(...tasks.sort((a,b)=>'roan'.indexOf(a.tone)-'roan'.indexOf(b.tone)),...fut2.sort((a,b)=>a.date.localeCompare(b.date)));
  P.sort((a,b)=>b.date.localeCompare(a.date));
  return{F:F.filter(x=>gaDays(today,x.date)<=400),P};
}
function gaFSuivi(m){
  const{F,P}=gaTimeline(m);const today=gaToday();
  const col={r:'var(--red)',o:'var(--gold)',g:'var(--green)',a:'var(--agencybright)',n:'var(--td)'};
  const when=d=>{const n=gaDays(today,d);return n===0?'Aujourd’hui':n===1?'Demain':n>1&&n<8?`Dans ${n} jours`:gaFrC(d);};
  const item=(x,futur)=>`<div style="display:flex;gap:.75rem;position:relative;padding-bottom:.9rem">
    <div style="display:flex;flex-direction:column;align-items:center;flex-shrink:0"><div style="width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:color-mix(in srgb, ${col[x.tone]} 16%, transparent);color:${col[x.tone]};border:1px solid color-mix(in srgb, ${col[x.tone]} 40%, transparent)"><i data-lucide=${x.ic} class=ic></i></div><div style="flex:1;width:2px;background:var(--b);margin-top:.2rem"></div></div>
    <div style="flex:1;min-width:0;padding-top:.15rem">
      <div style="display:flex;justify-content:space-between;gap:.5rem;flex-wrap:wrap;align-items:baseline">
        <div style="font-size:.84rem;font-weight:600;color:${x.tone==='r'?'var(--red)':'var(--txt)'}">${gaE(x.t)}${x.auto?` <span class="badge b-agence" style="font-size:.58rem;vertical-align:middle">AUTO</span>`:''}</div>
        <div style="font-size:.7rem;color:var(--td);white-space:nowrap">${futur?when(x.date):gaFrC(x.date)}</div></div>
      ${x.d?`<div style="font-size:.73rem;color:var(--td);margin-top:.1rem">${gaE(x.d)}</div>`:''}
      ${x.act?`<div style="display:flex;gap:.3rem;flex-wrap:wrap;margin-top:.4rem"><button class="btn bp bsm" style="${x.tone==='r'?'background:var(--red)':''}" onclick="${x.act}">${gaE(x.actl||'Faire maintenant')}</button>${x.act2?`<button class="btn bg bsm" onclick="${x.act2[1]}">${gaE(x.act2[0])}</button>`:''}</div>`:''}
    </div></div>`;
  return`<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(330px,1fr));gap:.9rem;align-items:start">
    <div class="card"><div class="cb"><div style="font-size:.74rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--td);margin-bottom:.8rem"><i data-lucide=calendar-clock class=ic></i> À venir</div>
      ${F.length?F.map(x=>item(x,true)).join(''):'<div style="font-size:.8rem;color:var(--td)">Rien de prévu.</div>'}</div></div>
    <div class="card"><div class="cb"><div style="font-size:.74rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--td);margin-bottom:.8rem"><i data-lucide=history class=ic></i> Historique</div>
      ${P.length?P.slice(0,40).map(x=>item(x,false)).join(''):'<div style="font-size:.8rem;color:var(--td)">Pas encore d’historique.</div>'}
      ${P.length>40?`<div style="font-size:.72rem;color:var(--td)">+ ${P.length-40} événements plus anciens</div>`:''}</div></div>
  </div>`;
}
// Bandeau rouge en haut de la fiche quand un loyer est impayé
function gaBandeauImpaye(m){
  const ps=gaImpayes(m);if(!ps.length)return'';
  const tot=ps.reduce((s,p)=>s+gaReste(p),0);const der=gaDerniereRelance(ps);const nx=gaProchaineRelance(m,ps);
  const st=gaStage(m,ps[0]).filter(s=>!['r1','r2'].includes(s.k)||!m.auto_relances);
  return`<div style="background:linear-gradient(135deg,rgba(224,90,90,.18),rgba(224,90,90,.06));border:1px solid rgba(224,90,90,.45);border-radius:14px;padding:1rem 1.1rem;margin-bottom:.9rem">
    <div style="display:flex;justify-content:space-between;gap:.8rem;flex-wrap:wrap;align-items:center">
      <div><div style="font-size:1.05rem;font-weight:700;color:var(--red);display:flex;align-items:center;gap:.4rem"><i data-lucide=alert-triangle class=ic></i> Loyer impayé : ${gaEur(tot)}</div>
      <div style="font-size:.76rem;color:var(--tm);margin-top:.2rem">${ps.length} échéance${ps.length>1?'s':''} · la plus ancienne due le ${gaFrC(ps[0].due_date)} (J+${gaDays(ps[0].due_date,gaToday())})</div>
      <div style="font-size:.76rem;margin-top:.35rem">${der?`<i data-lucide=check class=ic></i> ${der.l} le ${gaFrC(der.d)}`:'Aucune relance pour l’instant'}${nx?` · <span style="color:var(--agencybright)"><i data-lucide=bot class=ic></i> ${nx.l.toLowerCase()} le ${gaFrC(nx.d<gaToday()?gaAddDays(gaToday(),1):nx.d)}</span>`:m.auto_relances?'':` · <span style="color:var(--gold)">relances automatiques désactivées</span>`}</div></div>
      <div style="display:flex;gap:.35rem;flex-wrap:wrap">
        <button class="btn bp bsm" onclick="gaEncaisser('${ps[0].id}')">Loyer reçu</button>
        ${st.map(s=>`<button class="btn bp bsm" style="background:var(--red)" onclick="${s.a}">${gaE(s.l)}</button>`).join('')}
        <button class="btn bg bsm" onclick="gaRelance('${ps[0].id}',${ps[0].relance_at?2:1})">Relancer maintenant</button>
        <button class="btn bg bsm" onclick="gaApurement('${m.id}')">Plan d’apurement</button>
      </div></div></div>`;
}

// Prochaine échéance du bail (le bail se reconduit tacitement : 1 an en meublé, 3 ans en vide)
function gaProchaineEcheance(t){
  if(!t)return null;let fin=t.fin;
  if(!fin&&t.debut){fin=gaAddDays(gaAddM(t.debut,t.meuble?12:36),-1);}
  if(!fin)return null;let k=0;
  while(fin<gaToday()&&k++<30)fin=gaAddM(fin,t.meuble?12:36);
  return fin;
}

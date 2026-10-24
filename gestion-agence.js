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
// Types de baux gérés
const GA_BAUX={habitation_meuble:{l:'Habitation meublée',ind:'IRL',hab:true},habitation_vide:{l:'Habitation vide',ind:'IRL',hab:true},mixte:{l:'Mixte (habitation + professionnel)',ind:'IRL',hab:true},
  professionnel:{l:'Bail professionnel',ind:'ILAT',hab:false,tva:true},commercial:{l:'Bail commercial',ind:'ILC',hab:false,tva:true},parking:{l:'Parking / garage / box',ind:'IRL',hab:false}};
const gaTypeBail=m=>{if(m?.type_bail&&GA_BAUX[m.type_bail])return m.type_bail;const L=m?.lease_id&&typeof gaLease==='function'?gaLease(m.lease_id):null;if(L?.type_bail)return L.type_bail==='vide'?'habitation_vide':'habitation_meuble';return m?.bien_meuble===false?'habitation_vide':'habitation_meuble';};
const gaHabitation=m=>!!GA_BAUX[gaTypeBail(m)]?.hab;
const gaIndice=m=>m?.indice||GA_BAUX[gaTypeBail(m)]?.ind||'IRL';
const gaTva=m=>m?.tva_loyer&&!GA_BAUX[gaTypeBail(m)]?.hab?(+m.tva_taux||20):0;
// Indices INSEE (loyers commerciaux et activités tertiaires)
const GA_ILC={'2022-1':120.61,'2022-2':123.65,'2022-3':126.13,'2022-4':126.05,'2023-1':128.68,'2023-2':131.81,'2023-3':133.66,'2023-4':132.63,'2024-1':134.58,'2024-2':136.72,'2024-3':137.71,'2024-4':135.30,'2025-1':135.87,'2025-2':136.81,'2025-3':137.09,'2025-4':134.62,'2026-1':135.26,'2026-2':137.16};
const GA_ILAT={'2022-1':120.73,'2022-2':122.65,'2022-3':124.53,'2022-4':126.66,'2023-1':128.59,'2023-2':130.64,'2023-3':132.15,'2023-4':133.69,'2024-1':135.13,'2024-2':136.45,'2024-3':137.12,'2024-4':137.29,'2025-1':137.29,'2025-2':137.15,'2025-3':137.07,'2025-4':137.21,'2026-1':137.42,'2026-2':138.01};
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
  // Modules du logiciel de gérance (tables facultatives : l'appli marche avant la migration)
  const opt=async(t,cb)=>{try{const{data,error}=await cb(sb.from(t));return error?[]:(data||[]);}catch(e){return[];}};
  [GA.entites,GA.sepaMandats,GA.sepaLots,GA.sinistres,GA.bordereaux,GA.modeles,GA.signatures,GA.clotures,GA.acces]=await Promise.all([
    opt('gestion_entites',q=>q.select('*').eq('agency_id',U.id)),opt('gestion_sepa_mandats',q=>q.select('*').eq('agency_id',U.id)),opt('gestion_sepa_lots',q=>q.select('*').eq('agency_id',U.id)),
    opt('gestion_sinistres',q=>q.select('*').eq('agency_id',U.id)),opt('gestion_bordereaux',q=>q.select('*').eq('agency_id',U.id)),opt('gestion_modeles',q=>q.select('*').eq('agency_id',U.id)),
    opt('gestion_signatures',q=>q.select('*').eq('agency_id',U.id)),opt('gestion_clotures',q=>q.select('*').eq('agency_id',U.id)),opt('gestion_proprio_acces',q=>q.select('*').eq('agency_id',U.id))]);
  try{const{data:rg}=await sb.from('gestion_regul').select('*').eq('agency_id',U.id);GA.regul=rg||[];}catch(e){GA.regul=[];}
  try{const{data:bk}=await sb.from('gestion_banque').select('*').eq('agency_id',U.id).order('date',{ascending:false}).limit(3000);GA.bank=bk||[];}catch(e){GA.bank=[];}
  GA.loaded=true;
  try{await gaLinkTenants();await gaLoadMsgs();}catch(e){GA.msgs=GA.msgs||[];}
  await gaAttachPayments();
  await gaEnsureSchedule();
}
const gaMandat=id=>GA.mandats.find(m=>m.id===id);
const gaListing=id=>GA.listings.find(l=>l.id===id);
const gaLease=id=>GA.leases.find(l=>l.id===id);
const gaOwnerKey=m=>String(m.owner_email||m.owner_name||'sans-proprietaire').trim().toLowerCase();
const gaBien=m=>m.bien_label||gaListing(m.listing_id)?.title||m.bien_adresse||'Bien';
const gaAdresse=m=>m.bien_adresse||gaListing(m.listing_id)?.full_address||gaBien(m);
const gaActifs=()=>GA.mandats.filter(m=>m.statut!=='resilie'&&(!GA.entiteF||m.entite_id===GA.entiteF||(!m.entite_id&&GA.entiteF===gaEntiteDefautId())));

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
      zone_tendue:L.zone_tendue===true,type:gaTypeBail(m),tva:gaTva(m)};
  }
  if(m.loc_nom)return{src:'ext',lease:null,nom:m.loc_nom,email:m.loc_email||'',tel:m.loc_phone||'',tenant_id:m.loc_clerk_id||null,
    hc:+m.loc_loyer_hc||0,ch:+m.loc_charges||0,depot:+m.loc_depot||0,debut:m.loc_debut,fin:null,jour:+m.loc_jour||1,
    meuble:m.bien_meuble!==false,garantie:m.loc_garantie||'',garant_nom:m.loc_garant_nom||'',garant_email:m.loc_garant_email||'',visale:/visale/i.test(m.loc_garantie||''),zone_tendue:false,type:gaTypeBail(m),tva:gaTva(m)};
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
    const cutoff=[t.debut,m.date_signature||String(m.created_at||'').slice(0,10),m.fin_bail?.reprise?m.fin_bail.reprise+'-01':null].filter(Boolean).sort().pop()||'';
    for(let k=0;k<3;k++){
      const ym=gaAddM(cur+'-15',k).slice(0,7);
      if(ym<debutYm||exist.has(ym))continue;
      if(m.fin_bail?.date_fin&&ym>String(m.fin_bail.date_fin).slice(0,7))continue;
      if(gaDue(ym,t.jour)<cutoff)continue;
      rows.push({landlord_id:U.id,tenant_id:t.tenant_id,listing_id:m.listing_id||t.lease?.listing_id||null,lease_id:t.lease?.id||null,booking_id:t.lease?.booking_id||null,
        mandat_id:m.id,tenant_name:t.nom,tenant_email:t.email,amount:gaR((t.hc+t.ch)*(1+(t.tva||0)/100)+gaRegulExtra(m.id,ym)),type:'rent',status:'pending',due_date:gaDue(ym,t.jour)});
    }
  }
  if(!rows.length)return;
  const{data,error}=await sb.from('payments').insert(rows).select();
  if(error){console.warn('Échéancier :',error.message);return;}
  GA.pays.push(...(data||[]));
}

// ── Comptabilité propriétaire ───────────────────────────────────────
function gaHonor(m,p,montant){
  const t=gaTen(m);const tot=(t?.hc||0)+(t?.ch||0);montant=montant/(1+(t?.tva||0)/100); // honoraires sur le hors taxe
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
  for(const m of GA.mandats.filter(m=>!GA.entiteF||m.entite_id===GA.entiteF||(!m.entite_id&&GA.entiteF===gaEntiteDefautId()))){const k=gaOwnerKey(m);(map[k]=map[k]||{key:k,name:m.owner_name||m.owner_email||'Propriétaire',email:m.owner_email,iban:m.owner_iban,address:m.owner_address,clerk:m.owner_clerk_id,ms:[]}).ms.push(m);}
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
  // Messages automatiques au locataire : dans le même fil que la messagerie avec le gestionnaire
  try{const{data}=await sb.from('messages').insert({listing_id:listingId||null,sender_id:U.id,receiver_id:to,content,type:'gestion',read:false}).select().single();if(data&&GA.msgs)GA.msgs.push(data);}catch(e){}
}
// Identité de l'agence sur les documents : la société / agence du mandat (multi-agences), sinon le profil
function gaAgence(m){
  const base={nom:agencyData?.agency_name||'Agence',adresse:agencyData?.address||'',tel:agencyData?.phone||'',carte:agencyData?.license_number||'',cci:agencyData?.cci_delivrance||'',garantie:agencyData?.garantie_financiere||'',web:agencyData?.website||'',email:agencyData?.email||'',siren:agencyData?.siret?String(agencyData.siret).replace(/\D/g,'').slice(0,9):''};
  const e=(typeof gaEntite==='function')?gaEntite(m):null;
  if(!e)return base;
  return{...base,nom:e.nom||base.nom,adresse:e.adresse||base.adresse,tel:e.tel||base.tel,carte:e.carte||base.carte,cci:e.cci||base.cci,garantie:e.garantie||base.garantie,email:e.email||base.email,siren:e.siren||base.siren,iban:e.iban||'',bic:e.bic||'',ics:e.ics||'',entite_id:e.id};
}

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
    const A=gaAgence(o.m);
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
    // Messages du locataire non lus
    {const u=gaUnreadMsgs(m);if(u.length){const l=u[u.length-1];add({p:2,cat:'Messages',ic:'message-circle',t:`Message de ${t?.nom||'votre locataire'}${u.length>1?' (+'+(u.length-1)+')':''}`,d:`${bien} · « ${String(l.content).slice(0,90)}${String(l.content).length>90?'…':''} »`,a:[['Répondre',`gaGo({t:'bien',id:'${m.id}',s:'msg'})`]]});}}
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
    if(irl?.due)add({p:2,cat:'Loyers',ic:'trending-up',t:`Révision ${irl.ind||"IRL"} possible — ${t.nom}`,d:`${bien} · ${gaEur(irl.ancien)} → ${gaEur(irl.nouveau)} HC (${irl.ref})`,a:[['Appliquer',`gaApplyIrl('${m.id}')`]]});
    // Fin de bail
    if(fin.preavis_recu&&!fin.edl_sortie)add({p:fin.date_fin&&gaDays(today,fin.date_fin)<=15?1:2,cat:'Fin de bail',ic:'door-open',t:`Préavis — sortie le ${gaFrC(fin.date_fin)}`,d:`${bien} · ${t?.nom||''} — planifier l’état des lieux de sortie et la relocation`,a:[['Ouvrir',`gaEditFin('${m.id}')`]]});
    if(fin.edl_sortie&&!fin.depot_restitue){const lim=gaAddM(fin.edl_sortie,fin.edl_conforme?1:2);const r=gaDays(today,lim);
      add({p:r<=7?1:2,cat:'Fin de bail',ic:'piggy-bank',t:r<0?`Dépôt de garantie en retard de ${-r} j (pénalité 10 % du loyer par mois commencé)`:`Restituer le dépôt de garantie avant le ${gaFrC(lim)}`,d:`${bien} · ${fin.locataire||t?.nom||''}`,a:[['Calculer',`gaDepotModal('${m.id}')`]]});}
    const _fb=gaProchaineEcheance(t);if(t&&!fin.preavis_recu&&_fb){const r=gaDays(today,_fb);const pre=t.meuble?3:6;if(r>0&&r<=pre*31+15)add({p:3,cat:'Fin de bail',ic:'calendar-clock',t:`Bail à échéance le ${gaFrC(_fb)}`,d:`${bien} — congé du bailleur possible jusqu’au ${gaFrC(gaAddM(_fb,-pre))} (${pre} mois avant). Sinon reconduction tacite.`,a:[['Informer le propriétaire',`gaInfoEcheanceBail('${m.id}')`]]});}
    if(!t&&!fin.preavis_recu)add({p:3,cat:'Location',ic:'home',t:'Bien vacant',d:`${bien} — chaque mois sans locataire coûte ${gaEur((+m.loc_loyer_hc||+gaListing(m.listing_id)?.price||0))} au propriétaire`,a:[['Créer l’annonce',`sp('new-listing')`],['Ajouter le locataire',`gaEditMandat('${m.id}')`]]});
    // Mandat à échéance
    if(m.date_signature&&!m.tacite){const fm=gaAddM(m.date_signature,+m.duree_mois||12);const r=gaDays(today,fm);if(r<=60&&r>=-30)add({p:2,cat:'Mandats',ic:'file-signature',t:`Mandat n° ${m.numero} à échéance le ${gaFrC(fm)}`,d:`${m.owner_name||''} — ${bien}`,a:[['Ouvrir',`gaEditMandat('${m.id}')`]]});}
    // Régularisation des charges : documents à vérifier, relances, application, années oubliées
    gaRegulTasks(m,t,add,bien);
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
  const def=GA_DOCS[k];const ty=gaTypeBail(m);
  if(ty==='parking'&&k!=='pno'&&k!=='assurance_habitation')return false;   // pas de diagnostics pour un parking
  if(k==='assurance_habitation'&&ty==='parking')return false;
  if(!def?.si)return true;
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
    <td>${gaE(gaBien(m))}<div style="font-size:.68rem;color:var(--td)">${GA_BAUX[gaTypeBail(m)].l}${m.gli?' · GLI':''}</div></td>
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
    ${f('','Statut',`<select class="fsel" id="gm-statut" onchange="document.querySelectorAll('.gm-resil').forEach(x=>x.style.display=this.value==='resilie'?'':'none')"><option value="actif" ${m.statut!=='resilie'?'selected':''}>Actif</option><option value="resilie" ${m.statut==='resilie'?'selected':''}>Résilié</option></select>`)}
    <div class="fg gm-resil" style="display:${m.statut==='resilie'?'':'none'}"><label class="fl">Date de résiliation</label><input class="fi" type="date" id="gm-date_resiliation" value="${v('date_resiliation')}"></div>
    <div class="fg gm-resil" style="display:${m.statut==='resilie'?'':'none'}"><label class="fl">Motif du départ</label><select class="fsel" id="gm-motif_resiliation"><option value="">—</option><option value="vente" ${m.motif_resiliation==='vente'?'selected':''}>Vente du bien</option><option value="reprise" ${m.motif_resiliation==='reprise'?'selected':''}>Le propriétaire gère lui-même</option><option value="concurrent" ${m.motif_resiliation==='concurrent'?'selected':''}>Parti chez une autre agence</option><option value="insatisfaction" ${m.motif_resiliation==='insatisfaction'?'selected':''}>Insatisfaction</option><option value="habitation" ${m.motif_resiliation==='habitation'?'selected':''}>Le propriétaire y habite / sa famille</option><option value="deces" ${m.motif_resiliation==='deces'?'selected':''}>Succession</option><option value="autre" ${m.motif_resiliation==='autre'?'selected':''}>Autre</option></select></div>
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
    ${f('','Type de bail',`<select class="fsel" id="gm-type_bail" onchange="const c=GA_BAUX[this.value];document.getElementById('gm-indice').value=c.ind;document.querySelectorAll('.gm-tva').forEach(x=>x.style.display=c.tva?'':'none')">${Object.entries(GA_BAUX).map(([k,v])=>`<option value="${k}" ${gaTypeBail(m)===k?'selected':''}>${v.l}</option>`).join('')}</select>`)}
    ${f('','Indice de révision',`<select class="fsel" id="gm-indice">${[['IRL','IRL (habitation)'],['ILC','ILC (commerces)'],['ILAT','ILAT (bureaux, professions libérales)'],['aucun','Pas de révision']].map(([k,l])=>`<option value="${k}" ${gaIndice(m)===k?'selected':''}>${l}</option>`).join('')}</select>`)}
    <div class="fg gm-tva" style="display:${GA_BAUX[gaTypeBail(m)]?.tva?'':'none'}"><label class="fl">TVA sur le loyer</label><select class="fsel" id="gm-tva_loyer"><option value="0">Non (exonéré)</option><option value="1" ${m.tva_loyer?'selected':''}>Oui (option TVA du bailleur)</option></select></div>
    <div class="fg gm-tva" style="display:${GA_BAUX[gaTypeBail(m)]?.tva?'':'none'}"><label class="fl">Taux de TVA (%)</label><input class="fi" id="gm-tva_taux" type="number" step="0.1" value="${m.tva_taux??20}"></div>
    ${(GA.entites||[]).length>1?f('','Société / agence',`<select class="fsel" id="gm-entite_id">${GA.entites.map(e=>`<option value="${e.id}" ${(m.entite_id||gaEntiteDefautId())===e.id?'selected':''}>${gaE(e.nom)}</option>`).join('')}</select>`):''}
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
      ${inp('loc_charges','Charges mensuelles (€)','number')}
      ${f('','Charges',`<select class="fsel" id="gm-charges_mode"><option value="provision" ${m.charges_mode!=='forfait'?'selected':''}>Provision, régularisée chaque année</option><option value="forfait" ${m.charges_mode==='forfait'?'selected':''}>Forfait (meublé seulement, sans régularisation)</option></select>`)}
      ${inp('loc_depot','Dépôt de garantie (€)','number')}
      ${inp('loc_jour','Jour de paiement','number')}
      ${f('','Date de révision du loyer',`<input class="fi" type="date" id="gm-irl_date" value="${gaE(m.fin_bail?.irl_date||'')}"><div style="font-size:.66rem;color:var(--td);margin-top:.15rem">Vide = date anniversaire du bail</div>`)}
      ${f('','Dernière révision faite le',`<input class="fi" type="date" id="gm-irl_last" value="${gaE(m.fin_bail?.irl_last?.date||'')}">`)}
      ${f('','Trimestre IRL de référence',`<select class="fsel" id="gm-irl_tri"><option value="">Selon la date du bail</option>${[1,2,3,4].map(q=>`<option value="${q}" ${+m.fin_bail?.irl_trimestre===q?'selected':''}>T${q}</option>`).join('')}</select>`)}
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
    listing_id:gaV('gm-listing_id')||null,bien_label:gaV('gm-bien_label')||null,bien_adresse:gaV('gm-bien_adresse')||null,bien_surface:gaN('gm-bien_surface'),bien_meuble:gaV('gm-type_bail')==='habitation_meuble',
    annee_construction:gaN('gm-annee_construction'),chaudiere:gaC('gm-chaudiere'),
    taux_honoraires:gaN('gm-taux_honoraires')??0,base_honoraires:gaV('gm-base_honoraires'),frais_fixes:gaN('gm-frais_fixes')??0,seuil_travaux:gaN('gm-seuil_travaux')??0,reversement_jour:gaN('gm-reversement_jour')||10,
    depot_detenu_par:gaV('gm-depot_detenu_par'),gli:gaC('gm-gli'),gli_taux:gaN('gm-gli_taux')??0,gli_assureur:gaV('gm-gli_assureur')||null,gli_delai_jours:gaN('gm-gli_delai_jours')||30,
    lease_id:gaV('gm-lease_id')||null,
    loc_nom:gaV('gm-loc_nom')||null,loc_email:gaV('gm-loc_email').toLowerCase()||null,loc_phone:gaV('gm-loc_phone')||null,loc_debut:gaV('gm-loc_debut')||null,
    loc_loyer_hc:gaN('gm-loc_loyer_hc'),loc_charges:gaN('gm-loc_charges'),loc_depot:gaN('gm-loc_depot'),loc_jour:gaN('gm-loc_jour')||1,charges_mode:gaV('gm-charges_mode')||'provision',
    loc_garantie:gaV('gm-loc_garantie')||null,loc_garant_nom:gaV('gm-loc_garant_nom')||null,loc_garant_email:gaV('gm-loc_garant_email').toLowerCase()||null,
    auto_avis:gaC('gm-auto_avis'),auto_relances:gaC('gm-auto_relances'),auto_quittance:gaC('gm-auto_quittance'),auto_crg:gaC('gm-auto_crg'),auto_conformite:gaC('gm-auto_conformite'),
    notes:gaV('gm-notes')||null,updated_at:new Date().toISOString()};
  // Résiliation : date et motif (statistiques de départ des propriétaires)
  if(row.statut==='resilie'){row.date_resiliation=gaV('gm-date_resiliation')||(id&&gaMandat(id)?.date_resiliation)||gaToday();row.motif_resiliation=gaV('gm-motif_resiliation')||null;}
  // Type de bail, indice, TVA, société (colonnes ajoutées par la migration du logiciel de gérance)
  row.type_bail=gaV('gm-type_bail')||null;row.indice=gaV('gm-indice')||null;
  if(GA_BAUX[row.type_bail]?.tva){row.tva_loyer=gaV('gm-tva_loyer')==='1';row.tva_taux=gaN('gm-tva_taux')??20;}else row.tva_loyer=false;
  if(document.getElementById('gm-entite_id'))row.entite_id=gaV('gm-entite_id')||null;
  if(row.charges_mode==='forfait'&&row.type_bail!=='habitation_meuble'&&GA_BAUX[row.type_bail]?.hab){toast('En habitation, le forfait de charges n’est possible qu’en meublé : choisissez « Provision ».');return;}
  if(!row.owner_name){toast('Indiquez le nom du propriétaire');return;}
  if(!row.listing_id&&!row.bien_label&&!row.bien_adresse){toast('Indiquez le bien géré');return;}
  if(row.lease_id){row.loc_nom=null;}
  // Révision du loyer (locataire déjà en place)
  if(document.getElementById('gm-irl_date')){const old=(id&&gaMandat(id)?.fin_bail)||{};const fb={...old};
    const d=gaV('gm-irl_date'),l=gaV('gm-irl_last'),q=gaV('gm-irl_tri');
    if(d)fb.irl_date=d;else delete fb.irl_date;
    if(l){if(old.irl_last?.date!==l)fb.irl_last={...(old.irl_last?.date===l?old.irl_last:{}),date:l,manuel:true};}else if(old.irl_last&&!old.irl_last.nouveau)delete fb.irl_last;
    if(q)fb.irl_trimestre=+q;else delete fb.irl_trimestre;
    if(JSON.stringify(fb)!==JSON.stringify(old))row.fin_bail=fb;}
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
  gaDoc({m:typeof m!=='undefined'?m:null,titre:`Fiche du mandat de gestion n° ${m.numero}`,dest:[m.owner_name,m.owner_address],fichier:`mandat-${m.numero}`,
    table:{head:['Rubrique','Détail'],widths:[60,114],rows:[
      ['Mandant',`${m.owner_name||''} — ${m.owner_email||''} ${m.owner_phone||''}`],['Bien géré',`${gaBien(m)} — ${gaAdresse(m)}`],
      ['Type de bail',GA_BAUX[gaTypeBail(m)].l+(gaTva(m)?` (TVA ${gaTva(m)} %)`:'')],['Date / durée',`${gaFrC(m.date_signature)} — ${m.duree_mois} mois${m.tacite?', reconduction tacite':''}`],
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
function gaSplit(p,t){const tot=(t?.hc||0)+(t?.ch||0);const amt=+p.amount||0;const k=1+(t?.tva||0)/100;const ht=amt/k;const tva=gaR(amt-ht);if(!tot)return{hc:gaR(ht),ch:0,tva};const hc=gaR(ht*t.hc/tot);return{hc,ch:gaR(amt-tva-hc),tva};}
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
  gaDoc({m:typeof m!=='undefined'?m:null,titre:'Avis d’échéance',dest:[t?.nom||p.tenant_name||'',gaAdresse(m)],fichier:`avis-echeance-${String(p.due_date).slice(0,7)}`,
    avant:[`Bien loué : ${gaBien(m)} — ${gaAdresse(m)}`,`Bailleur : ${m.owner_name||''}, représenté par ${gaAgence().nom}, mandataire.`,`Période : ${per}`],
    table:{head:['Désignation','Montant'],widths:[124,50],align:['l','r'],rows:[['Loyer'+(s.tva?' (HT)':''),gaEur(s.hc)],['Provision sur charges'+(s.tva?' (HT)':''),gaEur(s.ch)],...(s.tva?[[`TVA ${t.tva} %`,gaEur(s.tva)]]:[]),...(arr?[['Arriéré à régulariser',gaEur(arr)]]:[])],foot:[['Total à régler',gaEur(+p.amount+arr)]]},
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
  gaDoc({m:typeof m!=='undefined'?m:null,titre:`Quittance de loyer — ${per}`,dest:[t?.nom||p.tenant_name||'',gaAdresse(m)],fichier:`quittance-${ym}`,
    avant:[`Bien loué : ${gaBien(m)} — ${gaAdresse(m)}`],
    table:{head:['Désignation','Montant'],widths:[124,50],align:['l','r'],rows:[['Loyer'+(s.tva?' (HT)':''),gaEur(s.hc)],['Provision sur charges'+(s.tva?' (HT)':''),gaEur(s.ch)],...(s.tva?[[`TVA ${t.tva} %`,gaEur(s.tva)]]:[])],foot:[[`Total reçu le ${gaFrC(p.paid_at)}`,gaEur(gaPaid(p))]]},
    apres:[txt,'Le paiement de la présente quittance n’emporte pas présomption de paiement des termes antérieurs.']});
}

// ── Rapprochement bancaire (relevé CSV) ─────────────────────────────
function gaRapprochement(){gaCloseModal();if(typeof spG==='function')spG('banque');else gaGo({t:'banque'});}
function gaCsvParse(txt){
  // CSV « à la française » : séparateur ; , ou tabulation, champs entre guillemets
  // pouvant contenir des retours à la ligne (libellés sur plusieurs lignes du Crédit Agricole, de la Banque Postale…)
  txt=String(txt||'').replace(/^﻿/,'');
  const first=txt.split(/\r?\n/).slice(0,15).join('\n');
  const sep=[';','\t',','].map(c=>[c,first.split(c).length]).sort((a,b)=>b[1]-a[1])[0][0];
  const rows=[];let row=[],cur='',q=false;
  for(let i=0;i<txt.length;i++){const ch=txt[i];
    if(q){if(ch==='"'){if(txt[i+1]==='"'){cur+='"';i++;}else q=false;}else cur+=ch;continue;}
    if(ch==='"'){q=true;continue;}
    if(ch===sep){row.push(cur);cur='';continue;}
    if(ch==='\r')continue;
    if(ch==='\n'){row.push(cur);rows.push(row);row=[];cur='';continue;}
    cur+=ch;}
  if(cur||row.length){row.push(cur);rows.push(row);}
  return rows.map(r=>r.map(x=>x.replace(/\s*\n\s*/g,' ').trim())).filter(r=>r.some(x=>x));
}
const gaNum=s=>{if(s==null)return null;let v=String(s).replace(/[\s €]/g,'');if(!v)return null;if(/,\d{1,2}$/.test(v))v=v.replace(/\./g,'').replace(',','.');else v=v.replace(/,/g,'');const n=parseFloat(v);return isNaN(n)?null:n;};
const gaDateFr=s=>{s=String(s||'').trim();const i=s.match(/^(\d{4})-(\d{2})-(\d{2})/);if(i)return i[0];const m=s.match(/(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})/);if(m)return`${m[3].length===2?'20'+m[3]:m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;const c=s.match(/^(\d{4})(\d{2})(\d{2})$/);return c?`${c[1]}-${c[2]}-${c[3]}`:null;};

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
  gaDoc({m:typeof m!=='undefined'?m:null,dest:[t?.nom||p.tenant_name||'',gaAdresse(m)],objet:`Loyer impayé — échéance du ${gaFr(p.due_date)}`,fichier:'relance-loyer',
    avant:[`${t?.nom?'Madame, Monsieur '+t.nom:'Madame, Monsieur'},`,`Sauf erreur de notre part, nous n’avons pas reçu le règlement du loyer et des charges de ${gaEur(gaReste(p))}, exigible le ${gaFr(p.due_date)}, pour le logement situé ${gaAdresse(m)}, que nous gérons pour le compte de ${m.owner_name||'votre bailleur'}.`,
      'Nous vous remercions de bien vouloir procéder à ce règlement dans les meilleurs délais. Si vous rencontrez des difficultés, prenez contact avec nous : un échéancier peut être envisagé, et vous pouvez solliciter la CAF ou le Fonds de solidarité pour le logement (FSL) de votre département.',
      'Veuillez agréer, Madame, Monsieur, nos salutations distinguées.']});
}
function gaLettreMED(id){
  const{p,m,t}=gaPayCtx(id);const tot=gaPays(m).filter(gaUnpaid).filter(x=>x.due_date<=gaToday()).reduce((s,x)=>s+gaReste(x),0);
  gaDoc({m:typeof m!=='undefined'?m:null,mention:'LETTRE RECOMMANDÉE AVEC ACCUSÉ DE RÉCEPTION',dest:[t?.nom||p.tenant_name||'',gaAdresse(m)],objet:'Mise en demeure de payer',fichier:'mise-en-demeure',
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
  gaDoc({m:typeof m!=='undefined'?m:null,mention:'LETTRE RECOMMANDÉE AVEC ACCUSÉ DE RÉCEPTION',dest:[t?.garant_nom||'Le garant',''],objet:`Information de la caution — défaillance du locataire ${t?.nom||''}`,fichier:'information-garant',
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
  gaDoc({m:typeof m!=='undefined'?m:null,dest:['Commissaire de justice',''],objet:`Demande de commandement de payer — ${t?.nom||''}`,fichier:'demande-commandement',
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
  gaDoc({m:typeof m!=='undefined'?m:null,titre:'Protocole d’accord — plan d’apurement',dest:[t?.nom||'',gaAdresse(m)],fichier:'plan-apurement',
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
    <button class="btn bp bsm" onclick="gaSepaVirementsModal()"><i data-lucide=send class=ic></i> Virements SEPA (${gaEur(tot)})</button>
    <button class="btn bg bsm" onclick="gaVirementsCsv()"><i data-lucide=download class=ic></i> CSV</button>
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
        <button class="btn bg bsm" onclick="gaAccesProprio('${gaQ(o.key)}')"><i data-lucide=user-round class=ic></i> Espace en ligne${(GA.acces||[]).some(a=>a.owner_key===o.key&&a.envoye_at)?' ✓':''}</button>
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
    <div class="fg"><label class="fl">Type</label><select class="fsel" id="go-t"><option value="travaux">Travaux / facture payée pour le propriétaire</option><option value="frais">Frais (courrier, commissaire de justice…)</option><option value="assurance">Assurance (PNO…)</option><option value="taxe_fonciere">Taxe foncière payée pour le propriétaire</option><option value="copro">Charges de copropriété (appel du syndic)</option><option value="teom">TEOM refacturée au locataire</option><option value="regul_charges">Régularisation de charges</option><option value="divers">Divers</option></select></div>
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
  gaDoc({m:typeof m!=='undefined'?m:null,titre:`Compte rendu de gestion — ${gaMoisLbl(ym)}`,dest:[o.name,o.address],fichier:`CRG-${ym}-${o.name.replace(/\W+/g,'-')}`,retour,
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
  for(const m of o.ms){const t=gaTen(m);for(const p of gaPays(m)){const v=gaPaid(p);if(!v||!String(p.paid_at||'').startsWith(String(an)))continue;const s=gaSplit({amount:v},t);hc+=s.hc;ch+=s.ch;}}
  const travaux=-GA.ops.filter(x=>o.ms.some(m=>m.id===x.mandat_id)&&x.type==='travaux'&&String(x.date).startsWith(String(an))).reduce((s,x)=>s+(+x.montant||0),0);
  const assur=-GA.ops.filter(x=>o.ms.some(m=>m.id===x.mandat_id)&&x.type==='assurance'&&String(x.date).startsWith(String(an))).reduce((s,x)=>s+(+x.montant||0),0);
  const meuble=o.ms.some(m=>gaTypeBail(m)==='habitation_meuble');
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
    <div style="display:flex;gap:.3rem"><button class="btn bg bsm" onclick="gaFiscalPdf('${gaQ(o.key)}')"><i data-lucide=file-text class=ic></i> Récapitulatif PDF</button>${o.ms.some(m=>gaTypeBail(m)!=='habitation_meuble')?`<button class="btn bg bsm" onclick="ga2044Modal('${gaQ(o.key)}')"><i data-lucide=landmark class=ic></i> Aide 2044</button>`:''}${o.ms.some(m=>gaTva(m))?`<button class="btn bg bsm" onclick="gaTvaModal('${gaQ(o.key)}')">TVA</button>`:''}<button class="btn bg bsm" onclick="gaFiscalMail('${gaQ(o.key)}')"><i data-lucide=mail class=ic></i> Envoyer</button></div></div>
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
  gaDoc({m:typeof m!=='undefined'?m:null,titre:`Récapitulatif annuel de gestion — revenus ${an}`,dest:[o.name,o.address],fichier:`recap-fiscal-${an}-${o.name.replace(/\W+/g,'-')}`,
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
  gaDoc({m:typeof m!=='undefined'?m:null,titre:'Bon d’intervention',dest:[i.prestataire_nom||'Prestataire',i.prestataire_contact||''],fichier:'bon-intervention',
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
  gaDoc({m:typeof m!=='undefined'?m:null,mention:'LETTRE RECOMMANDÉE AVEC ACCUSÉ DE RÉCEPTION',dest:[f.locataire||'',f.adresse_sortie||''],objet:'Restitution du dépôt de garantie',fichier:'restitution-depot',
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
// IRL publié mi-mois après le trimestre ; ILC / ILAT publiés environ 3 mois après la fin du trimestre
const gaIrlPub=(y,q,ind)=>ind==='ILC'||ind==='ILAT'?(q===4?`${y+1}-03-25`:`${y}-${['06','09','12'][q-1]}-25`):(q===4?`${y+1}-01-15`:`${y}-${['04','07','10'][q-1]}-15`);
const gaIdxTable=ind=>ind==='ILC'?GA_ILC:ind==='ILAT'?GA_ILAT:GA_IRL;
// Dernier indice publié à une date donnée, pour un trimestre donné (ou tous trimestres)
function gaIrlAt(date,tri,ind){
  let best=null;const T=gaIdxTable(ind);
  for(const k of Object.keys(T)){const[y,q]=k.split('-').map(Number);if(tri&&q!==tri)continue;if(gaIrlPub(y,q,ind)<=date&&(!best||gaIrlPub(y,q,ind)>gaIrlPub(best.y,best.q,ind)))best={y,q,v:T[k]};}
  return best;
}
// Date de révision annuelle : celle indiquée (import / réglages du bien), sinon la date anniversaire du bail
const gaIrlAnchor=(m,t)=>m?.fin_bail?.irl_date||t?.debut||null;
function gaIrlNext(m,t){const a=gaIrlAnchor(m,t);if(!a)return null;const d=new Date(String(a).slice(0,10)+'T12:00:00');const today=gaToday();
  let an=new Date(new Date().getFullYear(),d.getMonth(),d.getDate(),12);if(gaIso(an)<=today)an.setFullYear(an.getFullYear()+1);return gaIso(an);}
function gaIrlInfo(m){
  const t=gaTen(m);if(!t?.debut||!t.hc)return null;
  const ind=gaIndice(m);if(ind==='aucun')return null;const hab=gaHabitation(m);
  const L=t.lease;const today=gaToday();
  const deb=new Date(t.debut+'T12:00:00');const now=new Date();const ref=new Date(String(gaIrlAnchor(m,t)).slice(0,10)+'T12:00:00');
  let anniv=new Date(now.getFullYear(),ref.getMonth(),ref.getDate(),12);if(anniv>now)anniv.setFullYear(anniv.getFullYear()-1);
  if(anniv<=deb)return{due:false,prochaine:gaIrlNext(m,t)};
  const an=gaIso(anniv);
  const last=L?.irl_last_revision||m.fin_bail?.irl_last;
  if(last&&String(last.date||'')>=an)return{due:false,prochaine:gaIrlNext(m,t)};
  const dpe=GA.ech.find(x=>x.mandat_id===m.id&&x.type==='dpe');
  if(hab&&['F','G'].includes(String(dpe?.resultat||'').toUpperCase()))return{due:false,gel:true,prochaine:gaIrlNext(m,t)}; // gel des loyers : habitation seulement
  if(gaDays(an,today)>365)return null;
  const tri=+(L?.irl_ref_trimestre||m.fin_bail?.irl_trimestre||gaIrlAt(t.debut,null,ind)?.q||0);if(!tri)return null;
  const nw=gaIrlAt(an,tri,ind);if(!nw)return null;
  const old=gaIdxTable(ind)[`${nw.y-1}-${tri}`];if(!old)return null;
  const nouveau=gaR(t.hc*nw.v/old);
  // Habitation : uniquement à la hausse ; commerces / bureaux : clause d'indexation à la hausse comme à la baisse
  return{due:hab?nouveau>t.hc:Math.abs(nouveau-t.hc)>=0.01,prochaine:gaIrlNext(m,t),ancien:t.hc,nouveau,ref:`${ind} T${tri} ${nw.y-1} → ${nw.y} : ${old} → ${nw.v}`,anniv:an,refNew:nw.v,refOld:old,tri,ind};
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
  for(const p of fut){const amt=gaR((i.nouveau+t.ch)*(1+(t.tva||0)/100));await sb.from('payments').update({amount:amt}).eq('id',p.id);p.amount=amt;}
  await gaMail(t.email,`Révision annuelle de votre loyer — ${gaBien(m)}`,'Révision annuelle du loyer',`<p>Bonjour ${gaE(t.nom)},</p><p>Conformément à la clause de révision de votre bail, votre loyer hors charges est révisé selon l’indice ${i.ind==='ILC'?'des loyers commerciaux':i.ind==='ILAT'?'des loyers des activités tertiaires':'de référence des loyers'} (${i.ref}) : <strong>${gaEur(i.ancien)} → ${gaEur(i.nouveau)}</strong>, à compter de la prochaine échéance. Les charges restent inchangées.</p>`);
  if(t.tenant_id)await gaMsg(t.tenant_id,m.listing_id,`Révision annuelle du loyer (${i.ind}) : ${gaEur(i.ancien)} → ${gaEur(i.nouveau)} hors charges à compter de la prochaine échéance.`);
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
GA.view=window.__gaView||{t:'home'};
function gaGo(v){GA.view=v;gaRender();try{const k={agenda:'agenda',owners:'owners',banque:'banque',stats:'stats',compta:'compta',prelev:'prelev',assur:'assur',courriers:'courriers',params:'params'}[v.t]||'home';document.querySelectorAll('.ni').forEach(n=>n.classList.remove('act'));(document.querySelector(`.ni[onclick*="spG('${k}'"]`)||document.querySelector(`.ni[onclick*="sp('gestion'"]`))?.classList.add('act');}catch(e){}const mn=document.getElementById('main');if(mn)mn.scrollTop=0;window.scrollTo(0,0);}
function gaTab(t){gaGo({t:{reversements:'owners',fiscal:'fiscal',outils:'outils',encaissements:'enc',fins:'home',conformite:'home',irl:'home',interventions:'home',recouvrement:'home',mandats:'home'}[t]||'home'});}
function gaRender(){
  const nav=document.getElementById('ga-tabs');if(nav)nav.style.display='none';
  const body=document.getElementById('ga-body');if(!body)return;
  const v=GA.view||{t:'home'};
  const back=(lbl)=>`<button class="btn bg bsm" onclick="gaGo({t:'home'})" style="margin-bottom:1rem"><i data-lucide=arrow-left class=ic></i> ${lbl||'Mes biens gérés'}</button>`;
  try{
    body.innerHTML=v.t==='agenda'?gaRenderAgenda():v.t==='bien'?gaRenderFiche(v.id,v.s||'suivi')
      :v.t==='owners'?`<div style="font-size:1.2rem;font-weight:700;margin-bottom:.8rem">Propriétaires & reversements</div>`+gaRenderRev()
      :v.t==='fiscal'?back()+`<div style="font-size:1.05rem;font-weight:700;margin-bottom:.8rem">Récapitulatifs fiscaux des propriétaires</div>`+gaRenderFiscal()
      :v.t==='enc'?back()+`<div style="font-size:1.05rem;font-weight:700;margin-bottom:.8rem">Tous les loyers du mois</div>`+gaRenderEnc()
      :v.t==='outils'?back()+gaRenderOutils()
      :v.t==='banque'?gaRenderBanque()
      :v.t==='stats'?gaRenderStats()
      :v.t==='compta'?gaRenderCompta()
      :v.t==='prelev'?gaRenderPrelevements()
      :v.t==='assur'?gaRenderAssurances()
      :v.t==='courriers'?gaRenderCourriers()
      :v.t==='params'?gaRenderParams()
      :gaRenderHome();
  }catch(e){console.error(e);body.innerHTML=`<div style="color:var(--red);padding:1rem">Erreur d’affichage : ${gaE(e.message)}</div>`;}
  const n=gaBulkCount();const sbNb=document.getElementById('nb-gestion');if(sbNb){sbNb.textContent=n;sbNb.style.display=n?'inline':'none';}
  try{const nb=(GA.bank||[]).filter(b=>b.statut==='a_traiter').length;const e=document.getElementById('nb-banque');if(e){e.textContent=nb;e.style.display=nb?'inline':'none';}}catch(e){}
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
return`${gaEntiteBar()}<div style="display:flex;justify-content:space-between;align-items:center;gap:.6rem;flex-wrap:wrap;margin-bottom:1rem">
    <div><div style="font-size:1.15rem;font-weight:700">Mes biens gérés</div>
      <div style="font-size:.76rem;color:var(--td)">${act.length} bien${pl(act.length,'','s')} en gestion${att?` · loyers de ${gaMoisLbl(cur)} : ${gaEur(enc)} reçus sur ${gaEur(att)}`:''}</div></div>
    <div style="display:flex;gap:.4rem;flex-wrap:wrap"><button class="btn bg bsm" onclick="gaImportModal()"><i data-lucide=upload class=ic></i> Importer depuis mon ancien logiciel</button><button class="btn bp bsm" onclick="gaQuickAdd()"><i data-lucide=plus class=ic></i> Ajouter un bien</button></div>
  </div>
  ${gaRepriseAFaire().length?`<div class="card" style="margin-bottom:.9rem;border-color:rgba(232,160,32,.45)"><div class="cb" style="display:flex;gap:.8rem;align-items:center;justify-content:space-between;flex-wrap:wrap;padding:.75rem 1rem">
    <div style="font-size:.82rem"><strong><i data-lucide=calculator class=ic style="color:var(--gold)"></i> Reprise des charges à compléter</strong> · ${gaRepriseAFaire().length} bien${gaRepriseAFaire().length>1?'s':''} importé${gaRepriseAFaire().length>1?'s':''} : dernière régularisation et provisions appelées par l’ancien logiciel (2 minutes).</div>
    <button class="btn bp bsm" onclick="gaRepriseCharges()">Compléter</button></div></div>`:''}
  ${act.length||libres.length?`${gaHomeBar(act,libres)}<div id="ga-home-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(270px,1fr));gap:.8rem">${sorted.map(m=>`<div class="ga-hc" data-f="${gaImpayes(m).length?'imp ':''}${gaTen(m)?'':'vac '}${tk(m).some(x=>x.p===1)?'urg ':''}" data-q="${gaE(gaHomeKey(m))}">${gaCard(m,tk(m))}</div>`).join('')}${libres.map(l=>`<div class="ga-hc" data-f="vac libre" data-q="${gaE(gaHomeNorm([l.title,l.full_address,l.zone,l.manual_landlord_name,l.manual_landlord_email].join(' ')))}">${gaCardLibre(l)}</div>`).join('')}</div>
    <div id="ga-home-none" style="display:none;text-align:center;padding:2rem 1rem;color:var(--td);font-size:.85rem">Aucun bien ne correspond. <a href="#" onclick="gaHomeReset();return false" style="color:var(--agencybright)">Tout afficher</a></div>`
    :`<div class="card"><div class="cb" style="text-align:center;padding:2rem 1rem">
      <div style="font-size:1rem;font-weight:700;margin-bottom:.4rem">Ajoutez votre premier bien en gestion</div>
      <div style="font-size:.8rem;color:var(--td);max-width:460px;margin:0 auto 1rem;line-height:1.55">Propriétaire, bien, locataire : c’est tout. Ensuite, les avis d’échéance, quittances, relances et comptes rendus partent tout seuls.</div>
      <div style="display:flex;gap:.5rem;justify-content:center;flex-wrap:wrap"><button class="btn bp" onclick="gaImportModal()"><i data-lucide=upload class=ic></i> Importer depuis mon ancien logiciel</button><button class="btn bg" onclick="gaQuickAdd()"><i data-lucide=plus class=ic></i> Ajouter un bien à la main</button></div>
      <div style="font-size:.72rem;color:var(--td);margin-top:.7rem">Crypto, ICS, Apimo, Hektor, Gercop, Immofacile, Rentila, Excel… : un export Excel ou CSV suffit.</div></div></div>`}`;
}
// ── Recherche et filtres de l'accueil (filtrage instantané, sans recharger) ──
const gaHomeNorm=s=>String(s??'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ');
function gaHomeKey(m){const t=gaTen(m);const l=gaListing(m.listing_id);
  return gaHomeNorm([gaBien(m),gaAdresse(m),m.bien_label,m.bien_adresse,l?.title,l?.zone,m.numero?'n'+m.numero+' mandat '+m.numero:'',m.owner_name,m.owner_email,m.owner_phone,t?.nom,t?.email,t?.tel,t?.garant_nom].filter(Boolean).join(' | '));}
function gaHomeBar(act,libres){
  GA.homeQ=GA.homeQ||'';GA.homeF=GA.homeF||'';
  const n=f=>[...act.map(m=>(gaImpayes(m).length?'imp ':'')+(gaTen(m)?'':'vac ')),...libres.map(()=>'vac ')].filter(x=>x.includes(f)).length;
  const chip=(k,l,c)=>`<button class="btn ${GA.homeF===k?'bp':'bg'} bsm ga-hf" data-k="${k}" onclick="gaHomeSetF('${k}')" style="font-size:.74rem">${l}${c!=null?` <span style="opacity:.75">${c}</span>`:''}</button>`;
  setTimeout(gaHomeApply,0);
  return`<style>.ga-hc{display:flex;flex-direction:column;min-width:0}.ga-hc>.card{flex:1}.ga-hc.ga-off{display:none}</style>
  <div style="display:flex;gap:.5rem;align-items:center;flex-wrap:wrap;margin-bottom:.9rem">
    <div style="position:relative;flex:1;min-width:220px;max-width:460px"><i data-lucide=search class=ic style="position:absolute;left:.7rem;top:50%;transform:translateY(-50%);color:var(--td);pointer-events:none"></i>
      <input id="ga-home-q" class="fi" type="search" autocomplete="off" placeholder="Rechercher un bien, un locataire, un propriétaire, une adresse…" value="${gaE(GA.homeQ)}" oninput="GA.homeQ=this.value;gaHomeApply()" style="padding-left:2.1rem;width:100%"></div>
    <div style="display:flex;gap:.3rem;flex-wrap:wrap">${chip('','Tous')}${chip('imp','Impayés',n('imp'))}${chip('vac','Vacants',n('vac'))}${chip('urg','Urgent')}</div>
    <span id="ga-home-count" style="font-size:.74rem;color:var(--td)"></span></div>`;
}
function gaHomeSetF(k){GA.homeF=GA.homeF===k?'':k;document.querySelectorAll('.ga-hf').forEach(b=>{b.classList.toggle('bp',b.dataset.k===GA.homeF);b.classList.toggle('bg',b.dataset.k!==GA.homeF);});gaHomeApply();}
function gaHomeReset(){GA.homeQ='';GA.homeF='';const i=document.getElementById('ga-home-q');if(i)i.value='';gaHomeSetF('');}
function gaHomeApply(){
  const words=gaHomeNorm(GA.homeQ||'').trim().split(' ').filter(Boolean);const f=GA.homeF||'';
  const cards=[...document.querySelectorAll('#ga-home-grid .ga-hc')];let vis=0;
  for(const c of cards){const ok=words.every(w=>c.dataset.q.includes(w))&&(!f||c.dataset.f.includes(f));c.classList.toggle('ga-off',!ok);if(ok)vis++;}
  const none=document.getElementById('ga-home-none');if(none)none.style.display=cards.length&&!vis?'':'none';
  const cnt=document.getElementById('ga-home-count');if(cnt)cnt.textContent=words.length||f?`${vis} résultat${vis>1?'s':''}`:'';
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
  if(t){const i=gaIrlInfo(m);if(i?.due)A.push({r:0,ic:'trending-up',l:`Révision ${i.ind||"IRL"} : ${gaEur(i.nouveau)}`});}
  {const u=gaUnreadMsgs(m);if(u.length)A.push({r:1,ic:'message-circle',l:u.length>1?`${u.length} nouveaux messages`:'Nouveau message du locataire'});}
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
  const tabs=[['suivi','Suivi','activity'],['loc','Locataire','user'],['loyers','Loyers','wallet'],['docs','Documents','folder'],['travaux','Travaux','wrench'],['msg','Messages'+(gaUnreadMsgs(m).length?' ('+gaUnreadMsgs(m).length+')':''),'message-circle'],['proprio','Propriétaire','briefcase']];
  const body={suivi:gaFSuivi,loc:gaFLoc,loyers:gaFLoyers,docs:gaFDocs,travaux:gaFTravaux,msg:gaFMessages,proprio:gaFProprio}[sub]||gaFSuivi;
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
    ${gaRow('Loyer',t.tva?`${gaEur(t.hc)} + ${gaEur(t.ch)} de charges HT + TVA ${t.tva} % = <strong>${gaEur((t.hc+t.ch)*(1+t.tva/100))} TTC</strong>, le ${t.jour} du mois`:`${gaEur(t.hc)} + ${gaEur(t.ch)} de charges = <strong>${gaEur(t.hc+t.ch)}</strong>, le ${t.jour} du mois`)}
    ${gaRow('Dépôt de garantie',gaEur(t.depot))}
    ${gaRow('Bail',`${(GA_BAUX[gaTypeBail(m)]||{}).l||(t.meuble?'Meublé':'Vide')}${t.tva?` · TVA ${t.tva} %`:''} · depuis le ${gaFrC(t.debut)}${t.fin?' · échéance '+gaFrC(t.fin):''}`)}
    ${gaRow('Garantie',gar)}
    ${gaRow("Révision "+gaIndice(m),irl?.gel?'Gelée (DPE F/G)':irl?.due?`${gaEur(irl.ancien)} → <strong>${gaEur(irl.nouveau)}</strong> <button class="btn bp bsm" onclick="gaApplyIrl('${m.id}')">Appliquer</button>`:`À jour${gaIrlNext(m,t)?' · prochaine le '+gaFrC(gaIrlNext(m,t)):''}${(m.fin_bail?.irl_last||t.lease?.irl_last_revision)?.date?' · dernière le '+gaFrC((m.fin_bail?.irl_last||t.lease?.irl_last_revision).date):''}`)}
    ${t.src==='ttt'&&t.lease?gaRow('Documents du bail',`<a href="/bail-meuble.html?lease_id=${t.lease.id}&role=landlord" target="_blank" style="color:var(--agencybright)">Bail</a>${t.lease.booking_id?` · <a href="/edl-meuble.html?booking_id=${t.lease.booking_id}" target="_blank" style="color:var(--agencybright)">État des lieux</a>`:''}`):''}
  </div></div>
  ${gaSepaBloc(m,t)}
  <div style="display:flex;gap:.4rem;flex-wrap:wrap;margin-bottom:.8rem"><button class="btn bg bsm" onclick="gaSignModal('${m.id}','avenant_bail')"><i data-lucide=pen-line class=ic></i> Faire signer un avenant en ligne</button></div>
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
    ${t?.ch>0&&!gaRegForfait(m)?`<button class="btn bg bsm" onclick="GRG={};gaRegulOpen('${m.id}')"><i data-lucide=calculator class=ic></i> Régulariser les charges</button>`:''}
    ${t?`<button class="btn bg bsm" onclick="gaTeomModal('${m.id}')"><i data-lucide=trash-2 class=ic></i> Refacturer la TEOM</button>`:''}
  </div>`;
  return outils+gaRegulBloc(m,t)+`${imp.length?`<div class="card" style="margin-bottom:.8rem;border-color:rgba(224,90,90,.35)"><div class="cb">
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
  return`${gaSinistresBloc(m)}<div style="margin-bottom:.7rem"><button class="btn bp bsm" onclick="gaNewInter('${m.id}')"><i data-lucide=plus class=ic></i> Nouvelle intervention</button></div>
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
      <button class="btn bg bsm" onclick="gaSignModal('${m.id}','mandat')"><i data-lucide=pen-line class=ic></i> Faire signer le mandat en ligne</button>
      <button class="btn bg bsm" onclick="gaAccesProprio('${gaQ(k)}')"><i data-lucide=user-round class=ic></i> Espace propriétaire en ligne</button>
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
  gaDoc({m:typeof m!=='undefined'?m:null,dest:[t.nom,gaAdresse(m)],objet:`Régularisation annuelle des charges ${an}`,fichier:`regul-charges-${an}`,
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
    else if(t.debut){const an=gaIrlNext(m,t);
      if(an&&!irl?.gel)fut(an,'trending-up','n','Révision annuelle du loyer (IRL)',m.fin_bail?.irl_date?'date de révision prévue au bail':'date anniversaire du bail',false);}
    const last=t.lease?.irl_last_revision||f.irl_last;if(last?.date)pas(last.date,'trending-up','n','Loyer révisé (IRL)',`${gaEur(last.ancien)} → ${gaEur(last.nouveau)}`);
    const finB=gaProchaineEcheance(t);
    if(finB&&!f.preavis_recu){fut(finB,'calendar-clock','n','Échéance du bail','reconduction tacite sauf congé',false);const pre=t.meuble?3:6;const lim=gaAddM(finB,-pre);if(lim>=today)fut(lim,'calendar-x','o','Date limite de congé du bailleur',`${pre} mois avant l’échéance`,false);}
    // TEOM
    const y=new Date().getFullYear();const teom=GA.ops.find(o=>o.mandat_id===m.id&&o.type==='teom'&&String(o.date).startsWith(String(y)));
    if(!teom)fut(`${y}-10-15`,'trash-2',new Date().getMonth()>=9?'o':'n',`TEOM ${y} à refacturer au locataire`,'montant sur l’avis de taxe foncière (octobre)',false,`gaTeomModal('${m.id}')`);
    else fut(`${y+1}-10-15`,'trash-2','n',`TEOM ${y+1} à refacturer`,'avis de taxe foncière',false);
    // Régularisation des charges
    gaRegulSuivi(m,t,fut,pas,today);
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

// ════════════════════ Import depuis l'ancien logiciel de gestion ════════════════════
// Les logiciels de gestion (Crypto, ICS, Apimo, Hektor, Gercop, Immofacile, Rentila, Excel…)
// exportent tous un « état locatif » en Excel ou CSV : une ligne par lot avec propriétaire,
// adresse, locataire, loyer… On reconnaît les colonnes automatiquement, l'agence vérifie, on importe.
const GA_IMP_FIELDS=[
  ['numero','N° de mandat',/^(n|no|num|numero)?\s*(de\s*)?mandat|^mandat\s*(n|no|num)/],
  ['date_signature','Date du mandat',/date.*mandat|mandat.*date|debut.*mandat/],
  ['owner_first','Prénom du propriétaire',/prenom.*(proprietaire|bailleur|mandant)|(proprietaire|bailleur|mandant).*prenom/],
  ['owner_name','Propriétaire',/proprietaire|bailleur|mandant|coproprietaire|owner|landlord/],
  ['owner_email','E-mail du propriétaire',/(mail|courriel).*(proprietaire|bailleur|mandant)|(proprietaire|bailleur|mandant).*(mail|courriel)/],
  ['owner_phone','Téléphone du propriétaire',/(tel|telephone|portable|mobile).*(proprietaire|bailleur|mandant)|(proprietaire|bailleur|mandant).*(tel|telephone|portable|mobile)/],
  ['owner_address','Adresse du propriétaire',/adresse.*(proprietaire|bailleur|mandant)|(proprietaire|bailleur|mandant).*adresse/],
  ['owner_iban','IBAN du propriétaire',/iban|rib/],
  ['taux_honoraires','Honoraires de gestion (%)',/honoraire|taux.*gestion|commission|frais.*gestion/],
  ['bien_label','Désignation du bien',/designation|libelle|lot|reference|ref\b|nom.*bien|bien$|^bien|immeuble|residence|programme/],
  ['bien_adresse','Adresse du bien',/adresse|rue|voie|address/],
  ['cp','Code postal',/code\s*postal|^cp$|postal|zip/],
  ['ville','Ville',/ville|commune|localite|city/],
  ['bien_surface','Surface (m²)',/surface|m2|superficie|habitable/],
  ['meuble','Meublé / vide',/meuble|nature.*bail|type.*bail|type.*location|^type$/],
  ['annee_construction','Année de construction',/annee.*constr|construction/],
  ['loc_first','Prénom du locataire',/prenom.*(locataire|occupant)|(locataire|occupant).*prenom/],
  ['loc_nom','Locataire',/locataire|occupant|preneur|tenant/],
  ['loc_email','E-mail du locataire',/(mail|courriel).*(locataire|occupant)|(locataire|occupant).*(mail|courriel)/],
  ['loc_phone','Téléphone du locataire',/(tel|telephone|portable|mobile).*(locataire|occupant)|(locataire|occupant).*(tel|telephone|portable|mobile)/],
  ['loc_loyer_cc','Loyer charges comprises',/loyer.*(cc|charges comprises|ttc|total)|total.*(mensuel|quittance)|quittancement/],
  ['loc_loyer_hc','Loyer hors charges',/loyer.*(hc|hors|nu|principal)|^loyer$|^loyer mensuel$|loyer/],
  ['loc_charges','Provision sur charges',/charges|provision/],
  ['loc_depot','Dépôt de garantie',/depot|garantie\s*\(|caution.*(montant|eur|€)|^dg$/],
  ['loc_debut','Début du bail',/(date|debut).*(entree|bail|effet|location)|entree.*lieux|date d.?entree|prise d.?effet/],
  ['loc_jour','Jour de paiement',/jour.*(paiement|echeance|quittance)|echeance$|terme/],
  ['loc_garant_nom','Garant',/garant|caution(?!.*montant)|cautionnaire/],
  ['loc_garantie','Type de garantie',/visale|gli|type.*garantie|assurance.*impaye/],
  ['derniere_regul','Dernière régularisation des charges',/(derniere|dern)\b.*regul|regul.*(faite|annee|exercice)|^regularisation/],
  ['charges_avant','Provisions de charges appelées cette année',/(provision|charge)s?.*(appele|deja|cumul|depuis|annee en cours|exercice en cours)|cumul.*(charge|provision)/],
  ['charges_mode','Charges : provision ou forfait',/^(mode|type|regime) (de |des )?charges|forfait ?(ou|\/) ?provision|provision ?(ou|\/) ?forfait/],
  ['irl_derniere','Dernière révision du loyer',/(derniere|dern)\b.*(revision|indexation|augmentation)|revise le|date.*derniere.*(revision|indexation)/],
  ['irl_prochaine','Date de révision du loyer',/(revision|indexation|reevaluation)(?!.*indice)|date.*anniversaire|anniversaire.*bail/],
  ['irl_trimestre','Indice IRL de référence',/\birl\b|indice|trimestre/],
  ['arriere','Solde dû par le locataire',/solde|arriere|impaye|reste a payer|restant du|montant du|debiteur/],
  ['assurance_fin','Fin de l’assurance habitation',/assurance.*(habitation|locataire|fin|echeance|valid)|attestation.*assurance/],
  ['dpe','Classe DPE',/dpe|classe.*energ|etiquette.*energ/],
];
const gaNorm=s=>String(s??'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[_\-./]+/g,' ').replace(/\s+/g,' ').trim();
let GA_IMP={rows:[],head:[],map:[],sheets:null};

function gaImportModal(){
  gaModal(`<div style="font-size:1.05rem;font-weight:700;margin-bottom:.25rem"><i data-lucide=upload class=ic></i> Importer mes biens depuis mon ancien logiciel</div>
  <div style="font-size:.78rem;color:var(--td);line-height:1.55;margin-bottom:.9rem">Dans votre logiciel actuel (Crypto, ICS, Apimo, Hektor, Gercop, Immofacile, Rentila, un tableau Excel…), exportez l’<strong>état locatif</strong> ou la <strong>liste des lots / baux</strong> en Excel ou CSV : une ligne par logement. Déposez le fichier ici : les colonnes sont reconnues automatiquement, vous vérifiez, puis tout est créé d’un coup (propriétaires, biens, locataires, loyers).</div>
  <label style="display:block;border:2px dashed var(--b2);border-radius:12px;padding:1.4rem;text-align:center;cursor:pointer;background:var(--s2)">
    <input type="file" id="ga-imp-file" accept=".csv,.txt,.xlsx,.xls,.ods" style="display:none" onchange="gaImpRead(this.files[0])">
    <i data-lucide=file-spreadsheet class=ic style="width:28px;height:28px"></i>
    <div style="font-weight:600;font-size:.88rem;margin-top:.4rem">Choisir le fichier Excel ou CSV</div>
    <div style="font-size:.72rem;color:var(--td);margin-top:.2rem">.xlsx, .xls, .ods ou .csv</div>
  </label>
  <div style="font-size:.74rem;color:var(--td);margin-top:.7rem">Pas d’export sous la main ? <a href="#" onclick="gaImpModele();return false" style="color:var(--agencybright)">Téléchargez notre modèle</a>, remplissez-le et déposez-le.</div>
  <div id="ga-imp-zone" style="margin-top:1rem"></div>`,true);
}
function gaImpModele(){
  gaCsv('modele-import-biens',['N° mandat','Propriétaire','E-mail propriétaire','Téléphone propriétaire','Adresse propriétaire','IBAN','Honoraires %','Désignation du bien','Adresse du bien','Code postal','Ville','Surface','Meublé (oui/non)','Locataire','E-mail locataire','Téléphone locataire','Loyer HC','Charges','Dépôt de garantie','Date d’entrée','Jour de paiement','Garant','Solde dû','Fin assurance habitation','DPE','Date de révision du loyer','Dernière révision','Indice IRL de référence','Dernière régularisation des charges','Provisions de charges appelées cette année'],
    [['12','Marie Dupont','marie@exemple.fr','06 12 34 56 78','2 place Bellecour, 69002 Lyon','FR76 3000 1000 0100 0000 0000 000','7','T2 Paul Bert','5 rue Paul Bert','69003','Lyon','45','oui','Rene Lafarge','rene@exemple.fr','06 98 76 54 32','790','60','1580','01/09/2025','1','Paul Lafarge','0','15/09/2027','D','01/09','01/09/2026','T2','2025','600']]);
}
function gaImpLoadXlsx(cb){
  if(window.XLSX)return cb();
  const s=document.createElement('script');s.src='https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
  s.onload=cb;s.onerror=()=>toast('Impossible de lire les fichiers Excel ici — enregistrez-le en CSV et réessayez');document.head.appendChild(s);
}
async function gaImpRead(file){
  if(!file)return;const z=document.getElementById('ga-imp-zone');z.innerHTML='<div class="sp"></div>';
  const ext=file.name.split('.').pop().toLowerCase();
  if(['xlsx','xls','ods'].includes(ext)){
    const buf=await file.arrayBuffer();
    gaImpLoadXlsx(()=>{
      const wb=XLSX.read(buf,{type:'array',cellDates:true});
      GA_IMP.sheets={};wb.SheetNames.forEach(n=>{GA_IMP.sheets[n]=XLSX.utils.sheet_to_json(wb.Sheets[n],{header:1,raw:true,defval:''});});
      const best=wb.SheetNames.slice().sort((a,b)=>GA_IMP.sheets[b].length-GA_IMP.sheets[a].length)[0];
      gaImpUseSheet(best);
    });
  }else{
    let txt=await file.text();if(/Ã©|Ã¨/.test(txt)){const b=await file.arrayBuffer();txt=new TextDecoder('windows-1252').decode(b);}
    if(!/[éèàç]/.test(txt)&&/�/.test(txt)){const b=await file.arrayBuffer();txt=new TextDecoder('windows-1252').decode(b);}
    GA_IMP.sheets=null;gaImpSetGrid(gaCsvParse(txt));
  }
}
function gaImpUseSheet(n){GA_IMP.sheet=n;gaImpSetGrid(GA_IMP.sheets[n]);}
function gaImpSetGrid(grid){
  grid=(grid||[]).filter(r=>r.some(c=>String(c??'').trim()!==''));
  // Ligne d'en-tête : la première qui contient au moins 3 intitulés reconnus
  let hi=0,bs=-1;
  grid.slice(0,15).forEach((r,i)=>{const sc=r.filter(c=>GA_IMP_FIELDS.some(f=>f[2].test(gaNorm(c)))).length;if(sc>bs){bs=sc;hi=i;}});
  GA_IMP.head=grid[hi].map(c=>String(c??'').trim());GA_IMP.rows=grid.slice(hi+1);
  // Correspondance automatique colonne → champ (chaque champ une seule fois, dans l'ordre de priorité)
  const used=new Set();GA_IMP.map=GA_IMP.head.map(()=>'');
  const ORDER=['owner_first','loc_first','owner_email','owner_phone','owner_address','loc_email','loc_phone','numero','date_signature','irl_derniere','irl_prochaine','irl_trimestre','derniere_regul','charges_avant','charges_mode','loc_debut','assurance_fin','loc_loyer_cc','loc_loyer_hc','loc_charges','loc_depot','loc_jour','bien_adresse','cp','ville','bien_surface','meuble','annee_construction','owner_iban','taux_honoraires','dpe','loc_garantie','loc_garant_nom','arriere','owner_name','loc_nom','bien_label'];
  for(const[k,,re]of ORDER.map(k=>GA_IMP_FIELDS.find(f=>f[0]===k))){
    const i=GA_IMP.head.findIndex((h,j)=>!GA_IMP.map[j]&&re.test(gaNorm(h)));
    if(i>=0&&!used.has(k)){GA_IMP.map[i]=k;used.add(k);}
  }
  gaImpPreview();
}
function gaImpPreview(){
  const z=document.getElementById('ga-imp-zone');const H=GA_IMP.head;const R=GA_IMP.rows;
  const opts=v=>`<option value="">— ignorer —</option>${GA_IMP_FIELDS.map(([k,l])=>`<option value="${k}" ${v===k?'selected':''}>${l}</option>`).join('')}`;
  const objs=gaImpObjects();const ok=objs.filter(o=>!o._err&&!o._dup);
  z.innerHTML=`${GA_IMP.sheets&&Object.keys(GA_IMP.sheets).length>1?`<div class="fg" style="margin-bottom:.6rem"><label class="fl">Onglet du fichier</label><select class="fsel" onchange="gaImpUseSheet(this.value)">${Object.keys(GA_IMP.sheets).map(n=>`<option ${n===GA_IMP.sheet?'selected':''}>${gaE(n)}</option>`).join('')}</select></div>`:''}
  <div style="font-size:.82rem;margin-bottom:.5rem"><strong>${R.length}</strong> ligne${R.length>1?'s':''} · <strong>${GA_IMP.map.filter(Boolean).length}</strong> colonnes reconnues sur ${H.length}. Vérifiez la correspondance (première ligne en exemple) :</div>
  <div style="max-height:32vh;overflow:auto;border:1px solid var(--b);border-radius:10px;margin-bottom:.8rem"><table class="tbl"><thead><tr><th>Colonne du fichier</th><th>Exemple</th><th>Correspond à</th></tr></thead><tbody>
    ${H.map((h,i)=>`<tr><td style="font-size:.76rem">${gaE(h||'(sans titre)')}</td><td style="font-size:.72rem;color:var(--td);max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${gaE(gaImpCellTxt(R[0]?.[i]))}</td>
      <td><select class="fsel" style="font-size:.74rem;padding:.25rem .4rem" onchange="GA_IMP.map[${i}]=this.value;gaImpPreview()">${opts(GA_IMP.map[i])}</select></td></tr>`).join('')}
  </tbody></table></div>
  ${GA_IMP.map.some(k=>k==='irl_prochaine'||k==='irl_derniere')?'':`<div style="font-size:.74rem;background:rgba(232,160,32,.1);color:var(--gold);border-radius:8px;padding:.5rem .7rem;margin-bottom:.7rem;line-height:1.5"><i data-lucide=trending-up class=ic></i> Pas de colonne « date de révision du loyer » reconnue : la révision IRL sera calculée à la date anniversaire du bail. Si votre fichier en a une, choisissez « Date de révision du loyer » dans la liste au-dessus de la colonne. Sinon, corrigez-la ensuite dans les réglages de chaque bien.</div>`}
  <div style="font-size:.82rem;font-weight:700;margin-bottom:.35rem">Aperçu de ce qui sera créé</div>
  <div style="max-height:30vh;overflow:auto;border:1px solid var(--b);border-radius:10px"><table class="tbl"><thead><tr><th></th><th>Bien</th><th>Propriétaire</th><th>Locataire</th><th>Loyer</th><th>Révision</th></tr></thead><tbody>
    ${objs.slice(0,200).map((o,i)=>`<tr style="${o._err||o._dup?'opacity:.5':''}"><td>${o._err||o._dup?'':`<input type="checkbox" class="ga-imp-cb" data-i="${i}" checked>`}</td>
      <td style="font-size:.75rem">${gaE(o.bien_label||o.bien_adresse||'—')}<div style="color:var(--td)">${gaE(o.bien_adresse||'')}</div></td>
      <td style="font-size:.75rem">${gaE(o.owner_name||'—')}</td>
      <td style="font-size:.75rem">${gaE(o.loc_nom||'vacant')}</td>
      <td style="font-size:.75rem">${o.loc_loyer_hc?gaEur(o.loc_loyer_hc)+(o.loc_charges?' + '+gaEur(o.loc_charges):''):'—'}${o._arriere?`<div style="color:var(--red)">dû ${gaEur(o._arriere)}</div>`:''}${o._err?`<div style="color:var(--red)">${o._err}</div>`:''}${o._dup?'<div style="color:var(--gold)">déjà dans vos biens</div>':''}</td>
      <td style="font-size:.72rem">${!o.loc_nom?'—':o._irl_next?`le ${gaFrC(o._irl_next).slice(0,5)}${o._irl_next>gaToday()?'<div style="color:var(--td)">prochaine '+gaFrC(o._irl_next)+'</div>':'<div style="color:var(--gold)">à faire</div>'}`:o._irl_last?`le ${gaFrC(o._irl_last).slice(0,5)}<div style="color:var(--td)">dernière ${gaFrC(o._irl_last)}</div>`:o.loc_debut?`<span style="color:var(--gold)">anniversaire du bail (${gaFrC(o.loc_debut).slice(0,5)})</span>`:'<span style="color:var(--gold)">inconnue</span>'}${o._irl_tri?`<div style="color:var(--td)">IRL T${o._irl_tri}</div>`:''}</td></tr>`).join('')}
  </tbody></table></div>
  <div style="display:flex;justify-content:space-between;align-items:center;gap:.6rem;flex-wrap:wrap;margin-top:.9rem">
    <div style="font-size:.72rem;color:var(--td);max-width:430px">Les loyers sont programmés à partir du mois prochain. Les soldes dus apparaissent en impayé sur le bien. Tout reste modifiable ensuite dans la fiche de chaque bien.</div>
    <button class="btn bp" onclick="gaImpGo()" ${ok.length?'':'disabled'}><i data-lucide=upload class=ic></i> Importer ${ok.length} bien${ok.length>1?'s':''}</button>
  </div>`;
  if(window.lucide)lucide.createIcons();
}
function gaImpCellTxt(v){if(v instanceof Date)return gaFrC(gaIso(v));return String(v??'');}
function gaImpDate(v){
  if(!v&&v!==0)return null;
  if(v instanceof Date&&!isNaN(v))return gaIso(v);
  if(typeof v==='number'&&v>20000&&v<80000){const d=new Date(Date.UTC(1899,11,30)+v*864e5);return d.toISOString().slice(0,10);}
  return gaDateFr(v);
}
// Trimestre de l'indice de référence : « T2 », « 2e trimestre », « IRL T3 2024 », ou la valeur de l'indice (145,17)
function gaImpTri(v){
  if(v==null||v==='')return null;const s=gaNorm(String(v));
  let m=s.match(/\bt\s*([1-4])\b|\b([1-4])\s*(er|e|eme|ème)?\s*(trim|t\b)/);if(m)return+(m[1]||m[2]);
  m=s.match(/(premier|deuxieme|second|troisieme|quatrieme)\s*trim/);if(m)return{premier:1,deuxieme:2,second:2,troisieme:3,quatrieme:4}[m[1]];
  const n=gaImpNum(v);if(n&&n>90&&n<300){const k=Object.entries(GA_IRL).find(([,x])=>Math.abs(x-n)<0.005);if(k)return+k[0].split('-')[1];}
  return null;
}
// Date de révision : date complète, ou seulement jour/mois (« 01/01 ») → prochaine occurrence
function gaImpRevDate(v){
  const d=gaImpDate(v);if(d)return d;
  const m=String(v??'').match(/^\s*(\d{1,2})[\/.-](\d{1,2})\s*$/);if(!m)return null;
  const y=new Date().getFullYear();let iso=`${y}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;if(iso<=gaToday())iso=`${y+1}${iso.slice(4)}`;return iso;
}
const gaImpNum=v=>typeof v==='number'?v:gaNum(String(v??'').replace(/[^\d,.\-\s]/g,''));
function gaImpObjects(){
  const existing=new Set(GA.mandats.map(m=>gaNorm((m.bien_adresse||'')+'|'+(m.owner_name||''))));
  const seen=new Set();
  return GA_IMP.rows.map(r=>{
    const g=k=>{const i=GA_IMP.map.indexOf(k);return i<0?'':r[i];};const s=k=>String(gaImpCellTxt(g(k))).trim();
    const o={};
    o.owner_name=[s('owner_first'),s('owner_name')].filter(Boolean).join(' ').replace(/\s+/g,' ').trim();
    o.owner_email=s('owner_email').toLowerCase()||null;o.owner_phone=s('owner_phone')||null;o.owner_address=s('owner_address')||null;o.owner_iban=s('owner_iban')||null;
    const num=parseInt(s('numero').replace(/\D/g,''));o.numero=num||null;
    o.date_signature=gaImpDate(g('date_signature'));
    const hon=gaImpNum(g('taux_honoraires'));o.taux_honoraires=hon!=null&&hon>0&&hon<30?hon:null;
    const adr=[s('bien_adresse'),[s('cp'),s('ville')].filter(Boolean).join(' ')].filter(Boolean);
    o.bien_adresse=adr.join(', ')||null;o.bien_label=s('bien_label')||(s('bien_adresse')?s('bien_adresse').split(',')[0]:null);
    o.bien_surface=gaImpNum(g('bien_surface'))||null;
    const mb=gaNorm(s('meuble'));o.bien_meuble=mb?!(/vide|non|nu\b|0|false|habitation principale vide/.test(mb)&&!/^meuble/.test(mb)):true;
    o.type_bail=/commerc|3.?6.?9|fonds de commerce/.test(mb)?'commercial':/profession|bureau|liberal/.test(mb)?'professionnel':/parking|garage|box|stationnement/.test(mb)?'parking':/mixte/.test(mb)?'mixte':null;
    if(o.type_bail)o.bien_meuble=false;
    o.annee_construction=parseInt(s('annee_construction'))||null;
    o.loc_nom=[s('loc_first'),s('loc_nom')].filter(Boolean).join(' ').replace(/\s+/g,' ').trim()||null;
    o.loc_email=s('loc_email').toLowerCase()||null;o.loc_phone=s('loc_phone')||null;
    o.loc_charges=gaImpNum(g('loc_charges'))||0;
    let hc=gaImpNum(g('loc_loyer_hc'));const cc=gaImpNum(g('loc_loyer_cc'));
    if(!hc&&cc)hc=gaR(cc-(o.loc_charges||0));
    o.loc_loyer_hc=hc||null;o.loc_depot=gaImpNum(g('loc_depot'))||null;o.loc_debut=gaImpDate(g('loc_debut'));
    const j=parseInt(s('loc_jour'));o.loc_jour=j>=1&&j<=28?j:1;
    o.loc_garant_nom=s('loc_garant_nom')||null;
    const gt=gaNorm(s('loc_garantie')+' '+s('loc_garant_nom'));o.loc_garantie=/visale/.test(gt)?'Visale':/gli|assurance/.test(gt)?'GLI':o.loc_garant_nom?'Caution personne physique':null;
    o._arriere=Math.max(0,gaImpNum(g('arriere'))||0);
    o._assur=gaImpDate(g('assurance_fin'));
    {const dr=s('derniere_regul');const y=dr.match(/(20\d\d)/);o._der_regul=y?+y[1]:/aucun|jamais|non/i.test(dr)?'aucune':null;}
    o._ch_avant=g('charges_avant')===''||g('charges_avant')==null?null:gaImpNum(g('charges_avant'));
    o._forfait=/forfait/i.test(s('charges_mode'))&&o.bien_meuble;
    o._irl_next=gaImpRevDate(g('irl_prochaine'));o._irl_last=gaImpDate(g('irl_derniere'));o._irl_tri=gaImpTri(g('irl_trimestre'));
    if(o._irl_next&&o._irl_last&&o._irl_next<=o._irl_last)o._irl_next=null; // une seule colonne « révision » = la dernière
    const dpe=s('dpe').toUpperCase().match(/\b[A-G]\b/);o._dpe=dpe?dpe[0]:null;
    if(!o.owner_name&&!o.bien_adresse&&!o.loc_nom)o._err='Ligne vide';
    else if(!o.owner_name)o._err='Propriétaire manquant';
    else if(!o.bien_adresse&&!o.bien_label)o._err='Adresse manquante';
    else if(o.loc_nom&&!o.loc_loyer_hc)o._err='Loyer manquant';
    const key=gaNorm((o.bien_adresse||'')+'|'+(o.owner_name||''));
    if(!o._err&&(existing.has(key)||seen.has(key)))o._dup=true;seen.add(key);
    return o;
  });
}
async function gaImpGo(){
  const objs=gaImpObjects();const sel=[...document.querySelectorAll('.ga-imp-cb:checked')].map(c=>objs[+c.dataset.i]).filter(o=>o&&!o._err&&!o._dup);
  if(!sel.length)return;
  const z=document.getElementById('ga-imp-zone');let n=0,num=gaNextNumero();const errs=[];const usedNum=new Set(GA.mandats.map(m=>+m.numero));
  const nextMonth=gaAddM(gaYm(new Date())+'-01',1).slice(0,7);
  for(const o of sel){
    z.innerHTML=`<div style="display:flex;gap:.6rem;align-items:center"><div class="sp"></div> Import ${n+1} / ${sel.length}…</div>`;
    let numero=o.numero&&!usedNum.has(o.numero)?o.numero:null;if(!numero){while(usedNum.has(num))num++;numero=num;}usedNum.add(numero);
    const row={agency_id:U.id,numero,statut:'actif',date_signature:o.date_signature||gaToday(),duree_mois:12,tacite:true,
      owner_name:o.owner_name,owner_email:o.owner_email,owner_phone:o.owner_phone,owner_address:o.owner_address,owner_iban:o.owner_iban,
      bien_label:o.bien_label,bien_adresse:o.bien_adresse,bien_surface:o.bien_surface,bien_meuble:o.bien_meuble,annee_construction:o.annee_construction,
      taux_honoraires:o.taux_honoraires??7,base_honoraires:'cc',frais_fixes:0,seuil_travaux:300,reversement_jour:10,gli:o.loc_garantie==='GLI',gli_taux:2.5,gli_delai_jours:30,depot_detenu_par:'agence',
      auto_avis:true,auto_relances:true,auto_quittance:false,auto_crg:true,auto_conformite:true,
      loc_nom:o.loc_nom,loc_email:o.loc_email,loc_phone:o.loc_phone,loc_loyer_hc:o.loc_loyer_hc,loc_charges:o.loc_charges,loc_depot:o.loc_depot,
      loc_debut:o.loc_debut||(o.loc_nom?gaToday():null),loc_jour:o.loc_jour,loc_garant_nom:o.loc_garant_nom,loc_garantie:o.loc_garantie,
      notes:'Importé depuis l’ancien logiciel le '+gaFrC(gaToday())};
    // L'agence reprend la gestion : pas de loyer appelé avant le mois prochain (le mois en cours a été géré par l'ancien logiciel)
    row.created_at=new Date().toISOString();
    if(o._forfait)row.charges_mode='forfait';
    if(o.type_bail){row.type_bail=o.type_bail;row.indice=GA_BAUX[o.type_bail].ind;}
    const{data,error}=await sb.from('gestion_mandats').insert(row).select().single();
    if(error){console.error('Import',o,error);errs.push({bien:o.bien_label||o.bien_adresse,msg:error.message,code:error.code});continue;}
    GA.mandats.push(data);n++;
    const fin={...(data.fin_bail||{}),reprise:nextMonth};
    // Révision du loyer : date de référence + dernière révision faite (pour ne pas proposer une révision déjà appliquée)
    if(o.loc_nom&&(o._irl_next||o._irl_last)){
      fin.irl_date=o._irl_next||o._irl_last;
      const last=o._irl_last||(o._irl_next>gaToday()?gaAddM(o._irl_next,-12):null);
      if(last)fin.irl_last={date:last,import:true};
    }
    if(o.loc_nom&&o._irl_tri)fin.irl_trimestre=o._irl_tri;
    // Reprise des charges : dernière régularisation et provisions déjà appelées par l'ancien logiciel
    if(o.loc_nom&&(o._der_regul!=null||o._ch_avant!=null)){const cr={derniere_regul:o._der_regul,provisions:{}};if(o._ch_avant!=null)cr.provisions[new Date().getFullYear()]=o._ch_avant;if(o._der_regul!=null&&o._ch_avant!=null)cr.ok=true;fin.charges_reprise=cr;}
    await sb.from('gestion_mandats').update({fin_bail:fin}).eq('id',data.id);data.fin_bail=fin;
    if(o._arriere>0){const{data:p}=await sb.from('payments').insert({landlord_id:U.id,mandat_id:data.id,tenant_name:o.loc_nom,tenant_email:o.loc_email,amount:gaR(o._arriere),type:'loyer',status:'late',due_date:gaAddDays(gaYm(new Date())+'-01',-1)}).select().single();if(p)GA.pays.push(p);}
    if(o._assur){const{data:e}=await sb.from('gestion_echeances').upsert({agency_id:U.id,mandat_id:data.id,type:'assurance_habitation',date_expiration:o._assur,date_document:gaAddM(o._assur,-12)},{onConflict:'mandat_id,type'}).select().single();if(e)GA.ech.push(e);}
    if(o._dpe){const{data:e}=await sb.from('gestion_echeances').upsert({agency_id:U.id,mandat_id:data.id,type:'dpe',resultat:o._dpe},{onConflict:'mandat_id,type'}).select().single();if(e)GA.ech.push(e);}
  }
  await gaEnsureSchedule();
  if(errs.length){
    const rls=errs.some(e=>/row-level security|permission denied|42501/i.test(e.msg+' '+e.code));
    const col=errs.find(e=>/column|schema cache/i.test(e.msg));
    z.innerHTML=`<div style="background:rgba(224,90,90,.1);border:1px solid rgba(224,90,90,.4);border-radius:10px;padding:.9rem;font-size:.8rem;line-height:1.55">
      <div style="font-weight:700;color:var(--red);margin-bottom:.3rem">${n} bien${n>1?'s':''} importé${n>1?'s':''} · ${errs.length} refusé${errs.length>1?'s':''} par la base</div>
      ${rls?'La base refuse l’écriture (sécurité RLS active sur la table des mandats). Exécutez <strong>supabase-migration-gestion-agence.sql</strong> dans Supabase → SQL Editor, puis réessayez.'
        :col?'Une colonne manque dans la base. Exécutez <strong>supabase-migration-gestion-agence.sql</strong> dans Supabase → SQL Editor, puis réessayez.':''}
      <div style="margin-top:.5rem;font-family:monospace;font-size:.72rem;color:var(--td)">${errs.slice(0,3).map(e=>gaE(e.bien+' : '+e.msg)).join('<br>')}</div></div>`;
    gaRender();return;
  }
  gaCloseModal();toast(`<i data-lucide=check-circle-2 class=ic></i> ${n} bien${n>1?'s':''} importé${n>1?'s':''}`);gaGo({t:'home'});
  // Étape suivante : reprendre l'historique des charges (sinon les régularisations seraient fausses)
  if(gaRepriseAFaire().length)setTimeout(gaRepriseCharges,400);
}

// ════════════════════ Espace du gestionnaire : Agenda ════════════════════
function gaHello(){const h=new Date().getHours();return h<12?'Bonjour':h<18?'Bon après-midi':'Bonsoir';}
function gaMe(){try{const m=getCurrentTeamMember();return m&&m!=='__AGENCY_ADMIN__'?m:'';}catch(e){return'';}}
// Agenda : tout ce qui arrive sur l'ensemble des biens, par période
function gaRenderAgenda(){
  const today=gaToday();const f=GA.agendaFiltre||'tout';
  const all=[];for(const m of gaActifs()){gaTimeline(m).F.filter(e=>e.date>today).forEach(e=>all.push({...e,m}));}
  const cat=e=>/loyer|avis/i.test(e.t)?'loyers':/assurance|chaudi|dpe|diagnostic|pno|justificatif|attestation/i.test(e.t)?'docs':/bail|congé|irl|départ|dépôt|échéance/i.test(e.t)?'bail':'autre';
  const list=all.filter(e=>f==='tout'||(f==='auto'?e.auto:cat(e)===f)).sort((a,b)=>a.date.localeCompare(b.date));
  const grp=d=>{const n=gaDays(today,d);if(n<=1)return'Demain';if(n<=7)return'Cette semaine';if(n<=14)return'Semaine prochaine';const s=gaMoisLbl(d.slice(0,7));return s.charAt(0).toUpperCase()+s.slice(1);};
  const G=[];list.forEach(e=>{const g=grp(e.date);let x=G.find(y=>y.g===g);if(!x)G.push(x={g,items:[]});x.items.push(e);});
  const col={r:'var(--red)',o:'var(--gold)',g:'var(--green)',a:'var(--agencybright)',n:'var(--td)'};
  const chip=(k,l)=>`<button class="btn ${f===k?'bp':'bg'} bsm" onclick="GA.agendaFiltre='${k}';gaRender()">${l}</button>`;
  return`<div style="font-size:1.2rem;font-weight:700;margin-bottom:.25rem">Agenda</div><div style="font-size:.8rem;color:var(--td);margin-bottom:.9rem">Tout ce qui arrive sur vos biens, dans l’ordre. Les éléments <span class="badge b-agence" style="font-size:.58rem">AUTO</span> partent sans que vous ayez rien à faire.</div>
  <div style="display:flex;gap:.35rem;flex-wrap:wrap;margin-bottom:1rem">${chip('tout','Tout')}${chip('loyers','Loyers')}${chip('bail','Bail & loyer')}${chip('docs','Documents')}${chip('auto','Automatique')}</div>
  ${G.length?G.map(x=>`<div style="font-size:.74rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--td);margin:1rem 0 .4rem">${x.g}</div>
    <div class="card"><div class="cb" style="padding:.3rem 1rem">${x.items.slice(0,60).map(e=>`<div style="display:flex;gap:.7rem;align-items:center;padding:.6rem 0;border-bottom:1px solid var(--b)">
      <div style="width:44px;text-align:center;flex-shrink:0"><div style="font-size:1rem;font-weight:700;line-height:1">${new Date(e.date+'T12:00:00').getDate()}</div><div style="font-size:.6rem;color:var(--td);text-transform:uppercase">${new Date(e.date+'T12:00:00').toLocaleDateString('fr-FR',{month:'short'})}</div></div>
      <div style="width:8px;height:8px;border-radius:50%;background:${col[e.tone]};flex-shrink:0"></div>
      <div style="flex:1;min-width:0"><div style="font-size:.84rem;font-weight:600">${gaE(e.t)}${e.auto?' <span class="badge b-agence" style="font-size:.56rem">AUTO</span>':''}</div><div style="font-size:.72rem;color:var(--td)"><a href="#" onclick="gaGo({t:'bien',id:'${e.m.id}'});return false" style="color:var(--agencybright);text-decoration:none">${gaE(gaBien(e.m))}</a>${e.d?' · '+gaE(e.d):''}</div></div>
      ${e.act?`<button class="btn bg bsm" onclick="${e.act}">${gaE(e.actl||'Ouvrir')}</button>`:''}</div>`).join('')}</div></div>`).join(''):gaEmpty('calendar','Rien à venir.')}`;
}

// ════════════════════ Messagerie locataire ↔ gestionnaire ════════════════════
// Messages de type 'gestion' entre le compte agence et le locataire (compte Trouve Ton Toit).
// Locataire déjà en place sans compte : invitation par e-mail, le lien se fait tout seul
// dès qu'il crée son compte avec la même adresse.
const gaTenantId=m=>{const t=gaTen(m);return t?.tenant_id||m.loc_clerk_id||null;};
async function gaLoadMsgs(){
  try{
    const[a,b]=await Promise.all([
      sb.from('messages').select('*').eq('type','gestion').eq('receiver_id',U.id).order('created_at',{ascending:true}).limit(1000),
      sb.from('messages').select('*').eq('type','gestion').eq('sender_id',U.id).order('created_at',{ascending:true}).limit(1000)]);
    const seen=new Set();GA.msgs=[...(a.data||[]),...(b.data||[])].filter(x=>!seen.has(x.id)&&seen.add(x.id)).sort((x,y)=>String(x.created_at).localeCompare(String(y.created_at)));
  }catch(e){GA.msgs=[];}
}
// Relier automatiquement les locataires déjà en place qui ont un compte (même e-mail)
async function gaLinkTenants(){
  const todo=GA.mandats.filter(m=>!m.lease_id&&m.loc_email&&!m.loc_clerk_id);
  for(const m of todo){
    try{const{data:p}=await sb.from('profiles').select('clerk_id').ilike('email',m.loc_email).limit(1).maybeSingle();
      if(p?.clerk_id){const{data}=await sb.from('gestion_mandats').update({loc_clerk_id:p.clerk_id}).eq('id',m.id).select().single();if(data)Object.assign(m,data);}}catch(e){}
  }
}
const gaThread=m=>{const tid=gaTenantId(m);if(!tid)return[];return(GA.msgs||[]).filter(x=>(x.sender_id===tid&&x.receiver_id===U.id)||(x.sender_id===U.id&&x.receiver_id===tid));};
const gaUnreadMsgs=m=>{const tid=gaTenantId(m);return tid?(GA.msgs||[]).filter(x=>x.sender_id===tid&&x.receiver_id===U.id&&!x.read):[];};
let GA_MSG_POLL=null;
function gaFMessages(m,t){
  const tid=gaTenantId(m);
  if(!t)return gaEmpty('message-circle','Pas de locataire sur ce bien.');
  if(!tid)return`<div class="card"><div class="cb" style="text-align:center;padding:1.6rem">
    <i data-lucide=user-plus class=ic style="width:26px;height:26px;color:var(--agencybright)"></i>
    <div style="font-weight:700;margin-top:.4rem">${gaE(t.nom)} n’a pas encore de compte Trouve Ton Toit</div>
    <div style="font-size:.8rem;color:var(--td);max-width:440px;margin:.3rem auto .9rem;line-height:1.55">Invitez-le : il pourra vous écrire, envoyer ses attestations, signaler un problème et retrouver ses quittances. Dès qu’il crée son compte avec ${t.email?`<strong>${gaE(t.email)}</strong>`:'son adresse e-mail'}, la conversation s’ouvre ici automatiquement.</div>
    ${t.email?`<button class="btn bp" onclick="gaInviteTenant('${m.id}')"><i data-lucide=send class=ic></i> Inviter ${gaE(t.nom.split(' ')[0])} par e-mail</button>`:`<button class="btn bg" onclick="gaEditMandat('${m.id}')">Ajouter son e-mail</button>`}
    ${m.fin_bail?.invite_at?`<div style="font-size:.72rem;color:var(--td);margin-top:.5rem">Invitation envoyée le ${gaFrC(m.fin_bail.invite_at)}</div>`:''}
  </div></div>`;
  const th=gaThread(m);const me=gaMe();
  setTimeout(()=>{gaMarkRead(m);const box=document.getElementById('ga-chat');if(box)box.scrollTop=box.scrollHeight;
    clearInterval(GA_MSG_POLL);GA_MSG_POLL=setInterval(async()=>{if(GA.view?.t!=='bien'||GA.view?.s!=='msg'||!document.getElementById('ga-chat')){clearInterval(GA_MSG_POLL);return;}
      const n=(GA.msgs||[]).length;await gaLoadMsgs();if((GA.msgs||[]).length!==n){const keep=document.getElementById('ga-msg-in')?.value||'';gaRender();const i=document.getElementById('ga-msg-in');if(i){i.value=keep;}}},12000);},50);
  const QR=['Bien reçu, je m’en occupe.','Un artisan va vous contacter pour fixer un rendez-vous.','Pouvez-vous m’envoyer une photo du problème ?','Votre quittance est disponible, je vous l’envoie.','Merci, c’est noté !'];
  let lastDay='';
  return`<div class="card" style="display:flex;flex-direction:column;height:min(68vh,640px)">
    <div style="padding:.75rem 1rem;border-bottom:1px solid var(--b);display:flex;justify-content:space-between;align-items:center;gap:.5rem">
      <div><div style="font-weight:700;font-size:.9rem">${gaE(t.nom)}</div><div style="font-size:.7rem;color:var(--td)">Locataire · ${gaE(gaBien(m))}</div></div>
      <div style="font-size:.7rem;color:var(--td)">Vous répondez au nom de ${gaE(gaAgence().nom)}${me?' ('+gaE(me)+')':''}</div></div>
    <div id="ga-chat" style="flex:1;overflow-y:auto;padding:1rem;display:flex;flex-direction:column;gap:.45rem">
      ${th.length?th.map(x=>{const mine=x.sender_id===U.id;const d=gaIso(x.created_at);const sep=d!==lastDay?`<div style="text-align:center;font-size:.66rem;color:var(--td);margin:.5rem 0">${gaFr(d)}</div>`:'';lastDay=d;
        return sep+`<div style="align-self:${mine?'flex-end':'flex-start'};max-width:78%"><div style="padding:.55rem .8rem;border-radius:${mine?'14px 14px 4px 14px':'14px 14px 14px 4px'};background:${mine?'var(--agence)':'var(--s2)'};color:${mine?'#fff':'var(--txt)'};font-size:.84rem;line-height:1.45;white-space:pre-wrap;word-break:break-word">${gaE(x.content)}</div>
        <div style="font-size:.62rem;color:var(--td);margin-top:.15rem;text-align:${mine?'right':'left'}">${new Date(x.created_at).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})}${mine&&x.read?' · lu':''}</div></div>`;}).join('')
        :`<div style="margin:auto;text-align:center;color:var(--td);font-size:.8rem"><i data-lucide=messages-square class=ic style="width:24px;height:24px"></i><div style="margin-top:.4rem">Aucun message pour l’instant.<br>Écrivez à ${gaE(t.nom.split(' ')[0])} : il le recevra dans son espace et par notification.</div></div>`}
    </div>
    <div style="padding:.6rem .8rem;border-top:1px solid var(--b)">
      <div style="display:flex;gap:.3rem;overflow-x:auto;padding-bottom:.45rem">${QR.map(q=>`<button class="btn bg bsm" style="white-space:nowrap;font-size:.7rem" onclick="document.getElementById('ga-msg-in').value=this.textContent;document.getElementById('ga-msg-in').focus()">${gaE(q)}</button>`).join('')}</div>
      <div style="display:flex;gap:.4rem;align-items:flex-end"><textarea id="ga-msg-in" class="fi" rows="2" placeholder="Écrire à ${gaE(t.nom.split(' ')[0])}…" style="flex:1;resize:none" onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();gaSendMsg('${m.id}')}"></textarea>
      <button class="btn bp" onclick="gaSendMsg('${m.id}')"><i data-lucide=send class=ic></i></button></div>
    </div></div>`;
}
async function gaSendMsg(mid){
  const m=gaMandat(mid);const tid=gaTenantId(m);const el=document.getElementById('ga-msg-in');const txt=(el?.value||'').trim();
  if(!txt||!tid)return;el.value='';
  const row={sender_id:U.id,receiver_id:tid,listing_id:m.listing_id||gaTen(m)?.lease?.listing_id||null,content:txt,type:'gestion',read:false};
  const{data,error}=await sb.from('messages').insert(row).select().single();
  if(error){toast('Envoi impossible : '+error.message);el.value=txt;return;}
  // Prévenir le locataire par e-mail (au plus une fois par heure, pour ne pas inonder sa boîte)
  const prev=gaThread(m).filter(x=>x.sender_id===U.id).pop();const t=gaTen(m);
  if(t?.email&&(!prev||Date.now()-new Date(prev.created_at).getTime()>3600e3))
    gaMail(t.email,`Nouveau message de ${gaAgence().nom}`,'Votre gestionnaire vous a écrit',
      `<p>Bonjour ${gaE(t.nom)},</p><p>Vous avez un nouveau message au sujet de votre logement <strong>${gaE(gaAdresse(m))}</strong> :</p><blockquote style="border-left:3px solid #ccc;margin:0;padding:.3rem .8rem;color:#444">${gaE(txt.slice(0,400))}</blockquote>`,
      {url:location.origin+'/tenant-dashboard.html#gestionnaire',label:'Répondre'});
  (GA.msgs=GA.msgs||[]).push(data);gaRender();
}
async function gaMarkRead(m){
  const un=gaUnreadMsgs(m);if(!un.length)return;
  const ids=un.map(x=>x.id);await sb.from('messages').update({read:true}).in('id',ids);
  un.forEach(x=>x.read=true);
  const n=gaTasks().filter(x=>x.p<=2).length;const sbNb=document.getElementById('nb-gestion');if(sbNb){sbNb.textContent=n;sbNb.style.display=n?'inline':'none';}
}
async function gaInviteTenant(mid){
  const m=gaMandat(mid);const t=gaTen(m);if(!t?.email)return;
  const site=location.origin;
  const ok=await gaMail(t.email,`${gaAgence().nom} vous invite sur Trouve Ton Toit`,'Votre espace locataire',
    `<p>Bonjour ${gaE(t.nom)},</p><p><strong>${gaE(gaAgence().nom)}</strong> gère votre logement <strong>${gaE(gaAdresse(m))}</strong> sur Trouve Ton Toit.</p>
     <p>Créez votre espace locataire gratuit avec cette adresse e-mail (<strong>${gaE(t.email)}</strong>) pour :</p>
     <ul><li>écrire directement à votre gestionnaire</li><li>retrouver vos quittances et avis d’échéance</li><li>envoyer votre attestation d’assurance</li><li>signaler un problème dans le logement</li></ul>`,
    {url:site+'/?signup=locataire',label:'Créer mon espace locataire'});
  const f={...(m.fin_bail||{}),invite_at:new Date().toISOString()};
  const{data}=await sb.from('gestion_mandats').update({fin_bail:f}).eq('id',mid).select().single();if(data)Object.assign(m,data);
  toast(ok?'Invitation envoyée':'E-mail non envoyé (service e-mail non configuré)');gaRender();
}
// Fils de discussion des locataires, pour la page Messages de l'agence
function gaMsgThreadsHtml(){
  const rows=gaActifs().map(m=>({m,t:gaTen(m),th:gaThread(m),un:gaUnreadMsgs(m)})).filter(x=>x.th.length).sort((a,b)=>String(b.th[b.th.length-1].created_at).localeCompare(String(a.th[a.th.length-1].created_at)));
  if(!rows.length)return'';
  return`<div class="card" style="margin-bottom:1rem"><div class="ch"><div class="ct"><i data-lucide=briefcase class=ic></i> Locataires en gestion</div></div><div class="cb" style="padding:.3rem 1rem">
    ${rows.map(x=>{const l=x.th[x.th.length-1];return`<div onclick="spG('home');setTimeout(()=>gaGo({t:'bien',id:'${x.m.id}',s:'msg'}),200)" style="display:flex;gap:.7rem;align-items:center;padding:.6rem 0;border-bottom:1px solid var(--b);cursor:pointer">
      <div style="width:34px;height:34px;border-radius:50%;background:var(--agencydim);color:var(--agencybright);display:flex;align-items:center;justify-content:center;font-weight:700;flex-shrink:0">${gaE((x.t?.nom||'?')[0])}</div>
      <div style="flex:1;min-width:0"><div style="font-size:.84rem;font-weight:${x.un.length?700:600}">${gaE(x.t?.nom||'Locataire')} <span style="font-weight:400;color:var(--td);font-size:.72rem">· ${gaE(gaBien(x.m))}</span></div>
      <div style="font-size:.74rem;color:var(--td);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${l.sender_id===U.id?'Vous : ':''}${gaE(l.content)}</div></div>
      ${x.un.length?`<span class="nbadge" style="margin-left:0">${x.un.length}</span>`:`<span style="font-size:.66rem;color:var(--td)">${gaFrC(l.created_at)}</span>`}</div>`;}).join('')}
  </div></div>`;
}

// ════════════════════ Banque : rapprochement automatique du compte mandant ════════════════════
// Le relevé (CSV, OFX ou Excel) est importé ligne par ligne dans gestion_banque (doublons ignorés),
// puis chaque ligne est associée toute seule : loyers (même partiels ou plusieurs mois d'un coup),
// versements CAF, reversements aux propriétaires, factures de travaux, dépôts restitués.
// L'outil apprend : une ligne associée à la main est reconnue automatiquement les fois suivantes.
const GA_BK_STOP=new Set('VIR VIREMENT VIRT SEPA RECU RECUE RECEIVED INST INSTANTANE EMIS EMIS FAVEUR POUR PAR LOYER LOYERS REF REFERENCE MOTIF DATE NOTPROVIDED MME MLLE MONSIEUR MADAME FROM CREDIT DEBIT JANVIER FEVRIER MARS AVRIL MAI JUIN JUILLET AOUT SEPTEMBRE OCTOBRE NOVEMBRE DECEMBRE JAN FEV AVR JUIL SEPT OCT NOV DEC PRLV PRELEVEMENT REMISE CHEQUE CHQ'.split(' '));
const gaBkNorm=s=>String(s||'').toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g,'');
const gaBkToks=s=>[...new Set(gaBkNorm(s).split(/[^A-Z]+/).filter(x=>x.length>2&&!GA_BK_STOP.has(x)))];
const gaBkCle=s=>gaBkToks(s).sort().join(' ');
const gaNameToks=n=>gaBkNorm(n).split(/[^A-Z]+/).filter(x=>x.length>2&&!GA_BK_STOP.has(x));
const gaBkLignes=()=>(GA.bank||[]).filter(b=>b.statut!=='solde');
const gaBkSolde=()=>(GA.bank||[]).filter(b=>b.statut==='solde').sort((a,b)=>String(b.date).localeCompare(String(a.date)))[0]||null;
const gaBkAuto=()=>{try{return localStorage.getItem('ga_bk_auto_'+U.id)!=='0';}catch(e){return true;}};
function gaBkSetAuto(on){try{localStorage.setItem('ga_bk_auto_'+U.id,on?'1':'0');}catch(e){}if(on)gaBkAutoRun(true);}

// ── Lecture du relevé ───────────────────────────────────────────────
async function gaBkFile(file){
  if(!file)return;
  const ext=file.name.split('.').pop().toLowerCase();
  try{
    let lignes=[];
    if(['xlsx','xls','ods'].includes(ext)){
      const buf=await file.arrayBuffer();
      await new Promise(r=>gaImpLoadXlsx(r));
      const wb=XLSX.read(buf,{type:'array',cellDates:true});
      // Vraies dates Excel → AAAA-MM-JJ (évite les dates à l'américaine), nombres gardés tels quels
      const iso=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      const rows=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{header:1,raw:true,defval:''});
      lignes=gaBkFromRows(rows.map(r=>r.map(c=>c instanceof Date?iso(new Date(c.getTime()+12*3600e3)):typeof c==='number'?String(c):String(c??'').replace(/\s*\n\s*/g,' '))));
    }else{
      const buf=await file.arrayBuffer();
      let txt=new TextDecoder('utf-8').decode(buf);
      if(txt.includes('�'))txt=new TextDecoder('windows-1252').decode(buf); // relevés des banques françaises
      lignes=/<STMTTRN>/i.test(txt)?gaBkFromOfx(txt):gaBkFromRows(gaCsvParse(txt));
    }
    if(!lignes.length){toast('Aucune opération trouvée dans ce fichier. Exportez le relevé en CSV, OFX ou Excel depuis votre banque.');return;}
    await gaBkImport(lignes,file.name);
  }catch(e){console.error(e);toast('Lecture du relevé impossible : '+gaE(e.message));}
}
function gaBkFromOfx(txt){
  const out=[];const tag=(b,t)=>{const m=b.match(new RegExp('<'+t+'>([^<\\r\\n]*)','i'));return m?m[1].trim():'';};
  for(const b of txt.split(/<STMTTRN>/i).slice(1)){
    const d=tag(b,'DTPOSTED');const amt=gaNum(tag(b,'TRNAMT').replace(',', '.'));
    if(!d||amt==null)continue;
    out.push({date:`${d.slice(0,4)}-${d.slice(4,6)}-${d.slice(6,8)}`,montant:amt,libelle:[tag(b,'NAME'),tag(b,'MEMO')].filter(Boolean).join(' '),fitid:tag(b,'FITID')});
  }
  const bal=txt.match(/<LEDGERBAL>[\s\S]*?<BALAMT>([^<\r\n]+)[\s\S]*?<DTASOF>(\d{8})/i);
  if(bal)out.solde={montant:gaNum(bal[1].replace(',','.')),date:`${bal[2].slice(0,4)}-${bal[2].slice(4,6)}-${bal[2].slice(6,8)}`};
  return out;
}
function gaBkFromRows(rows){
  let hi=rows.findIndex(r=>r.some(c=>/date/i.test(c))&&r.some(c=>/libell|label|d[ée]signation|op[ée]ration|description|motif|d[ée]tail/i.test(c)));
  if(hi<0)return[];
  const h=rows[hi].map(c=>gaBkNorm(c));const ci=re=>h.findIndex(c=>re.test(c));
  const cD=[ci(/^DATE (D.?)?OPERATION|^DATE COMPTABLE|^DATE$/),ci(/^DATE(?! (DE )?VALEUR)/),ci(/DATE/)].find(x=>x>=0)??-1,cL=[ci(/LIBELL|LABEL/),ci(/DESIGNATION|DESCRIPTION|MOTIF|DETAIL/),ci(/^(NATURE (DE L.)?)?OPERATION$/)].find(x=>x>=0)??-1,
        cCr=ci(/CREDIT/),cDb=ci(/DEBIT/),cM=ci(/MONTANT|AMOUNT|SOMME/),cS=ci(/SOLDE|BALANCE/);
  const cL2=h.findIndex((c,i)=>i!==cL&&/LIBELL|COMPLEMENT|INFORMATION|REFERENCE/.test(c));
  const out=[];let solde=null;
  for(const r of rows.slice(hi+1)){
    const date=gaDateFr(r[cD]);if(!date)continue;
    let amt=null;
    if(cCr>=0||cDb>=0){const c=gaNum(r[cCr]),d=gaNum(r[cDb]);if(c)amt=Math.abs(c);else if(d)amt=-Math.abs(d);}
    if(amt==null&&cM>=0)amt=gaNum(r[cM]);
    if(!amt)continue;
    out.push({date,montant:gaR(amt),libelle:[r[cL],cL2>=0?r[cL2]:''].filter(Boolean).join(' ').replace(/\s+/g,' ').trim()||r.join(' ')});
    if(cS>=0&&gaNum(r[cS])!=null&&(!solde||date>=solde.date))solde={date,montant:gaNum(r[cS])};
  }
  // Solde annoncé en en-tête (« Solde au 22/10/2026 : 13 400,35 € », format Crédit Agricole et autres)
  if(!solde)for(const r of rows.slice(0,hi)){const t=r.join(' ');const m=t.match(/solde[^0-9]*?(\d{1,2}\/\d{1,2}\/\d{2,4})\D*?(-?[\d\s\u00a0.]+,\d{2}|-?\d+\.\d{2})/i);
    if(m&&gaNum(m[2])!=null){solde={date:gaDateFr(m[1]),montant:gaNum(m[2])};break;}}
  if(solde)out.solde=solde;
  return out;
}
async function gaBkImport(lignes,nom){
  const deja=new Set((GA.bank||[]).map(b=>b.cle));const vus={};const rows=[];
  for(const l of lignes){
    const base=l.fitid?'ofx-'+l.fitid:`${l.date}|${gaR(l.montant).toFixed(2)}|${gaBkNorm(l.libelle).replace(/\s+/g,' ').slice(0,80)}`;
    vus[base]=(vus[base]||0)+1;const cle=vus[base]>1?base+'#'+vus[base]:base; // deux opérations identiques le même jour
    if(deja.has(cle))continue;
    rows.push({agency_id:U.id,date:l.date,libelle:l.libelle,montant:gaR(l.montant),cle,statut:'a_traiter',releve:nom||null});
  }
  let ok=0;
  for(let i=0;i<rows.length;i+=200){
    const{data,error}=await sb.from('gestion_banque').insert(rows.slice(i,i+200)).select();
    if(error){toast(/relation|does not exist|schema cache/i.test(error.message)?'Exécutez d’abord supabase-migration-gestion-agence.sql dans Supabase (table gestion_banque).':'Import impossible : '+gaE(error.message));return;}
    (GA.bank=GA.bank||[]).push(...(data||[]));ok+=(data||[]).length;
  }
  if(lignes.solde&&lignes.solde.montant!=null)await gaBkSaveSolde(lignes.solde.montant,lignes.solde.date,true);
  const n=gaBkAuto()?await gaBkAutoRun(true):0;
  setTimeout(()=>gaBkIA(true),300); // Claude regarde ce que les règles n'ont pas reconnu
  toast(`<i data-lucide=check-circle-2 class=ic></i> ${ok} opération${ok>1?'s':''} importée${ok>1?'s':''}${lignes.length-ok?` · ${lignes.length-ok} déjà connue${lignes.length-ok>1?'s':''}`:''}${n?` · ${n} rapprochée${n>1?'s':''} automatiquement`:''}`);
  GA.view={t:'banque'};gaRender();
}

// ── Moteur de correspondance ────────────────────────────────────────
function gaBkAppris(l){
  // Lignes déjà rapprochées dont le libellé ressemble : même payeur → même bien
  const k=gaBkToks(l.libelle);if(!k.length)return null;
  let best=null,bs=0;
  for(const b of gaBkLignes()){if(b.statut!=='rapproche'||!b.mandat_id||b.id===l.id||Math.sign(b.montant)!==Math.sign(l.montant))continue;
    const kb=gaBkToks(b.libelle);const inter=k.filter(x=>kb.includes(x)).length;const j=inter/new Set([...k,...kb]).size;
    if(j>bs){bs=j;best=b;}}
  return bs>=0.6?best.mandat_id:null;
}
function gaBkDejaLiees(){const P=new Set(),O=new Set();for(const b of gaBkLignes()){if(b.statut!=='rapproche')continue;(b.detail?.payments||[b.payment_id]).filter(Boolean).forEach(x=>P.add(x));if(b.operation_id)O.add(b.operation_id);}return{P,O};}
function gaBkPropose(l,used){
  const lib=gaBkNorm(l.libelle);const amt=Math.abs(+l.montant);const appris=gaBkAppris(l);
  const caf=/\bCAF\b|C\.A\.F|ALLOCATIONS? FAMILIALES|\bMSA\b|\bAPL\b/.test(lib);
  let best=null;
  const consider=o=>{if(!best||o.score>best.score)best=o;};
  if(l.montant>0){
    for(const m of GA.mandats){
      const U2=gaPays(m).filter(p=>gaUnpaid(p)&&!used.has(p.id)).sort((a,b)=>a.due_date.localeCompare(b.due_date));if(!U2.length)continue;
      const t=gaTen(m);let nom=0;
      gaNameToks(t?.nom||U2[0].tenant_name||'').forEach(x=>{if(lib.includes(x))nom+=3;});nom=Math.min(nom,6);
      gaNameToks(t?.garant_nom||'').forEach(x=>{if(lib.includes(x))nom=Math.max(nom,2);});
      const ap=appris===m.id?6:0;
      const dScore=d=>{const dd=Math.abs(gaDays(d,l.date));return dd<=10?2:dd<=40?1:-2;};
      // Une échéance pile
      for(const p of U2){const r=gaReste(p);
        const a=Math.abs(amt-r)<0.01?5:Math.abs(amt-(+p.amount||0))<0.01?4:0;
        if(a)consider({k:'loyer',m,pays:[p],score:a+nom+ap+dScore(p.due_date),why:a===5?'montant exact':'montant de l’échéance'});}
      // Plusieurs mois d'un coup
      let cum=0;for(let i=0;i<U2.length;i++){cum+=gaReste(U2[i]);if(i>0&&Math.abs(cum-amt)<0.01){consider({k:'loyer',m,pays:U2.slice(0,i+1),score:4+nom+ap+dScore(U2[i].due_date),why:`${i+1} échéances réglées d’un coup`});break;}}
      // Paiement partiel (ou CAF / APL versée directement) : il faut reconnaître le payeur
      if((nom||ap)&&amt<gaReste(U2[0])-0.01)consider({k:'loyer',m,pays:[U2[0]],score:(caf?3:1)+nom+ap+dScore(U2[0].due_date),why:caf?'versement CAF (APL)':'paiement partiel'});
    }
  }else{
    const liees=gaBkDejaLiees().O;
    for(const o of GA.ops){if(liees.has(o.id)||used.has(o.id)||Math.abs(-(+o.montant)-amt)>=0.01)continue;
      const dd=Math.abs(gaDays(o.date,l.date));if(dd>25)continue;
      const m=gaMandat(o.mandat_id);let nom=0;gaNameToks(m?.owner_name||'').forEach(x=>{if(lib.includes(x))nom=3;});
      consider({k:'op',m,op:o,score:6+nom+(dd<=5?2:0),why:{reversement:'reversement au propriétaire',travaux:'facture de travaux',depot_restitue:'dépôt de garantie restitué'}[o.type]||(o.libelle||o.type)});}
    if(!best||best.score<5){
      // Virement vers un propriétaire non encore saisi : on propose de créer le reversement
      for(const ow of gaOwners()){let nom=0;gaNameToks(ow.name).forEach(x=>{if(lib.includes(x))nom+=3;});
        if(ow.iban&&lib.includes(gaBkNorm(ow.iban).replace(/\s/g,'').slice(-6)))nom+=4;
        if(nom>=3)consider({k:'newrev',m:ow.ms[0],owner:ow,score:4+Math.min(nom,6),why:`virement vers ${ow.name}`});}
    }
  }
  // Créer une écriture de reversement reste toujours une proposition à valider
  // Remise de prélèvements SEPA : un seul crédit pour tout le lot
  if(l.montant>0)for(const lot of(GA.sepaLots||[]).filter(x=>x.type==='prelevement'&&x.statut==='genere'&&!used.has('lot-'+x.id))){
    if(Math.abs(+lot.total-amt)<0.01&&Math.abs(gaDays(lot.date_execution,l.date))<=10)consider({k:'lot',lot,m:null,score:8+(/PRLV|PRELEV|SEPA|REMISE/.test(lib)?2:0),why:`remise de ${lot.nb} prélèvement${lot.nb>1?'s':''} SEPA du ${gaFrC(lot.date_execution)}`});
  }
  return best&&best.score>=5?{...best,sur:best.score>=8&&best.k!=='newrev'}:null;
}
// Propositions pour toutes les lignes à traiter (une échéance ne sert qu'une fois)
function gaBkPropositions(){
  const used=new Set([...gaBkDejaLiees().P]);const res=new Map();
  const todo=gaBkLignes().filter(b=>b.statut==='a_traiter').sort((a,b)=>String(a.date).localeCompare(String(b.date)));
  for(const l of todo){const p=gaBkPropose(l,used);if(p){res.set(l.id,p);(p.pays||[]).forEach(x=>used.add(x.id));if(p.op)used.add(p.op.id);if(p.lot)used.add('lot-'+p.lot.id);}}
  // Puis les propositions de Claude pour ce que les règles n'ont pas reconnu
  for(const l of todo){if(res.has(l.id))continue;const p=gaBkFromIA(l,used);if(p){res.set(l.id,p);(p.pays||[]).forEach(x=>used.add(x.id));if(p.op)used.add(p.op.id);}}
  return res;
}
async function gaBkAutoRun(silent){
  let n=0;
  for(const[id,p]of gaBkPropositions()){if(!p.sur)continue;if(await gaBkApply(id,p,true))n++;}
  if(!silent){toast(n?`${n} opération${n>1?'s':''} rapprochée${n>1?'s':''}`:'Rien de sûr à rapprocher automatiquement');gaRender();}
  return n;
}

// ── Enregistrement ──────────────────────────────────────────────────
async function gaBkPayer(pays,amt,date){
  let reste=amt;const faits=[];
  for(const p of pays){if(reste<=0.009)break;
    const part=Math.min(reste,gaReste(p));if(part<=0)continue;
    const tot=gaR((+p.amount_paid||0)+part);const full=tot>=(+p.amount||0)-0.01;
    const upd={amount_paid:tot,paid_at:new Date(date+'T12:00:00').toISOString(),payment_method:'Virement',status:full?'paid':(gaDays(p.due_date,gaToday())>0?'late':'pending')};
    const{error}=await sb.from('payments').update(upd).eq('id',p.id);if(error)throw new Error(error.message);
    Object.assign(p,upd);faits.push(p.id);reste=gaR(reste-part);
    const m=GA.mandats.find(x=>x.id===p.mandat_id)||gaPayCtx(p.id)?.m;
    if(full&&m?.auto_quittance){try{await gaQuittance(p.id,true,true);}catch(e){}}
  }
  return{faits,reste:gaR(reste)};
}
async function gaBkApply(id,p,silent,auto=silent){
  const l=gaBkLignes().find(b=>b.id===id);if(!l||!p)return false;
  try{
    const upd={statut:'rapproche',mandat_id:p.m?.id||null,auto:!!auto,detail:{why:p.why,...(p.ia?{ia:l.detail?.ia}:{})}};
    if(p.k==='loyer'){const r=await gaBkPayer(p.pays,Math.abs(+l.montant),l.date);upd.nature='loyer';upd.payment_id=r.faits[0]||null;upd.detail.payments=r.faits;if(r.reste>0)upd.detail.trop_percu=r.reste;}
    else if(p.k==='op'){upd.nature=p.op.type||'operation';upd.operation_id=p.op.id;}
    else if(p.k==='lot'){await gaSepaLotEncaisse(p.lot.id,l.date,true);upd.nature='loyer';upd.detail.lot=p.lot.id;}
    else if(p.k==='dep'){
      const{data,error}=await sb.from('gestion_operations').insert({agency_id:U.id,mandat_id:p.m.id,date:l.date,type:/TAXE FONCI|TEOM|ORDURES/i.test(l.libelle)?'teom':'frais',libelle:l.libelle,montant:-Math.abs(+l.montant)}).select().single();
      if(error)throw new Error(error.message);GA.ops.push(data);upd.nature=data.type;upd.operation_id=data.id;}
    else if(p.k==='ign'){upd.statut='ignore';upd.nature=p.nature;upd.mandat_id=null;}
    else if(p.k==='newrev'){
      const{data,error}=await sb.from('gestion_operations').insert({agency_id:U.id,mandat_id:p.m.id,date:l.date,type:'reversement',libelle:`Reversement au propriétaire${p.owner?.iban?' — '+p.owner.iban:''}`,montant:-Math.abs(+l.montant)}).select().single();
      if(error)throw new Error(error.message);GA.ops.push(data);upd.nature='reversement';upd.operation_id=data.id;}
    const{data,error}=await sb.from('gestion_banque').update(upd).eq('id',id).select().single();if(error)throw new Error(error.message);
    Object.assign(l,data||upd);
    if(!silent){toast(`<i data-lucide=check-circle-2 class=ic></i> Rapproché${upd.detail.trop_percu?` · trop-perçu de ${gaEur(upd.detail.trop_percu)} à rembourser ou imputer`:''}`);gaRender();}
    return true;
  }catch(e){toast('Rapprochement impossible : '+gaE(e.message));return false;}
}
async function gaBkValider(id){const p=gaBkPropositions().get(id);await gaBkApply(id,p);}
async function gaBkToutValider(){let n=0;for(const[id,p]of gaBkPropositions())if(await gaBkApply(id,p,true,false))n++;toast(`${n} opération${n>1?'s':''} rapprochée${n>1?'s':''}`);gaRender();}
async function gaBkManuel(id){
  const v=gaV('bk-sel-'+id);if(!v){toast('Choisissez à quoi correspond cette opération');return;}
  const[k,x]=[v.slice(0,1),v.slice(2)];const l=gaBkLignes().find(b=>b.id===id);
  if(k==='i'){const{data,error}=await sb.from('gestion_banque').update({statut:'ignore',nature:x}).eq('id',id).select().single();if(error){toast(error.message);return;}Object.assign(l,data);toast('Opération classée');return gaRender();}
  if(k==='p'){const ctx=gaPayCtx(x);if(!ctx?.p)return;const m=ctx.m;
    const suite=gaPays(m).filter(p=>gaUnpaid(p)&&p.id!==x).sort((a,b)=>a.due_date.localeCompare(b.due_date));
    return gaBkApply(id,{k:'loyer',m,pays:[ctx.p,...suite],why:'associé à la main'});}
  if(k==='o'){const op=GA.ops.find(o=>o.id===x);return gaBkApply(id,{k:'op',m:gaMandat(op?.mandat_id),op,why:'associé à la main'});}
  if(k==='r'){const ow=gaOwners().find(o=>o.key===x);return gaBkApply(id,{k:'newrev',m:ow.ms[0],owner:ow,why:'associé à la main'});}
  if(k==='d'){const m=gaMandat(x);const{data,error}=await sb.from('gestion_operations').insert({agency_id:U.id,mandat_id:x,date:l.date,type:/TAXE FONCI|TEOM|ORDURES/i.test(l.libelle)?'teom':'frais',libelle:l.libelle,montant:-Math.abs(+l.montant)}).select().single();
    if(error){toast(error.message);return;}GA.ops.push(data);return gaBkApply(id,{k:'op',m,op:data,why:'dépense pour le propriétaire'});}
}
async function gaBkDelier(id){
  const l=gaBkLignes().find(b=>b.id===id);if(!l)return;
  if(l.nature==='loyer'&&!confirm('Annuler ce rapprochement ? Les loyers concernés repasseront en attente du montant de cette opération.'))return;
  if(l.nature==='loyer'){let reste=Math.abs(+l.montant)-(+l.detail?.trop_percu||0);
    for(const pid of[...(l.detail?.payments||[])].reverse()){const ctx=gaPayCtx(pid);const p=ctx?.p;if(!p||reste<=0)continue;
      const part=Math.min(reste,+p.amount_paid||0);const tot=gaR((+p.amount_paid||0)-part);
      const upd={amount_paid:tot,status:tot>=(+p.amount||0)-0.01?'paid':(gaDays(p.due_date,gaToday())>0?'late':'pending')};if(!tot)upd.paid_at=null;
      await sb.from('payments').update(upd).eq('id',pid);Object.assign(p,upd);reste-=part;}}
  const upd={statut:'a_traiter',nature:null,payment_id:null,operation_id:null,mandat_id:null,auto:false,detail:null};
  await sb.from('gestion_banque').update(upd).eq('id',id);Object.assign(l,upd);toast('Rapprochement annulé');gaRender();
}
function gaBkSoldeModal(){
  const s=gaBkSolde();
  gaModal(`<div style="font-size:1rem;font-weight:700;margin-bottom:.4rem">Solde du relevé bancaire</div>
  <div style="font-size:.78rem;color:var(--td);margin-bottom:.8rem;line-height:1.5">Indiquez le solde du compte mandant à une date donnée : il est comparé à ce que vous devez aux propriétaires et aux dépôts de garantie détenus. Un écart signale une opération oubliée.</div>
  <div class="fgrid2"><div class="fg"><label class="fl">Solde (€)</label><input class="fi" id="bk-solde" type="number" step="0.01" value="${s?s.montant:''}"></div>
  <div class="fg"><label class="fl">Au</label><input class="fi" id="bk-solde-dt" type="date" value="${s?.date||gaToday()}"></div></div>
  <div style="display:flex;justify-content:flex-end;gap:.5rem;margin-top:1rem"><button class="btn bg" onclick="gaCloseModal()">Annuler</button><button class="btn bp" onclick="gaBkSaveSolde(gaN('bk-solde'),gaV('bk-solde-dt'))">Enregistrer</button></div>`);
}
async function gaBkSaveSolde(v,d,silent){
  if(v==null||!d){toast('Indiquez le solde et la date');return;}
  const row={agency_id:U.id,date:d,montant:gaR(v),libelle:'Solde du relevé',cle:'solde-'+d,statut:'solde',nature:'solde'};
  const ex=(GA.bank||[]).find(b=>b.cle===row.cle);
  const q=ex?sb.from('gestion_banque').update(row).eq('id',ex.id).select().single():sb.from('gestion_banque').insert(row).select().single();
  const{data,error}=await q;if(error){toast(error.message);return;}
  if(ex)Object.assign(ex,data);else(GA.bank=GA.bank||[]).push(data);
  if(!silent){gaCloseModal();toast('Solde enregistré');gaRender();}
}
// Ce que le compte mandant devrait contenir : fonds dus aux propriétaires + dépôts de garantie détenus
function gaBkTheorique(){
  const dus=gaOwners().reduce((s,o)=>s+gaSolde(o.key),0);
  const dep=gaActifs().filter(m=>m.depot_detenu_par!=='proprietaire').reduce((s,m)=>s+(gaTen(m)?.depot||0),0);
  return{dus:gaR(dus),dep:gaR(dep),tot:gaR(dus+dep)};
}

// ── Écran ───────────────────────────────────────────────────────────
function gaRenderBanque(){
  const L=gaBkLignes();const props=gaBkPropositions();const cur=gaYm(new Date());
  const todo=L.filter(b=>b.statut==='a_traiter').sort((a,b)=>String(b.date).localeCompare(String(a.date)));
  const aVal=todo.filter(b=>props.has(b.id)),nonRec=todo.filter(b=>!props.has(b.id));
  const faits=L.filter(b=>b.statut!=='a_traiter').sort((a,b)=>String(b.date).localeCompare(String(a.date)));
  const duMois=L.filter(b=>String(b.date).slice(0,7)===cur);const rapMois=duMois.filter(b=>b.statut==='rapproche');
  const pctAuto=rapMois.length?Math.round(rapMois.filter(b=>b.auto).length/rapMois.length*100):0;
  const encMois=rapMois.filter(b=>b.nature==='loyer').reduce((s,b)=>s+(+b.montant),0);
  const sol=gaBkSolde();const th=gaBkTheorique();const ecart=sol?gaR(sol.montant-th.tot):null;
  const amt=v=>`<span style="font-weight:700;font-variant-numeric:tabular-nums;color:${v>0?'var(--green)':'var(--txt)'}">${v>0?'+':''}${gaEur(v)}</span>`;
  const ligne=(b,droite)=>`<div style="display:flex;gap:.8rem;align-items:center;padding:.65rem 0;border-top:1px solid var(--b);flex-wrap:wrap">
    <div style="width:74px;font-size:.72rem;color:var(--td);flex-shrink:0">${gaFrC(b.date)}</div>
    <div style="flex:1;min-width:190px"><div style="font-size:.8rem;font-family:ui-monospace,Menlo,monospace;word-break:break-word">${gaE(b.libelle||'—')}</div></div>
    <div style="width:110px;text-align:right;flex-shrink:0">${amt(+b.montant)}</div>
    <div style="flex:1.3;min-width:260px">${droite}</div></div>`;
  const options=b=>{
    const o=[];
    if(+b.montant>0){o.push('<optgroup label="Loyer en attente">');
      for(const m of GA.mandats)for(const p of gaPays(m).filter(gaUnpaid).sort((a,c)=>a.due_date.localeCompare(c.due_date)))
        o.push(`<option value="p:${p.id}">${gaE(gaTen(m)?.nom||p.tenant_name||'Locataire')} — ${gaE(gaBien(m))} — ${gaMoisLbl(String(p.due_date).slice(0,7))} (${gaEur(gaReste(p))})</option>`);
      o.push('</optgroup>');}
    else{const li=gaBkDejaLiees().O;o.push('<optgroup label="Opération déjà saisie">');
      GA.ops.filter(x=>+x.montant<0&&!li.has(x.id)).sort((a,c)=>String(c.date).localeCompare(String(a.date))).slice(0,40).forEach(x=>o.push(`<option value="o:${x.id}">${gaFrC(x.date)} — ${gaE(x.libelle||x.type)} (${gaEur(x.montant)})</option>`));
      o.push('</optgroup><optgroup label="Nouveau reversement">');gaOwners().forEach(w=>o.push(`<option value="r:${gaE(w.key)}">Reversement à ${gaE(w.name)}</option>`));
      o.push('</optgroup><optgroup label="Dépense payée pour un bien (charges, taxe, facture…)">');gaActifs().forEach(m=>o.push(`<option value="d:${m.id}">${gaE(gaBien(m))} — ${gaE(m.owner_name||'')}</option>`));o.push('</optgroup>');}
    o.push(`<optgroup label="Classer sans associer"><option value="i:frais_banque">Frais bancaires</option><option value="i:honoraires">Honoraires de l’agence (vers compte de fonctionnement)</option><option value="i:interne">Virement interne</option><option value="i:autre">Autre</option></optgroup>`);
    return o.join('');};
  const NAT={teom:'Taxe / TEOM',divers:'Divers',loyer:'Loyer',reversement:'Reversement',travaux:'Travaux',depot_restitue:'Dépôt restitué',frais_banque:'Frais bancaires',frais:'Dépense propriétaire',honoraires:'Honoraires agence',interne:'Virement interne',autre:'Autre'};
  return`<div style="display:flex;justify-content:space-between;align-items:flex-end;gap:1rem;flex-wrap:wrap;margin-bottom:1rem">
    <div><div style="font-size:1.25rem;font-weight:700">Banque</div><div style="font-size:.8rem;color:var(--td);margin-top:.15rem">Rapprochement du compte mandant avec les loyers, reversements et factures</div></div>
    <div style="display:flex;gap:.4rem;flex-wrap:wrap">
      <button class="btn bg bsm" onclick="gaBkSoldeModal()"><i data-lucide=scale class=ic></i> Solde du relevé</button>
      <label class="btn bp bsm" style="cursor:pointer"><i data-lucide=upload class=ic></i> Importer un relevé<input type="file" accept=".csv,.txt,.ofx,.qfx,.xlsx,.xls,.ods" style="display:none" onchange="gaBkFile(this.files[0]);this.value=''"></label>
    </div></div>
  ${!L.length?`<div class="card"><div class="cb" style="padding:1.6rem;text-align:center">
      <i data-lucide=landmark class=ic style="width:28px;height:28px;color:var(--agencybright)"></i>
      <div style="font-weight:700;margin:.5rem 0 .3rem">Importez le relevé de votre compte mandant</div>
      <div style="font-size:.8rem;color:var(--td);max-width:520px;margin:0 auto;line-height:1.6">Dans l’espace en ligne de votre banque : <em>Comptes → Télécharger les opérations</em>, au format <strong>CSV</strong>, <strong>OFX</strong> (Money / Quicken) ou <strong>Excel</strong>. Les loyers, versements CAF, reversements et factures sont reconnus tout seuls. Importez chaque semaine : les opérations déjà connues sont ignorées.</div>
    </div></div>`:`
  <div class="kgrid" style="margin-bottom:1rem">
    ${gaKpi('À traiter',todo.length,todo.length?`${aVal.length} proposée${aVal.length>1?'s':''} · ${nonRec.length} non reconnue${nonRec.length>1?'s':''}`:'Tout est rapproché',todo.length?'gold':'green')}
    ${gaKpi('Rapprochées ce mois',rapMois.length,rapMois.length?`${pctAuto} % automatiquement`:'—','blue')}
    ${gaKpi('Loyers reconnus ce mois',gaEur(encMois),`${rapMois.filter(b=>b.nature==='loyer').length} virement${rapMois.filter(b=>b.nature==='loyer').length>1?'s':''}`,'green')}
    <div class="kcard ${ecart==null?'':Math.abs(ecart)<1?'green':'terra'}" style="cursor:pointer" onclick="gaBkSoldeModal()"><div class="klabel">Écart de rapprochement</div>
      ${ecart==null?`<div class="kval" style="font-size:1rem">—</div><div class="ksub">Indiquez le solde du relevé</div>`
        :`<div class="kval" style="font-size:1.35rem;color:${Math.abs(ecart)<1?'var(--green)':'var(--red)'}">${Math.abs(ecart)<1?'0 €':gaEur(ecart)}</div><div class="ksub">Banque ${gaEur(sol.montant)} au ${gaFrC(sol.date)} · attendu ${gaEur(th.tot)}</div>`}</div>
  </div>
  <label style="display:flex;gap:.5rem;align-items:center;font-size:.78rem;color:var(--td);margin-bottom:.9rem"><input type="checkbox" ${gaBkAuto()?'checked':''} onchange="gaBkSetAuto(this.checked)"> Valider tout seul ce qui est sûr (montant et nom du locataire concordent, ou payeur déjà connu)</label>
  ${aVal.length?`<div class="card" style="margin-bottom:.9rem"><div class="cb" style="padding:.8rem 1rem">
    <div style="display:flex;justify-content:space-between;align-items:center;gap:.5rem;flex-wrap:wrap"><div style="font-weight:700;font-size:.9rem"><i data-lucide=sparkles class=ic style="color:var(--agencybright)"></i> Correspondances trouvées</div>
      <button class="btn bp bsm" onclick="gaBkToutValider()">Tout valider (${aVal.length})</button></div>
    ${aVal.map(b=>{const p=props.get(b.id);const t=p.m?gaTen(p.m):null;
      const qui=p.k==='loyer'?`${gaE(t?.nom||p.pays[0].tenant_name||'Locataire')} — ${gaE(gaBien(p.m))}<div style="font-size:.7rem;color:var(--td)">${p.pays.map(x=>gaMoisLbl(String(x.due_date).slice(0,7))).join(', ')} · ${gaE(p.why)}</div>`
        :p.k==='op'?`${gaE(p.op.libelle||p.op.type)}<div style="font-size:.7rem;color:var(--td)">${gaE(p.why)} · ${gaFrC(p.op.date)}</div>`
        :p.k==='lot'?`Prélèvements SEPA (${p.lot.nb} loyers)<div style="font-size:.7rem;color:var(--td)">${gaE(p.why)}</div>`
        :p.k==='dep'?`Dépense pour ${gaE(gaBien(p.m))} (${gaE(p.m.owner_name||'propriétaire')})<div style="font-size:.7rem;color:var(--td)">${gaE(p.why)}</div>`
        :p.k==='ign'?`${gaE(GA_BK_NAT_IA[p.nature]||p.nature)}<div style="font-size:.7rem;color:var(--td)">${gaE(p.why)}</div>`
        :`Créer le reversement à ${gaE(p.owner.name)}<div style="font-size:.7rem;color:var(--td)">${gaE(p.why)}</div>`;
      return ligne(b,`<div style="display:flex;gap:.6rem;align-items:center;justify-content:space-between"><div style="font-size:.8rem;min-width:0">${qui}</div>
        <div style="display:flex;gap:.3rem;flex-shrink:0">${p.ia?gaBadge('Claude'+(p.conf?' '+p.conf+' %':''),'b-sea'):''}${p.sur?gaBadge('sûr','b-green'):gaBadge('à vérifier','b-gold')}<button class="btn bp bsm" onclick="gaBkValider('${b.id}')">Valider</button></div></div>`);}).join('')}
  </div></div>`:''}
  ${nonRec.length?`<div class="card" style="margin-bottom:.9rem"><div class="cb" style="padding:.8rem 1rem">
    <div style="display:flex;justify-content:space-between;align-items:center;gap:.5rem;flex-wrap:wrap"><div style="font-weight:700;font-size:.9rem"><i data-lucide=help-circle class=ic style="color:var(--gold)"></i> Non reconnues</div>
      ${GA._bkIA?`<span style="font-size:.78rem;color:var(--agencybright);display:flex;gap:.4rem;align-items:center"><span class="sp" style="width:14px;height:14px;margin:0"></span> Claude analyse ${GA._bkIA.n} opération${GA._bkIA.n>1?'s':''}…</span>`
        :`<button class="btn bp bsm" onclick="gaBkIA()"><i data-lucide=sparkles class=ic></i> Rapprocher avec Claude</button>`}</div>
    <div style="font-size:.74rem;color:var(--td);margin-top:.15rem">Associez-les une fois : un payeur déjà vu (CAF, garant, employeur…) sera reconnu tout seul les mois suivants.</div>
    ${nonRec.map(b=>ligne(b,`${b.detail?.ia&&['aucun','erreur'].includes(b.detail.ia.type)?`<div style="font-size:.68rem;color:${b.detail.ia.type==='erreur'?'var(--red)':'var(--td)'};margin-bottom:.2rem">${gaE(b.detail.ia.explication)}</div>`:''}<div style="display:flex;gap:.3rem"><select class="fsel" id="bk-sel-${b.id}" style="flex:1;min-width:0;font-size:.76rem"><option value="">À quoi correspond cette opération ?</option>${options(b)}</select><button class="btn bp bsm" onclick="gaBkManuel('${b.id}')">OK</button></div>`)).join('')}
  </div></div>`:''}
  ${faits.length?`<div class="card"><div class="cb" style="padding:.8rem 1rem"><details><summary style="cursor:pointer;font-weight:700;font-size:.9rem;list-style:none"><i data-lucide=check-circle-2 class=ic style="color:var(--green)"></i> Rapprochées et classées <span class="badge b-green">${faits.length}</span></summary>
    ${faits.slice(0,150).map(b=>{const m=gaMandat(b.mandat_id);return ligne(b,`<div style="display:flex;gap:.5rem;align-items:center;justify-content:space-between"><div style="font-size:.78rem;min-width:0">${gaBadge(NAT[b.nature]||b.nature||'—',b.statut==='ignore'?'':'b-green')} ${m?`<a href="#" onclick="gaGo({t:'bien',id:'${m.id}'});return false" style="color:var(--agencybright);text-decoration:none">${gaE(gaBien(m))}</a>`:''}${b.auto?' <span style="font-size:.66rem;color:var(--td)">· auto</span>':''}${b.detail?.trop_percu?` <span style="font-size:.66rem;color:var(--gold)">· trop-perçu ${gaEur(b.detail.trop_percu)}</span>`:''}</div>
      <button class="btn bg bsm" onclick="gaBkDelier('${b.id}')" title="Annuler ce rapprochement">Annuler</button></div>`);}).join('')}
  </details></div></div>`:''}`}`;
}

// ════════════ Rapprochement par Claude (API Anthropic) ════════════
const GA_BK_NAT_IA={frais_banque:'Frais bancaires',honoraires:'Honoraires de l’agence (vers compte de fonctionnement)',interne:'Virement interne',autre:'Autre'};
// Proposition de Claude → même format que les propositions automatiques
function gaBkFromIA(l,used){
  const ia=l.detail?.ia;if(!ia||!ia.type||['aucun','erreur'].includes(ia.type))return null;
  const amt=Math.abs(+l.montant);const why='Claude : '+(ia.explication||'');const conf=+ia.confiance||0;const base={ia:true,conf,why,score:conf>=90?8:6};
  if(ia.type==='loyer'&&+l.montant>0){
    const pays=(ia.loyers||[]).map(id=>GA.pays.find(p=>p.id===id)).filter(p=>p&&gaUnpaid(p)&&!used.has(p.id));if(!pays.length)return null;
    const m=gaPayCtx(pays[0].id)?.m;if(!m)return null;const tot=pays.reduce((s,p)=>s+gaReste(p),0);
    return{...base,k:'loyer',m,pays,sur:conf>=90&&Math.abs(tot-amt)<0.01};
  }
  if(+l.montant<0){
    if(ia.type==='operation'){const op=GA.ops.find(o=>o.id===ia.operation);if(!op||used.has(op.id)||gaBkDejaLiees().O.has(op.id))return null;return{...base,k:'op',m:gaMandat(op.mandat_id),op,sur:conf>=90&&Math.abs(-(+op.montant)-amt)<0.01};}
    if(ia.type==='reversement'){const ow=gaOwners().find(o=>o.key===ia.proprietaire);if(!ow)return null;return{...base,k:'newrev',m:ow.ms[0],owner:ow,sur:false};}
    if(ia.type==='depense'){const m=gaMandat(ia.bien);if(!m)return null;return{...base,k:'dep',m,sur:false};}
  }
  if(GA_BK_NAT_IA[ia.type])return{...base,k:'ign',nature:ia.type,m:null,sur:false};
  return null;
}
// Envoie à Claude les opérations non reconnues avec le contexte (loyers dus, propriétaires, historique)
async function gaBkIA(silent){
  if(GA._bkIA)return;
  const props=gaBkPropositions();
  const todo=gaBkLignes().filter(b=>b.statut==='a_traiter'&&!props.has(b.id)&&(!silent||!b.detail?.ia));
  if(!todo.length){if(!silent)toast('Rien à analyser : toutes les opérations ont une correspondance');return;}
  const used=new Set([...gaBkDejaLiees().P]);props.forEach(p=>(p.pays||[]).forEach(x=>used.add(x.id)));
  const loyers=[];
  for(const m of GA.mandats)for(const p of gaPays(m).filter(x=>gaUnpaid(x)&&!used.has(x.id))){const t=gaTen(m);
    loyers.push({id:p.id,bien:gaBien(m),adresse:gaAdresse(m),locataire:t?.nom||p.tenant_name||null,garant:t?.garant_nom||null,proprietaire:m.owner_name||null,echeance:p.due_date,reste:gaReste(p),montant:+p.amount});}
  const lies=gaBkDejaLiees().O;
  const payload={agency_id:U.id,
    lignes:todo.slice(0,400).map(b=>({id:b.id,date:b.date,libelle:b.libelle,montant:+b.montant})),
    loyers,
    operations:GA.ops.filter(o=>+o.montant<0&&!lies.has(o.id)).slice(-400).map(o=>({id:o.id,date:o.date,libelle:o.libelle,montant:+o.montant,bien:gaBien(gaMandat(o.mandat_id)||{})})),
    proprietaires:gaOwners().map(o=>({cle:o.key,nom:o.name,iban:o.iban||null})),
    biens:gaActifs().map(m=>({id:m.id,bien:gaBien(m),adresse:gaAdresse(m),proprietaire:m.owner_name||null,locataire:gaTen(m)?.nom||null})),
    historique:gaBkLignes().filter(b=>b.statut==='rapproche'&&b.mandat_id).slice(0,200).map(b=>({libelle:b.libelle,montant:+b.montant,nature:b.nature,bien:gaBien(gaMandat(b.mandat_id)||{})}))};
  const ids=new Set(payload.lignes.map(l=>l.id));
  GA._bkIA={n:ids.size,start:Date.now()};if(GA.view?.t==='banque')gaRender();
  try{
    const r=await fetch('/.netlify/functions/rapprochement-ia-background',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
    if(!r.ok&&r.status!==202)throw new Error(r.status===404?'fonction rapprochement-ia-background non déployée':'erreur '+r.status);
    // Attendre les réponses (écrites dans gestion_banque.detail.ia)
    const debut=new Date(Date.now()-120000).toISOString(); // marge pour l'horloge du serveur
    for(let k=0;k<60;k++){
      await new Promise(res=>setTimeout(res,3000));
      const{data}=await sb.from('gestion_banque').select('id,detail,statut').in('id',[...ids]);
      const fini=(data||[]).filter(x=>x.detail?.ia?.at&&x.detail.ia.at>=debut);
      (data||[]).forEach(x=>{const l=gaBkLignes().find(b=>b.id===x.id);if(l)Object.assign(l,x);});
      if(fini.length>=ids.size)break;
    }
  }catch(e){if(!silent)toast('Rapprochement par Claude : '+gaE(e.message));}
  GA._bkIA=null;
  const n=gaBkAuto()?await gaBkAutoRun(true):0;
  const props2=gaBkPropositions();const trouv=[...ids].filter(id=>props2.get(id)?.ia).length;
  const err=gaBkLignes().find(b=>ids.has(b.id)&&b.detail?.ia?.type==='erreur');
  toast(err?gaE(err.detail.ia.explication):`Claude : ${trouv+n} correspondance${trouv+n>1?'s':''} trouvée${trouv+n>1?'s':''}${n?` dont ${n} validée${n>1?'s':''} automatiquement`:''}`);
  if(GA.view?.t==='banque')gaRender();
}

// ════════════════════ Statistiques de l'activité gestion ════════════════════
// Mois choisi comparé au mois précédent + tendance sur 12 mois.
const GA_MOTIFS={vente:'Vente du bien',reprise:'Gère lui-même',concurrent:'Autre agence',insatisfaction:'Insatisfaction',habitation:'Y habite / famille',deces:'Succession',autre:'Autre'};
const gaStDebut=m=>gaIso(m.date_signature||m.created_at||gaToday());
const gaStFin=m=>m.statut==='resilie'?gaIso(m.date_resiliation||m.updated_at||gaToday()):null;
const gaStActifAu=(m,d)=>gaStDebut(m)<=d&&(!gaStFin(m)||gaStFin(m)>d);
function gaStMois(ym){
  const from=ym+'-01',to=gaAddM(from,1).slice(0,7)+'-01';const finMois=gaAddDays(to,-1);const veille=gaAddDays(from,-1);
  const inM=d=>d&&gaIso(d)>=from&&gaIso(d)<to;
  let enc=0,hon=0,frais=0,appel=0,recouvre=0;
  for(const m of GA.mandats){
    for(const p of gaPays(m)){if(p.status==='cancelled')continue;
      const v=gaPaid(p);if(v&&inM(p.paid_at)){enc+=v;hon+=gaHonor(m,p,v).hon;}
      if(inM(p.due_date)){appel+=+p.amount||0;recouvre+=Math.min(v,+p.amount||0);}}
    if(+m.frais_fixes>0&&gaStDebut(m)<to&&(!gaStFin(m)||gaStFin(m)>=from))frais+=+m.frais_fixes;
  }
  const actDeb=GA.mandats.filter(m=>gaStActifAu(m,veille)).length,actFin=GA.mandats.filter(m=>gaStActifAu(m,finMois)).length;
  const nouveaux=GA.mandats.filter(m=>inM(gaStDebut(m))),perdus=GA.mandats.filter(m=>gaStFin(m)&&inM(gaStFin(m)));
  // Propriétaires : premier mandat signé ce mois / plus aucun mandat actif à la fin du mois
  const own=gaOwners();
  const nvProprios=own.filter(o=>inM(o.ms.map(gaStDebut).sort()[0])).length;
  const proprioPerdus=own.filter(o=>o.ms.some(m=>gaStFin(m)&&inM(gaStFin(m)))&&!o.ms.some(m=>gaStActifAu(m,finMois))).length;
  const proprioDeb=own.filter(o=>o.ms.some(m=>gaStActifAu(m,veille))).length;
  const rev=GA.ops.filter(o=>o.type==='reversement'&&inM(o.date)).reduce((s,o)=>s-(+o.montant||0),0);
  return{ym,enc:gaR(enc),hon:gaR(hon+frais),appel:gaR(appel),recouvre:gaR(recouvre),taux:appel?Math.round(recouvre/appel*1000)/10:null,
    actDeb,actFin,nouveaux,perdus,attrition:actDeb?Math.round(perdus.length/actDeb*1000)/10:0,nvProprios,proprioPerdus,proprioDeb,rev:gaR(rev)};
}
// CA de gestion annuel récurrent : ce que rapporte le portefeuille actuel sur 12 mois
function gaStRecurrent(){
  return gaR(gaActifs().reduce((s,m)=>{const t=gaTen(m);if(!t)return s+(+m.frais_fixes||0)*12;
    const base=m.base_honoraires==='hc'?t.hc:t.hc+t.ch;return s+base*(+m.taux_honoraires||0)/100*12+(+m.frais_fixes||0)*12;},0));
}
function gaStSel(ym){GA.statMois=ym;gaRender();}
function gaRenderStats(){
  if(!GA.mandats.length)return`<div style="font-size:1.25rem;font-weight:700;margin-bottom:1rem">Statistiques</div>`+gaEmpty('bar-chart-3','Les statistiques apparaîtront dès que vous aurez des biens en gestion.');
  const cur=gaYm(new Date());const ym=GA.statMois||cur;const prevYm=gaAddM(ym+'-15',-1).slice(0,7);
  const A=gaStMois(ym),B=gaStMois(prevYm);
  const serie=[];for(let i=11;i>=0;i--)serie.push(gaStMois(gaAddM(ym+'-15',-i).slice(0,7)));
  const enCours=ym===cur;
  const delta=(a,b,{pct=true,inverse=false,unit=''}={})=>{
    if(b==null||a==null)return'';const d=a-b;if(Math.abs(d)<0.005)return`<span style="color:var(--td)">= ${gaMoisLbl(prevYm).split(' ')[0]}</span>`;
    const bon=inverse?d<0:d>0;const c=bon?'var(--green)':'var(--red)';
    const txt=pct&&b?`${d>0?'+':''}${Math.round(d/Math.abs(b)*100)} %`:`${d>0?'+':''}${unit==='€'?gaEur(d):unit==='pts'?(Math.round(d*10)/10).toString().replace('.',',')+' pt':d}`;
    return`<span style="color:${c};font-weight:700">${d>0?'▲':'▼'} ${txt}</span> <span style="color:var(--td)">vs ${gaMoisLbl(prevYm).split(' ')[0]}</span>`;};
  const card=(l,v,sub,dl,c,click)=>`<div class="kcard ${c||''}"${click?` style="cursor:pointer" onclick="${click}"`:''}><div class="klabel">${l}</div><div class="kval" style="font-size:1.35rem;font-variant-numeric:tabular-nums">${v}</div><div class="ksub">${dl}</div>${sub?`<div class="ksub" style="margin-top:.15rem">${sub}</div>`:''}</div>`;
  const act=gaActifs();const loues=act.filter(m=>gaTen(m)).length;const occ=act.length?Math.round(loues/act.length*100):0;
  const imp=act.reduce((s,m)=>s+gaPays(m).filter(p=>gaUnpaid(p)&&gaDays(p.due_date,gaToday())>0).reduce((x,p)=>x+gaReste(p),0),0);
  // Graphique 12 mois : honoraires (barres) et biens gérés (ligne)
  const W=720,H=210,pl=48,pr=36,pt=14,pb=28;const iw=W-pl-pr,ih=H-pt-pb;
  const maxH=Math.max(1,...serie.map(s=>s.hon));const niceMax=(()=>{const p=Math.pow(10,Math.floor(Math.log10(maxH)));const n=[1,2,2.5,5,10].map(k=>k*p).find(k=>k>=maxH);return n||maxH;})();
  const maxB=Math.max(1,...serie.map(s=>s.actFin));const bw=iw/12;
  const y=v=>pt+ih-(v/niceMax)*ih,yb=v=>pt+ih-(v/(maxB*1.15))*ih;
  const svg=`<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;display:block" role="img" aria-label="Honoraires et biens gérés sur 12 mois">
    ${[0,.5,1].map(f=>`<line x1="${pl}" x2="${W-pr}" y1="${y(niceMax*f)}" y2="${y(niceMax*f)}" stroke="var(--b)" stroke-width="1"/><text x="${pl-6}" y="${y(niceMax*f)+3}" text-anchor="end" font-size="9.5" fill="var(--td)">${Math.round(niceMax*f).toLocaleString('fr-FR')} €</text>`).join('')}
    ${serie.map((s,i)=>`<rect x="${pl+i*bw+bw*.2}" y="${y(s.hon)}" width="${bw*.6}" height="${Math.max(0,pt+ih-y(s.hon))}" rx="3" fill="${s.ym===ym?'var(--agence)':'var(--agencydim)'}" style="cursor:pointer" onclick="gaStSel('${s.ym}')"><title>${gaMoisLbl(s.ym)} : ${gaEur(s.hon)} d’honoraires · ${s.actFin} biens</title></rect>
      <text x="${pl+i*bw+bw/2}" y="${H-10}" text-anchor="middle" font-size="9.5" fill="${s.ym===ym?'var(--txt)':'var(--td)'}">${new Date(s.ym+'-15').toLocaleDateString('fr-FR',{month:'short'}).replace('.','')}</text>`).join('')}
    <polyline points="${serie.map((s,i)=>`${pl+i*bw+bw/2},${yb(s.actFin)}`).join(' ')}" fill="none" stroke="var(--gold)" stroke-width="2"/>
    ${serie.map((s,i)=>`<circle cx="${pl+i*bw+bw/2}" cy="${yb(s.actFin)}" r="2.6" fill="var(--gold)"/>`).join('')}
    <text x="${W-pr+6}" y="${yb(serie[11].actFin)+3}" font-size="9.5" fill="var(--gold)">${serie[11].actFin}</text>
  </svg>`;
  const motifs={};serie.forEach(s=>s.perdus.forEach(m=>{const k=m.motif_resiliation||'nr';motifs[k]=(motifs[k]||0)+1;}));
  const nbPerdus12=Object.values(motifs).reduce((a,b)=>a+b,0);
  const opts=[];for(let i=0;i<12;i++){const k=gaAddM(cur+'-15',-i).slice(0,7);{const lb=gaMoisLbl(k);opts.push(`<option value="${k}" ${k===ym?'selected':''}>${lb[0].toUpperCase()+lb.slice(1)}${k===cur?' (en cours)':''}</option>`);};}
  return`<div style="display:flex;justify-content:space-between;align-items:flex-end;gap:1rem;flex-wrap:wrap;margin-bottom:1rem">
    <div><div style="font-size:1.25rem;font-weight:700">Statistiques</div><div style="font-size:.8rem;color:var(--td);margin-top:.15rem">${enCours?`Mois en cours au ${gaFrC(gaToday())}, comparé à tout ${gaMoisLbl(prevYm)}`:`${gaMoisLbl(ym)} comparé à ${gaMoisLbl(prevYm)}`}</div></div>
    <select class="fsel" style="width:auto" onchange="gaStSel(this.value)">${opts.join('')}</select></div>
  <div class="kgrid" style="margin-bottom:.8rem">
    ${card('Honoraires de gestion',gaEur(A.hon),`${gaEur(A.hon/1.2)} HT`,delta(A.hon,B.hon,{unit:'€'}),'blue')}
    ${card('Biens en gestion',A.actFin,`${A.proprioDeb+A.nvProprios-A.proprioPerdus} propriétaire${A.proprioDeb+A.nvProprios-A.proprioPerdus>1?'s':''}`,delta(A.actFin,B.actFin,{pct:false}),'',`gaGo({t:'home'})`)}
    ${card('Nouveaux mandats',A.nouveaux.length,`dont ${A.nvProprios} nouveau${A.nvProprios>1?'x':''} propriétaire${A.nvProprios>1?'s':''}`,delta(A.nouveaux.length,B.nouveaux.length,{pct:false}),'green')}
    ${card('Mandats perdus',A.perdus.length,`Taux de départ ${String(A.attrition).replace('.',',')} % · ${A.proprioPerdus} propriétaire${A.proprioPerdus>1?'s':''} parti${A.proprioPerdus>1?'s':''}`,delta(A.perdus.length,B.perdus.length,{pct:false,inverse:true}),A.perdus.length?'terra':'')}
  </div>
  <div class="kgrid" style="margin-bottom:1rem">
    ${card('Loyers encaissés',gaEur(A.enc),'',delta(A.enc,B.enc,{unit:'€'}),'green',`gaGo({t:'enc'})`)}
    ${card('Taux de recouvrement',A.taux==null?'—':String(A.taux).replace('.',',')+' %',`${gaEur(A.recouvre)} reçus sur ${gaEur(A.appel)} appelés`,A.taux!=null&&B.taux!=null?delta(A.taux,B.taux,{pct:false,unit:'pts'}):'','gold')}
    ${card('Reversé aux propriétaires',gaEur(A.rev),'',delta(A.rev,B.rev,{unit:'€'}),'',`gaGo({t:'owners'})`)}
    ${card('CA annuel récurrent',gaEur(gaStRecurrent()),'Honoraires que rapporte le portefeuille actuel sur 12 mois',`<span style="color:var(--td)">${occ} % des biens loués · impayés ${gaEur(imp)}</span>`,'blue')}
  </div>
  <div class="card" style="margin-bottom:1rem"><div class="cb">
    <div style="display:flex;justify-content:space-between;gap:.6rem;flex-wrap:wrap;margin-bottom:.4rem"><div style="font-weight:700;font-size:.9rem">12 derniers mois</div>
      <div style="display:flex;gap:.9rem;font-size:.72rem;color:var(--td)"><span><span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:var(--agence);vertical-align:-1px"></span> Honoraires</span><span><span style="display:inline-block;width:12px;height:2px;background:var(--gold);vertical-align:3px"></span> Biens gérés</span></div></div>
    <div style="overflow-x:auto">${svg}</div>
    <div style="overflow-x:auto;margin-top:.6rem"><table class="tbl" style="font-variant-numeric:tabular-nums"><thead><tr><th>Mois</th><th style="text-align:right">Biens</th><th style="text-align:right">Nouveaux</th><th style="text-align:right">Perdus</th><th style="text-align:right">Honoraires</th><th style="text-align:right">Loyers encaissés</th><th style="text-align:right">Recouvrement</th></tr></thead><tbody>
      ${[...serie].reverse().map(s=>`<tr style="cursor:pointer;${s.ym===ym?'background:var(--agencydim)':''}" onclick="gaStSel('${s.ym}')"><td style="text-transform:capitalize">${gaMoisLbl(s.ym)}</td><td style="text-align:right">${s.actFin}</td><td style="text-align:right;color:${s.nouveaux.length?'var(--green)':'var(--td)'}">${s.nouveaux.length?'+'+s.nouveaux.length:'0'}</td><td style="text-align:right;color:${s.perdus.length?'var(--red)':'var(--td)'}">${s.perdus.length?'−'+s.perdus.length:'0'}</td><td style="text-align:right">${gaEur(s.hon)}</td><td style="text-align:right">${gaEur(s.enc)}</td><td style="text-align:right">${s.taux==null?'—':String(s.taux).replace('.',',')+' %'}</td></tr>`).join('')}
    </tbody></table></div>
  </div></div>
  ${A.nouveaux.length||A.perdus.length?`<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:1rem;margin-bottom:1rem">
    ${A.nouveaux.length?`<div class="card" style="margin:0"><div class="cb"><div style="font-weight:700;font-size:.88rem;margin-bottom:.3rem">Arrivés en ${gaMoisLbl(ym).split(' ')[0]}</div>${A.nouveaux.map(m=>`<div style="font-size:.8rem;padding:.4rem 0;border-top:1px solid var(--b)"><a href="#" onclick="gaGo({t:'bien',id:'${m.id}'});return false" style="color:var(--agencybright);text-decoration:none;font-weight:600">${gaE(gaBien(m))}</a> · ${gaE(m.owner_name||'')} <span style="color:var(--td)">· ${gaFrC(gaStDebut(m))}</span></div>`).join('')}</div></div>`:''}
    ${A.perdus.length?`<div class="card" style="margin:0"><div class="cb"><div style="font-weight:700;font-size:.88rem;margin-bottom:.3rem">Partis en ${gaMoisLbl(ym).split(' ')[0]}</div>${A.perdus.map(m=>`<div style="font-size:.8rem;padding:.4rem 0;border-top:1px solid var(--b)">${gaE(gaBien(m))} · ${gaE(m.owner_name||'')} <span style="color:var(--td)">· ${GA_MOTIFS[m.motif_resiliation]||'motif non renseigné'}</span></div>`).join('')}</div></div>`:''}
  </div>`:''}
  ${nbPerdus12?`<div class="card"><div class="cb"><div style="font-weight:700;font-size:.88rem;margin-bottom:.5rem">Pourquoi les propriétaires partent (12 mois)</div>
    ${Object.entries(motifs).sort((a,b)=>b[1]-a[1]).map(([k,n])=>`<div style="display:flex;align-items:center;gap:.6rem;font-size:.78rem;margin:.3rem 0"><span style="width:150px;flex-shrink:0">${k==='nr'?'Non renseigné':GA_MOTIFS[k]||k}</span><div style="flex:1;height:8px;background:var(--s2);border-radius:4px;overflow:hidden"><div style="height:100%;width:${n/nbPerdus12*100}%;background:var(--red);border-radius:4px"></div></div><span style="width:28px;text-align:right;font-variant-numeric:tabular-nums">${n}</span></div>`).join('')}
    <div style="font-size:.7rem;color:var(--td);margin-top:.4rem">Renseignez le motif quand vous passez un mandat en « Résilié » (réglages du bien).</div></div></div>`:''}`;
}

// ════════════════════ Régularisation annuelle des charges ════════════════════
// 1. Le 1er mars, le propriétaire reçoit un lien pour déposer le décompte du syndic et l'avis de
//    taxe foncière (relances automatiques) — fonction gestion-auto.
// 2. Les documents sont lus automatiquement (fonction regul-extract-background).
// 3. Le gestionnaire vérifie ici, le décompte part au locataire, le solde s'applique un mois après
//    (sur la prochaine échéance, ou en 12 mensualités si la régularisation est tardive).
const GA_REG_ST={attente_docs:['Documents attendus','b-gold'],a_verifier:['À vérifier','b-gold'],envoye:['Envoyée au locataire','b-sea'],applique:['Appliquée','b-green'],ignore:['Sans objet','']};
const GA_REG_DOC={syndic:'Décompte du syndic',taxe_fonciere:'Taxe foncière',facture:'Facture',autre:'Document'};
const gaRegulOf=(mid,an)=>(GA.regul||[]).find(r=>r.mandat_id===mid&&+r.annee===+an);
const gaRegulLien=r=>`${location.origin}/charges.html?t=${r.token}`;
const gaRegMDiff=(a,b)=>{const[ya,ma]=a.split('-').map(Number),[yb,mb]=b.split('-').map(Number);return(yb-ya)*12+(mb-ma);};
// Part de régularisation étalée à ajouter à l'échéance du mois ym
function gaRegulExtra(mid,ym){
  return(GA.regul||[]).filter(r=>r.mandat_id===mid&&r.etalement&&r.applique_at).reduce((s,r)=>{const e=r.etalement;const k=gaRegMDiff(e.debut,ym);
    if(k<0||k>=e.mois)return s;return s+(k===e.mois-1?gaR(e.total-e.mensualite*(e.mois-1)):e.mensualite);},0);
}
const gaRegForfait=m=>m.charges_mode==='forfait';
// Provisions sur charges appelées pour l'année (échéances de l'année, hors annulées)
function gaRegulProv(m,t,an){
  const ps=gaPays(m).filter(p=>p.status!=='cancelled'&&String(p.due_date).startsWith(String(an)));
  const ici=gaR(ps.reduce((s,p)=>s+gaSplit({amount:+p.amount-gaRegulExtra(m.id,String(p.due_date).slice(0,7))},t).ch,0));
  const av=gaRegulAvant(m,t,an);
  return{montant:gaR(ici+(av?.montant||0)),ici,nb:ps.length,avant:av};
}
// ── Biens importés : ce que l'ancien logiciel a appelé avant la reprise ─────
// fin_bail.reprise = 1er mois géré ici ; fin_bail.charges_reprise = {ok, derniere_regul, provisions:{annee: montant}}
const gaRepriseYm=m=>m.fin_bail?.reprise||null;
function gaRegulAvant(m,t,an){
  const rep=gaRepriseYm(m);if(!rep)return null;
  const v=m.fin_bail?.charges_reprise?.provisions?.[an];
  if(v!=null&&v!=='')return{montant:+v||0,estime:false};
  const repDate=rep+'-01';if(`${an}-01-01`>=repDate)return null;
  // Estimation : provision mensuelle actuelle × mois de présence du locataire avant la reprise
  const deb=[`${an}-01-01`,t?.debut].filter(Boolean).map(x=>String(x).slice(0,10)).sort().pop();const fin=[`${an+1}-01-01`,repDate].sort()[0];
  const mois=Math.max(0,gaRegMDiff(deb.slice(0,7),fin.slice(0,7)));
  return mois&&t?.ch?{montant:gaR(mois*t.ch),estime:true,mois}:null;
}
// Première année à régulariser par l'agence pour un bien importé
function gaRepriseDebut(m){
  const rep=gaRepriseYm(m);if(!rep)return null;
  const der=m.fin_bail?.charges_reprise?.derniere_regul;const N=new Date().getFullYear();
  if(der==='aucune')return N-3;
  if(der!=null&&der!=='')return +der+1;
  return +gaAddM(rep+'-15',-1).slice(0,4); // par défaut : l'année de la reprise
}
// Présence du locataire pendant l'exercice → prorata
function gaRegulOccup(m,t,deb,fin){
  const a=[deb,t?.debut].filter(Boolean).sort().pop();const sortie=m.fin_bail?.sortie_effective;const b=[fin,sortie].filter(Boolean).sort()[0];
  const tot=gaDays(deb,fin)+1;const j=Math.max(0,gaDays(a,b)+1);
  return{du:a,au:b,jours:Math.min(j,tot),total:tot,pct:tot?Math.min(1,j/tot):1};
}
async function gaRegulEnsure(mid,an){
  let r=gaRegulOf(mid,an);if(r)return r;
  const{data,error}=await sb.from('gestion_regul').insert({agency_id:U.id,mandat_id:mid,annee:an,statut:'attente_docs'}).select().single();
  if(error){toast(/relation|does not exist|schema cache/i.test(error.message)?'Exécutez d’abord supabase-migration-gestion-agence.sql dans Supabase (table gestion_regul).':error.message);return null;}
  (GA.regul=GA.regul||[]).push(data);return data;
}
async function gaRegulUpd(r,upd){const{data,error}=await sb.from('gestion_regul').update(upd).eq('id',r.id).select().single();if(error){toast(error.message);return false;}Object.assign(r,data);return true;}

// ── Tâches (badge « à faire » des biens) et suivi ──────────────────────────────────
function gaRegulTasks(m,t,add,bien){
  if(gaRegForfait(m))return;
  const today=gaToday();const N=new Date().getFullYear();
  for(const r of(GA.regul||[]).filter(x=>x.mandat_id===m.id)){
    if(r.statut==='a_verifier'||(r.statut==='attente_docs'&&(r.docs||[]).length))
      add({p:2,cat:'Charges',ic:'calculator',t:`Régularisation des charges ${r.annee} à vérifier`,d:`${bien} · ${(r.docs||[]).length} document${(r.docs||[]).length>1?'s':''} reçu${(r.docs||[]).length>1?'s':''}${r.extraction?' et lu'+((r.docs||[]).length>1?'s':''):''}`,a:[['Vérifier',`gaRegulOpen('${m.id}',${r.annee})`]]});
    else if(r.statut==='attente_docs'&&r.demande_at&&gaDays(r.demande_at,today)>=45)
      add({p:3,cat:'Charges',ic:'file-clock',t:`Décompte de charges ${r.annee} non reçu`,d:`${bien} · ${m.owner_name||'propriétaire'} relancé ${r.relances||0} fois`,a:[['Saisir à la main',`gaRegulOpen('${m.id}',${r.annee})`],['Relancer',`gaRegulDemander('${r.id}')`]]});
    else if(r.statut==='envoye'&&r.applicable_le&&r.applicable_le<=today)
      add({p:2,cat:'Charges',ic:'calculator',t:`Appliquer la régularisation ${r.annee}`,d:`${bien} · solde ${gaEur(r.solde)}`,a:[['Appliquer',`gaRegulApply('${r.id}')`]]});
  }
  // Années avec des provisions encaissées ici mais sans régularisation (les charges de plus de 3 ans ne se réclament plus)
  if(!t)return;
  for(let y=N-3;y<=N-1;y++){
    if(gaRegulOf(m.id,y))continue;
    if(y===N-1&&today<`${N}-03-01`)continue; // la demande au propriétaire part le 1er mars
    const dr=gaRepriseDebut(m);if(dr!=null&&y<dr)continue; // années déjà régularisées par l'ancien gestionnaire
    const pv=gaRegulProv(m,t,y);if(pv.montant<=0)continue;
    add({p:y<=N-3?2:3,cat:'Charges',ic:'calculator',t:`Régularisation des charges ${y} à faire`,d:`${bien} · ${gaEur(pv.montant)} de provisions appelées${y<=N-3?` · à faire avant fin ${N} (prescription de 3 ans)`:''}`,a:[['Démarrer',`gaRegulOpen('${m.id}',${y})`]]});
  }
}
function gaRegulSuivi(m,t,fut,pas,today){
  if(gaRegForfait(m)||!t)return;const N=new Date().getFullYear();
  for(const r of(GA.regul||[]).filter(x=>x.mandat_id===m.id)){
    if(r.applique_at)pas(r.applique_at,'calculator','g',`Régularisation des charges ${r.annee} appliquée`,`solde ${gaEur(r.solde)}${r.etalement?' en 12 mensualités':''}`);
    else if(r.envoye_at){pas(r.envoye_at,'calculator','n',`Décompte de charges ${r.annee} envoyé au locataire`,`solde ${gaEur(r.solde)}`);fut(r.applicable_le,'calculator','n',`Régularisation ${r.annee} appliquée sur l’échéance`,'automatique, un mois après l’envoi du décompte',true);}
    else if(r.statut==='a_verifier'||(r.docs||[]).length)fut(today,'calculator','o',`Régularisation des charges ${r.annee} à vérifier`,'documents du propriétaire reçus',false,`gaRegulOpen('${m.id}',${r.annee})`);
    else if(r.statut==='attente_docs')fut(gaAddDays(String(r.demande_at||today).slice(0,10),21),'mail','n',`Décompte de charges ${r.annee} demandé au propriétaire`,`relance automatique tous les 21 jours (${r.relances||0} envoi${(r.relances||0)>1?'s':''})`,true);
  }
  if(!gaRegulOf(m.id,N-1)&&t.ch>0)fut(new Date().getMonth()>=2?today:`${N}-03-01`,'mail','n',`Décompte de charges ${N-1} demandé au propriétaire`,'envoi automatique le 1er mars',true);
  if(t.ch>0)fut(`${N+1}-03-01`,'mail','n',`Décompte de charges ${N} demandé au propriétaire`,'envoi automatique',true);
}

// ── Demande au propriétaire (manuelle) ─────────────────────────────
async function gaRegulDemander(rid){
  const r=(GA.regul||[]).find(x=>x.id===rid);const m=gaMandat(r?.mandat_id);if(!r||!m)return;
  if(!m.owner_email){try{await navigator.clipboard.writeText(gaRegulLien(r));}catch(e){}toast('Pas d’e-mail pour le propriétaire : lien de dépôt copié, envoyez-le-lui.');return;}
  const ok=await gaMail(m.owner_email,`Régularisation des charges ${r.annee} — ${gaBien(m)}`,`Régularisation des charges ${r.annee}`,
    `<p>Bonjour ${gaE(m.owner_name||'')},</p><p>Pour la régularisation annuelle des charges ${r.annee} de votre locataire (${gaE(gaBien(m))}), merci de déposer le <strong>décompte annuel de charges ${r.annee} de votre syndic</strong> et votre <strong>avis de taxe foncière ${r.annee}</strong> (et, le cas échéant, les factures d’eau ou d’entretien payées). Une photo ou un PDF suffit.</p>`,
    {url:gaRegulLien(r),label:'Déposer mes documents'});
  await gaRegulUpd(r,{demande_at:new Date().toISOString(),relances:(+r.relances||0)+1});
  toast(ok?'Demande envoyée au propriétaire':'E-mail non envoyé (service e-mail non configuré) — copiez le lien de dépôt');gaRender();
}
async function gaRegulCopy(rid){const r=(GA.regul||[]).find(x=>x.id===rid);try{await navigator.clipboard.writeText(gaRegulLien(r));toast('Lien de dépôt copié');}catch(e){prompt('Lien de dépôt pour le propriétaire :',gaRegulLien(r));}}
async function gaRegulVoir(rid,i){const r=(GA.regul||[]).find(x=>x.id===rid);const d=r?.docs?.[i];if(!d)return;
  const{data,error}=await sb.storage.from('documents-dossiers').createSignedUrl(d.path,3600);if(error){toast(error.message);return;}window.open(data.signedUrl,'_blank');}
async function gaRegulUpload(rid,files,type){
  const r=(GA.regul||[]).find(x=>x.id===rid);if(!r||!files?.length)return;
  for(const f of files){const ext=(f.name.split('.').pop()||'pdf').toLowerCase().replace(/[^a-z0-9]/g,'');const path=`docs/charges-${r.id}/${Date.now()}-${type}.${ext}`;
    const{error}=await sb.storage.from('documents-dossiers').upload(path,f,{upsert:true,contentType:f.type||undefined});if(error){toast('Envoi impossible : '+error.message);return;}
    r.docs=[...(r.docs||[]),{type,path,name:f.name,at:new Date().toISOString(),par:'agence'}];}
  await gaRegulUpd(r,{docs:r.docs,docs_recus_at:new Date().toISOString(),extraction:null,extraction_err:null,...(r.statut==='attente_docs'?{statut:'a_verifier'}:{})});
  gaRegulLire(rid);
}
function gaRegulLire(rid){
  const r=(GA.regul||[]).find(x=>x.id===rid);if(!r)return;
  r.extraction=null;r.extraction_err=null;GRG.lignes=null;
  fetch('/.netlify/functions/regul-extract-background',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:rid})}).catch(()=>{});
  gaRegulOpen(r.mandat_id,r.annee);
}

// ── Écran de vérification ──────────────────────────────────────────
let GRG={};let GRG_POLL=null;
async function gaRegulOpen(mid,an){
  const m=gaMandat(mid);const t=gaTen(m);
  if(!an){const N=new Date().getFullYear();an=[N-3,N-2,N-1].find(y=>{const r=gaRegulOf(mid,y);return(r&&!['applique','ignore'].includes(r.statut))||(!r&&t&&gaRegulProv(m,t,y).montant>0);})||N-1;}
  const r=await gaRegulEnsure(mid,an);if(!r)return;
  if(GRG.rid!==r.id)GRG={rid:r.id,lignes:null};
  const ex=r.extraction||{};
  const deb=GRG.deb||r.exercice_debut||ex.exercice?.debut||`${an}-01-01`,fin=GRG.fin||r.exercice_fin||ex.exercice?.fin||`${an}-12-31`;
  if(!GRG.lignes){
    if(r.lignes?.length)GRG.lignes=r.lignes.map(x=>({...x}));
    else if(ex.lignes?.length||ex.teom){
      GRG.lignes=(ex.lignes||[]).map(l=>({nature:l.nature,montant:l.montant,recup:!!l.recuperable}));
      if(ex.teom?.montant_hors_frais){const deja=GA.ops.find(o=>o.mandat_id===mid&&o.type==='teom'&&String(o.date).startsWith(String(ex.teom.annee||an)));
        GRG.lignes.push({nature:`Taxe d’enlèvement des ordures ménagères ${ex.teom.annee||an} (hors frais de gestion)`,montant:ex.teom.montant_hors_frais,recup:!deja,note:deja?`déjà refacturée le ${gaFrC(deja.date)}`:''});}
    }else GRG.lignes=GA_CH_POSTES.map(p=>({nature:p,montant:0,recup:true}));
  }
  const pv=gaRegulProv(m,t,an);const oc=gaRegulOccup(m,t,deb,fin);
  const lu=!!r.extraction,attente=(r.docs||[]).length&&!r.extraction&&!r.extraction_err&&r.docs_recus_at&&gaDays(r.docs_recus_at,gaToday())<2;
  const verrou=['envoye','applique'].includes(r.statut);
  const tard=gaToday()>gaAddM(fin,12);
  const st=GA_REG_ST[r.statut]||[r.statut,''];
  gaModal(`<div style="display:flex;justify-content:space-between;gap:.6rem;flex-wrap:wrap;align-items:flex-start">
    <div><div style="font-size:1.05rem;font-weight:700"><i data-lucide=calculator class=ic></i> Régularisation des charges ${an}</div>
      <div style="font-size:.76rem;color:var(--td)">${gaE(gaBien(m))} · ${gaE(t?.nom||'locataire')} · propriétaire ${gaE(m.owner_name||'—')}</div></div>
    <div style="display:flex;gap:.35rem;align-items:center">${gaBadge(st[0],st[1])}<select class="fsel" style="width:auto;font-size:.76rem" onchange="GRG={};gaRegulOpen('${mid}',+this.value)">${[0,1,2,3].map(k=>new Date().getFullYear()-1-k).map(y=>`<option ${y===an?'selected':''}>${y}</option>`).join('')}</select></div>
  </div>
  ${gaRegForfait(m)?`<div style="margin-top:.8rem;font-size:.8rem;background:rgba(232,160,32,.1);color:var(--gold);border-radius:8px;padding:.55rem .7rem">Ce bien est réglé en <strong>forfait de charges</strong> (meublé) : la loi interdit toute régularisation. Changez le mode dans les réglages du bien si c’est une erreur.</div>`:''}

  <div style="margin-top:1rem;font-size:.78rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--agencybright)">1 · Documents</div>
  <div style="display:flex;flex-direction:column;gap:.3rem;margin:.4rem 0">${(r.docs||[]).map((d,i)=>`<div style="display:flex;justify-content:space-between;gap:.5rem;font-size:.8rem;background:var(--s2);border-radius:8px;padding:.4rem .6rem">
      <span>${gaBadge(GA_REG_DOC[d.type]||'Document','')} ${gaE(d.name)} <span style="color:var(--td)">· ${gaFrC(d.at)}${d.par==='agence'?' · ajouté par l’agence':''}</span></span><a href="#" onclick="gaRegulVoir('${r.id}',${i});return false" style="color:var(--agencybright)">Voir</a></div>`).join('')
    ||`<div style="font-size:.8rem;color:var(--td)">Aucun document pour l’instant.${r.demande_at?` Demande envoyée le ${gaFrC(r.demande_at)} (${r.relances||0} envoi${(r.relances||0)>1?'s':''}, relance automatique tous les 21 jours).`:' La demande part automatiquement au propriétaire le 1er mars.'}</div>`}</div>
  <div style="display:flex;gap:.35rem;flex-wrap:wrap">
    <button class="btn bg bsm" onclick="gaRegulDemander('${r.id}')"><i data-lucide=send class=ic></i> ${r.demande_at?'Relancer':'Demander'} au propriétaire</button>
    <button class="btn bg bsm" onclick="gaRegulCopy('${r.id}')"><i data-lucide=link class=ic></i> Copier le lien de dépôt</button>
    <label class="btn bg bsm" style="cursor:pointer"><i data-lucide=upload class=ic></i> Ajouter un document<input type="file" accept="application/pdf,image/*" multiple style="display:none" onchange="gaRegulUpload('${r.id}',this.files,this.files[0]&&/fonci/i.test(this.files[0].name)?'taxe_fonciere':'syndic')"></label>
    ${(r.docs||[]).length?`<button class="btn bg bsm" onclick="gaRegulLire('${r.id}')"><i data-lucide=scan-text class=ic></i> Relire automatiquement</button>`:''}
  </div>
  ${attente?`<div style="display:flex;gap:.5rem;align-items:center;font-size:.8rem;margin-top:.6rem;color:var(--agencybright)"><div class="sp" style="width:16px;height:16px;margin:0"></div> Lecture automatique des documents en cours…</div>`:''}
  ${r.extraction_err?`<div style="font-size:.78rem;color:var(--gold);margin-top:.5rem">${gaE(r.extraction_err)}</div>`:''}
  ${lu&&ex.remarques?`<div style="font-size:.76rem;background:var(--agencydim);border-radius:8px;padding:.45rem .65rem;margin-top:.5rem"><i data-lucide=sparkles class=ic></i> Lu automatiquement${ex.lot?' · lot '+gaE(ex.lot):''} — ${gaE(ex.remarques)}</div>`:''}

  <div style="margin-top:1rem;font-size:.78rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--agencybright)">2 · Charges de l’exercice</div>
  <div style="display:flex;gap:.6rem;flex-wrap:wrap;align-items:center;font-size:.78rem;margin:.4rem 0 .5rem">Exercice du <input class="fi" type="date" id="grg-deb" value="${deb}" style="width:auto" ${verrou?'disabled':''} onchange="GRG.deb=this.value;gaRegulOpen('${mid}',${an})"> au <input class="fi" type="date" id="grg-fin" value="${fin}" style="width:auto" ${verrou?'disabled':''} onchange="GRG.fin=this.value;gaRegulOpen('${mid}',${an})"></div>
  <div style="overflow-x:auto"><table class="tbl" style="font-variant-numeric:tabular-nums"><thead><tr><th>Poste (quote-part du lot)</th><th style="text-align:right">Montant</th><th style="text-align:center">Récupérable</th><th></th></tr></thead><tbody id="grg-body">
    ${GRG.lignes.map((l,i)=>`<tr><td><input class="fi" value="${gaE(l.nature)}" ${verrou?'disabled':''} oninput="GRG.lignes[${i}].nature=this.value" style="min-width:200px">${l.note?`<div style="font-size:.68rem;color:var(--gold)">${gaE(l.note)}</div>`:''}</td>
      <td><input class="fi" type="number" step="0.01" value="${l.montant||''}" ${verrou?'disabled':''} oninput="GRG.lignes[${i}].montant=Number(this.value)||0;gaRegulCalc2()" style="width:110px;text-align:right"></td>
      <td style="text-align:center"><input type="checkbox" ${l.recup?'checked':''} ${verrou?'disabled':''} onchange="GRG.lignes[${i}].recup=this.checked;gaRegulCalc2()"></td>
      <td>${verrou?'':`<button class="btn bg bsm" onclick="GRG.lignes.splice(${i},1);gaRegulOpen('${mid}',${an})" aria-label="Supprimer">✕</button>`}</td></tr>`).join('')}
  </tbody></table></div>
  ${verrou?'':`<button class="btn bg bsm" style="margin-top:.4rem" onclick="GRG.lignes.push({nature:'',montant:0,recup:true});gaRegulOpen('${mid}',${an})">+ Ajouter une ligne</button>`}
  <div style="font-size:.7rem;color:var(--td);margin-top:.35rem">Non récupérables (décret 87-713) : honoraires du syndic, assurance de l’immeuble, gros travaux, fonds de travaux, frais de procédure.</div>

  <div style="margin-top:1rem;font-size:.78rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--agencybright)">3 · Part du locataire</div>
  <div class="fgrid2" style="margin-top:.4rem">
    <div class="fg"><label class="fl">Présence du locataire</label><div style="display:flex;gap:.4rem;align-items:center"><input class="fi" type="number" id="grg-pct" min="0" max="100" step="0.1" value="${GRG.pct??(r.prorata!=null&&!GRG.deb&&!GRG.fin?gaR(r.prorata*100):gaR(oc.pct*100))}" ${verrou?'disabled':''} oninput="GRG.pct=this.value;gaRegulCalc2()" style="width:90px"> <span style="font-size:.76rem;color:var(--td)">% · du ${gaFrC(oc.du)} au ${gaFrC(oc.au)} (${oc.jours} j / ${oc.total})</span></div></div>
    <div class="fg"><label class="fl">Provisions appelées en ${an}</label><input class="fi" type="number" step="0.01" id="grg-prov2" value="${GRG.prov??r.provisions??pv.montant}" ${verrou?'disabled':''} oninput="GRG.prov=this.value;gaRegulCalc2()">${!verrou&&pv.avant?`<div style="font-size:.68rem;color:${pv.avant.estime?'var(--gold)':'var(--td)'};margin-top:.15rem">dont ${gaEur(pv.avant.montant)} appelés par l’ancien logiciel${pv.avant.estime?` (estimé : ${pv.avant.mois} mois × provision actuelle)`:''} · <a href="#" onclick="gaCloseModal();gaRepriseCharges();return false" style="color:var(--agencybright)">corriger</a></div>`:!verrou&&pv.nb<12?`<div style="font-size:.68rem;color:var(--td);margin-top:.15rem">${pv.nb} échéance${pv.nb>1?'s':''} gérée${pv.nb>1?'s':''} ici en ${an} : ajoutez les provisions appelées ailleurs si besoin.</div>`:''}</div>
  </div>
  <div id="grg-res2" style="font-size:.92rem;margin:.7rem 0;line-height:1.55"></div>
  ${verrou?'':`<div style="display:flex;flex-direction:column;gap:.35rem;font-size:.8rem">
    <label style="display:flex;gap:.5rem"><input type="radio" name="grg-mode" value="echeance" ${(GRG.mode||r.mode||(tard?'etalement':'echeance'))==='echeance'?'checked':''} onchange="GRG.mode=this.value;gaRegulCalc2()"> Solde sur la prochaine échéance</label>
    <label style="display:flex;gap:.5rem"><input type="radio" name="grg-mode" value="etalement" ${(GRG.mode||r.mode||(tard?'etalement':'echeance'))==='etalement'?'checked':''} onchange="GRG.mode=this.value;gaRegulCalc2()"> Solde réparti sur 12 mois${tard?' <span style="color:var(--gold)">— régularisation tardive : le locataire peut l’exiger (art. 23 loi du 6 juillet 1989)</span>':''}</label>
    <label style="display:flex;gap:.5rem;margin-top:.2rem"><input type="checkbox" id="grg-maj2" ${(GRG.maj??(r.lignes?r.nouvelle_provision!=null:true))?'checked':''} onchange="GRG.maj=this.checked;gaRegulCalc2()"> Ajuster la provision mensuelle à <strong id="grg-np2" style="margin-left:.25rem">—</strong></label>
  </div>`}
  ${r.statut==='envoye'?`<div style="font-size:.8rem;background:var(--s2);border-radius:8px;padding:.55rem .7rem;margin-top:.6rem">Décompte envoyé au locataire le ${gaFrC(r.envoye_at)}. Le solde s’applique automatiquement le <strong>${gaFrC(r.applicable_le)}</strong> (délai d’un mois).</div>`:''}
  ${r.statut==='applique'?`<div style="font-size:.8rem;background:var(--grdim);border-radius:8px;padding:.55rem .7rem;margin-top:.6rem">Appliquée le ${gaFrC(r.applique_at)}${r.etalement?` : ${gaEur(r.etalement.mensualite)} sur 12 échéances à partir de ${gaMoisLbl(r.etalement.debut)}`:''}.</div>`:''}
  <div style="display:flex;justify-content:space-between;gap:.5rem;flex-wrap:wrap;margin-top:1rem">
    <div>${!verrou&&r.statut!=='ignore'?`<button class="btn bg bsm" onclick="gaRegulIgnore('${r.id}')">Sans objet</button>`:''}</div>
    <div style="display:flex;gap:.4rem;flex-wrap:wrap">
      ${verrou?`<button class="btn bg" onclick="gaRegulPdf('${r.id}')"><i data-lucide=file-down class=ic></i> Décompte PDF</button>`:`<button class="btn bg" onclick="gaRegulSave2('${r.id}')">Enregistrer</button>`}
      ${r.statut==='envoye'&&r.applicable_le<=gaToday()?`<button class="btn bp" onclick="gaRegulApply('${r.id}')">Appliquer maintenant</button>`:''}
      ${!verrou&&!gaRegForfait(m)&&t?`<button class="btn bp" onclick="gaRegulEnvoyer('${r.id}')"><i data-lucide=send class=ic></i> Envoyer le décompte au locataire</button>`:''}
    </div></div>`,true);
  gaRegulCalc2();
  clearInterval(GRG_POLL);
  if(attente)GRG_POLL=setInterval(async()=>{if(!document.getElementById('grg-body')){clearInterval(GRG_POLL);return;}
    const{data}=await sb.from('gestion_regul').select('*').eq('id',r.id).maybeSingle();if(data&&(data.extraction||data.extraction_err)){clearInterval(GRG_POLL);Object.assign(r,data);GRG.lignes=null;gaRegulOpen(mid,an);}},4000);
}
function gaRegulCalc2(){
  const r=(GA.regul||[]).find(x=>x.id===GRG.rid);if(!r)return{};
  const tot=gaR((GRG.lignes||[]).filter(l=>l.recup).reduce((s,l)=>s+(+l.montant||0),0));
  const pct=Math.min(100,Math.max(0,Number(document.getElementById('grg-pct')?.value)||0))/100;
  const reel=gaR(tot*pct);const prov=Number(document.getElementById('grg-prov2')?.value)||0;const solde=gaR(reel-prov);
  const mode=document.querySelector('input[name="grg-mode"]:checked')?.value||r.mode||'echeance';
  const np=Math.ceil(tot/12);const maj=document.getElementById('grg-maj2')?.checked??(r.nouvelle_provision!=null);
  const el=document.getElementById('grg-res2');
  if(el)el.innerHTML=`Charges récupérables ${gaEur(tot)}${pct<1?` × ${String(gaR(pct*100)).replace('.',',')} % = <strong>${gaEur(reel)}</strong>`:''} − provisions ${gaEur(prov)} = ${solde>0?`<strong style="color:var(--red)">${gaEur(solde)} à payer par le locataire</strong>${mode==='etalement'?` <span style="color:var(--td)">(${gaEur(solde/12)} × 12)</span>`:''}`:solde<0?`<strong style="color:var(--green)">${gaEur(-solde)} à rembourser au locataire</strong>`:'<strong>équilibré</strong>'}`;
  const e=document.getElementById('grg-np2');if(e)e.textContent=tot?gaEur(np)+' / mois':'—';
  return{tot,pct,reel,prov,solde,mode,np,maj};
}
function gaRegulData(){
  const c=gaRegulCalc2();
  return{lignes:(GRG.lignes||[]).filter(l=>l.nature||l.montant).map(l=>({nature:l.nature,montant:gaR(l.montant),recup:!!l.recup})),
    exercice_debut:gaV('grg-deb')||null,exercice_fin:gaV('grg-fin')||null,prorata:c.pct,provisions:gaR(c.prov),reel:c.reel,solde:c.solde,
    mode:c.mode,nouvelle_provision:c.maj&&c.tot?c.np:null};
}
async function gaRegulSave2(rid){const r=(GA.regul||[]).find(x=>x.id===rid);const d=gaRegulData();
  if(await gaRegulUpd(r,{...d,...(r.statut==='attente_docs'&&d.reel?{statut:'a_verifier'}:{})}))toast('Régularisation enregistrée');}
async function gaRegulIgnore(rid){const r=(GA.regul||[]).find(x=>x.id===rid);if(!confirm(`Marquer la régularisation ${r.annee} comme sans objet ? Plus aucune demande ni relance ne sera envoyée pour cette année.`))return;
  if(await gaRegulUpd(r,{statut:'ignore'})){gaCloseModal();toast('Régularisation classée sans objet');gaRender();}}
async function gaRegulEnvoyer(rid){
  const r=(GA.regul||[]).find(x=>x.id===rid);const m=gaMandat(r.mandat_id);const t=gaTen(m);const d=gaRegulData();
  if(!d.lignes.some(l=>l.recup&&l.montant)){toast('Saisissez au moins une charge récupérable');return;}
  const lim=gaAddDays(gaToday(),31);
  if(!confirm(`Envoyer le décompte ${r.annee} à ${t?.nom||'locataire'} ?\n\nSolde : ${d.solde>=0?gaEur(d.solde)+' à payer':gaEur(-d.solde)+' à rembourser'}${d.mode==='etalement'&&d.solde>0?' (en 12 mensualités)':''}.\nIl s’appliquera automatiquement le ${gaFrC(lim)}, un mois après l’envoi (art. 23 loi du 6 juillet 1989).`))return;
  if(!await gaRegulUpd(r,{...d,statut:'envoye',envoye_at:new Date().toISOString(),applicable_le:lim}))return;
  const rec=d.lignes.filter(l=>l.recup&&l.montant);
  const txt=`${d.solde>0?`Solde à votre charge : ${gaEur(d.solde)}${d.mode==='etalement'?`, réparti sur 12 mois (${gaEur(d.solde/12)} par mois)`:''}, ajouté à vos échéances à partir du ${gaFrC(lim)}.`:d.solde<0?`Trop-perçu en votre faveur : ${gaEur(-d.solde)}, déduit de vos échéances à partir du ${gaFrC(lim)}.`:'Aucun solde.'}${d.nouvelle_provision&&d.nouvelle_provision!==t?.ch?` Nouvelle provision mensuelle : ${gaEur(d.nouvelle_provision)}.`:''}`;
  await gaMail(t?.email,`Régularisation des charges ${r.annee} — ${gaBien(m)}`,`Régularisation des charges ${r.annee}`,
    `<p>Bonjour ${gaE(t?.nom||'')},</p><p>Voici le décompte des charges récupérables de l’année ${r.annee} pour le logement ${gaE(gaAdresse(m))} (exercice du ${gaFrC(d.exercice_debut)} au ${gaFrC(d.exercice_fin)}).</p>
     <table style="border-collapse:collapse;font-size:14px;min-width:320px">${rec.map(l=>`<tr><td style="padding:3px 14px 3px 0">${gaE(l.nature)}</td><td style="text-align:right">${gaEur(l.montant)}</td></tr>`).join('')}
     <tr><td style="padding:6px 14px 3px 0;border-top:1px solid #ddd">Total${d.prorata<1?` × ${String(gaR(d.prorata*100)).replace('.',',')} % (durée d’occupation)`:''}</td><td style="text-align:right;border-top:1px solid #ddd"><strong>${gaEur(d.reel)}</strong></td></tr>
     <tr><td style="padding:3px 14px 3px 0">Provisions appelées</td><td style="text-align:right">− ${gaEur(d.provisions)}</td></tr></table>
     <p><strong>${gaE(txt)}</strong></p><p style="font-size:13px;color:#555">Répartition selon les tantièmes de charges du règlement de copropriété. Les pièces justificatives sont à votre disposition pendant six mois sur simple demande.</p>`);
  if(t?.tenant_id)await gaMsg(t.tenant_id,m.listing_id,`Régularisation des charges ${r.annee} : charges réelles ${gaEur(d.reel)}, provisions ${gaEur(d.provisions)}. ${txt} Le détail vous a été envoyé par e-mail.`);
  if(m.owner_email)gaMail(m.owner_email,`Régularisation des charges ${r.annee} — ${gaBien(m)}`,`Régularisation des charges ${r.annee}`,
    `<p>Bonjour ${gaE(m.owner_name||'')},</p><p>Le décompte ${r.annee} a été envoyé à votre locataire : charges récupérables ${gaEur(d.reel)}, provisions ${gaEur(d.provisions)}, ${d.solde>=0?`solde de ${gaEur(d.solde)} à encaisser`:`trop-perçu de ${gaEur(-d.solde)} à rembourser`}. Il apparaîtra sur vos comptes rendus de gestion.</p>`);
  gaRegulPdf(rid);
  gaCloseModal();toast('Décompte envoyé — application automatique le '+gaFrC(lim));gaRender();
}
function gaRegulPdf(rid){
  const r=(GA.regul||[]).find(x=>x.id===rid);const m=gaMandat(r.mandat_id);const t=gaTen(m);
  const rec=(r.lignes||[]).filter(l=>l.recup&&l.montant);
  gaDoc({m:typeof m!=='undefined'?m:null,dest:[t?.nom||'Locataire',gaAdresse(m)],objet:`Régularisation annuelle des charges ${r.annee}`,fichier:`regul-charges-${r.annee}-${gaBien(m)}`,
    avant:['Madame, Monsieur,',`Voici le décompte des charges récupérables de l’exercice du ${gaFrC(r.exercice_debut)} au ${gaFrC(r.exercice_fin)}, pour le logement situé ${gaAdresse(m)} (article 23 de la loi du 6 juillet 1989). Les charges sont réparties selon les tantièmes du règlement de copropriété.`],
    table:{head:['Poste','Montant'],widths:[124,50],align:['l','r'],rows:rec.map(l=>[l.nature,gaEur(l.montant)]),
      foot:[...(+r.prorata<1?[[`Part du locataire (${String(gaR(r.prorata*100)).replace('.',',')} % de l’exercice)`,gaEur(r.reel)]]:[['Total des charges récupérables',gaEur(r.reel)]]),['Provisions appelées',gaEur(r.provisions)],[+r.solde>=0?'Solde à votre charge':'Trop-perçu en votre faveur',gaEur(Math.abs(+r.solde))]]},
    apres:[+r.solde>0?(r.mode==='etalement'?`Ce montant est réparti sur 12 mois (${gaEur(r.solde/12)} par mois).`:'Ce montant sera ajouté à votre prochaine échéance.'):+r.solde<0?'Ce montant sera déduit de vos prochaines échéances.':'',
      r.applicable_le?`Il s’appliquera à compter du ${gaFrC(r.applicable_le)}.`:'',
      r.nouvelle_provision&&t&&+r.nouvelle_provision!==t.ch?`La provision mensuelle sur charges est portée à ${gaEur(r.nouvelle_provision)}.`:'',
      'Les pièces justificatives sont tenues à votre disposition pendant six mois.','Veuillez agréer, Madame, Monsieur, nos salutations distinguées.'].filter(Boolean)});
}
// Application du solde (aussi faite chaque nuit par gestion-auto)
async function gaRegulApply(rid){
  const r=(GA.regul||[]).find(x=>x.id===rid);if(!r||r.applique_at)return;const m=gaMandat(r.mandat_id);const t=gaTen(m);
  const solde=gaR(r.solde);const from=[r.applicable_le||gaToday(),gaToday()].sort().pop(); // jamais sur une échéance déjà passée
  const futurs=gaPays(m).filter(p=>p.status!=='paid'&&p.status!=='cancelled'&&!(+p.amount_paid)&&p.due_date>=from).sort((a,b)=>a.due_date.localeCompare(b.due_date));
  const setAmt=async(p,a)=>{a=gaR(Math.max(0,a));await sb.from('payments').update({amount:a}).eq('id',p.id);p.amount=a;};
  if(t&&r.nouvelle_provision!=null&&gaR(r.nouvelle_provision)!==gaR(t.ch)){
    const np=gaR(r.nouvelle_provision);
    if(t.lease){await sb.from('leases').update({charges:np}).eq('id',t.lease.id);t.lease.charges=np;}
    else{const{data}=await sb.from('gestion_mandats').update({loc_charges:np}).eq('id',m.id).select().single();if(data)Object.assign(m,data);}
    for(const p of futurs)await setAmt(p,+p.amount+(np-t.ch)*(1+(t.tva||0)/100));
  }
  let et=null,reste=0;
  if(solde>0&&r.mode==='etalement'){const mens=gaR(solde/12);et={debut:String(futurs[0]?.due_date||from).slice(0,7),mois:12,mensualite:mens,total:solde};
    for(const p of futurs){const k=gaRegMDiff(et.debut,String(p.due_date).slice(0,7));if(k>=0&&k<12)await setAmt(p,+p.amount+(k===11?gaR(solde-mens*11):mens));}}
  else if(solde>0){if(futurs[0])await setAmt(futurs[0],+futurs[0].amount+solde);
    else{const{data}=await sb.from('payments').insert({landlord_id:U.id,tenant_id:t?.tenant_id||null,listing_id:m.listing_id||null,mandat_id:m.id,tenant_name:t?.nom||null,tenant_email:t?.email||null,amount:solde,type:'loyer',status:'pending',due_date:from}).select().single();if(data)GA.pays.push(data);}}
  else if(solde<0){reste=-solde;for(const p of futurs){if(reste<=0)break;const d=Math.min(reste,+p.amount);await setAmt(p,+p.amount-d);reste=gaR(reste-d);}}
  await gaRegulUpd(r,{statut:'applique',applique_at:new Date().toISOString(),etalement:et});
  const{data:op}=await sb.from('gestion_operations').insert({agency_id:U.id,mandat_id:m.id,date:gaToday(),type:'regul_charges',montant:0,
    libelle:`Régularisation des charges ${r.annee} : ${solde>=0?'+':''}${gaEur(solde)} (réel ${gaEur(r.reel)} / provisions ${gaEur(r.provisions)})${et?' en 12 mensualités':''}`}).select().single();
  if(op)GA.ops.push(op);
  if(t?.tenant_id)await gaMsg(t.tenant_id,m.listing_id,`Régularisation des charges ${r.annee} appliquée : ${solde>0?(et?`${gaEur(et.mensualite)} ajoutés à chacune de vos 12 prochaines échéances`:`${gaEur(solde)} ajoutés à votre prochaine échéance`):solde<0?`${gaEur(-solde)} déduits de vos prochaines échéances`:'aucun solde'}.`);
  gaCloseModal();toast(reste>0?`Appliquée — il reste ${gaEur(reste)} à rembourser au locataire`:'Régularisation appliquée');gaRender();
}
// Résumé dans l'onglet Loyers de la fiche
function gaRegulBloc(m,t){
  if(!t&&!(GA.regul||[]).some(r=>r.mandat_id===m.id))return'';
  if(gaRegForfait(m))return`<div style="font-size:.76rem;color:var(--td);margin-bottom:.8rem">Charges au forfait : pas de régularisation.</div>`;
  const rs=(GA.regul||[]).filter(r=>r.mandat_id===m.id).sort((a,b)=>b.annee-a.annee);
  if(!rs.length)return'';
  return`<div class="card" style="margin-bottom:.8rem"><div class="cb" style="padding:.7rem 1rem"><div style="font-weight:700;font-size:.86rem;margin-bottom:.3rem">Régularisations des charges</div>
    ${rs.map(r=>{const st=GA_REG_ST[r.statut]||[r.statut,''];return`<div style="display:flex;justify-content:space-between;align-items:center;gap:.5rem;padding:.4rem 0;border-top:1px solid var(--b);font-size:.8rem;cursor:pointer" onclick="GRG={};gaRegulOpen('${m.id}',${r.annee})">
      <span><strong>${r.annee}</strong> ${gaBadge(st[0],st[1])}</span><span style="color:var(--td)">${r.solde!=null&&['envoye','applique'].includes(r.statut)?(+r.solde>=0?'solde '+gaEur(r.solde):'remboursé '+gaEur(-r.solde)):(r.docs||[]).length?(r.docs.length+' document'+(r.docs.length>1?'s':'')):r.demande_at?'demandé le '+gaFrC(r.demande_at):''}</span></div>`;}).join('')}
  </div></div>`;
}

// ── Assistant « Reprise des charges » pour les biens importés ─────────
// Pensé pour les gros portefeuilles : un réglage commun pour tous les biens, un fichier de
// l'ancien logiciel pour les montants exacts, et le détail bien par bien seulement pour les exceptions.
const gaRepriseAFaire=()=>gaActifs().filter(m=>gaRepriseYm(m)&&gaTen(m)&&!m.fin_bail?.charges_reprise?.ok);
const gaRepriseRy=m=>+gaAddM(gaRepriseYm(m)+'-15',-1).slice(0,4);
const gaRepriseAns=(m,der)=>{const N=new Date().getFullYear();const a=[];for(let y=Math.max(N-3,(der==='aucune'?N-3:+der+1));y<=gaRepriseRy(m);y++)a.push(y);return a;};
const gaRepriseEst=(m,t,y)=>{const a=gaRegulAvant({...m,fin_bail:{...m.fin_bail,charges_reprise:{}}},t,y);return a?a.montant:0;};
function gaRepriseAnsHtml(m,t,der,vals){
  const rep=gaRepriseYm(m);const ry=gaRepriseRy(m);
  return gaRepriseAns(m,der).map(y=>`<div style="display:flex;gap:.35rem;align-items:center;margin:.15rem 0;font-size:.76rem"><span style="width:38px">${y}</span><input class="fi gr-prov" data-y="${y}" type="number" step="0.01" value="${vals?.[y]??gaRepriseEst(m,t,y)}" style="width:100px" onchange="this.dataset.src='main'">${y===ry?`<span style="color:var(--td)">avant ${gaMoisLbl(rep).split(' ')[0]}</span>`:''}</div>`).join('')||'<span style="font-size:.74rem;color:var(--td)">—</span>';
}
function gaRepriseCharges(){
  const ms=gaActifs().filter(m=>gaRepriseYm(m)&&gaTen(m));
  if(!ms.length){toast('Aucun bien importé avec un locataire');return;}
  const N=new Date().getFullYear();const defDer=new Date().getMonth()>=5?N-1:N-2;
  const gros=ms.length>15;
  gaModal(`<div style="font-size:1.05rem;font-weight:700;margin-bottom:.25rem"><i data-lucide=calculator class=ic></i> Reprise des charges — ${ms.length} bien${ms.length>1?'s':''} importé${ms.length>1?'s':''}</div>
  <div style="font-size:.78rem;color:var(--td);line-height:1.55;margin-bottom:.9rem">Un seul réglage pour tous les biens suffit. Les provisions appelées par l’ancien logiciel sont estimées (provision × mois avant la reprise) ; si vous avez son export, déposez-le pour avoir les montants exacts.</div>
  <div class="card" style="margin-bottom:.8rem"><div class="cb" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:.9rem">
    <div><div style="font-size:.74rem;font-weight:700;margin-bottom:.3rem">1 · Dernière régularisation faite par l’ancien gestionnaire</div>
      <select class="fsel" id="gr-all-der" onchange="gaRepriseTous()">${[N-1,N-2,N-3].map(y=>`<option value="${y}" ${y===defDer?'selected':''}>${y} pour tous les biens</option>`).join('')}<option value="aucune">Aucune / je ne sais pas</option></select>
      <div style="font-size:.7rem;color:var(--td);margin-top:.25rem">Les biens retrouvés dans le fichier ou modifiés à la main gardent leur valeur.</div></div>
    <div><div style="font-size:.74rem;font-weight:700;margin-bottom:.3rem">2 · Montants exacts <span style="font-weight:400;color:var(--td)">facultatif</span></div>
      <label class="btn bg bsm" style="cursor:pointer;width:100%;justify-content:center"><i data-lucide=file-spreadsheet class=ic></i> Déposer l’export de l’ancien logiciel<input type="file" accept=".csv,.txt,.xlsx,.xls,.ods" style="display:none" onchange="gaRepriseFichier(this.files[0]);this.value=''"></label>
      <div id="gr-file-res" style="font-size:.7rem;color:var(--td);margin-top:.25rem">État des charges, compte locataire ou état locatif : une ligne par lot avec les provisions appelées et/ou la dernière régularisation.</div></div>
  </div></div>
  <details ${gros?'':'open'} id="gr-det"><summary style="cursor:pointer;font-size:.82rem;font-weight:700;list-style:none;margin-bottom:.4rem"><i data-lucide=list class=ic></i> Détail bien par bien ${gros?'<span style="font-weight:400;color:var(--td)">(seulement pour les exceptions)</span>':''}</summary>
    ${gros?`<input class="fi" type="search" placeholder="Rechercher un bien, un locataire…" style="margin-bottom:.5rem;max-width:360px" oninput="const w=gaHomeNorm(this.value).trim().split(' ').filter(Boolean);document.querySelectorAll('#ga-modal tr[data-mid]').forEach(tr=>tr.style.display=w.every(x=>tr.dataset.q.includes(x))?'':'none')">`:''}
    <div style="overflow:auto;max-height:${gros?'46vh':'none'}"><table class="tbl" style="font-variant-numeric:tabular-nums"><thead><tr><th>Bien</th><th>Provision / mois</th><th>Charges</th><th>Dernière régul.</th><th>Provisions appelées par l’ancien logiciel</th></tr></thead><tbody>
    ${ms.map(m=>{const t=gaTen(m);const cr=m.fin_bail?.charges_reprise||{};const der=cr.derniere_regul??defDer;const fixe=cr.derniere_regul!=null;
      return`<tr data-mid="${m.id}" data-q="${gaE(gaHomeKey(m))}" ${fixe?'data-src="main"':''}><td style="font-size:.78rem;min-width:170px"><strong>${gaE(gaBien(m))}</strong><div style="color:var(--td)">${gaE(t.nom)} · géré ici depuis ${gaMoisLbl(gaRepriseYm(m))}</div></td>
        <td><input class="fi gr-ch" type="number" step="0.01" value="${t.ch||0}" style="width:90px" ${t.lease?'disabled title="Bail Trouve Ton Toit : modifiez-le dans le bail"':''} onchange="this.closest('tr').querySelectorAll('.gr-prov').forEach(i=>{if(i.dataset.src!=='main'){const m=gaMandat(this.closest('tr').dataset.mid);i.value=gaRepriseEst(m,{...gaTen(m),ch:Number(this.value)||0},+i.dataset.y);}})"></td>
        <td><select class="fsel gr-mode" style="width:auto" onchange="this.closest('tr').querySelectorAll('.gr-der,.gr-prov').forEach(x=>x.disabled=this.value==='forfait')"><option value="provision">Provision</option>${m.bien_meuble!==false?`<option value="forfait" ${m.charges_mode==='forfait'?'selected':''}>Forfait</option>`:''}</select></td>
        <td><select class="fsel gr-der" style="width:auto" onchange="this.closest('tr').dataset.src='main';gaRepriseLigne(this)" ${m.charges_mode==='forfait'?'disabled':''}>${[N-1,N-2,N-3].map(y=>`<option value="${y}" ${String(der)===String(y)?'selected':''}>${y}</option>`).join('')}<option value="aucune" ${der==='aucune'?'selected':''}>Aucune</option></select></td>
        <td class="gr-ans">${gaRepriseAnsHtml(m,t,der,cr.provisions)}</td></tr>`;}).join('')}
    </tbody></table></div></details>
  <div style="font-size:.72rem;color:var(--td);margin-top:.6rem">Une régularisation déjà calculée par l’ancien logiciel mais pas encore payée se reprend dans la colonne « Solde dû » de l’import.</div>
  <div id="gr-prog" style="font-size:.8rem;margin-top:.6rem"></div>
  <div style="display:flex;justify-content:flex-end;gap:.5rem;margin-top:.8rem"><button class="btn bg" onclick="gaCloseModal()">Plus tard</button><button class="btn bp" id="gr-go" onclick="gaRepriseSave()">Valider les ${ms.length} bien${ms.length>1?'s':''}</button></div>`,true);
}
// Réglage commun appliqué à toutes les lignes qui n'ont pas été modifiées à la main / par le fichier
function gaRepriseTous(){
  const v=gaV('gr-all-der');
  document.querySelectorAll('#ga-modal tr[data-mid]').forEach(tr=>{if(tr.dataset.src==='main'||tr.dataset.src==='file')return;const s=tr.querySelector('.gr-der');if(s.disabled)return;s.value=v;gaRepriseLigne(s);});
}
function gaRepriseLigne(sel){
  const tr=sel.closest('tr');const m=gaMandat(tr.dataset.mid);const t={...gaTen(m),ch:Number(tr.querySelector('.gr-ch')?.value)||gaTen(m).ch};
  const old={};tr.querySelectorAll('.gr-prov').forEach(i=>{if(i.dataset.src==='main'||i.dataset.src==='file')old[i.dataset.y]=i.value;});
  tr.querySelector('.gr-ans').innerHTML=gaRepriseAnsHtml(m,t,sel.value,old);
  tr.querySelectorAll('.gr-prov').forEach(i=>{if(old[i.dataset.y]!=null)i.dataset.src='main';});
}
// Export de l'ancien logiciel : on retrouve chaque bien (référence, n° de mandat, locataire, adresse)
async function gaRepriseFichier(file){
  if(!file)return;const res=document.getElementById('gr-file-res');res.innerHTML='Lecture…';
  let grid=[];
  try{
    const ext=file.name.split('.').pop().toLowerCase();
    if(['xlsx','xls','ods'].includes(ext)){const buf=await file.arrayBuffer();await new Promise(r=>gaImpLoadXlsx(r));
      const wb=XLSX.read(buf,{type:'array',cellDates:true});grid=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{header:1,raw:true,defval:''});}
    else{const buf=await file.arrayBuffer();let txt=new TextDecoder('utf-8').decode(buf);if(txt.includes('�'))txt=new TextDecoder('windows-1252').decode(buf);grid=gaCsvParse(txt);}
  }catch(e){res.innerHTML=`<span style="color:var(--red)">Fichier illisible : ${gaE(e.message)}</span>`;return;}
  const N=new Date().getFullYear();const nz=c=>gaHomeNorm(c instanceof Date?'':c);
  const RE={ref:/^(ref|reference|lot|n lot|code lot|designation|libelle|bien)\b|ref.*lot|ref.*bien/,num:/mandat/,loc:/locataire|occupant|preneur/,adr:/adresse/,
    der:/regul/,prov:/(provision|charge)s?.*(appel|cumul|deja|depuis|exercice|annee|20\d\d)|^provisions?( sur| de)? charges/};
  let hi=0,bs=-1;grid.slice(0,20).forEach((r,i)=>{const sc=r.filter(c=>Object.values(RE).some(re=>re.test(nz(c)))).length;if(sc>bs){bs=sc;hi=i;}});
  const H=(grid[hi]||[]).map(nz);const col=k=>H.findIndex(h=>RE[k].test(h));
  const cRef=col('ref'),cNum=col('num'),cLoc=col('loc'),cAdr=col('adr'),cDer=H.findIndex(h=>RE.der.test(h)&&!/montant|solde/.test(h));
  // Colonnes de provisions : une par année (année lue dans l'en-tête, sinon l'année en cours)
  const cProv=H.map((h,i)=>RE.prov.test(h)&&!RE.der.test(h)?{i,y:+(h.match(/20\d\d/)?.[0]||N)}:null).filter(Boolean);
  if(!cProv.length&&cDer<0){res.innerHTML='<span style="color:var(--red)">Aucune colonne de provisions ou de régularisation trouvée dans ce fichier.</span>';return;}
  const idx={};const put=(k,m)=>{if(k&&k.length>1)(idx[k]=idx[k]||[]).push(m);};
  const ms=gaActifs().filter(m=>gaRepriseYm(m)&&gaTen(m));
  ms.forEach(m=>{put('r:'+nz(m.bien_label),m);if(m.numero)put('n:'+m.numero,m);put('l:'+nz(gaTen(m)?.nom),m);put('a:'+nz(m.bien_adresse).split(',')[0],m);});
  const seul=a=>a&&a.length===1?a[0]:null;
  let ok=0,ko=0;const vus=new Set();
  for(const r of grid.slice(hi+1)){
    if(!r.some(c=>String(c??'').trim()))continue;
    const m=(cRef>=0&&seul(idx['r:'+nz(r[cRef])]))||(cNum>=0&&seul(idx['n:'+parseInt(String(r[cNum]).replace(/\D/g,''))]))||(cLoc>=0&&seul(idx['l:'+nz(r[cLoc])]))||(cAdr>=0&&seul(idx['a:'+nz(r[cAdr]).split(',')[0]]));
    if(!m){ko++;continue;}
    const tr=document.querySelector(`#ga-modal tr[data-mid="${m.id}"]`);if(!tr)continue;
    if(cDer>=0){const v=String(r[cDer]??'');const y=v.match(/20\d\d/);const s=tr.querySelector('.gr-der');if(y&&[...s.options].some(o=>o.value===y[0])){s.value=y[0];gaRepriseLigne(s);}else if(/aucun|jamais/i.test(v)){s.value='aucune';gaRepriseLigne(s);}}
    for(const c of cProv){const n=gaImpNum(r[c.i]);if(n==null)continue;const i=tr.querySelector(`.gr-prov[data-y="${c.y}"]`);if(i){i.value=gaR(n);i.dataset.src='file';}}
    tr.dataset.src='file';if(!vus.has(m.id)){vus.add(m.id);ok++;}
  }
  res.innerHTML=`<span style="color:var(--green);font-weight:600">${ok} bien${ok>1?'s':''} retrouvé${ok>1?'s':''} dans le fichier</span>${ko?` · ${ko} ligne${ko>1?'s':''} non reconnue${ko>1?'s':''}`:''}${ms.length-ok>0?` · ${ms.length-ok} bien${ms.length-ok>1?'s':''} gardent l’estimation`:''}.`;
}
async function gaRepriseSave(){
  const trs=[...document.querySelectorAll('#ga-modal tr[data-mid]')];const btn=document.getElementById('gr-go');if(btn)btn.disabled=true;
  const prog=document.getElementById('gr-prog');let n=0,err=null;
  const one=async tr=>{
    const m=gaMandat(tr.dataset.mid);const t=gaTen(m);
    const mode=tr.querySelector('.gr-mode').value;const der=tr.querySelector('.gr-der').value;
    const prov={};tr.querySelectorAll('.gr-prov').forEach(i=>{prov[i.dataset.y]=gaR(Number(String(i.value).replace(',','.'))||0);});
    const upd={fin_bail:{...(m.fin_bail||{}),charges_reprise:{ok:true,derniere_regul:der==='aucune'?'aucune':+der,provisions:prov,at:gaToday(),source:tr.dataset.src||'estimation'}}};
    if(mode==='forfait'||m.charges_mode==='forfait')upd.charges_mode=mode;
    const ch=Number(tr.querySelector('.gr-ch').value);if(!t.lease&&!isNaN(ch)&&gaR(ch)!==gaR(t.ch))upd.loc_charges=gaR(ch);
    const{data,error}=await sb.from('gestion_mandats').update(upd).eq('id',m.id).select().single();
    if(error){err=error.message;return;}Object.assign(m,data);n++;
  };
  // Par lots de 25 en parallèle : 500 biens en quelques secondes
  for(let i=0;i<trs.length;i+=25){await Promise.all(trs.slice(i,i+25).map(one));if(prog)prog.textContent=`Enregistrement… ${Math.min(i+25,trs.length)} / ${trs.length}`;if(err)break;}
  if(err){if(btn)btn.disabled=false;toast(/charges_mode|column/i.test(err)?'Exécutez d’abord supabase-migration-gestion-agence.sql dans Supabase.':err);return;}
  gaCloseModal();toast(`<i data-lucide=check-circle-2 class=ic></i> Reprise des charges enregistrée pour ${n} bien${n>1?'s':''}`);gaRender();
}

// ════════════════════ Sociétés / agences d'un même compte ════════════════════
// Un réseau ou un groupe gère plusieurs agences (cartes pro, garanties, comptes mandants différents).
// Chaque mandat est rattaché à une société ; documents, comptabilité, SEPA et FEC se font par société.
const gaEntiteDefaut=()=>(GA.entites||[]).find(e=>e.defaut)||(GA.entites||[])[0]||null;
const gaEntiteDefautId=()=>gaEntiteDefaut()?.id||null;
function gaEntite(m){
  const E=GA.entites||[];if(!E.length)return null;
  if(m&&typeof m==='object'&&m.entite_id)return E.find(e=>e.id===m.entite_id)||gaEntiteDefaut();
  if(typeof m==='string')return E.find(e=>e.id===m)||gaEntiteDefaut();
  return(GA.entiteF&&E.find(e=>e.id===GA.entiteF))||gaEntiteDefaut();
}
const gaMandatsEntite=eid=>GA.mandats.filter(m=>(m.entite_id||gaEntiteDefautId())===eid);
// Sélecteur affiché en haut de la gestion quand il y a plusieurs sociétés
function gaEntiteBar(){
  const E=GA.entites||[];if(E.length<2)return'';
  return`<div style="display:flex;gap:.5rem;align-items:center;margin-bottom:.8rem;font-size:.8rem"><i data-lucide=building-2 class=ic style="color:var(--td)"></i>
    <select class="fsel" style="width:auto" onchange="GA.entiteF=this.value||null;gaRender()"><option value="">Toutes les agences / sociétés</option>${E.map(e=>`<option value="${e.id}" ${GA.entiteF===e.id?'selected':''}>${gaE(e.nom)}</option>`).join('')}</select></div>`;
}
function gaRenderParams(){
  const E=GA.entites||[];
  return`<div style="font-size:1.25rem;font-weight:700;margin-bottom:.2rem">Paramètres de la gestion</div>
  <div style="font-size:.8rem;color:var(--td);margin-bottom:1rem">Sociétés ou agences, comptes bancaires mandants, identifiant SEPA, droits de l’équipe et journal d’activité.</div>
  <div class="card" style="margin-bottom:1rem"><div class="cb">
    <div style="display:flex;justify-content:space-between;align-items:center;gap:.5rem;flex-wrap:wrap;margin-bottom:.4rem"><div style="font-weight:700">Sociétés / agences</div><button class="btn bp bsm" onclick="gaEntiteModal()">+ Ajouter</button></div>
    ${E.length?E.map(e=>`<div style="display:flex;justify-content:space-between;gap:.6rem;align-items:center;padding:.55rem 0;border-top:1px solid var(--b);flex-wrap:wrap">
      <div style="font-size:.82rem"><strong>${gaE(e.nom)}</strong> ${e.defaut?gaBadge('par défaut','b-green'):''}<div style="font-size:.72rem;color:var(--td)">${[e.carte&&'carte '+e.carte,e.iban&&'compte mandant '+e.iban.replace(/\s/g,'').replace(/^(.{4}).*(.{4})$/,'$1 •••• $2'),e.ics&&'ICS '+e.ics].filter(Boolean).map(gaE).join(' · ')||'à compléter'} · ${gaMandatsEntite(e.id).length} mandat${gaMandatsEntite(e.id).length>1?'s':''}</div></div>
      <button class="btn bg bsm" onclick="gaEntiteModal('${e.id}')">Modifier</button></div>`).join('')
      :`<div style="font-size:.8rem;color:var(--td);line-height:1.55">Renseignez votre société : son compte mandant (IBAN) et son identifiant créancier SEPA (ICS) servent aux virements et prélèvements. Si vous avez plusieurs agences ou sociétés, ajoutez-les : chaque mandat sera rattaché à la sienne.</div>`}
  </div></div>
  ${typeof gaRenderDroits==='function'?gaRenderDroits():''}`;
}
function gaEntiteModal(id){
  const e=id?(GA.entites||[]).find(x=>x.id===id):{nom:agencyData?.agency_name||'',adresse:agencyData?.address||'',tel:agencyData?.phone||'',email:agencyData?.email||'',carte:agencyData?.license_number||'',cci:agencyData?.cci_delivrance||'',garantie:agencyData?.garantie_financiere||'',defaut:!(GA.entites||[]).length};
  const f=(k,l,ph,full)=>`<div class="fg"${full?' style="grid-column:1/-1"':''}><label class="fl">${l}</label><input class="fi" id="ge-${k}" value="${gaE(e[k]||'')}" placeholder="${ph||''}"></div>`;
  gaModal(`<div style="font-size:1rem;font-weight:700;margin-bottom:.6rem">${id?'Modifier':'Ajouter'} une société / agence</div>
  <div class="fgrid2">${f('nom','Raison sociale *','Agence du Centre SARL',true)}${f('adresse','Adresse','12 rue…, 69002 Lyon',true)}${f('tel','Téléphone')}${f('email','E-mail')}${f('siren','SIREN','9 chiffres (export FEC)')}${f('carte','Carte professionnelle (gestion)','CPI 6901 …')}${f('cci','Délivrée par','CCI de …')}${f('garantie','Garantie financière','Galian — 120 000 €')}
  <div style="grid-column:1/-1;font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--agencybright);margin-top:.4rem">Compte mandant (séquestre)</div>
  ${f('iban','IBAN du compte mandant','FR76 …')}${f('bic','BIC','AGRIFRPPXXX')}${f('ics','Identifiant créancier SEPA (ICS)','FR12ZZZ123456')}
  <label style="display:flex;gap:.5rem;align-items:center;font-size:.8rem;grid-column:1/-1"><input type="checkbox" id="ge-defaut" ${e.defaut?'checked':''}> Société par défaut (mandats non rattachés)</label></div>
  <div style="font-size:.7rem;color:var(--td);margin-top:.5rem">L’ICS est fourni par votre banque quand vous demandez à faire des prélèvements SEPA.</div>
  <div style="display:flex;justify-content:flex-end;gap:.5rem;margin-top:1rem"><button class="btn bg" onclick="gaCloseModal()">Annuler</button><button class="btn bp" onclick="gaEntiteSave(${id?`'${id}'`:'null'})">Enregistrer</button></div>`);
}
async function gaEntiteSave(id){
  const row={agency_id:U.id};['nom','adresse','tel','email','siren','carte','cci','garantie','iban','bic','ics'].forEach(k=>row[k]=gaV('ge-'+k)||null);
  row.iban=row.iban?row.iban.replace(/\s+/g,'').toUpperCase():null;row.bic=row.bic?row.bic.toUpperCase():null;row.defaut=gaC('ge-defaut');
  if(!row.nom){toast('Indiquez la raison sociale');return;}
  if(row.iban&&!gaIbanOk(row.iban)){toast('IBAN invalide : vérifiez-le');return;}
  if(row.siren&&!/^\d{9}$/.test(row.siren.replace(/\s/g,''))){toast('Le SIREN compte 9 chiffres');return;}
  if(row.siren)row.siren=row.siren.replace(/\s/g,'');
  const q=id?sb.from('gestion_entites').update(row).eq('id',id).select().single():sb.from('gestion_entites').insert(row).select().single();
  const{data,error}=await q;if(error){toast(/relation|schema cache/i.test(error.message)?'Exécutez d’abord supabase-migration-gestion-agence.sql dans Supabase.':error.message);return;}
  if(row.defaut)for(const e of GA.entites.filter(x=>x.id!==data.id&&x.defaut)){await sb.from('gestion_entites').update({defaut:false}).eq('id',e.id);e.defaut=false;}
  if(id)Object.assign(GA.entites.find(x=>x.id===id),data);else GA.entites.push(data);
  gaCloseModal();toast('Société enregistrée');gaRender();
}
// Contrôle d'un IBAN (clé modulo 97)
function gaIbanOk(iban){
  const s=String(iban||'').replace(/\s+/g,'').toUpperCase();if(!/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(s))return false;
  const r=(s.slice(4)+s.slice(0,4)).replace(/[A-Z]/g,c=>c.charCodeAt(0)-55);let m=0;for(const ch of r)m=(m*10+ +ch)%97;return m===1;
}

// ════════════════════ Comptabilité mandant (partie double) ════════════════════
// Les écritures sont produites à partir de ce qui est enregistré dans la gestion (appels de loyers,
// encaissements, honoraires, travaux, reversements, dépôts, relevé bancaire) : la comptabilité est
// toujours à jour et équilibrée, sans double saisie. Journaux, grand livre, balance, lettrage des
// locataires, état de représentation des fonds (loi Hoguet), clôture d'exercice et export FEC.
const GA_PCG={
  '512000':'Banque — compte mandant','411':'Locataires','467':'Propriétaires (mandants)',
  '467800':'Primes d’assurance loyers impayés à reverser','467900':'Agence — honoraires à prélever','419100':'Dépôts de garantie reçus'};
const GA_JNX={AN:'Reprises et à-nouveaux',AP:'Appels de loyers',BQ:'Banque',HO:'Honoraires et assurances',OD:'Opérations diverses'};
const gaCptLib=c=>GA_PCG[c]||GA_PCG[c.slice(0,3)]||c;
// Codes auxiliaires stables : locataire = n° de mandat, propriétaire = plus petit n° de ses mandats
const gaAuxLoc=m=>'L'+String(m.numero||m.id.slice(0,6)).padStart(5,'0');
function gaAuxProp(m){const k=gaOwnerKey(m);const nums=GA.mandats.filter(x=>gaOwnerKey(x)===k).map(x=>+x.numero||0).filter(Boolean);return'P'+String(nums.length?Math.min(...nums):m.id.slice(0,6)).padStart(5,'0');}
function gaEcritures(eid,from,to){
  const E=[];let n=0;
  const inP=d=>d&&(!from||gaIso(d)>=from)&&(!to||gaIso(d)<=to);
  const add=(j,date,piece,lib,lignes)=>{n++;lignes.forEach(l=>E.push({j,date:gaIso(date),num:n,piece,lib,...l,debit:gaR(l.debit||0),credit:gaR(l.credit||0)}));};
  const ms=GA.mandats.filter(m=>!eid||(m.entite_id||gaEntiteDefautId())===eid);
  for(const m of ms){
    const t=gaTen(m);const loc={c:'411',aux:gaAuxLoc(m),auxLib:t?.nom||'Locataire '+gaBien(m)};const pro={c:'467',aux:gaAuxProp(m),auxLib:m.owner_name||'Propriétaire'};
    const L=(a,debit,credit)=>({compte:a.c,aux:a.aux||'',auxLib:a.auxLib||'',debit,credit});
    // Reprise des dépôts de garantie détenus par l'agence (locataires déjà en place)
    if(m.loc_nom&&+m.loc_depot>0&&m.depot_detenu_par!=='proprietaire'){const d=gaIso(m.date_signature||m.created_at);if(inP(d))add('AN',d,'DG-'+(m.numero||''),`Dépôt de garantie ${m.loc_nom} — ${gaBien(m)}`,[L({c:'512000'},+m.loc_depot,0),L({c:'419100',aux:loc.aux,auxLib:loc.auxLib},0,+m.loc_depot)]);}
    for(const p of gaPays(m)){
      if(p.status==='cancelled')continue;const lt=p.status==='paid'?'L'+p.id.replace(/[^a-z0-9]/gi,'').slice(0,6).toUpperCase():'';
      const per=gaMoisLbl(String(p.due_date).slice(0,7));
      if(inP(p.due_date))add('AP',p.due_date,'AP-'+String(p.due_date).slice(0,7)+'-'+(m.numero||''),`Loyer ${per} — ${gaBien(m)}`,[{...L(loc,+p.amount,0),let:lt,dateLet:lt?gaIso(p.paid_at):''},L(pro,0,+p.amount)]);
      const v=gaPaid(p);
      if(v&&inP(p.paid_at)){
        add('BQ',p.paid_at,'EN-'+p.id.slice(0,8),`Encaissement loyer ${per} — ${loc.auxLib}`,[L({c:'512000'},v,0),{...L(loc,0,v),let:lt,dateLet:lt?gaIso(p.paid_at):''}]);
        const h=gaHonor(m,p,v);
        const hl=[];if(h.hon)hl.push(L(pro,h.hon,0),L({c:'467900'},0,h.hon));if(h.gli)hl.push(L(pro,h.gli,0),L({c:'467800'},0,h.gli));
        if(hl.length)add('HO',p.paid_at,'HO-'+p.id.slice(0,8),`Honoraires${h.gli?' et GLI':''} ${per} — ${gaBien(m)}`,hl);
      }
    }
    // Frais de gestion forfaitaires mensuels
    if(+m.frais_fixes>0){const st=String(m.date_signature||m.created_at||'').slice(0,7);const fin=m.statut==='resilie'?String(m.date_resiliation||m.updated_at||'').slice(0,7):gaYm(new Date());
      for(let ym=[st,(from||'2015-01-01').slice(0,7)].sort().pop();ym<=fin&&(!to||ym<=to.slice(0,7));ym=gaAddM(ym+'-15',1).slice(0,7)){if(!inP(ym+'-01'))continue;add('HO',ym+'-01','FF-'+ym+'-'+(m.numero||''),`Frais de gestion forfaitaires ${gaMoisLbl(ym)} — ${gaBien(m)}`,[L(pro,+m.frais_fixes,0),L({c:'467900'},0,+m.frais_fixes)]);}}
    for(const o of GA.ops.filter(o=>o.mandat_id===m.id&&+o.montant&&inP(o.date))){
      const v=Math.abs(+o.montant);const lib=o.libelle||o.type;
      if(o.type==='depot_restitue')add('BQ',o.date,'DR-'+o.id.slice(0,8),lib,[L({c:'419100',aux:loc.aux,auxLib:loc.auxLib},v,0),L({c:'512000'},0,v)]);
      else if(String(o.type).startsWith('depot_'))continue;
      else if(+o.montant<0)add('BQ',o.date,(o.type==='reversement'?'RV-':'OP-')+o.id.slice(0,8),lib+' — '+gaBien(m),[L(pro,v,0),L({c:'512000'},0,v)]);
      else add('BQ',o.date,'OP-'+o.id.slice(0,8),lib+' — '+gaBien(m),[L({c:'512000'},v,0),L(pro,0,v)]);
    }
  }
  // Honoraires virés au compte de fonctionnement de l'agence (classés ainsi dans la page Banque)
  for(const b of(GA.bank||[]).filter(b=>b.statut==='ignore'&&b.nature==='honoraires'&&inP(b.date)&&(!eid||!b.entite_id||b.entite_id===eid))){
    const v=Math.abs(+b.montant);add('BQ',b.date,'HP-'+String(b.id).slice(0,8),b.libelle||'Prélèvement des honoraires',[{compte:'467900',aux:'',auxLib:'',debit:v,credit:0},{compte:'512000',aux:'',auxLib:'',debit:0,credit:v}]);
  }
  return E.sort((a,b)=>a.date.localeCompare(b.date)||a.num-b.num);
}
// Soldes par compte (et par compte auxiliaire)
function gaBalance(E){
  const B={};
  for(const e of E){const k=e.compte+(e.aux?'|'+e.aux:'');const b=B[k]=B[k]||{compte:e.compte,aux:e.aux,auxLib:e.auxLib,debit:0,credit:0};b.debit+=e.debit;b.credit+=e.credit;}
  return Object.values(B).map(b=>({...b,debit:gaR(b.debit),credit:gaR(b.credit),solde:gaR(b.debit-b.credit)})).sort((a,b)=>(a.compte+a.aux).localeCompare(b.compte+b.aux));
}
// Verrou des périodes clôturées
function gaClotureDe(eid){return(GA.clotures||[]).filter(c=>(c.entite_id||null)===(eid||null)).sort((a,b)=>String(b.date_fin).localeCompare(String(a.date_fin)))[0]||null;}
function gaVerrou(date,m){const c=gaClotureDe(m?(m.entite_id||gaEntiteDefautId()):GA.entiteF||gaEntiteDefautId())||gaClotureDe(null);return c&&gaIso(date)<=c.date_fin?c:null;}

// ── Écran ──────────────────────────────────────────────────────────
function gaComptaPeriode(){const an=GA.cptAn||new Date().getFullYear();return{an,from:`${an}-01-01`,to:`${an}-12-31`};}
function gaRenderCompta(){
  const{an,from,to}=gaComptaPeriode();const eid=GA.entiteF||((GA.entites||[]).length?gaEntiteDefautId():null);const tab=GA.cptTab||'balance';
  const E=gaEcritures(eid,from,to);const Ecum=gaEcritures(eid,null,to);
  const td=gaR(E.reduce((s,e)=>s+e.debit,0)),tc=gaR(E.reduce((s,e)=>s+e.credit,0));
  const cl=gaClotureDe(eid);const clos=cl&&cl.exercice>=an;
  const tabs=[['balance','Balance'],['journaux','Journaux'],['gl','Grand livre'],['proprios','Comptes propriétaires'],['locs','Comptes locataires'],['fonds','Représentation des fonds'],['cloture','Clôture & FEC']];
  let body='';
  if(tab==='balance'){const B=gaBalance(Ecum);const grp={};B.forEach(b=>{const k=b.compte.length===3?b.compte:b.compte;(grp[k]=grp[k]||{compte:k,debit:0,credit:0,n:0});grp[k].debit+=b.debit;grp[k].credit+=b.credit;grp[k].n++;});
    body=`<div style="font-size:.76rem;color:var(--td);margin-bottom:.5rem">Soldes cumulés au 31/12/${an}.</div><div style="overflow-x:auto"><table class="tbl" style="font-variant-numeric:tabular-nums"><thead><tr><th>Compte</th><th>Intitulé</th><th style="text-align:right">Débit</th><th style="text-align:right">Crédit</th><th style="text-align:right">Solde</th></tr></thead><tbody>
      ${Object.values(grp).map(g=>`<tr><td>${g.compte}</td><td>${gaE(gaCptLib(g.compte))}${g.n>1?` <span style="color:var(--td);font-size:.72rem">(${g.n} comptes)</span>`:''}</td><td style="text-align:right">${gaEur(g.debit)}</td><td style="text-align:right">${gaEur(g.credit)}</td><td style="text-align:right;font-weight:600">${gaEur(g.debit-g.credit)}</td></tr>`).join('')}
      <tr style="font-weight:700"><td colspan="2">Total</td><td style="text-align:right">${gaEur(Ecum.reduce((s,e)=>s+e.debit,0))}</td><td style="text-align:right">${gaEur(Ecum.reduce((s,e)=>s+e.credit,0))}</td><td></td></tr></tbody></table></div>`;}
  else if(tab==='journaux'){const j=GA.cptJ||'AP';const L=E.filter(e=>e.j===j);
    body=`<div style="display:flex;gap:.3rem;flex-wrap:wrap;margin-bottom:.6rem">${Object.entries(GA_JNX).map(([k,l])=>`<button class="btn ${k===j?'bp':'bg'} bsm" onclick="GA.cptJ='${k}';gaRender()">${k} · ${l} <span style="opacity:.7">${E.filter(e=>e.j===k).length}</span></button>`).join('')}</div>${gaCptTable(L.slice(0,800))}${L.length>800?`<div style="font-size:.72rem;color:var(--td)">800 premières lignes affichées — export complet dans « Clôture & FEC ».</div>`:''}`;}
  else if(tab==='gl'){const B=gaBalance(E);const c=GA.cptC||B[0]?.compte+'|'+(B[0]?.aux||'');
    const[cc,aa]=String(c).split('|');const L=E.filter(e=>e.compte===cc&&(e.aux||'')===(aa||''));let run=gaR(gaEcritures(eid,null,gaAddDays(from,-1)).filter(e=>e.compte===cc&&(e.aux||'')===(aa||'')).reduce((s,e)=>s+e.debit-e.credit,0));
    body=`<select class="fsel" style="max-width:420px;margin-bottom:.6rem" onchange="GA.cptC=this.value;gaRender()">${B.map(b=>`<option value="${b.compte}|${b.aux||''}" ${c===b.compte+'|'+(b.aux||'')?'selected':''}>${b.compte}${b.aux?' '+b.aux:''} — ${gaE(b.auxLib||gaCptLib(b.compte))}</option>`).join('')}</select>
      <div style="font-size:.78rem;margin-bottom:.4rem">Solde au 01/01/${an} : <strong>${gaEur(run)}</strong></div>
      <div style="overflow-x:auto;max-height:60vh"><table class="tbl" style="font-variant-numeric:tabular-nums"><thead><tr><th>Date</th><th>Jnl</th><th>Pièce</th><th>Libellé</th><th style="text-align:right">Débit</th><th style="text-align:right">Crédit</th><th style="text-align:right">Solde</th><th>Let.</th></tr></thead><tbody>
      ${L.map(e=>{run=gaR(run+e.debit-e.credit);return`<tr><td>${gaFrC(e.date)}</td><td>${e.j}</td><td style="font-size:.72rem">${gaE(e.piece)}</td><td style="font-size:.76rem">${gaE(e.lib)}</td><td style="text-align:right">${e.debit?gaEur(e.debit):''}</td><td style="text-align:right">${e.credit?gaEur(e.credit):''}</td><td style="text-align:right">${gaEur(run)}</td><td style="font-size:.7rem;color:var(--green)">${e.let||''}</td></tr>`;}).join('')}</tbody></table></div>`;}
  else if(tab==='proprios'){const B=gaBalance(Ecum).filter(b=>b.compte==='467');
    body=`<div style="font-size:.76rem;color:var(--td);margin-bottom:.5rem">Solde créditeur = somme due au propriétaire (à reverser). Débiteur = le propriétaire doit de l’argent à l’agence (avance de travaux…).</div><div style="overflow-x:auto"><table class="tbl" style="font-variant-numeric:tabular-nums"><thead><tr><th>Compte</th><th>Propriétaire</th><th style="text-align:right">Débit</th><th style="text-align:right">Crédit</th><th style="text-align:right">Dû au propriétaire</th></tr></thead><tbody>
      ${B.map(b=>`<tr style="cursor:pointer" onclick="GA.cptTab='gl';GA.cptC='467|${b.aux}';gaRender()"><td>467 ${b.aux}</td><td>${gaE(b.auxLib)}</td><td style="text-align:right">${gaEur(b.debit)}</td><td style="text-align:right">${gaEur(b.credit)}</td><td style="text-align:right;font-weight:600;color:${-b.solde<0?'var(--red)':'var(--txt)'}">${gaEur(-b.solde)}</td></tr>`).join('')}</tbody></table></div>`;}
  else if(tab==='locs'){const B=gaBalance(Ecum).filter(b=>b.compte==='411');
    body=`<div style="font-size:.76rem;color:var(--td);margin-bottom:.5rem">Solde débiteur = impayé du locataire. Les appels réglés sont lettrés avec leur encaissement.</div><div style="overflow-x:auto"><table class="tbl" style="font-variant-numeric:tabular-nums"><thead><tr><th>Compte</th><th>Locataire</th><th style="text-align:right">Appelé</th><th style="text-align:right">Réglé</th><th style="text-align:right">Reste dû</th><th>Non lettrés</th></tr></thead><tbody>
      ${B.map(b=>{const nl=Ecum.filter(e=>e.compte==='411'&&e.aux===b.aux&&!e.let&&e.debit).length;return`<tr style="cursor:pointer" onclick="GA.cptTab='gl';GA.cptC='411|${b.aux}';gaRender()"><td>411 ${b.aux}</td><td>${gaE(b.auxLib)}</td><td style="text-align:right">${gaEur(b.debit)}</td><td style="text-align:right">${gaEur(b.credit)}</td><td style="text-align:right;font-weight:600;color:${b.solde>0.01?'var(--red)':'var(--txt)'}">${gaEur(b.solde)}</td><td>${nl||''}</td></tr>`;}).join('')}</tbody></table></div>`;}
  else if(tab==='fonds')body=gaFondsHtml(eid);
  else body=gaClotureHtml(eid,an,E);
  return`<div style="display:flex;justify-content:space-between;align-items:flex-end;gap:1rem;flex-wrap:wrap;margin-bottom:.8rem">
    <div><div style="font-size:1.25rem;font-weight:700">Comptabilité mandant</div><div style="font-size:.8rem;color:var(--td);margin-top:.15rem">Exercice ${an}${(GA.entites||[]).length?` · ${gaE(gaEntite(eid)?.nom||'')}`:''} · ${E.length} lignes · débit ${gaEur(td)} = crédit ${gaEur(tc)} ${Math.abs(td-tc)<0.01?gaBadge('équilibré','b-green'):gaBadge('déséquilibre','b-red')} ${clos?gaBadge('clôturé','b-sea'):''}</div></div>
    <div style="display:flex;gap:.35rem;align-items:center"><button class="btn bg bsm" onclick="GA.cptAn=${an-1};gaRender()">‹</button><strong>${an}</strong><button class="btn bg bsm" onclick="GA.cptAn=${an+1};gaRender()">›</button></div></div>
  ${gaEntiteBar()}
  <div class="tabs" style="flex-wrap:wrap;margin-bottom:.8rem">${tabs.map(([k,l])=>`<button class="tab ${tab===k?'act':''}" onclick="GA.cptTab='${k}';gaRender()">${l}</button>`).join('')}</div>
  <div class="card"><div class="cb">${body}</div></div>`;
}
function gaCptTable(L){
  return`<div style="overflow-x:auto;max-height:60vh"><table class="tbl" style="font-variant-numeric:tabular-nums"><thead><tr><th>Date</th><th>N°</th><th>Pièce</th><th>Compte</th><th>Libellé</th><th style="text-align:right">Débit</th><th style="text-align:right">Crédit</th></tr></thead><tbody>
  ${L.map(e=>`<tr><td>${gaFrC(e.date)}</td><td>${e.num}</td><td style="font-size:.72rem">${gaE(e.piece)}</td><td style="font-size:.74rem">${e.compte}${e.aux?' '+e.aux:''}</td><td style="font-size:.76rem">${gaE(e.lib)}</td><td style="text-align:right">${e.debit?gaEur(e.debit):''}</td><td style="text-align:right">${e.credit?gaEur(e.credit):''}</td></tr>`).join('')}</tbody></table></div>`;
}
// ── Représentation des fonds (loi Hoguet, contrôle de la garantie financière) ──
function gaFonds(eid){
  const B=gaBalance(gaEcritures(eid,null,gaToday()));const s=c=>B.filter(b=>b.compte===c);
  const dusProp=gaR(s('467').filter(b=>b.solde<0).reduce((x,b)=>x-b.solde,0));
  const propDeb=gaR(s('467').filter(b=>b.solde>0).reduce((x,b)=>x+b.solde,0));
  const depots=gaR(-s('419100').reduce((x,b)=>x+b.solde,0));
  const hono=gaR(-s('467900').reduce((x,b)=>x+b.solde,0));
  const gli=gaR(-s('467800').reduce((x,b)=>x+b.solde,0));
  const locCred=gaR(s('411').filter(b=>b.solde<0).reduce((x,b)=>x-b.solde,0));
  const banqueCpt=gaR(s('512000').reduce((x,b)=>x+b.solde,0));
  const rel=typeof gaBkSolde==='function'?gaBkSolde():null;
  const fonds=gaR(dusProp+depots+hono+gli+locCred);
  return{dusProp,propDeb,depots,hono,gli,locCred,fonds,banqueCpt,banque:rel?+rel.montant:null,dateBanque:rel?.date||null};
}
function gaFondsHtml(eid){
  const f=gaFonds(eid);const couv=f.banque!=null?gaR(f.banque-f.fonds):null;
  const row=(l,v,b)=>`<tr${b?' style="font-weight:700"':''}><td>${l}</td><td style="text-align:right">${gaEur(v)}</td></tr>`;
  return`<div style="font-size:.78rem;color:var(--td);margin-bottom:.6rem;line-height:1.5">Les fonds détenus pour le compte des propriétaires et des locataires doivent être intégralement représentés par le solde du compte mandant (loi Hoguet). C’est l’état que demande la garantie financière lors de ses contrôles.</div>
  <table class="tbl" style="max-width:560px;font-variant-numeric:tabular-nums"><tbody>
    ${row('Sommes dues aux propriétaires (467 créditeurs)',f.dusProp)}${row('Dépôts de garantie détenus (419100)',f.depots)}${row('Honoraires non encore prélevés (467900)',f.hono)}${row('Primes GLI à reverser (467800)',f.gli)}${row('Trop-perçus locataires (411 créditeurs)',f.locCred)}
    ${row('Total des fonds à représenter',f.fonds,true)}
    ${row('Solde comptable du compte mandant (512000)',f.banqueCpt)}
    ${f.banque!=null?row(`Solde bancaire au ${gaFrC(f.dateBanque)} (relevé)`,f.banque,true):''}
  </tbody></table>
  ${couv!=null?`<div style="margin-top:.7rem;font-size:.9rem;font-weight:700;color:${couv>=-0.01?'var(--green)':'var(--red)'}">${couv>=-0.01?`Fonds couverts (excédent ${gaEur(couv)})`:`Insuffisance de représentation : ${gaEur(-couv)}`}</div>`:'<div style="margin-top:.6rem;font-size:.78rem;color:var(--gold)">Indiquez le solde du relevé dans la page Banque pour vérifier la couverture.</div>'}
  ${f.propDeb?`<div style="margin-top:.5rem;font-size:.76rem;color:var(--gold)">${gaEur(f.propDeb)} avancés pour des propriétaires débiteurs (à régulariser).</div>`:''}
  <button class="btn bg bsm" style="margin-top:.8rem" onclick="gaFondsPdf()"><i data-lucide=file-text class=ic></i> État de représentation des fonds (PDF)</button>`;
}
function gaFondsPdf(){
  const eid=GA.entiteF||gaEntiteDefautId();const f=gaFonds(eid);const couv=f.banque!=null?gaR(f.banque-f.fonds):null;
  gaDoc({m:eid?{entite_id:eid}:null,titre:`État de représentation des fonds au ${gaFr(gaToday())}`,fichier:`representation-fonds-${gaToday()}`,
    avant:['Fonds détenus pour le compte des mandants (loi n° 70-9 du 2 janvier 1970 et décret n° 72-678 du 20 juillet 1972).'],
    table:{head:['Rubrique','Montant'],widths:[124,50],align:['l','r'],rows:[['Sommes dues aux propriétaires',gaEur(f.dusProp)],['Dépôts de garantie détenus',gaEur(f.depots)],['Honoraires non prélevés',gaEur(f.hono)],['Primes GLI à reverser',gaEur(f.gli)],['Trop-perçus locataires',gaEur(f.locCred)]],
      foot:[['Total à représenter',gaEur(f.fonds)],['Solde comptable du compte mandant',gaEur(f.banqueCpt)],...(f.banque!=null?[[`Solde bancaire au ${gaFr(f.dateBanque)}`,gaEur(f.banque)],[couv>=-0.01?'Excédent':'Insuffisance',gaEur(Math.abs(couv))]]:[])]},
    apres:['Document établi à partir de la comptabilité mandant tenue dans Trouve Ton Toit.']});
}
// ── Clôture d'exercice et FEC ──────────────────────────────────────
function gaClotureHtml(eid,an,E){
  const cl=(GA.clotures||[]).find(c=>+c.exercice===an&&(c.entite_id||null)===(eid||null));
  const siren=gaAgence(eid?{entite_id:eid}:null).siren;
  return`<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:1rem">
    <div><div style="font-weight:700;margin-bottom:.3rem">Fichier des écritures comptables (FEC)</div>
      <div style="font-size:.78rem;color:var(--td);line-height:1.5;margin-bottom:.6rem">Format de l’article A.47 A-1 du livre des procédures fiscales, lisible par tous les logiciels comptables : à transmettre à l’expert-comptable.${siren?'':' <span style="color:var(--gold)">Renseignez le SIREN dans Paramètres pour nommer le fichier.</span>'}</div>
      <button class="btn bp bsm" onclick="gaFec(${an})"><i data-lucide=download class=ic></i> Télécharger le FEC ${an}</button>
      <button class="btn bg bsm" onclick="gaCptCsv(${an})"><i data-lucide=download class=ic></i> Grand livre (CSV)</button></div>
    <div><div style="font-weight:700;margin-bottom:.3rem">Clôture de l’exercice ${an}</div>
      ${cl?`<div style="font-size:.8rem">Clôturé le ${gaFrC(cl.created_at)}${cl.par?' par '+gaE(cl.par):''}. Les encaissements, reversements et opérations datés jusqu’au ${gaFrC(cl.date_fin)} ne peuvent plus être modifiés.</div>`
        :`<div style="font-size:.78rem;color:var(--td);line-height:1.5;margin-bottom:.6rem">Fige l’exercice : plus aucune écriture ne peut être ajoutée ou modifiée avant le 31/12/${an}. Les soldes sont conservés pour l’ouverture de ${an+1}.</div>
        <button class="btn bg bsm" ${gaToday()<=`${an}-12-31`?'disabled title="Possible après le 31 décembre"':''} onclick="gaCloturer(${an})"><i data-lucide=lock class=ic></i> Clôturer ${an}</button>`}</div></div>`;
}
function gaFec(an){
  const eid=GA.entiteF||((GA.entites||[]).length?gaEntiteDefautId():null);const E=gaEcritures(eid,`${an}-01-01`,`${an}-12-31`);
  if(!E.length){toast('Aucune écriture sur cet exercice');return;}
  const A=gaAgence(eid?{entite_id:eid}:null);const siren=(A.siren||'000000000').replace(/\D/g,'').padEnd(9,'0').slice(0,9);
  const d=x=>String(x||'').replace(/-/g,'');const a=v=>v.toFixed(2).replace('.',',');const c=s=>String(s??'').replace(/[\t\r\n|]/g,' ');
  const nums={};const head=['JournalCode','JournalLib','EcritureNum','EcritureDate','CompteNum','CompteLib','CompAuxNum','CompAuxLib','PieceRef','PieceDate','EcritureLib','Debit','Credit','EcritureLet','DateLet','ValidDate','Montantdevise','Idevise'];
  const lignes=E.map(e=>{nums[e.j]=nums[e.j]||{};const k=e.num;nums[e.j][k]=nums[e.j][k]||Object.keys(nums[e.j]).length+1;
    const cpt=e.compte.length===3?e.compte+'000':e.compte;
    return[e.j,GA_JNX[e.j],e.j+String(nums[e.j][k]).padStart(6,'0'),d(e.date),cpt,gaCptLib(e.compte),e.aux,e.auxLib,e.piece,d(e.date),e.lib,a(e.debit),a(e.credit),e.let||'',d(e.dateLet),d(e.date),'',''].map(c).join('\t');});
  const blob=new Blob([[head.join('\t'),...lignes].join('\r\n')],{type:'text/plain;charset=utf-8'});
  const u=URL.createObjectURL(blob);const l=document.createElement('a');l.href=u;l.download=`${siren}FEC${an}1231.txt`;document.body.appendChild(l);l.click();l.remove();setTimeout(()=>URL.revokeObjectURL(u),2000);
  toast(`FEC ${an} : ${E.length} lignes`);
}
function gaCptCsv(an){
  const eid=GA.entiteF||((GA.entites||[]).length?gaEntiteDefautId():null);const E=gaEcritures(eid,`${an}-01-01`,`${an}-12-31`);
  gaCsv(`grand-livre-${an}`,['Date','Journal','N°','Pièce','Compte','Auxiliaire','Libellé auxiliaire','Libellé','Débit','Crédit','Lettrage'],E.map(e=>[gaFrC(e.date),e.j,e.num,e.piece,e.compte,e.aux,e.auxLib,e.lib,e.debit.toFixed(2).replace('.',','),e.credit.toFixed(2).replace('.',','),e.let||'']));
}
async function gaCloturer(an){
  const eid=GA.entiteF||((GA.entites||[]).length?gaEntiteDefautId():null);
  if(!confirm(`Clôturer l’exercice ${an} ? Plus aucune écriture ne pourra être ajoutée ou modifiée jusqu’au 31/12/${an}. Pensez à télécharger le FEC avant.`))return;
  const soldes=gaBalance(gaEcritures(eid,null,`${an}-12-31`)).map(b=>({compte:b.compte,aux:b.aux,solde:b.solde}));
  const{data,error}=await sb.from('gestion_clotures').insert({agency_id:U.id,entite_id:eid,exercice:an,date_fin:`${an}-12-31`,soldes,par:gaMe()||'agence'}).select().single();
  if(error){toast(/relation|schema cache/i.test(error.message)?'Exécutez d’abord supabase-migration-gestion-agence.sql dans Supabase.':error.message);return;}
  (GA.clotures=GA.clotures||[]).push(data);toast(`Exercice ${an} clôturé`);gaRender();
}

// ════════════════════ Paiements SEPA : prélèvement des loyers et virements aux propriétaires ════════════════════
// Fichiers ISO 20022 acceptés par toutes les banques françaises (à déposer dans l'espace pro de la banque) :
//  • pain.001.001.03 : virements aux propriétaires (reversements)
//  • pain.008.001.02 : prélèvements SEPA CORE des loyers (mandats signés par les locataires)
// Le lot prélevé arrive en une seule ligne sur le relevé : la page Banque le reconnaît et solde chaque loyer.
const gaSepaTxt=(s,n)=>String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^A-Za-z0-9 \/\-?:().,'+]/g,' ').replace(/\s+/g,' ').trim().slice(0,n||70);
const gaSepaId=(p)=>(p+'-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,6)).toUpperCase().replace(/[^A-Z0-9-]/g,'').slice(0,35);
const gaXmlEsc=s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const gaAmt=n=>gaR(n).toFixed(2);
function gaDownload(name,txt,type){const u=URL.createObjectURL(new Blob([txt],{type:type||'application/xml'}));const a=document.createElement('a');a.href=u;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),2000);}
const gaBicXml=bic=>bic?`<FinInstnId><BIC>${gaXmlEsc(bic)}</BIC></FinInstnId>`:`<FinInstnId><Othr><Id>NOTPROVIDED</Id></Othr></FinInstnId>`;
// Prochain jour ouvré (les banques n'exécutent pas le week-end)
function gaJourOuvre(d){const x=new Date(d+'T12:00:00');while([0,6].includes(x.getDay()))x.setDate(x.getDate()+1);return gaIso(x);}

// ── Virements aux propriétaires (pain.001) ─────────────────────────
function gaSepaVirementsModal(){
  const E=gaAgence(GA.entiteF?{entite_id:GA.entiteF}:null);
  const os=gaOwners().map(o=>({o,s:gaR(Math.max(0,gaSolde(o.key)))})).filter(x=>x.s>0.009);
  if(!os.length){toast('Aucun montant à reverser');return;}
  gaModal(`<div style="font-size:1rem;font-weight:700;margin-bottom:.25rem"><i data-lucide=send class=ic></i> Virements SEPA aux propriétaires</div>
  <div style="font-size:.78rem;color:var(--td);margin-bottom:.8rem;line-height:1.5">Fichier de virements à déposer dans l’espace professionnel de votre banque (format SEPA XML). Compte débité : <strong>${gaE(E.iban?E.iban.replace(/(.{4})/g,'$1 ').trim():'compte mandant non renseigné')}</strong>${E.iban?'':' — <a href="#" onclick="gaCloseModal();gaGo({t:\'params\'});return false" style="color:var(--agencybright)">le renseigner</a>'}.</div>
  <div style="overflow-x:auto;max-height:50vh"><table class="tbl"><thead><tr><th></th><th>Propriétaire</th><th>IBAN</th><th style="text-align:right">Montant</th></tr></thead><tbody>
  ${os.map((x,i)=>{const ok=gaIbanOk(x.o.iban);return`<tr><td><input type="checkbox" class="gsv-c" data-i="${i}" ${ok?'checked':'disabled'}></td><td>${gaE(x.o.name)}</td><td style="font-size:.74rem;${ok?'':'color:var(--red)'}">${ok?gaE(x.o.iban):'IBAN '+(x.o.iban?'invalide':'manquant')}</td><td><input class="fi gsv-m" data-i="${i}" type="number" step="0.01" value="${x.s}" style="width:110px;text-align:right"></td></tr>`;}).join('')}</tbody></table></div>
  <div class="fgrid2" style="margin-top:.7rem"><div class="fg"><label class="fl">Date d’exécution</label><input class="fi" type="date" id="gsv-dt" value="${gaJourOuvre(gaAddDays(gaToday(),1))}"></div>
    <div class="fg"><label class="fl">Libellé du virement</label><input class="fi" id="gsv-lib" value="Gestion ${gaMoisLbl(GA.mois||gaYm(new Date()))}" maxlength="120"></div></div>
  <label style="display:flex;gap:.5rem;font-size:.8rem;margin-top:.4rem"><input type="checkbox" id="gsv-rec" checked> Enregistrer les reversements dans les comptes des propriétaires</label>
  <label style="display:flex;gap:.5rem;font-size:.8rem;margin-top:.3rem"><input type="checkbox" id="gsv-crg"> Envoyer le compte rendu de gestion avec chaque reversement</label>
  <div style="display:flex;justify-content:flex-end;gap:.5rem;margin-top:1rem"><button class="btn bg" onclick="gaCloseModal()">Annuler</button><button class="btn bp" onclick="gaSepaVirements()">Générer le fichier</button></div>`,true);
  GA._sepaVir=os;
}
async function gaSepaVirements(){
  const os=GA._sepaVir||[];const E=gaAgence(GA.entiteF?{entite_id:GA.entiteF}:null);
  if(!E.iban||!gaIbanOk(E.iban)){toast('Renseignez l’IBAN du compte mandant dans Paramètres');return;}
  const sel=[...document.querySelectorAll('.gsv-c:checked')].map(c=>{const i=+c.dataset.i;return{...os[i],mt:gaR(Number(document.querySelector(`.gsv-m[data-i="${i}"]`).value)||0)};}).filter(x=>x.mt>0);
  if(!sel.length){toast('Cochez au moins un propriétaire');return;}
  const dt=gaJourOuvre(gaV('gsv-dt')||gaToday());const lib=gaSepaTxt(gaV('gsv-lib')||'Gestion locative',140);const rec=gaC('gsv-rec'),crg=gaC('gsv-crg');
  const tot=gaR(sel.reduce((s,x)=>s+x.mt,0));const msg=gaSepaId('VIR');
  const tx=sel.map((x,k)=>`<CdtTrfTxInf><PmtId><EndToEndId>${gaXmlEsc((msg+'-'+(k+1)).slice(0,35))}</EndToEndId></PmtId><Amt><InstdAmt Ccy="EUR">${gaAmt(x.mt)}</InstdAmt></Amt><Cdtr><Nm>${gaXmlEsc(gaSepaTxt(x.o.name))}</Nm></Cdtr><CdtrAcct><Id><IBAN>${gaXmlEsc(x.o.iban.replace(/\s/g,'').toUpperCase())}</IBAN></Id></CdtrAcct><RmtInf><Ustrd>${gaXmlEsc(lib)}</Ustrd></RmtInf></CdtTrfTxInf>`).join('');
  const xml=`<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.001.001.03" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><CstmrCdtTrfInitn><GrpHdr><MsgId>${msg}</MsgId><CreDtTm>${new Date().toISOString().slice(0,19)}</CreDtTm><NbOfTxs>${sel.length}</NbOfTxs><CtrlSum>${gaAmt(tot)}</CtrlSum><InitgPty><Nm>${gaXmlEsc(gaSepaTxt(E.nom))}</Nm></InitgPty></GrpHdr><PmtInf><PmtInfId>${msg}-1</PmtInfId><PmtMtd>TRF</PmtMtd><BtchBookg>true</BtchBookg><NbOfTxs>${sel.length}</NbOfTxs><CtrlSum>${gaAmt(tot)}</CtrlSum><PmtTpInf><SvcLvl><Cd>SEPA</Cd></SvcLvl></PmtTpInf><ReqdExctnDt>${dt}</ReqdExctnDt><Dbtr><Nm>${gaXmlEsc(gaSepaTxt(E.nom))}</Nm></Dbtr><DbtrAcct><Id><IBAN>${gaXmlEsc(E.iban)}</IBAN></Id></DbtrAcct><DbtrAgt>${gaBicXml(E.bic)}</DbtrAgt><ChrgBr>SLEV</ChrgBr>${tx}</PmtInf></CstmrCdtTrfInitn></Document>`;
  gaDownload(`virements-proprietaires-${dt}.xml`,xml);
  try{const{data}=await sb.from('gestion_sepa_lots').insert({agency_id:U.id,entite_id:E.entite_id||null,type:'virement',reference:msg,date_execution:dt,total:tot,nb:sel.length,lignes:sel.map(x=>({owner_key:x.o.key,nom:x.o.name,iban:x.o.iban,montant:x.mt}))}).select().single();if(data)(GA.sepaLots=GA.sepaLots||[]).push(data);}catch(e){}
  if(rec)for(const x of sel){
    const{data,error}=await sb.from('gestion_operations').insert({agency_id:U.id,mandat_id:x.o.ms[0].id,date:dt,type:'reversement',libelle:`Reversement au propriétaire (virement SEPA ${msg})`,montant:-x.mt}).select().single();
    if(!error&&data){GA.ops.push(data);if(crg)await gaEnvoyerCrg(x.o.key,dt.slice(0,7),true);}
  }
  gaCloseModal();toast(`Fichier de ${sel.length} virement${sel.length>1?'s':''} (${gaEur(tot)}) généré${rec?' et reversements enregistrés':''}`);gaRender();
}

// ── Mandats de prélèvement des locataires ───────────────────────────
const gaSepaMandat=mid=>(GA.sepaMandats||[]).filter(s=>s.mandat_id===mid&&s.statut!=='revoque').sort((a,b)=>String(b.created_at).localeCompare(String(a.created_at)))[0]||null;
const gaSepaLien=s=>`${location.origin}/sepa.html?t=${s.token}`;
async function gaSepaCreer(mid,papier){
  const m=gaMandat(mid);const t=gaTen(m);const E=gaAgence(m);
  if(!E.ics){toast('Renseignez d’abord l’identifiant créancier SEPA (ICS) dans Paramètres');return null;}
  let s=gaSepaMandat(mid);
  if(!s){const rum=`TTT${String(m.numero||'').padStart(4,'0')}${Date.now().toString(36).toUpperCase()}`.slice(0,35);
    const{data,error}=await sb.from('gestion_sepa_mandats').insert({agency_id:U.id,mandat_id:mid,rum,titulaire:t?.nom||null,statut:'attente'}).select().single();
    if(error){toast(/relation|schema cache/i.test(error.message)?'Exécutez d’abord supabase-migration-gestion-agence.sql dans Supabase.':error.message);return null;}
    (GA.sepaMandats=GA.sepaMandats||[]).push(data);s=data;}
  return s;
}
async function gaSepaInviter(mid){
  const s=await gaSepaCreer(mid);if(!s)return;const m=gaMandat(mid);const t=gaTen(m);
  if(!t?.email){try{await navigator.clipboard.writeText(gaSepaLien(s));}catch(e){}toast('Pas d’e-mail locataire : lien du mandat copié');return;}
  const ok=await gaMail(t.email,`Prélèvement automatique de votre loyer — ${gaBien(m)}`,'Mandat de prélèvement SEPA',
    `<p>Bonjour ${gaE(t.nom)},</p><p>Pour ne plus avoir à faire de virement chaque mois, ${gaE(gaAgence(m).nom)} vous propose le <strong>prélèvement automatique</strong> de votre loyer à sa date d’échéance. Vous recevez toujours l’avis d’échéance quelques jours avant, et vous pouvez arrêter quand vous voulez.</p><p>Il suffit de signer le mandat en ligne avec votre IBAN (2 minutes).</p>`,
    {url:gaSepaLien(s),label:'Signer le mandat de prélèvement'});
  if(t.tenant_id)await gaMsg(t.tenant_id,m.listing_id,`Vous pouvez payer votre loyer par prélèvement automatique : signez le mandat ici ${gaSepaLien(s)}`);
  toast(ok?'Mandat envoyé au locataire':'E-mail non envoyé — lien copié');if(!ok){try{await navigator.clipboard.writeText(gaSepaLien(s));}catch(e){}}
}
function gaSepaPapierModal(mid){
  const m=gaMandat(mid);const t=gaTen(m);
  gaModal(`<div style="font-size:1rem;font-weight:700;margin-bottom:.3rem">Mandat SEPA signé sur papier</div>
  <div style="font-size:.78rem;color:var(--td);margin-bottom:.8rem">Recopiez le mandat signé par le locataire. Conservez l’original : il peut vous être demandé par la banque.</div>
  <div class="fgrid2"><div class="fg"><label class="fl">Titulaire du compte</label><input class="fi" id="gsp-tit" value="${gaE(t?.nom||'')}"></div>
  <div class="fg"><label class="fl">IBAN</label><input class="fi" id="gsp-iban" placeholder="FR76 …"></div>
  <div class="fg"><label class="fl">BIC (facultatif)</label><input class="fi" id="gsp-bic"></div>
  <div class="fg"><label class="fl">Date de signature</label><input class="fi" type="date" id="gsp-dt" value="${gaToday()}"></div></div>
  <div style="display:flex;justify-content:flex-end;gap:.5rem;margin-top:1rem"><button class="btn bg" onclick="gaCloseModal()">Annuler</button><button class="btn bp" onclick="gaSepaPapierSave('${mid}')">Enregistrer le mandat</button></div>`);
}
async function gaSepaPapierSave(mid){
  const iban=gaV('gsp-iban').replace(/\s+/g,'').toUpperCase();if(!gaIbanOk(iban)){toast('IBAN invalide');return;}
  const s=await gaSepaCreer(mid);if(!s)return;
  const upd={titulaire:gaV('gsp-tit')||null,iban,bic:gaV('gsp-bic').toUpperCase()||null,statut:'actif',signe_at:new Date(gaV('gsp-dt')+'T12:00:00').toISOString(),signe_par:'papier ('+(gaMe()||'agence')+')'};
  const{data,error}=await sb.from('gestion_sepa_mandats').update(upd).eq('id',s.id).select().single();if(error){toast(error.message);return;}
  Object.assign(s,data);gaCloseModal();toast('Mandat SEPA actif');gaRender();
}
async function gaSepaRevoquer(id){
  if(!confirm('Révoquer ce mandat de prélèvement ? Les prochains loyers ne seront plus prélevés.'))return;
  const s=(GA.sepaMandats||[]).find(x=>x.id===id);const{error}=await sb.from('gestion_sepa_mandats').update({statut:'revoque'}).eq('id',id);if(error){toast(error.message);return;}
  s.statut='revoque';toast('Mandat révoqué');gaRender();
}
// Bloc dans la fiche du bien (onglet Locataire)
function gaSepaBloc(m,t){
  if(!t)return'';const s=gaSepaMandat(m.id);
  return`<div class="card" style="margin-bottom:.8rem"><div class="cb" style="padding:.75rem 1rem">
    <div style="display:flex;justify-content:space-between;gap:.5rem;flex-wrap:wrap;align-items:center"><div style="font-weight:700;font-size:.86rem"><i data-lucide=repeat class=ic></i> Prélèvement automatique</div>
    ${s?.statut==='actif'?gaBadge('actif','b-green'):s?gaBadge('mandat envoyé, en attente de signature','b-gold'):''}</div>
    <div style="font-size:.78rem;color:var(--td);margin:.3rem 0 .5rem">${s?.statut==='actif'?`Mandat ${gaE(s.rum)} signé le ${gaFrC(s.signe_at)} · ${gaE(s.titulaire||'')} · ${gaE(String(s.iban||'').replace(/^(.{4}).*(.{4})$/,'$1 •••• $2'))}`:'Le loyer est prélevé à sa date d’échéance, après l’avis d’échéance. Fini les retards de virement.'}</div>
    <div style="display:flex;gap:.35rem;flex-wrap:wrap">${s?.statut==='actif'?`<button class="btn bg bsm" onclick="gaSepaRevoquer('${s.id}')">Révoquer</button>`
      :`<button class="btn bp bsm" onclick="gaSepaInviter('${m.id}')"><i data-lucide=send class=ic></i> ${s?'Renvoyer':'Proposer'} le prélèvement au locataire</button><button class="btn bg bsm" onclick="gaSepaPapierModal('${m.id}')">Mandat papier</button>`}</div>
  </div></div>`;
}

// ── Lots de prélèvement (pain.008) ─────────────────────────────────
function gaSepaAPrelever(ym){
  const dejas=new Set((GA.sepaLots||[]).filter(l=>l.type==='prelevement'&&l.statut!=='annule').flatMap(l=>(l.lignes||[]).map(x=>x.payment_id)));
  const out=[];
  for(const m of gaActifs()){const s=gaSepaMandat(m.id);if(s?.statut!=='actif')continue;
    for(const p of gaPays(m).filter(p=>gaUnpaid(p)&&String(p.due_date).slice(0,7)===ym&&!dejas.has(p.id)))out.push({m,p,s,t:gaTen(m)});}
  return out.sort((a,b)=>a.p.due_date.localeCompare(b.p.due_date));
}
function gaRenderPrelevements(){
  const ym=GA.mois||gaYm(new Date());const L=gaSepaAPrelever(ym);const actifs=(GA.sepaMandats||[]).filter(s=>s.statut==='actif').length;const attente=(GA.sepaMandats||[]).filter(s=>s.statut==='attente').length;
  const lots=(GA.sepaLots||[]).filter(l=>l.type==='prelevement').sort((a,b)=>String(b.created_at).localeCompare(String(a.created_at)));
  const E=gaAgence(GA.entiteF?{entite_id:GA.entiteF}:null);
  return`<div style="display:flex;justify-content:space-between;align-items:flex-end;gap:1rem;flex-wrap:wrap;margin-bottom:.8rem">
    <div><div style="font-size:1.25rem;font-weight:700">Prélèvements SEPA</div><div style="font-size:.8rem;color:var(--td);margin-top:.15rem">${actifs} mandat${actifs>1?'s':''} actif${actifs>1?'s':''}${attente?` · ${attente} en attente de signature`:''} · ICS ${gaE(E.ics||'non renseigné')}</div></div>
    <div style="display:flex;gap:.35rem;align-items:center"><button class="btn bg bsm" onclick="gaMois(-1)">‹</button><strong style="text-transform:capitalize;min-width:120px;text-align:center">${gaMoisLbl(ym)}</strong><button class="btn bg bsm" onclick="gaMois(1)">›</button></div></div>
  ${gaEntiteBar()}
  ${!E.ics||!E.iban?`<div class="card" style="margin-bottom:.9rem;border-color:rgba(232,160,32,.45)"><div class="cb" style="font-size:.82rem">Pour prélever, renseignez l’IBAN du compte mandant et l’identifiant créancier SEPA (ICS, fourni par votre banque). <button class="btn bp bsm" onclick="gaGo({t:'params'})">Paramètres</button></div></div>`:''}
  <div class="card" style="margin-bottom:.9rem"><div class="cb">
    <div style="display:flex;justify-content:space-between;gap:.5rem;flex-wrap:wrap;align-items:center;margin-bottom:.4rem"><div style="font-weight:700">Échéances à prélever en ${gaMoisLbl(ym)}</div>
      ${L.length?`<button class="btn bp bsm" onclick="gaSepaLot('${ym}')"><i data-lucide=download class=ic></i> Générer le fichier (${gaEur(L.reduce((s,x)=>s+gaReste(x.p),0))})</button>`:''}</div>
    ${L.length?`<div style="overflow-x:auto"><table class="tbl"><thead><tr><th></th><th>Locataire</th><th>Bien</th><th>Échéance</th><th>Type</th><th style="text-align:right">Montant</th></tr></thead><tbody>
      ${L.map((x,i)=>`<tr><td><input type="checkbox" class="gsl-c" data-i="${i}" checked></td><td>${gaE(x.t?.nom||'')}</td><td style="font-size:.76rem">${gaE(gaBien(x.m))}</td><td>${gaFrC(x.p.due_date)}</td><td>${x.s.premier_fait?'récurrent':'premier'}</td><td style="text-align:right">${gaEur(gaReste(x.p))}</td></tr>`).join('')}</tbody></table></div>`
      :`<div style="font-size:.8rem;color:var(--td)">Rien à prélever ce mois-ci. Proposez le prélèvement aux locataires depuis la fiche du bien (onglet Locataire) ou en envoi groupé.</div>`}
    <div style="font-size:.7rem;color:var(--td);margin-top:.5rem">Déposez le fichier dans l’espace professionnel de votre banque au moins 2 jours ouvrés avant la date de prélèvement. Le crédit global arrivera sur le relevé : la page Banque le reconnaît et solde chaque loyer.</div>
  </div></div>
  ${lots.length?`<div class="card"><div class="cb"><div style="font-weight:700;margin-bottom:.3rem">Lots envoyés</div>
    ${lots.map(l=>`<div style="display:flex;justify-content:space-between;gap:.5rem;flex-wrap:wrap;align-items:center;padding:.45rem 0;border-top:1px solid var(--b);font-size:.8rem">
      <span><strong>${gaFrC(l.date_execution)}</strong> · ${l.nb} prélèvement${l.nb>1?'s':''} · ${gaEur(l.total)} <span style="color:var(--td)">${gaE(l.reference||'')}</span> ${l.statut==='encaisse'?gaBadge('encaissé','b-green'):l.statut==='annule'?gaBadge('annulé',''):gaBadge('envoyé','b-gold')}</span>
      <span style="display:flex;gap:.3rem">${l.statut==='genere'?`<button class="btn bp bsm" onclick="gaSepaLotEncaisse('${l.id}')">Marquer encaissé</button><button class="btn bg bsm" onclick="gaSepaLotAnnuler('${l.id}')">Annuler</button>`:''}<button class="btn bg bsm" onclick="gaSepaLotDetail('${l.id}')">Détail</button></span></div>`).join('')}
  </div></div>`:''}`;
}
async function gaSepaLot(ym){
  const L=gaSepaAPrelever(ym);const sel=[...document.querySelectorAll('.gsl-c:checked')].map(c=>L[+c.dataset.i]);if(!sel.length){toast('Cochez au moins une échéance');return;}
  // Un fichier par société (compte et ICS propres)
  const parE={};sel.forEach(x=>{const k=x.m.entite_id||gaEntiteDefautId()||'_';(parE[k]=parE[k]||[]).push(x);});
  let n=0;
  for(const[k,xs]of Object.entries(parE)){
    const E=gaAgence(xs[0].m);if(!E.iban||!gaIbanOk(E.iban)||!E.ics){toast(`IBAN mandant ou ICS manquant pour ${E.nom} : renseignez-les dans Paramètres`);continue;}
    const msg=gaSepaId('PRLV');const groupes={FRST:xs.filter(x=>!x.s.premier_fait),RCUR:xs.filter(x=>x.s.premier_fait)};
    const minDt=gaJourOuvre(gaAddDays(gaToday(),2));
    const dt=x=>[gaJourOuvre(x.p.due_date),minDt].sort().pop();
    let pmts='';let idx=0;const lignes=[];
    for(const[seq,G]of Object.entries(groupes)){
      if(!G.length)continue;
      const parDate={};G.forEach(x=>{(parDate[dt(x)]=parDate[dt(x)]||[]).push(x);});
      for(const[d,X]of Object.entries(parDate)){
        idx++;const tot=gaR(X.reduce((s,x)=>s+gaReste(x.p),0));
        pmts+=`<PmtInf><PmtInfId>${msg}-${idx}</PmtInfId><PmtMtd>DD</PmtMtd><BtchBookg>true</BtchBookg><NbOfTxs>${X.length}</NbOfTxs><CtrlSum>${gaAmt(tot)}</CtrlSum><PmtTpInf><SvcLvl><Cd>SEPA</Cd></SvcLvl><LclInstrm><Cd>CORE</Cd></LclInstrm><SeqTp>${seq}</SeqTp></PmtTpInf><ReqdColltnDt>${d}</ReqdColltnDt><Cdtr><Nm>${gaXmlEsc(gaSepaTxt(E.nom))}</Nm></Cdtr><CdtrAcct><Id><IBAN>${gaXmlEsc(E.iban)}</IBAN></Id></CdtrAcct><CdtrAgt>${gaBicXml(E.bic)}</CdtrAgt><ChrgBr>SLEV</ChrgBr><CdtrSchmeId><Id><PrvtId><Othr><Id>${gaXmlEsc(E.ics)}</Id><SchmeNm><Prtry>SEPA</Prtry></SchmeNm></Othr></PrvtId></Id></CdtrSchmeId>`
          +X.map(x=>{const e2e=(msg+'-'+(lignes.length+1)).slice(0,35);lignes.push({payment_id:x.p.id,mandat_id:x.m.id,sepa_id:x.s.id,rum:x.s.rum,nom:x.t?.nom||'',montant:gaReste(x.p),date:d,seq,e2e});
            return`<DrctDbtTxInf><PmtId><EndToEndId>${gaXmlEsc(e2e)}</EndToEndId></PmtId><InstdAmt Ccy="EUR">${gaAmt(gaReste(x.p))}</InstdAmt><DrctDbtTx><MndtRltdInf><MndtId>${gaXmlEsc(x.s.rum)}</MndtId><DtOfSgntr>${gaIso(x.s.signe_at)}</DtOfSgntr></MndtRltdInf></DrctDbtTx><DbtrAgt>${gaBicXml(x.s.bic)}</DbtrAgt><Dbtr><Nm>${gaXmlEsc(gaSepaTxt(x.s.titulaire||x.t?.nom))}</Nm></Dbtr><DbtrAcct><Id><IBAN>${gaXmlEsc(x.s.iban)}</IBAN></Id></DbtrAcct><RmtInf><Ustrd>${gaXmlEsc(gaSepaTxt(`Loyer ${gaMoisLbl(String(x.p.due_date).slice(0,7))} ${gaBien(x.m)}`,140))}</Ustrd></RmtInf></DrctDbtTxInf>`;}).join('')+`</PmtInf>`;
      }
    }
    const tot=gaR(lignes.reduce((s,x)=>s+x.montant,0));
    const xml=`<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.008.001.02" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><CstmrDrctDbtInitn><GrpHdr><MsgId>${msg}</MsgId><CreDtTm>${new Date().toISOString().slice(0,19)}</CreDtTm><NbOfTxs>${lignes.length}</NbOfTxs><CtrlSum>${gaAmt(tot)}</CtrlSum><InitgPty><Nm>${gaXmlEsc(gaSepaTxt(E.nom))}</Nm></InitgPty></GrpHdr>${pmts}</CstmrDrctDbtInitn></Document>`;
    gaDownload(`prelevements-loyers-${ym}${Object.keys(parE).length>1?'-'+gaSepaTxt(E.nom,20).replace(/\s/g,'-'):''}.xml`,xml);
    const{data,error}=await sb.from('gestion_sepa_lots').insert({agency_id:U.id,entite_id:E.entite_id||null,type:'prelevement',reference:msg,date_execution:lignes.map(x=>x.date).sort()[0],total:tot,nb:lignes.length,lignes,statut:'genere'}).select().single();
    if(error){toast(error.message);continue;}(GA.sepaLots=GA.sepaLots||[]).push(data);
    // Le premier prélèvement est fait : les suivants sont « récurrents »
    for(const id of [...new Set(lignes.filter(x=>x.seq==='FRST').map(x=>x.sepa_id))]){await sb.from('gestion_sepa_mandats').update({premier_fait:true}).eq('id',id);const s=GA.sepaMandats.find(x=>x.id===id);if(s)s.premier_fait=true;}
    n+=lignes.length;
  }
  if(n)toast(`Fichier de ${n} prélèvement${n>1?'s':''} généré`);gaRender();
}
// Encaissement d'un lot (fait aussi depuis la page Banque quand le crédit global arrive)
async function gaSepaLotEncaisse(id,date,silent){
  const l=(GA.sepaLots||[]).find(x=>x.id===id);if(!l)return false;
  for(const x of l.lignes||[]){const ctx=gaPayCtx(x.payment_id);if(ctx?.p&&gaUnpaid(ctx.p))await gaBkPayer([ctx.p],x.montant,date||l.date_execution||gaToday());}
  await sb.from('gestion_sepa_lots').update({statut:'encaisse'}).eq('id',id);l.statut='encaisse';
  if(!silent){toast('Lot encaissé : loyers soldés');gaRender();}return true;
}
async function gaSepaLotAnnuler(id){if(!confirm('Annuler ce lot (fichier non envoyé à la banque) ?'))return;const l=GA.sepaLots.find(x=>x.id===id);await sb.from('gestion_sepa_lots').update({statut:'annule'}).eq('id',id);l.statut='annule';gaRender();}
function gaSepaLotDetail(id){
  const l=(GA.sepaLots||[]).find(x=>x.id===id);
  gaModal(`<div style="font-size:1rem;font-weight:700;margin-bottom:.5rem">Lot ${gaE(l.reference||'')} — ${gaFrC(l.date_execution)}</div>
  <div style="overflow-x:auto"><table class="tbl"><thead><tr><th>${l.type==='virement'?'Propriétaire':'Locataire'}</th><th style="text-align:right">Montant</th><th></th></tr></thead><tbody>
  ${(l.lignes||[]).map((x,i)=>`<tr><td>${gaE(x.nom||'')}</td><td style="text-align:right">${gaEur(x.montant)}</td><td>${l.type==='prelevement'&&l.statut==='encaisse'&&!x.rejet?`<button class="btn bg bsm" onclick="gaSepaRejet('${l.id}',${i})">Rejeté par la banque</button>`:x.rejet?gaBadge('rejeté','b-red'):''}</td></tr>`).join('')}</tbody></table></div>
  <div style="text-align:right;margin-top:.8rem"><button class="btn bp" onclick="gaCloseModal()">Fermer</button></div>`);
}
// Rejet d'un prélèvement : le loyer repasse impayé (les relances reprennent)
async function gaSepaRejet(id,i){
  const l=GA.sepaLots.find(x=>x.id===id);const x=l.lignes[i];const ctx=gaPayCtx(x.payment_id);
  if(!confirm(`Prélèvement de ${x.nom} rejeté (provision insuffisante, opposition…) ? Le loyer repasse impayé.`))return;
  if(ctx?.p){const tot=gaR(Math.max(0,(+ctx.p.amount_paid||0)-x.montant));const upd={amount_paid:tot,status:gaDays(ctx.p.due_date,gaToday())>0?'late':'pending'};if(!tot)upd.paid_at=null;await sb.from('payments').update(upd).eq('id',ctx.p.id);Object.assign(ctx.p,upd);}
  x.rejet=gaToday();await sb.from('gestion_sepa_lots').update({lignes:l.lignes}).eq('id',id);
  const m=gaMandat(x.mandat_id);const t=gaTen(m);if(t?.tenant_id)await gaMsg(t.tenant_id,m.listing_id,`Votre prélèvement de ${gaEur(x.montant)} a été rejeté par votre banque. Merci de régler ce montant par virement.`);
  gaCloseModal();toast('Rejet enregistré, loyer repassé impayé');gaRender();
}

// ════════════════════ Fiscalité des propriétaires : aide 2044 et TVA ════════════════════
// Revenus fonciers (location nue, commerces, bureaux, parkings) : montants à reporter sur la
// déclaration n° 2044, bien par bien. La location meublée relève des BIC (récapitulatif existant).
const GA_2044=[['211','Loyers bruts encaissés (hors charges)'],['215','Total des recettes'],['221','Frais d’administration et de gestion'],['222','Autres frais de gestion (20 € par local)'],
  ['223','Primes d’assurance'],['224','Travaux de réparation, d’entretien et d’amélioration'],['227','Taxes foncières (hors TEOM)'],['229','Provisions pour charges de copropriété payées'],
  ['240','Total frais et charges'],['261','Revenu foncier (avant intérêts d’emprunt)']];
function ga2044Bien(m,an){
  const t=gaTen(m);const inA=d=>String(d||'').startsWith(String(an));let l211=0,l221=0,l223=0;
  for(const p of gaPays(m)){const v=gaPaid(p);if(!v||!inA(p.paid_at))continue;const tt=t||{hc:+m.loc_loyer_hc||0,ch:+m.loc_charges||0,tva:gaTva(m)};l211+=gaSplit({amount:v},tt).hc;const h=gaHonor(m,p,v);l221+=h.hon;l223+=h.gli;}
  if(+m.frais_fixes>0)for(let k=1;k<=12;k++){const ym=`${an}-${String(k).padStart(2,'0')}`;const st=String(m.date_signature||m.created_at||'').slice(0,7);const fin=m.statut==='resilie'?String(m.date_resiliation||'9999').slice(0,7):'9999';if(ym>=st&&ym<=fin&&ym<=gaYm(new Date()))l221+=+m.frais_fixes;}
  const ops=GA.ops.filter(o=>o.mandat_id===m.id&&inA(o.date)&&+o.montant<0);const sum=f=>-ops.filter(f).reduce((s,o)=>s+(+o.montant||0),0);
  l223+=sum(o=>o.type==='assurance');
  const l224=sum(o=>o.type==='travaux');const l227=sum(o=>o.type==='taxe_fonciere');const l229=sum(o=>o.type==='copro'||(o.type==='frais'&&/syndic|copro|appel de fonds/i.test(o.libelle||'')));
  const l222=l211>0?20:0;const l240=l221+l222+l223+l224+l227+l229;
  const r={'211':l211,'215':l211,'221':l221,'222':l222,'223':l223,'224':l224,'227':l227,'229':l229,'240':l240,'261':l211-l240};
  Object.keys(r).forEach(k=>r[k]=gaR(r[k]));return r;
}
function ga2044(o,an){const biens=o.ms.filter(m=>gaTypeBail(m)!=='habitation_meuble');return{biens,cols:biens.map(m=>({m,v:ga2044Bien(m,an)}))};}
function ga2044Modal(key){
  const o=gaOwners().find(x=>x.key===key);const an=GA.annee;const{cols}=ga2044(o,an);
  const tot=k=>gaR(cols.reduce((s,c)=>s+c.v[k],0));
  gaModal(`<div style="font-size:1rem;font-weight:700;margin-bottom:.2rem">Aide à la déclaration 2044 — revenus ${an}</div>
  <div style="font-size:.76rem;color:var(--td);margin-bottom:.7rem">${gaE(o.name)} · ${cols.length} bien${cols.length>1?'s':''} en location nue, commerciale ou professionnelle. Les intérêts d’emprunt (ligne 250) et les dépenses payées directement par le propriétaire sont à ajouter par lui.</div>
  <div style="overflow-x:auto"><table class="tbl" style="font-variant-numeric:tabular-nums"><thead><tr><th>Ligne</th><th></th>${cols.map(c=>`<th style="text-align:right;font-size:.7rem">${gaE(gaBien(c.m))}</th>`).join('')}<th style="text-align:right">Total</th></tr></thead><tbody>
  ${GA_2044.map(([k,l])=>`<tr${['215','240','261'].includes(k)?' style="font-weight:700"':''}><td>${k}</td><td style="font-size:.76rem">${l}</td>${cols.map(c=>`<td style="text-align:right">${gaEur(c.v[k])}</td>`).join('')}<td style="text-align:right">${gaEur(tot(k))}</td></tr>`).join('')}
  </tbody></table></div>
  <div style="font-size:.7rem;color:var(--td);margin-top:.6rem;line-height:1.5">${tot('215')<=15000?`Recettes ≤ 15 000 € : le régime micro-foncier (abattement de 30 %, case 4BE de la déclaration 2042) est possible, sans 2044.`:'Recettes > 15 000 € : régime réel obligatoire (2044).'} Document d’aide établi à partir des opérations de l’agence ; il ne remplace pas le conseil d’un expert-comptable.</div>
  <div style="display:flex;justify-content:flex-end;gap:.5rem;margin-top:.9rem"><button class="btn bg" onclick="ga2044Pdf('${gaQ(key)}')"><i data-lucide=file-text class=ic></i> PDF</button><button class="btn bp" onclick="gaCloseModal()">Fermer</button></div>`,true);
}
function ga2044Pdf(key){
  const o=gaOwners().find(x=>x.key===key);const an=GA.annee;const{cols}=ga2044(o,an);const tot=k=>gaR(cols.reduce((s,c)=>s+c.v[k],0));
  gaDoc({m:o.ms[0],titre:`Aide à la déclaration des revenus fonciers ${an} (formulaire 2044)`,dest:[o.name,o.address],fichier:`aide-2044-${an}-${o.name.replace(/\W+/g,'-')}`,
    avant:[`Biens : ${cols.map(c=>gaBien(c.m)+' ('+gaAdresse(c.m)+')').join(' ; ')}.`],
    table:{head:['Ligne 2044','Montant'],widths:[124,50],align:['l','r'],rows:GA_2044.map(([k,l])=>[`${k} — ${l}`,gaEur(tot(k))])},
    apres:['Ligne 250 (intérêts d’emprunt) et dépenses réglées directement par vous : à compléter.',tot('215')<=15000?'Recettes inférieures à 15 000 € : le micro-foncier (case 4BE, abattement de 30 %) est possible.':'','Document d’aide établi à partir des opérations enregistrées par l’agence ; il ne remplace pas le conseil d’un expert-comptable.'].filter(Boolean)});
}
// TVA collectée sur les loyers soumis (commerces, bureaux) : base et TVA par trimestre
function gaTvaOwner(o,an){
  const Q=[1,2,3,4].map(q=>({q,ht:0,tva:0}));
  for(const m of o.ms.filter(m=>gaTva(m))){const t=gaTen(m)||{hc:+m.loc_loyer_hc||0,ch:+m.loc_charges||0,tva:gaTva(m)};
    for(const p of gaPays(m)){const v=gaPaid(p);if(!v||!String(p.paid_at||'').startsWith(String(an)))continue;const s=gaSplit({amount:v},t);const q=Q[Math.floor((+String(p.paid_at).slice(5,7)-1)/3)];q.ht+=s.hc+s.ch;q.tva+=s.tva;}}
  return Q.map(x=>({...x,ht:gaR(x.ht),tva:gaR(x.tva)}));
}
function gaTvaModal(key){
  const o=gaOwners().find(x=>x.key===key);const an=GA.annee;const Q=gaTvaOwner(o,an);
  gaModal(`<div style="font-size:1rem;font-weight:700;margin-bottom:.2rem">TVA sur les loyers — ${an}</div>
  <div style="font-size:.76rem;color:var(--td);margin-bottom:.7rem">${gaE(o.name)} a opté pour la TVA : montants encaissés à reporter sur ses déclarations (CA3 / CA12), TVA exigible à l’encaissement.</div>
  <table class="tbl" style="font-variant-numeric:tabular-nums"><thead><tr><th>Trimestre</th><th style="text-align:right">Base HT</th><th style="text-align:right">TVA collectée</th></tr></thead><tbody>
  ${Q.map(x=>`<tr><td>T${x.q} ${an}</td><td style="text-align:right">${gaEur(x.ht)}</td><td style="text-align:right">${gaEur(x.tva)}</td></tr>`).join('')}
  <tr style="font-weight:700"><td>Total</td><td style="text-align:right">${gaEur(Q.reduce((s,x)=>s+x.ht,0))}</td><td style="text-align:right">${gaEur(Q.reduce((s,x)=>s+x.tva,0))}</td></tr></tbody></table>
  <div style="text-align:right;margin-top:.9rem"><button class="btn bp" onclick="gaCloseModal()">Fermer</button></div>`);
}
// ── Espace propriétaire : lien personnel ─────────────────────────────
async function gaAccesProprio(key){
  const o=gaOwners().find(x=>x.key===key);if(!o)return;
  let a=(GA.acces||[]).find(x=>x.owner_key===key);
  if(!a){const{data,error}=await sb.from('gestion_proprio_acces').insert({agency_id:U.id,owner_key:key}).select().single();
    if(error){toast(/relation|schema cache/i.test(error.message)?'Exécutez d’abord supabase-migration-gestion-agence.sql dans Supabase.':error.message);return;}(GA.acces=GA.acces||[]).push(data);a=data;}
  const lien=`${location.origin}/proprietaire.html?t=${a.token}`;
  try{await navigator.clipboard.writeText(lien);}catch(e){}
  if(!o.email){toast('Pas d’e-mail pour ce propriétaire : lien copié, envoyez-le-lui');return;}
  if(!confirm(`Envoyer à ${o.name} (${o.email}) son accès à l’espace propriétaire ?\n\nIl y verra ses biens, ses loyers, son compte et ses documents, sans mot de passe. Le lien est aussi copié.`))return;
  const ok=await gaMail(o.email,`Votre espace propriétaire — ${gaAgence(o.ms[0]).nom}`,'Votre espace propriétaire en ligne',
    `<p>Bonjour ${gaE(o.name)},</p><p>Retrouvez à tout moment vos biens en gestion, l’état des loyers, votre compte (encaissements, honoraires, reversements), vos comptes rendus et l’aide à la déclaration de vos revenus fonciers.</p><p style="font-size:13px;color:#555">Ce lien est personnel : ne le transférez pas.</p>`,{url:lien,label:'Ouvrir mon espace'});
  await sb.from('gestion_proprio_acces').update({envoye_at:new Date().toISOString()}).eq('token',a.token);a.envoye_at=new Date().toISOString();
  toast(ok?'Accès envoyé au propriétaire (lien copié)':'E-mail non envoyé — lien copié');gaRender();
}

// ════════════════════ Assurances : bordereaux GLI et sinistres ════════════════════
const GA_SIN_T={impaye_gli:'Loyers impayés (GLI)',degat_eaux:'Dégât des eaux',incendie:'Incendie',vol:'Vol / effraction',bris:'Bris de glace',pno:'Sinistre propriétaire (PNO)',autre:'Autre'};
const GA_SIN_S={a_declarer:['À déclarer','b-gold'],declare:['Déclaré','b-sea'],expertise:['Expertise','b-sea'],indemnise:['Indemnisé','b-green'],refuse:['Refusé','b-red'],clos:['Clos','']};
// Bordereau mensuel par assureur GLI : loyers quittancés, encaissés, primes, impayés
function gaBordereau(assureur,ym){
  const from=ym+'-01',to=gaAddM(from,1);
  return gaActifs().filter(m=>m.gli&&(m.gli_assureur||'Assureur GLI')===assureur).map(m=>{
    const t=gaTen(m);const ps=gaPays(m).filter(p=>p.status!=='cancelled');
    const quit=gaR(ps.filter(p=>String(p.due_date).slice(0,7)===ym).reduce((s,p)=>s+(+p.amount||0),0));
    const encP=ps.filter(p=>{const d=gaIso(p.paid_at);return d&&d>=from&&d<to;});const enc=gaR(encP.reduce((s,p)=>s+gaPaid(p),0));
    const prime=gaR(encP.reduce((s,p)=>s+gaHonor(m,p,gaPaid(p)).gli,0));
    const imp=ps.filter(p=>gaUnpaid(p)&&p.due_date<to&&gaDays(p.due_date,gaToday())>0);
    return{m,t,quit,enc,prime,taux:+m.gli_taux||0,impaye:gaR(imp.reduce((s,p)=>s+gaReste(p),0)),premier:imp.map(p=>p.due_date).sort()[0]||null,declare:imp.some(p=>p.gli_declare_at)};
  });
}
function gaRenderAssurances(){
  const tab=GA.assTab||'gli';const ym=GA.mois||gaYm(new Date());
  const assureurs=[...new Set(gaActifs().filter(m=>m.gli).map(m=>m.gli_assureur||'Assureur GLI'))];
  let body='';
  if(tab==='gli'){
    body=assureurs.length?assureurs.map(a=>{const L=gaBordereau(a,ym);const b=(GA.bordereaux||[]).find(x=>x.assureur===a&&x.periode===ym);
      return`<div class="card" style="margin-bottom:.9rem"><div class="cb">
      <div style="display:flex;justify-content:space-between;gap:.5rem;flex-wrap:wrap;align-items:center;margin-bottom:.4rem"><div><strong>${gaE(a)}</strong> <span style="font-size:.76rem;color:var(--td)">· ${L.length} bail${L.length>1?'x':''} garanti${L.length>1?'s':''} · primes ${gaEur(L.reduce((s,x)=>s+x.prime,0))}</span> ${b?.envoye_at?gaBadge('envoyé le '+gaFrC(b.envoye_at),'b-green'):''}</div>
        <div style="display:flex;gap:.3rem;flex-wrap:wrap"><button class="btn bg bsm" onclick="gaBordereauCsv('${gaQ(a)}','${ym}')"><i data-lucide=download class=ic></i> CSV</button><button class="btn bg bsm" onclick="gaBordereauPdf('${gaQ(a)}','${ym}')"><i data-lucide=file-text class=ic></i> PDF</button>${b?.envoye_at?'':`<button class="btn bp bsm" onclick="gaBordereauEnvoye('${gaQ(a)}','${ym}')">Marquer envoyé</button>`}</div></div>
      <div style="overflow-x:auto"><table class="tbl" style="font-variant-numeric:tabular-nums"><thead><tr><th>Bien</th><th>Locataire</th><th style="text-align:right">Quittancé</th><th style="text-align:right">Encaissé</th><th style="text-align:right">Prime</th><th style="text-align:right">Impayé</th><th>Sinistre</th></tr></thead><tbody>
      ${L.map(x=>`<tr><td style="font-size:.78rem">${gaE(gaBien(x.m))}</td><td style="font-size:.78rem">${gaE(x.t?.nom||'vacant')}</td><td style="text-align:right">${gaEur(x.quit)}</td><td style="text-align:right">${gaEur(x.enc)}</td><td style="text-align:right">${gaEur(x.prime)}</td><td style="text-align:right;${x.impaye?'color:var(--red);font-weight:600':''}">${x.impaye?gaEur(x.impaye)+'<div style="font-size:.66rem;font-weight:400">depuis le '+gaFrC(x.premier)+'</div>':'—'}</td><td style="font-size:.74rem">${x.declare?gaBadge('déclaré','b-sea'):x.impaye?`<button class="btn bg bsm" onclick="gaSinistreModal(null,'${x.m.id}','impaye_gli')">Déclarer</button>`:''}</td></tr>`).join('')}</tbody></table></div>
      </div></div>`;}).join(''):`<div class="card"><div class="cb" style="font-size:.84rem;color:var(--td)">Aucun bien avec une assurance loyers impayés. Cochez « GLI » et indiquez l’assureur dans les réglages du bien.</div></div>`;
  }else{
    const S=(GA.sinistres||[]).filter(s=>!GA.entiteF||gaActifs().some(m=>m.id===s.mandat_id)).sort((a,b)=>String(b.created_at).localeCompare(String(a.created_at)));
    body=`<div style="display:flex;justify-content:flex-end;margin-bottom:.6rem"><button class="btn bp bsm" onclick="gaSinistreModal()">+ Déclarer un sinistre</button></div>
    ${S.length?`<div class="card"><div class="cb" style="padding:.4rem 1rem">${S.map(s=>{const m=gaMandat(s.mandat_id);const st=GA_SIN_S[s.statut]||[s.statut,''];return`<div style="display:flex;justify-content:space-between;gap:.6rem;flex-wrap:wrap;align-items:center;padding:.6rem 0;border-bottom:1px solid var(--b);cursor:pointer" onclick="gaSinistreModal('${s.id}')">
      <div style="font-size:.82rem"><strong>${gaE(GA_SIN_T[s.type]||s.type)}</strong> · ${gaE(m?gaBien(m):'—')}<div style="font-size:.72rem;color:var(--td)">${gaE(s.assureur||'')}${s.reference?' · réf. '+gaE(s.reference):''} · survenu le ${gaFrC(s.date_survenance)}${s.montant_reclame?' · réclamé '+gaEur(s.montant_reclame):''}${s.montant_indemnise?' · indemnisé '+gaEur(s.montant_indemnise):''}</div></div>${gaBadge(st[0],st[1])}</div>`;}).join('')}</div></div>`
      :`<div class="card"><div class="cb" style="font-size:.84rem;color:var(--td)">Aucun sinistre en cours.</div></div>`}`;
  }
  return`<div style="display:flex;justify-content:space-between;align-items:flex-end;gap:1rem;flex-wrap:wrap;margin-bottom:.8rem">
    <div><div style="font-size:1.25rem;font-weight:700">Assurances</div><div style="font-size:.8rem;color:var(--td);margin-top:.15rem">Bordereaux mensuels des assureurs loyers impayés et suivi des sinistres</div></div>
    ${tab==='gli'?`<div style="display:flex;gap:.35rem;align-items:center"><button class="btn bg bsm" onclick="gaMois(-1)">‹</button><strong style="text-transform:capitalize;min-width:120px;text-align:center">${gaMoisLbl(ym)}</strong><button class="btn bg bsm" onclick="gaMois(1)">›</button></div>`:''}</div>
  ${gaEntiteBar()}
  <div class="tabs" style="margin-bottom:.8rem"><button class="tab ${tab==='gli'?'act':''}" onclick="GA.assTab='gli';gaRender()">Bordereaux GLI</button><button class="tab ${tab==='sin'?'act':''}" onclick="GA.assTab='sin';gaRender()">Sinistres (${(GA.sinistres||[]).filter(s=>!['clos','refuse','indemnise'].includes(s.statut)).length})</button></div>${body}`;
}
function gaBordereauCsv(a,ym){
  const L=gaBordereau(a,ym);
  gaCsv(`bordereau-${a.replace(/\W+/g,'-')}-${ym}`,['Bien','Adresse','Locataire','Propriétaire','Loyer quittancé','Encaissé','Taux','Prime','Impayé','Premier impayé','Déclaré'],
    L.map(x=>[gaBien(x.m),gaAdresse(x.m),x.t?.nom||'',x.m.owner_name||'',x.quit.toFixed(2).replace('.',','),x.enc.toFixed(2).replace('.',','),x.taux,x.prime.toFixed(2).replace('.',','),x.impaye.toFixed(2).replace('.',','),x.premier?gaFrC(x.premier):'',x.declare?'oui':'']));
}
function gaBordereauPdf(a,ym){
  const L=gaBordereau(a,ym);const tot=k=>gaEur(L.reduce((s,x)=>s+x[k],0));
  gaDoc({m:L[0]?.m,titre:`Bordereau assurance loyers impayés — ${gaMoisLbl(ym)}`,dest:[a,''],fichier:`bordereau-gli-${ym}`,
    table:{head:['Bien / locataire','Quittancé','Encaissé','Prime','Impayé'],widths:[70,26,26,26,26],align:['l','r','r','r','r'],
      rows:L.map(x=>[`${gaBien(x.m)} — ${x.t?.nom||'vacant'}`,gaEur(x.quit),gaEur(x.enc),gaEur(x.prime),x.impaye?gaEur(x.impaye):'—']),foot:[['Total',tot('quit'),tot('enc'),tot('prime'),tot('impaye')]]},
    apres:['Primes calculées sur les loyers effectivement encaissés au cours du mois.']});
}
async function gaBordereauEnvoye(a,ym){
  const L=gaBordereau(a,ym);const row={agency_id:U.id,assureur:a,periode:ym,detail:L.map(x=>({mandat_id:x.m.id,quit:x.quit,enc:x.enc,prime:x.prime,impaye:x.impaye})),total_prime:gaR(L.reduce((s,x)=>s+x.prime,0)),envoye_at:new Date().toISOString()};
  const{data,error}=await sb.from('gestion_bordereaux').upsert(row,{onConflict:'agency_id,assureur,periode'}).select().single();
  if(error){toast(/relation|schema cache/i.test(error.message)?'Exécutez d’abord supabase-migration-gestion-agence.sql dans Supabase.':error.message);return;}
  GA.bordereaux=(GA.bordereaux||[]).filter(x=>!(x.assureur===a&&x.periode===ym));GA.bordereaux.push(data);toast('Bordereau marqué envoyé');gaRender();
}
function gaSinistreModal(id,mid,type){
  const s=id?(GA.sinistres||[]).find(x=>x.id===id):{mandat_id:mid||'',type:type||'degat_eaux',statut:'a_declarer',date_survenance:gaToday(),assureur:mid?(type==='impaye_gli'?gaMandat(mid)?.gli_assureur:''):''};
  if(!id&&type==='impaye_gli'&&mid){const m=gaMandat(mid);s.montant_reclame=gaR(gaPays(m).filter(p=>gaUnpaid(p)&&gaDays(p.due_date,gaToday())>0).reduce((x,p)=>x+gaReste(p),0));}
  gaModal(`<div style="font-size:1rem;font-weight:700;margin-bottom:.6rem">${id?'Sinistre':'Déclarer un sinistre'}</div>
  <div class="fgrid2">
    <div class="fg" style="grid-column:1/-1"><label class="fl">Bien</label><select class="fsel" id="gsi-m"><option value="">—</option>${gaActifs().map(m=>`<option value="${m.id}" ${m.id===s.mandat_id?'selected':''}>${gaE(gaBien(m)+' — '+(m.owner_name||''))}</option>`).join('')}</select></div>
    <div class="fg"><label class="fl">Type</label><select class="fsel" id="gsi-t">${Object.entries(GA_SIN_T).map(([k,l])=>`<option value="${k}" ${s.type===k?'selected':''}>${l}</option>`).join('')}</select></div>
    <div class="fg"><label class="fl">Statut</label><select class="fsel" id="gsi-s">${Object.entries(GA_SIN_S).map(([k,[l]])=>`<option value="${k}" ${s.statut===k?'selected':''}>${l}</option>`).join('')}</select></div>
    <div class="fg"><label class="fl">Assureur</label><input class="fi" id="gsi-a" value="${gaE(s.assureur||'')}"></div>
    <div class="fg"><label class="fl">N° de dossier</label><input class="fi" id="gsi-r" value="${gaE(s.reference||'')}"></div>
    <div class="fg"><label class="fl">Date du sinistre</label><input class="fi" type="date" id="gsi-ds" value="${s.date_survenance||''}"></div>
    <div class="fg"><label class="fl">Date de déclaration</label><input class="fi" type="date" id="gsi-dd" value="${s.date_declaration||''}"></div>
    <div class="fg"><label class="fl">Montant réclamé (€)</label><input class="fi" type="number" step="0.01" id="gsi-mr" value="${s.montant_reclame??''}"></div>
    <div class="fg"><label class="fl">Montant indemnisé (€)</label><input class="fi" type="number" step="0.01" id="gsi-mi" value="${s.montant_indemnise??''}"></div>
    <div class="fg" style="grid-column:1/-1"><label class="fl">Notes</label><textarea class="fi" id="gsi-n" rows="2">${gaE(s.notes||'')}</textarea></div></div>
  ${(s.historique||[]).length?`<div style="font-size:.72rem;color:var(--td);margin-top:.5rem">${s.historique.map(h=>`${gaFrC(h.at)} : ${gaE(h.l)}`).join('<br>')}</div>`:''}
  <div style="font-size:.7rem;color:var(--td);margin-top:.5rem">Une indemnité reçue s’enregistre en « Écriture » (crédit) sur le compte du propriétaire, ou se rapproche depuis la page Banque.</div>
  <div style="display:flex;justify-content:flex-end;gap:.5rem;margin-top:1rem"><button class="btn bg" onclick="gaCloseModal()">Annuler</button><button class="btn bp" onclick="gaSinistreSave(${id?`'${id}'`:'null'})">Enregistrer</button></div>`);
}
async function gaSinistreSave(id){
  const old=id?(GA.sinistres||[]).find(x=>x.id===id):null;
  const row={agency_id:U.id,mandat_id:gaV('gsi-m')||null,type:gaV('gsi-t'),statut:gaV('gsi-s'),assureur:gaV('gsi-a')||null,reference:gaV('gsi-r')||null,date_survenance:gaV('gsi-ds')||null,date_declaration:gaV('gsi-dd')||null,montant_reclame:gaN('gsi-mr'),montant_indemnise:gaN('gsi-mi'),notes:gaV('gsi-n')||null};
  if(row.statut==='declare'&&!row.date_declaration)row.date_declaration=gaToday();
  row.historique=[...(old?.historique||[]),...(!old||old.statut!==row.statut?[{at:new Date().toISOString(),l:(GA_SIN_S[row.statut]||[row.statut])[0]+(gaMe()?' — '+gaMe():'')}]:[])];
  const q=id?sb.from('gestion_sinistres').update(row).eq('id',id).select().single():sb.from('gestion_sinistres').insert(row).select().single();
  const{data,error}=await q;if(error){toast(/relation|schema cache/i.test(error.message)?'Exécutez d’abord supabase-migration-gestion-agence.sql dans Supabase.':error.message);return;}
  if(id)Object.assign(old,data);else(GA.sinistres=GA.sinistres||[]).push(data);
  // Impayé déclaré à la GLI : la date est aussi notée sur les loyers concernés (étapes du recouvrement)
  if(row.type==='impaye_gli'&&['declare','expertise','indemnise'].includes(row.statut)&&row.mandat_id){const m=gaMandat(row.mandat_id);
    for(const p of gaPays(m).filter(p=>gaUnpaid(p)&&!p.gli_declare_at&&gaDays(p.due_date,gaToday())>0)){const v=new Date().toISOString();await sb.from('payments').update({gli_declare_at:v}).eq('id',p.id);p.gli_declare_at=v;}}
  gaCloseModal();toast('Sinistre enregistré');gaRender();
}
// Sinistres dans la fiche du bien (onglet Travaux)
function gaSinistresBloc(m){
  const S=(GA.sinistres||[]).filter(s=>s.mandat_id===m.id);
  return`<div class="card" style="margin-bottom:.8rem"><div class="cb" style="padding:.7rem 1rem"><div style="display:flex;justify-content:space-between;align-items:center;gap:.5rem"><div style="font-weight:700;font-size:.86rem"><i data-lucide=shield-alert class=ic></i> Sinistres</div><button class="btn bg bsm" onclick="gaSinistreModal(null,'${m.id}')">+ Déclarer</button></div>
    ${S.map(s=>`<div style="display:flex;justify-content:space-between;gap:.5rem;font-size:.8rem;padding:.4rem 0;border-top:1px solid var(--b);margin-top:.35rem;cursor:pointer" onclick="gaSinistreModal('${s.id}')"><span>${gaE(GA_SIN_T[s.type]||s.type)} · ${gaFrC(s.date_survenance)}</span>${gaBadge(...(GA_SIN_S[s.statut]||[s.statut,'']))}</div>`).join('')||'<div style="font-size:.76rem;color:var(--td);margin-top:.3rem">Aucun sinistre.</div>'}
  </div></div>`;
}

// ════════════════════ Courriers types, envois groupés, signature électronique ════════════════════
const GA_MODELES=[
  {id:'att_loyer',nom:'Attestation de loyer à jour',dest:'locataire',objet:'Attestation de paiement des loyers',corps:'Madame, Monsieur,\n\nNous attestons que {locataire}, locataire du logement situé {adresse} depuis le {debut_bail}, est à jour du paiement de ses loyers et charges à la date du {date}.\n\nLe loyer mensuel s’élève à {total} charges comprises.\n\nCette attestation est délivrée pour servir et valoir ce que de droit.'},
  {id:'relance_amiable',nom:'Relance amiable',dest:'locataire',objet:'Loyer en attente de règlement',corps:'Madame, Monsieur,\n\nSauf erreur de notre part, nous n’avons pas reçu le règlement de {solde_du} dû au titre de votre location {adresse}.\n\nIl s’agit peut-être d’un simple oubli : nous vous remercions de procéder au règlement dès réception de ce courrier, ou de nous contacter si vous rencontrez une difficulté.'},
  {id:'assurance',nom:'Demande d’attestation d’assurance',dest:'locataire',objet:'Attestation d’assurance habitation',corps:'Madame, Monsieur,\n\nConformément à l’article 7 g) de la loi du 6 juillet 1989, nous vous remercions de nous transmettre l’attestation d’assurance habitation en cours de validité pour le logement {adresse}.\n\nVous pouvez nous l’adresser par e-mail ou la déposer dans votre espace locataire.'},
  {id:'visite',nom:'Avis de passage / visite technique',dest:'locataire',objet:'Visite du logement le {date_rdv}',corps:'Madame, Monsieur,\n\nNous vous informons qu’une visite du logement {adresse} aura lieu le {date_rdv}.\n\n{texte}\n\nMerci de nous indiquer rapidement si ce créneau ne vous convient pas ; nous fixerons ensemble une autre date.'},
  {id:'travaux_immeuble',nom:'Information travaux dans l’immeuble',dest:'locataire',objet:'Travaux prévus dans l’immeuble',corps:'Madame, Monsieur,\n\nNous vous informons que des travaux auront lieu dans l’immeuble situé {adresse} à partir du {date_rdv}.\n\n{texte}\n\nNous vous prions de nous excuser pour la gêne occasionnée.'},
  {id:'preavis_recu',nom:'Accusé de réception de congé',dest:'locataire',objet:'Votre congé du logement {adresse}',corps:'Madame, Monsieur,\n\nNous accusons réception de votre congé concernant le logement {adresse}.\n\n{texte}\n\nNous reviendrons vers vous pour fixer la date de l’état des lieux de sortie.'},
  {id:'info_proprio',nom:'Information aux propriétaires',dest:'proprietaire',objet:'{texte_objet}',corps:'Madame, Monsieur,\n\n{texte}\n\nNous restons à votre disposition pour tout renseignement.'},
  {id:'dpe_proprio',nom:'Rappel décence énergétique (DPE)',dest:'proprietaire',objet:'Performance énergétique de votre logement {bien}',corps:'Madame, Monsieur,\n\nLa loi Climat et Résilience interdit progressivement de louer les logements les plus énergivores (classe G depuis 2025, F en 2028, E en 2034), et gèle les loyers des logements classés F et G.\n\nNous vous proposons d’étudier ensemble les travaux possibles pour votre bien {bien} ({adresse}).'},
];
const gaModelesTous=()=>[...GA_MODELES,...(GA.modeles||[]).map(x=>({id:x.id,nom:x.nom,dest:x.destinataire,objet:x.objet,corps:x.corps,perso:true}))];
// Fusion des champs
function gaFusion(txt,m,extra){
  const t=gaTen(m)||{};const imp=gaPays(m).filter(p=>gaUnpaid(p)&&gaDays(p.due_date,gaToday())>0).reduce((s,p)=>s+gaReste(p),0);
  const V={locataire:t.nom||'',proprietaire:m.owner_name||'',bien:gaBien(m),adresse:gaAdresse(m),loyer:gaEur(t.hc||0),charges:gaEur(t.ch||0),total:gaEur((t.hc||0)+(t.ch||0)),
    solde_du:gaEur(imp),agence:gaAgence(m).nom,date:gaFr(gaToday()),debut_bail:t.debut?gaFr(t.debut):'',gestionnaire:gaMe()||gaAgence(m).nom,...(extra||{})};
  return String(txt||'').replace(/\{(\w+)\}/g,(x,k)=>V[k]!=null?V[k]:x);
}
function gaRenderCourriers(){
  const tab=GA.crTab||'envoi';
  const tabs=[['envoi','Envoi groupé'],['modeles','Modèles'],['signatures','Signatures électroniques'],['historique','Historique']];
  let body='';
  if(tab==='envoi')body=gaEnvoiForm();
  else if(tab==='modeles')body=`<div style="display:flex;justify-content:flex-end;margin-bottom:.6rem"><button class="btn bp bsm" onclick="gaModeleModal()">+ Nouveau modèle</button></div>
    <div class="card"><div class="cb" style="padding:.4rem 1rem">${gaModelesTous().map(x=>`<div style="display:flex;justify-content:space-between;gap:.5rem;align-items:center;padding:.55rem 0;border-bottom:1px solid var(--b)"><div style="font-size:.84rem"><strong>${gaE(x.nom)}</strong> <span style="font-size:.72rem;color:var(--td)">· ${x.dest==='proprietaire'?'propriétaires':'locataires'}${x.perso?' · personnalisé':''}</span></div>
      <div style="display:flex;gap:.3rem"><button class="btn bg bsm" onclick="GA.crTab='envoi';GA.crMod='${x.id}';gaRender()">Utiliser</button>${x.perso?`<button class="btn bg bsm" onclick="gaModeleModal('${x.id}')">Modifier</button>`:`<button class="btn bg bsm" onclick="gaModeleModal(null,'${x.id}')">Copier</button>`}</div></div>`).join('')}</div></div>
    <div style="font-size:.72rem;color:var(--td)">Champs disponibles : {locataire} {proprietaire} {bien} {adresse} {loyer} {charges} {total} {solde_du} {debut_bail} {agence} {gestionnaire} {date} {date_rdv} {texte}</div>`;
  else if(tab==='signatures')body=gaSignListe();
  else body=gaEnvoisHisto();
  return`<div style="font-size:1.25rem;font-weight:700;margin-bottom:.2rem">Courriers et signatures</div><div style="font-size:.8rem;color:var(--td);margin-bottom:.8rem">Courriers types envoyés en lot par e-mail ou imprimés, et documents à faire signer en ligne.</div>
  ${gaEntiteBar()}
  <div class="tabs" style="margin-bottom:.8rem;flex-wrap:wrap">${tabs.map(([k,l])=>`<button class="tab ${tab===k?'act':''}" onclick="GA.crTab='${k}';gaRender()">${l}</button>`).join('')}</div>${body}`;
}
function gaEnvoiForm(){
  const M=gaModelesTous();const mod=M.find(x=>x.id===GA.crMod)||M[0];const pro=mod.dest==='proprietaire';
  const f=GA.crFiltre||'tous';
  let L=pro?gaOwners().map(o=>({k:o.key,nom:o.name,email:o.email,m:o.ms[0],sous:o.ms.map(gaBien).join(', ')}))
    :gaActifs().filter(m=>gaTen(m)).map(m=>({k:m.id,nom:gaTen(m).nom,email:gaTen(m).email,m,sous:gaBien(m),imp:gaImpayes(m).length>0}));
  if(!pro&&f==='impayes')L=L.filter(x=>x.imp);
  return`<div class="card" style="margin-bottom:.8rem"><div class="cb">
    <div class="fgrid2"><div class="fg"><label class="fl">Modèle</label><select class="fsel" onchange="GA.crMod=this.value;gaRender()">${M.map(x=>`<option value="${x.id}" ${x.id===mod.id?'selected':''}>${gaE(x.nom)} (${x.dest==='proprietaire'?'propriétaires':'locataires'})</option>`).join('')}</select></div>
      <div class="fg"><label class="fl">Date / créneau {date_rdv}</label><input class="fi" id="gce-rdv" placeholder="mardi 4 novembre à 10 h"></div></div>
    <div class="fg"><label class="fl">Objet</label><input class="fi" id="gce-obj" value="${gaE(mod.objet)}"></div>
    <div class="fg"><label class="fl">Texte</label><textarea class="fi" id="gce-corps" rows="8" style="font-family:inherit">${gaE(mod.corps)}</textarea></div>
    <div class="fg"><label class="fl">Texte libre {texte}</label><textarea class="fi" id="gce-txt" rows="2"></textarea></div>
  </div></div>
  <div class="card" style="margin-bottom:.8rem"><div class="cb">
    <div style="display:flex;justify-content:space-between;gap:.5rem;flex-wrap:wrap;align-items:center;margin-bottom:.4rem"><div style="font-weight:700">Destinataires (${L.length})</div>
      <div style="display:flex;gap:.3rem;flex-wrap:wrap">${pro?'':`<button class="btn ${f==='tous'?'bp':'bg'} bsm" onclick="GA.crFiltre='tous';gaRender()">Tous</button><button class="btn ${f==='impayes'?'bp':'bg'} bsm" onclick="GA.crFiltre='impayes';gaRender()">Impayés</button>`}
      <button class="btn bg bsm" onclick="document.querySelectorAll('.gce-c').forEach(c=>c.checked=true)">Tout cocher</button><button class="btn bg bsm" onclick="document.querySelectorAll('.gce-c').forEach(c=>c.checked=false)">Tout décocher</button></div></div>
    <div style="max-height:40vh;overflow:auto">${L.map((x,i)=>`<label style="display:flex;gap:.55rem;align-items:center;padding:.35rem 0;border-top:1px solid var(--b);font-size:.82rem;cursor:pointer"><input type="checkbox" class="gce-c" data-k="${gaE(x.k)}" checked> <span style="flex:1"><strong>${gaE(x.nom)}</strong> <span style="color:var(--td)">· ${gaE(x.sous)}</span></span><span style="font-size:.72rem;color:${x.email?'var(--td)':'var(--gold)'}">${x.email?gaE(x.email):'pas d’e-mail : PDF seulement'}</span></label>`).join('')||'<div style="font-size:.8rem;color:var(--td)">Aucun destinataire.</div>'}</div>
  </div></div>
  <div style="display:flex;justify-content:flex-end;gap:.5rem;flex-wrap:wrap"><button class="btn bg" onclick="gaEnvoiApercu()"><i data-lucide=eye class=ic></i> Aperçu</button><button class="btn bg" onclick="gaEnvoiGroupe('pdf')"><i data-lucide=printer class=ic></i> PDF à imprimer</button><button class="btn bp" onclick="gaEnvoiGroupe('mail')"><i data-lucide=send class=ic></i> Envoyer par e-mail</button></div>`;
}
function gaEnvoiSel(){
  const mod=gaModelesTous().find(x=>x.id===GA.crMod)||gaModelesTous()[0];const pro=mod.dest==='proprietaire';const ks=new Set([...document.querySelectorAll('.gce-c:checked')].map(c=>c.dataset.k));
  const extra={date_rdv:gaV('gce-rdv'),texte:gaV('gce-txt'),texte_objet:gaV('gce-obj')};
  const L=pro?gaOwners().filter(o=>ks.has(o.key)).map(o=>({m:o.ms[0],nom:o.name,email:o.email,adresse:o.address,extra:{...extra,bien:o.ms.map(gaBien).join(', ')}}))
    :gaActifs().filter(m=>ks.has(m.id)).map(m=>({m,nom:gaTen(m)?.nom,email:gaTen(m)?.email,adresse:gaAdresse(m),extra}));
  return{mod,L:L.map(x=>({...x,objet:gaFusion(gaV('gce-obj'),x.m,x.extra),corps:gaFusion(gaV('gce-corps'),x.m,x.extra)}))};
}
function gaEnvoiApercu(){const{L}=gaEnvoiSel();if(!L.length){toast('Cochez au moins un destinataire');return;}const x=L[0];
  gaModal(`<div style="font-size:.72rem;color:var(--td);margin-bottom:.4rem">Aperçu pour ${gaE(x.nom)}</div><div style="font-weight:700;margin-bottom:.5rem">Objet : ${gaE(x.objet)}</div><div style="font-size:.86rem;white-space:pre-wrap;line-height:1.6">${gaE(x.corps)}</div><div style="text-align:right;margin-top:1rem"><button class="btn bp" onclick="gaCloseModal()">Fermer</button></div>`);}
async function gaEnvoiGroupe(mode){
  const{mod,L}=gaEnvoiSel();if(!L.length){toast('Cochez au moins un destinataire');return;}
  if(mode==='pdf'){gaDocMulti(L);await gaEnvoisLog(mod,L,'courrier');return;}
  const avec=L.filter(x=>x.email),sans=L.filter(x=>!x.email);
  if(!confirm(`Envoyer « ${mod.nom} » par e-mail à ${avec.length} destinataire${avec.length>1?'s':''} ?${sans.length?`\n${sans.length} sans e-mail : un PDF sera généré pour eux.`:''}`))return;
  let n=0;for(const x of avec){const ok=await gaMail(x.email,x.objet,x.objet,x.corps.split(/\n\n+/).map(p=>`<p>${gaE(p).replace(/\n/g,'<br>')}</p>`).join(''));if(ok)n++;}
  await gaEnvoisLog(mod,avec,'e-mail');if(sans.length){gaDocMulti(sans);await gaEnvoisLog(mod,sans,'courrier');}
  toast(`${n} e-mail${n>1?'s':''} envoyé${n>1?'s':''}${sans.length?` · ${sans.length} courrier${sans.length>1?'s':''} en PDF`:''}`);
}
async function gaEnvoisLog(mod,L,canal){
  try{await sb.from('gestion_envois').insert(L.map(x=>({agency_id:U.id,modele:mod.nom+' ('+canal+')',mandat_id:x.m?.id||null,destinataire:x.nom,email:x.email||null,objet:x.objet,par:gaMe()||'agence'})));}catch(e){}
}
// Plusieurs courriers dans un seul PDF (une page par destinataire)
function gaDocMulti(L){
  gaPdf(jsPDF=>{
    const d=new jsPDF({unit:'mm',format:'a4'});const W=210,M=18;
    const t=s=>String(s??'').replace(/[  ]/g,' ').replace(/[’]/g,"'").replace(/[«»]/g,'"').replace(/[—–]/g,'-').replace(/…/g,'...').replace(/€/g,'EUR').replace(/œ/g,'oe');
    L.forEach((x,i)=>{if(i)d.addPage();let y=18;const A=gaAgence(x.m);
      d.setFont('helvetica','bold');d.setFontSize(13);d.text(t(A.nom),M,y);y+=5;d.setFont('helvetica','normal');d.setFontSize(8.5);
      [A.adresse,A.tel,A.carte?`Carte professionnelle n° ${A.carte}`:''].filter(Boolean).forEach(l=>{d.text(t(l),M,y);y+=3.8;});
      let yy=34;d.setFontSize(10);d.setFont('helvetica','bold');d.text(t(x.nom||''),120,yy);d.setFont('helvetica','normal');d.splitTextToSize(t(x.adresse||''),75).forEach(s=>{yy+=4.6;d.text(s,120,yy);});
      y=Math.max(y,yy)+10;d.text(t(`Le ${gaFr(gaToday())}`),120,y);y+=10;
      d.setFont('helvetica','bold');d.splitTextToSize(t('Objet : '+x.objet),W-2*M).forEach(s=>{d.text(s,M,y);y+=5;});y+=3;d.setFont('helvetica','normal');
      x.corps.split(/\n\n+/).forEach(p=>{d.splitTextToSize(t(p),W-2*M).forEach(s=>{if(y>275){d.addPage();y=20;}d.text(s,M,y);y+=5;});y+=2.5;});
      y+=6;d.text(t(A.nom),120,y);
    });
    d.save(`courriers-${gaToday()}.pdf`);
  });
}
function gaEnvoisHisto(){
  return`<div class="card"><div class="cb" id="gce-histo"><div style="font-size:.8rem;color:var(--td)">Chargement…</div></div></div>${setTimeout(async()=>{const el=document.getElementById('gce-histo');if(!el)return;
    const{data}=await sb.from('gestion_envois').select('*').eq('agency_id',U.id).order('created_at',{ascending:false}).limit(300);
    el.innerHTML=(data||[]).length?`<div style="overflow-x:auto"><table class="tbl"><thead><tr><th>Date</th><th>Courrier</th><th>Destinataire</th><th>Par</th></tr></thead><tbody>${data.map(x=>`<tr><td>${gaFrC(x.created_at)}</td><td style="font-size:.78rem">${gaE(x.objet||x.modele)}<div style="color:var(--td);font-size:.7rem">${gaE(x.modele)}</div></td><td style="font-size:.78rem">${gaE(x.destinataire||'')}<div style="color:var(--td);font-size:.7rem">${gaE(x.email||'')}</div></td><td style="font-size:.76rem">${gaE(x.par||'')}</td></tr>`).join('')}</tbody></table></div>`:'<div style="font-size:.8rem;color:var(--td)">Aucun envoi pour l’instant.</div>';},0),''}`;
}
function gaModeleModal(id,copie){
  const x=id?gaModelesTous().find(m=>m.id===id):copie?{...gaModelesTous().find(m=>m.id===copie),nom:gaModelesTous().find(m=>m.id===copie).nom+' (copie)'}:{nom:'',dest:'locataire',objet:'',corps:''};
  gaModal(`<div style="font-size:1rem;font-weight:700;margin-bottom:.6rem">${id?'Modifier le':'Nouveau'} modèle</div>
  <div class="fgrid2"><div class="fg"><label class="fl">Nom</label><input class="fi" id="gmo-n" value="${gaE(x.nom)}"></div><div class="fg"><label class="fl">Destinataires</label><select class="fsel" id="gmo-d"><option value="locataire">Locataires</option><option value="proprietaire" ${x.dest==='proprietaire'?'selected':''}>Propriétaires</option></select></div></div>
  <div class="fg"><label class="fl">Objet</label><input class="fi" id="gmo-o" value="${gaE(x.objet)}"></div>
  <div class="fg"><label class="fl">Texte</label><textarea class="fi" id="gmo-c" rows="10" style="font-family:inherit">${gaE(x.corps)}</textarea></div>
  <div style="display:flex;justify-content:space-between;gap:.5rem;margin-top:1rem"><div>${id?`<button class="btn bg" onclick="gaModeleSuppr('${id}')">Supprimer</button>`:''}</div><div style="display:flex;gap:.5rem"><button class="btn bg" onclick="gaCloseModal()">Annuler</button><button class="btn bp" onclick="gaModeleSave(${id?`'${id}'`:'null'})">Enregistrer</button></div></div>`,true);
}
async function gaModeleSave(id){
  const row={agency_id:U.id,nom:gaV('gmo-n'),destinataire:gaV('gmo-d'),objet:gaV('gmo-o'),corps:document.getElementById('gmo-c').value};
  if(!row.nom||!row.corps){toast('Nom et texte obligatoires');return;}
  const q=id?sb.from('gestion_modeles').update(row).eq('id',id).select().single():sb.from('gestion_modeles').insert(row).select().single();
  const{data,error}=await q;if(error){toast(/relation|schema cache/i.test(error.message)?'Exécutez d’abord supabase-migration-gestion-agence.sql dans Supabase.':error.message);return;}
  GA.modeles=(GA.modeles||[]).filter(x=>x.id!==data.id);GA.modeles.push(data);gaCloseModal();toast('Modèle enregistré');gaRender();
}
async function gaModeleSuppr(id){if(!confirm('Supprimer ce modèle ?'))return;await sb.from('gestion_modeles').delete().eq('id',id);GA.modeles=(GA.modeles||[]).filter(x=>x.id!==id);gaCloseModal();gaRender();}

// ── Signature électronique ─────────────────────────────────────────
// Signature électronique simple (règlement eIDAS, art. 25 ; art. 1366-1367 du Code civil) :
// identité par lien personnel envoyé par e-mail, consentement explicite, horodatage, empreinte
// SHA-256 du document vérifiée au moment de chaque signature, dossier de preuve dans le PDF.
async function gaSha256(txt){const b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(txt));return[...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('');}
const gaTok=()=>[...crypto.getRandomValues(new Uint8Array(16))].map(x=>x.toString(16).padStart(2,'0')).join('');
function gaMandatHtml(m){
  const A=gaAgence(m);const e=s=>gaE(s||'—');
  return`<h2>Mandat de gestion locative n° ${e(m.numero)}</h2>
<p><strong>Entre</strong> ${e(m.owner_name)}, demeurant ${e(m.owner_address)}, ci-après « le Mandant »,</p>
<p><strong>et</strong> ${e(A.nom)}, ${e(A.adresse)}, titulaire de la carte professionnelle « gestion immobilière » n° ${e(A.carte)}${A.cci?' délivrée par '+e(A.cci):''}, garantie financière : ${e(A.garantie)}, ci-après « le Mandataire ».</p>
<h3>1. Objet</h3><p>Le Mandant confie au Mandataire, qui l’accepte, la gestion du bien suivant : ${e(gaBien(m))}, ${e(gaAdresse(m))} (${e(GA_BAUX[gaTypeBail(m)]?.l)}).</p>
<h3>2. Missions</h3><p>Le Mandataire pourra : rechercher des locataires et signer les baux ; établir les états des lieux ; encaisser les loyers, charges et dépôts de garantie et en donner quittance ; réviser les loyers et régulariser les charges ; relancer les locataires défaillants et, avec l’accord du Mandant, engager les procédures ; faire exécuter les réparations urgentes et, au-delà de ${gaEur(m.seuil_travaux||0)}, avec l’accord du Mandant ; déclarer les sinistres ; donner congé et restituer les dépôts de garantie.</p>
<h3>3. Rémunération</h3><p>Honoraires de gestion : ${e(m.taux_honoraires)} % TTC des sommes encaissées (${m.base_honoraires==='hc'?'loyer hors charges':'loyer et charges'})${+m.frais_fixes?`, plus ${gaEur(m.frais_fixes)} TTC par mois`:''}.${m.gli?` Assurance loyers impayés${m.gli_assureur?' ('+e(m.gli_assureur)+')':''} : ${e(m.gli_taux)} % des sommes encaissées.`:''}</p>
<h3>4. Reddition des comptes</h3><p>Le Mandataire adresse chaque mois un compte rendu de gestion et reverse les sommes dues au plus tard le ${e(m.reversement_jour)} du mois suivant leur encaissement${m.owner_iban?', sur le compte '+e(m.owner_iban):''}. Les fonds sont détenus sur le compte mandant du Mandataire, couvert par sa garantie financière.</p>
<h3>5. Durée</h3><p>Le présent mandat prend effet le ${e(gaFr(m.date_signature||gaToday()))} pour une durée de ${e(m.duree_mois)} mois${m.tacite?', renouvelable par tacite reconduction, dans la limite de 30 ans':''}. Chaque partie peut y mettre fin à chaque échéance par lettre recommandée avec avis de réception, avec un préavis de 3 mois.</p>
<h3>6. Registre des mandats</h3><p>Mandat inscrit sous le n° ${e(m.numero)} au registre des mandats du Mandataire (loi n° 70-9 du 2 janvier 1970 et décret n° 72-678 du 20 juillet 1972).</p>`;
}
const GA_SIGN_TYPES={mandat:'Mandat de gestion',avenant_mandat:'Avenant au mandat de gestion',avenant_bail:'Avenant au bail',autre:'Autre document'};
function gaSignModal(mid,type){
  const m=gaMandat(mid);const t=gaTen(m);type=type||'mandat';
  const pourLoc=type==='avenant_bail';
  gaModal(`<div style="font-size:1rem;font-weight:700;margin-bottom:.4rem"><i data-lucide=pen-line class=ic></i> Faire signer en ligne</div>
  <div class="fgrid2"><div class="fg"><label class="fl">Document</label><select class="fsel" id="gsg-type" onchange="gaSignModal('${mid}',this.value)">${Object.entries(GA_SIGN_TYPES).map(([k,l])=>`<option value="${k}" ${k===type?'selected':''}>${l}</option>`).join('')}</select></div>
    <div class="fg"><label class="fl">Titre</label><input class="fi" id="gsg-titre" value="${gaE(type==='mandat'?`Mandat de gestion n° ${m.numero} — ${gaBien(m)}`:`${GA_SIGN_TYPES[type]} — ${gaBien(m)}`)}"></div></div>
  ${type==='mandat'?`<div style="font-size:.78rem;color:var(--td);margin:.2rem 0 .4rem">Le mandat est rédigé à partir des réglages du bien. <a href="#" onclick="gaModal('<div style=&quot;font-size:.84rem;line-height:1.55&quot;>'+gaMandatHtml(gaMandat('${mid}'))+'</div><div style=&quot;text-align:right;margin-top:1rem&quot;><button class=&quot;btn bp&quot; onclick=&quot;gaSignModal(\\'${mid}\\',\\'mandat\\')&quot;>Retour</button></div>',true);return false" style="color:var(--agencybright)">Voir le texte</a></div>`
    :`<div class="fg"><label class="fl">Texte du document</label><textarea class="fi" id="gsg-texte" rows="8" style="font-family:inherit" placeholder="Il est convenu entre les parties que…"></textarea></div>`}
  <div class="fgrid2"><div class="fg"><label class="fl">${pourLoc?'Locataire':'Propriétaire'} (signataire)</label><input class="fi" id="gsg-nom" value="${gaE(pourLoc?t?.nom:m.owner_name)}"></div><div class="fg"><label class="fl">Son e-mail</label><input class="fi" id="gsg-mail" type="email" value="${gaE(pourLoc?t?.email:m.owner_email)}"></div></div>
  <div style="font-size:.78rem;font-weight:700;margin:.6rem 0 .3rem">Votre signature (${gaE(gaAgence(m).nom)})</div>
  <canvas id="gsg-pad" width="520" height="140" style="width:100%;max-width:520px;height:140px;border:1px dashed var(--b2);border-radius:10px;background:#fff;touch-action:none"></canvas>
  <div style="display:flex;justify-content:space-between;align-items:center;gap:.5rem;flex-wrap:wrap"><button class="btn bg bsm" onclick="gaPadClear()">Effacer</button><span style="font-size:.7rem;color:var(--td)">Signature électronique simple : lien personnel, consentement, horodatage et empreinte du document.</span></div>
  <div style="display:flex;justify-content:flex-end;gap:.5rem;margin-top:1rem"><button class="btn bg" onclick="gaCloseModal()">Annuler</button><button class="btn bp" onclick="gaSignCreer('${mid}')">Signer et envoyer</button></div>`,true);
  gaPad('gsg-pad');
}
let GA_PAD=null;
function gaPad(id){const c=document.getElementById(id);if(!c)return;const x=c.getContext('2d');x.lineWidth=2.2;x.lineCap='round';x.strokeStyle='#1a1a2e';let on=false,vide=true;
  const pos=e=>{const r=c.getBoundingClientRect();const p=e.touches?e.touches[0]:e;return[(p.clientX-r.left)*c.width/r.width,(p.clientY-r.top)*c.height/r.height];};
  const down=e=>{on=true;vide=false;const[a,b]=pos(e);x.beginPath();x.moveTo(a,b);e.preventDefault();};const move=e=>{if(!on)return;const[a,b]=pos(e);x.lineTo(a,b);x.stroke();e.preventDefault();};const up=()=>on=false;
  c.addEventListener('pointerdown',down);c.addEventListener('pointermove',move);window.addEventListener('pointerup',up);
  GA_PAD={c,vide:()=>vide,clear:()=>{x.clearRect(0,0,c.width,c.height);vide=true;}};}
function gaPadClear(){GA_PAD?.clear();}
async function gaSignCreer(mid){
  const m=gaMandat(mid);const type=gaV('gsg-type');const titre=gaV('gsg-titre');const nom=gaV('gsg-nom'),mail=gaV('gsg-mail');
  if(!nom||!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(mail)){toast('Nom et e-mail valides du signataire requis');return;}
  if(!GA_PAD||GA_PAD.vide()){toast('Signez dans le cadre');return;}
  const contenu=type==='mandat'?gaMandatHtml(m):`<h2>${gaE(titre)}</h2>`+gaV('gsg-texte').split(/\n\n+/).map(p=>`<p>${gaE(p).replace(/\n/g,'<br>')}</p>`).join('');
  if(type!=='mandat'&&!gaV('gsg-texte')){toast('Saisissez le texte du document');return;}
  const empreinte=await gaSha256(contenu);const A=gaAgence(m);const now=new Date().toISOString();
  const signataires=[{role:'Mandataire / bailleur représenté',nom:(gaMe()?gaMe()+' pour ':'')+A.nom,email:A.email||'',token:gaTok(),signed_at:now,image:GA_PAD.c.toDataURL('image/png'),ua:navigator.userAgent.slice(0,160)},
    {role:type==='avenant_bail'?'Locataire':'Mandant (propriétaire)',nom,email:mail,token:gaTok(),signed_at:null}];
  const{data,error}=await sb.from('gestion_signatures').insert({agency_id:U.id,mandat_id:mid,type,titre,contenu,empreinte,signataires,statut:'en_cours'}).select().single();
  if(error){toast(/relation|schema cache/i.test(error.message)?'Exécutez d’abord supabase-migration-gestion-agence.sql dans Supabase.':error.message);return;}
  (GA.signatures=GA.signatures||[]).push(data);
  const lien=`${location.origin}/signer.html?t=${signataires[1].token}`;
  const ok=await gaMail(mail,`Document à signer : ${titre}`,'Document à signer en ligne',`<p>Bonjour ${gaE(nom)},</p><p>${gaE(A.nom)} vous invite à signer électroniquement : <strong>${gaE(titre)}</strong>.</p><p>Relisez le document puis signez en quelques secondes depuis votre ordinateur ou votre téléphone.</p>`,{url:lien,label:'Lire et signer'});
  try{await navigator.clipboard.writeText(lien);}catch(e){}
  gaCloseModal();toast(ok?'Document envoyé pour signature (lien copié)':'E-mail non envoyé — lien de signature copié');gaRender();
}
function gaSignListe(){
  const S=(GA.signatures||[]).filter(s=>!GA.entiteF||gaActifs().some(m=>m.id===s.mandat_id)).sort((a,b)=>String(b.created_at).localeCompare(String(a.created_at)));
  return`<div style="font-size:.78rem;color:var(--td);margin-bottom:.6rem">Pour faire signer un mandat ou un avenant : fiche du bien → onglet Propriétaire (ou Locataire) → « Faire signer en ligne ».</div>
  <div class="card"><div class="cb" style="padding:.4rem 1rem">${S.map(s=>{const m=gaMandat(s.mandat_id);const att=(s.signataires||[]).filter(x=>!x.signed_at);return`<div style="display:flex;justify-content:space-between;gap:.6rem;flex-wrap:wrap;align-items:center;padding:.6rem 0;border-bottom:1px solid var(--b)">
    <div style="font-size:.82rem"><strong>${gaE(s.titre)}</strong><div style="font-size:.72rem;color:var(--td)">${gaFrC(s.created_at)} · ${(s.signataires||[]).map(x=>`${gaE(x.nom)} ${x.signed_at?'✓':'…'}`).join(' · ')}</div></div>
    <div style="display:flex;gap:.3rem;align-items:center">${s.statut==='signe'?gaBadge('signé','b-green'):gaBadge('en attente','b-gold')}${att.length?`<button class="btn bg bsm" onclick="gaSignRelance('${s.id}')">Relancer</button>`:''}<button class="btn bg bsm" onclick="gaSignPdf('${s.id}')"><i data-lucide=file-down class=ic></i> PDF</button></div></div>`;}).join('')||'<div style="font-size:.8rem;color:var(--td);padding:.6rem 0">Aucun document envoyé en signature.</div>'}</div></div>`;
}
async function gaSignRefresh(id){const{data}=await sb.from('gestion_signatures').select('*').eq('id',id).maybeSingle();if(data){const s=GA.signatures.find(x=>x.id===id);Object.assign(s,data);return s;}return GA.signatures.find(x=>x.id===id);}
async function gaSignRelance(id){
  const s=await gaSignRefresh(id);const A=gaAgence(gaMandat(s.mandat_id));let n=0;
  for(const x of(s.signataires||[]).filter(x=>!x.signed_at&&x.email)){if(await gaMail(x.email,`Rappel : document à signer — ${s.titre}`,'Document en attente de votre signature',`<p>Bonjour ${gaE(x.nom)},</p><p>${gaE(A.nom)} attend votre signature pour : <strong>${gaE(s.titre)}</strong>.</p>`,{url:`${location.origin}/signer.html?t=${x.token}`,label:'Lire et signer'}))n++;}
  toast(n?'Relance envoyée':'Relance non envoyée');
}
async function gaSignPdf(id){
  const s=await gaSignRefresh(id);const m=gaMandat(s.mandat_id);const A=gaAgence(m);const ok=(await gaSha256(s.contenu))===s.empreinte;
  gaPdf(jsPDF=>{const d=new jsPDF({unit:'mm',format:'a4'});const W=210,M=18;let y=18;
    const t=x=>String(x??'').replace(/[  ]/g,' ').replace(/[’]/g,"'").replace(/[«»]/g,'"').replace(/[—–]/g,'-').replace(/…/g,'...').replace(/€/g,'EUR').replace(/œ/g,'oe');
    const need=h=>{if(y+h>280){d.addPage();y=18;}};
    d.setFont('helvetica','bold');d.setFontSize(12);d.text(t(A.nom),M,y);y+=8;
    const div=document.createElement('div');div.innerHTML=s.contenu;
    for(const el of div.children){const tag=el.tagName;const txt=t(el.textContent.trim());if(!txt)continue;
      d.setFont('helvetica',/H[23]/.test(tag)?'bold':'normal');d.setFontSize(tag==='H2'?13:tag==='H3'?10.5:9.5);
      d.splitTextToSize(txt,W-2*M).forEach(l=>{need(5);d.text(l,M,y);y+=tag==='H2'?6:4.6;});y+=2.5;}
    need(10);y+=4;d.setFont('helvetica','bold');d.setFontSize(10);d.text('Signatures',M,y);y+=6;
    for(const x of s.signataires||[]){need(40);d.setFont('helvetica','normal');d.setFontSize(9);d.text(t(`${x.role} : ${x.nom}`),M,y);y+=4.5;
      d.text(t(x.signed_at?`Signé électroniquement le ${new Date(x.signed_at).toLocaleString('fr-FR')}`:'Non signé'),M,y);y+=2;
      if(x.image){try{d.addImage(x.image,'PNG',M,y,55,15);}catch(e){}y+=17;}else y+=4;}
    need(26);y+=3;d.setFontSize(7.5);d.setTextColor(90);
    [`Dossier de preuve — signature électronique simple (règlement eIDAS, art. 25 ; Code civil, art. 1366 et 1367).`,`Empreinte SHA-256 du document : ${s.empreinte}${ok?' (vérifiée)':' (NE CORRESPOND PLUS AU DOCUMENT)'}.`,`Identification : lien personnel unique envoyé à l'adresse e-mail de chaque signataire ; consentement exprès donné en ligne.`,
      ...(s.signataires||[]).filter(x=>x.signed_at).map(x=>`${x.nom} <${x.email||'-'}> : ${new Date(x.signed_at).toISOString()} — ${x.ua||''}`)].forEach(l=>{d.splitTextToSize(t(l),W-2*M).forEach(z=>{need(4);d.text(z,M,y);y+=3.4;});});
    d.save(`${t(s.titre).replace(/[^A-Za-z0-9]+/g,'-')}.pdf`);});
}

// ════════════════════════════════════════════════════════════════════
// Droits par utilisateur + journal d'activité
// ════════════════════════════════════════════════════════════════════
const GA_ROLES={
  complet:{l:'Accès complet',d:'Tout, sauf la gestion des droits',a:['enc','rev','mandat','compta','courrier','params']},
  comptable:{l:'Comptable',d:'Encaissements, banque, reversements, comptabilité, clôture',a:['enc','rev','compta','courrier']},
  assistant:{l:'Assistant(e) de gestion',d:'Encaissements, mandats, courriers, sinistres — pas de reversement ni de clôture',a:['enc','mandat','courrier']},
  lecture:{l:'Lecture seule',d:'Consulte tout, ne modifie rien',a:[]},
};
const GA_ACTIONS={
  gaSaveEnc:['enc','Encaissement saisi'],gaBkValider:['enc','Rapprochement validé'],gaBkToutValider:['enc','Rapprochements validés en lot'],gaBkManuel:['enc','Rapprochement manuel'],gaSepaLot:['enc','Lot de prélèvements généré'],
  gaSaveRev:['rev','Reversement enregistré'],gaReverser:['rev','Ouverture d’un reversement'],gaSepaVirements:['rev','Virements SEPA générés'],
  gaSaveMandat:['mandat','Mandat enregistré'],gaApplyIrl:['mandat','Révision de loyer appliquée'],gaRegulEnvoyer:['mandat','Régularisation envoyée'],gaImpGo:['mandat','Import de biens'],gaRepriseSave:['mandat','Reprise des charges'],gaSignCreer:['mandat','Signature électronique envoyée'],
  gaCloturer:['compta','Clôture d’exercice'],gaFec:['compta','Export FEC'],
  gaEnvoiGroupe:['courrier','Envoi groupé de courriers'],gaSinistreSave:['courrier','Sinistre enregistré'],gaBordereauEnvoye:['courrier','Bordereau GLI envoyé'],
  gaEntiteSave:['params','Société / agence modifiée'],
};
function gaIsAdmin(){try{return typeof isAgencyAdmin!=='function'||isAgencyAdmin()||!getCurrentTeamMember();}catch(e){return true;}}
function gaRole(nom){
  if(!nom&&gaIsAdmin())return'admin';
  const me=nom||gaMe();if(!me)return'admin';
  try{const m=getTeamMembers().find(x=>x.name===me);return m&&GA_ROLES[m.droits_gestion]?m.droits_gestion:'complet';}catch(e){return'complet';}
}
function gaPeut(cat){const r=gaRole();return r==='admin'||(GA_ROLES[r]?.a||[]).includes(cat);}
function gaQui(){return gaIsAdmin()?(agencyData?.agency_name||'Agence')+' (admin)':gaMe()||'Agence';}
async function gaJournal(action,cible,detail){
  try{const row={agency_id:U.id,membre:gaQui(),action,cible:cible?String(cible).slice(0,200):null,detail:detail?String(detail).slice(0,500):null};
    const{data}=await sb.from('gestion_journal').insert(row).select().single();if(data&&GA.journal)GA.journal.unshift(data);}catch(e){}
}
// Cible lisible à partir des arguments de l'action
function gaJournalCible(nom,args){
  try{const a=args[0];
    if(nom==='gaSaveEnc'){const{p,m}=gaPayCtx(a);return`${m?gaBien(m):''} — ${p?gaMoisLbl(String(p.due_date).slice(0,7)):''} ${args[1]?gaEur(args[1]):''}`.trim();}
    if(['gaSaveRev','gaReverser'].includes(nom)){const o=gaOwners().find(x=>x.key===a);return o?o.name||o.key:a;}
    if(['gaSaveMandat','gaApplyIrl','gaSignCreer'].includes(nom)){const m=(GA.mandats||[]).find(x=>x.id===a);return m?gaBien(m):(a?String(a):'nouveau mandat');}
    if(nom==='gaCloturer'||nom==='gaFec')return'Exercice '+a;
    if(nom==='gaSepaLot')return a?gaMoisLbl(a):'';
    if(nom==='gaEnvoiGroupe')return a==='pdf'?'courriers PDF':'e-mails';
    if(nom==='gaSinistreSave'){const m=gaMandat(gaV('gsi-m'));return m?gaBien(m):'';}
    if(nom==='gaBordereauEnvoye')return`${a} — ${args[1]?gaMoisLbl(args[1]):''}`;
    return a==null?'':typeof a==='object'?'':String(a);
  }catch(e){return'';}
}
// Contrôle des droits + date d'exercice clôturé + journal, posés sur les fonctions existantes
function gaInstallDroits(){
  if(window.__gaDroits)return;window.__gaDroits=true;
  for(const[nom,[cat,lib]]of Object.entries(GA_ACTIONS)){
    const f=window[nom];if(typeof f!=='function')continue;
    window[nom]=function(...args){
      if(!gaPeut(cat)){toast(`Action non autorisée pour votre profil (${GA_ROLES[gaRole()]?.l||'—'}). Demandez à l’administrateur de l’agence.`);return;}
      if(nom==='gaSaveEnc'){const dt=args[2]||gaV('ge-dt')||gaToday();const{m}=gaPayCtx(args[0])||{};const c=typeof gaVerrou==='function'&&gaVerrou(dt,m);if(c){toast(`L’exercice est clôturé jusqu’au ${gaFr(c.date_fin)} : choisissez une date postérieure.`);return;}}
      if(nom==='gaSaveRev'){const dt=gaV('gr-dt')||gaToday();const o=gaOwners().find(x=>x.key===args[0]);const c=typeof gaVerrou==='function'&&gaVerrou(dt,o?.ms?.[0]);if(c){toast(`L’exercice est clôturé jusqu’au ${gaFr(c.date_fin)} : choisissez une date postérieure.`);return;}}
      const cible=gaJournalCible(nom,args);
      const r=f.apply(this,args);
      if(nom!=='gaReverser')Promise.resolve(r).then(()=>gaJournal(lib,cible)).catch(()=>{});
      return r;
    };
  }
}
// ── Écran (dans Paramètres) ─────────────────────────────────────────
function gaRenderDroits(){
  const tm=(()=>{try{return getTeamMembers();}catch(e){return[];}})();
  const admin=gaIsAdmin();
  const roleSel=m=>`<select class="fi" style="max-width:230px;padding:.35rem .5rem;font-size:.8rem" onchange="gaSetDroits('${gaE(m.name).replace(/'/g,'\\&#39;')}',this.value)" ${admin?'':'disabled'} aria-label="Droits de ${gaE(m.name)}">${Object.entries(GA_ROLES).map(([k,r])=>`<option value="${k}"${(m.droits_gestion||'complet')===k?' selected':''}>${r.l}</option>`).join('')}</select>`;
  const J=GA.journal;
  return`<div class="card" style="margin-bottom:1rem"><div class="cb">
    <div style="font-weight:700;margin-bottom:.2rem">Droits de l’équipe sur la gestion</div>
    <div style="font-size:.74rem;color:var(--td);margin-bottom:.4rem">${admin?'Choisissez ce que chaque collaborateur peut faire. Le profil agence (administrateur) a toujours tous les droits.':`Vous êtes connecté(e) en tant que <strong>${gaE(gaMe())}</strong> — ${GA_ROLES[gaRole()]?.l||''}. Seul l’administrateur modifie les droits.`}</div>
    ${tm.length?tm.map(m=>`<div style="display:flex;justify-content:space-between;align-items:center;gap:.6rem;padding:.5rem 0;border-top:1px solid var(--b);flex-wrap:wrap"><div style="font-size:.82rem"><strong>${gaE(m.name)}</strong><div style="font-size:.7rem;color:var(--td)">${GA_ROLES[m.droits_gestion||'complet'].d}</div></div>${roleSel(m)}</div>`).join('')
      :'<div style="font-size:.8rem;color:var(--td)">Aucun collaborateur : ajoutez-en depuis la page Équipe.</div>'}
  </div></div>
  <div class="card"><div class="cb">
    <div style="display:flex;justify-content:space-between;align-items:center;gap:.5rem;flex-wrap:wrap;margin-bottom:.4rem"><div style="font-weight:700">Journal d’activité</div>
      <div style="display:flex;gap:.4rem">${J?`<button class="btn bg bsm" onclick="gaJournalCsv()">Exporter (CSV)</button>`:''}<button class="btn bg bsm" onclick="gaJournalCharger()">${J?'Actualiser':'Afficher'}</button></div></div>
    ${J?(J.length?`<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:.78rem"><thead><tr style="text-align:left;color:var(--td);font-size:.68rem;text-transform:uppercase"><th style="padding:.35rem">Date</th><th style="padding:.35rem">Qui</th><th style="padding:.35rem">Action</th><th style="padding:.35rem">Sur</th></tr></thead><tbody>
      ${J.slice(0,200).map(j=>`<tr style="border-top:1px solid var(--b)"><td style="padding:.35rem;white-space:nowrap">${new Date(j.created_at).toLocaleString('fr-FR',{dateStyle:'short',timeStyle:'short'})}</td><td style="padding:.35rem">${gaE(j.membre||'')}</td><td style="padding:.35rem">${gaE(j.action||'')}</td><td style="padding:.35rem">${gaE(j.cible||'')}</td></tr>`).join('')}</tbody></table></div>`
      :'<div style="font-size:.8rem;color:var(--td)">Aucune action enregistrée pour l’instant.</div>')
      :'<div style="font-size:.8rem;color:var(--td)">Qui a encaissé, reversé, clôturé, envoyé… : chaque action importante est tracée.</div>'}
  </div></div>`;
}
async function gaSetDroits(nom,role){
  if(!gaIsAdmin()){toast('Seul l’administrateur modifie les droits');return;}
  const tm=getTeamMembers().map(m=>m.name===nom?{...m,droits_gestion:role}:m);
  const{error}=await sb.from('agency_profiles').update({team_members:JSON.stringify(tm)}).eq('clerk_id',U.id);
  if(error){toast(error.message);return;}
  agencyData={...agencyData,team_members:JSON.stringify(tm)};
  gaJournal('Droits modifiés',`${nom} → ${GA_ROLES[role].l}`);toast('Droits mis à jour');gaRender();
}
async function gaJournalCharger(){
  const{data,error}=await sb.from('gestion_journal').select('*').eq('agency_id',U.id).order('created_at',{ascending:false}).limit(500);
  if(error){toast('Journal indisponible : relancez la migration SQL');return;}
  GA.journal=data||[];gaRender();
}
function gaJournalCsv(){gaCsv('journal-gestion',['Date','Qui','Action','Sur','Détail'],(GA.journal||[]).map(j=>[j.created_at,j.membre,j.action,j.cible,j.detail]));}
gaInstallDroits();

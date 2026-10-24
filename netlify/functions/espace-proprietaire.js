// Espace propriétaire : données d'un seul propriétaire, à partir de son lien personnel (?t=jeton).
// Calculé côté serveur (clé de service) pour ne renvoyer QUE ses biens et son compte.
// Variable : SUPABASE_SERVICE_KEY.
const SUPABASE_URL = 'https://hkhmktcbyfyacwfmoyxy.supabase.co';
const KEY = process.env.SUPABASE_SERVICE_KEY;
const api = path => fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: { apikey: KEY, Authorization: 'Bearer ' + KEY } })
  .then(async r => { const t = await r.text(); if (!r.ok) throw new Error(path.split('?')[0] + ' ' + r.status); return t ? JSON.parse(t) : []; });
const patch = (path, body) => fetch(`${SUPABASE_URL}/rest/v1/${path}`, { method: 'PATCH', headers: { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json', Prefer: 'return=minimal' }, body: JSON.stringify(body) });
const R = n => Math.round((Number(n) || 0) * 100) / 100;
const iso = d => new Date(d).toISOString().slice(0, 10);
const inList = a => `(${a.map(x => `"${x}"`).join(',')})`;
const ownerKey = m => String(m.owner_email || m.owner_name || 'sans-proprietaire').trim().toLowerCase();
const json = (s, b) => ({ statusCode: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify(b) });
const BAUX = { habitation_meuble: 'Habitation meublée', habitation_vide: 'Habitation vide', mixte: 'Mixte', professionnel: 'Bail professionnel', commercial: 'Bail commercial', parking: 'Parking / garage' };

exports.handler = async (event) => {
  const t = (event.queryStringParameters || {}).t;
  if (!KEY) return json(500, { error: 'Configuration incomplète' });
  if (!t || !/^[a-f0-9]{16,64}$/.test(t)) return json(400, { error: 'Lien invalide' });
  try {
    const acc = (await api(`gestion_proprio_acces?token=eq.${t}&select=*`))[0];
    if (!acc) return json(404, { error: 'Ce lien n’est plus valable' });
    const all = await api(`gestion_mandats?agency_id=eq.${encodeURIComponent(acc.agency_id)}&select=*`);
    const ms = all.filter(m => ownerKey(m) === acc.owner_key);
    if (!ms.length) return json(404, { error: 'Aucun bien en gestion' });
    const ids = ms.map(m => m.id);
    const leaseIds = ms.map(m => m.lease_id).filter(Boolean);
    const [pays, ops, crg, reg, ag, ents, leases] = await Promise.all([
      api(`payments?mandat_id=in.${inList(ids)}&select=id,mandat_id,amount,amount_paid,status,due_date,paid_at,type,tenant_name`),
      api(`gestion_operations?mandat_id=in.${inList(ids)}&select=*`),
      api(`gestion_crg?agency_id=eq.${encodeURIComponent(acc.agency_id)}&owner_key=eq.${encodeURIComponent(acc.owner_key)}&select=periode,net,envoye_at&order=periode.desc`).catch(() => []),
      api(`gestion_regul?mandat_id=in.${inList(ids)}&select=mandat_id,annee,statut,solde,reel,provisions,envoye_at,applique_at`).catch(() => []),
      api(`agency_profiles?clerk_id=eq.${encodeURIComponent(acc.agency_id)}&select=agency_name,phone,email,address`),
      api(`gestion_entites?agency_id=eq.${encodeURIComponent(acc.agency_id)}&select=*`).catch(() => []),
      leaseIds.length ? api(`leases?id=in.${inList(leaseIds)}&select=id,tenant_id,rent,charges,start_date`) : [],
    ]);
    const profs = {}; const tIds = leases.map(l => l.tenant_id).filter(Boolean);
    if (tIds.length) (await api(`profiles?clerk_id=in.${inList(tIds)}&select=clerk_id,full_name`)).forEach(p => profs[p.clerk_id] = p.full_name);
    const today = iso(new Date()); const cur = today.slice(0, 7);
    const paid = p => p.status === 'paid' ? Number(p.amount_paid ?? p.amount) || 0 : Number(p.amount_paid) || 0;
    const reste = p => p.status === 'paid' ? 0 : Math.max(0, (+p.amount || 0) - (+p.amount_paid || 0));
    const RENT = ['rent', 'first_rent', 'loyer'];
    const lignes = []; let enc = 0, hon = 0, gli = 0, frais = 0, opsT = 0, rev = 0;
    const biens = ms.map(m => {
      const L = leases.find(l => l.id === m.lease_id);
      const ten = L ? { nom: profs[L.tenant_id] || 'Locataire', hc: +L.rent || 0, ch: +L.charges || 0, debut: L.start_date } : m.loc_nom ? { nom: m.loc_nom, hc: +m.loc_loyer_hc || 0, ch: +m.loc_charges || 0, debut: m.loc_debut } : null;
      const tva = m.tva_loyer && ['commercial', 'professionnel'].includes(m.type_bail) ? (+m.tva_taux || 20) : 0;
      const tot = ten ? ten.hc + ten.ch : 0;
      const mp = pays.filter(p => p.mandat_id === m.id && RENT.includes(p.type) && p.status !== 'cancelled');
      for (const p of mp) {
        const v = paid(p); if (!v || !p.paid_at) continue;
        const ht = v / (1 + tva / 100); const base = m.base_honoraires === 'hc' && tot ? ht * ten.hc / tot : ht;
        const h = R(base * (+m.taux_honoraires || 0) / 100), g = m.gli ? R(v * (+m.gli_taux || 0) / 100) : 0;
        enc += v; hon += h; gli += g; const d = iso(p.paid_at); const bien = m.bien_label || m.bien_adresse || 'Bien';
        lignes.push({ date: d, bien, lib: `Loyer ${new Date(p.due_date + 'T12:00:00').toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}`, cr: R(v), db: 0 });
        if (h) lignes.push({ date: d, bien, lib: `Honoraires de gestion (${m.taux_honoraires} %)`, cr: 0, db: h });
        if (g) lignes.push({ date: d, bien, lib: 'Assurance loyers impayés', cr: 0, db: g });
      }
      if (+m.frais_fixes > 0) { const st = String(m.date_signature || m.created_at || '').slice(0, 7); for (let ym = st; ym && ym <= cur; ym = (() => { const [y, mo] = ym.split('-').map(Number); return new Date(Date.UTC(y, mo, 15)).toISOString().slice(0, 7); })()) { frais += +m.frais_fixes; lignes.push({ date: ym + '-01', bien: m.bien_label || 'Bien', lib: 'Frais de gestion forfaitaires', cr: 0, db: +m.frais_fixes }); } }
      for (const o of ops.filter(o => o.mandat_id === m.id && +o.montant && !String(o.type || '').startsWith('depot_'))) {
        const v = +o.montant; if (o.type === 'reversement') rev += -v; else opsT += v;
        lignes.push({ date: iso(o.date), bien: m.bien_label || 'Bien', lib: o.libelle || o.type, cr: v > 0 ? v : 0, db: v < 0 ? -v : 0, rev: o.type === 'reversement' });
      }
      const du = mp.filter(p => p.status !== 'paid' && reste(p) > 0.009 && p.due_date < today);
      const moisP = mp.find(p => String(p.due_date).slice(0, 7) === cur);
      return {
        id: m.id, bien: m.bien_label || m.bien_adresse || 'Bien', adresse: m.bien_adresse || '', type: BAUX[m.type_bail] || (m.bien_meuble === false ? 'Habitation vide' : 'Habitation meublée'),
        locataire: ten ? ten.nom : null, loyer: ten ? R(tot * (1 + tva / 100)) : null, depuis: ten?.debut || null,
        mois: moisP ? { statut: moisP.status === 'paid' ? 'payé' : moisP.due_date < today ? 'en retard' : 'à venir', echeance: moisP.due_date, montant: +moisP.amount } : null,
        impaye: R(du.reduce((s, p) => s + reste(p), 0)),
        regul: reg.filter(r => r.mandat_id === m.id && ['envoye', 'applique'].includes(r.statut)).map(r => ({ annee: r.annee, solde: r.solde, reel: r.reel, provisions: r.provisions })),
      };
    });
    lignes.sort((a, b) => b.date.localeCompare(a.date));
    const solde = R(enc - hon - gli - frais + opsT - rev);
    const e = ents.find(x => x.id === ms[0].entite_id) || ents.find(x => x.defaut) || null;
    const a = ag[0] || {};
    await patch(`gestion_proprio_acces?token=eq.${t}`, { vu_at: new Date().toISOString() }).catch(() => {});
    return json(200, {
      proprietaire: ms[0].owner_name || 'Propriétaire',
      agence: { nom: e?.nom || a.agency_name || 'Votre agence', tel: e?.tel || a.phone || '', email: e?.email || a.email || '', adresse: e?.adresse || a.address || '' },
      biens, compte: { solde, encaisse: R(enc), honoraires: R(hon + frais), gli: R(gli), reverse: R(rev), lignes: lignes.slice(0, 300) },
      crg: crg.slice(0, 24),
    });
  } catch (e) { console.error('espace-proprietaire', e); return json(500, { error: 'Données indisponibles pour le moment' }); }
};

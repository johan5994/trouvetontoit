// Taxe d'ordures ménagères (TEOM) — fonction planifiée Netlify (tous les jours).
// À déclarer dans netlify.toml :
//   [functions."teom-auto"]
//     schedule = "@daily"
// Variables : SUPABASE_SERVICE_KEY ; e-mail facultatif (BREVO_API_KEY + BREVO_SENDER, voir _shared/mailer.js).
//
// De septembre à décembre, pour chaque bien loué en direct dans l'année :
//  1) l'avis de taxe foncière n'est pas encore déposé → message au propriétaire début septembre, puis rappel chaque mois ;
//  2) l'avis est déposé (montant lu ou saisi) et des demandes restent à envoyer → message avec la part de chaque
//     locataire, calculée au prorata de ses jours d'occupation dans l'année (une fois) ;
// Réservé aux propriétaires abonnés (sans abonnement : saisie et envoi à la main dans l'onglet TEOM).
// Toute l'année :
//  3) demande envoyée au locataire depuis plus d'un mois, sans paiement indiqué → relance au locataire (une fois).
const SUPABASE_URL = 'https://hkhmktcbyfyacwfmoyxy.supabase.co';
const KEY = process.env.SUPABASE_SERVICE_KEY;
const { sendMail } = require('./_shared/mailer');
const { estAbonne } = require('./_shared/abonnement');
const SITE = process.env.URL || 'https://trouvetontoi.netlify.app';

const api = (path, opts = {}) => fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
  ...opts,
  headers: { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json', Prefer: 'return=representation', ...(opts.headers || {}) },
}).then(async r => { const t = await r.text(); if (!r.ok) throw new Error(path + ' → ' + r.status + ' ' + t); return t ? JSON.parse(t) : null; });
const eur = n => (Math.round((Number(n) || 0) * 100) / 100).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
const fr = d => new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Paris' });
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const json = v => { if (typeof v !== 'string') return v; try { return JSON.parse(v); } catch (e) { return null; } };
const msg = (to, listing_id, content) => to ? api('messages', { method: 'POST', body: JSON.stringify({ listing_id: listing_id || null, sender_id: 'system', receiver_id: to, type: 'message', content }) }).catch(() => {}) : null;

// Occupation jour par jour (même calcul que _gPart dans landlord-dashboard.html) : un jour partagé entre n baux compte 1/n
const day = s => new Date(String(s).slice(0, 10) + 'T00:00:00Z');
const occupe = (l, d) => (!l.start_date || d >= day(l.start_date)) && (!l._fin || d <= day(l._fin));
function part(l, annee, tous) {
  let occ = 0, p = 0, partage = 0, tot = 0;
  for (let d = day(`${annee}-01-01`); d <= day(`${annee}-12-31`); d = new Date(d.getTime() + 864e5)) {
    tot++; if (!occupe(l, d)) continue; occ++;
    const n = tous.filter(x => occupe(x, d)).length || 1; p += 1 / n; if (n > 1) partage++;
  }
  return { occ, tot, partage, f: tot ? p / tot : 0 };
}

exports.handler = async () => {
  if (!KEY) return { statusCode: 500, body: 'SUPABASE_SERVICE_KEY manquante' };
  const now = new Date(), annee = now.getFullYear(), mois = now.getMonth() + 1;
  const stats = { rappels: 0, prets: 0, relances: 0 };
  const abo = {}, estAbo = async id => (id in abo ? abo[id] : (abo[id] = await estAbonne(api, id)));

  // 3) Relances des locataires (toute l'année)
  try {
    const lim = new Date(now.getTime() - 31 * 864e5).toISOString();
    const dues = await api(`teom_refacturations?select=*&envoye_at=lte.${lim}&paiement_declare_at=is.null&paiement_confirme_at=is.null&relance_at=is.null`) || [];
    for (const r of dues) {
      if (!r.tenant_id || !(await estAbo(r.landlord_id))) continue;
      await msg(r.tenant_id, null, `Rappel : votre part de taxe d'ordures ménagères ${r.annee} (${eur(r.part)}), demandée le ${fr(r.envoye_at)}, n'a pas encore été réglée. Merci de la payer à votre propriétaire puis de l'indiquer dans « Mon logement ».`);
      await api(`teom_refacturations?id=eq.${r.id}`, { method: 'PATCH', body: JSON.stringify({ relance_at: now.toISOString() }) });
      if (r.landlord_id) await msg(r.landlord_id, null, `Relance automatique envoyée pour la taxe d'ordures ménagères ${r.annee} (${eur(r.part)}) : pas de paiement indiqué un mois après la demande.`);
      stats.relances++;
    }
  } catch (e) { console.error('relances TEOM', e.message); }

  if (mois < 9) return { statusCode: 200, body: JSON.stringify(stats) };

  // Baux signés en direct, en cours pendant l'année
  let leases = [];
  try { leases = await api('leases?select=*&landlord_signed_at=not.is.null&tenant_signed_at=not.is.null') || []; }
  catch (e) { return { statusCode: 200, body: 'Lecture des baux impossible : ' + e.message }; }
  let sousMandat = new Set(); try { sousMandat = new Set((await api('gestion_mandats?select=lease_id&statut=neq.resilie') || []).map(m => m.lease_id).filter(Boolean)); } catch (e) {}
  const bids = [...new Set(leases.map(l => l.booking_id).filter(Boolean))];
  if (bids.length) try { const fins = {}; (await api(`bookings?select=id,tenancy_ended_at&id=in.(${bids.join(',')})`) || []).forEach(b => fins[b.id] = b.tenancy_ended_at); leases.forEach(l => { if (fins[l.booking_id]) l._fin = fins[l.booking_id]; }); } catch (e) {}
  leases = leases.filter(l => !sousMandat.has(l.id) && l.start_date && day(l.start_date) <= day(`${annee}-12-31`) && (!l._fin || day(l._fin) >= day(`${annee}-01-01`)));
  if (!leases.length) return { statusCode: 200, body: JSON.stringify(stats) };

  const parBien = {}; leases.forEach(l => { if (l.listing_id) (parBien[l.listing_id] = parBien[l.listing_id] || []).push(l); });
  const lids = Object.keys(parBien);
  const listings = {}; try { (await api(`listings?select=id,title&id=in.(${lids.join(',')})`) || []).forEach(x => listings[x.id] = x); } catch (e) {}
  const teom = await api(`teom_refacturations?select=*&annee=eq.${annee}&lease_id=in.(${leases.map(l => l.id).join(',')})`).catch(() => []) || [];
  let suivis = []; try { suivis = await api(`teom_rappels?select=*&annee=eq.${annee}`) || []; } catch (e) { return { statusCode: 200, body: 'Table teom_rappels absente : exécutez supabase-migration-teom-auto.sql' }; }
  const pids = [...new Set(leases.flatMap(l => [l.landlord_id, l.tenant_id]))].filter(Boolean);
  const profils = {}; try { (await api(`profiles?select=clerk_id,full_name,email&clerk_id=in.(${pids.map(x => `"${x}"`).join(',')})`) || []).forEach(p => profils[p.clerk_id] = p); } catch (e) {}

  for (const [lid, ls] of Object.entries(parBien)) {
    try {
      if (!(await estAbo(ls[0].landlord_id))) continue;
      const ll = ls[0].landlord_id, titre = listings[lid]?.title || 'votre logement';
      const lien = `${SITE}/landlord-dashboard.html?teom=${lid}`;
      const rows = teom.filter(r => ls.some(l => l.id === r.lease_id));
      const total = rows.map(r => Number(r.teom_total) || Number(json(r.extraction)?.teom?.montant_hors_frais) || 0).find(v => v > 0) || 0;
      const depose = rows.some(r => (json(r.docs) || []).length || Number(r.teom_total) > 0);
      let s = suivis.find(x => x.listing_id === lid);
      const save = async patch => {
        if (s) { await api(`teom_rappels?id=eq.${s.id}`, { method: 'PATCH', body: JSON.stringify(patch) }); Object.assign(s, patch); }
        else { const [n] = await api('teom_rappels', { method: 'POST', body: JSON.stringify({ landlord_id: ll, listing_id: lid, annee, ...patch }) }) || []; s = n; }
      };
      const toutInclus = ls.every(l => l.teom_incluse === true && Number(l.charges) > 0);
      // 1) Avis à déposer : début septembre, puis un rappel par mois
      if (!depose) {
        if (s && Number(s.rappel_mois) >= mois) continue;
        const n = (Number(s?.rappels) || 0) + 1;
        const txt = `${n > 1 ? 'Rappel — ' : ''}Taxe foncière ${annee} : quand vous recevez l'avis (en général fin août ou septembre), déposez-le pour « ${titre} ». Le montant de la taxe d'ordures ménagères est lu automatiquement et ${toutInclus ? 'ajouté à la régularisation des charges (le bail l\'inclut dans la provision)' : 'la part de chaque locataire est calculée au prorata de son occupation'}. <a href='/landlord-dashboard.html?teom=${lid}'>Déposer l'avis</a>`;
        await msg(ll, lid, txt);
        const em = profils[ll]?.email;
        if (em && n === 1) await sendMail({ to: em, subject: `Taxe foncière ${annee} : refacturez la TEOM — ${titre}`, html: `<p>Bonjour ${esc(profils[ll]?.full_name || '')},</p><p>${esc(txt.replace(/<[^>]+>/g, ''))}</p><p><a href="${lien}" style="display:inline-block;background:#1B4FD8;color:#fff;text-decoration:none;padding:11px 22px;border-radius:8px;font-weight:700">Déposer l'avis</a></p>` }).catch(() => {});
        await save({ rappels: n, rappel_mois: mois, rappel_at: now.toISOString() });
        stats.rappels++; continue;
      }
      // 2) Montant connu : parts prêtes à envoyer (un message, une fois)
      if (!total || s?.pret_at) continue;
      const aEnvoyer = ls.map(l => ({ l, p: part(l, annee, ls) })).filter(x => x.p.occ > 0 && !(x.l.teom_incluse === true && Number(x.l.charges) > 0) && !rows.find(r => r.lease_id === x.l.id && r.envoye_at));
      if (!aEnvoyer.length) { await save({ pret_at: now.toISOString() }); continue; }
      const lignes = aEnvoyer.map(x => `${profils[x.l.tenant_id]?.full_name || x.l.tenant_name || 'Locataire'} : ${eur(total * x.p.f)} (${x.p.occ} jours sur ${x.p.tot})`).join(' ; ');
      await msg(ll, lid, `Taxe d'ordures ménagères ${annee} pour « ${titre} » : ${eur(total)}. Parts au prorata de l'occupation : ${lignes}. <a href='/landlord-dashboard.html?teom=${lid}'>Vérifier et envoyer les demandes</a>`);
      await save({ pret_at: now.toISOString() });
      stats.prets++;
    } catch (e) { console.error('teom', lid, e.message); }
  }
  return { statusCode: 200, body: JSON.stringify(stats) };
};
